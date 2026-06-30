import { TelemetryMessage, Alert, AlertRuleDB } from '../models/types';
import { databaseService } from './database.service';
import { redisService } from './redis.service';
import { openSearchService } from './opensearch.service';
import { logger } from '../utils/logger';

class AlertService {
  private dbRules: AlertRuleDB[] = [];

  async loadRulesFromDatabase(): Promise<void> {
    try {
      this.dbRules = await databaseService.getAlertRules();
      logger.info('Loaded alert rules from database', { count: this.dbRules.length });
    } catch (error) {
      logger.error('Failed to load alert rules from database', { error });
    }
  }

  private evaluateDbRule(rule: AlertRuleDB, telemetry: TelemetryMessage): boolean {
    const fieldValue = (telemetry as any)[rule.condition_field];

    switch (rule.condition_operator) {
      case 'GREATER_THAN':
        return fieldValue > (rule.condition_value || 0);
      case 'LESS_THAN':
        return fieldValue < (rule.condition_value || 0);
      case 'EQUALS':
        if (rule.condition_field === 'all_zero') {
          return telemetry.temperature === 0 && telemetry.voltage === 0 && 
                 telemetry.current === 0 && telemetry.energy_kwh === 0;
        }
        return fieldValue === rule.condition_value;
      case 'BETWEEN':
        return fieldValue > (rule.condition_value_min || 0) && 
               fieldValue <= (rule.condition_value_max || Infinity);
      case 'OUT_OF_RANGE':
        return fieldValue < (rule.condition_value_min || 0) || 
               fieldValue > (rule.condition_value_max || Infinity);
      default:
        return false;
    }
  }

  private formatMessage(template: string, telemetry: TelemetryMessage): string {
    return template
      .replace('{temperature}', telemetry.temperature.toString())
      .replace('{voltage}', telemetry.voltage.toString())
      .replace('{current}', telemetry.current.toString())
      .replace('{energy_kwh}', telemetry.energy_kwh.toString());
  }

  async evaluateAlerts(telemetry: TelemetryMessage): Promise<void> {
    try {
      for (const dbRule of this.dbRules) {
        if (this.evaluateDbRule(dbRule, telemetry)) {
          await this.triggerDbAlert(telemetry, dbRule);
        }
      }
    } catch (error) {
      logger.error('Failed to evaluate alerts', { error, device_id: telemetry.device_id });
    }
  }

  private async triggerDbAlert(telemetry: TelemetryMessage, rule: AlertRuleDB): Promise<void> {
    const alertId = `${telemetry.device_id}_${rule.rule_type}_${Date.now()}`;
    const alert: Omit<Alert, 'id'> = {
      alert_id: alertId,
      device_id: telemetry.device_id,
      alert_type: rule.rule_type,
      severity: rule.severity as any,
      message: this.formatMessage(rule.message_template, telemetry),
      triggered_at: new Date(),
      context: {
        temperature: telemetry.temperature,
        voltage: telemetry.voltage,
        current: telemetry.current,
        energy_kwh: telemetry.energy_kwh,
        status: telemetry.status,
        timestamp: telemetry.timestamp,
      },
      acknowledged: false,
    };

    try {
      await databaseService.withTransaction(async (client) => {
        await databaseService.insertAlertWithClient(client, alert);
      });

      await this.indexAndPublishAlert(alert);

      logger.info('Alert triggered from DB rule', {
        alert_id: alertId,
        device_id: telemetry.device_id,
        alert_type: rule.rule_type,
        severity: rule.severity,
      });
    } catch (error) {
      logger.error('Failed to trigger alert', {
        error,
        alert_id: alertId,
        device_id: telemetry.device_id,
        alert_type: rule.rule_type,
      });
      throw error;
    }
  }

  private async indexAndPublishAlert(alert: Omit<Alert, 'id'>): Promise<void> {
    const errors: Error[] = [];

    try {
      await openSearchService.indexAlert(alert);
    } catch (error) {
      logger.error('Failed to index alert in OpenSearch (non-critical)', {
        error,
        alert_id: alert.alert_id,
      });
      errors.push(error as Error);
    }

    try {
      await this.publishAlertToRedis(alert);
    } catch (error) {
      logger.error('Failed to publish alert to Redis (non-critical)', {
        error,
        alert_id: alert.alert_id,
      });
      errors.push(error as Error);
    }

    if (errors.length > 0) {
      logger.warn('Alert saved to database but some external operations failed', {
        alert_id: alert.alert_id,
        failed_operations: errors.length,
      });
    }
  }

  private async publishAlertToRedis(alert: Omit<Alert, 'id'>): Promise<void> {
    try {
      await redisService.publish('alerts:all', alert);
      await redisService.publish(`alerts:device:${alert.device_id}`, alert);
      await redisService.publish(`alerts:type:${alert.alert_type}`, alert);
      await redisService.publish(`alerts:severity:${alert.severity}`, alert);
    } catch (error) {
      logger.error('Failed to publish alert to Redis', { error, alert_id: alert.alert_id });
    }
  }

  async createOfflineAlert(deviceId: string): Promise<void> {
    const alertId = `${deviceId}_DEVICE_OFFLINE_${Date.now()}`;
    const alert: Omit<Alert, 'id'> = {
      alert_id: alertId,
      device_id: deviceId,
      alert_type: 'DEVICE_OFFLINE',
      severity: 'HIGH',
      message: 'Device has gone offline',
      triggered_at: new Date(),
      context: {
        reason: 'No heartbeat received for 5 minutes',
      },
      acknowledged: false,
    };

    try {
      await databaseService.withTransaction(async (client) => {
        await databaseService.insertAlertWithClient(client, alert);
      });

      await this.indexAndPublishAlert(alert);

      logger.info('Offline alert created', { device_id: deviceId, alert_id: alertId });
    } catch (error) {
      logger.error('Failed to create offline alert', {
        error,
        device_id: deviceId,
        alert_id: alertId,
      });
      throw error;
    }
  }
}

export const alertService = new AlertService();

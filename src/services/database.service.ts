import { Pool, PoolClient } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';
import { Device, TelemetryRecord, Alert, InvalidMessage } from '../models/types';

class DatabaseService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.database,
      user: config.database.user,
      password: config.database.password,
      min: config.database.poolMin,
      max: config.database.poolMax,
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected database error', { error: err.message });
    });
  }

  async withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction rolled back', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      logger.info('Database connected successfully');
      client.release();
    } catch (error) {
      logger.error('Database connection failed', { error });
      throw error;
    }
  }

  async getDeviceByApiKey(apiKey: string): Promise<Device | null> {
    const query = 'SELECT * FROM devices WHERE api_key = $1';
    const result = await this.pool.query(query, [apiKey]);
    return result.rows[0] || null;
  }

  async getDeviceById(deviceId: string): Promise<Device | null> {
    const query = 'SELECT * FROM devices WHERE device_id = $1';
    const result = await this.pool.query(query, [deviceId]);
    return result.rows[0] || null;
  }

  async updateDeviceLastSeen(deviceId: string): Promise<void> {
    const query = `
      UPDATE devices 
      SET last_seen_at = NOW(), status = 'online', updated_at = NOW()
      WHERE device_id = $1
    `;
    await this.pool.query(query, [deviceId]);
  }

  async insertTelemetryBatch(records: TelemetryRecord[]): Promise<void> {
    if (records.length === 0) return;

    const values: any[] = [];
    const placeholders: string[] = [];

    records.forEach((record, index) => {
      const offset = index * 9;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`
      );
      values.push(
        record.message_id,
        record.device_id,
        record.timestamp,
        record.temperature,
        record.energy_kwh,
        record.voltage,
        record.current,
        record.status,
        record.ingested_at
      );
    });

    const query = `
      INSERT INTO telemetry (message_id, device_id, timestamp, temperature, energy_kwh, voltage, current, status, ingested_at)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (device_id, timestamp, message_id) DO NOTHING
    `;

    await this.pool.query(query, values);
    logger.info(`Inserted ${records.length} telemetry records`);
  }

  async insertTelemetryBatchWithClient(client: PoolClient, records: TelemetryRecord[]): Promise<void> {
    if (records.length === 0) return;

    const values: any[] = [];
    const placeholders: string[] = [];

    records.forEach((record, index) => {
      const offset = index * 9;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`
      );
      values.push(
        record.message_id,
        record.device_id,
        record.timestamp,
        record.temperature,
        record.energy_kwh,
        record.voltage,
        record.current,
        record.status,
        record.ingested_at
      );
    });

    const query = `
      INSERT INTO telemetry (message_id, device_id, timestamp, temperature, energy_kwh, voltage, current, status, ingested_at)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (device_id, timestamp, message_id) DO NOTHING
    `;

    await client.query(query, values);
  }

  async getLatestTelemetry(deviceId: string): Promise<TelemetryRecord | null> {
    const query = `
      SELECT * FROM telemetry 
      WHERE device_id = $1 
      ORDER BY timestamp DESC 
      LIMIT 1
    `;
    const result = await this.pool.query(query, [deviceId]);
    return result.rows[0] || null;
  }

  async getPreviousTelemetry(deviceId: string, currentTimestamp: Date): Promise<TelemetryRecord | null> {
    const query = `
      SELECT * FROM telemetry 
      WHERE device_id = $1 AND timestamp < $2
      ORDER BY timestamp DESC 
      LIMIT 1
    `;
    const result = await this.pool.query(query, [deviceId, currentTimestamp]);
    return result.rows[0] || null;
  }

  async insertAlert(alert: Omit<Alert, 'id'>): Promise<void> {
    const query = `
      INSERT INTO alerts (alert_id, device_id, alert_type, severity, message, triggered_at, context, acknowledged)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    await this.pool.query(query, [
      alert.alert_id,
      alert.device_id,
      alert.alert_type,
      alert.severity,
      alert.message,
      alert.triggered_at,
      JSON.stringify(alert.context),
      alert.acknowledged,
    ]);
  }

  async insertAlertWithClient(client: PoolClient, alert: Omit<Alert, 'id'>): Promise<void> {
    const query = `
      INSERT INTO alerts (alert_id, device_id, alert_type, severity, message, triggered_at, context, acknowledged)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    await client.query(query, [
      alert.alert_id,
      alert.device_id,
      alert.alert_type,
      alert.severity,
      alert.message,
      alert.triggered_at,
      JSON.stringify(alert.context),
      alert.acknowledged,
    ]);
  }

  async getAlerts(limit: number = 100, deviceId?: string): Promise<Alert[]> {
    let query = 'SELECT * FROM alerts';
    const params: any[] = [];

    if (deviceId) {
      query += ' WHERE device_id = $1';
      params.push(deviceId);
    }

    query += ' ORDER BY triggered_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async insertInvalidMessage(message: Omit<InvalidMessage, 'id'>): Promise<void> {
    const query = `
      INSERT INTO invalid_messages (message_id, device_id, timestamp, telemetry_message, reason_for_failure, rejected_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    await this.pool.query(query, [
      message.message_id,
      message.device_id,
      message.timestamp,
      JSON.stringify(message.telemetry_message),
      message.reason_for_failure,
      message.rejected_at,
    ]);
  }

  async createDevice(device: Omit<Device, 'created_at' | 'updated_at'>): Promise<void> {
    const query = `
      INSERT INTO devices (device_id, device_name, device_type, address, api_key, last_seen_at, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    await this.pool.query(query, [
      device.device_id,
      device.device_name,
      device.device_type,
      device.address,
      device.api_key,
      device.last_seen_at,
      device.status,
    ]);
  }

  async markOfflineDevices(): Promise<number> {
    const thresholdMinutes = config.application.offlineDeviceThresholdMinutes;
    const query = `
      UPDATE devices 
      SET status = 'offline', updated_at = NOW()
      WHERE status = 'online' 
        AND last_seen_at < NOW() - INTERVAL '${thresholdMinutes} minutes'
      RETURNING device_id
    `;
    const result = await this.pool.query(query);
    return result.rowCount || 0;
  }

  async getOfflineDevices(): Promise<Device[]> {
    const query = `
      SELECT * FROM devices 
      WHERE status = 'offline'
    `;
    const result = await this.pool.query(query);
    return result.rows;
  }

  async getAlertRules(): Promise<any[]> {
    const query = `
      SELECT * FROM alert_rules 
      WHERE enabled = true 
      ORDER BY id
    `;
    const result = await this.pool.query(query);
    return result.rows;
  }

  async close(): Promise<void> {
    await this.pool.end();
    logger.info('Database connection closed');
  }
}

export const databaseService = new DatabaseService();

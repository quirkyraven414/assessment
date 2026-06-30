import { Client } from '@opensearch-project/opensearch';
import { config } from '../config';
import { logger } from '../utils/logger';
import { Alert } from '../models/types';

class OpenSearchService {
  private client: Client;

  constructor() {
    this.client = new Client({
      node: config.opensearch.node,
      auth: {
        username: config.opensearch.username,
        password: config.opensearch.password,
      },
      ssl: {
        rejectUnauthorized: false,
      },
    });
  }

  async connect(): Promise<void> {
    try {
      const health = await this.client.cluster.health();
      logger.info('OpenSearch connected successfully', { status: health.body.status });
    } catch (error) {
      logger.error('OpenSearch connection failed', { error });
      throw error;
    }
  }

  async createIndexIfNotExists(): Promise<void> {
    const indexName = config.opensearch.index;
    try {
      const exists = await this.client.indices.exists({ index: indexName });
      if (!exists.body) {
        await this.client.indices.create({
          index: indexName,
          body: {
            mappings: {
              properties: {
                alert_id: { type: 'keyword' },
                device_id: { type: 'keyword' },
                alert_type: { type: 'keyword' },
                severity: { type: 'keyword' },
                message: { type: 'text' },
                triggered_at: { type: 'date' },
                context: { type: 'object', enabled: true },
              },
            },
          },
        });
        logger.info('OpenSearch index created', { index: indexName });
      }
    } catch (error) {
      logger.error('Failed to create OpenSearch index', { error, index: indexName });
      throw error;
    }
  }

  async indexAlert(alert: Omit<Alert, 'id' | 'acknowledged' | 'acknowledged_at' | 'acknowledged_by'>): Promise<void> {
    try {
      await this.client.index({
        index: config.opensearch.index,
        id: alert.alert_id,
        body: {
          alert_id: alert.alert_id,
          device_id: alert.device_id,
          alert_type: alert.alert_type,
          severity: alert.severity,
          message: alert.message,
          triggered_at: alert.triggered_at,
          context: alert.context,
        },
        refresh: true,
      });
      logger.debug('Alert indexed in OpenSearch', { alert_id: alert.alert_id });
    } catch (error) {
      logger.error('Failed to index alert in OpenSearch', { error, alert_id: alert.alert_id });
    }
  }

  async searchAlerts(deviceId?: string, severity?: string, from?: Date, to?: Date): Promise<any[]> {
    const must: any[] = [];

    if (deviceId) {
      must.push({ term: { device_id: deviceId } });
    }

    if (severity) {
      must.push({ term: { severity } });
    }

    if (from || to) {
      const range: any = {};
      if (from) range.gte = from.toISOString();
      if (to) range.lte = to.toISOString();
      must.push({ range: { triggered_at: range } });
    }

    try {
      const result = await this.client.search({
        index: config.opensearch.index,
        body: {
          query: must.length > 0 ? { bool: { must } } : { match_all: {} },
          sort: [{ triggered_at: { order: 'desc' } }],
          size: 100,
        },
      });

      return result.body.hits.hits.map((hit: any) => hit._source);
    } catch (error) {
      logger.error('Failed to search alerts in OpenSearch', { error });
      return [];
    }
  }

  async close(): Promise<void> {
    await this.client.close();
    logger.info('OpenSearch connection closed');
  }
}

export const openSearchService = new OpenSearchService();

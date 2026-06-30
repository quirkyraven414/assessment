import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest } from '../middlewares/auth.middleware';
import { redisService } from '../../services/redis.service';
import { kafkaService } from '../../services/kafka.service';
import { databaseService } from '../../services/database.service';
import { logger } from '../../utils/logger';
import { KafkaMessage } from '../../models/types';

export async function postTelemetry(req: AuthRequest, res: Response): Promise<void> {
  try {
    const deviceId = req.device!.device_id;

    const idempotent = await redisService.checkIdempotency(deviceId);
    if (idempotent) {
      const cachedResponse = await redisService.getIdempotencyResponse(deviceId);
      logger.debug('Idempotent request detected', { device_id: deviceId });
      res.status(202).json(cachedResponse);
      return;
    }

    const messageId = uuidv4();
    const ingestedAt = new Date();

    const kafkaMessage: KafkaMessage = {
      message_id: messageId,
      device_id: deviceId,
      temperature: req.body.temperature,
      energy_kwh: req.body.energy_kwh,
      voltage: req.body.voltage,
      current: req.body.current,
      status: req.body.status,
      timestamp: new Date(req.body.timestamp),
      ingested_at: ingestedAt,
    };

    await kafkaService.produce(kafkaMessage);

    await databaseService.updateDeviceLastSeen(deviceId);

    const response = {
      message: 'Telemetry accepted',
      message_id: messageId,
      device_id: deviceId,
      ingested_at: ingestedAt.toISOString(),
    };

    await redisService.setIdempotency(deviceId, response);

    logger.info('Telemetry accepted', { device_id: deviceId, message_id: messageId });

    res.status(202).json(response);
  } catch (error) {
    logger.error('Failed to process telemetry', { error, device_id: req.device?.device_id });
    res.status(500).json({ error: 'Failed to process telemetry' });
  }
}

export async function getLatestTelemetry(req: AuthRequest, res: Response): Promise<void> {
  try {
    const deviceId = req.params.deviceId as string;

    const telemetry = await databaseService.getLatestTelemetry(deviceId);

    if (!telemetry) {
      res.status(404).json({ error: 'No telemetry found for device' });
      return;
    }

    res.status(200).json(telemetry);
  } catch (error) {
    logger.error('Failed to get latest telemetry', { error, device_id: req.params.deviceId });
    res.status(500).json({ error: 'Failed to get latest telemetry' });
  }
}

export async function getAlerts(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { deviceId } = req.query;
    const limit = parseInt(req.query.limit as string) || 100;

    const alerts = await databaseService.getAlerts(limit, deviceId as string | undefined);

    res.status(200).json({ alerts, count: alerts.length });
  } catch (error) {
    logger.error('Failed to get alerts', { error });
    res.status(500).json({ error: 'Failed to get alerts' });
  }
}

export async function healthCheck(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const checks = {
      database: 'up',
      redis: 'up',
      kafka: 'up',
    };

    try {
      await databaseService.getDeviceById('health-check');
    } catch {
      checks.database = 'down';
    }

    try {
      await redisService.checkIdempotency('health-check');
    } catch {
      checks.redis = 'down';
    }

    const allUp = Object.values(checks).every((status) => status === 'up');
    const statusCode = allUp ? 200 : 503;

    res.status(statusCode).json({
      status: allUp ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    });
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
}

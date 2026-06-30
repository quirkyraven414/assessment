import { logger } from '../utils/logger';
import { databaseService } from '../services/database.service';
import { redisService } from '../services/redis.service';
import { kafkaService } from '../services/kafka.service';
import { openSearchService } from '../services/opensearch.service';
import { alertService } from '../services/alert.service';
import { KafkaMessage, TelemetryRecord } from '../models/types';

async function processMessage(message: KafkaMessage): Promise<void> {
  const telemetryRecord: TelemetryRecord = {
    id: message.message_id,
    message_id: message.message_id,
    device_id: message.device_id,
    temperature: message.temperature,
    energy_kwh: message.energy_kwh,
    voltage: message.voltage,
    current: message.current,
    status: message.status,
    timestamp: message.timestamp,
    ingested_at: message.ingested_at,
  };

  await databaseService.insertTelemetryBatch([telemetryRecord]);

  await alertService.evaluateAlerts({
    device_id: message.device_id,
    temperature: message.temperature,
    energy_kwh: message.energy_kwh,
    voltage: message.voltage,
    current: message.current,
    status: message.status,
    timestamp: message.timestamp,
  });

  const telemetryData = {
    device_id: message.device_id,
    temperature: message.temperature,
    voltage: message.voltage,
    current: message.current,
    energy_kwh: message.energy_kwh,
    status: message.status,
    timestamp: message.timestamp,
  };
  
  await redisService.publish(`telemetry:device:${message.device_id}`, telemetryData);
  

  logger.debug('Message processed', { device_id: message.device_id, message_id: message.message_id });
}

async function startConsumer(): Promise<void> {
  try {
    await databaseService.connect();
    await redisService.connect();
    await kafkaService.connectConsumer();
    await openSearchService.connect();
    await openSearchService.createIndexIfNotExists();
    
    await alertService.loadRulesFromDatabase();

    logger.info('Consumer started, waiting for messages...');

    await kafkaService.consume(processMessage);
  } catch (error) {
    logger.error('Failed to start consumer', { error });
    process.exit(1);
  }
}

async function shutdown(): Promise<void> {
  logger.info('Shutting down consumer...');
  try {
    await kafkaService.disconnectConsumer();
    await redisService.close();
    await databaseService.close();
    await openSearchService.close();
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startConsumer();

setInterval(async () => {
  try {
    const offlineCount = await databaseService.markOfflineDevices();
    if (offlineCount > 0) {
      logger.info('Marked devices as offline', { count: offlineCount });
      const offlineDevices = await databaseService.getOfflineDevices();
      for (const device of offlineDevices) {
        await alertService.createOfflineAlert(device.device_id);
      }
    }
  } catch (error) {
    logger.error('Failed to check offline devices', { error });
  }
}, 60000);

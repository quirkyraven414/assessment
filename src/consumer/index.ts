import { logger } from '../utils/logger';
import { databaseService } from '../services/database.service';
import { redisService } from '../services/redis.service';
import { kafkaService } from '../services/kafka.service';
import { openSearchService } from '../services/opensearch.service';
import { alertService } from '../services/alert.service';
import { KafkaMessage, TelemetryRecord } from '../models/types';

// Batch configuration
const BATCH_SIZE = 100;
const BATCH_TIMEOUT_MS = 5000;
const MAX_RETRIES = 3;

// Batch buffer
const batchBuffer: TelemetryRecord[] = [];
let lastFlushTime = Date.now();
let batchMetrics = {
  totalBatches: 0,
  totalRecords: 0,
  retryCount: 0,
  failureCount: 0
};

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function flushBatch(): Promise<void> {
  if (batchBuffer.length === 0) return;
  
  const batchToInsert = [...batchBuffer];
  batchBuffer.length = 0;
  lastFlushTime = Date.now();
  
  logger.info('Flushing batch', { size: batchToInsert.length });
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await databaseService.insertTelemetryBatch(batchToInsert);
      batchMetrics.totalBatches++;
      batchMetrics.totalRecords += batchToInsert.length;
      logger.info('Batch inserted successfully', { 
        size: batchToInsert.length, 
        attempt,
        totalBatches: batchMetrics.totalBatches 
      });
      return;
    } catch (error) {
      lastError = error as Error;
      batchMetrics.retryCount++;
      logger.warn('Batch insert failed, retrying', { 
        size: batchToInsert.length, 
        attempt, 
        maxRetries: MAX_RETRIES,
        error: (error as Error).message 
      });
      
      if (attempt < MAX_RETRIES) {
        const delayMs = Math.pow(2, attempt) * 100;
        await delay(delayMs);
      }
    }
  }
  
  // All retries failed - save to invalid messages
  batchMetrics.failureCount++;
  logger.error('Batch insert failed after all retries, saving to invalid messages', {
    size: batchToInsert.length,
    error: lastError?.message
  });
  
  for (const record of batchToInsert) {
    try {
      await databaseService.insertInvalidMessage({
        message_id: record.message_id,
        device_id: record.device_id,
        timestamp: record.timestamp,
        telemetry_message: record,
        reason_for_failure: lastError?.message || 'Batch insert failed',
        rejected_at: new Date(),
      });
    } catch (e) {
      logger.error('Failed to save invalid message', { error: e });
    }
  }
}

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

  // Add to batch buffer
  batchBuffer.push(telemetryRecord);

  // Evaluate alerts immediately (real-time requirement)
  await alertService.evaluateAlerts({
    device_id: message.device_id,
    temperature: message.temperature,
    energy_kwh: message.energy_kwh,
    voltage: message.voltage,
    current: message.current,
    status: message.status,
    timestamp: message.timestamp,
  });

  // Publish to Redis immediately (real-time requirement)
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

  // Flush batch if size limit reached
  if (batchBuffer.length >= BATCH_SIZE) {
    await flushBatch();
  }

  logger.debug('Message added to batch', { 
    device_id: message.device_id, 
    message_id: message.message_id,
    batchSize: batchBuffer.length 
  });
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

    // Start timeout-based flush interval
    setInterval(async () => {
      const timeSinceLastFlush = Date.now() - lastFlushTime;
      if (batchBuffer.length > 0 && timeSinceLastFlush >= BATCH_TIMEOUT_MS) {
        logger.info('Timeout-based flush triggered', { 
          batchSize: batchBuffer.length,
          timeSinceLastFlush 
        });
        await flushBatch();
      }
    }, BATCH_TIMEOUT_MS);

    await kafkaService.consume(processMessage);
  } catch (error) {
    logger.error('Failed to start consumer', { error });
    process.exit(1);
  }
}

async function shutdown(): Promise<void> {
  logger.info('Shutting down consumer...');
  
  // Flush remaining batch before shutdown
  if (batchBuffer.length > 0) {
    logger.info('Flushing remaining batch before shutdown', { size: batchBuffer.length });
    await flushBatch();
  }
  
  // Log final metrics
  logger.info('Final batch metrics', batchMetrics);
  
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

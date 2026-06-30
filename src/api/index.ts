import express from 'express';
import { config } from '../config';
import { logger } from '../utils/logger';
import { databaseService } from '../services/database.service';
import { redisService } from '../services/redis.service';
import { kafkaService } from '../services/kafka.service';
import { openSearchService } from '../services/opensearch.service';
import routes from './routes';

const app = express();

app.use(express.json());

app.use(routes);

async function startServer(): Promise<void> {
  try {
    await databaseService.connect();
    await redisService.connect();
    await kafkaService.connectProducer();
    await openSearchService.connect();
    await openSearchService.createIndexIfNotExists();

    app.listen(config.server.apiPort, () => {
      logger.info('API server started', { port: config.server.apiPort });
    });
  } catch (error) {
    logger.error('Failed to start API server', { error });
    process.exit(1);
  }
}

async function shutdown(): Promise<void> {
  logger.info('Shutting down API server...');
  try {
    await kafkaService.disconnectProducer();
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

startServer();

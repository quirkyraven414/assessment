import { Kafka, Producer, Consumer } from 'kafkajs';
import { config } from '../config';
import { logger } from '../utils/logger';
import { KafkaMessage } from '../models/types';

class KafkaService {
  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer;

  constructor() {
    this.kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers,
      retry: {
        retries: 5,
        initialRetryTime: 100,
        multiplier: 2,
      },
    });

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: false,
      transactionTimeout: 30000,
      idempotent: false,
      maxInFlightRequests: 5,
      retry: {
        retries: 5,
        initialRetryTime: 100,
        multiplier: 2,
      },
    });

    this.consumer = this.kafka.consumer({
      groupId: config.kafka.groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      maxBytesPerPartition: 1048576,
      retry: {
        retries: 3,
        initialRetryTime: 100,
        multiplier: 2,
      },
    });
  }

  async connectProducer(): Promise<void> {
    try {
      await this.producer.connect();
      logger.info('Kafka producer connected successfully');
    } catch (error) {
      logger.error('Kafka producer connection failed', { error });
      throw error;
    }
  }

  async connectConsumer(): Promise<void> {
    try {
      await this.consumer.connect();
      await this.consumer.subscribe({ topic: config.kafka.topic, fromBeginning: false });
      logger.info('Kafka consumer connected and subscribed', { topic: config.kafka.topic });
    } catch (error) {
      logger.error('Kafka consumer connection failed', { error });
      throw error;
    }
  }

  async produce(message: KafkaMessage): Promise<void> {
    try {
      await this.producer.send({
        topic: config.kafka.topic,
        messages: [
          {
            key: message.device_id,
            value: JSON.stringify(message),
            headers: {
              'message_id': message.message_id,
              'device_id': message.device_id,
            },
          },
        ],
        acks: -1,
        timeout: 30000,
        compression: 1,
      });
    } catch (error) {
      logger.error('Failed to produce message to Kafka', { error, device_id: message.device_id });
      throw error;
    }
  }

  async consume(handler: (message: KafkaMessage) => Promise<void>): Promise<void> {
    await this.consumer.run({
      autoCommit: false,
      eachBatchAutoResolve: false,
      eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary }) => {
        const messages: KafkaMessage[] = [];

        for (const message of batch.messages) {
          if (message.value) {
            try {
              const parsed = JSON.parse(message.value.toString());
              messages.push(parsed);
            } catch (error) {
              logger.error('Failed to parse Kafka message', { error, offset: message.offset });
            }
          }
          resolveOffset(message.offset);
          await heartbeat();
        }

        if (messages.length > 0) {
          try {
            for (const msg of messages) {
              await handler(msg);
            }
            await commitOffsetsIfNecessary();
            logger.info('Processed batch successfully', { count: messages.length, partition: batch.partition });
          } catch (error) {
            logger.error('Failed to process batch', { error, count: messages.length });
            throw error;
          }
        }
      },
    });
  }

  async disconnectProducer(): Promise<void> {
    await this.producer.disconnect();
    logger.info('Kafka producer disconnected');
  }

  async disconnectConsumer(): Promise<void> {
    await this.consumer.disconnect();
    logger.info('Kafka consumer disconnected');
  }
}

export const kafkaService = new KafkaService();

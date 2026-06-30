import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

class RedisService {
  private client: Redis;
  private pubClient: Redis;
  private subClient: Redis;

  constructor() {
    const redisConfig = {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    };

    this.client = new Redis(redisConfig);
    this.pubClient = new Redis(redisConfig);
    this.subClient = new Redis(redisConfig);

    this.client.on('error', (err) => logger.error('Redis Client Error', { error: err.message }));
    this.pubClient.on('error', (err) => logger.error('Redis Pub Error', { error: err.message }));
    this.subClient.on('error', (err) => logger.error('Redis Sub Error', { error: err.message }));
  }

  async connect(): Promise<void> {
    try {
      await this.client.ping();
      logger.info('Redis connected successfully');
    } catch (error) {
      logger.error('Redis connection failed', { error });
      throw error;
    }
  }

  async checkIdempotency(deviceId: string): Promise<boolean> {
    const key = `idempotency:${deviceId}`;
    const exists = await this.client.exists(key);
    return exists === 1;
  }

  async setIdempotency(deviceId: string, response: any): Promise<void> {
    const key = `idempotency:${deviceId}`;
    const ttl = config.application.idempotencyTtlSeconds;
    await this.client.setex(key, ttl, JSON.stringify(response));
  }

  async getIdempotencyResponse(deviceId: string): Promise<any | null> {
    const key = `idempotency:${deviceId}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async publish(channel: string, message: any): Promise<void> {
    await this.pubClient.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    await this.subClient.subscribe(channel);
    this.subClient.on('message', (ch, msg) => {
      if (ch === channel) {
        try {
          const parsed = JSON.parse(msg);
          callback(parsed);
        } catch (error) {
          logger.error('Error parsing Redis message', { error, channel, message: msg });
        }
      }
    });
  }

  async psubscribe(pattern: string, callback: (channel: string, message: any) => void): Promise<void> {
    await this.subClient.psubscribe(pattern);
    this.subClient.on('pmessage', (pat, ch, msg) => {
      if (pat === pattern) {
        try {
          const parsed = JSON.parse(msg);
          callback(ch, parsed);
        } catch (error) {
          logger.error('Error parsing Redis pmessage', { error, pattern, channel: ch, message: msg });
        }
      }
    });
  }

  async close(): Promise<void> {
    await this.client.quit();
    await this.pubClient.quit();
    await this.subClient.quit();
    logger.info('Redis connections closed');
  }
}

export const redisService = new RedisService();

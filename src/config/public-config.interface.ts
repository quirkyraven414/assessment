export interface IPublicConfig {
  server: {
    nodeEnv: string;
    apiPort: number;
    websocketPort: number;
  };
  database: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    poolMin: number;
    poolMax: number;
  };
  redis: {
    host: string;
    port: number;
    password: string;
  };
  kafka: {
    brokers: string[];
    clientId: string;
    groupId: string;
    topic: string;
  };
  opensearch: {
    node: string;
    username: string;
    password: string;
    index: string;
  };
  application: {
    idempotencyTtlSeconds: number;
    lateEventMaxMinutes: number;
    offlineDeviceThresholdMinutes: number;
  };
}

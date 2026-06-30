export const KAFKA_TOPIC = 'telemetry.raw';
export const REDIS_CHANNELS = {
  ALERTS_ALL: 'alerts:all',
  ALERTS_DEVICE: (deviceId: string) => `alerts:device:${deviceId}`,
  ALERTS_TYPE: (alertType: string) => `alerts:type:${alertType}`,
  ALERTS_SEVERITY: (severity: string) => `alerts:severity:${severity}`,
  TELEMETRY_DEVICE: (deviceId: string) => `telemetry:device:${deviceId}`,
};

export const ALERT_SEVERITIES = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;

export const DEVICE_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
} as const;

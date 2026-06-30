export interface Device {
  device_id: string;
  device_name: string;
  device_type: string;
  address: string;
  api_key: string;
  last_seen_at: Date;
  status: 'online' | 'offline';
  created_at: Date;
  updated_at: Date;
}

export interface TelemetryMessage {
  device_id: string;
  temperature: number;
  energy_kwh: number;
  voltage: number;
  current: number;
  status: string;
  timestamp: Date;
}

export interface TelemetryRecord extends TelemetryMessage {
  id: string;
  message_id: string;
  ingested_at: Date;
}

export interface Alert {
  id: string;
  alert_id: string;
  device_id: string;
  alert_type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  triggered_at: Date;
  context: Record<string, any>;
  acknowledged: boolean;
  acknowledged_at?: Date;
  acknowledged_by?: string;
}

export interface InvalidMessage {
  id: string;
  message_id: string;
  device_id: string;
  timestamp: Date;
  telemetry_message: Record<string, any>;
  reason_for_failure: string;
  rejected_at: Date;
}

export interface KafkaMessage {
  message_id: string;
  device_id: string;
  temperature: number;
  energy_kwh: number;
  voltage: number;
  current: number;
  status: string;
  timestamp: Date;
  ingested_at: Date;
}

export type AlertRule = {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  condition: (telemetry: TelemetryMessage, previousTelemetry?: TelemetryMessage) => boolean;
  message: (telemetry: TelemetryMessage) => string;
};

export interface AlertRuleDB {
  id: number;
  rule_type: string;
  severity: string;
  condition_field: string;
  condition_operator: string;
  condition_value: number | null;
  condition_value_min: number | null;
  condition_value_max: number | null;
  message_template: string;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

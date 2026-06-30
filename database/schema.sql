-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Devices table
CREATE TABLE IF NOT EXISTS devices (
    device_id VARCHAR(255) PRIMARY KEY,
    device_name VARCHAR(255) NOT NULL,
    device_type VARCHAR(100) NOT NULL,
    address TEXT,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(50) NOT NULL DEFAULT 'online',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_devices_api_key ON devices(api_key);
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_devices_last_seen ON devices(last_seen_at);

-- Telemetry table (will be converted to hypertable)
CREATE TABLE IF NOT EXISTS telemetry (
    message_id UUID NOT NULL,
    device_id VARCHAR(255) NOT NULL REFERENCES devices(device_id),
    timestamp TIMESTAMPTZ NOT NULL,
    temperature DECIMAL(5,2) NOT NULL,
    energy_kwh DECIMAL(10,3) NOT NULL,
    voltage DECIMAL(6,2) NOT NULL,
    current DECIMAL(6,2) NOT NULL,
    status VARCHAR(50) NOT NULL,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (device_id, timestamp, message_id)
);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('telemetry', 'timestamp', if_not_exists => TRUE);

-- Create indexes
CREATE INDEX idx_telemetry_device_timestamp ON telemetry(device_id, timestamp DESC);
CREATE INDEX idx_telemetry_message_id ON telemetry(message_id);

-- Enable compression (90% storage savings)
ALTER TABLE telemetry SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'device_id'
);

-- Add compression policy (compress data older than 7 days)
SELECT add_compression_policy('telemetry', INTERVAL '7 days', if_not_exists => TRUE);

-- Add retention policy (drop data older than 90 days)
SELECT add_retention_policy('telemetry', INTERVAL '90 days', if_not_exists => TRUE);

-- Alert Rules table
CREATE TABLE IF NOT EXISTS alert_rules (
    id SERIAL PRIMARY KEY,
    rule_type VARCHAR(100) UNIQUE NOT NULL,
    severity VARCHAR(50) NOT NULL,
    condition_field VARCHAR(100) NOT NULL,
    condition_operator VARCHAR(20) NOT NULL,
    condition_value DECIMAL(10,3),
    condition_value_min DECIMAL(10,3),
    condition_value_max DECIMAL(10,3),
    message_template TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alert_rules_enabled ON alert_rules(enabled);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id VARCHAR(255) UNIQUE NOT NULL,
    device_id VARCHAR(255) NOT NULL REFERENCES devices(device_id),
    alert_type VARCHAR(100) NOT NULL,
    severity VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    context JSONB,
    acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by VARCHAR(255)
);

CREATE INDEX idx_alerts_device_id ON alerts(device_id);
CREATE INDEX idx_alerts_triggered_at ON alerts(triggered_at DESC);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_type ON alerts(alert_type);
CREATE INDEX idx_alerts_acknowledged ON alerts(acknowledged);

-- Invalid messages table
CREATE TABLE IF NOT EXISTS invalid_messages (
    id SERIAL PRIMARY KEY,
    message_id UUID NOT NULL,
    device_id VARCHAR(255),
    timestamp TIMESTAMPTZ,
    telemetry_message JSONB NOT NULL,
    reason_for_failure TEXT NOT NULL,
    rejected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invalid_messages_device_id ON invalid_messages(device_id);
CREATE INDEX idx_invalid_messages_rejected_at ON invalid_messages(rejected_at DESC);

-- Insert sample devices for testing
INSERT INTO devices (device_id, device_name, device_type, address, api_key, status)
VALUES 
    ('DEV001', 'Temperature Sensor 1', 'sensor', 'Building A, Floor 1', 'dev001_api_key_12345', 'online'),
    ('DEV002', 'Energy Meter 1', 'meter', 'Building A, Floor 2', 'dev002_api_key_67890', 'online'),
    ('DEV003', 'Voltage Monitor 1', 'monitor', 'Building B, Floor 1', 'dev003_api_key_abcde', 'online')
ON CONFLICT (device_id) DO NOTHING;

-- Insert alert rules
INSERT INTO alert_rules (rule_type, severity, condition_field, condition_operator, condition_value, condition_value_min, condition_value_max, message_template)
VALUES 
    ('TEMPERATURE_HIGH', 'HIGH', 'temperature', 'BETWEEN', NULL, 30, 50, 'Temperature {temperature}°C exceeds threshold (30°C)'),
    ('TEMPERATURE_CRITICAL', 'CRITICAL', 'temperature', 'GREATER_THAN', 50, NULL, NULL, 'CRITICAL: Temperature {temperature}°C exceeds critical threshold (50°C)'),
    ('VOLTAGE_ABNORMAL', 'MEDIUM', 'voltage', 'OUT_OF_RANGE', NULL, 200, 250, 'Voltage abnormal: {voltage}V (normal: 200-250V)'),
    ('CURRENT_HIGH', 'HIGH', 'current', 'GREATER_THAN', 80, NULL, NULL, 'Current exceeds safe limit: {current}A (max: 80A)'),
    ('SUSPICIOUS_READING', 'MEDIUM', 'all_zero', 'EQUALS', 0, NULL, NULL, 'Suspicious reading: All values are zero')
ON CONFLICT (rule_type) DO NOTHING;

-- Create continuous aggregates for analytics (optional)
CREATE MATERIALIZED VIEW IF NOT EXISTS telemetry_hourly
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 hour', timestamp) AS hour,
    device_id,
    AVG(temperature) as avg_temperature,
    MAX(temperature) as max_temperature,
    MIN(temperature) as min_temperature,
    AVG(voltage) as avg_voltage,
    AVG(current) as avg_current,
    SUM(energy_kwh) as total_energy_kwh,
    COUNT(*) as reading_count
FROM telemetry
GROUP BY hour, device_id;

-- Add refresh policy for continuous aggregate
SELECT add_continuous_aggregate_policy('telemetry_hourly',
    start_offset => INTERVAL '3 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);

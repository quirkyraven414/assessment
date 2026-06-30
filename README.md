# IoT Telemetry System

Production-grade IoT telemetry system with Kafka, PostgreSQL + TimescaleDB, Redis, and OpenSearch.

## Architecture

- **API Layer**: Express REST API with authentication, validation, and idempotency
- **Message Queue**: Apache Kafka for reliable message delivery
- **Database**: PostgreSQL with TimescaleDB for time-series data
- **Cache**: Redis for idempotency and Pub/Sub
- **Alerts**: OpenSearch for alert storage and search
- **Consumer**: Kafka consumer for processing telemetry and alerts

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Infrastructure (Docker)

```bash
docker-compose up -d
```

This starts:
- PostgreSQL with TimescaleDB (port 5432)
- Redis (port 6379)
- Kafka + Zookeeper (port 9092)
- OpenSearch (port 9200)

### 3. Configuration

Development configuration is already set up in `config/dev-config.json`.

No changes needed for local development!

### 4. Create Kafka Topic

```bash
docker exec -it iot-kafka kafka-topics --create \
  --bootstrap-server localhost:9092 \
  --topic telemetry.raw \
  --partitions 3 \
  --replication-factor 1
```

### 5. Build TypeScript

```bash
npm run build
```

### 6. Start Services

**Terminal 1 - API Server:**
```bash
npm run dev:api
```

**Terminal 2 - Consumer:**
```bash
npm run dev:consumer
```

## API Endpoints

### POST /telemetry
Send telemetry data from IoT device.

**Headers:**
```
X-API-Key: dev001_api_key_12345
```

**Request:**
```json
{
  "device_id": "DEV001",
  "temperature": 25.5,
  "voltage": 230.0,
  "current": 12.5,
  "energy_kwh": 15.3,
  "status": "normal",
  "timestamp": "2026-06-30T08:00:00Z"
}
```

**Response:**
```json
{
  "message": "Telemetry accepted",
  "message_id": "uuid-here",
  "device_id": "DEV001",
  "ingested_at": "2026-06-30T08:00:01.000Z"
}
```

### GET /devices/:deviceId/latest
Get latest telemetry for a device.

**Headers:**
```
X-API-Key: dev001_api_key_12345
```

**Response:**
```json
{
  "id": "uuid",
  "device_id": "DEV001",
  "temperature": 25.5,
  "voltage": 230.0,
  "current": 12.5,
  "energy_kwh": 15.3,
  "status": "normal",
  "timestamp": "2026-06-30T08:00:00Z",
  "ingested_at": "2026-06-30T08:00:01.000Z"
}
```

### GET /alerts
Get alerts (optionally filter by device).

**Headers:**
```
X-API-Key: dev001_api_key_12345
```

**Query Parameters:**
- `deviceId` (optional): Filter by device
- `limit` (optional): Max results (default: 100)

**Response:**
```json
{
  "alerts": [
    {
      "alert_id": "DEV001_TEMPERATURE_HIGH_1719734100000",
      "device_id": "DEV001",
      "alert_type": "TEMPERATURE_HIGH",
      "severity": "HIGH",
      "message": "Temperature 35.5°C exceeds threshold (30°C)",
      "triggered_at": "2026-06-30T08:15:00Z",
      "context": {
        "temperature": 35.5,
        "voltage": 230.0,
        "current": 12.5
      },
      "acknowledged": false
    }
  ],
  "count": 1
}
```

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-06-30T08:00:00Z",
  "checks": {
    "database": "up",
    "redis": "up",
    "kafka": "up"
  }
}
```

## Testing with cURL

### Send Telemetry

```bash
curl -X POST http://localhost:3000/telemetry \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev001_api_key_12345" \
  -d '{
    "device_id": "DEV001",
    "temperature": 25.5,
    "voltage": 230.0,
    "current": 12.5,
    "energy_kwh": 15.3,
    "status": "normal",
    "timestamp": "2026-06-30T08:00:00Z"
  }'
```

### Get Latest Telemetry

```bash
curl http://localhost:3000/devices/DEV001/latest \
  -H "X-API-Key: dev001_api_key_12345"
```

### Get Alerts

```bash
curl http://localhost:3000/alerts?deviceId=DEV001 \
  -H "X-API-Key: dev001_api_key_12345"
```

## Alert Rules

The system automatically evaluates these alert rules:

1. **TEMPERATURE_HIGH** (HIGH): Temperature > 30°C
2. **TEMPERATURE_CRITICAL** (CRITICAL): Temperature > 50°C
3. **ENERGY_SPIKE** (MEDIUM): Energy consumption increase > 50%
4. **VOLTAGE_ABNORMAL** (MEDIUM): Voltage < 200V or > 250V
5. **CURRENT_HIGH** (HIGH): Current > 80A
6. **SUSPICIOUS_READING** (MEDIUM): All values are zero
7. **RAPID_CHANGE** (MEDIUM): Temperature change > 10°C
8. **DEVICE_OFFLINE** (HIGH): No heartbeat for 5 minutes

## Redis Pub/Sub Channels

Real-time updates are published to:

- `telemetry:device:{device_id}` - Device-specific telemetry
- `alerts:all` - All alerts
- `alerts:device:{device_id}` - Device-specific alerts
- `alerts:type:{alert_type}` - Alert type filtering
- `alerts:severity:{severity}` - Severity filtering

## Database Schema

See `database/schema.sql` for complete schema with:
- TimescaleDB hypertables
- Compression (90% storage savings)
- Retention policies (90 days)
- Continuous aggregates for analytics

## Production Deployment

See `DEPLOYMENT.md` and `CONFIG.md` for complete deployment guide.

### Quick Setup

```bash
# 1. Copy secrets template (prod-config.json is already in repo)
cp config/secrets.json.example config/secrets.json

# 2. Edit with your infrastructure details
nano config/prod-config.json  # Update endpoints (RDS, ElastiCache, MSK, etc.)
nano config/secrets.json       # Add actual passwords

# 3. Build and deploy
npm run build
NODE_ENV=production npm run start:api
NODE_ENV=production npm run start:consumer
```

### Scaling

- **API**: Scale horizontally (2 → 5 → 20 instances)
- **Kafka**: Increase partitions (3 → 12 → 48)
- **Consumer**: Scale to match partitions (1 → 3 → 12 instances)
- **Database**: Add read replicas, enable sharding

### Monitoring

Logs are output as JSON to stdout. Use AWS Firehose to send to OpenSearch for centralized logging.

Example log entry:
```json
{
  "timestamp": "2026-06-30T08:00:00.000Z",
  "level": "INFO",
  "message": "Telemetry accepted",
  "device_id": "DEV001",
  "message_id": "uuid-here"
}
```

## Development

```bash
# Install dependencies
npm install

# Run API in dev mode
npm run dev:api

# Run consumer in dev mode
npm run dev:consumer

# Build for production
npm run build

# Run production
npm run start:api
npm run start:consumer
```

## License

MIT

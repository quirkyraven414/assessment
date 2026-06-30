#!/bin/bash

API_URL="http://localhost:3000"
API_KEY="dev001_api_key_12345"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

echo "=========================================="
echo "IoT Telemetry Test Flow"
echo "=========================================="
echo ""

echo "1. ✅ Valid telemetry request"
curl -s -X POST "$API_URL/telemetry" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d "{
    \"temperature\": 25.5,
    \"energy_kwh\": 150.25,
    \"voltage\": 220.0,
    \"current\": 45.5,
    \"status\": \"active\",
    \"timestamp\": \"$TIMESTAMP\"
  }"
echo -e "\n"

sleep 2

echo "2. ❌ Invalid: Missing temperature"
curl -s -X POST "$API_URL/telemetry" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d "{
    \"energy_kwh\": 150.25,
    \"voltage\": 220.0,
    \"current\": 45.5,
    \"status\": \"active\",
    \"timestamp\": \"$TIMESTAMP\"
  }"
echo -e "\n"

sleep 1

echo "3. ❌ Same invalid request (should NOT log again)"
curl -s -X POST "$API_URL/telemetry" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d "{
    \"energy_kwh\": 150.25,
    \"voltage\": 220.0,
    \"current\": 45.5,
    \"status\": \"active\",
    \"timestamp\": \"$TIMESTAMP\"
  }"
echo -e "\n"

sleep 2

echo "4. ❌ Invalid: Temperature out of range"
curl -s -X POST "$API_URL/telemetry" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d "{
    \"temperature\": 250.0,
    \"energy_kwh\": 150.25,
    \"voltage\": 220.0,
    \"current\": 45.5,
    \"status\": \"active\",
    \"timestamp\": \"$TIMESTAMP\"
  }"
echo -e "\n"

sleep 2

echo "5. 🔥 High temperature (should trigger alert)"
curl -s -X POST "$API_URL/telemetry" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d "{
    \"temperature\": 45.0,
    \"energy_kwh\": 150.25,
    \"voltage\": 220.0,
    \"current\": 45.5,
    \"status\": \"active\",
    \"timestamp\": \"$TIMESTAMP\"
  }"
echo -e "\n"

sleep 2

echo "6. 🚨 Critical temperature (should trigger critical alert)"
curl -s -X POST "$API_URL/telemetry" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d "{
    \"temperature\": 55.0,
    \"energy_kwh\": 150.25,
    \"voltage\": 220.0,
    \"current\": 45.5,
    \"status\": \"active\",
    \"timestamp\": \"$TIMESTAMP\"
  }"
echo -e "\n"

echo "=========================================="
echo "Checking Database Results"
echo "=========================================="
echo ""

echo "Invalid Messages:"
docker exec -it iot-postgres psql -U postgres -d iot_telemetry -c "SELECT id, device_id, reason_for_failure FROM invalid_messages ORDER BY id DESC LIMIT 5;"

echo ""
echo "Valid Telemetry:"
docker exec -it iot-postgres psql -U postgres -d iot_telemetry -c "SELECT device_id, temperature, voltage, timestamp FROM telemetry ORDER BY timestamp DESC LIMIT 5;"

echo ""
echo "Alerts:"
docker exec -it iot-postgres psql -U postgres -d iot_telemetry -c "SELECT device_id, alert_type, severity FROM alerts ORDER BY triggered_at DESC LIMIT 5;"

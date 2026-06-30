#!/bin/bash

API_URL="http://localhost:3000"
API_KEY="dev001_api_key_12345"

echo "=========================================="
echo "IoT Telemetry API Test Cases"
echo "=========================================="
echo ""

# Test 1: Valid telemetry
echo "✅ Test 1: Valid telemetry data"
curl -X POST "$API_URL/telemetry" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "temperature": 25.5,
    "energy_kwh": 150.25,
    "voltage": 220.0,
    "current": 45.5,
    "status": "active",
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'"
  }'
echo -e "\n"

# Test 2: Missing required field (temperature)
echo "❌ Test 2: Missing temperature field"
curl -X POST "$API_URL/telemetry" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "energy_kwh": 150.25,
    "voltage": 220.0,
    "current": 45.5,
    "status": "active",
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'"
  }'
echo -e "\n"

# Test 3: Invalid temperature (negative)
echo "❌ Test 3: Invalid temperature (negative)"
curl -X POST "$API_URL/telemetry" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "temperature": -150.0,
    "energy_kwh": 150.25,
    "voltage": 220.0,
    "current": 45.5,
    "status": "active",
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'"
  }'
echo -e "\n"

# Test 4: Invalid voltage (out of range)
echo "❌ Test 4: Invalid voltage (too high)"
curl -X POST "$API_URL/telemetry" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "temperature": 25.5,
    "energy_kwh": 150.25,
    "voltage": 500.0,
    "current": 45.5,
    "status": "active",
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'"
  }'
echo -e "\n"

# Test 5: Future timestamp
echo "❌ Test 5: Future timestamp"
curl -X POST "$API_URL/telemetry" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "temperature": 25.5,
    "energy_kwh": 150.25,
    "voltage": 220.0,
    "current": 45.5,
    "status": "active",
    "timestamp": "2030-12-31T23:59:59.000Z"
  }'
echo -e "\n"

# Test 6: Late event (old timestamp)
echo "❌ Test 6: Late event (>5 minutes old)"
curl -X POST "$API_URL/telemetry" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "temperature": 25.5,
    "energy_kwh": 150.25,
    "voltage": 220.0,
    "current": 45.5,
    "status": "active",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }'
echo -e "\n"

# Test 7: Invalid API key
echo "❌ Test 7: Invalid API key"
curl -X POST "$API_URL/telemetry" \
  -H "Content-Type: application/json" \
  -H "x-api-key: invalid_key_123" \
  -d '{
    "temperature": 25.5,
    "energy_kwh": 150.25,
    "voltage": 220.0,
    "current": 45.5,
    "status": "active",
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'"
  }'
echo -e "\n"

# Test 8: Missing API key
echo "❌ Test 8: Missing API key"
curl -X POST "$API_URL/telemetry" \
  -H "Content-Type: application/json" \
  -d '{
    "temperature": 25.5,
    "energy_kwh": 150.25,
    "voltage": 220.0,
    "current": 45.5,
    "status": "active",
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'"
  }'
echo -e "\n"

# Test 9: High temperature (should trigger alert)
echo "🔥 Test 9: High temperature (should trigger alert)"
curl -X POST "$API_URL/telemetry" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "temperature": 45.0,
    "energy_kwh": 150.25,
    "voltage": 220.0,
    "current": 45.5,
    "status": "active",
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'"
  }'
echo -e "\n"

# Test 10: Critical temperature (should trigger critical alert)
echo "🚨 Test 10: Critical temperature (should trigger critical alert)"
curl -X POST "$API_URL/telemetry" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "temperature": 55.0,
    "energy_kwh": 150.25,
    "voltage": 220.0,
    "current": 45.5,
    "status": "active",
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'"
  }'
echo -e "\n"

# Test 11: Health check
echo "✅ Test 11: Health check"
curl -X GET "$API_URL/health"
echo -e "\n"

echo "=========================================="
echo "Tests completed!"
echo "=========================================="

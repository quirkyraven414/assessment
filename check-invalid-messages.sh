#!/bin/bash

echo "=========================================="
echo "Invalid Messages in Database"
echo "=========================================="
echo ""

docker exec -it iot-postgres psql -U postgres -d iot_telemetry -c "
SELECT 
    device_id,
    reason_for_failure,
    telemetry_message,
    rejected_at
FROM invalid_messages 
ORDER BY rejected_at DESC 
LIMIT 20;
"

echo ""
echo "=========================================="
echo "Count by Failure Reason"
echo "=========================================="
echo ""

docker exec -it iot-postgres psql -U postgres -d iot_telemetry -c "
SELECT 
    reason_for_failure,
    COUNT(*) as count
FROM invalid_messages 
GROUP BY reason_for_failure
ORDER BY count DESC;
"

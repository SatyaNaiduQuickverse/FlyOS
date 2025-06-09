#!/bin/bash
# test-command-system.sh - Test bidirectional command system

echo "🧪 TESTING BIDIRECTIONAL COMMAND SYSTEM"
echo "======================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get auth token with working credentials
echo "1. Getting auth token..."
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"main@flyos.mil","password":"FlyOS2025!"}' | \
  grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Failed to get auth token${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Auth token: ${TOKEN:0:20}...${NC}"

# Check services first
echo -e "\n${BLUE}Pre-test: Check service health${NC}"
echo "================================="

echo "Checking drone-db-service..."
curl -s "http://localhost:4001/health" || echo "❌ drone-db-service DOWN"

echo "Checking Redis..."
docker exec flyos-redis-1 redis-cli ping || echo "❌ Redis DOWN"

echo "Checking drone-connection-service..."
curl -s "http://localhost:4005/health" || echo "❌ drone-connection-service DOWN"

# Test 1: Send ARM command
echo -e "\n${BLUE}Test 1: Send ARM command to drone-001${NC}"
echo "======================================"

ARM_RESPONSE=$(curl -s -X POST "http://localhost:3001/api/drones/drone-001/command" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "commandType": "arm",
    "parameters": {}
  }')

echo "ARM command response:"
echo "$ARM_RESPONSE" | jq '.' 2>/dev/null || echo "$ARM_RESPONSE"

if echo "$ARM_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ ARM command sent successfully${NC}"
else
  echo -e "${RED}❌ ARM command failed${NC}"
fi

# Test 2: Send manual control command (fast path)
echo -e "\n${BLUE}Test 2: Send manual control (throttle) to drone-002${NC}"
echo "=================================================="

THROTTLE_RESPONSE=$(curl -s -X POST "http://localhost:3001/api/drones/drone-002/command" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "commandType": "throttle",
    "parameters": {"value": 1600}
  }')

echo "Throttle command response:"
echo "$THROTTLE_RESPONSE" | jq '.' 2>/dev/null || echo "$THROTTLE_RESPONSE"

# Test 3: Send flight mode change
echo -e "\n${BLUE}Test 3: Send flight mode change to drone-003${NC}"
echo "=============================================="

MODE_RESPONSE=$(curl -s -X POST "http://localhost:3001/api/drones/drone-003/command" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "commandType": "loiter",
    "parameters": {}
  }')

echo "Flight mode command response:"
echo "$MODE_RESPONSE" | jq '.' 2>/dev/null || echo "$MODE_RESPONSE"

# Test 4: Monitor Redis command channels
echo -e "\n${BLUE}Test 4: Monitor Redis command channels${NC}"
echo "======================================="

echo "Checking if commands appear in Redis..."
timeout 3s docker exec flyos-redis-1 redis-cli MONITOR | grep "drone:.*:commands" &
MONITOR_PID=$!

# Send a test command while monitoring
sleep 1
curl -s -X POST "http://localhost:3001/api/drones/drone-001/command" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"commandType": "disarm", "parameters": {}}' > /dev/null

sleep 1
kill $MONITOR_PID 2>/dev/null

# Test 5: Check drone connection service logs
echo -e "\n${BLUE}Test 5: Check drone connection service logs${NC}"
echo "==========================================="

echo "Recent command logs from drone-connection-service:"
docker-compose logs drone-connection-service --tail=15 | grep -E "(Command|📨|✅|📤|ERROR|error)" || echo "No command logs found"

# Test 6: Check Redis manually
echo -e "\n${BLUE}Test 6: Manual Redis check${NC}"
echo "============================="

echo "Checking Redis command channels manually..."
docker exec flyos-redis-1 redis-cli KEYS "drone:*:commands" || echo "No command keys found"

# Test 7: Verify telemetry still works
echo -e "\n${BLUE}Test 7: Verify telemetry still works${NC}"
echo "==================================="

echo "Testing telemetry for drone-001 (should show armed status):"
TELEMETRY=$(curl -s "http://localhost:3001/api/drone-telemetry/drone-001" | jq '.armed, .flight_mode' 2>/dev/null)
echo "Armed status: $TELEMETRY"

# Summary
echo -e "\n${BLUE}📊 DIAGNOSIS${NC}"
echo "============"

echo "If commands fail with 'Redis and database unavailable':"
echo "1. Check drone-db-service logs: docker-compose logs drone-db-service"
echo "2. Check Redis connection: docker exec flyos-redis-1 redis-cli ping"
echo "3. Restart services: docker-compose restart drone-db-service"
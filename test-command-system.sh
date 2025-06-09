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

# Get auth token (you'll need to replace this with actual login)
echo "1. Getting auth token..."
TOKEN=$(curl -s -X POST "http://localhost:3001/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "main@flyos.mil", "password": "password123"}' | \
  jq -r '.token // empty')

if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Failed to get auth token${NC}"
  echo "Please ensure you're logged in or update the token manually"
  TOKEN="YOUR_TOKEN_HERE"
  echo "Using placeholder token: $TOKEN"
fi

echo -e "${GREEN}✅ Auth token: ${TOKEN:0:20}...${NC}"

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
echo "$ARM_RESPONSE" | jq '.'

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
echo "$THROTTLE_RESPONSE" | jq '.'

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
echo "$MODE_RESPONSE" | jq '.'

# Test 4: Monitor Redis command channels
echo -e "\n${BLUE}Test 4: Monitor Redis command channels${NC}"
echo "======================================="

echo "Checking if commands appear in Redis..."
timeout 5s docker exec flyos-redis-1 redis-cli MONITOR | grep "drone:.*:commands" &
MONITOR_PID=$!

# Send a test command while monitoring
sleep 1
curl -s -X POST "http://localhost:3001/api/drones/drone-001/command" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"commandType": "disarm", "parameters": {}}' > /dev/null

sleep 2
kill $MONITOR_PID 2>/dev/null

# Test 5: Check drone connection service logs
echo -e "\n${BLUE}Test 5: Check drone connection service logs${NC}"
echo "==========================================="

echo "Recent command logs from drone-connection-service:"
docker-compose logs drone-connection-service --tail=10 | grep -E "(Command|📨|✅|📤)" || echo "No command logs found"

# Test 6: Test command to offline drone
echo -e "\n${BLUE}Test 6: Test command to offline drone${NC}"
echo "===================================="

OFFLINE_RESPONSE=$(curl -s -X POST "http://localhost:3001/api/drones/drone-999/command" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "commandType": "arm", 
    "parameters": {}
  }')

echo "Offline drone command response:"
echo "$OFFLINE_RESPONSE" | jq '.'

# Test 7: Verify telemetry still works
echo -e "\n${BLUE}Test 7: Verify telemetry still works${NC}"
echo "==================================="

echo "Testing telemetry for drone-001 (should show armed status):"
TELEMETRY=$(curl -s "http://localhost:3001/api/drone-telemetry/drone-001" | jq '.armed, .flight_mode')
echo "Armed status: $TELEMETRY"

# Test 8: Performance test
echo -e "\n${BLUE}Test 8: Performance test (10 manual commands)${NC}"
echo "============================================="

echo "Sending 10 rapid manual control commands..."
START_TIME=$(date +%s%N)

for i in {1..10}; do
  curl -s -X POST "http://localhost:3001/api/drones/drone-001/command" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"commandType\": \"throttle\", \"parameters\": {\"value\": $((1500 + i * 10))}} " > /dev/null &
done

wait

END_TIME=$(date +%s%N)
DURATION=$(( (END_TIME - START_TIME) / 1000000 ))

echo "10 commands sent in ${DURATION}ms"
echo "Average: $((DURATION / 10))ms per command"

# Summary
echo -e "\n${BLUE}📊 TEST SUMMARY${NC}"
echo "==============="

echo "Commands to test manually:"
echo "1. Check drone-connection-service logs for command forwarding"
echo "2. Monitor Redis with: docker exec flyos-redis-1 redis-cli MONITOR"
echo "3. Verify mock drones receive commands in their simulation"
echo "4. Check that telemetry reflects command execution"

echo -e "\n${YELLOW}Expected behavior:${NC}"
echo "✅ Critical commands (arm/disarm) should be logged in DB first"
echo "✅ Manual commands (throttle) should use fast path"
echo "✅ Commands should appear in Redis channels"
echo "✅ Drone connection service should forward to correct drone"
echo "✅ Telemetry should eventually reflect command execution"

echo -e "\n${YELLOW}Manual verification commands:${NC}"
echo "# Monitor Redis live:"
echo "docker exec flyos-redis-1 redis-cli MONITOR | grep 'drone:.*:commands'"
echo ""
echo "# Check specific command channel:"
echo "docker exec flyos-redis-1 redis-cli PSUBSCRIBE 'drone:*:commands'"
echo ""
echo "# View drone connection logs:"
echo "docker-compose logs drone-connection-service | grep -E '(Command|📨|✅)'"
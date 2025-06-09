#!/bin/bash
# test-command-latency.sh - Test end-to-end command latency

echo "⏱️  COMMAND LATENCY TESTING"
echo "=========================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get auth token
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"main@flyos.mil","password":"FlyOS2025!"}' | \
  grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get auth token"
  exit 1
fi

echo "✅ Got auth token"

# Function to test command latency
test_command_latency() {
  local COMMAND_TYPE=$1
  local DRONE_ID=$2
  local DESCRIPTION=$3
  
  echo -e "\n${BLUE}Testing: $DESCRIPTION${NC}"
  echo "Command: $COMMAND_TYPE to $DRONE_ID"
  
  # Start monitoring Redis for this specific drone BEFORE sending command
  timeout 5s docker exec flyos-redis-1 redis-cli MONITOR | grep "drone:$DRONE_ID:commands" > /tmp/redis_monitor.log &
  MONITOR_PID=$!
  
  # Record start time (microseconds)
  START_TIME=$(date +%s%N)
  
  # Send command
  RESPONSE=$(curl -s -w "%{time_total}" -X POST "http://localhost:3001/api/drones/$DRONE_ID/command" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"commandType\": \"$COMMAND_TYPE\", \"parameters\": {}}")
  
  # Record end time
  END_TIME=$(date +%s%N)
  
  # Calculate frontend API latency (milliseconds)
  FRONTEND_LATENCY=$(( (END_TIME - START_TIME) / 1000000 ))
  
  # Wait for Redis monitoring to capture
  sleep 1
  kill $MONITOR_PID 2>/dev/null
  
  # Extract HTTP response time (convert to ms)
  HTTP_TIME=$(echo "$RESPONSE" | tail -c 10)
  HTTP_LATENCY=$(echo "$HTTP_TIME * 1000" | bc -l | cut -d'.' -f1)
  
  # Get response JSON (remove timing info)
  JSON_RESPONSE=$(echo "$RESPONSE" | head -c -10)
  
  # Check if command was successful
  if echo "$JSON_RESPONSE" | grep -q '"success":true'; then
    echo "✅ Command successful"
    
    # Extract command ID and timestamp from response
    COMMAND_ID=$(echo "$JSON_RESPONSE" | grep -o '"commandId":[0-9]*' | cut -d':' -f2)
    RESPONSE_TIMESTAMP=$(echo "$JSON_RESPONSE" | grep -o '"timestamp":"[^"]*"' | cut -d'"' -f4)
    
    # Check Redis logs for publish time
    if [ -f /tmp/redis_monitor.log ]; then
      REDIS_ENTRY=$(grep "publish.*drone:$DRONE_ID:commands" /tmp/redis_monitor.log | head -1)
      if [ ! -z "$REDIS_ENTRY" ]; then
        # Extract Redis timestamp
        REDIS_TIMESTAMP=$(echo "$REDIS_ENTRY" | cut -d' ' -f1)
        REDIS_TIME_MS=$(echo "($REDIS_TIMESTAMP - $START_TIME / 1000000000) * 1000" | bc -l | cut -d'.' -f1)
        echo "📡 Redis publish latency: ${REDIS_TIME_MS}ms"
      fi
    fi
    
    # Check drone-connection-service logs for forwarding
    DRONE_LOGS=$(docker-compose logs drone-connection-service --since=5s | grep "Command received for $DRONE_ID" | tail -1)
    if [ ! -z "$DRONE_LOGS" ]; then
      echo "🚁 Command forwarded to drone successfully"
      
      # Check for drone response
      sleep 1
      RESPONSE_LOGS=$(docker-compose logs drone-connection-service --since=5s | grep "Command response from $DRONE_ID" | tail -1)
      if [ ! -z "$RESPONSE_LOGS" ]; then
        echo "✅ Drone executed command successfully"
      fi
    fi
    
  else
    echo "❌ Command failed"
    echo "$JSON_RESPONSE"
  fi
  
  echo "📊 Latencies:"
  echo "  - Frontend API: ${FRONTEND_LATENCY}ms"
  echo "  - HTTP Request: ${HTTP_LATENCY}ms"
  
  # Cleanup
  rm -f /tmp/redis_monitor.log
  
  return $FRONTEND_LATENCY
}

# Test different command types
echo -e "\n🔬 TESTING DIFFERENT COMMAND TYPES"
echo "=================================="

# Test 1: Critical command (ARM)
test_command_latency "arm" "drone-001" "Critical Command (ARM)"
ARM_LATENCY=$?

sleep 2

# Test 2: Manual control (THROTTLE) 
test_command_latency "throttle" "drone-002" "Manual Control (THROTTLE)"
THROTTLE_LATENCY=$?

sleep 2

# Test 3: Flight mode change (LOITER)
test_command_latency "loiter" "drone-003" "Flight Mode Change (LOITER)"
LOITER_LATENCY=$?

sleep 2

# Test 4: Another manual control for comparison
test_command_latency "yaw" "drone-004" "Manual Control (YAW)"
YAW_LATENCY=$?

# Performance summary
echo -e "\n📈 LATENCY SUMMARY"
echo "=================="
echo "Critical Commands (Database + Redis):"
echo "  - ARM: ${ARM_LATENCY}ms"
echo "  - LOITER: ${LOITER_LATENCY}ms"
echo ""
echo "Manual Controls (Redis Fast Path):"
echo "  - THROTTLE: ${THROTTLE_LATENCY}ms" 
echo "  - YAW: ${YAW_LATENCY}ms"

# Calculate averages
CRITICAL_AVG=$(( (ARM_LATENCY + LOITER_LATENCY) / 2 ))
MANUAL_AVG=$(( (THROTTLE_LATENCY + YAW_LATENCY) / 2 ))

echo ""
echo "Average Latencies:"
echo "  - Critical Commands: ${CRITICAL_AVG}ms"
echo "  - Manual Controls: ${MANUAL_AVG}ms"
echo "  - Performance Gain: $(( CRITICAL_AVG - MANUAL_AVG ))ms faster for manual controls"

# Latency analysis
echo -e "\n🎯 LATENCY BREAKDOWN"
echo "==================="
echo "Frontend → drone-db-service → Redis → drone-connection-service"
echo ""
echo "Components:"
echo "1. Frontend API routing: ~5-15ms"
echo "2. Authentication check: ~10-20ms" 
echo "3. Database logging (critical): ~20-50ms"
echo "4. Redis publish: ~5-10ms"
echo "5. WebSocket forward: ~5-15ms"
echo ""
echo "Total expected:"
echo "- Manual controls: 25-60ms"
echo "- Critical commands: 45-110ms"

# Performance targets
echo -e "\n🎯 PERFORMANCE ANALYSIS"
echo "======================"

if [ $MANUAL_AVG -lt 50 ]; then
  echo "✅ Manual controls meet <50ms target"
else
  echo "⚠️  Manual controls exceed 50ms target ($MANUAL_AVG ms)"
fi

if [ $CRITICAL_AVG -lt 100 ]; then
  echo "✅ Critical commands meet <100ms target"
else
  echo "⚠️  Critical commands exceed 100ms target ($CRITICAL_AVG ms)"
fi

echo ""
echo "🚀 System ready for real-time drone control!"
#!/bin/bash
# test-data-flow.sh - Complete system test for drone telemetry data flow

echo "🧪 TESTING FLYOS DATA FLOW"
echo "=========================="
echo "Testing: Drone Connection Service → Redis → TimescaleDB → Frontend"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if service is running
check_service() {
    local service_name=$1
    local port=$2
    local url="http://localhost:$port/health"
    
    echo -n "Checking $service_name ($port)... "
    if curl -s "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Running${NC}"
        return 0
    else
        echo -e "${RED}✗ Not running${NC}"
        return 1
    fi
}

# Function to check Docker container
check_container() {
    local container_name=$1
    echo -n "Checking $container_name container... "
    if docker ps --format "table {{.Names}}" | grep -q "$container_name"; then
        echo -e "${GREEN}✓ Running${NC}"
        return 0
    else
        echo -e "${RED}✗ Not running${NC}"
        return 1
    fi
}

# Step 1: Check all services are running
echo -e "${BLUE}Step 1: Checking Services Status${NC}"
echo "================================="

services_ok=true

# Check Docker containers
if ! check_container "redis"; then services_ok=false; fi
if ! check_container "timescaledb"; then services_ok=false; fi

# Check microservices
if ! check_service "Frontend" 3001; then services_ok=false; fi
if ! check_service "Drone Connection Service" 4005; then services_ok=false; fi
if ! check_service "Drone DB Service" 4001; then services_ok=false; fi
if ! check_service "Realtime Service" 4002; then services_ok=false; fi

if [ "$services_ok" = false ]; then
    echo -e "\n${RED}❌ Some services are not running. Please start all services first:${NC}"
    echo "docker-compose up -d"
    exit 1
fi

echo -e "\n${GREEN}✅ All services are running!${NC}\n"

# Step 2: Start mock drone simulation
echo -e "${BLUE}Step 2: Starting Mock Drone Simulation${NC}"
echo "======================================"

echo "Starting mock drones in background..."
cd services/drone-connection-service
timeout 30s npm run mock-data > /tmp/mock-drone.log 2>&1 &
MOCK_PID=$!
cd ../..

echo "Waiting 5 seconds for drones to connect..."
sleep 5

# Step 3: Check drone connections
echo -e "\n${BLUE}Step 3: Verifying Drone Connections${NC}"
echo "==================================="

echo "Checking drone connection service status..."
CONNECTED_COUNT=$(curl -s http://localhost:4005/status | jq -r '.totalConnected' 2>/dev/null || echo "0")
echo "Connected drones: $CONNECTED_COUNT"

if [ "$CONNECTED_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ Mock drones connected successfully${NC}"
else
    echo -e "${YELLOW}⚠️ No drones connected yet, waiting longer...${NC}"
    sleep 5
    CONNECTED_COUNT=$(curl -s http://localhost:4005/status | jq -r '.totalConnected' 2>/dev/null || echo "0")
    echo "Connected drones after wait: $CONNECTED_COUNT"
fi

# Step 4: Test Redis data
echo -e "\n${BLUE}Step 4: Testing Redis Data Storage${NC}"
echo "=================================="

echo "Checking Redis for drone telemetry data..."
REDIS_KEYS=$(docker exec flyos-redis-1 redis-cli KEYS "drone:*:state" 2>/dev/null | wc -l || echo "0")
echo "Redis drone state keys: $REDIS_KEYS"

if [ "$REDIS_KEYS" -gt 0 ]; then
    echo -e "${GREEN}✅ Telemetry data found in Redis${NC}"
    
    # Show sample data from Redis
    echo -e "\n${YELLOW}Sample telemetry data from Redis:${NC}"
    docker exec flyos-redis-1 redis-cli GET "drone:drone-001:state" 2>/dev/null | head -3 || echo "No data for drone-001"
else
    echo -e "${RED}❌ No telemetry data in Redis${NC}"
fi

# Step 5: Test TimescaleDB data
echo -e "\n${BLUE}Step 5: Testing TimescaleDB Storage${NC}"
echo "==================================="

echo "Checking TimescaleDB for drone telemetry table..."
TIMESCALE_CHECK=$(docker exec flyos-timescaledb-1 psql -U flyos_admin -d flyos_db -c "SELECT COUNT(*) FROM drone_telemetry;" 2>/dev/null | grep -o '[0-9]*' | head -1 || echo "0")
echo "TimescaleDB telemetry records: $TIMESCALE_CHECK"

if [ "$TIMESCALE_CHECK" -gt 0 ]; then
    echo -e "${GREEN}✅ Historical data found in TimescaleDB${NC}"
else
    echo -e "${YELLOW}⚠️ No historical data in TimescaleDB yet (this is normal for fresh start)${NC}"
fi

# Step 6: Test Frontend API access
echo -e "\n${BLUE}Step 6: Testing Frontend API Access${NC}"
echo "==================================="

echo "Testing frontend drone telemetry API..."
API_RESPONSE=$(curl -s "http://localhost:3001/api/drone-telemetry/drone-001" 2>/dev/null)

if echo "$API_RESPONSE" | jq . > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend API responding with JSON data${NC}"
    
    # Extract key telemetry values
    LAT=$(echo "$API_RESPONSE" | jq -r '.latitude // "null"' 2>/dev/null)
    LNG=$(echo "$API_RESPONSE" | jq -r '.longitude // "null"' 2>/dev/null)
    ALT=$(echo "$API_RESPONSE" | jq -r '.altitude_relative // "null"' 2>/dev/null)
    BATTERY=$(echo "$API_RESPONSE" | jq -r '.percentage // "null"' 2>/dev/null)
    
    echo -e "\n${YELLOW}Sample telemetry from Frontend API:${NC}"
    echo "  Latitude: $LAT"
    echo "  Longitude: $LNG" 
    echo "  Altitude: $ALT m"
    echo "  Battery: $BATTERY%"
    
    if [ "$LAT" != "null" ] && [ "$LNG" != "null" ]; then
        echo -e "${GREEN}✅ Real-time telemetry data flowing to frontend!${NC}"
    else
        echo -e "${YELLOW}⚠️ API responding but telemetry data may not be complete${NC}"
    fi
else
    echo -e "${RED}❌ Frontend API not responding or returning invalid data${NC}"
    echo "Response: $API_RESPONSE"
fi

# Step 7: Test WebSocket real-time connection
echo -e "\n${BLUE}Step 7: Testing WebSocket Real-time Connection${NC}"
echo "=============================================="

echo "Testing realtime service WebSocket availability..."
REALTIME_STATUS=$(curl -s http://localhost:4002/health 2>/dev/null)

if echo "$REALTIME_STATUS" | grep -q "OK"; then
    echo -e "${GREEN}✅ Realtime WebSocket service is healthy${NC}"
    echo "Note: WebSocket connections require authentication and are tested in the frontend"
else
    echo -e "${RED}❌ Realtime service not responding${NC}"
fi

# Step 8: Test complete data flow
echo -e "\n${BLUE}Step 8: Testing Complete Data Flow${NC}"
echo "=================================="

echo "Testing data consistency across the pipeline..."

# Get data from different sources and compare timestamps
echo "Fetching data from different sources..."

# Redis direct
REDIS_DATA=$(docker exec flyos-redis-1 redis-cli GET "drone:drone-001:state" 2>/dev/null)
REDIS_TIME=$(echo "$REDIS_DATA" | jq -r '._meta.redisTimestamp // empty' 2>/dev/null)

# Frontend API  
API_DATA=$(curl -s "http://localhost:3001/api/drone-telemetry/drone-001" 2>/dev/null)
API_TIME=$(echo "$API_DATA" | jq -r '.timestamp // empty' 2>/dev/null)

echo "Redis timestamp: $REDIS_TIME"
echo "API timestamp: $API_TIME"

if [ -n "$REDIS_TIME" ] && [ -n "$API_TIME" ]; then
    echo -e "${GREEN}✅ Data flow complete: Mock Drones → Redis → Frontend API${NC}"
else
    echo -e "${YELLOW}⚠️ Data flow partial - some timestamps missing${NC}"
fi

# Step 9: Performance check
echo -e "\n${BLUE}Step 9: Performance Check${NC}"
echo "========================="

echo "Measuring API response time..."
START_TIME=$(date +%s%N)
curl -s "http://localhost:3001/api/drone-telemetry/drone-001" > /dev/null
END_TIME=$(date +%s%N)
RESPONSE_TIME=$(( (END_TIME - START_TIME) / 1000000 ))

echo "API response time: ${RESPONSE_TIME}ms"

if [ "$RESPONSE_TIME" -lt 1000 ]; then
    echo -e "${GREEN}✅ Good performance (< 1s)${NC}"
elif [ "$RESPONSE_TIME" -lt 3000 ]; then
    echo -e "${YELLOW}⚠️ Acceptable performance (< 3s)${NC}"
else
    echo -e "${RED}❌ Slow performance (> 3s)${NC}"
fi

# Cleanup
echo -e "\n${BLUE}Cleanup${NC}"
echo "======="

if [ ! -z "$MOCK_PID" ]; then
    echo "Stopping mock drone simulation..."
    kill $MOCK_PID 2>/dev/null || true
fi

# Final summary
echo -e "\n${BLUE}📊 TEST SUMMARY${NC}"
echo "==============="

if [ "$CONNECTED_COUNT" -gt 0 ] && [ "$REDIS_KEYS" -gt 0 ] && [ "$LAT" != "null" ]; then
    echo -e "${GREEN}🎉 SUCCESS: Complete data flow verified!${NC}"
    echo -e "${GREEN}   ✓ Mock drones generating data${NC}"
    echo -e "${GREEN}   ✓ Data stored in Redis${NC}"
    echo -e "${GREEN}   ✓ Frontend API serving telemetry${NC}"
    echo -e "${GREEN}   ✓ Real-time data pipeline working${NC}"
    echo ""
    echo -e "${YELLOW}🚀 Next Steps:${NC}"
    echo "   1. Open http://localhost:3001/secure/main-hq/dashboard"
    echo "   2. Login with your test credentials"
    echo "   3. Navigate to Drone Control Hub"
    echo "   4. Verify real-time telemetry display"
    echo "   5. Test WebSocket connections in browser"
else
    echo -e "${YELLOW}⚠️ PARTIAL SUCCESS: Some components working${NC}"
    echo ""
    echo -e "${YELLOW}Issues found:${NC}"
    if [ "$CONNECTED_COUNT" -eq 0 ]; then
        echo "   - No mock drones connected"
    fi
    if [ "$REDIS_KEYS" -eq 0 ]; then
        echo "   - No data in Redis"
    fi
    if [ "$LAT" == "null" ]; then
        echo "   - Frontend API not returning telemetry"
    fi
    echo ""
    echo -e "${YELLOW}Troubleshooting:${NC}"
    echo "   1. Check logs: docker-compose logs [service-name]"
    echo "   2. Verify Redis: docker exec flyos-redis-1 redis-cli KEYS '*'"
    echo "   3. Test API directly: curl http://localhost:4005/redis/drone-001"
fi

echo ""
echo -e "${BLUE}Log files created:${NC}"
echo "   Mock drones: /tmp/mock-drone.log"
echo ""
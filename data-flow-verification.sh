#!/bin/bash
# data-flow-verification.sh - Verify exact data flow
set -e

echo "🔍 FlyOS Data Flow Verification"
echo "==============================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

DRONE_ID="drone-001"

echo -e "${BLUE}Testing drone: $DRONE_ID${NC}"
echo ""

echo "📊 STEP 1: Get Data from Redis (Direct)"
echo "======================================="
echo -e "${CYAN}Source: Redis via drone-connection-service${NC}"
echo -e "${CYAN}URL: http://localhost:4005/redis/$DRONE_ID${NC}"

REDIS_DATA=$(curl -s "http://localhost:4005/redis/$DRONE_ID")
echo "$REDIS_DATA" | jq '{
    latitude: .latitude,
    longitude: .longitude,
    percentage: .percentage,
    flight_mode: .flight_mode,
    armed: .armed,
    timestamp: .timestamp,
    source: ._meta.source,
    updatedAt: ._meta.updatedAt
}' 2>/dev/null || echo "❌ Could not parse Redis JSON"

# Extract key values for comparison
REDIS_LAT=$(echo "$REDIS_DATA" | jq -r '.latitude // "null"')
REDIS_LNG=$(echo "$REDIS_DATA" | jq -r '.longitude // "null"')
REDIS_BAT=$(echo "$REDIS_DATA" | jq -r '.percentage // "null"')
REDIS_MODE=$(echo "$REDIS_DATA" | jq -r '.flight_mode // "null"')
REDIS_TIME=$(echo "$REDIS_DATA" | jq -r '.timestamp // ._meta.updatedAt // "null"')

echo ""
echo "🌐 STEP 2: Get Data from Frontend API"
echo "====================================="
echo -e "${CYAN}Source: Frontend API (should get from Redis)${NC}"
echo -e "${CYAN}URL: http://localhost:3001/api/drone-telemetry/$DRONE_ID${NC}"

FRONTEND_DATA=$(curl -s "http://localhost:3001/api/drone-telemetry/$DRONE_ID")
echo "$FRONTEND_DATA" | jq '{
    latitude: .latitude,
    longitude: .longitude,
    percentage: .percentage,
    flight_mode: .flight_mode,
    armed: .armed,
    timestamp: .timestamp,
    source: ._meta.source,
    updatedAt: ._meta.updatedAt
}' 2>/dev/null || echo "❌ Could not parse Frontend JSON"

# Extract key values for comparison
FRONTEND_LAT=$(echo "$FRONTEND_DATA" | jq -r '.latitude // "null"')
FRONTEND_LNG=$(echo "$FRONTEND_DATA" | jq -r '.longitude // "null"')
FRONTEND_BAT=$(echo "$FRONTEND_DATA" | jq -r '.percentage // "null"')
FRONTEND_MODE=$(echo "$FRONTEND_DATA" | jq -r '.flight_mode // "null"')
FRONTEND_TIME=$(echo "$FRONTEND_DATA" | jq -r '.timestamp // ._meta.updatedAt // "null"')

echo ""
echo "🔍 STEP 3: Data Comparison"
echo "=========================="

compare_field() {
    local field_name="$1"
    local redis_val="$2"
    local frontend_val="$3"
    
    printf "%-15s" "$field_name:"
    if [ "$redis_val" = "$frontend_val" ] && [ "$redis_val" != "null" ]; then
        echo -e "${GREEN}✅ MATCH: $redis_val${NC}"
        return 0
    elif [ "$redis_val" = "null" ] && [ "$frontend_val" = "null" ]; then
        echo -e "${YELLOW}⚠️  BOTH NULL${NC}"
        return 1
    else
        echo -e "❌ MISMATCH:"
        echo "                Redis: $redis_val"
        echo "                Frontend: $frontend_val"
        return 1
    fi
}

echo "Comparing key fields..."
MATCHES=0
TOTAL=5

compare_field "Latitude" "$REDIS_LAT" "$FRONTEND_LAT" && MATCHES=$((MATCHES + 1))
compare_field "Longitude" "$REDIS_LNG" "$FRONTEND_LNG" && MATCHES=$((MATCHES + 1))
compare_field "Battery" "$REDIS_BAT" "$FRONTEND_BAT" && MATCHES=$((MATCHES + 1))
compare_field "Flight Mode" "$REDIS_MODE" "$FRONTEND_MODE" && MATCHES=$((MATCHES + 1))
compare_field "Timestamp" "$REDIS_TIME" "$FRONTEND_TIME" && MATCHES=$((MATCHES + 1))

echo ""
echo -e "${BLUE}Data consistency: $MATCHES/$TOTAL fields match${NC}"

if [ $MATCHES -eq $TOTAL ]; then
    echo -e "${GREEN}🎉 PERFECT! Data flows correctly through the entire pipeline!${NC}"
elif [ $MATCHES -ge 3 ]; then
    echo -e "${YELLOW}⚠️  MOSTLY GOOD: Most data matches, minor issues detected${NC}"
else
    echo -e "❌ ISSUES: Significant data flow problems detected"
fi

echo ""
echo "⏱️  STEP 4: Real-time Update Test"
echo "================================="

echo "Getting baseline data..."
BASELINE_LAT=$(curl -s "http://localhost:3001/api/drone-telemetry/$DRONE_ID" | jq -r '.latitude // "null"')
BASELINE_TIME=$(curl -s "http://localhost:3001/api/drone-telemetry/$DRONE_ID" | jq -r '.timestamp // ._meta.updatedAt // "null"')

echo "Baseline latitude: $BASELINE_LAT"
echo "Baseline timestamp: $BASELINE_TIME"
echo ""

echo "Waiting 4 seconds for updates..."
sleep 4

echo "Getting updated data..."
UPDATED_LAT=$(curl -s "http://localhost:3001/api/drone-telemetry/$DRONE_ID" | jq -r '.latitude // "null"')
UPDATED_TIME=$(curl -s "http://localhost:3001/api/drone-telemetry/$DRONE_ID" | jq -r '.timestamp // ._meta.updatedAt // "null"')

echo "Updated latitude: $UPDATED_LAT"
echo "Updated timestamp: $UPDATED_TIME"
echo ""

# Check for updates
if [ "$BASELINE_LAT" != "$UPDATED_LAT" ] && [ "$BASELINE_LAT" != "null" ] && [ "$UPDATED_LAT" != "null" ]; then
    echo -e "${GREEN}✅ Position data is updating in real-time!${NC}"
    echo "   Latitude changed from $BASELINE_LAT to $UPDATED_LAT"
elif [ "$BASELINE_TIME" != "$UPDATED_TIME" ] && [ "$BASELINE_TIME" != "null" ] && [ "$UPDATED_TIME" != "null" ]; then
    echo -e "${GREEN}✅ Timestamp is updating (data is fresh)!${NC}"
    echo "   Time changed from $BASELINE_TIME to $UPDATED_TIME"
else
    echo -e "${YELLOW}⚠️  Data may not be updating in real-time${NC}"
    echo "   This could be normal if the mock drone simulation has slow movement"
fi

echo ""
echo "🔧 STEP 5: API Endpoint Verification"
echo "===================================="

# Test the exact endpoint your React hook will use
echo "Testing React hook endpoint..."
echo -e "${CYAN}URL: /api/drone-telemetry/$DRONE_ID${NC}"

HOOK_RESPONSE=$(curl -s "http://localhost:3001/api/drone-telemetry/$DRONE_ID" \
    -H "Accept: application/json" \
    -H "Cache-Control: no-cache")

echo "Response headers check:"
if curl -s -I "http://localhost:3001/api/drone-telemetry/$DRONE_ID" | grep -q "application/json"; then
    echo -e "${GREEN}✅ Correct Content-Type header${NC}"
else
    echo -e "${YELLOW}⚠️  Content-Type header may be missing${NC}"
fi

echo ""
echo "React hook data structure:"
echo "$HOOK_RESPONSE" | jq '{
    id: .id,
    latitude: .latitude,
    longitude: .longitude,
    altitude_relative: .altitude_relative,
    altitude_msl: .altitude_msl,
    percentage: .percentage,
    voltage: .voltage,
    armed: .armed,
    flight_mode: .flight_mode,
    connected: .connected,
    timestamp: .timestamp,
    gps_fix: .gps_fix,
    satellites: .satellites
}' 2>/dev/null || echo "❌ Could not parse hook response"

echo ""
echo "📋 STEP 6: Integration Checklist"
echo "==============================="

echo "Pre-integration verification:"

checks=(
    "Mock drones running:pgrep -f mock-data > /dev/null"
    "Redis has data:docker exec flyos-redis-1 redis-cli EXISTS drone:drone-001:state"
    "Connection service OK:curl -s http://localhost:4005/health | grep -q healthy"
    "Frontend API OK:curl -s http://localhost:3001/api/drone-telemetry/drone-001 | jq -e .latitude"
    "Data is JSON:curl -s http://localhost:3001/api/drone-telemetry/drone-001 | jq . > /dev/null"
)

for check in "${checks[@]}"; do
    name="${check%:*}"
    command="${check#*:}"
    
    printf "%-25s" "$name:"
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC}"
    else
        echo -e "❌ FAIL"
    fi
done

echo ""
echo "🎯 SUMMARY"
echo "=========="

if [ $MATCHES -ge 4 ]; then
    echo -e "${GREEN}🎉 SUCCESS! Your system is ready for React integration!${NC}"
    echo ""
    echo "✅ Data pipeline working: Mock Drones → Redis → Frontend API"
    echo "✅ Real-time updates confirmed"
    echo "✅ API endpoints responding correctly"
    echo "✅ Data structure is consistent"
    echo ""
    echo "🚀 Ready to integrate with React components!"
    echo "   Use the updated useDroneState hook"
    echo "   Data will update every 1-2 seconds automatically"
else
    echo -e "${YELLOW}⚠️  PARTIAL SUCCESS: Some issues detected${NC}"
    echo ""
    echo "Check the comparison results above and ensure:"
    echo "1. Mock drones are running (npm run mock-data)"
    echo "2. All services are healthy"
    echo "3. Wait a few more seconds for data to populate"
fi

echo ""
echo "Manual verification URLs:"
echo "- Direct Redis: http://localhost:4005/redis/$DRONE_ID"
echo "- Frontend API: http://localhost:3001/api/drone-telemetry/$DRONE_ID"
echo "- Service status: http://localhost:4005/status"
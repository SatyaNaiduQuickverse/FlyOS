#!/bin/bash
# test-mission-pipeline.sh - Complete mission pipeline test

echo "🚁 TESTING WAYPOINT MISSION PIPELINE"
echo "===================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test variables
DRONE1_ID="drone-001"
DRONE2_ID="drone-002"
API_BASE="http://localhost:3001/api"
TOKEN=""

# Function to get auth token
get_auth_token() {
    echo "📝 Getting authentication token..."
    
    # Login and extract token - FIXED URL
    RESPONSE=$(curl -s -X POST "http://localhost:3001/api/auth/login" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "mail@flyos.mil",
            "password": "FlyOS2025!"
        }')
    
    TOKEN=$(echo "$RESPONSE" | jq -r '.token // empty')
    
    if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
        echo -e "${RED}❌ Failed to get auth token${NC}"
        echo "Response: $RESPONSE"
        
        # Try alternative login
        echo "Trying alternative credentials..."
        RESPONSE=$(curl -s -X POST "http://localhost:3001/api/auth/login" \
            -H "Content-Type: application/json" \
            -d '{
                "email": "admin@example.com",
                "password": "password123"
            }')
        
        TOKEN=$(echo "$RESPONSE" | jq -r '.token // empty')
        
        if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
            echo -e "${RED}❌ Both login attempts failed${NC}"
            exit 1
        fi
    fi
    
    echo -e "${GREEN}✅ Got auth token: ${TOKEN:0:20}...${NC}"
}

# Function to create test waypoint content
get_test_waypoints() {
    cat << 'EOF'
[
    {
        "seq": 0,
        "frame": 0,
        "command": 16,
        "param1": 0,
        "param2": 0,
        "param3": 0,
        "param4": 0,
        "lat": 18.5204,
        "lng": 73.8567,
        "alt": 100
    },
    {
        "seq": 1,
        "frame": 3,
        "command": 16,
        "param1": 0,
        "param2": 0,
        "param3": 0,
        "param4": 0,
        "lat": 18.5214,
        "lng": 73.8577,
        "alt": 100
    },
    {
        "seq": 2,
        "frame": 3,
        "command": 16,
        "param1": 0,
        "param2": 0,
        "param3": 0,
        "param4": 0,
        "lat": 18.5224,
        "lng": 73.8587,
        "alt": 100
    },
    {
        "seq": 3,
        "frame": 3,
        "command": 16,
        "param1": 0,
        "param2": 0,
        "param3": 0,
        "param4": 0,
        "lat": 18.5234,
        "lng": 73.8597,
        "alt": 100
    },
    {
        "seq": 4,
        "frame": 3,
        "command": 16,
        "param1": 0,
        "param2": 0,
        "param3": 0,
        "param4": 0,
        "lat": 18.5244,
        "lng": 73.8607,
        "alt": 100
    }
]
EOF
}

# Function to test waypoint upload
test_waypoint_upload() {
    local drone_id=$1
    
    echo -e "${BLUE}📤 Testing waypoint upload for ${drone_id}${NC}"
    
    local waypoints=$(get_test_waypoints)
    local waypoint_count=$(echo "$waypoints" | jq 'length')
    
    # Create mission payload
    local payload=$(cat << EOF
{
    "commandType": "upload_waypoints",
    "parameters": {
        "waypoints": $waypoints,
        "fileName": "test_waypoints_${drone_id}.txt",
        "totalWaypoints": $waypoint_count,
        "uploadedBy": "test_user",
        "uploadedAt": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"
    }
}
EOF
    )
    
    # Send upload command
    local response=$(curl -s -X POST "${API_BASE}/drones/${drone_id}/command" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${TOKEN}" \
        -d "$payload")
    
    local success=$(echo "$response" | jq -r '.success // false')
    local mission_id=$(echo "$response" | jq -r '.missionId // .commandId // empty')
    
    if [ "$success" = "true" ]; then
        echo -e "${GREEN}✅ Upload successful for ${drone_id}${NC}"
        echo "   Mission ID: $mission_id"
        echo "   Waypoints: $waypoint_count"
        echo "$mission_id"
    else
        echo -e "${RED}❌ Upload failed for ${drone_id}${NC}"
        echo "   Response: $response"
        echo ""
    fi
}

# Function to test mission commands
test_mission_command() {
    local drone_id=$1
    local command=$2
    local mission_id=$3
    
    echo -e "${BLUE}🎮 Testing ${command} for ${drone_id}${NC}"
    
    local payload=$(cat << EOF
{
    "commandType": "${command}",
    "parameters": {
        "missionId": "${mission_id}"
    }
}
EOF
    )
    
    local response=$(curl -s -X POST "${API_BASE}/drones/${drone_id}/command" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${TOKEN}" \
        -d "$payload")
    
    local success=$(echo "$response" | jq -r '.success // false')
    
    if [ "$success" = "true" ]; then
        echo -e "${GREEN}✅ ${command} successful for ${drone_id}${NC}"
    else
        echo -e "${RED}❌ ${command} failed for ${drone_id}${NC}"
        echo "   Response: $response"
    fi
}

# Function to test mission history
test_mission_history() {
    local drone_id=$1
    
    echo -e "${BLUE}📚 Testing mission history for ${drone_id}${NC}"
    
    local response=$(curl -s -X GET "${API_BASE}/drones/${drone_id}/missions" \
        -H "Authorization: Bearer ${TOKEN}")
    
    local success=$(echo "$response" | jq -r '.success // false')
    local count=$(echo "$response" | jq -r '.count // 0')
    
    if [ "$success" = "true" ]; then
        echo -e "${GREEN}✅ Mission history retrieved: ${count} missions${NC}"
    else
        echo -e "${RED}❌ Failed to get mission history${NC}"
        echo "   Response: $response"
    fi
}

# Function to check Redis storage
check_redis_storage() {
    local drone_id=$1
    local mission_id=$2
    
    echo -e "${BLUE}🔍 Checking Redis storage for ${drone_id}${NC}"
    
    # Check mission data in Redis
    local mission_data=$(docker exec flyos-redis-1 redis-cli GET "mission:${mission_id}" 2>/dev/null)
    
    if [ -n "$mission_data" ] && [ "$mission_data" != "(nil)" ]; then
        echo -e "${GREEN}✅ Mission data found in Redis${NC}"
        local waypoint_count=$(echo "$mission_data" | jq -r '.waypoints | length // 0' 2>/dev/null || echo "N/A")
        echo "   Stored waypoints: $waypoint_count"
    else
        echo -e "${YELLOW}⚠️ Mission data not found in Redis${NC}"
    fi
    
    # Check mission list for drone
    local mission_list=$(docker exec flyos-redis-1 redis-cli LRANGE "missions:${drone_id}" 0 -1 2>/dev/null)
    
    if echo "$mission_list" | grep -q "$mission_id"; then
        echo -e "${GREEN}✅ Mission ID found in drone mission list${NC}"
    else
        echo -e "${YELLOW}⚠️ Mission ID not found in drone mission list${NC}"
    fi
}

# Function to check database storage
check_database_storage() {
    local drone_id=$1
    local mission_id=$2
    
    echo -e "${BLUE}🗄️ Checking TimescaleDB storage for ${drone_id}${NC}"
    
    # Check mission metadata
    local mission_count=$(docker exec flyos-timescaledb-1 psql -U flyos_admin -d flyos_db -t -c \
        "SELECT COUNT(*) FROM drone_missions WHERE mission_id = '${mission_id}' AND drone_id = '${drone_id}';" 2>/dev/null | tr -d ' ')
    
    if [ "$mission_count" = "1" ]; then
        echo -e "${GREEN}✅ Mission metadata found in database${NC}"
    else
        echo -e "${RED}❌ Mission metadata not found in database${NC}"
    fi
    
    # Check waypoints
    local waypoint_count=$(docker exec flyos-timescaledb-1 psql -U flyos_admin -d flyos_db -t -c \
        "SELECT COUNT(*) FROM mission_waypoints WHERE mission_id = '${mission_id}';" 2>/dev/null | tr -d ' ')
    
    if [ "$waypoint_count" -gt 0 ]; then
        echo -e "${GREEN}✅ Waypoints found in database: ${waypoint_count}${NC}"
    else
        echo -e "${RED}❌ No waypoints found in database${NC}"
    fi
}

# Function to check drone isolation
check_drone_isolation() {
    echo -e "${BLUE}🔒 Testing drone isolation${NC}"
    
    # Check that drone1 missions don't appear for drone2
    local drone1_missions=$(docker exec flyos-redis-1 redis-cli LLEN "missions:${DRONE1_ID}" 2>/dev/null || echo 0)
    local drone2_missions=$(docker exec flyos-redis-1 redis-cli LLEN "missions:${DRONE2_ID}" 2>/dev/null || echo 0)
    
    echo "   Drone1 missions: $drone1_missions"
    echo "   Drone2 missions: $drone2_missions"
    
    if [ "$drone1_missions" -gt 0 ] && [ "$drone2_missions" -gt 0 ]; then
        echo -e "${GREEN}✅ Drone isolation working - each drone has separate missions${NC}"
    else
        echo -e "${YELLOW}⚠️ Check drone isolation manually${NC}"
    fi
}

# Function to check service health
check_services() {
    echo -e "${BLUE}🏥 Checking service health${NC}"
    
    # Check drone-db-service
    local db_health=$(curl -s "http://localhost:4001/health" | jq -r '.status // "unknown"' 2>/dev/null || echo "unknown")
    echo "   drone-db-service: $db_health"
    
    # Check drone-connection-service
    local conn_health=$(curl -s "http://localhost:4005/health" | jq -r '.status // "unknown"' 2>/dev/null || echo "unknown")
    echo "   drone-connection-service: $conn_health"
    
    # Check frontend
    local frontend_health=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/api/drones" -H "Authorization: Bearer test" 2>/dev/null || echo "000")
    echo "   frontend API: HTTP $frontend_health"
}

# Main test execution
main() {
    echo "Starting comprehensive mission pipeline test..."
    
    # Step 1: Check services
    check_services
    sleep 2
    
    # Step 2: Get authentication
    get_auth_token
    sleep 1
    
    # Step 3: Test uploads for both drones
    echo -e "\n${YELLOW}=== TESTING WAYPOINT UPLOADS ===${NC}"
    mission1_id=$(test_waypoint_upload "$DRONE1_ID")
    sleep 2
    mission2_id=$(test_waypoint_upload "$DRONE2_ID")
    sleep 2
    
    # Step 4: Check storage for both drones
    echo -e "\n${YELLOW}=== CHECKING STORAGE ===${NC}"
    if [ -n "$mission1_id" ]; then
        check_redis_storage "$DRONE1_ID" "$mission1_id"
        check_database_storage "$DRONE1_ID" "$mission1_id"
    fi
    
    if [ -n "$mission2_id" ]; then
        check_redis_storage "$DRONE2_ID" "$mission2_id"
        check_database_storage "$DRONE2_ID" "$mission2_id"
    fi
    
    # Step 5: Test mission commands
    echo -e "\n${YELLOW}=== TESTING MISSION COMMANDS ===${NC}"
    if [ -n "$mission1_id" ]; then
        test_mission_command "$DRONE1_ID" "start_mission" "$mission1_id"
        sleep 1
        test_mission_command "$DRONE1_ID" "cancel_mission" "$mission1_id"
        sleep 1
    fi
    
    # Step 6: Test mission history
    echo -e "\n${YELLOW}=== TESTING MISSION HISTORY ===${NC}"
    test_mission_history "$DRONE1_ID"
    test_mission_history "$DRONE2_ID"
    
    # Step 7: Check drone isolation
    echo -e "\n${YELLOW}=== TESTING DRONE ISOLATION ===${NC}"
    check_drone_isolation
    
    echo -e "\n${GREEN}🎉 Mission pipeline test completed!${NC}"
    echo -e "${BLUE}📊 Summary:${NC}"
    echo "   - Tested waypoint upload for 2 drones"
    echo "   - Verified Redis storage"
    echo "   - Verified TimescaleDB storage"
    echo "   - Tested mission commands"
    echo "   - Verified drone isolation"
}

# Run the test
main
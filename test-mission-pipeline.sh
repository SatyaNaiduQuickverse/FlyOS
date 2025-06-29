#!/bin/bash
# test-mission-pipeline.sh - FIXED CREDENTIALS

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
    
    # FIXED: Use correct email credentials
    RESPONSE=$(curl -s -X POST "http://localhost:3001/api/auth/login" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "main@flyos.mil",
            "password": "FlyOS2025!"
        }')
    
    TOKEN=$(echo "$RESPONSE" | jq -r '.token // empty')
    
    if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
        echo -e "${RED}❌ Failed to get auth token${NC}"
        echo "Response: $RESPONSE"
        
        # Try eastern region credentials
        echo "Trying regional HQ credentials..."
        RESPONSE=$(curl -s -X POST "http://localhost:3001/api/auth/login" \
            -H "Content-Type: application/json" \
            -d '{
                "email": "east@flyos.mil",
                "password": "FlyOS2025!"
            }')
        
        TOKEN=$(echo "$RESPONSE" | jq -r '.token // empty')
        
        if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
            echo -e "${RED}❌ Both login attempts failed${NC}"
            echo "Response: $RESPONSE"
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

# Function to check service health
check_services() {
    echo -e "${BLUE}🏥 Checking service health${NC}"
    
    # Check drone-db-service
    local db_health=$(curl -s "http://localhost:4001/health" 2>/dev/null || echo "unreachable")
    echo "   drone-db-service: $db_health"
    
    # Check drone-connection-service
    local conn_health=$(curl -s "http://localhost:4005/health" | jq -r '.status // "unknown"' 2>/dev/null || echo "unknown")
    echo "   drone-connection-service: $conn_health"
    
    # Check if containers are running
    echo -e "${BLUE}📦 Checking containers${NC}"
    docker ps --format "table {{.Names}}\t{{.Status}}" | grep flyos
}

# Function to start services if needed
ensure_services_running() {
    echo -e "${BLUE}🚀 Ensuring services are running${NC}"
    
    # Check if containers exist and start them
    if ! docker ps | grep -q "flyos-frontend"; then
        echo "Starting frontend..."
        docker-compose up frontend -d
        sleep 10
    fi
    
    if ! docker ps | grep -q "flyos-drone-db-service"; then
        echo "Starting drone-db-service..."
        docker-compose up drone-db-service -d
        sleep 5
    fi
    
    if ! docker ps | grep -q "flyos-drone-connection-service"; then
        echo "Starting drone-connection-service..."
        docker-compose up drone-connection-service -d
        sleep 5
    fi
}

# Main test execution
main() {
    echo "Starting comprehensive mission pipeline test..."
    
    # Step 1: Ensure services are running
    ensure_services_running
    
    # Step 2: Check services
    check_services
    sleep 2
    
    # Step 3: Get authentication
    get_auth_token
    sleep 1
    
    # Step 4: Test uploads for both drones
    echo -e "\n${YELLOW}=== TESTING WAYPOINT UPLOADS ===${NC}"
    mission1_id=$(test_waypoint_upload "$DRONE1_ID")
    sleep 2
    mission2_id=$(test_waypoint_upload "$DRONE2_ID")
    sleep 2
    
    # Step 5: Test mission commands
    echo -e "\n${YELLOW}=== TESTING MISSION COMMANDS ===${NC}"
    if [ -n "$mission1_id" ]; then
        test_mission_command "$DRONE1_ID" "start_mission" "$mission1_id"
        sleep 1
        test_mission_command "$DRONE1_ID" "cancel_mission" "$mission1_id"
        sleep 1
        test_mission_command "$DRONE1_ID" "clear_waypoints" "$mission1_id"
        sleep 1
    fi
    
    # Step 6: Test mission history
    echo -e "\n${YELLOW}=== TESTING MISSION HISTORY ===${NC}"
    test_mission_history "$DRONE1_ID"
    test_mission_history "$DRONE2_ID"
    
    echo -e "\n${GREEN}🎉 Mission pipeline test completed!${NC}"
    echo -e "${BLUE}📊 Summary:${NC}"
    echo "   - Tested waypoint upload for 2 drones"
    echo "   - Tested mission commands (start/cancel/clear)"
    echo "   - Verified mission history"
    echo "   - Checked service health"
    
    # Test frontend access
    echo -e "\n${BLUE}🌐 Frontend test:${NC}"
    echo "   Visit: http://3.111.215.70:3001/test/mission-pipeline"
    echo "   Login with: main@flyos.mil / FlyOS2025!"
}

# Run the test
main
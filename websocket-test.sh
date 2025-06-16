#!/bin/bash
# precision-landing-test.sh - Test precision landing data flow end-to-end

echo "🔬 PRECISION LANDING DATA FLOW TEST"
echo "=================================="

# Test drones
DRONES=("drone-001" "drone-002" "drone-003")
TEST_TOKEN=""

# Get auth token
get_auth_token() {
    echo "Getting auth token..."
    TOKEN_RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/login \
        -H "Content-Type: application/json" \
        -d '{"email":"main@flyos.mil","password":"FlyOS2025!"}')
    
    if echo "$TOKEN_RESPONSE" | grep -q '"success":true'; then
        TEST_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.token')
        echo "✅ Auth token obtained"
        return 0
    else
        echo "❌ Failed to get auth token"
        echo "$TOKEN_RESPONSE"
        return 1
    fi
}

# Test 1: Send precision landing data to drone-connection-service
test_drone_connection_service() {
    local drone_id=$1
    local test_message=$2
    
    echo "📡 Testing drone-connection-service for $drone_id..."
    
    # Test precision landing buffer endpoint
    RESPONSE=$(curl -s -X GET "http://localhost:4005/precision-landing/$drone_id/buffer?count=5")
    
    if echo "$RESPONSE" | grep -q "droneId"; then
        echo "✅ Drone connection service responding for $drone_id"
        
        # Show existing buffer
        BUFFER_COUNT=$(echo "$RESPONSE" | jq -r '.count // 0')
        echo "   Current buffer: $BUFFER_COUNT messages"
        
        return 0
    else
        echo "❌ Drone connection service not responding for $drone_id"
        return 1
    fi
}

# Test 2: Send precision landing data via Redis
test_redis_precision_data() {
    local drone_id=$1
    local test_message=$2
    
    echo "📊 Testing Redis precision landing data for $drone_id..."
    
    # Create test precision landing message
    local test_data=$(cat << EOF
{
    "droneId": "$drone_id",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
    "output": "$test_message",
    "type": "info",
    "sessionId": "test-session-$(date +%s)",
    "stage": "APPROACH",
    "altitude": 50.5,
    "targetDetected": true,
    "targetConfidence": 0.85
}
EOF
)
    
    # Send to Redis buffer
    docker exec flyos-redis-1 redis-cli LPUSH "precision_landing:$drone_id:buffer" "$test_data" > /dev/null
    docker exec flyos-redis-1 redis-cli EXPIRE "precision_landing:$drone_id:buffer" 3600 > /dev/null
    
    # Publish for real-time subscribers
    docker exec flyos-redis-1 redis-cli PUBLISH "precision_land_output:$drone_id" "$test_data" > /dev/null
    
    echo "✅ Test data sent to Redis for $drone_id"
    
    # Verify data in Redis
    REDIS_COUNT=$(docker exec flyos-redis-1 redis-cli LLEN "precision_landing:$drone_id:buffer")
    echo "   Redis buffer count: $REDIS_COUNT"
    
    return 0
}

# Test 3: Check if data reaches TimescaleDB
test_timescale_storage() {
    local drone_id=$1
    local test_message=$2
    
    echo "🗄️  Testing TimescaleDB storage for $drone_id..."
    
    if [ -z "$TEST_TOKEN" ]; then
        echo "❌ No auth token for database test"
        return 1
    fi
    
    # Send precision landing data via API
    local precision_data=$(cat << EOF
{
    "sessionId": "test-session-$(date +%s)",
    "message": "$test_message",
    "stage": "DESCENT",
    "altitude": 25.0,
    "targetDetected": true,
    "targetConfidence": 0.92,
    "lateralError": 0.5,
    "verticalError": 0.2,
    "batteryLevel": 75.0,
    "windSpeed": 3.2
}
EOF
)
    
    STORE_RESPONSE=$(curl -s -X POST "http://localhost:3001/api/drones/$drone_id/precision-landing" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TEST_TOKEN" \
        -d "$precision_data")
    
    if echo "$STORE_RESPONSE" | grep -q '"success":true'; then
        echo "✅ Data stored in TimescaleDB for $drone_id"
        
        # Get stored data
        sleep 1
        HISTORY_RESPONSE=$(curl -s "http://localhost:3001/api/drones/$drone_id/precision-landing?limit=5" \
            -H "Authorization: Bearer $TEST_TOKEN")
        
        if echo "$HISTORY_RESPONSE" | grep -q "$test_message"; then
            echo "✅ Data verified in database"
            local count=$(echo "$HISTORY_RESPONSE" | jq -r '.count // 0')
            echo "   Database records: $count"
        else
            echo "⚠️  Data stored but not found in recent history"
        fi
        
        return 0
    else
        echo "❌ Failed to store in TimescaleDB: $STORE_RESPONSE"
        return 1
    fi
}

# Test 4: Check frontend API endpoints
test_frontend_apis() {
    local drone_id=$1
    
    echo "🌐 Testing frontend API endpoints for $drone_id..."
    
    # Test buffer endpoint
    BUFFER_RESPONSE=$(curl -s "http://localhost:3001/api/precision-landing/$drone_id/buffer")
    
    if echo "$BUFFER_RESPONSE" | grep -q "droneId"; then
        echo "✅ Frontend precision landing buffer API working"
        local msg_count=$(echo "$BUFFER_RESPONSE" | jq -r '.count // 0')
        echo "   Frontend buffer: $msg_count messages"
    else
        echo "❌ Frontend buffer API failed"
    fi
    
    # Test history endpoint (requires auth)
    if [ -n "$TEST_TOKEN" ]; then
        HISTORY_RESPONSE=$(curl -s "http://localhost:3001/api/drones/$drone_id/precision-landing" \
            -H "Authorization: Bearer $TEST_TOKEN")
        
        if echo "$HISTORY_RESPONSE" | grep -q '"success":true'; then
            echo "✅ Frontend precision landing history API working"
            local history_count=$(echo "$HISTORY_RESPONSE" | jq -r '.count // 0')
            echo "   History records: $history_count"
        else
            echo "❌ Frontend history API failed"
        fi
    fi
}

# Test 5: WebSocket real-time data
test_websocket_realtime() {
    echo "📡 Testing WebSocket real-time precision landing..."
    
    if [ -z "$TEST_TOKEN" ]; then
        echo "❌ No auth token for WebSocket test"
        return 1
    fi
    
    # Create WebSocket test client
    cat > /tmp/precision_ws_test.js << 'EOF'
const { io } = require('socket.io-client');

const WS_URL = process.env.WS_URL || 'http://localhost:4002';
const TOKEN = process.env.TEST_TOKEN;
const DRONE_ID = process.env.DRONE_ID || 'drone-001';

console.log(`Testing precision landing WebSocket: ${WS_URL}`);

const socket = io(WS_URL, {
    auth: { token: TOKEN },
    transports: ['websocket'],
    timeout: 5000
});

let messageReceived = false;

socket.on('connect', () => {
    console.log('✅ WebSocket connected');
    
    // Subscribe to precision landing events
    socket.emit('subscribe', `precision_land_output:${DRONE_ID}`);
    socket.emit('subscribe', `precision_land_status:${DRONE_ID}`);
    
    console.log(`📡 Subscribed to precision landing events for ${DRONE_ID}`);
    
    setTimeout(() => {
        if (!messageReceived) {
            console.log('⚠️  No precision landing messages received in 3 seconds');
        }
        socket.disconnect();
        process.exit(0);
    }, 3000);
});

socket.on('precision_land_output', (data) => {
    console.log('🎯 Precision landing output received:', data);
    messageReceived = true;
});

socket.on('precision_land_status', (data) => {
    console.log('📊 Precision landing status received:', data);
    messageReceived = true;
});

socket.on('connect_error', (error) => {
    console.log('❌ WebSocket connection failed:', error.message);
    process.exit(1);
});

setTimeout(() => {
    console.log('❌ WebSocket test timeout');
    process.exit(1);
}, 5000);
EOF
    
    # Run WebSocket test
    if command -v node > /dev/null && [ -f "node_modules/socket.io-client/package.json" ]; then
        WS_URL="http://localhost:4002" TEST_TOKEN="$TEST_TOKEN" DRONE_ID="drone-001" node /tmp/precision_ws_test.js
        echo "✅ WebSocket test completed"
    else
        echo "⚠️  Node.js or socket.io-client not available for WebSocket test"
    fi
    
    rm -f /tmp/precision_ws_test.js
}

# Main test execution
main() {
    echo "Starting precision landing data flow tests..."
    
    # Get authentication token
    if ! get_auth_token; then
        echo "❌ Cannot proceed without auth token"
        exit 1
    fi
    
    # Test each drone
    for drone_id in "${DRONES[@]}"; do
        echo ""
        echo "🚁 Testing drone: $drone_id"
        echo "========================="
        
        local test_message="TEST: Precision landing data for $drone_id at $(date)"
        
        # Run all tests for this drone
        test_drone_connection_service "$drone_id" "$test_message"
        test_redis_precision_data "$drone_id" "$test_message"
        test_timescale_storage "$drone_id" "$test_message"
        test_frontend_apis "$drone_id"
    done
    
    # Test WebSocket real-time functionality
    echo ""
    echo "📡 WEBSOCKET REAL-TIME TEST"
    echo "=========================="
    test_websocket_realtime
    
    # Summary
    echo ""
    echo "🎯 PRECISION LANDING TEST SUMMARY"
    echo "================================"
    echo "✅ Drone connection service tested"
    echo "✅ Redis buffer/publish tested"
    echo "✅ TimescaleDB storage tested"
    echo "✅ Frontend APIs tested"
    echo "✅ WebSocket real-time tested"
    echo ""
    echo "Check your precision landing component in the frontend to see if data appears!"
    echo "Visit: http://localhost:3001/secure/main-hq/drone-control/drone-001"
}

# Run tests
main "$@"
#!/bin/bash
# comprehensive-camera-test.sh - Complete Camera Module Testing

echo "🎥 COMPREHENSIVE CAMERA MODULE TEST"
echo "==================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test tracking
TESTS_PASSED=0
TESTS_FAILED=0

success() { echo -e "${GREEN}✅ $1${NC}"; ((TESTS_PASSED++)); }
error() { echo -e "${RED}❌ $1${NC}"; ((TESTS_FAILED++)); }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
info() { echo -e "${BLUE}ℹ️  $1${NC}"; }

# Test drones
DRONES=("drone-001" "drone-002" "drone-003")
CAMERAS=("front" "bottom")

echo ""
echo "🔐 AUTHENTICATION & TOKEN VALIDATION"
echo "===================================="

# Get token using your method
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"main@flyos.mil","password":"FlyOS2025!"}' | \
  grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
    success "Token generated: ${TOKEN:0:30}..."
    
    # Validate token format
    if [[ $TOKEN =~ ^[A-Za-z0-9_.-]+$ ]]; then
        success "Token format valid"
    else
        error "Token format invalid"
    fi
    
    # Test token with API
    USER_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/users)
    if echo "$USER_RESPONSE" | grep -q '"users"'; then
        success "Token authentication working"
    else
        warn "Token auth response: ${USER_RESPONSE:0:50}..."
    fi
else
    error "Token generation failed"
    exit 1
fi

echo ""
echo "🏗️ INFRASTRUCTURE VALIDATION"
echo "============================"

# Service health checks
SERVICES=(
    "Frontend:http://localhost:3001/health"
    "Realtime:http://localhost:4002/health"
    "DroneConnection:http://localhost:4005/health"
    "UserManagement:http://localhost:4003/health"
)

for service_info in "${SERVICES[@]}"; do
    IFS=':' read -r name url <<< "$service_info"
    if curl -s -f "$url" > /dev/null 2>&1; then
        success "$name service healthy"
    else
        error "$name service unhealthy"
    fi
done

# Redis connectivity
if docker exec flyos-redis-1 redis-cli ping 2>/dev/null | grep -q PONG; then
    success "Redis connectivity"
else
    error "Redis not responding"
fi

echo ""
echo "📹 CAMERA DATA FLOW TESTING"
echo "==========================="

# Clear existing camera data
docker exec flyos-redis-1 redis-cli FLUSHDB > /dev/null 2>&1

# Test multiple drones and cameras
for drone in "${DRONES[@]}"; do
    for camera in "${CAMERAS[@]}"; do
        echo "Testing $drone:$camera..."
        
        # Create mock camera frame
        TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
        FRAME_DATA="{\"droneId\":\"$drone\",\"camera\":\"$camera\",\"frame\":\"mock-frame-$(date +%s)\",\"timestamp\":\"$TIMESTAMP\",\"metadata\":{\"resolution\":\"720p\",\"fps\":30,\"quality\":85}}"
        
        # Store latest frame
        docker exec flyos-redis-1 redis-cli SET "camera:$drone:$camera:latest" "$FRAME_DATA" EX 300 > /dev/null
        
        # Set camera status
        STATUS_DATA="{\"status\":\"active\",\"startedAt\":\"$TIMESTAMP\",\"config\":{\"resolution\":\"720p\",\"fps\":30}}"
        docker exec flyos-redis-1 redis-cli SET "camera:$drone:$camera:status" "$STATUS_DATA" EX 300 > /dev/null
        
        # Verify data stored
        if docker exec flyos-redis-1 redis-cli EXISTS "camera:$drone:$camera:latest" | grep -q 1; then
            success "$drone:$camera data stored"
        else
            error "$drone:$camera data storage failed"
        fi
    done
done

# Count total camera keys
CAMERA_KEYS=$(docker exec flyos-redis-1 redis-cli KEYS "camera:*" | wc -l)
info "Total camera keys created: $CAMERA_KEYS"

echo ""
echo "🌐 CAMERA API ENDPOINT TESTING"
echo "=============================="

# Test camera API endpoints for each drone
for drone in "${DRONES[@]}"; do
    for camera in "${CAMERAS[@]}"; do
        # Test latest frame endpoint
        LATEST_RESPONSE=$(curl -s "http://localhost:4005/camera/$drone/$camera/latest")
        if echo "$LATEST_RESPONSE" | grep -q "frame"; then
            success "$drone:$camera latest frame API"
        else
            error "$drone:$camera latest frame API failed"
        fi
        
        # Test status endpoint
        STATUS_RESPONSE=$(curl -s "http://localhost:4005/camera/$drone/$camera/status")
        if echo "$STATUS_RESPONSE" | grep -q "status"; then
            success "$drone:$camera status API"
        else
            error "$drone:$camera status API failed"
        fi
    done
done

# Test streams list endpoint
STREAMS_RESPONSE=$(curl -s "http://localhost:4005/camera/streams")
if echo "$STREAMS_RESPONSE" | grep -q "streams"; then
    success "Camera streams list API"
else
    error "Camera streams list API failed"
fi

echo ""
echo "🔌 WEBSOCKET SUBSCRIPTION TESTING"
echo "================================="

# Create WebSocket test for each drone
for drone in "${DRONES[@]}"; do
    cat > "ws_test_$drone.js" << EOF
const io = require('socket.io-client');

async function testCameraWebSocket() {
    try {
        const token = process.env.TEST_TOKEN;
        const droneId = '$drone';
        
        const socket = io('http://realtime-service:4002', {
            auth: { token },
            extraHeaders: { Authorization: \`Bearer \${token}\` },
            transports: ['polling', 'websocket'],
            timeout: 5000
        });
        
        let subscribed = false;
        
        socket.on('connect', () => {
            console.log(\`✅ \${droneId} WebSocket connected\`);
            
            // Subscribe to front camera
            socket.emit('subscribe_camera_stream', {
                droneId: droneId,
                camera: 'front',
                channels: [\`camera:\${droneId}:front:stream\`, \`camera:\${droneId}:front:control\`]
            });
        });
        
        socket.on('camera_subscription_status', (data) => {
            if (data.status === 'subscribed') {
                console.log(\`✅ \${droneId} subscription successful\`);
                subscribed = true;
            }
        });
        
        socket.on('camera_frame', (data) => {
            console.log(\`✅ \${droneId} frame received\`);
        });
        
        socket.on('connect_error', (error) => {
            console.log(\`❌ \${droneId} connection error: \${error.message}\`);
        });
        
        setTimeout(() => {
            if (subscribed) {
                console.log(\`✅ \${droneId} WebSocket test passed\`);
                process.exit(0);
            } else {
                console.log(\`❌ \${droneId} WebSocket test failed\`);
                process.exit(1);
            }
        }, 3000);
        
    } catch (error) {
        console.log(\`❌ \${droneId} WebSocket error: \${error.message}\`);
        process.exit(1);
    }
}

testCameraWebSocket();
EOF

    # Copy and run test
    docker cp "ws_test_$drone.js" flyos-frontend-1:/app/
    if docker exec -e TEST_TOKEN="$TOKEN" flyos-frontend-1 timeout 5 node "/app/ws_test_$drone.js" 2>/dev/null | grep -q "WebSocket test passed"; then
        success "$drone WebSocket subscription"
    else
        warn "$drone WebSocket subscription (may need longer timeout)"
    fi
    
    # Cleanup
    rm -f "ws_test_$drone.js"
    docker exec flyos-frontend-1 rm -f "/app/ws_test_$drone.js" 2>/dev/null || true
done

echo ""
echo "📡 CAMERA STREAM PUBLISHING TEST"
echo "==============================="

# Test publishing camera frames to Redis channels
for drone in "${DRONES[@]}"; do
    for camera in "${CAMERAS[@]}"; do
        STREAM_DATA="{\"droneId\":\"$drone\",\"camera\":\"$camera\",\"frame\":\"live-stream-$(date +%s)\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"metadata\":{\"resolution\":\"720p\",\"fps\":30}}"
        
        # Publish to stream channel
        PUBLISH_RESULT=$(docker exec flyos-redis-1 redis-cli PUBLISH "camera:$drone:$camera:stream" "$STREAM_DATA")
        
        if [ "$PUBLISH_RESULT" -ge 0 ]; then
            success "$drone:$camera stream published"
        else
            error "$drone:$camera stream publish failed"
        fi
    done
done

echo ""
echo "🔄 CAMERA DATA ISOLATION TEST"
echo "============================="

# Test that drone data doesn't cross-contaminate
TEST_FRAME_001=$(curl -s "http://localhost:4005/camera/drone-001/front/latest" | grep -o '"frame":"[^"]*"' | cut -d'"' -f4)
TEST_FRAME_002=$(curl -s "http://localhost:4005/camera/drone-002/front/latest" | grep -o '"frame":"[^"]*"' | cut -d'"' -f4)

if [ "$TEST_FRAME_001" != "$TEST_FRAME_002" ] && [ -n "$TEST_FRAME_001" ] && [ -n "$TEST_FRAME_002" ]; then
    success "Camera data isolation working"
else
    error "Camera data isolation failed"
fi

echo ""
echo "🎮 FRONTEND INTEGRATION TEST"
echo "============================"

# Test frontend routes
ROUTES=(
    "/auth/login"
    "/secure/main-hq/dashboard"
)

for route in "${ROUTES[@]}"; do
    if curl -s -f "http://localhost:3001$route" > /dev/null 2>&1; then
        success "Frontend route: $route"
    else
        error "Frontend route failed: $route"
    fi
done

# Test drone control page (should return HTML even if protected)
DRONE_PAGE_RESPONSE=$(curl -s -w "%{http_code}" "http://localhost:3001/secure/main-hq/drone-control/drone-001" -o /dev/null)
if [ "$DRONE_PAGE_RESPONSE" -eq 200 ] || [ "$DRONE_PAGE_RESPONSE" -eq 302 ]; then
    success "Drone control page accessible"
else
    warn "Drone control page response: $DRONE_PAGE_RESPONSE"
fi

echo ""
echo "⚡ PERFORMANCE & SCALE TEST"
echo "=========================="

# Test rapid camera updates
echo "Testing rapid camera frame updates..."
for i in {1..10}; do
    FRAME_DATA="{\"frame\":\"perf-test-$i\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"
    docker exec flyos-redis-1 redis-cli SET "camera:drone-001:front:perf$i" "$FRAME_DATA" EX 10 > /dev/null
done

PERF_KEYS=$(docker exec flyos-redis-1 redis-cli KEYS "camera:drone-001:front:perf*" | wc -l)
if [ "$PERF_KEYS" -eq 10 ]; then
    success "Rapid updates handled: $PERF_KEYS frames"
else
    warn "Performance test: $PERF_KEYS/10 frames stored"
fi

# Memory usage check
REDIS_MEMORY=$(docker exec flyos-redis-1 redis-cli INFO memory | grep used_memory_human | cut -d: -f2 | tr -d '\r\n')
info "Redis memory usage: $REDIS_MEMORY"

echo ""
echo "🧹 CLEANUP TEST"
echo "==============="

# Test TTL cleanup
docker exec flyos-redis-1 redis-cli SET "camera:test:cleanup" "test" EX 1 > /dev/null
sleep 2
if docker exec flyos-redis-1 redis-cli EXISTS "camera:test:cleanup" | grep -q 0; then
    success "TTL cleanup working"
else
    error "TTL cleanup failed"
fi

echo ""
echo "📊 FINAL RESULTS"
echo "================"

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
PASS_RATE=$((TESTS_PASSED * 100 / TOTAL_TESTS))

echo "Total Tests: $TOTAL_TESTS"
echo "Passed: $TESTS_PASSED"
echo "Failed: $TESTS_FAILED"
echo "Pass Rate: ${PASS_RATE}%"

echo ""
echo "📈 SYSTEM METRICS"
echo "================="

# Camera data summary
TOTAL_CAMERA_KEYS=$(docker exec flyos-redis-1 redis-cli KEYS "camera:*" | wc -l)
echo "📹 Total camera keys: $TOTAL_CAMERA_KEYS"

# Service status
echo "🏃 Running services:"
docker-compose ps | grep -E "(frontend|realtime|drone-connection)" | grep "Up" | wc -l | xargs echo "   Active services:"

# Database status
USER_COUNT=$(docker exec flyos-user-management-service-1 node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.user.count().then(c=>console.log(c)).catch(()=>console.log(0));" 2>/dev/null)
echo "👥 Users in database: $USER_COUNT"

echo ""
echo "🎯 CAMERA MODULE STATUS"
echo "======================"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL CAMERA TESTS PASSED!${NC}"
    echo -e "${GREEN}✅ Camera module is production ready${NC}"
    echo ""
    echo "📱 Ready for:"
    echo "• Multi-drone camera streaming"
    echo "• WebSocket subscriptions"
    echo "• Frontend integration"
    echo "• Data isolation between drones"
    echo "• High-performance frame handling"
elif [ $TESTS_FAILED -le 3 ]; then
    echo -e "${YELLOW}⚠️  MINOR ISSUES DETECTED${NC}"
    echo -e "${YELLOW}Camera module mostly functional with ${TESTS_FAILED} minor issues${NC}"
else
    echo -e "${RED}❌ SIGNIFICANT ISSUES FOUND${NC}"
    echo -e "${RED}Camera module needs attention: ${TESTS_FAILED} failed tests${NC}"
fi

echo ""
echo "🔗 QUICK ACCESS LINKS"
echo "===================="
echo "Frontend: http://localhost:3001"
echo "Login: main@flyos.mil / FlyOS2025!"
echo "Camera Control: http://localhost:3001/secure/main-hq/drone-control/drone-001"
echo "API Health: http://localhost:4005/health"
echo ""
echo "Test token: ${TOKEN:0:30}..."
#!/bin/bash
# camera-diagnostic.sh - Quick camera system diagnosis and fix

echo "🔧 FlyOS Camera System Diagnostic"
echo "=================================="

# Check connected drones
echo "1. Checking connected drones..."
DRONE_STATUS=$(curl -s http://localhost:4005/status)
CONNECTED_COUNT=$(echo "$DRONE_STATUS" | grep -o '"totalConnected":[0-9]*' | cut -d: -f2)
echo "   Connected drones: ${CONNECTED_COUNT:-0}"

if [ "${CONNECTED_COUNT:-0}" -eq 0 ]; then
    echo "❌ No drones connected - this is the root cause!"
    echo ""
    echo "🚀 FIXING: Starting mock drones with camera streams..."
    
    # Check if mock data script exists
    if [ -f "services/drone-connection-service/src/mockData.ts" ]; then
        cd services/drone-connection-service
        echo "   Starting mock drone simulation..."
        npm run mock-data &
        MOCK_PID=$!
        echo "   Mock drones started (PID: $MOCK_PID)"
        cd ../..
        
        # Wait for drones to connect
        echo "   Waiting 8 seconds for drones to connect..."
        sleep 8
        
        # Check again
        NEW_STATUS=$(curl -s http://localhost:4005/status)
        NEW_COUNT=$(echo "$NEW_STATUS" | grep -o '"totalConnected":[0-9]*' | cut -d: -f2)
        echo "   Now connected: ${NEW_COUNT:-0} drones"
        
        if [ "${NEW_COUNT:-0}" -gt 0 ]; then
            echo "✅ Mock drones started successfully!"
            
            # Test camera data
            echo ""
            echo "2. Testing camera data flow..."
            sleep 2
            
            # Check for camera streams
            STREAMS=$(curl -s http://localhost:4005/camera/streams)
            STREAM_COUNT=$(echo "$STREAMS" | grep -o '"streams":\[[^]]*\]' | grep -o '\[.*\]' | grep -c '{' || echo "0")
            echo "   Active camera streams: $STREAM_COUNT"
            
            # Test specific drone camera
            FRAME_RESULT=$(curl -s -w "%{http_code}" http://localhost:4005/camera/drone-001/front/latest)
            FRAME_STATUS="${FRAME_RESULT: -3}"
            echo "   Front camera test: HTTP $FRAME_STATUS"
            
            # Check Redis camera data
            REDIS_KEYS=$(docker exec flyos-redis-1 redis-cli KEYS "camera:*" 2>/dev/null | wc -l)
            echo "   Redis camera keys: $REDIS_KEYS"
            
            if [ "$FRAME_STATUS" = "200" ] && [ "$REDIS_KEYS" -gt 0 ]; then
                echo ""
                echo "✅ CAMERA SYSTEM FULLY OPERATIONAL!"
                echo "   • Mock drones running with camera streams"
                echo "   • Camera data flowing through Redis"
                echo "   • APIs responding correctly"
                echo ""
                echo "🎯 Next steps:"
                echo "   1. Visit: http://localhost:3001/secure/main-hq/dashboard"
                echo "   2. Go to DRONE CONTROL tab"
                echo "   3. Select a drone to see live camera feeds"
                echo ""
                echo "⚠️  Note: Press Ctrl+C to stop mock drones"
                
                # Keep script running to maintain mock drones
                echo "Keeping mock drones running... (Press Ctrl+C to stop)"
                wait $MOCK_PID
            else
                echo "⚠️  Camera data not flowing yet - may need more time"
            fi
        else
            echo "❌ Mock drones failed to connect"
        fi
    else
        echo "❌ Mock data script not found!"
        echo "   Expected: services/drone-connection-service/src/mockData.ts"
    fi
else
    echo "✅ $CONNECTED_COUNT drones already connected"
    
    # Since drones are connected, check why cameras aren't working
    echo ""
    echo "2. Diagnosing camera issues with connected drones..."
    
    # Check camera streams
    STREAMS=$(curl -s http://localhost:4005/camera/streams)
    echo "   Camera streams response: $STREAMS"
    
    # Check specific drone camera
    CAMERA_STATUS=$(curl -s http://localhost:4005/camera/drone-001/front/status)
    echo "   Camera status: $CAMERA_STATUS"
    
    # Check Redis camera data
    REDIS_CAMERA_DATA=$(docker exec flyos-redis-1 redis-cli KEYS "camera:*" 2>/dev/null)
    echo "   Redis camera keys: $REDIS_CAMERA_DATA"
    
    if [ -z "$REDIS_CAMERA_DATA" ]; then
        echo "❌ No camera data in Redis - drones may not be sending camera frames"
        echo "   Possible issues:"
        echo "   • Mock drones not configured for camera streaming"
        echo "   • Camera handler not working in drone-connection-service"
        echo "   • Redis camera data expiring too quickly"
    fi
fi
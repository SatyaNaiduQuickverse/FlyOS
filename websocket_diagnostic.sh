#!/bin/bash

echo "🔍 DEEP DIVE WEBSOCKET DIAGNOSTIC ANALYSIS"
echo "========================================================"
echo ""

# Test 1: Check if realtime service is actually responding
echo "1️⃣ Testing WebSocket server connectivity..."
echo ""

# Check if port 4002 is open
echo "Checking if port 4002 is listening:"
netstat -tlnp | grep 4002 || echo "❌ Port 4002 not listening"

echo ""
echo "Testing HTTP endpoint on realtime service:"
response=$(curl -s -w "%{http_code}" http://localhost:4002/health 2>/dev/null)
if [[ "${response: -3}" == "200" ]]; then
    echo "✅ Realtime service HTTP health check: OK"
else
    echo "❌ Realtime service not responding on HTTP"
fi

echo ""

# Test 2: Check WebSocket handshake
echo "2️⃣ Testing WebSocket handshake..."
echo ""

# Try to establish WebSocket connection
echo "Testing Socket.IO handshake:"
handshake=$(curl -s "http://localhost:4002/socket.io/?EIO=4&transport=polling" 2>/dev/null)
if echo "$handshake" | grep -q "sid"; then
    echo "✅ Socket.IO handshake successful"
    echo "Response: $handshake"
else
    echo "❌ Socket.IO handshake failed"
    echo "Response: $handshake"
fi

echo ""

# Test 3: Check realtime service logs for errors
echo "3️⃣ Checking realtime service logs..."
echo ""

echo "Recent realtime service logs:"
docker logs $(docker ps -q -f name=realtime-service) --tail 20

echo ""

# Test 4: Check environment variables
echo "4️⃣ Checking environment variables..."
echo ""

echo "Realtime service environment:"
docker exec $(docker ps -q -f name=realtime-service) printenv | grep -E "(SUPABASE|NODE_ENV|PORT|REDIS)" || echo "❌ Environment variables not found"

echo ""

# Test 5: Test Redis connectivity from realtime service
echo "5️⃣ Testing Redis connectivity from realtime service..."
echo ""

echo "Testing Redis connection from realtime service:"
redis_test=$(docker exec $(docker ps -q -f name=realtime-service) node -e "
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');
redis.ping().then(result => {
    console.log('Redis ping result:', result);
    process.exit(0);
}).catch(err => {
    console.log('Redis error:', err.message);
    process.exit(1);
});
" 2>/dev/null)

echo "$redis_test"

echo ""

# Test 6: Check Supabase token validity
echo "6️⃣ Testing Supabase authentication from realtime service..."
echo ""

echo "Testing Supabase token verification:"
docker exec $(docker ps -q -f name=realtime-service) node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Test with a sample token (this won't work but will show if Supabase client initializes)
console.log('Supabase client created successfully');
console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing');
console.log('Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing');
" 2>/dev/null || echo "❌ Supabase client test failed"

echo ""

# Test 7: Check frontend WebSocket URL
echo "7️⃣ Checking frontend WebSocket configuration..."
echo ""

echo "Frontend environment variables:"
docker exec $(docker ps -q -f name=frontend) printenv | grep -E "(WS_URL|NEXT_PUBLIC)" || echo "❌ Frontend environment variables not found"

echo ""

# Test 8: Test direct WebSocket connection using wscat if available
echo "8️⃣ Testing direct WebSocket connection..."
echo ""

if command -v wscat &> /dev/null; then
    echo "Testing WebSocket connection with wscat:"
    timeout 5 wscat -c "ws://localhost:4002/socket.io/?EIO=4&transport=websocket" 2>&1 || echo "WebSocket connection test completed"
else
    echo "wscat not available, skipping direct WebSocket test"
fi

echo ""

# Test 9: Check package.json dependencies
echo "9️⃣ Checking WebSocket package versions..."
echo ""

echo "Realtime service package versions:"
docker exec $(docker ps -q -f name=realtime-service) cat package.json | grep -A 5 -B 5 "socket.io" || echo "❌ Could not read package.json"

echo ""
echo "Frontend package versions:"
docker exec $(docker ps -q -f name=frontend) cat package.json | grep -A 5 -B 5 "socket.io" || echo "❌ Could not read package.json"

echo ""

# Test 10: Summary and recommendations
echo "🏁 DIAGNOSTIC SUMMARY"
echo "====================="
echo ""

# Check all services status
all_running=true
services=("frontend" "drone-db-service" "realtime-service" "redis" "timescaledb")

for service in "${services[@]}"; do
    if docker ps | grep -q "$service"; then
        echo "✅ $service: Running"
    else
        echo "❌ $service: Not running"
        all_running=false
    fi
done

echo ""
echo "🔧 RECOMMENDED FIXES:"
echo ""

if [[ "$all_running" == "false" ]]; then
    echo "1. Start all services: docker-compose up -d"
fi

echo "2. Check realtime service logs: docker logs flyos-realtime-service-1"
echo "3. Verify WebSocket URL in frontend: ws://3.111.215.70:4002"
echo "4. Ensure Supabase credentials are correct in realtime service"
echo "5. Check if firewall is blocking port 4002"
echo "6. Verify Redis is accessible from realtime service"

echo ""
echo "🎯 NEXT STEPS:"
echo "1. Run this diagnostic script"
echo "2. Check the logs for specific error patterns"
echo "3. Apply targeted fixes based on the results"

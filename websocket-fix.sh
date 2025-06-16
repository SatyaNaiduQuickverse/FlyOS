#!/bin/bash
# revert-websocket-changes.sh - Revert the problematic WebSocket configuration

echo "🔄 REVERTING WEBSOCKET CONFIGURATION CHANGES"
echo "============================================="

# Step 1: Revert docker-compose.yml environment variable
echo "1. Reverting environment variable in docker-compose.yml..."
cp docker-compose.yml docker-compose.yml.revert-backup

# Change back from localhost:3001 to the original external URL
sed -i 's|NEXT_PUBLIC_WS_URL=http://localhost:3001|NEXT_PUBLIC_WS_URL=http://3.111.215.70:4002|' docker-compose.yml

echo "✅ Environment variable reverted"

# Step 2: Remove the WebSocket proxy from next.config.ts
echo "2. Removing WebSocket proxy from next.config.ts..."
cp next.config.ts next.config.ts.revert-backup

# Remove the socket.io proxy entry that was added
sed -i '/socket\.io\/:\*path\*/,+3d' next.config.ts

echo "✅ WebSocket proxy removed from next.config.ts"

# Step 3: Revert frontend hook files to use original URLs
echo "3. Reverting frontend hooks to use original WebSocket URLs..."

# Revert useCameraStream.ts
if [ -f "lib/hooks/useCameraStream.ts" ]; then
    if [ -f "lib/hooks/useCameraStream.ts.backup" ]; then
        cp lib/hooks/useCameraStream.ts.backup lib/hooks/useCameraStream.ts
        echo "✅ useCameraStream.ts reverted from backup"
    else
        # Manually revert the changes
        sed -i 's|window.location.origin|process.env.NEXT_PUBLIC_WS_URL \|\| (typeof window !== '\''undefined'\'' ? window.location.origin : "http://localhost:3001")|g' lib/hooks/useCameraStream.ts
        echo "✅ useCameraStream.ts reverted manually"
    fi
fi

# Revert useDroneState.ts
if [ -f "lib/hooks/useDroneState.ts" ]; then
    if [ -f "lib/hooks/useDroneState.ts.backup" ]; then
        cp lib/hooks/useDroneState.ts.backup lib/hooks/useDroneState.ts
        echo "✅ useDroneState.ts reverted from backup"
    else
        # Manually revert the changes
        sed -i 's|window.location.origin|process.env.NEXT_PUBLIC_WS_URL \|\| (typeof window !== '\''undefined'\'' ? \`\${window.location.protocol === '\''https:'\'' ? '\''wss:'\'' : '\''ws:'\''}/\/\${window.location.host}\` : '\''ws://localhost:3001'\'')|g' lib/hooks/useDroneState.ts
        echo "✅ useDroneState.ts reverted manually"
    fi
fi

# Revert socketClient.ts
if [ -f "lib/socketClient.ts" ]; then
    if [ -f "lib/socketClient.ts.backup" ]; then
        cp lib/socketClient.ts.backup lib/socketClient.ts
        echo "✅ socketClient.ts reverted from backup"
    else
        # Manually revert the changes
        sed -i 's|window.location.origin|process.env.NEXT_PUBLIC_WS_URL \|\| (typeof window !== '\''undefined'\'' ? window.location.origin : '\''http://localhost:3001'\'')|g' lib/socketClient.ts
        echo "✅ socketClient.ts reverted manually"
    fi
fi

# Step 4: Restore realtime-service port exposure in docker-compose.yml
echo "4. Restoring realtime-service port exposure..."

# Check if ports section is commented out and restore it
if grep -q "# ports:" docker-compose.yml; then
    sed -i '/realtime-service:/,/healthcheck:/ s/# ports:/ports:/' docker-compose.yml
    sed -i '/realtime-service:/,/healthcheck:/ s/#   - "4002:4002"/  - "4002:4002"/' docker-compose.yml
    echo "✅ Realtime-service ports restored"
else
    echo "ℹ️  Realtime-service ports were not commented out"
fi

# Step 5: Restart services to apply changes
echo "5. Restarting services to apply reverted configuration..."

docker-compose stop frontend realtime-service
docker-compose up -d --build frontend realtime-service

echo "6. Waiting for services to start..."
sleep 15

# Step 6: Test the reverted configuration
echo "7. Testing reverted WebSocket configuration..."

# Test frontend health
if curl -s -f "http://localhost:3001/health" > /dev/null 2>&1; then
    echo "✅ Frontend is running"
else
    echo "❌ Frontend not responding"
fi

# Test realtime service health
if curl -s -f "http://localhost:4002/health" > /dev/null 2>&1; then
    echo "✅ Realtime service is accessible directly"
else
    echo "❌ Realtime service not accessible directly"
fi

# Test if WebSocket is accessible
echo "8. Testing WebSocket accessibility..."
if nc -z localhost 4002; then
    echo "✅ WebSocket port 4002 is accessible"
else
    echo "❌ WebSocket port 4002 is not accessible"
fi

echo ""
echo "🔄 WEBSOCKET CONFIGURATION REVERT COMPLETED"
echo "==========================================="
echo ""
echo "Changes reverted:"
echo "✅ Environment variable: NEXT_PUBLIC_WS_URL → http://3.111.215.70:4002"
echo "✅ Removed WebSocket proxy from next.config.ts"
echo "✅ Frontend hooks restored to use original WebSocket URLs"
echo "✅ Realtime-service port exposure restored"
echo "✅ Services restarted with original configuration"
echo ""
echo "Your WebSocket configuration should now work as before."
echo "Test your application to ensure everything is functioning correctly."

# Show current configuration
echo ""
echo "📊 CURRENT CONFIGURATION"
echo "========================"
echo "Frontend URL: http://localhost:3001"
echo "Realtime Service: http://localhost:4002"
echo "WebSocket URL: $(grep NEXT_PUBLIC_WS_URL docker-compose.yml | head -1 | cut -d'=' -f2)"
echo ""
echo "If you still experience issues, check the service logs:"
echo "docker-compose logs frontend"
echo "docker-compose logs realtime-service"
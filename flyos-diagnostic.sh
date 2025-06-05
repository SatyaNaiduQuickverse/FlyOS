#!/bin/bash
# flyos-diagnostic.sh - Diagnose and fix the mock drone issue

echo "🔍 FlyOS System Diagnostic"
echo "=========================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "📋 STEP 1: Check Current System State"
echo "====================================="

echo -e "${BLUE}Docker containers:${NC}"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep flyos

echo ""
echo -e "${BLUE}Process check:${NC}"
echo "Mock drone processes:"
pgrep -f "mock-data" || echo "No mock-data processes found"

echo ""
echo "Node.js processes:"
pgrep -f "node" || echo "No Node.js processes found"

echo ""
echo -e "${BLUE}Port status:${NC}"
for port in 3001 4005 6379; do
    if netstat -tlnp 2>/dev/null | grep ":$port " > /dev/null; then
        echo -e "${GREEN}✅ Port $port is listening${NC}"
    else
        echo -e "${RED}❌ Port $port is not listening${NC}"
    fi
done

echo ""
echo "📊 STEP 2: Check Service Health"
echo "==============================="

echo -e "${BLUE}Drone Connection Service:${NC}"
if curl -s --connect-timeout 3 "http://localhost:4005/health" > /dev/null; then
    response=$(curl -s "http://localhost:4005/health")
    echo -e "${GREEN}✅ Service responding${NC}"
    echo "$response" | jq . 2>/dev/null || echo "$response"
else
    echo -e "${RED}❌ Service not responding${NC}"
fi

echo ""
echo -e "${BLUE}Connected drones status:${NC}"
status_response=$(curl -s "http://localhost:4005/status" 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "$status_response" | jq . 2>/dev/null || echo "$status_response"
else
    echo -e "${RED}❌ Cannot get drone status${NC}"
fi

echo ""
echo "💾 STEP 3: Check Redis State"
echo "============================"

echo -e "${BLUE}Redis connection:${NC}"
if docker exec flyos-redis-1 redis-cli ping 2>/dev/null | grep -q "PONG"; then
    echo -e "${GREEN}✅ Redis responding${NC}"
else
    echo -e "${RED}❌ Redis not responding${NC}"
fi

echo ""
echo -e "${BLUE}Redis drone data:${NC}"
drone_keys=$(docker exec flyos-redis-1 redis-cli KEYS "drone:*:state" 2>/dev/null)
if [ -n "$drone_keys" ]; then
    echo "Found drone keys:"
    echo "$drone_keys" | head -5
    
    echo ""
    echo "Sample data from drone-001:"
    docker exec flyos-redis-1 redis-cli GET "drone:drone-001:state" 2>/dev/null | head -3
else
    echo -e "${YELLOW}⚠️  No drone data found in Redis${NC}"
fi

echo ""
echo "🔧 STEP 4: Diagnose Mock Drone Issue"
echo "===================================="

echo -e "${BLUE}Checking drone-connection-service directory:${NC}"
if [ -d "services/drone-connection-service" ]; then
    echo -e "${GREEN}✅ Directory exists${NC}"
    
    echo ""
    echo "Files in directory:"
    ls -la services/drone-connection-service/ | head -10
    
    echo ""
    echo "Package.json scripts:"
    if [ -f "services/drone-connection-service/package.json" ]; then
        grep -A 5 '"scripts"' services/drone-connection-service/package.json
    else
        echo -e "${RED}❌ package.json not found${NC}"
    fi
    
    echo ""
    echo "Mock data script:"
    if [ -f "services/drone-connection-service/src/mockData.ts" ]; then
        echo -e "${GREEN}✅ mockData.ts exists${NC}"
    elif [ -f "services/drone-connection-service/dist/mockData.js" ]; then
        echo -e "${GREEN}✅ compiled mockData.js exists${NC}"
    else
        echo -e "${RED}❌ mockData script not found${NC}"
    fi
    
else
    echo -e "${RED}❌ drone-connection-service directory not found${NC}"
fi

echo ""
echo "🛠️  STEP 5: Attempt to Start Mock Drones"
echo "========================================"

echo -e "${BLUE}Trying to start mock drones...${NC}"

# Check if we're in the right directory
if [ ! -d "services/drone-connection-service" ]; then
    echo -e "${RED}❌ Not in correct directory. Current: $(pwd)${NC}"
    echo "Please run from the flyos root directory"
    exit 1
fi

cd services/drone-connection-service

echo "Current directory: $(pwd)"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  node_modules not found. Installing dependencies...${NC}"
    npm install
fi

# Check if TypeScript is compiled
if [ ! -d "dist" ]; then
    echo -e "${YELLOW}⚠️  dist directory not found. Compiling TypeScript...${NC}"
    npm run build
fi

echo ""
echo "Available npm scripts:"
npm run 2>&1 | grep -E "mock|dev|start" || echo "No relevant scripts found"

echo ""
echo -e "${BLUE}Attempting to start mock drones:${NC}"

# Try different ways to start mock drones
if npm run mock-data --dry-run 2>/dev/null; then
    echo "Starting mock drones with npm run mock-data..."
    nohup npm run mock-data > /tmp/mock-drones.log 2>&1 &
    MOCK_PID=$!
    echo "Started with PID: $MOCK_PID"
elif [ -f "dist/mockData.js" ]; then
    echo "Starting mock drones directly with node..."
    nohup node dist/mockData.js > /tmp/mock-drones.log 2>&1 &
    MOCK_PID=$!
    echo "Started with PID: $MOCK_PID"
elif [ -f "src/mockData.ts" ]; then
    echo "Starting mock drones with ts-node..."
    nohup npx ts-node src/mockData.ts > /tmp/mock-drones.log 2>&1 &
    MOCK_PID=$!
    echo "Started with PID: $MOCK_PID"
else
    echo -e "${RED}❌ Cannot find mock data script${NC}"
    echo "Available files in src/:"
    ls -la src/ 2>/dev/null || echo "src/ directory not found"
    cd ../..
    exit 1
fi

cd ../..

echo ""
echo "⏱️  STEP 6: Wait and Verify"
echo "=========================="

echo "Waiting 10 seconds for drones to connect..."
sleep 10

echo ""
echo -e "${BLUE}Checking if mock drones are now running:${NC}"
if pgrep -f "mock-data" > /dev/null || pgrep -f "mockData" > /dev/null; then
    echo -e "${GREEN}✅ Mock drone processes found${NC}"
    pgrep -f "mock" -l
else
    echo -e "${RED}❌ Mock drone processes not found${NC}"
    echo ""
    echo "Checking log file:"
    if [ -f "/tmp/mock-drones.log" ]; then
        echo "Last 10 lines of mock drone log:"
        tail -10 /tmp/mock-drones.log
    else
        echo "No log file found"
    fi
fi

echo ""
echo -e "${BLUE}Checking drone connection status:${NC}"
status_response=$(curl -s "http://localhost:4005/status" 2>/dev/null)
if [ $? -eq 0 ]; then
    connected_count=$(echo "$status_response" | jq -r '.totalConnected // 0' 2>/dev/null)
    echo "Connected drones: $connected_count"
    
    if [ "$connected_count" -gt 0 ]; then
        echo -e "${GREEN}✅ Drones are connecting!${NC}"
    else
        echo -e "${YELLOW}⚠️  No drones connected yet${NC}"
        echo "Waiting 5 more seconds..."
        sleep 5
        
        status_response=$(curl -s "http://localhost:4005/status" 2>/dev/null)
        connected_count=$(echo "$status_response" | jq -r '.totalConnected // 0' 2>/dev/null)
        echo "Connected drones after wait: $connected_count"
    fi
else
    echo -e "${RED}❌ Cannot get status${NC}"
fi

echo ""
echo -e "${BLUE}Testing data flow after fix:${NC}"
redis_data=$(curl -s "http://localhost:4005/redis/drone-001" 2>/dev/null)
redis_lat=$(echo "$redis_data" | jq -r '.latitude // "null"' 2>/dev/null)

if [ "$redis_lat" != "null" ] && [ "$redis_lat" != "" ]; then
    echo -e "${GREEN}✅ SUCCESS! Data is now flowing${NC}"
    echo "Drone-001 latitude: $redis_lat"
    
    frontend_data=$(curl -s "http://localhost:3001/api/drone-telemetry/drone-001" 2>/dev/null)
    frontend_lat=$(echo "$frontend_data" | jq -r '.latitude // "null"' 2>/dev/null)
    echo "Frontend API latitude: $frontend_lat"
    
    if [ "$redis_lat" = "$frontend_lat" ]; then
        echo -e "${GREEN}🎉 PERFECT! End-to-end data flow working!${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Still no data. Checking potential issues...${NC}"
    
    echo ""
    echo "Potential issues:"
    echo "1. Mock drones may need more time to connect"
    echo "2. Network connectivity issues"
    echo "3. Service configuration problems"
    echo ""
    echo "Manual debugging steps:"
    echo "cd services/drone-connection-service"
    echo "npm run dev  # Try running in development mode"
fi

echo ""
echo "📋 SUMMARY & NEXT STEPS"
echo "======================="

if [ "$redis_lat" != "null" ] && [ "$redis_lat" != "" ]; then
    echo -e "${GREEN}✅ FIXED! Your system is now working${NC}"
    echo ""
    echo "Re-run the data flow verification:"
    echo "./data-flow-verification.sh"
else
    echo -e "${YELLOW}⚠️  NEEDS ATTENTION${NC}"
    echo ""
    echo "Try these steps:"
    echo "1. cd services/drone-connection-service"
    echo "2. npm install  # Ensure dependencies"
    echo "3. npm run build  # Compile TypeScript"
    echo "4. npm run mock-data  # Start in foreground to see errors"
    echo ""
    echo "If that fails, try:"
    echo "docker-compose restart drone-connection-service"
    echo "docker-compose logs drone-connection-service"
fi

echo ""
echo "Log files to check:"
echo "- Mock drones: /tmp/mock-drones.log"
echo "- Service logs: docker-compose logs drone-connection-service"
#!/bin/bash
# Comprehensive debugging for port 4005 issue

echo "🔍 COMPREHENSIVE PORT 4005 DEBUGGING"
echo "===================================="

# 1. Check what's using port 4005
echo "1. Checking port 4005 usage:"
echo "----------------------------"
sudo netstat -tulpn | grep :4005 || echo "   ❌ Port 4005 not found in netstat"
sudo lsof -i :4005 || echo "   ❌ Port 4005 not found in lsof"

echo ""

# 2. Check Docker containers
echo "2. Docker container status:"
echo "---------------------------"
docker ps | grep -E "(4005|drone-connection)" || echo "   ❌ No containers with port 4005"

echo ""

# 3. Check Docker Compose status
echo "3. Docker Compose status:"
echo "-------------------------"
cd ~/flyos 2>/dev/null || { echo "❌ ~/flyos directory not found"; exit 1; }
docker-compose ps | grep drone-connection || echo "   ❌ drone-connection-service not in compose"

echo ""

# 4. Check if service is defined in docker-compose.yml
echo "4. Docker Compose configuration:"
echo "--------------------------------"
grep -A 5 -B 5 "drone-connection-service" docker-compose.yml | head -20

echo ""

# 5. Check service directory and files
echo "5. Service directory check:"
echo "---------------------------"
if [ -d "services/drone-connection-service" ]; then
    echo "   ✅ Service directory exists"
    
    if [ -f "services/drone-connection-service/package.json" ]; then
        echo "   ✅ package.json exists"
        echo "   📋 Scripts:"
        grep -A 5 '"scripts"' services/drone-connection-service/package.json
    else
        echo "   ❌ package.json missing"
    fi
    
    if [ -f "services/drone-connection-service/dist/app.js" ]; then
        echo "   ✅ dist/app.js exists"
    else
        echo "   ❌ dist/app.js missing - need to build"
    fi
else
    echo "   ❌ Service directory missing"
fi

echo ""

# 6. Check for TypeScript build issues
echo "6. TypeScript build check:"
echo "--------------------------"
cd services/drone-connection-service 2>/dev/null || { echo "❌ Cannot cd to service directory"; exit 1; }

if [ -f "tsconfig.json" ]; then
    echo "   ✅ tsconfig.json exists"
else
    echo "   ❌ tsconfig.json missing"
fi

echo ""

# 7. Check Node.js version and npm
echo "7. Node.js environment:"
echo "-----------------------"
node --version
npm --version

echo ""

# 8. Check environment variables
echo "8. Environment variables:"
echo "-------------------------"
echo "   PORT: ${PORT:-'not set'}"
echo "   NODE_ENV: ${NODE_ENV:-'not set'}"
echo "   PWD: $PWD"

echo ""

# 9. Try to find the actual error
echo "9. Build and start diagnosis:"
echo "-----------------------------"

echo "   Step 1: Clean build..."
rm -rf dist/ 2>/dev/null
npm run build 2>&1 | tail -10

if [ $? -eq 0 ]; then
    echo "   ✅ Build successful"
    
    echo "   Step 2: Check if port is actually free..."
    if netstat -tuln | grep :4005 >/dev/null; then
        echo "   ❌ Port 4005 is occupied"
        echo "   🔍 Finding the process:"
        sudo lsof -i :4005
        
        echo ""
        echo "   💡 SOLUTION OPTIONS:"
        echo "   A) Kill the process: sudo kill -9 \$(sudo lsof -t -i:4005)"
        echo "   B) Stop Docker: docker-compose down"
        echo "   C) Use different port: PORT=4006 npm start"
        
    else
        echo "   ✅ Port 4005 is free"
        echo "   🚀 Attempting to start service..."
        
        # Try to start with timeout
        timeout 10s npm start &
        START_PID=$!
        sleep 3
        
        if kill -0 $START_PID 2>/dev/null; then
            echo "   ✅ Service started successfully!"
            kill $START_PID 2>/dev/null
        else
            echo "   ❌ Service failed to start"
            echo "   📋 Last few lines of error:"
            wait $START_PID
        fi
    fi
else
    echo "   ❌ Build failed"
    echo "   📋 Build errors:"
    npm run build
fi

echo ""

# 10. Python mock client check
echo "10. Python mock client setup:"
echo "-----------------------------"
if [ -d "src/clients/python-mock" ]; then
    echo "   ✅ Python mock directory exists"
    cd src/clients/python-mock
    
    if [ -f "run_simulation.sh" ]; then
        echo "   ✅ run_simulation.sh exists"
        ls -la run_simulation.sh
    else
        echo "   ❌ run_simulation.sh missing"
    fi
    
    if [ -f "requirements.txt" ]; then
        echo "   ✅ requirements.txt exists"
    else
        echo "   ❌ requirements.txt missing"
    fi
else
    echo "   ❌ Python mock directory missing"
fi

echo ""
echo "🎯 SUMMARY & RECOMMENDATIONS:"
echo "============================="

# Check Docker status
if docker-compose ps | grep -q drone-connection; then
    echo "   🔴 Docker container is running - this is likely the issue"
    echo "   💡 Run: docker-compose down"
else
    echo "   🟢 No Docker containers detected"
fi

# Check port
if netstat -tuln | grep -q :4005; then
    echo "   🔴 Port 4005 is occupied"
    echo "   💡 Run: sudo kill -9 \$(sudo lsof -t -i:4005)"
else
    echo "   🟢 Port 4005 is free"
fi

echo ""
echo "   📋 RECOMMENDED FIX SEQUENCE:"
echo "   1. docker-compose down"
echo "   2. cd services/drone-connection-service"
echo "   3. npm run build"
echo "   4. npm start"
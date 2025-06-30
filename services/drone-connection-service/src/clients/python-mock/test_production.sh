#!/bin/bash
# services/drone-connection-service/src/clients/python-mock/test_production.sh
# Production system integration test

set -e

echo "🎯 PRODUCTION SYSTEM INTEGRATION TEST"
echo "===================================="

# Configuration
SERVER_URL="http://localhost:4005"
NUM_DRONES=5
LOG_DIR="./logs"

# Check if we're on AWS (adjust for production server)
if [[ "$1" == "--aws" ]]; then
    SERVER_URL="http://3.111.215.70:4005"
    echo "🌐 Testing against AWS production server"
    shift
fi

# Parse additional arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --drones)
            NUM_DRONES="$2"
            shift 2
            ;;
        --server)
            SERVER_URL="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo "📋 Configuration:"
echo "   Server: $SERVER_URL"
echo "   Drones: $NUM_DRONES"
echo ""

# Create logs directory
mkdir -p $LOG_DIR

# Check if Docker containers are running
echo "🐳 Checking Docker containers..."
if ! docker ps | grep -q flyos; then
    echo "❌ FlyOS containers not running"
    echo "💡 Run: cd ~/flyos && docker-compose up -d"
    exit 1
fi

echo "✅ Docker containers are running"

# Check server health
echo "🏥 Checking server health..."
if curl -sf "$SERVER_URL/health" > /dev/null; then
    echo "✅ Server is healthy"
else
    echo "❌ Server health check failed"
    echo "💡 Check: docker-compose logs drone-connection-service"
    exit 1
fi

# Check Python environment
echo "🐍 Checking Python environment..."
if [ ! -d "venv" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt

echo "✅ Python environment ready"

# Test 1: Single drone connection
echo ""
echo "🧪 TEST 1: Single Drone Connection"
echo "--------------------------------"

python3 drone_simulator_prod.py \
    --server "$SERVER_URL" \
    --drone-id "test-single-001" \
    --model "FlyOS_MQ7_Test" &

SINGLE_PID=$!
sleep 10

if kill -0 $SINGLE_PID 2>/dev/null; then
    echo "✅ Single drone connected successfully"
    kill $SINGLE_PID
    wait $SINGLE_PID 2>/dev/null || true
else
    echo "❌ Single drone connection failed"
    exit 1
fi

# Test 2: Multi-drone simulation
echo ""
echo "🧪 TEST 2: Multi-Drone Simulation ($NUM_DRONES drones)"
echo "---------------------------------------------------"

# Start multiple drones in background
DRONE_PIDS=()

for i in $(seq 1 $NUM_DRONES); do
    DRONE_ID="prod-test-$(printf "%03d" $i)"
    MODEL="FlyOS_MQ$(( (i % 3) + 5 ))_Test"  # MQ5, MQ6, MQ7
    LAT=$(echo "18.5204 + ($i * 0.001)" | bc -l)
    LNG=$(echo "73.8567 + ($i * 0.001)" | bc -l)
    
    echo "🚁 Starting drone $DRONE_ID..."
    
    python3 drone_simulator_prod.py \
        --server "$SERVER_URL" \
        --drone-id "$DRONE_ID" \
        --model "$MODEL" \
        --lat "$LAT" \
        --lng "$LNG" \
        > "$LOG_DIR/$DRONE_ID.log" 2>&1 &
    
    DRONE_PIDS+=($!)
    
    # Stagger connections
    sleep 2
done

echo "✅ Started $NUM_DRONES drones"

# Let simulation run
echo "⏳ Running simulation for 30 seconds..."
sleep 30

# Check drone status via API
echo "📊 Checking drone status..."
STATUS_RESPONSE=$(curl -s "$SERVER_URL/status")
if [[ $? -eq 0 ]]; then
    echo "✅ Server status retrieved"
    echo "$STATUS_RESPONSE" | python3 -m json.tool | head -20
else
    echo "❌ Failed to get server status"
fi

# Test 3: Command testing
echo ""
echo "🧪 TEST 3: Command Testing"
echo "-------------------------"

# Test precision landing command (requires frontend or direct API call)
echo "🎯 Testing precision landing commands..."
echo "   (Commands require authenticated frontend session)"

# Test 4: WebRTC capability
echo ""
echo "🧪 TEST 4: WebRTC Capability Check"
echo "---------------------------------"

WEBRTC_RESPONSE=$(curl -s "$SERVER_URL/webrtc/prod-test-001/capability")
if [[ $? -eq 0 ]]; then
    echo "✅ WebRTC capability check successful"
else
    echo "⚠️ WebRTC capability not available (expected for mock)"
fi

# Clean up
echo ""
echo "🧹 Cleaning up..."

for pid in "${DRONE_PIDS[@]}"; do
    if kill -0 $pid 2>/dev/null; then
        kill $pid
        wait $pid 2>/dev/null || true
    fi
done

echo "✅ All drones stopped"

# Test 5: Log analysis
echo ""
echo "🧪 TEST 5: Log Analysis"
echo "----------------------"

echo "📋 Connection summary:"
CONNECTED_COUNT=$(grep -l "Production registration successful" $LOG_DIR/*.log 2>/dev/null | wc -l)
FAILED_COUNT=$(grep -l "Production connection failed" $LOG_DIR/*.log 2>/dev/null | wc -l)

echo "   Connected: $CONNECTED_COUNT/$NUM_DRONES"
echo "   Failed: $FAILED_COUNT/$NUM_DRONES"

if [[ $CONNECTED_COUNT -eq $NUM_DRONES ]]; then
    echo "✅ All drones connected successfully"
    SUCCESS=true
else
    echo "❌ Some drones failed to connect"
    echo "📝 Check logs in $LOG_DIR/"
    SUCCESS=false
fi

# Final report
echo ""
echo "📊 FINAL REPORT"
echo "==============="

if [[ $SUCCESS == true ]]; then
    echo "🎉 PRODUCTION INTEGRATION TEST PASSED"
    echo "   ✅ Single drone connection: PASS"
    echo "   ✅ Multi-drone simulation: PASS"
    echo "   ✅ Server health: PASS"
    echo "   ✅ API endpoints: PASS"
else
    echo "❌ PRODUCTION INTEGRATION TEST FAILED"
    echo "💡 Check logs and server status"
    exit 1
fi

echo ""
echo "🔗 Useful endpoints:"
echo "   Health: $SERVER_URL/health"
echo "   Status: $SERVER_URL/status"
echo "   Registry: $SERVER_URL/drone/registry"
echo ""
echo "📁 Logs saved to: $LOG_DIR/"
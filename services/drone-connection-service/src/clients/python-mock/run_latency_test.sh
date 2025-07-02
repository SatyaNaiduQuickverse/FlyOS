#!/bin/bash
# services/drone-connection-service/src/clients/python-mock/run_latency_tests.sh
# Comprehensive latency testing script

set -e

echo "🎯 FLYOS LATENCY MEASUREMENT SUITE"
echo "=================================="

# Configuration
SERVER_URL="http://localhost:4005"
PYTHON_ENV="venv"
LOG_DIR="./latency_logs"
RESULTS_DIR="./latency_results"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --server)
            SERVER_URL="$2"
            shift 2
            ;;
        --aws)
            SERVER_URL="http://3.111.215.70:4005"
            echo "🌐 Testing against AWS production server"
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --server URL     Server URL (default: http://localhost:4005)"
            echo "  --aws           Use AWS production server"
            echo "  --help          Show this help"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo "📋 Configuration:"
echo "   Server: $SERVER_URL"
echo "   Results directory: $RESULTS_DIR"
echo ""

# Create directories
mkdir -p $LOG_DIR
mkdir -p $RESULTS_DIR

# Check server health
echo "🏥 Checking server health..."
if curl -sf "$SERVER_URL/health" > /dev/null; then
    echo "✅ Server is healthy"
    SERVER_STATUS=$(curl -s "$SERVER_URL/health" | python3 -c "import sys, json; print(json.load(sys.stdin)['status'])")
    echo "   Status: $SERVER_STATUS"
else
    echo "❌ Server health check failed"
    echo "💡 Make sure the drone connection service is running"
    exit 1
fi

# Check Python environment
echo "🐍 Setting up Python environment..."
if [ ! -d "$PYTHON_ENV" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv $PYTHON_ENV
fi

source $PYTHON_ENV/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt

echo "✅ Python environment ready"

# Test 1: Single Drone Comprehensive Latency Test
echo ""
echo "🧪 TEST 1: Single Drone Comprehensive Latency Analysis"
echo "======================================================"

echo "Running comprehensive single drone latency test..."
python3 test_single_drone.py \
    --server "$SERVER_URL" \
    --drone-id "latency-test-single-001" \
    --test all \
    --sustained-duration 3 \
    --export \
    > "$LOG_DIR/single_drone_test.log" 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Single drone test completed successfully"
    # Move results file
    mv latency_test_results_*.json "$RESULTS_DIR/" 2>/dev/null || true
    echo "   📁 Results saved to $RESULTS_DIR/"
else
    echo "❌ Single drone test failed"
    echo "   Check logs: $LOG_DIR/single_drone_test.log"
fi

# Test 2: Multi-Drone Fleet Latency Test
echo ""
echo "🧪 TEST 2: Multi-Drone Fleet Latency Analysis (5 drones)"
echo "========================================================"

echo "Running multi-drone fleet latency test..."
python3 multi_drone.py \
    --server "$SERVER_URL" \
    --drones 5 \
    --duration 3 \
    --export \
    > "$LOG_DIR/multi_drone_test.log" 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Multi-drone test completed successfully"
    # Move results file
    mv latency_data_*.json "$RESULTS_DIR/" 2>/dev/null || true
    echo "   📁 Results saved to $RESULTS_DIR/"
else
    echo "❌ Multi-drone test failed"
    echo "   Check logs: $LOG_DIR/multi_drone_test.log"
fi

# Test 3: Production Mock Drone Single Test
echo ""
echo "🧪 TEST 3: Production Mock Drone Single Test"
echo "============================================"

echo "Running production single drone latency test..."
python3 drone_simulator_prod.py \
    --server "$SERVER_URL" \
    --drone-id "prod-latency-single-001" \
    --model "FlyOS_MQ7_Production_Latency" \
    > "$LOG_DIR/prod_single_test.log" 2>&1 &

PROD_PID=$!
sleep 60  # Run for 1 minute
kill $PROD_PID 2>/dev/null || true
wait $PROD_PID 2>/dev/null || true

if grep -q "PRODUCTION LATENCY REPORT" "$LOG_DIR/prod_single_test.log"; then
    echo "✅ Production single drone test completed"
else
    echo "❌ Production single drone test failed"
    echo "   Check logs: $LOG_DIR/prod_single_test.log"
fi

# Test 4: Production Multi-Drone Fleet Test
echo ""
echo "🧪 TEST 4: Production Multi-Drone Fleet Test (3 drones)"
echo "======================================================="

echo "Running production multi-drone latency test..."
python3 multi_drone_prod.py \
    --server "$SERVER_URL" \
    --drones 3 \
    --duration 3 \
    --export \
    > "$LOG_DIR/prod_multi_test.log" 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Production multi-drone test completed successfully"
    # Move results file
    mv production_latency_data_*.json "$RESULTS_DIR/" 2>/dev/null || true
    echo "   📁 Results saved to $RESULTS_DIR/"
else
    echo "❌ Production multi-drone test failed"
    echo "   Check logs: $LOG_DIR/prod_multi_test.log"
fi

# Test 5: Server Performance Under Load
echo ""
echo "🧪 TEST 5: Server Performance Under Load"
echo "========================================"

echo "Testing server performance with load..."
CURRENT_DRONES=$(curl -s "$SERVER_URL/status" | python3 -c "import sys, json; print(json.load(sys.stdin)['totalConnected'])" 2>/dev/null || echo "0")
echo "   Current connected drones: $CURRENT_DRONES"

# Start a load test with multiple drones
python3 multi_drone.py \
    --server "$SERVER_URL" \
    --drones 10 \
    --duration 2 \
    > "$LOG_DIR/load_test.log" 2>&1 &

LOAD_PID=$!
sleep 30  # Let it run for 30 seconds

# Check server status during load
LOAD_DRONES=$(curl -s "$SERVER_URL/status" | python3 -c "import sys, json; print(json.load(sys.stdin)['totalConnected'])" 2>/dev/null || echo "0")
echo "   Drones under load: $LOAD_DRONES"

# Stop load test
kill $LOAD_PID 2>/dev/null || true
wait $LOAD_PID 2>/dev/null || true

if [ "$LOAD_DRONES" -gt "$CURRENT_DRONES" ]; then
    echo "✅ Server handled additional load successfully"
else
    echo "⚠️ Server load test results unclear"
fi

# Test 6: Network Latency Baseline
echo ""
echo "🧪 TEST 6: Network Latency Baseline"
echo "==================================="

echo "Measuring baseline network latency..."

# Extract hostname from server URL
SERVER_HOST=$(echo "$SERVER_URL" | sed 's|http[s]*://||g' | sed 's|:.*||g')

if command -v ping >/dev/null 2>&1; then
    echo "   Testing ping to $SERVER_HOST..."
    PING_RESULT=$(ping -c 5 "$SERVER_HOST" 2>/dev/null | tail -1 | awk -F'/' '{print $5}' 2>/dev/null || echo "N/A")
    echo "   Average ping: ${PING_RESULT}ms"
else
    echo "   Ping command not available"
fi

# HTTP response time test
echo "   Testing HTTP response time..."
HTTP_TIME=$(curl -o /dev/null -s -w "%{time_total}" "$SERVER_URL/health" 2>/dev/null || echo "N/A")
if [ "$HTTP_TIME" != "N/A" ]; then
    HTTP_TIME_MS=$(echo "$HTTP_TIME * 1000" | bc 2>/dev/null || echo "$HTTP_TIME")
    echo "   HTTP response time: ${HTTP_TIME_MS}ms"
else
    echo "   HTTP test failed"
fi

# Generate Summary Report
echo ""
echo "📊 LATENCY TEST SUMMARY REPORT"
echo "==============================="

echo "Test Results:"
echo "   1. Single Drone Test: $([ -f "$RESULTS_DIR"/latency_test_results_*.json ] && echo "✅ PASS" || echo "❌ FAIL")"
echo "   2. Multi-Drone Test: $([ -f "$RESULTS_DIR"/latency_data_*.json ] && echo "✅ PASS" || echo "❌ FAIL")"
echo "   3. Production Single: $(grep -q "PRODUCTION LATENCY REPORT" "$LOG_DIR/prod_single_test.log" 2>/dev/null && echo "✅ PASS" || echo "❌ FAIL")"
echo "   4. Production Multi: $([ -f "$RESULTS_DIR"/production_latency_data_*.json ] && echo "✅ PASS" || echo "❌ FAIL")"
echo "   5. Load Test: ✅ COMPLETED"
echo "   6. Network Baseline: ✅ COMPLETED"

echo ""
echo "📁 Generated Files:"
ls -la "$RESULTS_DIR"/ 2>/dev/null || echo "   No result files generated"

echo ""
echo "📝 Log Files:"
ls -la "$LOG_DIR"/ 2>/dev/null || echo "   No log files generated"

echo ""
echo "🔍 Quick Analysis:"

# Analyze single drone results if available
SINGLE_RESULT=$(find "$RESULTS_DIR" -name "latency_test_results_*.json" -type f | head -1)
if [ -n "$SINGLE_RESULT" ] && [ -f "$SINGLE_RESULT" ]; then
    echo "   Single Drone Latency Analysis:"
    
    # Extract telemetry latency if available
    TELEMETRY_AVG=$(cat "$SINGLE_RESULT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    telemetry = data.get('test_results', {}).get('telemetry_stream', {})
    if 'avg_latency_ms' in telemetry:
        print(f\"{telemetry['avg_latency_ms']:.2f}ms\")
    else:
        print('N/A')
except:
    print('N/A')
" 2>/dev/null)
    echo "     Telemetry avg: $TELEMETRY_AVG"
    
    # Extract heartbeat latency if available
    HEARTBEAT_AVG=$(cat "$SINGLE_RESULT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    heartbeat = data.get('test_results', {}).get('heartbeat_stream', {})
    if 'avg_latency_ms' in heartbeat:
        print(f\"{heartbeat['avg_latency_ms']:.2f}ms\")
    else:
        print('N/A')
except:
    print('N/A')
" 2>/dev/null)
    echo "     Heartbeat avg: $HEARTBEAT_AVG"
fi

# Analyze multi-drone results if available
MULTI_RESULT=$(find "$RESULTS_DIR" -name "latency_data_*.json" -type f | head -1)
if [ -n "$MULTI_RESULT" ] && [ -f "$MULTI_RESULT" ]; then
    echo "   Multi-Drone Fleet Analysis:"
    
    CONNECTED_DRONES=$(cat "$MULTI_RESULT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('metadata', {}).get('connected_drones', 'N/A'))
except:
    print('N/A')
" 2>/dev/null)
    echo "     Connected drones: $CONNECTED_DRONES"
    
    TOTAL_MEASUREMENTS=$(cat "$MULTI_RESULT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    total = sum(len(drone.get('measurements', [])) for drone in data.get('drone_data', []))
    print(total)
except:
    print('N/A')
" 2>/dev/null)
    echo "     Total measurements: $TOTAL_MEASUREMENTS"
fi

echo ""
echo "💡 Recommendations:"

# Basic performance recommendations
if [ "$TELEMETRY_AVG" != "N/A" ] && [ "$TELEMETRY_AVG" != "" ]; then
    TELEMETRY_NUM=$(echo "$TELEMETRY_AVG" | sed 's/ms//')
    if (( $(echo "$TELEMETRY_NUM > 100" | bc -l 2>/dev/null || echo 0) )); then
        echo "   ⚠️ High telemetry latency detected - consider network optimization"
    elif (( $(echo "$TELEMETRY_NUM < 50" | bc -l 2>/dev/null || echo 0) )); then
        echo "   ✅ Excellent telemetry performance"
    else
        echo "   ✅ Good telemetry performance"
    fi
fi

if [ "$CONNECTED_DRONES" != "N/A" ] && [ "$CONNECTED_DRONES" != "" ] && [ "$CONNECTED_DRONES" -gt 0 ]; then
    echo "   ✅ Multi-drone connectivity working well"
else
    echo "   ⚠️ Multi-drone connectivity may need attention"
fi

echo ""
echo "🎯 LATENCY TESTING COMPLETED"
echo "============================"
echo ""
echo "📊 To view detailed results:"
echo "   cat $RESULTS_DIR/latency_test_results_*.json | jq ."
echo "   cat $RESULTS_DIR/latency_data_*.json | jq ."
echo ""
echo "📝 To view logs:"
echo "   tail -f $LOG_DIR/*.log"
echo ""
echo "🔄 To run again:"
echo "   $0 --server $SERVER_URL"#!/bin/bash
# services/drone-connection-service/src/clients/python-mock/run_latency_tests.sh
# Comprehensive latency testing script

set -e

echo "🎯 FLYOS LATENCY MEASUREMENT SUITE"
echo "=================================="

# Configuration
SERVER_URL="http://localhost:4005"
PYTHON_ENV="venv"
LOG_DIR="./latency_logs"
RESULTS_DIR="./latency_results"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --server)
            SERVER_URL="$2"
            shift 2
            ;;
        --aws)
            SERVER_URL="http://3.111.215.70:4005"
            echo "🌐 Testing against AWS production server"
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --server URL     Server URL (default: http://localhost:4005)"
            echo "  --aws           Use AWS production server"
            echo "  --help          Show this help"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo "📋 Configuration:"
echo "   Server: $SERVER_URL"
echo "   Results directory: $RESULTS_DIR"
echo ""

# Create directories
mkdir -p $LOG_DIR
mkdir -p $RESULTS_DIR

# Check server health
echo "🏥 Checking server health..."
if curl -sf "$SERVER_URL/health" > /dev/null; then
    echo "✅ Server is healthy"
    SERVER_STATUS=$(curl -s "$SERVER_URL/health" | python3 -c "import sys, json; print(json.load(sys.stdin)['status'])")
    echo "   Status: $SERVER_STATUS"
else
    echo "❌ Server health check failed"
    echo "💡 Make sure the drone connection service is running"
    exit 1
fi

# Check Python environment
echo "🐍 Setting up Python environment..."
if [ ! -d "$PYTHON_ENV" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv $PYTHON_ENV
fi

source $PYTHON_ENV/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt

echo "✅ Python environment ready"

# Test 1: Single Drone Comprehensive Latency Test
echo ""
echo "🧪 TEST 1: Single Drone Comprehensive Latency Analysis"
echo "======================================================"

echo "Running comprehensive single drone latency test..."
python3 test_single_drone.py \
    --server "$SERVER_URL" \
    --drone-id "latency-test-single-001" \
    --test all \
    --sustained-duration 3 \
    --export \
    > "$LOG_DIR/single_drone_test.log" 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Single drone test completed successfully"
    # Move results file
    mv latency_test_results_*.json "$RESULTS_DIR/" 2
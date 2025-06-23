#!/bin/bash
# services/drone-connection-service/src/clients/python-mock/run_simulation.sh

set -e

echo "🚁 FlyOS Real Drone Connection Simulator"
echo "========================================"

# Default values
SERVER_URL="http://localhost:4005"
NUM_DRONES=5
MODE="normal"
LOG_LEVEL="INFO"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --server)
            SERVER_URL="$2"
            shift 2
            ;;
        --drones)
            NUM_DRONES="$2"
            shift 2
            ;;
        --mode)
            MODE="$2"
            shift 2
            ;;
        --log-level)
            LOG_LEVEL="$2"
            shift 2
            ;;
        --aws)
            SERVER_URL="http://3.111.215.70:4005"
            echo "🌐 Using AWS server: $SERVER_URL"
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --server URL       Server URL (default: http://localhost:4005)"
            echo "  --drones N         Number of drones (default: 5)"
            echo "  --mode MODE        Simulation mode: normal|stress (default: normal)"
            echo "  --log-level LEVEL  Log level: DEBUG|INFO|WARNING|ERROR (default: INFO)"
            echo "  --aws              Use AWS server (3.111.215.70:4005)"
            echo "  --help             Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                                    # Run 5 drones locally"
            echo "  $0 --aws --drones 10                 # Run 10 drones on AWS"
            echo "  $0 --mode stress --drones 20         # Stress test with 20 drones"
            exit 0
            ;;
        *)
            echo "❌ Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install/upgrade requirements
echo "📚 Installing/updating dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Validate server connectivity
echo "🔍 Testing server connectivity..."
if curl -s --max-time 5 "$SERVER_URL/health" > /dev/null; then
    echo "✅ Server is reachable at $SERVER_URL"
else
    echo "❌ Cannot reach server at $SERVER_URL"
    echo "   Make sure the drone-connection-service is running"
    exit 1
fi

# Display configuration
echo ""
echo "📋 Configuration:"
echo "   Server URL: $SERVER_URL"
echo "   Number of drones: $NUM_DRONES"
echo "   Mode: $MODE"
echo "   Log level: $LOG_LEVEL"
echo ""

# Warn for high drone counts
if [ "$NUM_DRONES" -gt 20 ]; then
    echo "⚠️  WARNING: $NUM_DRONES drones is quite a lot!"
    echo "   This might overwhelm the server or your network."
    read -p "   Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "🛑 Simulation cancelled"
        exit 0
    fi
fi

# Run the simulation
echo "🚀 Starting simulation..."
echo "   Press Ctrl+C to stop"
echo ""

python3 multi_drone.py \
    --server "$SERVER_URL" \
    --drones "$NUM_DRONES" \
    --mode "$MODE" \
    --log-level "$LOG_LEVEL"

echo ""
echo "✅ Simulation completed"
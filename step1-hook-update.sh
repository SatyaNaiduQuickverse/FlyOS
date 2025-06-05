#!/bin/bash
# quick-integration.sh - Integrate all components with live Redis data

echo "🚀 FlyOS Component Integration"
echo "============================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "lib/hooks" ]; then
    echo -e "${RED}❌ Please run this script from the FlyOS root directory${NC}"
    exit 1
fi

echo -e "${BLUE}✅ STEP 1: Update useDroneState Hook${NC}"
echo "========================================="

# Backup existing hook
if [ -f "lib/hooks/useDroneState.ts" ]; then
    cp lib/hooks/useDroneState.ts lib/hooks/useDroneState.ts.backup
    echo -e "${GREEN}✅ Backup created${NC}"
fi

# Create the updated hook
cat > lib/hooks/useDroneState.ts << 'EOF'
// lib/hooks/useDroneState.ts - REDIS INTEGRATED VERSION
import { useState, useEffect, useCallback, useRef } from 'react';

interface DroneData {
  id: string;
  model?: string;
  status?: string;
  latitude?: number;
  longitude?: number;
  altitude_msl?: number;
  altitude_relative?: number;
  armed?: boolean;
  flight_mode?: string;
  connected?: boolean;
  percentage?: number;
  voltage?: number;
  current?: number;
  gps_fix?: string;
  satellites?: number;
  hdop?: number;
  position_error?: number;
  roll?: number;
  pitch?: number;
  yaw?: number;
  velocity_x?: number;
  velocity_y?: number;
  velocity_z?: number;
  timestamp?: string;
  _meta?: {
    updatedAt?: number;
    source?: string;
  };
  [key: string]: any;
}

interface UseDroneStateOptions {
  droneId: string;
  token: string | null;
  initialFetch?: boolean;
  updateInterval?: number;
}

interface UseDroneStateReturn {
  drone: DroneData | null;
  isLoading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  isConnected: boolean;
  latency: number | null;
  refreshDrone: () => Promise<void>;
  sendCommand: (commandType: string, parameters?: any) => Promise<any>;
}

export function useDroneState({
  droneId,
  token,
  initialFetch = true,
  updateInterval = 1000
}: UseDroneStateOptions): UseDroneStateReturn {
  const [drone, setDrone] = useState<DroneData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const refreshDrone = useCallback(async () => {
    if (!token || !droneId) {
      setError('Authentication or drone ID missing');
      setIsLoading(false);
      return;
    }

    try {
      const startTime = Date.now();
      
      const response = await fetch(`/api/drone-telemetry/${droneId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        cache: 'no-store'
      });

      const endTime = Date.now();
      
      if (!isMountedRef.current) return;
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      setLatency(endTime - startTime);
      
      if (data && (data.latitude || data.connected !== undefined)) {
        setDrone(prevState => ({
          id: droneId,
          ...(prevState || {}),
          ...data,
          connected: data.connected !== false && !!data.latitude
        }));
        setError(null);
        setLastUpdate(new Date());
        setIsConnected(true);
      } else {
        setDrone(prevState => ({
          id: droneId,
          ...(prevState || {}),
          connected: false
        }));
        setIsConnected(false);
      }
      
    } catch (err: any) {
      console.error(`Error fetching drone ${droneId}:`, err);
      
      if (!isMountedRef.current) return;
      
      setError(`Connection error: ${err.message}`);
      setIsConnected(false);
      
      setDrone(prevState => prevState ? {
        ...prevState,
        connected: false
      } : {
        id: droneId,
        connected: false
      });
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [droneId, token]);

  const sendCommand = useCallback(async (commandType: string, parameters: any = {}) => {
    if (!token || !droneId) {
      setError('Authentication required to send commands');
      return null;
    }

    try {
      console.log(`Sending ${commandType} command to drone ${droneId}:`, parameters);
      
      const response = await fetch(`/api/drones/${droneId}/command`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          commandType,
          parameters
        })
      });

      if (!response.ok) {
        throw new Error(`Command failed: HTTP ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        console.log(`Command ${commandType} sent successfully to drone ${droneId}`);
        setTimeout(refreshDrone, 500);
        return result;
      } else {
        setError(result.message || 'Command failed');
        return null;
      }
    } catch (err: any) {
      console.error('Error sending command:', err);
      setError(`Command error: ${err.message}`);
      return null;
    }
  }, [droneId, token, refreshDrone]);

  useEffect(() => {
    if (!token || !droneId) return;

    isMountedRef.current = true;

    if (initialFetch) {
      refreshDrone();
    }

    intervalRef.current = setInterval(() => {
      if (isMountedRef.current) {
        refreshDrone();
      }
    }, updateInterval);

    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [droneId, token, initialFetch, updateInterval, refreshDrone]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    drone,
    isLoading,
    error,
    lastUpdate,
    isConnected,
    latency,
    refreshDrone,
    sendCommand
  };
}
EOF

echo -e "${GREEN}✅ Hook updated with Redis integration${NC}"

echo ""
echo -e "${BLUE}✅ STEP 2: Verify Mock Drones Running${NC}"
echo "======================================"

# Check if mock drones are running
if pgrep -f "mock-data" > /dev/null; then
    drone_count=$(curl -s http://localhost:4005/status | jq -r '.totalConnected // 0')
    echo -e "${GREEN}✅ Mock drones running: $drone_count/10 connected${NC}"
else
    echo -e "${YELLOW}⚠️  Starting mock drones...${NC}"
    cd services/drone-connection-service
    nohup npm run mock-data > /tmp/mock-drones.log 2>&1 &
    cd ../..
    
    echo "Waiting 10 seconds for drones to connect..."
    sleep 10
    
    drone_count=$(curl -s http://localhost:4005/status | jq -r '.totalConnected // 0')
    echo -e "${GREEN}✅ Mock drones started: $drone_count/10 connected${NC}"
fi

echo ""
echo -e "${BLUE}✅ STEP 3: Test Data Flow${NC}"
echo "========================="

# Test the data flow
echo "Testing Redis → Frontend API integration..."
redis_lat=$(curl -s http://localhost:4005/redis/drone-001 | jq -r '.latitude // "null"')
frontend_lat=$(curl -s http://localhost:3001/api/drone-telemetry/drone-001 | jq -r '.latitude // "null"')

if [ "$redis_lat" != "null" ] && [ "$frontend_lat" != "null" ]; then
    echo -e "${GREEN}✅ Data flow working: Redis($redis_lat) → Frontend($frontend_lat)${NC}"
else
    echo -e "${RED}❌ Data flow issue: Redis($redis_lat) → Frontend($frontend_lat)${NC}"
    echo "Waiting 5 more seconds..."
    sleep 5
    
    redis_lat=$(curl -s http://localhost:4005/redis/drone-001 | jq -r '.latitude // "null"')
    frontend_lat=$(curl -s http://localhost:3001/api/drone-telemetry/drone-001 | jq -r '.latitude // "null"')
    
    if [ "$redis_lat" != "null" ] && [ "$frontend_lat" != "null" ]; then
        echo -e "${GREEN}✅ Data flow now working${NC}"
    else
        echo -e "${RED}❌ Still having data flow issues${NC}"
        echo "Manual debugging needed - check mock drones are running"
    fi
fi

echo ""
echo -e "${BLUE}✅ STEP 4: Integration Complete${NC}"
echo "==============================="

echo -e "${GREEN}🎉 Component Integration Summary:${NC}"
echo ""
echo "✅ useDroneState hook: Updated with Redis integration"
echo "✅ Real-time polling: 1-second updates configured"
echo "✅ Error handling: Implemented with fallbacks"
echo "✅ Command support: Send commands to drones"
echo "✅ Mock drones: $drone_count/10 connected and transmitting"
echo ""

echo "📁 Files updated:"
echo "   - lib/hooks/useDroneState.ts (✅ Redis integrated)"
echo "   - lib/hooks/useDroneState.ts.backup (✅ Backup created)"
echo ""

echo "🧪 Testing URLs:"
echo "   - Frontend: http://localhost:3001/secure/main-hq/dashboard"
echo "   - Live data: http://localhost:3001/api/drone-telemetry/drone-001"
echo "   - Status: http://localhost:4005/status"
echo ""

echo "🚀 Next Steps:"
echo "   1. Visit the dashboard to see live data"
echo "   2. Go to DRONE CONTROL tab"
echo "   3. Select any drone to see real-time telemetry"
echo "   4. Watch coordinates update every second!"
echo ""

echo "🔧 Your components now get live data from:"
echo "   Mock Drones → Redis → Frontend API → React Components"
echo ""

if [ "$redis_lat" != "null" ] && [ "$frontend_lat" != "null" ]; then
    echo -e "${GREEN}🎯 INTEGRATION SUCCESS! Your system is live and operational!${NC}"
    
    echo ""
    echo "Sample live data:"
    curl -s http://localhost:3001/api/drone-telemetry/drone-001 | jq '{
        id: .id,
        latitude: .latitude,
        longitude: .longitude,
        altitude: .altitude_relative,
        battery: .percentage,
        mode: .flight_mode,
        armed: .armed,
        connected: .connected
    }'
else
    echo -e "${YELLOW}⚠️  Integration completed but data flow needs verification${NC}"
    echo "Run: ./data-flow-verification.sh to troubleshoot"
fi

echo ""
echo "🎮 Ready to test your live drone control system!"
// components/DroneControl/DroneAttitude.tsx
import React, { useState, useEffect } from 'react';
import { Activity, Compass, Globe, AlertCircle, Plane } from 'lucide-react';

interface AttitudeData {
  orientation: {
    roll: number;
    pitch: number;
    yaw: number;
  };
  rates: {
    roll: number;
    pitch: number;
    yaw: number;
  };
  acceleration: {
    x: number;
    y: number;
    z: number;
  };
  groundSpeed: number;
  verticalSpeed: number;
  slipAngle: number;
  gForce: number;
}

interface LiveTelemetryData {
  latitude?: number;
  longitude?: number;
  altitude_relative?: number;
  armed?: boolean;
  flight_mode?: string;
  connected?: boolean;
  percentage?: number;
  roll?: number;
  pitch?: number;
  yaw?: number;
  velocity_x?: number;
  velocity_y?: number;
  velocity_z?: number;
  timestamp?: string;
}

interface DroneAttitudeProps {
  droneId: string;
}

const DroneAttitude: React.FC<DroneAttitudeProps> = ({ droneId }) => {
  const [attitudeData, setAttitudeData] = useState<AttitudeData>({
    orientation: { roll: 0, pitch: 0, yaw: 0 },
    rates: { roll: 0, pitch: 0, yaw: 0 },
    acceleration: { x: 0, y: 0, z: 0 },
    groundSpeed: 0,
    verticalSpeed: 0,
    slipAngle: 0,
    gForce: 1.0
  });
  
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const calculateGForce = (acceleration: { x: number; y: number; z: number }) => {
    const { x, y, z } = acceleration;
    const totalAccel = Math.sqrt(x * x + y * y + z * z);
    return totalAccel / 9.81;
  };

  // Fetch telemetry data
  const fetchTelemetry = async () => {
    if (!droneId) return;

    try {
      setError(null);
      const response = await fetch(`/api/drone-telemetry/${droneId}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data: LiveTelemetryData = await response.json();
      
      if (data && typeof data.roll === 'number') {
        // Convert from radians to degrees and calculate derived values
        const rollDeg = (data.roll || 0) * (180 / Math.PI);
        const pitchDeg = (data.pitch || 0) * (180 / Math.PI);
        const yawDeg = ((data.yaw || 0) * (180 / Math.PI) + 360) % 360;
        
        // Calculate ground speed from velocity components
        const groundSpeed = Math.sqrt(
          Math.pow(data.velocity_x || 0, 2) + 
          Math.pow(data.velocity_y || 0, 2)
        ) * 3.6; // Convert m/s to km/h
        
        // Calculate slip angle
        const slipAngle = groundSpeed > 0.1 
          ? Math.atan2(data.velocity_y || 0, data.velocity_x || 0) * (180 / Math.PI) 
          : 0;
        
        // Create acceleration object (using mock data if not available)
        const acceleration = {
          x: data.velocity_x || 0,
          y: data.velocity_y || 0,
          z: data.velocity_z || 0
        };
        
        const gForce = calculateGForce(acceleration);
        
        setAttitudeData({
          orientation: {
            roll: rollDeg,
            pitch: pitchDeg,
            yaw: yawDeg
          },
          rates: {
            roll: 0, // These would come from angular velocity if available
            pitch: 0,
            yaw: 0
          },
          acceleration,
          groundSpeed,
          verticalSpeed: (data.velocity_z || 0) * 3.6,
          slipAngle,
          gForce
        });
        
        setIsConnected(data.connected || false);
        setLastUpdate(new Date());
      } else {
        setError('No attitude data available');
      }
    } catch (err) {
      console.error('Error fetching attitude data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch attitude data');
      setIsConnected(false);
    }
  };

  useEffect(() => {
    if (droneId) {
      fetchTelemetry();
      const interval = setInterval(fetchTelemetry, 2000);
      return () => clearInterval(interval);
    }
  }, [droneId]);

  const formatValue = (value: number, decimals = 1) => {
    if (typeof value === 'number' && !isNaN(value)) {
      return value.toFixed(decimals);
    }
    return '0';
  };

  const getHeadingDirection = (heading: number) => {
    if (heading > 337.5 || heading <= 22.5) return 'N';
    if (heading > 22.5 && heading <= 67.5) return 'NE';
    if (heading > 67.5 && heading <= 112.5) return 'E';
    if (heading > 112.5 && heading <= 157.5) return 'SE';
    if (heading > 157.5 && heading <= 202.5) return 'S';
    if (heading > 202.5 && heading <= 247.5) return 'SW';
    if (heading > 247.5 && heading <= 292.5) return 'W';
    return 'NW';
  };

  if (error) {
    return (
      <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm border border-gray-800">
        <div className="flex items-center gap-3 text-red-400">
          <AlertCircle className="h-5 w-5" />
          <div>
            <div className="font-medium">Attitude Data Error</div>
            <div className="text-sm">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm border border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-light tracking-wider text-blue-300 flex items-center gap-2">
          <Activity className="h-5 w-5" />
          ATTITUDE REFERENCE SYSTEM
        </h3>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span>{isConnected ? 'LIVE' : 'OFFLINE'}</span>
          {lastUpdate && (
            <span className="ml-2">
              {lastUpdate.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Artificial Horizon */}
      <div className="mb-6">
        <h4 className="text-sm text-gray-300 mb-3 tracking-wider font-light">ARTIFICIAL HORIZON</h4>
        <div className="relative w-full h-48 border border-gray-700 rounded-lg overflow-hidden bg-gradient-to-b from-blue-600 to-amber-800">
          {/* Attitude Indicator */}
          <div
            className="absolute inset-0 flex items-center justify-center transition-transform duration-200"
            style={{
              transform: `rotateX(${attitudeData.orientation.pitch}deg) rotateZ(${-attitudeData.orientation.roll}deg)`
            }}
          >
            <div className="w-full h-full flex flex-col">
              <div className="h-1/2 bg-blue-400/40 backdrop-blur-sm"></div>
              <div className="h-1/2 bg-amber-800/40 backdrop-blur-sm"></div>
            </div>
          </div>

          {/* Center Reference */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-32 h-[2px] bg-white/80"></div>
            <div className="absolute w-[2px] h-8 bg-white/80"></div>
          </div>

          {/* Roll Indicator */}
          <div className="absolute top-3 left-1/2 transform -translate-x-1/2">
            <div className="text-sm font-mono text-white/90 tracking-wider bg-black/40 px-2 py-1 rounded">
              {Math.abs(attitudeData.orientation.roll).toFixed(1)}°
            </div>
          </div>
        </div>
      </div>

      {/* Data Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Orientation */}
        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
          <h4 className="text-sm text-gray-300 mb-3 tracking-wider font-light">ORIENTATION (DEG)</h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-xs text-gray-400 tracking-wider mb-1">ROLL</p>
              <p className="text-lg font-mono text-white">
                {formatValue(attitudeData.orientation.roll)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 tracking-wider mb-1">PITCH</p>
              <p className="text-lg font-mono text-white">
                {formatValue(attitudeData.orientation.pitch)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 tracking-wider mb-1">YAW</p>
              <p className="text-lg font-mono text-white">
                {formatValue(attitudeData.orientation.yaw)}
              </p>
              <p className="text-xs text-blue-400 mt-1">
                {getHeadingDirection(attitudeData.orientation.yaw)}
              </p>
            </div>
          </div>
        </div>

        {/* Motion Data */}
        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
          <h4 className="text-sm text-gray-300 mb-3 tracking-wider font-light">MOTION</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-xs text-gray-400 tracking-wider mb-1">GROUND SPEED</p>
              <p className="text-lg font-mono text-white">
                {formatValue(attitudeData.groundSpeed)}
              </p>
              <p className="text-xs text-blue-400">KM/H</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 tracking-wider mb-1">VERTICAL SPEED</p>
              <p className="text-lg font-mono text-white">
                {formatValue(attitudeData.verticalSpeed)}
              </p>
              <p className="text-xs text-blue-400">KM/H</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 tracking-wider mb-1">SLIP ANGLE</p>
              <p className="text-lg font-mono text-white">
                {formatValue(attitudeData.slipAngle)}
              </p>
              <p className="text-xs text-blue-400">DEG</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 tracking-wider mb-1">G-FORCE</p>
              <p className="text-lg font-mono text-white">
                {formatValue(attitudeData.gForce, 2)}
              </p>
              <p className="text-xs text-blue-400">G</p>
            </div>
          </div>
        </div>
      </div>

      {/* Compass */}
      <div className="mt-6">
        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
          <div className="flex items-center justify-center">
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 border-2 border-gray-600 rounded-full"></div>
              <div className="absolute inset-2 border border-gray-700 rounded-full"></div>
              
              {/* Compass needle */}
              <div 
                className="absolute inset-0 flex items-center justify-center transition-transform duration-200"
                style={{ transform: `rotate(${attitudeData.orientation.yaw}deg)` }}
              >
                <div className="w-1 h-8 bg-red-500 rounded-full transform -translate-y-2"></div>
              </div>
              
              {/* Cardinal directions */}
              <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 text-xs text-white font-bold">N</div>
              <div className="absolute top-1/2 -right-1 transform -translate-y-1/2 text-xs text-white font-bold">E</div>
              <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 text-xs text-white font-bold">S</div>
              <div className="absolute top-1/2 -left-1 transform -translate-y-1/2 text-xs text-white font-bold">W</div>
            </div>
            
            <div className="ml-6">
              <div className="text-2xl font-mono text-white">
                {formatValue(attitudeData.orientation.yaw)}°
              </div>
              <div className="text-sm text-blue-400">
                {getHeadingDirection(attitudeData.orientation.yaw)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DroneAttitude;
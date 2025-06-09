// components/DroneControl/TelemetryDashboard.tsx - WITH LIVE DATA INTEGRATION
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Activity, Compass, Globe, Clock, Wind, Thermometer, AlertCircle } from 'lucide-react';

interface Coordinates {
  lat: number;
  lng: number;
}

interface LiveTelemetryData {
  latitude: number;
  longitude: number;
  altitude_relative: number;
  altitude_msl: number;
  percentage: number;
  armed: boolean;
  flight_mode: string;
  connected: boolean;
  voltage: number;
  current: number;
  gps_fix: string;
  satellites: number;
  roll: number;
  pitch: number;
  yaw: number;
  velocity_x: number;
  velocity_y: number;
  velocity_z: number;
  timestamp: string;
}

interface TelemetryDashboardProps {
  drone: {
    id?: string;
    altitude?: number;
    speed?: number;
    heading?: number;
    coordinates?: Coordinates;
  };
}

const TelemetryDashboard: React.FC<TelemetryDashboardProps> = ({ drone }) => {
  // Get droneId from URL params
  const params = useParams();
  const droneId = params?.droneId as string;

  // Live telemetry state
  const [liveTelemetry, setLiveTelemetry] = useState<LiveTelemetryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);

  // Calculated values from telemetry
  const [telemetry, setTelemetry] = useState({
    altitude: 0,
    speed: 0,
    heading: 0,
    coordinates: { lat: 0, lng: 0 },
    temperature: 23,
    windSpeed: 12,
    lastUpdated: new Date(),
    signalLatency: 45,
  });

  // Fetch live telemetry data
  const fetchTelemetry = async () => {
    if (!droneId) {
      setError('No drone ID found in URL');
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const response = await fetch(`/api/drone-telemetry/${droneId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data && data.latitude) {
        setLiveTelemetry(data);
        setLastUpdateTime(new Date());
        
        // Calculate speed from velocity components
        const speed = Math.sqrt(
          Math.pow(data.velocity_x || 0, 2) + 
          Math.pow(data.velocity_y || 0, 2)
        ) * 3.6; // Convert m/s to km/h
        
        // Convert yaw from radians to degrees
        const heading = ((data.yaw || 0) * 180 / Math.PI + 360) % 360;
        
        // Update calculated telemetry
        setTelemetry(prev => ({
          ...prev,
          altitude: data.altitude_relative || 0,
          speed: speed,
          heading: heading,
          coordinates: { lat: data.latitude, lng: data.longitude },
          lastUpdated: new Date(),
          signalLatency: Math.random() * 50 + 25, // Simulated latency
          temperature: 20 + Math.random() * 10, // Simulated temperature
          windSpeed: 5 + Math.random() * 15, // Simulated wind
        }));
        
        setIsLoading(false);
      } else {
        setError('No telemetry data available');
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Error fetching telemetry:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch telemetry');
      setIsLoading(false);
    }
  };

  // Initial fetch and polling
  useEffect(() => {
    if (droneId) {
      fetchTelemetry();
      const interval = setInterval(fetchTelemetry, 2000);
      return () => clearInterval(interval);
    }
  }, [droneId]);

  const formatCoordinates = (coords: Coordinates) => {
    return `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
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

  const getLatencyColor = (latency: number) => {
    if (latency < 50) return 'text-green-500';
    if (latency < 100) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getBatteryColor = (percentage: number) => {
    if (percentage > 70) return 'text-green-400';
    if (percentage > 30) return 'text-amber-400';
    return 'text-red-400';
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm border border-gray-800">
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mr-4"></div>
            <span className="text-gray-400">Loading telemetry dashboard...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm border border-gray-800">
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-4 rounded-lg flex items-center gap-3">
            <AlertCircle className="h-5 w-5" />
            <div>
              <div className="font-medium">Telemetry Error</div>
              <div className="text-sm">{error}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main telemetry panel */}
      <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm border border-gray-800">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-light tracking-wider text-blue-300 flex items-center gap-2">
            <Activity className="h-5 w-5" />
            TELEMETRY DASHBOARD
          </h3>
          
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${liveTelemetry?.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span>{liveTelemetry?.connected ? 'LIVE' : 'OFFLINE'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Last: {lastUpdateTime?.toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800/80 p-4 rounded-lg text-center">
            <div className="text-xs text-gray-400 mb-1">ALTITUDE</div>
            <div className="text-2xl font-light text-white">{Math.round(telemetry.altitude)}</div>
            <div className="text-xs text-blue-400">METERS</div>
            {liveTelemetry && (
              <div className="text-xs text-gray-500 mt-1">
                MSL: {Math.round(liveTelemetry.altitude_msl)}m
              </div>
            )}
          </div>
          
          <div className="bg-gray-800/80 p-4 rounded-lg text-center">
            <div className="text-xs text-gray-400 mb-1">SPEED</div>
            <div className="text-2xl font-light text-white">{Math.round(telemetry.speed)}</div>
            <div className="text-xs text-blue-400">KM/H</div>
            {liveTelemetry && (
              <div className="text-xs text-gray-500 mt-1">
                V↑: {(liveTelemetry.velocity_z * 3.6).toFixed(1)} km/h
              </div>
            )}
          </div>
          
          <div className="bg-gray-800/80 p-4 rounded-lg text-center">
            <div className="text-xs text-gray-400 mb-1">HEADING</div>
            <div className="text-2xl font-light text-white">
              {Math.round(telemetry.heading)}° {getHeadingDirection(telemetry.heading)}
            </div>
            <div className="text-xs text-blue-400 flex items-center justify-center gap-1">
              <Compass className="h-3 w-3" />
              <span>COMPASS</span>
            </div>
          </div>
          
          <div className="bg-gray-800/80 p-4 rounded-lg text-center">
            <div className="text-xs text-gray-400 mb-1">BATTERY</div>
            <div className={`text-2xl font-light ${getBatteryColor(liveTelemetry?.percentage || 0)}`}>
              {liveTelemetry?.percentage || 0}%
            </div>
            <div className="text-xs text-blue-400">
              {liveTelemetry?.voltage?.toFixed(1)}V
            </div>
          </div>
        </div>

        {/* Additional telemetry row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="bg-gray-800/80 p-4 rounded-lg text-center">
            <div className="text-xs text-gray-400 mb-1">GPS</div>
            <div className="text-lg font-light text-white">{liveTelemetry?.satellites || 0}</div>
            <div className="text-xs text-blue-400">{liveTelemetry?.gps_fix || 'UNKNOWN'}</div>
          </div>
          
          <div className="bg-gray-800/80 p-4 rounded-lg text-center">
            <div className="text-xs text-gray-400 mb-1">FLIGHT MODE</div>
            <div className="text-lg font-light text-white">{liveTelemetry?.flight_mode || 'UNKNOWN'}</div>
            <div className={`text-xs ${liveTelemetry?.armed ? 'text-red-400' : 'text-green-400'}`}>
              {liveTelemetry?.armed ? 'ARMED' : 'DISARMED'}
            </div>
          </div>
          
          <div className="bg-gray-800/80 p-4 rounded-lg text-center">
            <div className="text-xs text-gray-400 mb-1">ROLL/PITCH</div>
            <div className="text-lg font-light text-white">
              {((liveTelemetry?.roll || 0) * 180 / Math.PI).toFixed(1)}°
            </div>
            <div className="text-xs text-blue-400">
              P: {((liveTelemetry?.pitch || 0) * 180 / Math.PI).toFixed(1)}°
            </div>
          </div>
          
          <div className="bg-gray-800/80 p-4 rounded-lg text-center">
            <div className="text-xs text-gray-400 mb-1">COORDINATES</div>
            <div className="text-sm font-light text-white">{formatCoordinates(telemetry.coordinates)}</div>
            <div className="text-xs text-blue-400 flex items-center justify-center gap-1">
              <Globe className="h-3 w-3" />
              <span>GPS</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Environmental data */}
      <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm border border-gray-800">
        <h3 className="text-lg font-light tracking-wider text-blue-300 flex items-center gap-2 mb-6">
          <Wind className="h-5 w-5" />
          ENVIRONMENTAL DATA
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-800/80 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs text-gray-400 mb-1">TEMPERATURE</div>
                <div className="flex items-center">
                  <Thermometer className="h-5 w-5 mr-2 text-blue-400" />
                  <span className="text-xl font-light text-white">{Math.round(telemetry.temperature)}°C</span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <span className="text-white font-medium">{Math.round(telemetry.temperature)}°</span>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-800/80 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs text-gray-400 mb-1">WIND SPEED</div>
                <div className="flex items-center">
                  <Wind className="h-5 w-5 mr-2 text-blue-400" />
                  <span className="text-xl font-light text-white">{Math.round(telemetry.windSpeed)} km/h</span>
                </div>
              </div>
              <div className="text-xs px-2 py-1 rounded-lg bg-gray-700 text-gray-300 border border-gray-600">
                {telemetry.windSpeed < 10 ? 'Low' : telemetry.windSpeed < 20 ? 'Moderate' : 'High'}
              </div>
            </div>
          </div>
          
          <div className="bg-gray-800/80 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs text-gray-400 mb-1">SIGNAL LATENCY</div>
                <div className="flex items-center">
                  <Clock className={`h-5 w-5 mr-2 ${getLatencyColor(telemetry.signalLatency)}`} />
                  <span className={`text-xl font-light ${getLatencyColor(telemetry.signalLatency)}`}>
                    {Math.round(telemetry.signalLatency)} ms
                  </span>
                </div>
              </div>
              <div className="text-xs px-2 py-1 rounded-lg bg-gray-700 text-gray-300 border border-gray-600">
                {telemetry.signalLatency < 50 ? 'Excellent' : telemetry.signalLatency < 100 ? 'Good' : 'Poor'}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Live position map */}
      <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm border border-gray-800">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-light tracking-wider text-blue-300 flex items-center gap-2">
            <Globe className="h-5 w-5" />
            LIVE POSITION
          </h3>
          <div className="text-sm text-gray-400">
            Updated: {telemetry.lastUpdated.toLocaleTimeString()}
          </div>
        </div>
        
        <div className="bg-gradient-to-b from-gray-800 to-gray-900 h-64 rounded-lg border border-gray-700 relative overflow-hidden">
          {/* Simulated map grid */}
          <div className="absolute inset-0 grid grid-cols-10 grid-rows-6">
            {Array.from({ length: 60 }).map((_, i) => (
              <div key={i} className="border border-gray-800/20"></div>
            ))}
          </div>
          
          {/* Live drone position indicator */}
          <div 
            className="absolute w-4 h-4 bg-blue-500 rounded-full animate-ping"
            style={{ 
              left: `${((telemetry.coordinates.lng + 180) / 360) * 100}%`, 
              top: `${((90 - telemetry.coordinates.lat) / 180) * 100}%` 
            }}
          ></div>
          <div 
            className="absolute w-3 h-3 bg-blue-400 rounded-full"
            style={{ 
              left: `${((telemetry.coordinates.lng + 180) / 360) * 100}%`, 
              top: `${((90 - telemetry.coordinates.lat) / 180) * 100}%`,
              transform: 'translate(-50%, -50%)' 
            }}
          ></div>
          
          {/* Live coordinates display */}
          <div className="absolute bottom-2 right-2 bg-gray-900/80 px-3 py-1 rounded-lg text-xs text-gray-300">
            {formatCoordinates(telemetry.coordinates)}
          </div>
          
          {/* Altitude indicator */}
          <div className="absolute top-2 right-2 bg-gray-900/80 px-3 py-1 rounded-lg text-xs text-gray-300">
            ALT: {Math.round(telemetry.altitude)}m
          </div>
        </div>
      </div>
    </div>
  );
};

export default TelemetryDashboard;
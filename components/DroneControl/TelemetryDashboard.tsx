// components/DroneControl/TelemetryDashboard.tsx
import React, { useState, useEffect } from 'react';
import { Activity, Compass, Globe, Clock, Wind, Thermometer } from 'lucide-react';

interface Coordinates {
  lat: number;
  lng: number;
}

interface TelemetryDashboardProps {
  drone: {
    id: string;
    altitude?: number;
    speed?: number;
    heading?: number;
    coordinates?: Coordinates;
  };
}

const TelemetryDashboard: React.FC<TelemetryDashboardProps> = ({ drone }) => {
  const [telemetry, setTelemetry] = useState({
    altitude: drone.altitude || 0,
    speed: drone.speed || 0,
    heading: drone.heading || 0,
    coordinates: drone.coordinates || { lat: 0, lng: 0 },
    temperature: 23,
    windSpeed: 12,
    lastUpdated: new Date(),
    signalLatency: 45,
  });
  
  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setTelemetry(prev => ({
        ...prev,
        altitude: Math.max(prev.altitude + (Math.random() * 20 - 10), 100),
        speed: Math.max(prev.speed + (Math.random() * 5 - 2.5), 5),
        heading: (prev.heading + (Math.random() * 10 - 5)) % 360,
        temperature: Math.max(prev.temperature + (Math.random() * 2 - 1), -10),
        windSpeed: Math.max(prev.windSpeed + (Math.random() * 4 - 2), 0),
        lastUpdated: new Date(),
        signalLatency: Math.max(prev.signalLatency + (Math.random() * 20 - 10), 10),
      }));
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);

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

  return (
    <div className="space-y-6">
      {/* Main telemetry panel */}
      <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm border border-gray-800">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-light tracking-wider text-blue-300 flex items-center gap-2">
            <Activity className="h-5 w-5" />
            TELEMETRY DASHBOARD
          </h3>
          
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Clock className="h-4 w-4" />
            <span>Last updated: {telemetry.lastUpdated.toLocaleTimeString()}</span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800/80 p-4 rounded-lg text-center">
            <div className="text-xs text-gray-400 mb-1">ALTITUDE</div>
            <div className="text-2xl font-light text-white">{Math.round(telemetry.altitude)}</div>
            <div className="text-xs text-blue-400">METERS</div>
          </div>
          
          <div className="bg-gray-800/80 p-4 rounded-lg text-center">
            <div className="text-xs text-gray-400 mb-1">SPEED</div>
            <div className="text-2xl font-light text-white">{Math.round(telemetry.speed)}</div>
            <div className="text-xs text-blue-400">KM/H</div>
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
            <div className="text-xs text-gray-400 mb-1">COORDINATES</div>
            <div className="text-lg font-light text-white">{formatCoordinates(telemetry.coordinates)}</div>
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
      
      {/* Map placeholder */}
      <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm border border-gray-800">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-light tracking-wider text-blue-300 flex items-center gap-2">
            <Globe className="h-5 w-5" />
            LOCATION TRACKER
          </h3>
        </div>
        
        <div className="bg-gradient-to-b from-gray-800 to-gray-900 h-64 rounded-lg border border-gray-700 relative overflow-hidden">
          {/* Simulated map grid */}
          <div className="absolute inset-0 grid grid-cols-10 grid-rows-6">
            {Array.from({ length: 60 }).map((_, i) => (
              <div key={i} className="border border-gray-800/20"></div>
            ))}
          </div>
          
          {/* Drone location indicator */}
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
          
          {/* Coordinates display */}
          <div className="absolute bottom-2 right-2 bg-gray-900/80 px-3 py-1 rounded-lg text-xs text-gray-300">
            {formatCoordinates(telemetry.coordinates)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TelemetryDashboard;
// components/DroneControl/DroneInfoPanel.tsx - WITH LIVE DATA INTEGRATION
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Plane, Shield, MapPin, Wifi, WifiOff, AlertCircle } from 'lucide-react';

interface Coordinates {
  lat: number;
  lng: number;
}

interface LiveTelemetryData {
  id: string;
  latitude: number;
  longitude: number;
  altitude_relative: number;
  percentage: number;
  armed: boolean;
  flight_mode: string;
  connected: boolean;
  voltage: number;
  current: number;
  gps_fix: string;
  satellites: number;
  timestamp: string;
  lastUpdate?: string;
}

interface DroneInfoPanelProps {
  drone: {
    id?: string; // Make optional since we'll get it from URL
    model: string;
    status: string;
    location: string;
    batteryLevel: number;
    mission?: string;
    coordinates?: Coordinates;
    altitude?: number;
    speed?: number;
  };
}

const DroneInfoPanel: React.FC<DroneInfoPanelProps> = ({ drone }) => {
  // Get droneId from URL params (from [droneId] route)
  const params = useParams();
  const droneId = params?.droneId as string;
  
  // Live telemetry state
  const [liveTelemetry, setLiveTelemetry] = useState<LiveTelemetryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);

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

  // Initial fetch and set up polling
  useEffect(() => {
    if (droneId) {
      fetchTelemetry();
      
      // Poll for updates every 2 seconds
      const interval = setInterval(fetchTelemetry, 2000);
      
      return () => clearInterval(interval);
    }
  }, [droneId]); // Re-run when droneId changes

  const getStatusColor = (status: string) => {
    if (liveTelemetry?.connected === false) {
      return 'bg-red-500/20 text-red-300 border-red-500/30';
    }
    
    switch(status) {
      case 'ACTIVE': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'STANDBY': return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
      case 'MAINTENANCE': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'OFFLINE': return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const getBatteryColor = (percentage: number) => {
    if (percentage > 70) return 'text-green-400';
    if (percentage > 30) return 'text-amber-400';
    return 'text-red-400';
  };

  // Use live data when available, fallback to props
  const displayData = {
    batteryLevel: liveTelemetry?.percentage ?? drone.batteryLevel,
    coordinates: liveTelemetry ? 
      { lat: liveTelemetry.latitude, lng: liveTelemetry.longitude } : 
      drone.coordinates,
    altitude: liveTelemetry?.altitude_relative ?? drone.altitude,
    armed: liveTelemetry?.armed ?? false,
    flightMode: liveTelemetry?.flight_mode ?? 'UNKNOWN',
    connected: liveTelemetry?.connected ?? false,
    voltage: liveTelemetry?.voltage ?? 0,
    satellites: liveTelemetry?.satellites ?? 0,
    gpsStatus: liveTelemetry?.gps_fix ?? 'UNKNOWN'
  };

  // Simulate drone details that would come from your database
  const droneDetails = {
    serialNumber: `SN-${droneId?.split('-')[1]}-${Math.floor(Math.random() * 10000)}`,
    manufacturer: 'FlyOS Technologies',
    manufactureDate: '2025-01-15',
    lastMaintenance: '2025-04-10',
    flightHours: 124,
    maxAltitude: 2000,
    maxSpeed: 120,
    rangeLimitKm: 50,
    currentMission: drone.mission || 'Surveillance',
  };

  return (
    <div className="space-y-6">
      {/* Basic drone info card */}
      <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm border border-gray-800">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-light tracking-wider text-blue-300 flex items-center gap-2">
            <Plane className="h-5 w-5" />
            DRONE INFORMATION
          </h3>
          <div className="flex items-center gap-2">
            {/* Connection indicator */}
            {displayData.connected ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" />
            )}
            <div className={`text-xs px-2 py-1 rounded-lg border ${getStatusColor(drone.status)}`}>
              {displayData.connected ? 'LIVE' : 'OFFLINE'}
            </div>
          </div>
        </div>
        
        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center p-4">
            <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mr-3"></div>
            <span className="text-gray-400">Loading telemetry...</span>
          </div>
        )}
        
        {/* Error state */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-3 rounded-lg mb-4 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Telemetry Error: {error}</span>
          </div>
        )}
        
        {/* Live data display */}
        {!isLoading && !error && (
          <div className="space-y-2">
            <div className="flex justify-between items-center p-3 bg-gray-800/80 rounded-lg">
              <span className="text-gray-400">ID:</span>
              <span className="text-white font-light">{droneId}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-800/80 rounded-lg">
              <span className="text-gray-400">Model:</span>
              <span className="text-white font-light">{drone.model}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-800/80 rounded-lg">
              <span className="text-gray-400">Location:</span>
              <span className="text-white font-light">
                {displayData.coordinates ? 
                  `${displayData.coordinates.lat.toFixed(4)}, ${displayData.coordinates.lng.toFixed(4)}` : 
                  drone.location}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-800/80 rounded-lg">
              <span className="text-gray-400">Battery:</span>
              <span className={`font-light ${getBatteryColor(displayData.batteryLevel)}`}>
                {displayData.batteryLevel}%
                {liveTelemetry && (
                  <span className="text-xs text-gray-500 ml-2">
                    ({displayData.voltage.toFixed(1)}V)
                  </span>
                )}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-800/80 rounded-lg">
              <span className="text-gray-400">Flight Mode:</span>
              <span className="text-white font-light">{displayData.flightMode}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-800/80 rounded-lg">
              <span className="text-gray-400">Armed Status:</span>
              <span className={`font-light ${displayData.armed ? 'text-red-400' : 'text-green-400'}`}>
                {displayData.armed ? 'ARMED' : 'DISARMED'}
              </span>
            </div>
            {liveTelemetry && (
              <div className="flex justify-between items-center p-3 bg-gray-800/80 rounded-lg">
                <span className="text-gray-400">GPS Status:</span>
                <span className="text-white font-light">
                  {displayData.gpsStatus} ({displayData.satellites} sats)
                </span>
              </div>
            )}
          </div>
        )}
        
        {/* Last update timestamp */}
        {lastUpdateTime && (
          <div className="mt-4 text-xs text-gray-500 text-center">
            Last updated: {lastUpdateTime.toLocaleTimeString()}
          </div>
        )}
      </div>
      
      {/* Technical specifications */}
      <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm border border-gray-800">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-blue-400" />
          <h3 className="text-lg font-light tracking-wider text-blue-300">SPECIFICATIONS</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-800/80 p-3 rounded-lg">
            <div className="text-xs text-gray-400 mb-1">Serial Number</div>
            <div className="text-sm font-light text-white">{droneDetails.serialNumber}</div>
          </div>
          
          <div className="bg-gray-800/80 p-3 rounded-lg">
            <div className="text-xs text-gray-400 mb-1">Manufacturer</div>
            <div className="text-sm font-light text-white">{droneDetails.manufacturer}</div>
          </div>
          
          <div className="bg-gray-800/80 p-3 rounded-lg">
            <div className="text-xs text-gray-400 mb-1">Flight Hours</div>
            <div className="text-sm font-light text-white">{droneDetails.flightHours} hours</div>
          </div>
          
          <div className="bg-gray-800/80 p-3 rounded-lg">
            <div className="text-xs text-gray-400 mb-1">Last Maintenance</div>
            <div className="text-sm font-light text-white">{droneDetails.lastMaintenance}</div>
          </div>
        </div>
      </div>
      
      {/* Operational limits with live data */}
      <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm border border-gray-800">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="h-5 w-5 text-blue-400" />
          <h3 className="text-sm font-medium text-blue-300">OPERATIONAL LIMITS</h3>
        </div>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-400">Current Altitude:</span>
            <span className="text-white">
              {displayData.altitude ? `${Math.round(displayData.altitude)} meters` : 'N/A'}
            </span>
          </div>
          
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-400">Maximum Altitude:</span>
            <span className="text-white">{droneDetails.maxAltitude} meters</span>
          </div>
          
          <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-blue-300" 
              style={{ width: `${((displayData.altitude || 0) / droneDetails.maxAltitude) * 100}%` }}
            ></div>
          </div>
          
          <div className="flex justify-between items-center text-sm mt-4">
            <span className="text-gray-400">Maximum Speed:</span>
            <span className="text-white">{droneDetails.maxSpeed} km/h</span>
          </div>
          
          <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-blue-300" 
              style={{ width: `${((drone.speed || 0) / droneDetails.maxSpeed) * 100}%` }}
            ></div>
          </div>
          
          <div className="flex justify-between items-center text-sm mt-4">
            <span className="text-gray-400">Range Limit:</span>
            <span className="text-white">{droneDetails.rangeLimitKm} km</span>
          </div>
          
          <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-blue-300" 
              style={{ width: '35%' }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DroneInfoPanel;
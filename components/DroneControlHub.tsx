// components/DroneControlHub.tsx - RESTORED ORIGINAL UI WITH REDIS INTEGRATION
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth';
import { 
  Plane, 
  Settings, 
  Battery, 
  MapPin, 
  Wifi, 
  WifiOff,
  RefreshCw,
  AlertTriangle,
  Play,
  Square,
  Navigation,
  Gauge
} from 'lucide-react';

interface DroneData {
  id: string;
  name: string;
  model: string;
  status: 'ACTIVE' | 'STANDBY' | 'MAINTENANCE' | 'OFFLINE';
  location: string;
  batteryLevel: number;
  mission?: string;
  lastSeen?: string;
  // Redis telemetry data
  latitude?: number;
  longitude?: number;
  altitude_relative?: number;
  armed?: boolean;
  flight_mode?: string;
  connected?: boolean;
  percentage?: number;
  voltage?: number;
  gps_fix?: string;
  satellites?: number;
}

const DroneControlHub: React.FC = () => {
  const { token } = useAuth();
  const router = useRouter();
  const [drones, setDrones] = useState<DroneData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Fetch drone list and live telemetry
  const fetchDroneData = async () => {
    if (!token) {
      setError('Authentication required');
      setIsLoading(false);
      return;
    }

    try {
      // Get the list of drones from the database
      const dronesResponse = await fetch('/api/drones', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!dronesResponse.ok) {
        throw new Error(`Failed to fetch drones: ${dronesResponse.status}`);
      }

      const dronesData = await dronesResponse.json();
      
      if (!dronesData.success || !dronesData.drones) {
        throw new Error('Invalid drone data received');
      }

      // Get live telemetry for each drone from Redis
      const droneList = dronesData.drones;
      const telemetryPromises = droneList.map(async (drone: any) => {
        try {
          const telemetryResponse = await fetch(`/api/drone-telemetry/${drone.id}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            cache: 'no-store'
          });

          let telemetryData = {};
          if (telemetryResponse.ok) {
            telemetryData = await telemetryResponse.json();
          }

          // Combine database drone info with live telemetry
          return {
            id: drone.id,
            name: drone.name || drone.id.toUpperCase(),
            model: drone.model || 'FlyOS MQ-7',
            status: determineStatus(drone, telemetryData),
            location: drone.location || 'Unknown',
            batteryLevel: (telemetryData as any).percentage || drone.battery_level || 0,
            mission: drone.current_mission || 'Standby',
            lastSeen: drone.last_seen || new Date().toISOString(),
            // Live telemetry data
            ...(telemetryData as any)
          };
        } catch (err) {
          console.error(`Error fetching telemetry for ${drone.id}:`, err);
          return {
            id: drone.id,
            name: drone.name || drone.id.toUpperCase(),
            model: drone.model || 'FlyOS MQ-7',
            status: 'OFFLINE' as const,
            location: drone.location || 'Unknown',
            batteryLevel: drone.battery_level || 0,
            mission: drone.current_mission || 'Standby',
            lastSeen: drone.last_seen || new Date().toISOString(),
            connected: false
          };
        }
      });

      const dronesWithTelemetry = await Promise.all(telemetryPromises);
      setDrones(dronesWithTelemetry);
      setError(null);
      setLastUpdate(new Date());

    } catch (err: any) {
      console.error('Error fetching drone data:', err);
      setError(`Failed to load drones: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Determine drone status based on database and telemetry data
  const determineStatus = (dbDrone: any, telemetry: any): 'ACTIVE' | 'STANDBY' | 'MAINTENANCE' | 'OFFLINE' => {
    // If we have live telemetry and drone is connected
    if (telemetry.connected && telemetry.latitude) {
      if (telemetry.armed) {
        return 'ACTIVE';
      } else {
        return 'STANDBY';
      }
    }
    
    // If database shows maintenance
    if (dbDrone.status === 'MAINTENANCE') {
      return 'MAINTENANCE';
    }
    
    // Otherwise offline
    return 'OFFLINE';
  };

  // Fetch data on component mount and set up refresh interval
  useEffect(() => {
    fetchDroneData();
    
    // Refresh every 5 seconds
    const interval = setInterval(fetchDroneData, 5000);
    
    return () => clearInterval(interval);
  }, [token]);

  // Handle drone control navigation
  const handleControlDrone = (droneId: string) => {
    router.push(`/secure/main-hq/drone-control/${droneId}`);
  };

  // Manual refresh
  const handleRefresh = async () => {
    setIsLoading(true);
    await fetchDroneData();
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'STANDBY': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'MAINTENANCE': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'OFFLINE': return 'bg-red-500/20 text-red-300 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  // Format coordinates
  const formatCoordinates = (lat?: number, lng?: number) => {
    if (!lat || !lng) return 'No GPS';
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  };

  // Format last seen
  const formatLastSeen = (lastSeen?: string) => {
    if (!lastSeen) return 'Unknown';
    
    try {
      const date = new Date(lastSeen);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
      return date.toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };

  return (
    <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm border border-gray-800">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Plane className="h-6 w-6 text-blue-400" />
          <div>
            <h2 className="text-xl font-light tracking-wider text-blue-300">DRONE FLEET MANAGEMENT</h2>
            <p className="text-sm text-gray-400">Live telemetry and control interface</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-xs text-gray-400">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-2 bg-gray-800/60 hover:bg-gray-800 border border-gray-700 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 text-gray-300 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 text-red-300 rounded-lg flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {isLoading && drones.length === 0 && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
          <div className="text-gray-400">Loading drone fleet...</div>
        </div>
      )}

      {/* No Drones */}
      {!isLoading && drones.length === 0 && !error && (
        <div className="text-center py-8">
          <Plane className="h-16 w-16 text-gray-600 mx-auto mb-4" />
          <div className="text-gray-400 text-lg">No drones available</div>
          <div className="text-gray-500 text-sm mt-2">Check your drone database configuration</div>
        </div>
      )}

      {/* Drone Grid */}
      {drones.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {drones.map((drone) => (
            <div
              key={drone.id}
              className="bg-gray-800/60 p-4 rounded-lg border border-gray-700 hover:border-gray-600 transition-all hover:bg-gray-800/80"
            >
              {/* Drone Header */}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-medium text-white text-lg">{drone.name}</h3>
                  <p className="text-xs text-gray-400">{drone.model}</p>
                </div>
                <div className={`text-xs px-2 py-1 rounded border ${getStatusColor(drone.status)}`}>
                  {drone.status}
                </div>
              </div>

              {/* Status Indicators */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {/* Battery */}
                <div className="flex items-center gap-2">
                  <Battery className={`h-4 w-4 ${
                    drone.batteryLevel > 70 ? 'text-green-500' : 
                    drone.batteryLevel > 30 ? 'text-yellow-500' : 'text-red-500'
                  }`} />
                  <span className="text-sm text-white">{drone.batteryLevel}%</span>
                </div>

                {/* Connection */}
                <div className="flex items-center gap-2">
                  {drone.connected ? (
                    <>
                      <Wifi className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-400">Live</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-4 w-4 text-red-500" />
                      <span className="text-sm text-red-400">Offline</span>
                    </>
                  )}
                </div>

                {/* GPS */}
                <div className="flex items-center gap-2 col-span-2">
                  <MapPin className="h-4 w-4 text-blue-400" />
                  <span className="text-xs text-gray-300">
                    {formatCoordinates(drone.latitude, drone.longitude)}
                  </span>
                </div>
              </div>

              {/* Flight Info */}
              {drone.connected && (
                <div className="mb-4 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400">Flight Mode:</span>
                    <span className="text-blue-300">{drone.flight_mode || 'UNKNOWN'}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400">Armed:</span>
                    <span className={drone.armed ? 'text-red-400' : 'text-green-400'}>
                      {drone.armed ? 'YES' : 'NO'}
                    </span>
                  </div>
                  {drone.altitude_relative && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-400">Altitude:</span>
                      <span className="text-white">{drone.altitude_relative.toFixed(1)}m</span>
                    </div>
                  )}
                </div>
              )}

              {/* Location & Mission */}
              <div className="mb-4 space-y-1">
                <div className="text-xs text-gray-400">Location: {drone.location}</div>
                <div className="text-xs text-gray-400">Mission: {drone.mission}</div>
                <div className="text-xs text-gray-500">Last seen: {formatLastSeen(drone.lastSeen)}</div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleControlDrone(drone.id)}
                  className="flex-1 px-3 py-2 bg-blue-600/20 border border-blue-500/30 text-blue-300 rounded-lg hover:bg-blue-600/30 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                >
                  <Play className="h-3 w-3" />
                  CONTROL
                </button>
                
                <button
                  className="px-3 py-2 bg-gray-700/60 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700/80 transition-colors"
                  title="Settings"
                >
                  <Settings className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fleet Summary */}
      {drones.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-700">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800/60 p-3 rounded-lg text-center">
              <div className="text-2xl font-light text-white">{drones.length}</div>
              <div className="text-xs text-gray-400">TOTAL DRONES</div>
            </div>
            
            <div className="bg-gray-800/60 p-3 rounded-lg text-center">
              <div className="text-2xl font-light text-green-400">
                {drones.filter(d => d.status === 'ACTIVE').length}
              </div>
              <div className="text-xs text-gray-400">ACTIVE</div>
            </div>
            
            <div className="bg-gray-800/60 p-3 rounded-lg text-center">
              <div className="text-2xl font-light text-blue-400">
                {drones.filter(d => d.connected).length}
              </div>
              <div className="text-xs text-gray-400">ONLINE</div>
            </div>
            
            <div className="bg-gray-800/60 p-3 rounded-lg text-center">
              <div className="text-2xl font-light text-red-400">
                {drones.filter(d => !d.connected).length}
              </div>
              <div className="text-xs text-gray-400">OFFLINE</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DroneControlHub;
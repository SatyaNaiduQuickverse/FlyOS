// components/DroneControlHub.tsx - WEBSOCKET ISSUES FIXED
import React, { useState, useEffect } from 'react';
import { 
  Plane, Battery, Signal, MapPin, Clock, 
  ArrowUpCircle, AlertTriangle, RefreshCw, Activity 
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import DroneLocationMap from './DroneLocationMap';
import axios from 'axios';
import { useAuth } from '../lib/auth';

// Updated drone interface to match your backend response
interface DroneData {
  id: string;
  model: string;
  status: string;
  region_id?: string;
  region_name?: string;
  operator_id?: string;
  last_maintenance?: string;
  created_at?: string;
  updated_at?: string;
  
  // Real-time telemetry from Redis
  latitude?: number;
  longitude?: number;
  altitude?: number;
  battery_percentage?: number;
  connected?: boolean;
  flight_mode?: string;
  armed?: boolean;
  last_telemetry?: string;
  voltage?: number;
  
  // Computed fields for UI
  location?: string;
  batteryLevel?: number;
  signalStrength?: number;
  lastActive?: string;
  mission?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

const DroneControlHub: React.FC = () => {
  const router = useRouter();
  const { token, refreshSession, user } = useAuth();
  const [drones, setDrones] = useState<DroneData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDrone, setSelectedDrone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<boolean>(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Enhanced retry handler
  const handleRetry = async () => {
    setRetrying(true);
    try {
      console.log('Retrying connection...');
      
      // Try to refresh the session first
      await refreshSession();
      
      // Then refetch drones
      await fetchDrones();
      
      setError(null);
      console.log('Retry successful');
    } catch (err) {
      console.error('Retry failed:', err);
      setError('Authentication failed. Please log in again.');
      // Redirect to login after a short delay
      setTimeout(() => {
        router.push('/auth/login');
      }, 1500);
    } finally {
      setRetrying(false);
    }
  };

  // Enhanced fetch function with better error handling
  const fetchDrones = async () => {
    try {
      if (!token) {
        setError('Authentication required');
        setLoading(false);
        return;
      }
      
      console.log('Fetching drones from Supabase-authenticated API...');
      
      // Use the existing API endpoint which is already connected to Supabase
      const response = await axios.get('/api/drones', {
        headers: {
          Authorization: `Bearer ${token}`
        },
        timeout: 10000 // 10 second timeout
      });
      
      console.log('API Response received:', response.data.success ? 'Success' : 'Failed');
      
      if (response.data.success) {
        // Transform the backend data to match our UI needs
        const droneList = response.data.data.map((drone: any) => {
          // Create location string from coordinates
          const location = drone.latitude && drone.longitude 
            ? `${drone.latitude.toFixed(4)}, ${drone.longitude.toFixed(4)}` 
            : 'Location Unknown';
          
          // Determine signal strength based on connection status and last telemetry
          let signalStrength = 0;
          if (drone.connected) {
            if (drone.last_telemetry) {
              const lastUpdate = new Date(drone.last_telemetry);
              const now = new Date();
              const timeDiff = (now.getTime() - lastUpdate.getTime()) / 1000; // seconds
              
              if (timeDiff < 30) signalStrength = 100;
              else if (timeDiff < 60) signalStrength = 80;
              else if (timeDiff < 120) signalStrength = 60;
              else signalStrength = 30;
            } else {
              signalStrength = 50; // Connected but no recent telemetry
            }
          }
          
          // Format last active time
          const lastActive = drone.last_telemetry 
            ? new Date(drone.last_telemetry).toLocaleString()
            : 'Never';
          
          return {
            ...drone,
            // UI-friendly computed fields
            location,
            batteryLevel: drone.battery_percentage || 0,
            signalStrength,
            lastActive,
            mission: drone.flight_mode || 'Unknown',
            coordinates: drone.latitude && drone.longitude ? {
              lat: drone.latitude,
              lng: drone.longitude
            } : undefined
          };
        });
        
        setDrones(droneList);
        setError(null);
        setLastUpdate(new Date());
        console.log(`Successfully loaded ${droneList.length} drones`);
        
        // Log connection status
        const connectedCount = droneList.filter((d: DroneData) => d.connected).length;
        console.log(`${connectedCount}/${droneList.length} drones connected`);
      } else {
        setError(response.data.message || 'Failed to load drones');
        console.error('API error:', response.data.message);
      }
    } catch (err: any) {
      console.error('Error fetching drones:', err);
      
      if (err.response) {
        // Server responded with error status
        if (err.response.status === 401) {
          setError('Authentication expired - Please retry or login again');
        } else if (err.response.status === 503) {
          setError('Backend service unavailable - Please retry');
        } else {
          setError(`Server error (${err.response.status}): ${err.response.data?.message || err.message}`);
        }
      } else if (err.code === 'ECONNREFUSED') {
        setError('Cannot connect to drone database service');
      } else if (err.code === 'ECONNABORTED') {
        setError('Request timeout - Backend service not responding');
      } else {
        setError(`Network error: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Setup polling and initial fetch
  useEffect(() => {
    if (!token) {
      setError('No authentication token available');
      setLoading(false);
      return;
    }
    
    // Initial fetch
    fetchDrones();
    
    // Set up polling to refresh drone list every 15 seconds for real-time updates
    const intervalId = setInterval(() => {
      fetchDrones();
    }, 15000);
    
    // Clean up on unmount
    return () => clearInterval(intervalId);
  }, [token]);

  // Helper functions for UI styling
  const getBatteryColor = (level: number) => {
    if (level >= 70) return 'text-green-400';
    if (level >= 30) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getSignalColor = (strength: number) => {
    if (strength >= 70) return 'text-green-400';
    if (strength >= 30) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getStatusColor = (status: string) => {
    switch(status?.toUpperCase()) {
      case 'ACTIVE': return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'STANDBY': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'MAINTENANCE': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'OFFLINE': return 'bg-red-500/20 text-red-300 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const getConnectionStatus = (drone: DroneData) => {
    if (drone.connected) {
      return (
        <div className="flex items-center gap-1 text-green-400">
          <Activity className="h-3 w-3" />
          <span className="text-xs">LIVE</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-1 text-red-400">
          <Activity className="h-3 w-3" />
          <span className="text-xs">OFFLINE</span>
        </div>
      );
    }
  };

  // Event handlers
  const handleSelectDrone = (droneId: string) => {
    setSelectedDrone(selectedDrone === droneId ? null : droneId);
  };

  const handleControlDrone = (droneId: string) => {
    console.log(`Navigating to drone control page for ${droneId}`);
    // Navigate using the correct path structure based on user role
    if (user?.role === 'MAIN_HQ') {
      router.push(`/secure/main-hq/drone-control/${droneId}`);
    } else if (user?.role === 'REGIONAL_HQ') {
      router.push(`/secure/regional-hq/drone-control/${droneId}`);
    } else {
      router.push(`/secure/operator/drone-control/${droneId}`);
    }
  };

  const handleRecallDrone = async (droneId: string) => {
    if (!token) {
      setError('Authentication required to send commands');
      return;
    }
    
    try {
      console.log(`Sending RTL command to drone ${droneId}`);
      
      const response = await axios.post(`/api/drones/${droneId}/command`, {
        commandType: 'RTL',
        parameters: {}
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        alert(`✅ Recall command sent to drone ${droneId}`);
        // Refresh drone data to see updated status
        fetchDrones();
      } else {
        alert(`❌ Failed to recall drone: ${response.data.message}`);
      }
    } catch (err: any) {
      console.error('Error recalling drone:', err);
      alert(`❌ Error recalling drone: ${err.message}`);
    }
  };

  // Calculate stats
  const connectedDrones = drones.filter(d => d.connected).length;
  const activeDrones = drones.filter(d => d.status === 'ACTIVE').length;

  return (
    <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-light tracking-wider flex items-center gap-2 text-blue-300">
            <Plane className="h-5 w-5" />
            DRONE CONTROL HUB
          </h3>
          {user && (
            <span className="text-xs text-gray-400 bg-gray-800/50 px-2 py-1 rounded">
              {user.role} ACCESS
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-4 text-sm">
          {lastUpdate && (
            <div className="text-gray-400">
              Updated: {lastUpdate.toLocaleTimeString()}
            </div>
          )}
          {!error && !loading && (
            <div className="flex items-center gap-2">
              <div className="text-gray-400">
                {connectedDrones}/{drones.length} Connected
              </div>
              <div className="text-gray-400">•</div>
              <div className="text-gray-400">
                {activeDrones} Active
              </div>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="relative">
            <div className="animate-ping absolute inset-0 rounded-full h-12 w-12 bg-blue-400 opacity-10"></div>
            <div className="animate-spin relative rounded-full h-12 w-12 border-2 border-gray-600 border-t-blue-500"></div>
          </div>
          <div className="ml-4 text-gray-400">
            Loading drone fleet data...
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-4 text-red-300">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium mb-2">Connection Error</p>
              <p className="text-sm mb-4">{error}</p>
              <button 
                onClick={handleRetry}
                disabled={retrying}
                className="bg-red-500/20 hover:bg-red-500/30 text-red-300 px-4 py-2 rounded-md transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {retrying ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Retrying...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    <span>Retry Connection</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : drones.length === 0 ? (
        <div className="bg-gray-800/50 rounded-lg p-8 border border-gray-700 text-center">
          <Plane className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400 text-lg mb-2">No Drones Available</p>
          <p className="text-gray-500 text-sm">No drone units are currently assigned to your command.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {drones.map((drone) => (
            <div key={drone.id} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 transition-all hover:border-gray-600">
              <div 
                className="flex justify-between items-center cursor-pointer"
                onClick={() => handleSelectDrone(drone.id)}
              >
                <div className="flex items-center gap-3">
                  <Plane className="h-5 w-5 text-blue-400" />
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{drone.id}</span>
                      {getConnectionStatus(drone)}
                    </div>
                    <span className="text-xs text-gray-500">{drone.model}</span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(drone.status)}`}>
                    {drone.status}
                  </span>
                </div>
                
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <div className="flex items-center gap-1">
                    <Battery className={`h-4 w-4 ${getBatteryColor(drone.batteryLevel || 0)}`} />
                    <span>{drone.batteryLevel || 0}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Signal className={`h-4 w-4 ${getSignalColor(drone.signalStrength || 0)}`} />
                    <span>{drone.signalStrength || 0}%</span>
                  </div>
                  {drone.region_name && (
                    <span className="text-xs bg-gray-700/50 px-2 py-1 rounded">
                      {drone.region_name}
                    </span>
                  )}
                </div>
              </div>

              {selectedDrone === drone.id && (
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-900/60 p-3 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Battery className={`h-4 w-4 ${getBatteryColor(drone.batteryLevel || 0)}`} />
                          <span className="text-sm text-gray-400">Battery</span>
                        </div>
                        <div className="text-xl font-light">{drone.batteryLevel || 0}%</div>
                        {drone.voltage && (
                          <div className="text-xs text-gray-500">{drone.voltage.toFixed(1)}V</div>
                        )}
                      </div>
                      <div className="bg-gray-900/60 p-3 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Signal className={`h-4 w-4 ${getSignalColor(drone.signalStrength || 0)}`} />
                          <span className="text-sm text-gray-400">Signal</span>
                        </div>
                        <div className="text-xl font-light">{drone.signalStrength || 0}%</div>
                        <div className="text-xs text-gray-500">
                          {drone.connected ? 'Connected' : 'Offline'}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-900/60 p-3 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin className="h-4 w-4 text-blue-400" />
                          <span className="text-sm text-gray-400">Location</span>
                        </div>
                        <div className="text-sm">{drone.location || 'Unknown'}</div>
                        {drone.altitude && (
                          <div className="text-xs text-gray-500">Alt: {drone.altitude}m</div>
                        )}
                      </div>
                      <div className="bg-gray-900/60 p-3 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Activity className="h-4 w-4 text-blue-400" />
                          <span className="text-sm text-gray-400">Mission</span>
                        </div>
                        <div className="text-sm">{drone.mission || 'None'}</div>
                        <div className="text-xs text-gray-500">
                          {drone.armed ? 'Armed' : 'Disarmed'}
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-900/60 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-blue-400" />
                        <span className="text-sm text-gray-400">Last Telemetry</span>
                      </div>
                      <div className="text-sm">{drone.lastActive || 'Never'}</div>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleControlDrone(drone.id)}
                        className="flex-1 bg-blue-900/30 hover:bg-blue-900/50 text-blue-300 py-2 rounded-lg border border-blue-500/30 flex items-center justify-center gap-2 transition-colors"
                      >
                        <ArrowUpCircle className="h-4 w-4" />
                        <span>Control</span>
                      </button>
                      <button 
                        onClick={() => handleRecallDrone(drone.id)}
                        className="flex-1 bg-amber-900/30 hover:bg-amber-900/50 text-amber-300 py-2 rounded-lg border border-amber-500/30 flex items-center justify-center gap-2 transition-colors"
                      >
                        <AlertTriangle className="h-4 w-4" />
                        <span>Recall</span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-gray-900/60 p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="h-4 w-4 text-blue-400" />
                      <span className="text-sm text-gray-400">Live Location</span>
                    </div>
                    <div className="h-[250px]">
                      {drone.coordinates ? (
                        <DroneLocationMap 
                          location={{
                            lat: drone.coordinates.lat,
                            lng: drone.coordinates.lng,
                            timestamp: drone.lastActive || new Date().toISOString(),
                            area: drone.region_name || 'Unknown Region',
                            city: drone.location?.split(',')[0]?.trim() || 'Unknown'
                          }}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                          <div className="text-center">
                            <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No GPS Data</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DroneControlHub;

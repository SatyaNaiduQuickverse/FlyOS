// components/DroneControl/DroneControlHub.tsx
import React, { useState, useEffect } from 'react';
import { 
  Plane, Battery, Signal, MapPin, Clock, 
  ArrowUpCircle, AlertTriangle
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import DroneLocationMap from '../DroneLocationMap';
import axios from 'axios';
import { useAuth } from '../../lib/auth';

// Define the drone interface
interface DroneData {
  id: string;
  model: string;
  status: string;
  location?: string;
  batteryLevel?: number;
  signalStrength?: number;
  lastActive?: string;
  mission?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  // Add fields from Redis/TimescaleDB
  latitude?: number;
  longitude?: number;
  percentage?: number;
  voltage?: number;
  current?: number;
  connected?: boolean;
  flight_mode?: string;
  timestamp?: string;
  // Add any other fields you need
}

const DroneControlHub: React.FC = () => {
  const router = useRouter();
  const { token } = useAuth(); // Get token from auth context
  const [drones, setDrones] = useState<DroneData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDrone, setSelectedDrone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch drone data from backend
  useEffect(() => {
    const fetchDrones = async () => {
      setLoading(true);
      try {
        if (!token) {
          setError('Authentication required');
          setLoading(false);
          return;
        }
        
        // Fetch the list of drones from your backend
        const response = await axios.get('/api/drones', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        if (response.data.success) {
          // Map the response data to your DroneData interface
          const droneList = response.data.data.map((drone: any) => ({
            id: drone.id,
            model: drone.model || 'Unknown',
            status: drone.status || 'UNKNOWN',
            // Parse location from coordinates if available
            location: drone.latitude && drone.longitude 
              ? `${drone.latitude.toFixed(4)}, ${drone.longitude.toFixed(4)}` 
              : 'Unknown Location',
            // Map fields from Redis/TimescaleDB
            batteryLevel: drone.percentage || 0,
            signalStrength: drone.connected ? 100 : 0,
            lastActive: new Date(drone.timestamp || Date.now()).toLocaleString(),
            mission: drone.flight_mode || 'None',
            coordinates: {
              lat: drone.latitude || 0,
              lng: drone.longitude || 0
            },
            // Keep the original fields for reference
            ...drone
          }));
          
          setDrones(droneList);
          setError(null);
        } else {
          setError(response.data.message || 'Failed to load drones');
        }
      } catch (err) {
        console.error('Error fetching drones:', err);
        setError('Error connecting to drone database');
      } finally {
        setLoading(false);
      }
    };

    fetchDrones();
    
    // Set up polling to refresh drone list every 30 seconds
    const intervalId = setInterval(fetchDrones, 30000);
    
    // Clean up on unmount
    return () => clearInterval(intervalId);
  }, [token]);

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
    switch(status) {
      case 'ACTIVE': return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'STANDBY': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'MAINTENANCE': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'OFFLINE': return 'bg-red-500/20 text-red-300 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const handleSelectDrone = (droneId: string) => {
    setSelectedDrone(selectedDrone === droneId ? null : droneId);
  };

  const handleControlDrone = (droneId: string) => {
    console.log(`Navigating to drone control page for ${droneId}`);
    router.push(`/secure/main-hq/drone-control/${droneId}`);
  };

  const handleRecallDrone = (droneId: string) => {
    // Implement actual recall functionality
    if (!token) {
      setError('Authentication required to send commands');
      return;
    }
    
    // Send RTL (Return to Launch) command
    axios.post(`/api/drones/${droneId}/command`, {
      commandType: 'RTL',
      parameters: {}
    }, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    .then(response => {
      if (response.data.success) {
        alert(`Initiated recall for drone ${droneId}`);
      } else {
        alert(`Failed to recall drone: ${response.data.message}`);
      }
    })
    .catch(err => {
      console.error('Error recalling drone:', err);
      alert(`Error recalling drone: ${err.message}`);
    });
  };

  return (
    <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm">
      <h3 className="text-lg font-light tracking-wider mb-6 flex items-center gap-2 text-blue-300">
        <Plane className="h-5 w-5" />
        ACTIVE DRONE CONTROL
      </h3>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="relative">
            <div className="animate-ping absolute inset-0 rounded-full h-12 w-12 bg-blue-400 opacity-10"></div>
            <div className="animate-spin relative rounded-full h-12 w-12 border-2 border-gray-600 border-t-blue-500"></div>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-4 text-red-300">
          <p>{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 px-4 py-2 rounded-md transition-colors"
          >
            Retry
          </button>
        </div>
      ) : drones.length === 0 ? (
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 text-center">
          <p className="text-gray-400">No drones available.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {drones.map((drone) => (
            <div key={drone.id} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <div 
                className="flex justify-between items-center cursor-pointer"
                onClick={() => handleSelectDrone(drone.id)}
              >
                <div className="flex items-center gap-2">
                  <Plane className="h-5 w-5 text-blue-400" />
                  <span className="font-medium text-white">{drone.id}</span>
                  <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(drone.status)}`}>
                    {drone.status}
                  </span>
                </div>
                <div>
                  <span className="text-sm text-gray-400">{drone.model}</span>
                </div>
              </div>

              {selectedDrone === drone.id && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-900/60 p-3 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Battery className={`h-4 w-4 ${getBatteryColor(drone.batteryLevel || 0)}`} />
                          <span className="text-sm text-gray-400">Battery</span>
                        </div>
                        <div className="text-xl font-light">{drone.batteryLevel || 0}%</div>
                      </div>
                      <div className="bg-gray-900/60 p-3 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Signal className={`h-4 w-4 ${getSignalColor(drone.signalStrength || 0)}`} />
                          <span className="text-sm text-gray-400">Signal</span>
                        </div>
                        <div className="text-xl font-light">{drone.signalStrength || 0}%</div>
                      </div>
                    </div>

                    <div className="bg-gray-900/60 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="h-4 w-4 text-blue-400" />
                        <span className="text-sm text-gray-400">Location</span>
                      </div>
                      <div className="text-md">{drone.location || 'Unknown'}</div>
                    </div>

                    <div className="bg-gray-900/60 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-blue-400" />
                        <span className="text-sm text-gray-400">Last Active</span>
                      </div>
                      <div className="text-md">{drone.lastActive || 'Unknown'}</div>
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

                  <div className="bg-gray-900/60 p-3 rounded-lg h-[250px]">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="h-4 w-4 text-blue-400" />
                      <span className="text-sm text-gray-400">Live Location</span>
                    </div>
                    <div className="h-[200px]">
                      {drone.coordinates && (
                        <DroneLocationMap 
                          location={{
                            lat: drone.coordinates.lat,
                            lng: drone.coordinates.lng,
                            timestamp: drone.lastActive || new Date().toISOString(),
                            area: drone.location?.split(',')[1]?.trim() || 'Unknown Area',
                            city: drone.location?.split(',')[0]?.trim() || 'Unknown City'
                          }}
                        />
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
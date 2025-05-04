// components/DroneControl/DroneControlHub.tsx
import React, { useState, useEffect } from 'react';
import { 
  Plane, // Changed from Drone to Plane, which is available in lucide-react
  Battery, Signal, MapPin, Clock, 
  ArrowUpCircle, AlertTriangle
} from 'lucide-react';
import DroneLocationMap from '../DroneLocationMap';

// Define the drone interface
interface DroneData {
  id: string;
  model: string;
  status: string;
  location: string;
  batteryLevel: number;
  signalStrength: number;
  lastActive: string;
  mission: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

const DroneControlHub: React.FC = () => {
  // Properly type the drones state to fix the error
  const [drones, setDrones] = useState<DroneData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDrone, setSelectedDrone] = useState<string | null>(null);

  // Fetch drone data (simulated)
  useEffect(() => {
    // Simulate API call
    setLoading(true);
    setTimeout(() => {
      setDrones([
        {
          id: 'drone-001',
          model: 'FlyOS-MQ5',
          status: 'ACTIVE',
          location: 'New York, Eastern Sector',
          batteryLevel: 87,
          signalStrength: 92,
          lastActive: '3 min ago',
          mission: 'Surveillance',
          coordinates: { lat: 40.7128, lng: -74.0060 }
        },
        {
          id: 'drone-002',
          model: 'FlyOS-MQ7',
          status: 'MAINTENANCE',
          location: 'Los Angeles, Western Sector',
          batteryLevel: 42,
          signalStrength: 65,
          lastActive: '45 min ago',
          mission: 'Diagnostics',
          coordinates: { lat: 34.0522, lng: -118.2437 }
        },
        {
          id: 'drone-003',
          model: 'FlyOS-MQ9',
          status: 'ACTIVE',
          location: 'Chicago, Northern Sector',
          batteryLevel: 93,
          signalStrength: 98,
          lastActive: '1 min ago',
          mission: 'Transport',
          coordinates: { lat: 41.8781, lng: -87.6298 }
        }
      ]);
      setLoading(false);
    }, 1500);
  }, []);

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
                          <Battery className={`h-4 w-4 ${getBatteryColor(drone.batteryLevel)}`} />
                          <span className="text-sm text-gray-400">Battery</span>
                        </div>
                        <div className="text-xl font-light">{drone.batteryLevel}%</div>
                      </div>
                      <div className="bg-gray-900/60 p-3 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Signal className={`h-4 w-4 ${getSignalColor(drone.signalStrength)}`} />
                          <span className="text-sm text-gray-400">Signal</span>
                        </div>
                        <div className="text-xl font-light">{drone.signalStrength}%</div>
                      </div>
                    </div>

                    <div className="bg-gray-900/60 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="h-4 w-4 text-blue-400" />
                        <span className="text-sm text-gray-400">Location</span>
                      </div>
                      <div className="text-md">{drone.location}</div>
                    </div>

                    <div className="bg-gray-900/60 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-blue-400" />
                        <span className="text-sm text-gray-400">Last Active</span>
                      </div>
                      <div className="text-md">{drone.lastActive}</div>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        className="flex-1 bg-blue-900/30 hover:bg-blue-900/50 text-blue-300 py-2 rounded-lg border border-blue-500/30 flex items-center justify-center gap-2 transition-colors"
                      >
                        <ArrowUpCircle className="h-4 w-4" />
                        <span>Control</span>
                      </button>
                      <button 
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
                            timestamp: new Date().toISOString(),
                            area: drone.location.split(',')[1].trim(),
                            city: drone.location.split(',')[0].trim()
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
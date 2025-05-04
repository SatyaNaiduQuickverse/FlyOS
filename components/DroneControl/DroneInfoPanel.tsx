// components/DroneControl/DroneInfoPanel.tsx
import React from 'react';
import { Plane, Shield, MapPin } from 'lucide-react';

interface Coordinates {
  lat: number;
  lng: number;
}

interface DroneInfoPanelProps {
  drone: {
    id: string;
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
  const getStatusColor = (status: string) => {
    switch(status) {
      case 'ACTIVE': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'STANDBY': return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
      case 'MAINTENANCE': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'OFFLINE': return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  // Simulate drone details that would come from your database
  const droneDetails = {
    serialNumber: `SN-${drone.id.split('-')[1]}-${Math.floor(Math.random() * 10000)}`,
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
          <div className={`text-xs px-2 py-1 rounded-lg border ${getStatusColor(drone.status)}`}>
            {drone.status}
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between items-center p-3 bg-gray-800/80 rounded-lg">
            <span className="text-gray-400">ID:</span>
            <span className="text-white font-light">{drone.id}</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-gray-800/80 rounded-lg">
            <span className="text-gray-400">Model:</span>
            <span className="text-white font-light">{drone.model}</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-gray-800/80 rounded-lg">
            <span className="text-gray-400">Location:</span>
            <span className="text-white font-light">{drone.location}</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-gray-800/80 rounded-lg">
            <span className="text-gray-400">Battery:</span>
            <span className="text-white font-light">{drone.batteryLevel}%</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-gray-800/80 rounded-lg">
            <span className="text-gray-400">Mission:</span>
            <span className="text-white font-light">{droneDetails.currentMission}</span>
          </div>
        </div>
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
      
      {/* Operational limits */}
      <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm border border-gray-800">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="h-5 w-5 text-blue-400" />
          <h3 className="text-sm font-medium text-blue-300">OPERATIONAL LIMITS</h3>
        </div>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-400">Maximum Altitude:</span>
            <span className="text-white">{droneDetails.maxAltitude} meters</span>
          </div>
          
          <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-blue-300" 
              style={{ width: `${((drone.altitude || 0) / droneDetails.maxAltitude) * 100}%` }}
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
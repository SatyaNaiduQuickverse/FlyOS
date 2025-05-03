// components/RegionalConsole.tsx
import React, { useState, useEffect } from 'react';
import { 
  Globe, Shield, CirclePlus, CircleMinus, 
  RefreshCcw, AlertTriangle, CheckCircle,
  MapPin, Maximize, ChevronDown, ChevronUp
} from 'lucide-react';
import DroneLocationMap from './DroneLocationMap';
import GradientText from './GradientText';

// Region interface
interface Region {
  id: string;
  name: string;
  commanderName: string;
  status: 'ACTIVE' | 'INACTIVE';
  area: string;
}

// Drone interface
interface DroneLocation {
  lat: number;
  lng: number;
  timestamp: string;
  area: string;
  city: string;
}

interface Drone {
  id: string;
  model: string;
  status: 'ACTIVE' | 'MAINTENANCE' | 'OFFLINE' | 'STANDBY';
  regionId: string | null;
  lastMaintenance: string;
  batteryStatus: number;
  flightHours: number;
  lastActiveTime: string;
  location: DroneLocation | null;
}

// Notification interface
interface Notification {
  message: string;
  type: 'success' | 'error';
}

// Mock data - will be replaced with API calls
const MOCK_REGIONS: Region[] = [
  { id: 'east', name: 'Eastern Region', commanderName: 'Col. Sarah Mitchell', status: 'ACTIVE', area: 'Eastern Seaboard' },
  { id: 'west', name: 'Western Region', commanderName: 'Maj. David Chen', status: 'ACTIVE', area: 'Pacific Coast' },
  { id: 'north', name: 'Northern Region', commanderName: 'Lt. Col. James Wilson', status: 'INACTIVE', area: 'Great Lakes' },
  { id: 'south', name: 'Southern Region', commanderName: 'Col. Robert Garcia', status: 'ACTIVE', area: 'Gulf Coast' },
];

const MOCK_DRONES: Drone[] = [
  { 
    id: 'drone-001', model: 'FlyOS-MQ5', status: 'ACTIVE', regionId: 'east', 
    lastMaintenance: '2025-04-15', batteryStatus: 98, flightHours: 124, 
    lastActiveTime: '2025-05-02T09:30:00Z',
    location: { lat: 40.7128, lng: -74.0060, timestamp: '2025-05-02T09:30:00Z', area: 'Eastern Seaboard', city: 'New York' }
  },
  { 
    id: 'drone-002', model: 'FlyOS-MQ5', status: 'ACTIVE', regionId: 'east', 
    lastMaintenance: '2025-04-10', batteryStatus: 87, flightHours: 156, 
    lastActiveTime: '2025-05-02T10:45:00Z',
    location: { lat: 39.9526, lng: -75.1652, timestamp: '2025-05-02T10:45:00Z', area: 'Eastern Seaboard', city: 'Philadelphia' }
  },
  { 
    id: 'drone-003', model: 'FlyOS-MQ7', status: 'MAINTENANCE', regionId: 'west', 
    lastMaintenance: '2025-05-01', batteryStatus: 100, flightHours: 89, 
    lastActiveTime: '2025-04-30T16:20:00Z',
    location: { lat: 37.7749, lng: -122.4194, timestamp: '2025-04-30T16:20:00Z', area: 'Pacific Coast', city: 'San Francisco' }
  },
  { 
    id: 'drone-004', model: 'FlyOS-MQ7', status: 'ACTIVE', regionId: 'west', 
    lastMaintenance: '2025-04-22', batteryStatus: 92, flightHours: 114, 
    lastActiveTime: '2025-05-02T08:15:00Z',
    location: { lat: 34.0522, lng: -118.2437, timestamp: '2025-05-02T08:15:00Z', area: 'Pacific Coast', city: 'Los Angeles' }
  },
  { 
    id: 'drone-005', model: 'FlyOS-MQ9', status: 'ACTIVE', regionId: 'south', 
    lastMaintenance: '2025-04-18', batteryStatus: 94, flightHours: 78, 
    lastActiveTime: '2025-05-02T11:10:00Z',
    location: { lat: 29.7604, lng: -95.3698, timestamp: '2025-05-02T11:10:00Z', area: 'Gulf Coast', city: 'Houston' }
  },
  { 
    id: 'drone-006', model: 'FlyOS-MQ9', status: 'OFFLINE', regionId: null, 
    lastMaintenance: '2025-04-05', batteryStatus: 0, flightHours: 203, 
    lastActiveTime: '2025-04-05T18:45:00Z',
    location: null
  },
  { 
    id: 'drone-007', model: 'FlyOS-MQ5', status: 'STANDBY', regionId: null, 
    lastMaintenance: '2025-04-30', batteryStatus: 100, flightHours: 12, 
    lastActiveTime: '2025-04-30T12:30:00Z',
    location: { lat: 41.8781, lng: -87.6298, timestamp: '2025-04-30T12:30:00Z', area: 'Great Lakes', city: 'Chicago' }
  },
  { 
    id: 'drone-008', model: 'FlyOS-MQ7', status: 'ACTIVE', regionId: 'south', 
    lastMaintenance: '2025-04-28', batteryStatus: 89, flightHours: 92, 
    lastActiveTime: '2025-05-02T09:55:00Z',
    location: { lat: 25.7617, lng: -80.1918, timestamp: '2025-05-02T09:55:00Z', area: 'Gulf Coast', city: 'Miami' }
  },
];

const RegionalConsole: React.FC = () => {
  const [regions, setRegions] = useState<Region[]>(MOCK_REGIONS);
  const [drones, setDrones] = useState<Drone[]>(MOCK_DRONES);
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [unassignedOnly, setUnassignedOnly] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [expandedDrone, setExpandedDrone] = useState<string | null>(null);
  const [expandedMap, setExpandedMap] = useState<string | null>(null);

  // Simulate fetching data from API
  useEffect(() => {
    setIsLoading(true);
    
    // Simulate network delay
    setTimeout(() => {
      setRegions(MOCK_REGIONS);
      setDrones(MOCK_DRONES);
      setIsLoading(false);
    }, 800);
  }, []);

  // Filter drones based on selected region and filters
  const filteredDrones = drones.filter(drone => {
    if (unassignedOnly) {
      return drone.regionId === null;
    }
    if (selectedRegion) {
      return drone.regionId === selectedRegion.id;
    }
    return true;
  });
  
  // Group drones by region for the summary
  const dronesByRegion = drones.reduce<Record<string, Drone[]>>((acc, drone) => {
    const regionId = drone.regionId || 'unassigned';
    if (!acc[regionId]) {
      acc[regionId] = [];
    }
    acc[regionId].push(drone);
    return acc;
  }, {});

  // Notification helper
  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleRefresh = () => {
    setIsLoading(true);
    
    // Simulate network delay
    setTimeout(() => {
      // This would be an API call in production
      setRegions(MOCK_REGIONS);
      setDrones(MOCK_DRONES);
      setIsLoading(false);
      showNotification('Data refreshed successfully');
    }, 800);
  };

  const handleAssignDrone = (droneId: string, regionId: string) => {
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      // Update local state
      setDrones(drones.map(drone => 
        drone.id === droneId ? { ...drone, regionId } : drone
      ));
      
      const drone = drones.find(d => d.id === droneId);
      const region = regions.find(r => r.id === regionId);
      
      if (drone && region) {
        showNotification(`${drone.id} assigned to ${region.name}`);
      }
      setIsLoading(false);
    }, 600);
  };

  const handleUnassignDrone = (droneId: string) => {
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      // Update local state
      const drone = drones.find(d => d.id === droneId);
      if (drone && drone.regionId) {
        const previousRegion = regions.find(r => r.id === drone.regionId);
        
        setDrones(drones.map(d => 
          d.id === droneId ? { ...d, regionId: null } : d
        ));
        
        if (previousRegion) {
          showNotification(`${drone.id} removed from ${previousRegion.name}`);
        }
      }
      setIsLoading(false);
    }, 600);
  };

  const toggleExpandDrone = (droneId: string) => {
    if (expandedDrone === droneId) {
      setExpandedDrone(null);
    } else {
      setExpandedDrone(droneId);
      // Close expanded map when switching drones
      setExpandedMap(null);
    }
  };

  const toggleExpandMap = (droneId: string) => {
    if (expandedMap === droneId) {
      setExpandedMap(null);
    } else {
      setExpandedMap(droneId);
      // Ensure the drone details are expanded when expanding map
      setExpandedDrone(droneId);
    }
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return 'N/A';
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const formatDateTime = (dateTimeString: string): string => {
    if (!dateTimeString) return 'N/A';
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateTimeString).toLocaleString(undefined, options);
  };

  const getStatusStyles = (status: string): string => {
    switch(status) {
      case 'ACTIVE':
        return 'bg-blue-500/20 text-blue-300';
      case 'STANDBY':
        return 'bg-indigo-500/20 text-indigo-300';
      case 'MAINTENANCE':
        return 'bg-amber-500/20 text-amber-300';
      case 'OFFLINE':
      case 'INACTIVE':
        return 'bg-rose-500/20 text-rose-300';
      default:
        return 'bg-gray-500/20 text-gray-300';
    }
  };

  const getBatteryStyles = (level: number): string => {
    if (level >= 80) return 'bg-blue-500/20 text-blue-300';
    if (level >= 50) return 'bg-indigo-500/20 text-indigo-300';
    if (level >= 20) return 'bg-amber-500/20 text-amber-300';
    return 'bg-rose-500/20 text-rose-300';
  };
  return (
    <div className="min-h-screen bg-black text-gray-200">
      <div className="max-w-7xl mx-auto">
        <div className="bg-gray-900/80 shadow-2xl rounded-lg overflow-hidden backdrop-blur-sm border border-gray-800">
          {/* Header */}
          <div className="p-6 border-b border-gray-800 flex justify-between items-center">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <Globe className="h-7 w-7 text-blue-400" />
                <GradientText 
                  text="REGIONAL COMMAND" 
                  className="text-2xl tracking-wider font-light"
                />
              </div>
              <div className="h-px w-48 bg-gradient-to-r from-blue-500/40 to-transparent mt-1" />
            </div>
            
            <button 
              onClick={handleRefresh} 
              disabled={isLoading}
              className="bg-gray-800 p-2 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-700 transition-colors disabled:opacity-50 group"
            >
              <RefreshCcw className="h-5 w-5 group-hover:text-blue-400 transition-colors" />
            </button>
          </div>

          {/* Notification */}
          {notification && (
            <div className={`m-6 p-4 rounded-lg border-l-4 ${
              notification.type === 'success' 
                ? 'bg-gray-900/80 border-blue-500 text-blue-300' 
                : 'bg-gray-900/80 border-red-500 text-red-300'
            } flex items-center gap-2 backdrop-blur-sm`}>
              {notification.type === 'success' 
                ? <CheckCircle className="h-5 w-5" /> 
                : <AlertTriangle className="h-5 w-5" />}
              <p className="tracking-wider font-light">{notification.message}</p>
            </div>
          )}

          {/* Dashboard */}
          <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left side - Regions panel */}
            <div className="lg:col-span-1">
              <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm">
                <h3 className="text-lg font-light tracking-wider mb-6 flex items-center gap-2 text-blue-300">
                  <Shield className="h-5 w-5" />
                  COMMAND REGIONS
                </h3>
                
                <div className="space-y-4">
                  {regions.map(region => (
                    <div 
                      key={region.id}
                      onClick={() => setSelectedRegion(selectedRegion?.id === region.id ? null : region)}
                      className={`p-4 rounded-lg cursor-pointer transition-all ${
                        selectedRegion?.id === region.id 
                          ? 'bg-blue-900/20 border border-blue-500/40 hover:bg-blue-900/30' 
                          : 'bg-gray-800/60 border border-gray-800 hover:bg-gray-800/80'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <div className="font-medium tracking-wider text-white">{region.name}</div>
                        <div className={`text-xs px-2 py-1 rounded-md ${
                          region.status === 'ACTIVE' 
                            ? 'bg-blue-500/20 text-blue-300' 
                            : 'bg-gray-700/70 text-gray-400'
                        }`}>
                          {region.status}
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-400 mb-2">{region.commanderName}</div>
                      <div className="text-sm text-gray-500 mb-3">{region.area}</div>
                      
                      <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
                        <div className="bg-gray-800/80 px-3 py-2 rounded-lg text-center">
                          <span className="block font-light text-xl text-white">
                            {(dronesByRegion[region.id] || []).length}
                          </span>
                          <span className="text-xs text-gray-400 tracking-wider">TOTAL DRONES</span>
                        </div>
                        
                        <div className="bg-gray-800/80 px-3 py-2 rounded-lg text-center">
                          <span className="block font-light text-xl text-white">
                            {(dronesByRegion[region.id] || []).filter(d => d.status === 'ACTIVE').length}
                          </span>
                          <span className="text-xs text-gray-400 tracking-wider">ACTIVE</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="mt-6">
                    <div className="bg-gray-800/80 p-4 rounded-lg">
                      <div className="flex justify-between items-center">
                        <div className="font-medium tracking-wider text-gray-300">Unassigned Drones</div>
                        <div className="text-xl font-light text-white">
                          {(dronesByRegion['unassigned'] || []).length}
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <button
                          onClick={() => {
                            setSelectedRegion(null);
                            setUnassignedOnly(!unassignedOnly);
                          }}
                          className={`w-full py-2 px-3 rounded-lg text-sm tracking-wider ${
                            unassignedOnly
                              ? 'bg-blue-900/20 border border-blue-500/40 text-blue-300'
                              : 'bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700'
                          }`}
                        >
                          {unassignedOnly ? 'SHOWING UNASSIGNED' : 'SHOW UNASSIGNED'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side - Drones panel */}
            <div className="lg:col-span-2">
              <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm h-full">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-light tracking-wider flex items-center gap-2 text-blue-300">
                    {selectedRegion 
                      ? <>
                          <Shield className="h-5 w-5" />
                          {selectedRegion.name} DRONES
                        </>
                      : unassignedOnly
                        ? <>
                            <CirclePlus className="h-5 w-5" />
                            UNASSIGNED DRONES
                          </>
                        : <>
                            <Globe className="h-5 w-5" />
                            ALL DRONES ({drones.length})
                          </>
                    }
                  </h3>
                </div>

                {isLoading ? (
                  <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-2 border-gray-600 border-t-blue-500"></div>
                  </div>
                ) : filteredDrones.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                    <AlertTriangle className="h-12 w-12 mb-4 text-gray-500" />
                    <p className="text-lg tracking-wider font-light">No drones found</p>
                    <p className="text-sm mt-2">Try selecting a different region or filter</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 drone-list">
                    {filteredDrones.map(drone => (
                      <div 
                        key={drone.id}
                        className="rounded-lg border border-gray-800 bg-gray-800/50 hover:bg-gray-800/80 transition-colors overflow-hidden backdrop-blur-sm"
                      >
                        {/* Drone header - always visible */}
                        <div 
                          className="p-4 cursor-pointer"
                          onClick={() => toggleExpandDrone(drone.id)}
                        >
                          <div className="flex flex-wrap justify-between items-center mb-3">
                            <div className="flex items-center gap-2">
                              <div className="font-medium tracking-wider text-white">{drone.id}</div>
                              {expandedDrone === drone.id ? (
                                <ChevronUp className="h-4 w-4 text-gray-400" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-gray-400" />
                              )}
                            </div>
                            <div className={`text-xs px-2 py-1 rounded-md ${getStatusStyles(drone.status)}`}>
                              {drone.status}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="text-sm">
                              <div className="text-gray-400 mb-1">Model</div>
                              <div className="text-white">{drone.model}</div>
                            </div>
                            
                            <div className="text-sm">
                              <div className="text-gray-400 mb-1">Battery</div>
                              <div className={`text-sm px-2 py-1 rounded inline-block ${getBatteryStyles(drone.batteryStatus)}`}>
                                {drone.batteryStatus}%
                              </div>
                            </div>
                            
                            <div className="text-sm">
                              <div className="text-gray-400 mb-1">Last Active</div>
                              <div className="text-white">{formatDateTime(drone.lastActiveTime)}</div>
                            </div>
                            
                            <div className="text-sm">
                              <div className="text-gray-400 mb-1">Location</div>
                              <div className="flex items-center gap-1">
                                {drone.location ? (
                                  <>
                                    <MapPin className="h-3 w-3 text-blue-400" />
                                    <span className="text-white">{drone.location.city}</span>
                                  </>
                                ) : (
                                  <span className="text-gray-500">Unknown</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Expanded drone details */}
                        {expandedDrone === drone.id && (
                          <div className="px-4 pb-4 border-t border-gray-700 pt-4 bg-gray-800/80">
                            <div className="grid grid-cols-1 gap-4">
                              {/* Map section */}
                              {drone.location && (
                                <div className="bg-gray-900/70 p-4 rounded-lg">
                                  <div className="flex justify-between items-center mb-2">
                                    <h4 className="text-sm font-medium tracking-wider flex items-center gap-2 text-blue-300">
                                      <MapPin className="h-4 w-4" />
                                      LAST KNOWN LOCATION
                                    </h4>
                                    <button
                                      onClick={() => toggleExpandMap(drone.id)}
                                      className="text-gray-400 hover:text-white"
                                    >
                                      <Maximize className="h-4 w-4" />
                                    </button>
                                  </div>
                                  
                                  <div className="mb-3 text-xs text-gray-400">
                                    Last updated: {formatDateTime(drone.location.timestamp)}
                                  </div>
                                  
                                  <div className="flex flex-col md:flex-row gap-4">
                                    <div className={`${expandedMap === drone.id ? 'w-full h-64' : 'w-full h-40 md:w-1/2'} bg-gray-800 rounded-lg overflow-hidden border border-gray-700`}>
                                      <DroneLocationMap 
                                        location={drone.location} 
                                        expanded={expandedMap === drone.id}
                                      />
                                    </div>
                                    
                                    {expandedMap !== drone.id && (
                                      <div className="w-full md:w-1/2 text-sm space-y-3">
                                        <div className="bg-gray-800/80 p-2 rounded flex justify-between">
                                          <span className="text-gray-400">City:</span> 
                                          <span className="text-white">{drone.location.city}</span>
                                        </div>
                                        <div className="bg-gray-800/80 p-2 rounded flex justify-between">
                                          <span className="text-gray-400">Area:</span> 
                                          <span className="text-white">{drone.location.area}</span>
                                        </div>
                                        <div className="bg-gray-800/80 p-2 rounded flex justify-between">
                                          <span className="text-gray-400">Coordinates:</span> 
                                          <span className="text-white">{drone.location.lat.toFixed(4)}, {drone.location.lng.toFixed(4)}</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                              
                              {/* Additional details */}
                              <div className="grid grid-cols-3 gap-3">
                                <div className="bg-gray-900/70 p-3 rounded-lg">
                                  <div className="text-gray-400 text-xs mb-1">Flight Hours</div>
                                  <div className="text-2xl font-light text-white">{drone.flightHours}</div>
                                  <div className="text-blue-400 text-xs">HOURS</div>
                                </div>
                                <div className="bg-gray-900/70 p-3 rounded-lg">
                                  <div className="text-gray-400 text-xs mb-1">Last Maintenance</div>
                                  <div className="text-md font-light text-white">{formatDate(drone.lastMaintenance)}</div>
                                </div>
                                <div className="bg-gray-900/70 p-3 rounded-lg">
                                  <div className="text-gray-400 text-xs mb-1">Region</div>
                                  <div className="text-md font-light text-white">
                                    {drone.regionId 
                                      ? regions.find(r => r.id === drone.regionId)?.name || 'Unknown' 
                                      : 'Unassigned'}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Assignment actions */}
                              <div className="flex justify-end items-center gap-2 mt-2 pt-3 border-t border-gray-700">
                                {drone.regionId ? (
                                  <div className="flex items-center gap-3">
                                    <div className="text-sm text-gray-400">
                                      Assigned to: <span className="text-blue-300">
                                        {regions.find(r => r.id === drone.regionId)?.name || 'Unknown'}
                                      </span>
                                    </div>
                                    <button
                                      onClick={() => handleUnassignDrone(drone.id)}
                                      disabled={isLoading || drone.status === 'OFFLINE'}
                                      className="p-2 rounded-lg border border-rose-500/30 text-rose-300 
                                                bg-rose-900/10 hover:bg-rose-900/30 transition-colors
                                                disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="Unassign drone"
                                    >
                                      <CircleMinus className="h-4 w-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    {selectedRegion ? (
                                      <button
                                        onClick={() => handleAssignDrone(drone.id, selectedRegion.id)}
                                        disabled={isLoading || drone.status === 'OFFLINE'}
                                        className="py-1 px-3 rounded-lg border border-blue-500/30 text-blue-300 
                                                  bg-blue-900/20 hover:bg-blue-900/30 transition-colors
                                                  disabled:opacity-50 disabled:cursor-not-allowed
                                                  flex items-center gap-1 text-sm tracking-wider"
                                      >
                                        <CirclePlus className="h-4 w-4" />
                                        <span>Assign to {selectedRegion.name}</span>
                                      </button>
                                    ) : (
                                      <div className="flex gap-2">
                                        <select
                                          disabled={isLoading || drone.status === 'OFFLINE'}
                                          onChange={(e) => {
                                            if (e.target.value) {
                                              handleAssignDrone(drone.id, e.target.value);
                                            }
                                          }}
                                          className="bg-gray-800 border border-gray-700 text-sm
                                                    rounded-lg p-2 text-white focus:border-blue-500
                                                    disabled:opacity-50 disabled:cursor-not-allowed"
                                          defaultValue=""
                                        >
                                          <option value="" disabled>Assign to region...</option>
                                          {regions.filter(r => r.status === 'ACTIVE').map(region => (
                                            <option key={region.id} value={region.id}>
                                              {region.name}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    )}
                                  </>
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegionalConsole;  
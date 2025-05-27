// components/MissionPlanner.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Route, Download, Trash2, Plane, Target, Square, 
  RotateCcw, Clock, Settings, X, Crosshair, Maximize2
} from 'lucide-react';

// Types and interfaces
interface HomePosition {
  lat: number;
  lng: number;
  alt: number;
}

interface MissionItem {
  id: string;
  type: 'takeoff' | 'waypoint' | 'land' | 'rtl' | 'delay' | 'loiter';
  seq: number;
  lat?: number;
  lng?: number;
  alt?: number;
  speed?: number;
  duration?: number;
  radius?: number;
  turns?: number;
}

interface MissionSettings {
  defaultAltitude: number;
  defaultSpeed: number;
  takeoffAltitude: number;
  landingMode: 'auto' | 'manual';
}

interface MissionStats {
  waypointCount: number;
  totalDistance: string;
  estimatedTime: number;
}

// MAVLink command types
const MISSION_COMMANDS = {
  HOME: 16,
  TAKEOFF: 22,
  WAYPOINT: 16,
  LAND: 21,
  RTL: 20,
  LOITER: 18,
  DELAY: 93,
  SPEED: 178
} as const;

// Utility functions
const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const calculateMissionStats = (mission: MissionItem[], defaultSpeed: number): MissionStats => {
  let totalDistance = 0;
  let estimatedTime = 0;
  let waypointCount = 0;
  let previousWaypoint: MissionItem | null = null;

  for (const item of mission) {
    if (item.type === 'waypoint' && item.lat && item.lng) {
      waypointCount++;
      
      if (previousWaypoint && previousWaypoint.lat && previousWaypoint.lng) {
        const distance = calculateDistance(
          previousWaypoint.lat, 
          previousWaypoint.lng, 
          item.lat, 
          item.lng
        );
        totalDistance += distance;
        estimatedTime += distance / (item.speed || defaultSpeed);
      }
      
      previousWaypoint = item;
    } else if (item.type === 'delay') {
      estimatedTime += item.duration || 0;
    } else if (item.type === 'takeoff') {
      estimatedTime += (item.alt || 0) / 2;
    }
  }

  return {
    waypointCount,
    totalDistance: totalDistance.toFixed(0),
    estimatedTime: Math.ceil(estimatedTime)
  };
};

const generateMissionFile = (mission: MissionItem[], homePosition: HomePosition): void => {
  let fileContent = 'QGC WPL 110\n';
  
  // Home position (sequence 0)
  fileContent += `0\t1\t0\t${MISSION_COMMANDS.HOME}\t0\t0\t0\t0\t${homePosition.lat}\t${homePosition.lng}\t${homePosition.alt}\t1\n`;
  
  let seqNum = 1;
  
  mission.forEach((item) => {
    switch (item.type) {
      case 'takeoff':
        fileContent += `${seqNum}\t0\t3\t${MISSION_COMMANDS.TAKEOFF}\t0.00000000\t0.00000000\t0.00000000\t0.00000000\t0.00000000\t0.00000000\t${(item.alt || 0).toFixed(6)}\t1\n`;
        break;
        
      case 'waypoint':
        if (item.lat && item.lng) {
          fileContent += `${seqNum}\t0\t3\t${MISSION_COMMANDS.WAYPOINT}\t0.00000000\t0.00000000\t0.00000000\t0.00000000\t${item.lat.toFixed(8)}\t${item.lng.toFixed(8)}\t${(item.alt || 0).toFixed(6)}\t1\n`;
        }
        break;
        
      case 'delay':
        fileContent += `${seqNum}\t0\t0\t${MISSION_COMMANDS.DELAY}\t${(item.duration || 0).toFixed(8)}\t0.00000000\t0.00000000\t0.00000000\t0.00000000\t0.00000000\t0.000000\t1\n`;
        break;
        
      case 'land':
        fileContent += `${seqNum}\t0\t3\t${MISSION_COMMANDS.LAND}\t0.00000000\t0.00000000\t0.00000000\t0.00000000\t0.00000000\t0.00000000\t0.000000\t1\n`;
        break;
        
      case 'rtl':
        fileContent += `${seqNum}\t0\t3\t${MISSION_COMMANDS.RTL}\t0.00000000\t0.00000000\t0.00000000\t0.00000000\t0.00000000\t0.00000000\t0.000000\t1\n`;
        break;
    }
    seqNum++;
  });

  // Create and download file
  const blob = new Blob([fileContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mission_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Main component
const MissionPlanner: React.FC = () => {
  // Core state
  const [mission, setMission] = useState<MissionItem[]>([]);
  const [homePosition] = useState<HomePosition>({ 
    lat: 18.519239, 
    lng: 73.857816, 
    alt: 571.773581 
  });
  const [selectedWaypoint, setSelectedWaypoint] = useState<number | null>(null);
  const [isAddingWaypoints, setIsAddingWaypoints] = useState(false);
  const [missionSettings, setMissionSettings] = useState<MissionSettings>({
    defaultAltitude: 10,
    defaultSpeed: 5,
    takeoffAltitude: 70,
    landingMode: 'auto'
  });

  // Map state
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [markers, setMarkers] = useState<any[]>([]);
  const [routeLine, setRouteLine] = useState<any>(null);

  // Initialize map
  useEffect(() => {
    const initMap = async () => {
      if (typeof window === 'undefined' || !mapRef.current) return;
      
      const L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');

      // Fix marker icons
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      });

      const mapInstance = L.map(mapRef.current, {
        center: [homePosition.lat, homePosition.lng],
        zoom: 18,
        zoomControl: false,
        attributionControl: false
      });

      // ArcGIS satellite layer
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 23
      }).addTo(mapInstance);

      // Home marker
      const homeIcon = L.divIcon({
        html: `<div class="home-marker">
          <div class="home-center"></div>
          <div class="home-ring"></div>
        </div>`,
        className: 'custom-home-marker',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      L.marker([homePosition.lat, homePosition.lng], { icon: homeIcon })
        .addTo(mapInstance)
        .bindTooltip(`HOME • ${homePosition.alt.toFixed(0)}m`, { 
          permanent: false, 
          direction: 'top',
          className: 'custom-tooltip'
        });

      // Map click handler
      mapInstance.on('click', (e: any) => {
        if (isAddingWaypoints) {
          addWaypoint(e.latlng.lat, e.latlng.lng);
        }
      });

      setMap(mapInstance);
    };

    initMap();

    return () => {
      if (map) {
        map.remove();
      }
    };
  }, []);

  // Update markers and route
  useEffect(() => {
    if (!map) return;

    // Clear existing markers and route
    markers.forEach(marker => map.removeLayer(marker));
    if (routeLine) map.removeLayer(routeLine);

    const newMarkers: any[] = [];
    const routePoints: [number, number][] = [];

    // Create waypoint markers
    mission.forEach((item, index) => {
      if (item.type === 'waypoint' && item.lat && item.lng) {
        const isSelected = selectedWaypoint === index;
        
        const waypointIcon = L.divIcon({
          html: `<div class="waypoint-marker ${isSelected ? 'selected' : ''}">
            <div class="waypoint-number">${index + 1}</div>
            <div class="waypoint-dot"></div>
          </div>`,
          className: 'custom-waypoint-marker',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        const marker = L.marker([item.lat, item.lng], { 
          icon: waypointIcon,
          draggable: true 
        })
          .addTo(map)
          .bindTooltip(`WP${index + 1} • ${item.alt}m • ${item.speed}m/s`, {
            permanent: false,
            direction: 'top',
            className: 'custom-tooltip'
          });

        marker.on('click', () => setSelectedWaypoint(index));
        
        marker.on('dragend', (e: any) => {
          const newPos = e.target.getLatLng();
          updateWaypoint(index, { 
            lat: parseFloat(newPos.lat.toFixed(8)), 
            lng: parseFloat(newPos.lng.toFixed(8)) 
          });
        });

        newMarkers.push(marker);
        routePoints.push([item.lat, item.lng]);
      }
    });

    // Create route line
    if (routePoints.length > 1) {
      const polyline = L.polyline(routePoints, {
        color: '#ffffff',
        weight: 2,
        opacity: 0.8,
        dashArray: '5, 5'
      }).addTo(map);
      setRouteLine(polyline);
    }

    setMarkers(newMarkers);
  }, [mission, map, selectedWaypoint]);

  // Mission operations
  const addWaypoint = useCallback((lat: number, lng: number) => {
    const newWaypoint: MissionItem = {
      id: `wp_${Date.now()}`,
      type: 'waypoint',
      lat: parseFloat(lat.toFixed(8)),
      lng: parseFloat(lng.toFixed(8)),
      alt: missionSettings.defaultAltitude,
      speed: missionSettings.defaultSpeed,
      seq: mission.length
    };
    setMission(prev => [...prev, newWaypoint]);
  }, [mission.length, missionSettings]);

  const updateWaypoint = useCallback((index: number, updates: Partial<MissionItem>) => {
    setMission(prev => prev.map((item, i) => 
      i === index ? { ...item, ...updates } : item
    ));
  }, []);

  const removeWaypoint = useCallback((index: number) => {
    setMission(prev => prev.filter((_, i) => i !== index).map((item, i) => ({
      ...item,
      seq: i
    })));
    setSelectedWaypoint(null);
  }, []);

  const addMissionCommand = useCallback((commandType: string) => {
    let newCommand: MissionItem;
    
    switch (commandType) {
      case 'takeoff':
        newCommand = {
          id: `takeoff_${Date.now()}`,
          type: 'takeoff',
          alt: missionSettings.takeoffAltitude,
          seq: mission.length
        };
        break;
      case 'land':
        newCommand = {
          id: `land_${Date.now()}`,
          type: 'land',
          seq: mission.length
        };
        break;
      case 'rtl':
        newCommand = {
          id: `rtl_${Date.now()}`,
          type: 'rtl',
          seq: mission.length
        };
        break;
      case 'delay':
        newCommand = {
          id: `delay_${Date.now()}`,
          type: 'delay',
          duration: 5,
          seq: mission.length
        };
        break;
      default:
        return;
    }
    
    setMission(prev => [...prev, newCommand]);
  }, [mission.length, missionSettings]);

  const clearMission = useCallback(() => {
    setMission([]);
    setSelectedWaypoint(null);
  }, []);

  const handleDownloadMission = useCallback(() => {
    if (mission.length === 0) {
      alert('Mission is empty. Add some waypoints first.');
      return;
    }
    generateMissionFile(mission, homePosition);
  }, [mission, homePosition]);

  const handleSettingChange = (key: keyof MissionSettings, value: number) => {
    setMissionSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Calculate mission statistics
  const missionStats = calculateMissionStats(mission, missionSettings.defaultSpeed);

  // Command configuration
  const commands = [
    {
      id: 'takeoff',
      label: 'Takeoff',
      icon: Plane,
      className: 'bg-white text-black hover:bg-gray-200'
    },
    {
      id: 'waypoint',
      label: isAddingWaypoints ? 'Stop Adding' : 'Add Waypoint',
      icon: Target,
      className: isAddingWaypoints 
        ? 'bg-red-600 text-white hover:bg-red-700' 
        : 'border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400',
      onClick: () => setIsAddingWaypoints(!isAddingWaypoints)
    },
    {
      id: 'delay',
      label: 'Delay 5s',
      icon: Clock,
      className: 'border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400'
    },
    {
      id: 'land',
      label: 'Land',
      icon: Square,
      className: 'border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400'
    },
    {
      id: 'rtl',
      label: 'Return Home',
      icon: RotateCcw,
      className: 'border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400'
    }
  ];

  const settingsConfig = [
    {
      key: 'defaultAltitude' as const,
      label: 'Default Altitude',
      value: missionSettings.defaultAltitude,
      unit: 'm',
      min: 1,
      max: 500
    },
    {
      key: 'defaultSpeed' as const,
      label: 'Default Speed',
      value: missionSettings.defaultSpeed,
      unit: 'm/s',
      min: 1,
      max: 30
    },
    {
      key: 'takeoffAltitude' as const,
      label: 'Takeoff Altitude',
      value: missionSettings.takeoffAltitude,
      unit: 'm',
      min: 5,
      max: 200
    }
  ];

  const getCommandIcon = (type: string) => {
    switch (type) {
      case 'takeoff': return '↑';
      case 'waypoint': return '•';
      case 'land': return '↓';
      case 'rtl': return '⌂';
      case 'delay': return '⏱';
      default: return '•';
    }
  };

  const getCommandColor = (type: string) => {
    switch (type) {
      case 'takeoff': return 'text-green-400';
      case 'waypoint': return 'text-white';
      case 'land': return 'text-orange-400';
      case 'rtl': return 'text-blue-400';
      case 'delay': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Route className="h-6 w-6 text-white" />
          <h2 className="text-2xl font-light text-white tracking-wide">Mission Planner</h2>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-400 font-mono">
            {missionStats.waypointCount} WP • {missionStats.totalDistance}m • {Math.floor(missionStats.estimatedTime / 60)}:{(missionStats.estimatedTime % 60).toString().padStart(2, '0')}
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={clearMission}
              className="p-2 text-gray-400 hover:text-red-400 transition-colors"
              title="Clear Mission"
            >
              <Trash2 className="h-5 w-5" />
            </button>
            
            <button
              onClick={handleDownloadMission}
              disabled={mission.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-white text-black hover:bg-gray-100 disabled:bg-gray-600 disabled:text-gray-400 transition-colors font-medium"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Main Interface */}
      <div className="grid grid-cols-12 gap-6">
        {/* Map */}
        <div className="col-span-8">
          <div className="relative h-[500px] bg-black border border-gray-800 overflow-hidden">
            <div ref={mapRef} className="h-full w-full" />
            
            {/* Map overlay */}
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/80 px-3 py-2 border border-gray-800">
              <Crosshair className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-400 font-mono">
                {isAddingWaypoints ? 'Click to add waypoint' : 'Waypoint mode off'}
              </span>
            </div>

            {/* Fullscreen button */}
            <button className="absolute top-4 right-4 p-2 bg-black/80 border border-gray-800 text-gray-400 hover:text-white transition-colors">
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Controls Panel */}
        <div className="col-span-4 space-y-6">
          {/* Mission Controls */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-white tracking-wide">COMMANDS</h3>
            
            <div className="grid grid-cols-1 gap-2">
              {commands.map((command) => {
                const Icon = command.icon;
                
                return (
                  <button
                    key={command.id}
                    onClick={command.onClick || (() => addMissionCommand(command.id))}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors font-medium ${command.className}`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-sm">{command.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mission Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-white tracking-wide">SETTINGS</h3>
            
            <div className="space-y-4">
              {settingsConfig.map((setting) => (
                <div key={setting.key}>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs text-gray-400 font-mono">
                      {setting.label}
                    </label>
                    <span className="text-xs text-gray-500 font-mono">
                      {setting.value}{setting.unit}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={setting.min}
                      max={setting.max}
                      value={setting.value}
                      onChange={(e) => handleSettingChange(setting.key, parseInt(e.target.value))}
                      className="flex-1 h-1 bg-gray-700 appearance-none slider"
                    />
                    
                    <input
                      type="number"
                      min={setting.min}
                      max={setting.max}
                      value={setting.value}
                      onChange={(e) => handleSettingChange(setting.key, parseInt(e.target.value))}
                      className="w-16 px-2 py-1 bg-black border border-gray-600 text-white text-xs font-mono focus:outline-none focus:border-gray-400"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mission List */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-white tracking-wide">MISSION SEQUENCE</h3>
            
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {mission.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-2xl mb-2">○</div>
                  <div className="text-xs font-mono">No commands</div>
                </div>
              ) : (
                mission.map((item, index) => (
                  <div
                    key={item.id}
                    className={`group flex items-center gap-3 px-3 py-2 border transition-colors cursor-pointer ${
                      selectedWaypoint === index
                        ? 'bg-white/5 border-white/20'
                        : 'border-gray-800 hover:border-gray-600'
                    }`}
                    onClick={() => setSelectedWaypoint(selectedWaypoint === index ? null : index)}
                  >
                    {/* Sequence number */}
                    <div className="w-6 h-6 flex items-center justify-center bg-black border border-gray-600 text-xs font-mono text-gray-400">
                      {index + 1}
                    </div>

                    {/* Command icon */}
                    <div className={`w-4 text-center font-mono ${getCommandColor(item.type)}`}>
                      {getCommandIcon(item.type)}
                    </div>

                    {/* Command details */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white capitalize">
                        {item.type}
                      </div>
                      
                      {item.type === 'waypoint' && (
                        <div className="flex gap-4 text-xs text-gray-400 font-mono">
                          <span>ALT {item.alt}m</span>
                          <span>SPD {item.speed}m/s</span>
                        </div>
                      )}
                      
                      {item.type === 'takeoff' && (
                        <div className="text-xs text-gray-400 font-mono">
                          ALT {item.alt}m
                        </div>
                      )}
                      
                      {item.type === 'delay' && (
                        <div className="text-xs text-gray-400 font-mono">
                          {item.duration}s
                        </div>
                      )}
                      
                      {item.type === 'waypoint' && item.lat && item.lng && (
                        <div className="text-xs text-gray-500 font-mono">
                          {item.lat.toFixed(6)}, {item.lng.toFixed(6)}
                        </div>
                      )}
                    </div>

                    {/* Editable fields for selected items */}
                    {selectedWaypoint === index && item.type === 'waypoint' && (
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={item.alt || 0}
                          onChange={(e) => updateWaypoint(index, { alt: parseInt(e.target.value) })}
                          className="w-12 px-1 py-1 bg-black border border-gray-600 text-white text-xs font-mono focus:outline-none focus:border-gray-400"
                          placeholder="Alt"
                        />
                        <input
                          type="number"
                          value={item.speed || 0}
                          onChange={(e) => updateWaypoint(index, { speed: parseInt(e.target.value) })}
                          className="w-12 px-1 py-1 bg-black border border-gray-600 text-white text-xs font-mono focus:outline-none focus:border-gray-400"
                          placeholder="Spd"
                        />
                      </div>
                    )}

                    {/* Remove button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeWaypoint(index);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 transition-all"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Custom Styles */}
      <style jsx global>{`
        .leaflet-container {
          background: #000000 !important;
        }
        
        .custom-tooltip {
          background: rgba(0, 0, 0, 0.9) !important;
          border: 1px solid #374151 !important;
          color: #ffffff !important;
          font-family: 'Courier New', monospace !important;
          font-size: 11px !important;
          border-radius: 0 !important;
        }
        
        .custom-tooltip:before {
          border-top-color: #374151 !important;
        }

        .home-marker {
          width: 20px;
          height: 20px;
          position: relative;
        }
        
        .home-center {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 4px;
          height: 4px;
          background: #ffffff;
          transform: translate(-50%, -50%);
        }
        
        .home-ring {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 16px;
          height: 16px;
          border: 1px solid #ffffff;
          transform: translate(-50%, -50%);
          opacity: 0.8;
        }

        .waypoint-marker {
          width: 24px;
          height: 24px;
          position: relative;
        }
        
        .waypoint-marker.selected .waypoint-dot {
          background: #ffffff;
          border: 2px solid #000000;
        }
        
        .waypoint-number {
          position: absolute;
          top: -6px;
          left: 50%;
          transform: translateX(-50%);
          background: #000000;
          color: #ffffff;
          padding: 1px 4px;
          font-size: 10px;
          font-weight: 600;
          font-family: 'Courier New', monospace;
          border: 1px solid #ffffff;
          min-width: 14px;
          text-align: center;
        }
        
        .waypoint-dot {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 6px;
          height: 6px;
          background: #6b7280;
          transform: translate(-50%, -50%);
          border: 1px solid #ffffff;
        }

        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 12px;
          width: 12px;
          background: #ffffff;
          cursor: pointer;
        }
        
        .slider::-moz-range-thumb {
          height: 12px;
          width: 12px;
          background: #ffffff;
          cursor: pointer;
          border: none;
        }

        .space-y-1::-webkit-scrollbar {
          width: 2px;
        }
        
        .space-y-1::-webkit-scrollbar-track {
          background: #000000;
        }
        
        .space-y-1::-webkit-scrollbar-thumb {
          background: #374151;
        }
        
        .space-y-1::-webkit-scrollbar-thumb:hover {
          background: #4b5563;
        }
      `}</style>
    </div>
  );
};

export default MissionPlanner;

// components/MissionPlanner.tsx - FIXED COMPLETE VERSION PART 1
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Route, Download, Trash2, Plane, Target, Square, 
  RotateCcw, Clock, Settings, X, Crosshair, Maximize2,
  MapPin, Navigation, Activity, Sliders, Play, Pause,
  GripVertical, Mountain, Layers
} from 'lucide-react';

// Mission Types Constants
const MISSION_TYPES = {
  TAKEOFF: 'takeoff',
  WAYPOINT: 'waypoint',
  LAND: 'land',
  RTH: 'rtl',
  WAIT: 'delay',
  CIRCLE: 'circle',
  SPEED_CHANGE: 'speed'
} as const;

// MAVLink command constants
const MAVLINK_COMMANDS = {
  HOME: 16,
  TAKEOFF: 22,
  WAYPOINT: 16,
  LAND: 21,
  RTL: 20,
  LOITER: 18,
  DELAY: 93,
  SPEED: 178
} as const;

// Altitude reference types
type AltitudeReference = 'MSL' | 'AGL';

// Types and interfaces
interface HomePosition {
  lat: number;
  lng: number;
  alt: number;
}

interface MissionItem {
  id: string;
  type: string;
  seq: number;
  lat?: number;
  lng?: number;
  alt?: number;
  speed?: number;
  duration?: number;
  radius?: number;
  turns?: number;
  hoverTime?: number;
}

interface MissionSettings {
  defaultAltitude: number;
  defaultSpeed: number;
  takeoffAltitude: number;
  waitTime: number;
  circleRadius: number;
  circleTurns: number;
  altitudeReference: AltitudeReference;
  groundElevation: number;
}

interface MissionStats {
  waypointCount: number;
  totalDistance: string;
  estimatedTime: string;
}

// Utility functions
const calculateDistance = (lat1: number, lng1: number, alt1: number, lat2: number, lng2: number, alt2: number): number => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const deltaAlt = alt2 - alt1;
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const horizontalDistance = R * c;
  
  return Math.sqrt(horizontalDistance * horizontalDistance + deltaAlt * deltaAlt);
};

const calculateMissionStats = (mission: MissionItem[], mapCenter: [number, number], settings: MissionSettings): MissionStats => {
  let totalDistance = 0;
  let totalTime = 0;
  let currentAlt = 0;
  let currentSpeed = settings.defaultSpeed;
  let waypointCount = 0;
  let prevPoint: { lat: number; lng: number; alt: number } | null = null;

  mission.forEach((point) => {
    if (point.type === MISSION_TYPES.SPEED_CHANGE) {
      currentSpeed = point.speed || settings.defaultSpeed;
      return;
    }

    if (point.type === MISSION_TYPES.TAKEOFF) {
      currentAlt = point.alt || settings.takeoffAltitude;
      const takeoffTime = currentAlt / 2;
      totalTime += takeoffTime;
      totalDistance += currentAlt;
      prevPoint = {
        lat: mapCenter[0],
        lng: mapCenter[1],
        alt: currentAlt
      };
      return;
    }

    if (point.type === MISSION_TYPES.WAYPOINT && point.lat && point.lng) {
      waypointCount++;
      
      if (prevPoint) {
        const pointAlt = convertAltitude(point.alt || settings.defaultAltitude, settings);
        const distance = calculateDistance(
          prevPoint.lat, prevPoint.lng, prevPoint.alt,
          point.lat, point.lng, pointAlt
        );
        totalDistance += distance;
        totalTime += distance / currentSpeed;

        if (point.hoverTime) {
          totalTime += point.hoverTime;
        }
      }

      prevPoint = {
        lat: point.lat,
        lng: point.lng,
        alt: convertAltitude(point.alt || settings.defaultAltitude, settings)
      };
      return;
    }

    if (point.type === MISSION_TYPES.WAIT) {
      totalTime += point.duration || settings.waitTime;
      return;
    }

    if (point.type === MISSION_TYPES.LAND) {
      const landingDistance = currentAlt;
      totalDistance += landingDistance;
      totalTime += landingDistance / 2;
      return;
    }

    if (point.type === MISSION_TYPES.CIRCLE) {
      const circumference = 2 * Math.PI * (point.radius || settings.circleRadius);
      const totalCircleDistance = circumference * (point.turns || settings.circleTurns);
      totalDistance += totalCircleDistance;
      totalTime += totalCircleDistance / currentSpeed;
      return;
    }
  });

  return {
    waypointCount,
    totalDistance: totalDistance.toFixed(1),
    estimatedTime: totalTime.toFixed(1)
  };
};

// Altitude conversion functions
const convertAltitude = (altitude: number, settings: MissionSettings): number => {
  if (settings.altitudeReference === 'AGL') {
    return altitude + settings.groundElevation;
  }
  return altitude; // MSL
};

const displayAltitude = (altitude: number, settings: MissionSettings): number => {
  if (settings.altitudeReference === 'AGL') {
    return Math.max(0, altitude - settings.groundElevation);
  }
  return altitude; // MSL
};

const validateMission = (mission: MissionItem[]): string | null => {
  if (mission.length === 0) return "Mission cannot be empty";
  
  const firstCommand = mission[0];
  if (firstCommand?.type !== MISSION_TYPES.TAKEOFF) {
    return 'Mission must start with takeoff';
  }
  
  const lastCommand = mission[mission.length - 1];
  if (![MISSION_TYPES.LAND, MISSION_TYPES.RTH].includes(lastCommand?.type)) {
    return 'Mission must end with land or return to home';
  }
  
  return null;
};

const generateMissionFile = (mission: MissionItem[], mapCenter: [number, number], settings: MissionSettings): void => {
  const validationError = validateMission(mission);
  if (validationError) {
    alert(validationError);
    return;
  }

  let fileContent = 'QGC WPL 110\n';
  let currentSpeed = settings.defaultSpeed;

  // Add home position (sequence 0)
  const homeAltMSL = convertAltitude(settings.defaultAltitude, settings);
  fileContent += `0\t1\t0\t${MAVLINK_COMMANDS.HOME}\t0\t0\t0\t0\t${mapCenter[0]}\t${mapCenter[1]}\t${homeAltMSL}\t1\n`;

  mission.forEach((point, index) => {
    const seq = index + 1;
    
    switch (point.type) {
      case MISSION_TYPES.SPEED_CHANGE:
        currentSpeed = point.speed || settings.defaultSpeed;
        fileContent += `${seq}\t0\t3\t${MAVLINK_COMMANDS.SPEED}\t${currentSpeed}\t${currentSpeed}\t0\t0\t0\t0\t0\t1\n`;
        break;
        
      case MISSION_TYPES.WAYPOINT:
        if (point.lat && point.lng) {
          const altMSL = convertAltitude(point.alt || settings.defaultAltitude, settings);
          fileContent += `${seq}\t0\t3\t${MAVLINK_COMMANDS.WAYPOINT}\t0.00000000\t0.00000000\t0.00000000\t0.00000000\t${point.lat.toFixed(8)}\t${point.lng.toFixed(8)}\t${altMSL.toFixed(6)}\t1\n`;
        }
        break;
        
      case MISSION_TYPES.TAKEOFF:
        const takeoffAltMSL = convertAltitude(point.alt || settings.takeoffAltitude, settings);
        fileContent += `${seq}\t0\t3\t${MAVLINK_COMMANDS.TAKEOFF}\t0.00000000\t0.00000000\t0.00000000\t0.00000000\t${point.lat || mapCenter[0]}\t${point.lng || mapCenter[1]}\t${takeoffAltMSL.toFixed(6)}\t1\n`;
        break;
        
      case MISSION_TYPES.WAIT:
        fileContent += `${seq}\t0\t3\t${MAVLINK_COMMANDS.DELAY}\t${(point.duration || settings.waitTime).toFixed(8)}\t0\t0\t0\t0\t0\t0\t1\n`;
        break;
        
      case MISSION_TYPES.LAND:
        fileContent += `${seq}\t0\t3\t${MAVLINK_COMMANDS.LAND}\t0.00000000\t0.00000000\t0.00000000\t0.00000000\t0.00000000\t0.00000000\t0.000000\t1\n`;
        break;
        
      case MISSION_TYPES.RTH:
        fileContent += `${seq}\t0\t3\t${MAVLINK_COMMANDS.RTL}\t0.00000000\t0.00000000\t0.00000000\t0.00000000\t0.00000000\t0.00000000\t0.000000\t1\n`;
        break;
        
      case MISSION_TYPES.CIRCLE:
        const circleAltMSL = convertAltitude(point.alt || settings.defaultAltitude, settings);
        fileContent += `${seq}\t0\t3\t${MAVLINK_COMMANDS.LOITER}\t${point.radius || settings.circleRadius}\t${point.turns || settings.circleTurns}\t1\t0\t${point.lat || mapCenter[0]}\t${point.lng || mapCenter[1]}\t${circleAltMSL.toFixed(6)}\t1\n`;
        break;
        
      default:
        break;
    }
  });

  // Create and download file
  const blob = new Blob([fileContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mission_${settings.altitudeReference}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
// PART 2: Map Logic with FIXED Waypoint Addition

const MissionPlanner: React.FC = () => {
  // Core state
  const [mapCenter] = useState<[number, number]>([18.5278859, 73.8522314]);
  const [mission, setMission] = useState<MissionItem[]>([]);
  const [isAddingWaypoints, setIsAddingWaypoints] = useState(false);
  const [selectedWaypoint, setSelectedWaypoint] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  
  // Mission settings state with altitude reference
  const [missionSettings, setMissionSettings] = useState<MissionSettings>({
    defaultAltitude: 10,
    defaultSpeed: 5,
    takeoffAltitude: 70,
    waitTime: 5,
    circleRadius: 10,
    circleTurns: 1,
    altitudeReference: 'AGL',
    groundElevation: 571 // Default ground elevation in meters MSL
  });

  // Map state
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [markers, setMarkers] = useState<any[]>([]);
  const [routeLine, setRouteLine] = useState<any>(null);

  // FIXED: Initialize map WITHOUT click handler
  useEffect(() => {
    const initMap = async () => {
      if (typeof window === 'undefined' || !mapRef.current) return;
      
      try {
        const L = (await import('leaflet')).default;
        await import('leaflet/dist/leaflet.css');

        // Fix marker icons
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        });

        const mapInstance = L.map(mapRef.current, {
          center: mapCenter,
          zoom: 16,
          zoomControl: true,
          attributionControl: false
        });

        // Store map instance in ref
        mapInstanceRef.current = mapInstance;

        // Position zoom control
        mapInstance.zoomControl.setPosition('bottomright');

        // Add satellite layer
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 23,
          attribution: false
        }).addTo(mapInstance);

        // Add home marker
        const homeIcon = L.divIcon({
          html: `<div class="home-marker-container">
            <div class="home-center"></div>
            <div class="home-ring"></div>
            <div class="home-pulse"></div>
          </div>`,
          className: 'custom-home-marker',
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        });

        L.marker(mapCenter, { icon: homeIcon })
          .addTo(mapInstance)
          .bindTooltip(`HOME • ${missionSettings.groundElevation}m MSL`, { 
            permanent: false, 
            direction: 'top',
            className: 'mission-tooltip'
          });

        console.log('Map initialized successfully');
      } catch (error) {
        console.error('Error initializing map:', error);
      }
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // FIXED: Separate useEffect for map click handler - THIS IS THE KEY FIX
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove any existing click handlers
    map.off('click');

    // Add the click handler
    const handleMapClick = (e: any) => {
      console.log('Map clicked:', e.latlng, 'Adding waypoints mode:', isAddingWaypoints);
      
      if (isAddingWaypoints) {
        // Prevent event bubbling
        if (e.originalEvent) {
          e.originalEvent.stopPropagation();
          e.originalEvent.preventDefault();
        }
        
        const newWaypoint: MissionItem = {
          id: `wp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: MISSION_TYPES.WAYPOINT,
          seq: mission.length,
          lat: parseFloat(e.latlng.lat.toFixed(8)),
          lng: parseFloat(e.latlng.lng.toFixed(8)),
          alt: missionSettings.defaultAltitude,
          speed: missionSettings.defaultSpeed
        };
        
        console.log('Adding waypoint:', newWaypoint);
        setMission(prev => [...prev, newWaypoint]);
      }
    };

    map.on('click', handleMapClick);

    // Cleanup function
    return () => {
      if (map) {
        map.off('click', handleMapClick);
      }
    };
  }, [isAddingWaypoints, mission.length, missionSettings]); // Dependencies that should trigger re-binding

  // Update markers and route with proper cleanup
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing elements
    markers.forEach(marker => {
      try {
        map.removeLayer(marker);
      } catch (e) {
        console.warn('Error removing marker:', e);
      }
    });
    
    if (routeLine) {
      try {
        map.removeLayer(routeLine);
      } catch (e) {
        console.warn('Error removing route line:', e);
      }
    }

    const newMarkers: any[] = [];
    const routePoints: [number, number][] = [];

    // Add waypoint markers
    mission.forEach((item, index) => {
      if (item.type === MISSION_TYPES.WAYPOINT && item.lat && item.lng) {
        const isSelected = selectedWaypoint === index;
        const displayAlt = displayAltitude(item.alt || missionSettings.defaultAltitude, missionSettings);
        
        const L = (window as any).L;
        const waypointIcon = L.divIcon({
          html: `<div class="waypoint-marker ${isSelected ? 'selected' : ''}">
            <div class="waypoint-number">${index + 1}</div>
            <div class="waypoint-dot"></div>
            ${isSelected ? '<div class="waypoint-selected-ring"></div>' : ''}
          </div>`,
          className: 'custom-waypoint-marker',
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        });

        const marker = L.marker([item.lat, item.lng], { 
          icon: waypointIcon,
          draggable: true 
        })
          .addTo(map)
          .bindTooltip(`WP${index + 1} • ${displayAlt}m ${missionSettings.altitudeReference} • ${item.speed || missionSettings.defaultSpeed}m/s`, {
            permanent: false,
            direction: 'top',
            className: 'mission-tooltip'
          });

        marker.on('click', (e: any) => {
          e.originalEvent?.stopPropagation();
          setSelectedWaypoint(selectedWaypoint === index ? null : index);
        });
        
        marker.on('dragend', (e: any) => {
          const newPos = e.target.getLatLng();
          handleWaypointDrag(index, {
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
      const L = (window as any).L;
      const polyline = L.polyline(routePoints, {
        color: '#3b82f6',
        weight: 3,
        opacity: 0.8,
        dashArray: '10, 5'
      }).addTo(map);
      setRouteLine(polyline);
    } else {
      setRouteLine(null);
    }

    setMarkers(newMarkers);
  }, [mission, selectedWaypoint, missionSettings]);

  // Mission operations
  const handleWaypointDrag = useCallback((index: number, newPosition: { lat: number; lng: number; alt?: number }) => {
    setMission(prev => prev.map((point, i) => {
      if (i === index && point.type === MISSION_TYPES.WAYPOINT) {
        return {
          ...point,
          lat: newPosition.lat,
          lng: newPosition.lng,
          ...(newPosition.alt !== undefined && { alt: newPosition.alt })
        };
      }
      return point;
    }));
  }, []);

  const updateWaypoint = useCallback((index: number, updates: Partial<MissionItem>) => {
    setMission(prev => prev.map((item, i) => 
      i === index ? { ...item, ...updates } : item
    ));
  }, []);

  const removeWaypoint = useCallback((index: number) => {
    setMission(prev => {
      const newMission = prev.filter((_, i) => i !== index);
      return newMission.map((point, i) => ({ ...point, seq: i }));
    });
    setSelectedWaypoint(null);
  }, []);

  const addMissionCommand = useCallback((type: string, additionalData?: Partial<MissionItem>) => {
    const baseCommand: MissionItem = {
      id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      seq: mission.length,
      ...additionalData
    };

    switch (type) {
      case MISSION_TYPES.TAKEOFF:
        baseCommand.alt = missionSettings.takeoffAltitude;
        baseCommand.lat = mapCenter[0];
        baseCommand.lng = mapCenter[1];
        break;
      case MISSION_TYPES.WAIT:
        baseCommand.duration = missionSettings.waitTime;
        break;
      case MISSION_TYPES.CIRCLE:
        baseCommand.radius = missionSettings.circleRadius;
        baseCommand.turns = missionSettings.circleTurns;
        baseCommand.lat = mapCenter[0];
        baseCommand.lng = mapCenter[1];
        baseCommand.alt = missionSettings.defaultAltitude;
        break;
    }

    setMission(prev => [...prev, baseCommand]);
  }, [mission.length, missionSettings, mapCenter]);

  // FIXED: Enhanced toggle waypoint mode with force re-bind
  const toggleWaypointMode = useCallback(() => {
    const newMode = !isAddingWaypoints;
    console.log('Toggling waypoint mode to:', newMode);
    setIsAddingWaypoints(newMode);
    
    // Force re-bind map click handler
    const map = mapInstanceRef.current;
    if (map) {
      // Remove existing handlers
      map.off('click');
      
      if (newMode) {
        // Add click handler when enabling
        const clickHandler = (e: any) => {
          console.log('Map clicked in waypoint mode:', e.latlng);
          
          const newWaypoint: MissionItem = {
            id: `wp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: MISSION_TYPES.WAYPOINT,
            seq: mission.length,
            lat: parseFloat(e.latlng.lat.toFixed(8)),
            lng: parseFloat(e.latlng.lng.toFixed(8)),
            alt: missionSettings.defaultAltitude,
            speed: missionSettings.defaultSpeed
          };
          
          console.log('Adding waypoint:', newWaypoint);
          setMission(prev => [...prev, newWaypoint]);
        };
        
        map.on('click', clickHandler);
        console.log('Map click handler added');
      } else {
        console.log('Map click handler removed');
      }
    }
  }, [isAddingWaypoints, mission.length, missionSettings]);

  const clearMission = useCallback(() => {
    setMission([]);
    setSelectedWaypoint(null);
  }, []);

  const handleDownloadMission = useCallback(() => {
    if (mission.length === 0) {
      alert('Mission is empty. Add some commands first.');
      return;
    }
    generateMissionFile(mission, mapCenter, missionSettings);
  }, [mission, mapCenter, missionSettings]);

  const handleSettingChange = useCallback((key: keyof MissionSettings, value: number | AltitudeReference) => {
    setMissionSettings(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  // Drag and drop handlers for mission reordering
  const handleDragStart = useCallback((index: number) => {
    setDraggedItem(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItem === null || draggedItem === index) return;
    e.currentTarget.classList.add('drag-over');
  }, [draggedItem]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.currentTarget.classList.remove('drag-over');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    
    if (draggedItem === null || draggedItem === dropIndex) {
      setDraggedItem(null);
      return;
    }

    setMission(prev => {
      const newMission = [...prev];
      const draggedItemData = newMission[draggedItem];
      
      newMission.splice(draggedItem, 1);
      
      const actualDropIndex = draggedItem < dropIndex ? dropIndex - 1 : dropIndex;
      newMission.splice(actualDropIndex, 0, draggedItemData);
      
      return newMission.map((item, i) => ({ ...item, seq: i }));
    });
    
    setDraggedItem(null);
    setSelectedWaypoint(null);
  }, [draggedItem]);

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    document.querySelectorAll('.drag-over').forEach(el => {
      el.classList.remove('drag-over');
    });
  }, []);

  const toggleFullscreen = useCallback(() => {
    const element = document.getElementById('map-container');
    if (!element) return;

    try {
      if (!document.fullscreenElement) {
        if (element.requestFullscreen) {
          element.requestFullscreen();
        } else if ((element as any).webkitRequestFullscreen) {
          (element as any).webkitRequestFullscreen();
        } else if ((element as any).msRequestFullscreen) {
          (element as any).msRequestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        } else if ((document as any).msExitFullscreen) {
          (document as any).msExitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error('Error toggling fullscreen:', err);
    }
  }, []);
  // PART 3: Fixed UI Layout - CLEAN VERSION

  // Calculate mission statistics
  const missionStats = calculateMissionStats(mission, mapCenter, missionSettings);

  // Command configurations
  const flightCommands = [
    {
      id: MISSION_TYPES.TAKEOFF,
      label: 'Takeoff',
      icon: Plane,
      className: 'bg-gradient-to-r from-green-900/20 to-emerald-900/20 text-green-300 border border-green-500/30 hover:from-green-800/30 hover:to-emerald-800/30'
    },
    {
      id: MISSION_TYPES.LAND,
      label: 'Land',
      icon: Square,
      className: 'bg-gradient-to-r from-orange-900/20 to-red-900/20 text-orange-300 border border-orange-500/30 hover:from-orange-800/30 hover:to-red-800/30'
    },
    {
      id: MISSION_TYPES.RTH,
      label: 'Return Home',
      icon: RotateCcw,
      className: 'bg-gradient-to-r from-purple-900/20 to-indigo-900/20 text-purple-300 border border-purple-500/30 hover:from-purple-800/30 hover:to-indigo-800/30'
    }
  ];

  const waypointCommands = [
    {
      id: 'waypoint-toggle',
      label: isAddingWaypoints ? 'Stop Adding' : 'Add Waypoint',
      icon: isAddingWaypoints ? Pause : Target,
      className: isAddingWaypoints 
        ? 'bg-gradient-to-r from-red-900/20 to-rose-900/20 text-red-300 border border-red-500/30 hover:from-red-800/30 hover:to-rose-800/30' 
        : 'bg-gradient-to-r from-blue-900/20 to-indigo-900/20 text-blue-300 border border-blue-500/30 hover:from-blue-800/30 hover:to-indigo-800/30',
      onClick: toggleWaypointMode
    },
    {
      id: MISSION_TYPES.WAIT,
      label: `Wait ${missionSettings.waitTime}s`,
      icon: Clock,
      className: 'bg-gradient-to-r from-yellow-900/20 to-amber-900/20 text-yellow-300 border border-yellow-500/30 hover:from-yellow-800/30 hover:to-amber-800/30'
    },
    {
      id: MISSION_TYPES.CIRCLE,
      label: 'Circle/Loiter',
      icon: RotateCcw,
      className: 'bg-gradient-to-r from-cyan-900/20 to-blue-900/20 text-cyan-300 border border-cyan-500/30 hover:from-cyan-800/30 hover:to-blue-800/30'
    }
  ];

  const getCommandIcon = (type: string) => {
    switch (type) {
      case MISSION_TYPES.TAKEOFF: return '↑';
      case MISSION_TYPES.WAYPOINT: return '●';
      case MISSION_TYPES.LAND: return '↓';
      case MISSION_TYPES.RTH: return '⌂';
      case MISSION_TYPES.WAIT: return '⏱';
      case MISSION_TYPES.CIRCLE: return '○';
      case MISSION_TYPES.SPEED_CHANGE: return '⚡';
      default: return '●';
    }
  };

  const getCommandColor = (type: string) => {
    switch (type) {
      case MISSION_TYPES.TAKEOFF: return 'text-green-400';
      case MISSION_TYPES.WAYPOINT: return 'text-blue-400';
      case MISSION_TYPES.LAND: return 'text-orange-400';
      case MISSION_TYPES.RTH: return 'text-purple-400';
      case MISSION_TYPES.WAIT: return 'text-yellow-400';
      case MISSION_TYPES.CIRCLE: return 'text-cyan-400';
      case MISSION_TYPES.SPEED_CHANGE: return 'text-pink-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="flex flex-col gap-4 text-white bg-gray-900 min-h-screen p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Route className="h-6 w-6 text-blue-400" />
          <h2 className="text-2xl font-light text-white tracking-wide">MISSION PLANNER</h2>
          <div className="h-[1px] w-24 bg-gradient-to-r from-blue-500/40 to-transparent"></div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-400 font-mono bg-gray-800/60 px-3 py-1 rounded-lg border border-gray-700">
            {missionStats.waypointCount} WP • {missionStats.totalDistance}m • {missionStats.estimatedTime}s
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={clearMission}
              className="p-2 text-gray-400 hover:text-red-400 transition-colors bg-gray-800/60 rounded-lg border border-gray-700 hover:border-red-500/50"
              title="Clear Mission"
            >
              <Trash2 className="h-5 w-5" />
            </button>
            
            <button
              onClick={handleDownloadMission}
              disabled={mission.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-900/30 to-indigo-900/30 text-blue-300 hover:from-blue-800/40 hover:to-indigo-800/40 disabled:from-gray-800/30 disabled:to-gray-700/30 disabled:text-gray-500 transition-all font-medium border border-blue-500/30 disabled:border-gray-600/30 rounded-lg"
            >
              <Download className="h-4 w-4" />
              Export Mission
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - Fixed Layout */}
      <div className="flex gap-4">
        {/* Map Section - 2/3 width */}
        <div className="w-2/3">
          <div 
            id="map-container"
            className="relative h-[500px] border border-gray-700 rounded-lg overflow-hidden bg-gray-900 shadow-lg"
          >
            <div ref={mapRef} className="h-full w-full" />
            
            {/* Map Controls Overlay - FIXED */}
            <div className="absolute top-4 right-4 z-[1000] flex gap-2">
              <button
                onClick={toggleFullscreen}
                className="p-2 bg-gray-900/90 backdrop-blur-md border border-gray-600 text-gray-300 hover:text-white hover:border-blue-500/50 transition-all rounded-lg shadow-lg"
                title="Toggle Fullscreen"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>

            {/* Status Overlay - FIXED */}
            <div className="absolute top-4 left-4 z-[1000] bg-gray-900/95 backdrop-blur-md px-4 py-2 border border-gray-600 rounded-lg shadow-lg">
              <div className="flex items-center gap-2 mb-1">
                <Crosshair className="h-4 w-4 text-blue-400" />
                <span className="text-sm text-gray-200 font-medium">
                  {isAddingWaypoints ? 'Click map to add waypoint' : 'Waypoint mode disabled'}
                </span>
                {isAddingWaypoints && (
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                )}
              </div>
            </div>

            {/* Mission Stats Overlay */}
            <div className="absolute bottom-4 left-4 z-[1000] bg-gray-900/95 backdrop-blur-md px-4 py-2 border border-gray-600 rounded-lg shadow-lg">
              <div className="text-sm font-medium text-white/90 mb-1">Mission Info</div>
              <div className="text-xs text-white/70 space-y-1">
                <div className="flex items-center gap-1">
                  <Navigation className="h-3 w-3 text-blue-400" />
                  <span>Distance: {missionStats.totalDistance}m</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-green-400" />
                  <span>Est. Time: {missionStats.estimatedTime}s</span>
                </div>
                <div className="flex items-center gap-1">
                  <Mountain className="h-3 w-3 text-purple-400" />
                  <span>Reference: {missionSettings.altitudeReference}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mission List Panel - 1/3 width with drag & drop */}
        <div className="w-1/3">
          <div className="bg-gray-800/90 backdrop-blur-sm rounded-lg p-4 border border-gray-700 shadow-lg h-[500px] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-blue-300 tracking-wide flex items-center gap-2">
                <Route className="h-4 w-4" />
                MISSION SEQUENCE
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 bg-gray-900/60 px-2 py-1 rounded">
                  {mission.length} items
                </span>
                <div className="flex items-center gap-1 text-xs text-purple-400">
                  <Mountain className="h-3 w-3" />
                  <span>{missionSettings.altitudeReference}</span>
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
              {mission.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="text-3xl mb-3 opacity-30">○</div>
                  <div className="text-sm font-mono">No mission commands</div>
                  <div className="text-xs text-gray-600 mt-2">Add takeoff to start</div>
                  <div className="text-xs text-blue-400 mt-1">Click "Add Waypoint" then click map</div>
                </div>
              ) : (
                mission.map((item, index) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`group flex items-center gap-3 px-3 py-3 border transition-all cursor-move rounded-lg ${
                      selectedWaypoint === index
                        ? 'bg-blue-900/20 border-blue-500/40 shadow-md'
                        : draggedItem === index
                        ? 'bg-gray-700/50 border-gray-500 opacity-50'
                        : 'border-gray-700 hover:border-gray-600 hover:bg-gray-700/30'
                    }`}
                    onClick={() => setSelectedWaypoint(selectedWaypoint === index ? null : index)}
                  >
                    {/* Drag handle */}
                    <div className="text-gray-500 hover:text-gray-300 cursor-grab active:cursor-grabbing">
                      <GripVertical className="h-4 w-4" />
                    </div>

                    {/* Sequence number */}
                    <div className="w-8 h-8 flex items-center justify-center bg-gray-900/80 border border-gray-600 text-xs font-mono text-gray-300 rounded-full flex-shrink-0">
                      {index + 1}
                    </div>

                    {/* Command icon */}
                    <div className={`w-5 text-center font-mono text-lg flex-shrink-0 ${getCommandColor(item.type)}`}>
                      {getCommandIcon(item.type)}
                    </div>

                    {/* Command details */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white capitalize mb-1">
                        {item.type === MISSION_TYPES.RTH ? 'Return Home' :
                         item.type === MISSION_TYPES.WAIT ? 'Wait' :
                         item.type === MISSION_TYPES.SPEED_CHANGE ? 'Speed Change' :
                         item.type}
                      </div>
                      
                      {item.type === MISSION_TYPES.WAYPOINT && (
                        <div className="flex gap-3 text-xs text-gray-400 font-mono">
                          <span>ALT {displayAltitude(item.alt || missionSettings.defaultAltitude, missionSettings)}m {missionSettings.altitudeReference}</span>
                          <span>SPD {item.speed || missionSettings.defaultSpeed}m/s</span>
                        </div>
                      )}
                      
                      {item.type === MISSION_TYPES.TAKEOFF && (
                        <div className="text-xs text-gray-400 font-mono">
                          ALT {displayAltitude(item.alt || missionSettings.takeoffAltitude, missionSettings)}m {missionSettings.altitudeReference}
                        </div>
                      )}
                      
                      {item.type === MISSION_TYPES.WAIT && (
                        <div className="text-xs text-gray-400 font-mono">
                          Duration: {item.duration || missionSettings.waitTime}s
                        </div>
                      )}

                      {item.type === MISSION_TYPES.CIRCLE && (
                        <div className="flex gap-3 text-xs text-gray-400 font-mono">
                          <span>R {item.radius || missionSettings.circleRadius}m</span>
                          <span>T {item.turns || missionSettings.circleTurns}</span>
                        </div>
                      )}

                      {item.type === MISSION_TYPES.SPEED_CHANGE && (
                        <div className="text-xs text-gray-400 font-mono">
                          Speed: {item.speed}m/s
                        </div>
                      )}
                      
                      {item.type === MISSION_TYPES.WAYPOINT && item.lat && item.lng && (
                        <div className="text-xs text-gray-500 font-mono mt-1 truncate">
                          {item.lat.toFixed(6)}, {item.lng.toFixed(6)}
                        </div>
                      )}
                    </div>

                    {/* Edit controls for selected waypoint */}
                    {selectedWaypoint === index && item.type === MISSION_TYPES.WAYPOINT && (
                      <div className="flex gap-1 flex-shrink-0">
                        <input
                          type="number"
                          value={displayAltitude(item.alt || missionSettings.defaultAltitude, missionSettings)}
                          onChange={(e) => {
                            const newAlt = parseInt(e.target.value);
                            const actualAlt = missionSettings.altitudeReference === 'AGL' ? newAlt : newAlt;
                            updateWaypoint(index, { alt: actualAlt });
                          }}
                          className="w-12 px-1 py-1 bg-gray-900 border border-gray-600 text-white text-xs font-mono focus:outline-none focus:border-blue-500 rounded text-center"
                          title={`Altitude (${missionSettings.altitudeReference})`}
                          min="1"
                          max="500"
                        />
                        <input
                          type="number"
                          value={item.speed || missionSettings.defaultSpeed}
                          onChange={(e) => updateWaypoint(index, { speed: parseInt(e.target.value) })}
                          className="w-12 px-1 py-1 bg-gray-900 border border-gray-600 text-white text-xs font-mono focus:outline-none focus:border-blue-500 rounded text-center"
                          title="Speed (m/s)"
                          min="1"
                          max="30"
                        />
                      </div>
                    )}

                    {/* Remove button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeWaypoint(index);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 transition-all rounded flex-shrink-0"
                      title="Remove Command"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Control Panels Grid */}
      <div className="grid grid-cols-3 gap-4">
        {/* Flight Commands */}
        <div className="bg-gray-800/90 backdrop-blur-sm rounded-lg p-4 border border-gray-700 shadow-lg">
          <h3 className="text-sm font-medium text-blue-300 tracking-wide mb-3 flex items-center gap-2">
            <Plane className="h-4 w-4" />
            FLIGHT COMMANDS
          </h3>
          
          <div className="space-y-2">
            {flightCommands.map((command) => {
              const Icon = command.icon;
              return (
                <button
                  key={command.id}
                  onClick={() => addMissionCommand(command.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 transition-all font-medium rounded-lg text-sm ${command.className}`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{command.label}</span>
                </button>
              );
            })}
          </div>

          {/* Takeoff Altitude Setting - DRAMATICALLY IMPROVED UI */}
          <div className="mt-4 pt-3 border-t border-gray-600">
            <div className="flex justify-between items-center mb-3">
              <label className="text-xs text-gray-400 font-medium">Takeoff Altitude</label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-white font-mono font-bold bg-gray-900/80 px-2 py-1 rounded-md border border-gray-600">
                  {missionSettings.takeoffAltitude}
                </span>
                <span className="px-2 py-1 bg-green-500 text-black text-xs font-bold rounded-md shadow-md">
                  {missionSettings.altitudeReference}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  type="range"
                  min="5"
                  max="200"
                  value={missionSettings.takeoffAltitude}
                  onChange={(e) => handleSettingChange('takeoffAltitude', parseInt(e.target.value))}
                  className="w-full h-1 bg-gray-700 rounded-full appearance-none cursor-pointer slider-premium"
                />
                <div className="absolute top-0 left-0 h-1 bg-gradient-to-r from-green-500 to-emerald-400 rounded-full pointer-events-none" 
                     style={{width: `${((missionSettings.takeoffAltitude - 5) / (200 - 5)) * 100}%`}}></div>
              </div>
              <input
                type="number"
                min="5"
                max="200"
                value={missionSettings.takeoffAltitude}
                onChange={(e) => handleSettingChange('takeoffAltitude', parseInt(e.target.value))}
                className="w-16 px-2 py-1.5 bg-gray-900 border-2 border-gray-600 text-white text-sm font-mono focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-400/20 rounded-md"
              />
            </div>
          </div>
        </div>

        {/* Waypoint Controls */}
        <div className="bg-gray-800/90 backdrop-blur-sm rounded-lg p-4 border border-gray-700 shadow-lg">
          <h3 className="text-sm font-medium text-blue-300 tracking-wide mb-3 flex items-center gap-2">
            <Target className="h-4 w-4" />
            WAYPOINT CONTROLS
          </h3>
          
          <div className="space-y-2">
            {waypointCommands.map((command) => {
              const Icon = command.icon;
              return (
                <button
                  key={command.id}
                  onClick={command.onClick || (() => addMissionCommand(command.id))}
                  className={`w-full flex items-center gap-2 px-3 py-2 transition-all font-medium rounded-lg text-sm ${command.className}`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{command.label}</span>
                </button>
              );
            })}
          </div>

          {/* Circle and Wait Settings - DRAMATICALLY IMPROVED UI */}
          <div className="mt-4 pt-3 border-t border-gray-600 space-y-4">
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-xs text-gray-400 font-medium">Circle Radius</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white font-mono font-bold bg-gray-900/80 px-2 py-1 rounded-md border border-gray-600">
                    {missionSettings.circleRadius}
                  </span>
                  <span className="px-2 py-1 bg-cyan-500 text-black text-xs font-bold rounded-md shadow-md">
                    m
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <input
                    type="range"
                    min="5"
                    max="100"
                    value={missionSettings.circleRadius}
                    onChange={(e) => handleSettingChange('circleRadius', parseInt(e.target.value))}
                    className="w-full h-3 bg-gray-700 rounded-full appearance-none cursor-pointer slider-premium"
                  />
                  <div className="absolute top-0 left-0 h-3 bg-gradient-to-r from-cyan-500 to-blue-400 rounded-full pointer-events-none" 
                       style={{width: `${((missionSettings.circleRadius - 5) / (100 - 5)) * 100}%`}}></div>
                </div>
                <input
                  type="number"
                  min="5"
                  max="100"
                  value={missionSettings.circleRadius}
                  onChange={(e) => handleSettingChange('circleRadius', parseInt(e.target.value))}
                  className="w-16 px-2 py-1.5 bg-gray-900 border-2 border-gray-600 text-white text-sm font-mono focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 rounded-md"
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-xs text-gray-400 font-medium">Wait Time</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white font-mono font-bold bg-gray-900/80 px-2 py-1 rounded-md border border-gray-600">
                    {missionSettings.waitTime}
                  </span>
                  <span className="px-2 py-1 bg-yellow-500 text-black text-xs font-bold rounded-md shadow-md">
                    s
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <input
                    type="range"
                    min="1"
                    max="60"
                    value={missionSettings.waitTime}
                    onChange={(e) => handleSettingChange('waitTime', parseInt(e.target.value))}
                    className="w-full h-3 bg-gray-700 rounded-full appearance-none cursor-pointer slider-premium"
                  />
                  <div className="absolute top-0 left-0 h-3 bg-gradient-to-r from-yellow-500 to-orange-400 rounded-full pointer-events-none" 
                       style={{width: `${((missionSettings.waitTime - 1) / (60 - 1)) * 100}%`}}></div>
                </div>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={missionSettings.waitTime}
                  onChange={(e) => handleSettingChange('waitTime', parseInt(e.target.value))}
                  className="w-16 px-2 py-1.5 bg-gray-900 border-2 border-gray-600 text-white text-sm font-mono focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 rounded-md"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Mission Settings with Altitude Reference */}
        <div className="bg-gray-800/90 backdrop-blur-sm rounded-lg p-4 border border-gray-700 shadow-lg">
          <h3 className="text-sm font-medium text-blue-300 tracking-wide mb-3 flex items-center gap-2">
            <Settings className="h-4 w-4" />
            MISSION SETTINGS
          </h3>
          
          {/* Altitude Reference System */}
          <div className="mb-4 p-3 bg-gray-900/60 rounded-lg border border-gray-600">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-purple-400 font-medium flex items-center gap-1">
                <Mountain className="h-3 w-3" />
                Altitude Reference
              </label>
              <div className="flex bg-gray-800 rounded-lg overflow-hidden border border-gray-600">
                <button
                  onClick={() => handleSettingChange('altitudeReference', 'MSL')}
                  className={`px-3 py-1.5 text-xs font-bold transition-all ${
                    missionSettings.altitudeReference === 'MSL'
                      ? 'bg-purple-500 text-white shadow-lg'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  MSL
                </button>
                <button
                  onClick={() => handleSettingChange('altitudeReference', 'AGL')}
                  className={`px-3 py-1.5 text-xs font-bold transition-all ${
                    missionSettings.altitudeReference === 'AGL'
                      ? 'bg-purple-500 text-white shadow-lg'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  AGL
                </button>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              {missionSettings.altitudeReference === 'MSL' 
                ? 'Mean Sea Level - Absolute altitude'
                : 'Above Ground Level - Relative to terrain'
              }
            </div>
            
            {/* Ground Elevation Setting for AGL - DRAMATICALLY IMPROVED UI */}
            {missionSettings.altitudeReference === 'AGL' && (
              <div className="mt-4">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-xs text-gray-400 font-medium">Ground Elevation</label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white font-mono font-bold bg-gray-900/80 px-2 py-1 rounded-md border border-gray-600">
                      {missionSettings.groundElevation}
                    </span>
                    <span className="px-2 py-1 bg-purple-500 text-white text-xs font-bold rounded-md shadow-md">
                      MSL
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <input
                      type="range"
                      min="0"
                      max="3000"
                      value={missionSettings.groundElevation}
                      onChange={(e) => handleSettingChange('groundElevation', parseInt(e.target.value))}
                      className="w-full h-3 bg-gray-700 rounded-full appearance-none cursor-pointer slider-premium"
                    />
                    <div className="absolute top-0 left-0 h-3 bg-gradient-to-r from-purple-500 to-indigo-400 rounded-full pointer-events-none" 
                         style={{width: `${((missionSettings.groundElevation - 0) / (3000 - 0)) * 100}%`}}></div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="3000"
                    value={missionSettings.groundElevation}
                    onChange={(e) => handleSettingChange('groundElevation', parseInt(e.target.value))}
                    className="w-20 px-2 py-1.5 bg-gray-900 border-2 border-gray-600 text-white text-sm font-mono focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 rounded-md"
                  />
                </div>
              </div>
            )}
          </div>
          
          {/* Default Settings - DRAMATICALLY IMPROVED UI */}
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-xs text-gray-400 font-medium">Default Altitude</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white font-mono font-bold bg-gray-900/80 px-2 py-1 rounded-md border border-gray-600">
                    {missionSettings.defaultAltitude}
                  </span>
                  <span className="px-2 py-1 bg-blue-500 text-white text-xs font-bold rounded-md shadow-md">
                    {missionSettings.altitudeReference}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <input
                    type="range"
                    min="1"
                    max="500"
                    value={missionSettings.defaultAltitude}
                    onChange={(e) => handleSettingChange('defaultAltitude', parseInt(e.target.value))}
                    className="w-full h-3 bg-gray-700 rounded-full appearance-none cursor-pointer slider-premium"
                  />
                  <div className="absolute top-0 left-0 h-3 bg-gradient-to-r from-blue-500 to-indigo-400 rounded-full pointer-events-none" 
                       style={{width: `${((missionSettings.defaultAltitude - 1) / (500 - 1)) * 100}%`}}></div>
                </div>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={missionSettings.defaultAltitude}
                  onChange={(e) => handleSettingChange('defaultAltitude', parseInt(e.target.value))}
                  className="w-16 px-2 py-1.5 bg-gray-900 border-2 border-gray-600 text-white text-sm font-mono focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 rounded-md"
                />
              </div>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-xs text-gray-400 font-medium">Default Speed</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white font-mono font-bold bg-gray-900/80 px-2 py-1 rounded-md border border-gray-600">
                    {missionSettings.defaultSpeed}
                  </span>
                  <span className="px-2 py-1 bg-pink-500 text-white text-xs font-bold rounded-md shadow-md">
                    m/s
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <input
                    type="range"
                    min="1"
                    max="30"
                    value={missionSettings.defaultSpeed}
                    onChange={(e) => handleSettingChange('defaultSpeed', parseInt(e.target.value))}
                    className="w-full h-3 bg-gray-700 rounded-full appearance-none cursor-pointer slider-premium"
                  />
                  <div className="absolute top-0 left-0 h-3 bg-gradient-to-r from-pink-500 to-rose-400 rounded-full pointer-events-none" 
                       style={{width: `${((missionSettings.defaultSpeed - 1) / (30 - 1)) * 100}%`}}></div>
                </div>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={missionSettings.defaultSpeed}
                  onChange={(e) => handleSettingChange('defaultSpeed', parseInt(e.target.value))}
                  className="w-16 px-2 py-1.5 bg-gray-900 border-2 border-gray-600 text-white text-sm font-mono focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-400/20 rounded-md"
                />
              </div>
            </div>
          </div>

          {/* Speed Change Button */}
          <div className="mt-4 pt-3 border-t border-gray-600">
            <button
              onClick={() => addMissionCommand(MISSION_TYPES.SPEED_CHANGE, { speed: missionSettings.defaultSpeed })}
              className="w-full flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-pink-900/20 to-purple-900/20 text-pink-300 border border-pink-500/30 hover:from-pink-800/30 hover:to-purple-800/30 transition-all font-medium rounded-lg text-sm"
            >
              <Activity className="h-4 w-4" />
              <span>Add Speed Change</span>
            </button>
          </div>
        </div>
      </div>

      {/* Enhanced Custom Styles */}
      <style jsx global>{`
        /* Drag over visual feedback */
        .drag-over {
          border-color: #3b82f6 !important;
          background-color: rgba(59, 130, 246, 0.1) !important;
          transform: scale(1.02);
        }

        /* Custom scrollbar */
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #374151;
          border-radius: 2px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #3b82f6;
          border-radius: 2px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #2563eb;
        }

        /* PREMIUM: Dramatically improved slider styling */
        .slider-premium {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          cursor: pointer;
          position: relative;
          z-index: 2;
        }

        .slider-premium::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          height: 22px;
          width: 22px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
          cursor: pointer;
          border: 3px solid #1f2937;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.2), inset 0 1px 2px rgba(255, 255, 255, 0.3);
          transition: all 0.2s ease;
          position: relative;
        }

        .slider-premium::-webkit-slider-thumb:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5), 0 4px 8px rgba(0, 0, 0, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.4);
        }

        .slider-premium::-webkit-slider-thumb:active {
          transform: scale(1.05);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.6), inset 0 1px 2px rgba(255, 255, 255, 0.2);
        }

        .slider-premium::-moz-range-thumb {
          height: 22px;
          width: 22px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
          cursor: pointer;
          border: 3px solid #1f2937;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.2), inset 0 1px 2px rgba(255, 255, 255, 0.3);
          transition: all 0.2s ease;
        }

        .slider-premium::-moz-range-thumb:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5), 0 4px 8px rgba(0, 0, 0, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.4);
        }

        /* Leaflet container styling */
        .leaflet-container {
          background: #111827 !important;
          font-family: 'Inter', sans-serif !important;
        }

        /* Enhanced home marker */
        .home-marker-container {
          width: 30px;
          height: 30px;
          position: relative;
        }
        
        .home-center {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 8px;
          height: 8px;
          background: #3b82f6;
          border: 2px solid #ffffff;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          z-index: 3;
        }
        
        .home-ring {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 20px;
          height: 20px;
          border: 2px solid #3b82f6;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          opacity: 0.8;
          z-index: 2;
        }

        .home-pulse {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 30px;
          height: 30px;
          border: 1px solid #3b82f6;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          opacity: 0.4;
          z-index: 1;
          animation: homePulse 2s infinite;
        }

        @keyframes homePulse {
          0% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.4;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.3);
            opacity: 0.1;
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.4;
          }
        }

        /* Enhanced waypoint markers */
        .waypoint-marker {
          width: 30px;
          height: 30px;
          position: relative;
        }
        
        .waypoint-marker.selected .waypoint-dot {
          background: #3b82f6;
          border: 3px solid #ffffff;
          box-shadow: 0 0 8px #3b82f6;
        }

        .waypoint-marker.selected .waypoint-selected-ring {
          opacity: 1;
        }
        
        .waypoint-number {
          position: absolute;
          top: -10px;
          left: 50%;
          transform: translateX(-50%);
          background: #111827;
          color: #3b82f6;
          padding: 2px 6px;
          font-size: 10px;
          font-weight: 600;
          font-family: 'JetBrains Mono', monospace;
          border: 1px solid #3b82f6;
          border-radius: 4px;
          min-width: 18px;
          text-align: center;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
          z-index: 3;
        }
        
        .waypoint-dot {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 10px;
          height: 10px;
          background: #ef4444;
          border: 2px solid #ffffff;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          transition: all 0.2s ease;
          z-index: 2;
          box-shadow: 0 0 6px #ef4444;
        }

        .waypoint-selected-ring {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 24px;
          height: 24px;
          border: 2px solid #3b82f6;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          opacity: 0;
          transition: opacity 0.2s ease;
          z-index: 1;
          animation: selectedPulse 1.5s infinite;
        }

        @keyframes selectedPulse {
          0% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.8;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.2);
            opacity: 0.4;
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.8;
          }
        }

        /* Mission tooltip styling */
        .mission-tooltip {
          background: rgba(17, 24, 39, 0.95) !important;
          border: 1px solid #374151 !important;
          color: #ffffff !important;
          font-family: 'JetBrains Mono', monospace !important;
          font-size: 11px !important;
          border-radius: 6px !important;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
          backdrop-filter: blur(8px) !important;
        }
        
        .mission-tooltip:before {
          border-top-color: #374151 !important;
        }

        /* Leaflet zoom control styling */
        .leaflet-control-zoom {
          border: none !important;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
        }

        .leaflet-control-zoom a {
          background: rgba(17, 24, 39, 0.9) !important;
          color: #3b82f6 !important;
          border: 1px solid #374151 !important;
          backdrop-filter: blur(8px) !important;
        }

        .leaflet-control-zoom a:hover {
          background: rgba(59, 130, 246, 0.1) !important;
          color: #ffffff !important;
          border-color: #3b82f6 !important;
        }

        /* Fullscreen map container */
        #map-container:fullscreen {
          padding: 0;
          width: 100vw;
          height: 100vh;
        }

        #map-container:-webkit-full-screen {
          padding: 0;
          width: 100vw;
          height: 100vh;
        }

        #map-container:-moz-full-screen {
          padding: 0;
          width: 100vw;
          height: 100vh;
        }

        #map-container:-ms-fullscreen {
          padding: 0;
          width: 100vw;
          height: 100vh;
        }

        /* Smooth transitions */
        .transition-all {
          transition: all 0.2s ease-in-out;
        }

        /* Button hover effects */
        button:hover {
          transform: translateY(-1px);
        }

        button:active {
          transform: translateY(0);
        }

        /* Cursor styles for dragging */
        .cursor-grab {
          cursor: grab;
        }

        .cursor-grabbing {
          cursor: grabbing;
        }

        .cursor-move {
          cursor: move;
        }

        /* Prevent text selection on UI elements */
        .select-none {
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
        }
      `}</style>
    </div>
  );
};

export default MissionPlanner;
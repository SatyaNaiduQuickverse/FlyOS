// components/DroneControl/DroneMap.tsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Globe, Maximize2, Eye, MapPin, Layers, X } from 'lucide-react';
import { waypointStore } from '../../utils/waypointStore';
import type { Waypoint } from '../../utils/waypointStore';

// Define interface for DroneMapProps
interface DroneMapProps {
  className?: string;
}

// Create a placeholder component for server-side rendering
const DroneMapPlaceholder: React.FC<DroneMapProps> = ({ className = '' }) => {
  return (
    <div className={`relative bg-slate-900/50 text-white rounded-lg border border-gray-800 backdrop-blur-sm shadow-slate-900/50 overflow-hidden ${className || 'h-[500px]'} flex items-center justify-center`}>
      <div className="text-gray-400 flex flex-col items-center gap-3">
        <Globe className="h-8 w-8 opacity-50" />
        <div>Loading map interface...</div>
      </div>
    </div>
  );
};

// Map types enum
enum MapType {
  OSM = 'OpenStreetMap',
  SATELLITE = 'Satellite'
}

// The actual map component implementation (client-side only)
const DroneMapClient: React.FC<DroneMapProps> = ({ className = '' }) => {
  // Import Leaflet dynamically only on client-side
  const [L, setL] = useState<any>(null);
  const [ReactLeaflet, setReactLeaflet] = useState<any>(null);
  const [isLeafletLoaded, setIsLeafletLoaded] = useState(false);
  const [droneIcon, setDroneIcon] = useState<any>(null);
  const [waypointIcon, setWaypointIcon] = useState<any>(null);
  
  // Telemetry state
  const [telemetryData, setTelemetryData] = useState({
    latitude: 0,
    longitude: 0,
    altitudeMSL: 0,
    armed: false,
    flight_mode: '',
    connected: false
  });
  
  // Map state
  const [pathHistory, setPathHistory] = useState<[number, number][]>([]);
  const [error, setError] = useState<string | null>(null);
  const [missionWaypoints, setMissionWaypoints] = useState<Waypoint[]>([]);
  const [showMissionPath, setShowMissionPath] = useState(true);
  const [mapCenter, setMapCenter] = useState<[number, number]>([18.5278859, 73.8522314]);
  const [mapZoom, setMapZoom] = useState(18);
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedMapType, setSelectedMapType] = useState<MapType>(MapType.OSM);
  
  const maxPathPoints = 100;
  const mapContainerRef = useRef<HTMLDivElement>(null);
  
  // Load Leaflet libraries
  useEffect(() => {
    const initializeLeaflet = async () => {
      try {
        // Import required libraries
        const leaflet = await import('leaflet');
        const reactLeafletLib = await import('react-leaflet');
        await import('leaflet/dist/leaflet.css');
        
        // Create the icons after loading Leaflet
        const defaultIcon = leaflet.icon({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        });
        
        // Set default icon for all markers
        leaflet.Marker.prototype.options.icon = defaultIcon;
        
        // Create the custom icons
        const droneIconObj = leaflet.divIcon({
          className: 'drone-icon',
          html: `
            <div class='marker-container'>
              <div class='center-dot'></div>
              <div class='ring'></div>
              <div class='crosshair'></div>
            </div>
          `,
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        });

        const waypointIconObj = leaflet.divIcon({
          className: 'waypoint-icon',
          html: `
            <div class='waypoint-container'>
              <div class='waypoint-dot'></div>
              <div class='waypoint-ring'></div>
            </div>
          `,
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        });
        
        // Save all the libraries and icons in state
        setL(leaflet);
        setReactLeaflet(reactLeafletLib);
        setDroneIcon(droneIconObj);
        setWaypointIcon(waypointIconObj);
        setIsLeafletLoaded(true);
      } catch (error) {
        console.error('Error loading Leaflet:', error);
        setError('Failed to load map library');
      }
    };
    
    initializeLeaflet();
  }, []);
  
  // Memoize the current position
  const dronePosition = useMemo<[number, number]>(() =>
    [telemetryData.latitude, telemetryData.longitude],
    [telemetryData.latitude, telemetryData.longitude]
  );

  // Calculate optimal zoom level based on waypoint spread
  const calculateOptimalZoom = (coordinates: [number, number][]) => {
    if (!coordinates || coordinates.length === 0) return 18;
    if (coordinates.length === 1) return 19;

    const lats = coordinates.map(coord => coord[0]);
    const lngs = coordinates.map(coord => coord[1]);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latDiff = maxLat - minLat;
    const lngDiff = maxLng - minLng;
    const maxDiff = Math.max(latDiff, lngDiff);

    if (maxDiff > 0.1) return 14;
    if (maxDiff > 0.05) return 15;
    if (maxDiff > 0.01) return 16;
    if (maxDiff > 0.005) return 17;
    return 18;
  };

  // Zoom handlers
  const handleDroneZoom = () => {
    if (dronePosition[0] !== 0 && dronePosition[1] !== 0) {
      setMapCenter(dronePosition);
      setMapZoom(19);
    }
  };

  const handleMissionZoom = () => {
    if (missionWaypoints.length > 0) {
      const coordinates: [number, number][] = missionWaypoints.map(wp => [wp.lat, wp.lng]);
      setMapCenter(coordinates[0]);
      setMapZoom(calculateOptimalZoom(coordinates));
    }
  };

  // Toggle mission path
  const toggleMissionPath = () => {
    setShowMissionPath(prev => !prev);
  };

  // Clear mission path
  const clearMissionPath = () => {
    setMissionWaypoints([]);
    setShowMissionPath(false);
    // Notify waypointStore
    waypointStore.setWaypoints([]);
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      if (mapContainerRef.current?.requestFullscreen) {
        mapContainerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  // Demo animation for the map
  useEffect(() => {
    // For demo purposes, simulate a drone moving
    const interval = setInterval(() => {
      const lat = 18.5278859 + (Math.random() * 0.01 - 0.005);
      const lng = 73.8522314 + (Math.random() * 0.01 - 0.005);
      
      const newTelemetry = {
        latitude: lat,
        longitude: lng,
        altitudeMSL: 100 + Math.random() * 50,
        armed: Math.random() > 0.5,
        flight_mode: ['STABILIZE', 'ALT_HOLD', 'LOITER', 'AUTO'][Math.floor(Math.random() * 4)],
        connected: true
      };
      
      setTelemetryData(prev => ({...prev, ...newTelemetry}));
      
      if (lat !== 0 && lng !== 0) {
        const newPosition: [number, number] = [lat, lng];
        setPathHistory(prev => {
          const newHistory = [...prev, newPosition];
          return newHistory.slice(-maxPathPoints);
        });
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Handle waypoint store updates
  useEffect(() => {
    const handleWaypointsUpdate = (waypoints: Waypoint[]) => {
      setMissionWaypoints(waypoints);
      setShowMissionPath(true);

      if (waypoints.length > 0) {
        const coordinates: [number, number][] = waypoints.map(wp => [wp.lat, wp.lng]);
        setMapCenter(coordinates[0]);
        setMapZoom(calculateOptimalZoom(coordinates));
      }
    };

    waypointStore.addListener(handleWaypointsUpdate);

    const currentWaypoints = waypointStore.getWaypoints();
    if (currentWaypoints.length > 0) {
      handleWaypointsUpdate(currentWaypoints);
    }

    return () => {
      waypointStore.removeListener(handleWaypointsUpdate);
    };
  }, []);

  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    // Handle escape key
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('keydown', handleEscKey);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isFullscreen]);

  // If Leaflet isn't loaded yet, show a loading placeholder
  if (!isLeafletLoaded || !L || !ReactLeaflet || !droneIcon || !waypointIcon) {
    return (
      <div className={`relative bg-slate-900/50 text-white rounded-lg border border-gray-800 backdrop-blur-sm shadow-slate-900/50 overflow-hidden ${className} ${isFullscreen ? 'fixed inset-0 z-50 w-screen h-screen' : 'h-[500px]'} flex items-center justify-center`}>
        <div className="text-gray-400 flex flex-col items-center gap-3">
          <div className="inline-block animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          <div>Loading map components...</div>
        </div>
      </div>
    );
  }

  // Extract components from ReactLeaflet
  const { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } = ReactLeaflet;

  // Create MapUpdater component
  const MapUpdater = ({ center, zoom }: { center: [number, number]; zoom: number }) => {
    const map = useMap();

    useEffect(() => {
      if (center[0] !== 0 && center[1] !== 0) {
        map.setView(center, zoom);
      }
    }, [center, zoom, map]);

    return null;
  };

  // Create TileLayerSelector component
  const TileLayerSelector = ({ mapType }: { mapType: MapType }) => {
    if (mapType === MapType.OSM) {
      return (
        <TileLayer
          attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
      );
    } else if (mapType === MapType.SATELLITE) {
      return (
        <TileLayer
          attribution='© <a href="https://www.arcgis.com/">ArcGIS</a>'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={23}
          maxNativeZoom={19}
        />
      );
    }
    return null;
  };

  return (
    <div
      ref={mapContainerRef}
      className={`relative bg-slate-900/50 text-white rounded-lg border border-gray-800 backdrop-blur-sm shadow-slate-900/50 overflow-hidden ${className} ${isFullscreen ? 'fixed inset-0 z-50 w-screen h-screen' : 'h-[500px]'}`}
    >
      {/* Error alert */}
      {error && (
        <div className="absolute top-0 left-0 right-0 z-[2000] bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg m-4">
          {error}
        </div>
      )}

      {/* Map type selector */}
      <div className="absolute top-4 left-4 z-[1000] flex gap-2 rounded-md overflow-hidden shadow-lg border border-gray-800/50">
        {Object.values(MapType).map(mapType => (
          <button
            key={mapType}
            onClick={() => setSelectedMapType(mapType)}
            className={`px-3 py-1.5 text-white text-sm font-light tracking-wider transition-colors backdrop-blur-sm ${
              selectedMapType === mapType 
                ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' 
                : 'bg-gray-800/90 hover:bg-gray-700/90 text-gray-300'
            }`}
            style={{ borderWidth: '0px' }}
          >
            {mapType}
          </button>
        ))}
      </div>

      {/* Map container */}
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        minZoom={3}
        maxZoom={23}
        className="h-full w-full"
        whenReady={() => setIsLoading(false)}
        zoomAnimation={true}
        fadeAnimation={true}
      >
        <TileLayerSelector mapType={selectedMapType} />

        {/* Drone marker */}
        {dronePosition[0] !== 0 && dronePosition[1] !== 0 && (
          <Marker
            position={dronePosition}
            icon={droneIcon}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-bold mb-1">Drone Status</div>
                <div>Latitude: {telemetryData.latitude.toFixed(6)}°</div>
                <div>Longitude: {telemetryData.longitude.toFixed(6)}°</div>
                <div>Altitude MSL: {telemetryData.altitudeMSL.toFixed(2)}m</div>
                <div>Armed: {telemetryData.armed ? 'Yes' : 'No'}</div>
                <div>Mode: {telemetryData.flight_mode}</div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Waypoint markers and mission path */}
        {showMissionPath && missionWaypoints.length > 0 && (
          <>
            {missionWaypoints.map((waypoint, index) => (
              <Marker
                key={index}
                position={[waypoint.lat, waypoint.lng]}
                icon={waypointIcon}
                zIndexOffset={1000 + index}
              >
                <Popup className="custom-popup">
                  <div className="text-sm font-sans">
                    <div className="font-bold mb-2 text-base">Waypoint {waypoint.seq}</div>
                    <div className="grid grid-cols-2 gap-1">
                      <span className="font-semibold">Latitude:</span>
                      <span>{waypoint.lat.toFixed(6)}°</span>
                      <span className="font-semibold">Longitude:</span>
                      <span>{waypoint.lng.toFixed(6)}°</span>
                      <span className="font-semibold">Altitude:</span>
                      <span>{waypoint.alt.toFixed(2)}m</span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
            <Polyline
              positions={missionWaypoints.map(wp => [wp.lat, wp.lng])}
              color="#3b82f6"
              weight={3}
              opacity={0.7}
              dashArray="5, 10"
            />
          </>
        )}

        {/* Flight path history */}
        {pathHistory.length > 1 && (
          <Polyline
            positions={pathHistory}
            color="#ef4444"
            weight={2}
            opacity={0.7}
          />
        )}

        {/* Map updater */}
        <MapUpdater center={mapCenter} zoom={mapZoom} />
      </MapContainer>

      {/* Fullscreen toggle button */}
      <button
        onClick={toggleFullscreen}
        className="absolute top-20 left-4 z-[1000] p-2 bg-gray-800/90 text-gray-300 rounded-lg shadow border border-gray-700 hover:bg-gray-700/90 transition-colors flex items-center justify-center"
        title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
      >
        <Maximize2 className="h-4 w-4" />
      </button>

      {/* Controls Panel */}
      <div className="absolute bottom-4 right-4 z-[1000] bg-gray-800/90 p-2 rounded-lg shadow border border-gray-700 space-y-2">
        <div className="flex justify-between items-center px-2 py-1">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-light text-gray-300">MAP CONTROLS</span>
          </div>
        </div>
        
        <div className="flex flex-col gap-2 p-2">
          <button
            onClick={handleDroneZoom}
            disabled={dronePosition[0] === 0}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-light transition-colors ${
              dronePosition[0] !== 0
                ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30'
                : 'bg-gray-700/50 text-gray-500 cursor-not-allowed border border-gray-700'
            }`}
          >
            <Eye className="h-4 w-4" />
            CENTER ON DRONE
          </button>
          
          <button
            onClick={handleMissionZoom}
            disabled={missionWaypoints.length === 0}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-light transition-colors ${
              missionWaypoints.length > 0
                ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30'
                : 'bg-gray-700/50 text-gray-500 cursor-not-allowed border border-gray-700'
            }`}
          >
            <MapPin className="h-4 w-4" />
            VIEW MISSION
          </button>
          
          {missionWaypoints.length > 0 && (
            <>
              <button
                onClick={toggleMissionPath}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-md border border-indigo-500/30 text-sm font-light transition-colors"
              >
                <Layers className="h-4 w-4" />
                {showMissionPath ? 'HIDE PATH' : 'SHOW PATH'}
              </button>
              
              <button
                onClick={clearMissionPath}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-md border border-red-500/30 text-sm font-light transition-colors"
              >
                <X className="h-4 w-4" />
                CLEAR PATH
              </button>
            </>
          )}
        </div>
      </div>

      {/* Status Panel */}
      <div className="absolute top-4 right-4 z-[1000] bg-gray-800/90 p-3 rounded-lg shadow border border-gray-700">
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-2 h-2 rounded-full ${telemetryData.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className="text-sm font-light text-gray-300">
            {telemetryData.connected ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
        </div>
        
        {telemetryData.connected && (
          <div className="flex gap-2">
            <div className={`px-2 py-1 rounded text-xs font-light tracking-wider ${
              telemetryData.armed 
                ? 'bg-red-500/20 text-red-300 border border-red-500/30' 
                : 'bg-gray-700/50 text-gray-300 border border-gray-700'
            }`}>
              {telemetryData.armed ? 'ARMED' : 'DISARMED'}
            </div>
            
            <div className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded border border-blue-500/30 text-xs font-light tracking-wider">
              {telemetryData.flight_mode || 'UNKNOWN'}
            </div>
          </div>
        )}
      </div>

      {/* Waypoint Info */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-gray-800/90 p-2 rounded-lg shadow border border-gray-700 text-sm font-light">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-blue-400" />
          <span className="text-gray-300">WAYPOINTS: {missionWaypoints.length}</span>
        </div>
      </div>

      {/* Custom styles for markers */}
      <style jsx global>{`
        .marker-container {
          width: 40px;
          height: 40px;
          position: relative;
        }
        
        .center-dot {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 8px;
          height: 8px;
          background: #3b82f6;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          box-shadow: 0 0 10px rgba(59, 130, 246, 0.8);
        }
        
        .ring {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 30px;
          height: 30px;
          border: 2px solid #3b82f6;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          opacity: 0.7;
        }
        
        .crosshair {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 40px;
          height: 40px;
          transform: translate(-50%, -50%);
        }
        
        .crosshair:before, .crosshair:after {
          content: '';
          position: absolute;
          background: #3b82f6;
          opacity: 0.7;
        }
        
        .crosshair:before {
          top: 50%;
          left: 0;
          width: 100%;
          height: 1px;
        }
        
        .crosshair:after {
          left: 50%;
          top: 0;
          width: 1px;
          height: 100%;
        }
        
        .waypoint-container {
          width: 30px;
          height: 30px;
          position: relative;
        }
        
        .waypoint-dot {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 6px;
          height: 6px;
          background: #ef4444;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          box-shadow: 0 0 8px rgba(239, 68, 68, 0.8);
        }
        
        .waypoint-ring {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 20px;
          height: 20px;
          border: 2px solid #ef4444;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          opacity: 0.7;
        }
        
        /* Dark theme for map */
        .leaflet-container {
          background: #1f2937 !important;
        }
        
        /* Custom popup styling */
        .leaflet-popup-content-wrapper {
          background: rgba(17, 24, 39, 0.9);
          color: #e5e7eb;
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 8px;
        }
        
        .leaflet-popup-tip {
          background: rgba(17, 24, 39, 0.9);
        }
      `}</style>
    </div>
  );
};

// Use dynamic import to load the component only on client-side
const DroneMap = dynamic(
  () => Promise.resolve(DroneMapClient),
  { 
    ssr: false,
    loading: () => <DroneMapPlaceholder />
  }
);

export default DroneMap;
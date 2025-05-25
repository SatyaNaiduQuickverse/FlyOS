// components/DroneLocationMap.tsx - WEBSOCKET ISSUES FIXED
import React from 'react';
import { MapPin, Crosshair, Navigation } from 'lucide-react';

interface DroneLocation {
  lat: number;
  lng: number;
  timestamp: string;
  area: string;
  city: string;
}

interface DroneLocationMapProps {
  location: DroneLocation;
  expanded?: boolean;
}

/**
 * Enhanced drone location map component with better visual representation
 * Simulates a tactical map display suitable for military drone operations
 * No WebSocket dependencies - purely displays location data
 */
const DroneLocationMap: React.FC<DroneLocationMapProps> = ({ location, expanded = false }) => {
  // Validate coordinates
  const hasValidCoordinates = location && location.lat !== 0 && location.lng !== 0 && 
    !isNaN(location.lat) && !isNaN(location.lng);
  
  if (!hasValidCoordinates) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-800/50 rounded">
        <div className="text-center text-gray-400">
          <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No GPS Signal</p>
          <p className="text-xs text-gray-500 mt-1">
            {location ? `${location.lat}, ${location.lng}` : 'No coordinates'}
          </p>
        </div>
      </div>
    );
  }

  // Enhanced map styling with tactical appearance
  const mapStyle: React.CSSProperties = {
    backgroundImage: `
      radial-gradient(circle at 30% 20%, rgba(59, 130, 246, 0.1), transparent),
      radial-gradient(circle at 70% 80%, rgba(16, 185, 129, 0.05), transparent),
      linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)
    `,
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    borderRadius: '0.5rem',
  };

  // Calculate position for the drone pin (normalized coordinates)
  // Use Math.abs and proper bounds checking
  const normalizedLng = ((Math.abs(location.lng) + 180) % 360) / 360;
  const normalizedLat = (90 - Math.abs(location.lat)) / 180;
  
  // Ensure positions are within bounds with better calculation
  const pinLeft = Math.max(10, Math.min(90, normalizedLng * 80 + 10));
  const pinTop = Math.max(10, Math.min(90, normalizedLat * 80 + 10));

  const pinStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${pinLeft}%`,
    top: `${pinTop}%`,
    transform: 'translate(-50%, -50%)',
    zIndex: 10,
  };

  // Generate tactical grid overlay
  const gridLines = [];
  for (let i = 0; i <= 10; i++) {
    // Horizontal lines
    gridLines.push(
      <div 
        key={`h-${i}`} 
        style={{ 
          position: 'absolute', 
          left: 0, 
          right: 0, 
          top: `${i * 10}%`, 
          height: '1px', 
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          opacity: i % 2 === 0 ? 0.3 : 0.1
        }} 
      />
    );
    // Vertical lines
    gridLines.push(
      <div 
        key={`v-${i}`} 
        style={{ 
          position: 'absolute', 
          top: 0, 
          bottom: 0, 
          left: `${i * 10}%`, 
          width: '1px', 
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          opacity: i % 2 === 0 ? 0.3 : 0.1
        }} 
      />
    );
  }

  // Generate area markers based on location
  const areaMarkers = [
    { 
      name: location.city || 'Unknown City', 
      top: `${Math.max(15, Math.min(85, pinTop - 20))}%`, 
      left: `${Math.max(15, Math.min(85, pinLeft + 15))}%`,
      type: 'city'
    },
    { 
      name: location.area || 'Unknown Area', 
      top: `${Math.max(15, Math.min(85, pinTop + 20))}%`, 
      left: `${Math.max(15, Math.min(85, pinLeft - 15))}%`,
      type: 'area'
    },
    { 
      name: `Grid ${Math.floor(Math.abs(location.lat)).toString().padStart(2, '0')}${Math.floor(Math.abs(location.lng)).toString().padStart(2, '0')}`, 
      top: '15%', 
      left: '15%',
      type: 'grid'
    },
  ];

  // Determine time since last update for status indicator
  let statusColor = 'bg-green-500';
  let statusText = 'LIVE';
  
  try {
    const lastUpdate = new Date(location.timestamp);
    const now = new Date();
    const timeDiff = (now.getTime() - lastUpdate.getTime()) / 1000; // seconds
    
    if (timeDiff > 300) { // 5 minutes
      statusColor = 'bg-red-500';
      statusText = 'STALE';
    } else if (timeDiff > 60) { // 1 minute
      statusColor = 'bg-yellow-500';
      statusText = 'DELAYED';
    }
  } catch (error) {
    // Invalid timestamp, show as stale
    statusColor = 'bg-gray-500';
    statusText = 'UNKNOWN';
  }

  return (
    <div className="w-full h-full relative">
      <div style={mapStyle} className="border border-gray-700/50">
        {/* Tactical grid overlay */}
        {gridLines}
        
        {/* Radar sweep effect (optional visual enhancement) */}
        <div 
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            background: `conic-gradient(from 0deg at ${pinLeft}% ${pinTop}%, 
              transparent 0deg, 
              rgba(59, 130, 246, 0.3) 45deg, 
              transparent 90deg, 
              transparent 360deg)`,
            animation: 'spin 8s linear infinite',
          }}
        />
        
        {/* Drone position marker */}
        <div style={pinStyle}>
          <div className="relative">
            {/* Pulsing circle background */}
            <div className="absolute -inset-2 bg-blue-500/30 rounded-full animate-ping" />
            <div className="absolute -inset-1 bg-blue-600/50 rounded-full" />
            
            {/* Main drone icon */}
            <div className="relative bg-red-500 rounded-full p-1">
              <Navigation size={expanded ? 16 : 12} className="text-white transform rotate-45" />
            </div>
            
            {/* Status indicator */}
            <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${statusColor} animate-pulse`} />
          </div>
        </div>
        
        {/* Area labels */}
        {areaMarkers.map((marker, i) => (
          <div 
            key={i}
            style={{ 
              position: 'absolute', 
              top: marker.top, 
              left: marker.left,
              transform: 'translate(-50%, -50%)',
              zIndex: 5
            }}
            className={`text-xs pointer-events-none ${
              marker.type === 'city' ? 'text-blue-300 font-medium' :
              marker.type === 'area' ? 'text-green-300' :
              'text-gray-400'
            }`}
          >
            <div className="bg-gray-900/80 px-2 py-1 rounded border border-gray-600/50 backdrop-blur-sm">
              {marker.name}
            </div>
          </div>
        ))}
        
        {/* Crosshair overlay for targeting */}
        <div 
          style={{ 
            position: 'absolute', 
            top: '50%', 
            left: '50%',
            transform: 'translate(-50%, -50%)',
            opacity: 0.3,
            pointerEvents: 'none'
          }}
        >
          <Crosshair size={expanded ? 32 : 24} className="text-blue-400" />
        </div>
        
        {/* Coordinates and status display */}
        <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end">
          {/* Coordinates */}
          <div className="bg-gray-900/90 px-2 py-1 rounded text-xs text-gray-300 border border-gray-600/30">
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span>{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</span>
            </div>
          </div>
          
          {/* Status indicator */}
          <div className={`px-2 py-1 rounded text-xs text-white border ${
            statusColor === 'bg-green-500' ? 'bg-green-500/20 border-green-500/30' :
            statusColor === 'bg-yellow-500' ? 'bg-yellow-500/20 border-yellow-500/30' :
            statusColor === 'bg-red-500' ? 'bg-red-500/20 border-red-500/30' :
            'bg-gray-500/20 border-gray-500/30'
          }`}>
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${statusColor}`} />
              <span>{statusText}</span>
            </div>
          </div>
        </div>
        
        {/* Compass rose */}
        <div className="absolute top-2 right-2">
          <div className="bg-gray-900/90 p-2 rounded border border-gray-600/30">
            <div className="relative w-8 h-8">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-6 h-6 border border-gray-400 rounded-full opacity-50" />
              </div>
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 text-xs text-red-400 font-bold">
                N
              </div>
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 text-xs text-gray-500">
                S
              </div>
              <div className="absolute left-0 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">
                W
              </div>
              <div className="absolute right-0 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">
                E
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Expanded view additional info */}
      {expanded && (
        <div className="absolute inset-x-0 bottom-0 bg-gray-900/95 p-3 rounded-b border-t border-gray-600/30">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-gray-400">Last Update:</span>
              <div className="text-white">
                {(() => {
                  try {
                    return new Date(location.timestamp).toLocaleTimeString();
                  } catch {
                    return 'Invalid timestamp';
                  }
                })()}
              </div>
            </div>
            <div>
              <span className="text-gray-400">Grid Reference:</span>
              <div className="text-white">
                {Math.floor(Math.abs(location.lat)).toString().padStart(2, '0')}°
                {Math.floor(Math.abs(location.lng)).toString().padStart(2, '0')}°
              </div>
            </div>
          </div>
        </div>
      )}
      
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default DroneLocationMap;

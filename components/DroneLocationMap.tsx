// components/DroneLocationMap.tsx
import React from 'react';
import { MapPin } from 'lucide-react';

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
 * A component that displays a drone's location on a map.
 * 
 * Note: This is a placeholder component that simulates a map.
 * In a production environment, you would integrate with a real mapping
 * library like Leaflet, Mapbox, or Google Maps.
 */
const DroneLocationMap: React.FC<DroneLocationMapProps> = ({ location, expanded = false }) => {
  // This is a simplified map simulation - in a real app, replace with actual map library
  const mapStyle = {
    backgroundImage: 'linear-gradient(to bottom, #1a1a2e, #16213e, #1e2a4a)',
    position: 'relative' as const,
    width: '100%',
    height: '100%',
  };

  // Calculate a position for the pin on our fake map
  // In a real implementation, this would be handled by the mapping library
  const pinStyle = {
    position: 'absolute' as const,
    // Create a position that looks random but is based on the actual coordinates
    // to maintain consistency for the same location
    left: `${((location.lng + 180) / 360) * 100}%`,
    top: `${((90 - location.lat) / 180) * 100}%`,
    transform: 'translate(-50%, -50%)',
  };

  // Generate some fake map elements
  const gridLines = Array.from({ length: 10 }).map((_, i) => (
    <div 
      key={`h-${i}`} 
      style={{ 
        position: 'absolute', 
        left: 0, 
        right: 0, 
        top: `${i * 10}%`, 
        height: '1px', 
        backgroundColor: 'rgba(255,255,255,0.1)' 
      }} 
    />
  )).concat(
    Array.from({ length: 10 }).map((_, i) => (
      <div 
        key={`v-${i}`} 
        style={{ 
          position: 'absolute', 
          top: 0, 
          bottom: 0, 
          left: `${i * 10}%`, 
          width: '1px', 
          backgroundColor: 'rgba(255,255,255,0.1)' 
        }} 
      />
    ))
  );

  // Create some fake landmark names based on the location
  const fakeLocationLabels = [
    { name: location.city, top: '20%', left: '50%' },
    { name: `${location.area} Region`, top: '80%', left: '50%' },
    { name: `Sector ${Math.floor(Math.abs(location.lat * location.lng) % 100)}`, top: '50%', left: '20%' },
  ];

  return (
    <div className="w-full h-full overflow-hidden">
      <div style={mapStyle}>
        {/* Grid lines */}
        {gridLines}
        
        {/* Location pin */}
        <div style={pinStyle}>
          <div className="relative">
            <MapPin size={expanded ? 32 : 24} className="text-red-500" />
            <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-green-500 animate-ping" />
          </div>
        </div>
        
        {/* Location labels */}
        {fakeLocationLabels.map((label, i) => (
          <div 
            key={i}
            style={{ 
              position: 'absolute', 
              top: label.top, 
              left: label.left,
              transform: 'translate(-50%, -50%)',
              opacity: 0.7
            }}
            className="text-xs text-gray-300 pointer-events-none"
          >
            {label.name}
          </div>
        ))}
        
        {/* Coordinates display */}
        <div 
          style={{ 
            position: 'absolute', 
            bottom: '10px', 
            right: '10px', 
            padding: '2px 6px',
            backgroundColor: 'rgba(0,0,0,0.5)',
            borderRadius: '4px' 
          }}
          className="text-xs text-gray-300"
        >
          {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
        </div>
      </div>
    </div>
  );
};

export default DroneLocationMap;

// hooks/useDroneState.ts
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useDroneSocket } from './useDroneSocket';

interface DroneData {
  id: string;
  model?: string;
  status?: string;
  latitude?: number;
  longitude?: number;
  altitudeMSL?: number;
  altitudeRelative?: number;
  armed?: boolean;
  flight_mode?: string;
  connected?: boolean;
  percentage?: number;
  voltage?: number;
  current?: number;
  orientation?: {
    x: number;
    y: number;
    z: number;
  };
  linear?: {
    x: number;
    y: number;
    z: number;
  };
  timestamp?: string;
  [key: string]: any;
}

interface UseDroneStateOptions {
  droneId: string;
  token: string | null;
  initialFetch?: boolean;
}

interface UseDroneStateReturn {
  drone: DroneData | null;
  isLoading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  isConnected: boolean;
  latency: number | null;
  refreshDrone: () => Promise<void>;
  sendCommand: (commandType: string, parameters?: any) => Promise<any>;
}

/**
 * Hook for managing a drone's state
 */
export function useDroneState({
  droneId,
  token,
  initialFetch = true
}: UseDroneStateOptions): UseDroneStateReturn {
  const [drone, setDrone] = useState<DroneData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Handle drone updates via WebSocket
  const handleDroneUpdate = useCallback((data: any) => {
    if (data.droneId === droneId) {
      setDrone(prevState => ({
        id: droneId,
        ...(prevState || {}),
        ...data.data
      }));
    }
  }, [droneId]);
  
  // Set up WebSocket connection
  const { isConnected, lastUpdate, latency } = useDroneSocket({
    token,
    droneId,
    onUpdate: handleDroneUpdate
  });
  
  // Fetch initial drone state
  const refreshDrone = useCallback(async () => {
    if (!token) {
      setError('Authentication required');
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await axios.get(`/api/drones/${droneId}/state`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        setDrone(response.data.data);
        setError(null);
      } else {
        setError(response.data.message || 'Failed to load drone data');
      }
    } catch (err: any) {
      console.error('Error fetching drone:', err);
      setError(`Error connecting to drone: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [droneId, token]);
  
  // Fetch initial drone state
  useEffect(() => {
    if (initialFetch) {
      refreshDrone();
    }
  }, [initialFetch, refreshDrone]);
  
  // Send commands to the drone
  const sendCommand = useCallback(async (commandType: string, parameters: any = {}) => {
    if (!token) {
      setError('Authentication required to send commands');
      return null;
    }
    
    if (!droneId) {
      setError('No drone selected');
      return null;
    }
    
    try {
      const response = await axios.post(`/api/drones/${droneId}/command`, {
        commandType,
        parameters
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        return response.data;
      } else {
        setError(response.data.message || 'Failed to send command');
        return null;
      }
    } catch (err: any) {
      console.error('Error sending command:', err);
      setError(`Error sending command to drone: ${err.message}`);
      return null;
    }
  }, [droneId, token]);
  
  return {
    drone,
    isLoading,
    error,
    lastUpdate,
    isConnected,
    latency,
    refreshDrone,
    sendCommand
  };
}
// lib/hooks/useDroneState.ts - SIMPLE COMPATIBILITY FIX
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

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

export function useDroneState({
  droneId,
  token,
  initialFetch = true
}: UseDroneStateOptions): UseDroneStateReturn {
  const [drone, setDrone] = useState<DroneData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);

  // Fetch drone state via API (no WebSocket for now)
  const refreshDrone = useCallback(async () => {
    if (!token) {
      setError('Authentication required');
      setIsLoading(false);
      return;
    }

    try {
      const startTime = Date.now();
      
      const response = await axios.get(`/api/drones/${droneId}/state`, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        timeout: 10000
      });

      const endTime = Date.now();
      setLatency(endTime - startTime);

      if (response.data.success) {
        setDrone(prevState => ({
          id: droneId,
          ...(prevState || {}),
          ...response.data.data
        }));
        setError(null);
        setLastUpdate(new Date());
        setIsConnected(true); // Simulate connection since API works
        console.log(`Successfully loaded state for drone ${droneId}`);
      } else {
        setError(response.data.message || 'Failed to load drone data');
        setIsConnected(false);
      }
    } catch (err: any) {
      console.error('Error fetching drone:', err);
      setError(`Error connecting to drone: ${err.message}`);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [droneId, token]);

  // Setup polling for "real-time" updates (every 2 seconds)
  useEffect(() => {
    if (!token || !droneId) {
      setError('Authentication or drone ID missing');
      setIsLoading(false);
      return;
    }

    // Initial fetch
    if (initialFetch) {
      refreshDrone();
    }

    // Set up polling for pseudo real-time updates
    const intervalId = setInterval(() => {
      refreshDrone();
    }, 2000); // Poll every 2 seconds for real-time feel

    // Cleanup
    return () => {
      clearInterval(intervalId);
    };
  }, [droneId, token, initialFetch, refreshDrone]);

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
      console.log(`Sending ${commandType} command to drone ${droneId}:`, parameters);
      
      const response = await axios.post(`/api/drones/${droneId}/command`, {
        commandType,
        parameters
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data.success) {
        console.log(`Command ${commandType} sent successfully to drone ${droneId}`);
        // Refresh data immediately after command
        setTimeout(refreshDrone, 500);
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
  }, [droneId, token, refreshDrone]);

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

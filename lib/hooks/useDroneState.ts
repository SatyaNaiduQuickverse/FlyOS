// lib/hooks/useDroneState.ts - COMPLETE WEBSOCKET FIX
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';

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
  const [socket, setSocket] = useState<Socket | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [usePolling, setUsePolling] = useState(false);

  // Fetch drone state via API
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
        timeout: 15000
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
        setIsConnected(true);
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

  // Initialize WebSocket connection with proper error handling
  useEffect(() => {
    if (!token || !droneId) {
      setError('Authentication or drone ID missing');
      setIsLoading(false);
      return;
    }

    // Try WebSocket connection
    const connectWebSocket = () => {
      try {
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4002';
        console.log(`Attempting WebSocket connection to: ${wsUrl}`);
        
        const newSocket = io(wsUrl, {
          auth: { token },
          transports: ['websocket'],
          timeout: 10000,
          reconnection: true,
          reconnectionAttempts: 3,
          reconnectionDelay: 2000
        });

        newSocket.on('connect', () => {
          console.log('WebSocket connected successfully');
          setSocketConnected(true);
          setUsePolling(false);
          
          // Subscribe to drone updates
          newSocket.emit('subscribe_drone', droneId);
        });

        newSocket.on('drone_state', (data: { droneId: string; data: DroneData }) => {
          if (data.droneId === droneId) {
            setDrone(prevState => ({
              id: droneId,
              ...(prevState || {}),
              ...data.data
            }));
            setError(null);
            setLastUpdate(new Date());
            setIsConnected(true);
            setIsLoading(false);
          }
        });

        newSocket.on('subscription_status', (data: any) => {
          console.log('Subscription status:', data);
        });

        newSocket.on('connection_status', (data: any) => {
          console.log('Connection status:', data);
        });

        newSocket.on('connect_error', (error: Error) => {
          console.warn('WebSocket connection failed:', error.message);
          setSocketConnected(false);
          setUsePolling(true);
          
          // Don't set this as a critical error - we'll fallback to polling
          if (!usePolling) {
            console.log('Falling back to polling mode');
          }
        });

        newSocket.on('disconnect', (reason: string) => {
          console.log('WebSocket disconnected:', reason);
          setSocketConnected(false);
          
          // If disconnected unexpectedly, fall back to polling
          if (reason !== 'io client disconnect') {
            setUsePolling(true);
          }
        });

        newSocket.on('error', (error: any) => {
          console.error('WebSocket error:', error);
          setSocketConnected(false);
          setUsePolling(true);
        });

        setSocket(newSocket);

        // Cleanup function
        return () => {
          if (newSocket) {
            console.log('Cleaning up WebSocket connection');
            newSocket.emit('unsubscribe_drone', droneId);
            newSocket.disconnect();
          }
        };
      } catch (wsError) {
        console.error('Failed to initialize WebSocket:', wsError);
        setSocketConnected(false);
        setUsePolling(true);
        return () => {}; // Empty cleanup
      }
    };

    // Try WebSocket first
    const cleanup = connectWebSocket();

    return cleanup;
  }, [droneId, token, usePolling]);

  // Polling fallback when WebSocket fails
  useEffect(() => {
    if (!token || !droneId) return;

    // Initial fetch regardless of connection type
    if (initialFetch) {
      refreshDrone();
    }

    // Set up polling if WebSocket is not connected or explicitly using polling
    if (usePolling || !socketConnected) {
      console.log('Setting up polling fallback');
      
      const intervalId = setInterval(() => {
        if (!socketConnected) {
          refreshDrone();
        }
      }, 3000); // Poll every 3 seconds

      return () => {
        clearInterval(intervalId);
      };
    }
  }, [droneId, token, initialFetch, refreshDrone, usePolling, socketConnected]);

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
        },
        timeout: 15000
      });

      if (response.data.success) {
        console.log(`Command ${commandType} sent successfully to drone ${droneId}`);
        
        // Refresh data after command (whether using WebSocket or polling)
        setTimeout(refreshDrone, 1000);
        
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
    isConnected: socketConnected || isConnected, // Connected via WS or API
    latency,
    refreshDrone,
    sendCommand
  };
}
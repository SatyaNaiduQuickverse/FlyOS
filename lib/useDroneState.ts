// lib/useDroneState.ts
import { useState, useEffect } from 'react';
import { getDroneState } from './api/droneApi';
import { io, Socket } from 'socket.io-client';
import { isBrowser, getLocalStorageItem } from './utils/browser';

// Define proper type for drone state
interface DroneState {
  latitude?: number;
  longitude?: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  batteryLevel?: number;
  signalStrength?: number;
  status?: string;
  timestamp?: string;
  [key: string]: unknown; // For other properties
}

export const useDroneState = (droneId: string, pollingInterval = 5000) => {
  const [droneState, setDroneState] = useState<DroneState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Function to fetch drone state
  const fetchDroneState = async () => {
    try {
      setIsLoading(true);
      const response = await getDroneState(droneId);
      
      if (response.success && response.data) {
        setDroneState(response.data);
        setError(null);
      } else {
        setError(response.message || 'Failed to fetch drone state');
      }
    } catch (err) {
      console.error('Error in fetchDroneState:', err);
      setError('An error occurred while fetching drone state');
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize socket connection for real-time updates - only in browser
  useEffect(() => {
    // Skip this effect entirely during server-side rendering
    if (!isBrowser) return;
    
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4002';
    // CHANGED FROM 'token' to 'flyos_token' to match the rest of the application
    const token = getLocalStorageItem('flyos_token');

    if (!token) {
      setError('Authentication required for real-time updates');
      return;
    }

    const newSocket = io(wsUrl, {
      auth: { token },
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected, subscribing to drone:', droneId);
      newSocket.emit('subscribe_drone', droneId);
    });

    newSocket.on('drone_state', (data: { droneId: string; data: DroneState }) => {
      if (data.droneId === droneId) {
        setDroneState(data.data);
        setIsLoading(false);
        setError(null);
      }
    });

    newSocket.on('error', (err: { message: string }) => {
      console.error('WebSocket error:', err);
      setError(err.message || 'WebSocket connection error');
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      if (newSocket) {
        console.log('Unsubscribing from drone:', droneId);
        newSocket.emit('unsubscribe_drone', droneId);
        newSocket.disconnect();
      }
    };
  }, [droneId]);

  // Fallback to polling if real-time is not available or as a backup
  useEffect(() => {
    // Skip initial fetch during server-side rendering
    if (!isBrowser) return;
    
    // Fetch initial state
    fetchDroneState();

    // Set up polling interval
    const intervalId = setInterval(fetchDroneState, pollingInterval);
    
    // Cleanup on unmount
    return () => clearInterval(intervalId);
  }, [droneId, pollingInterval]);

  return {
    droneState,
    isLoading,
    error,
    refreshData: fetchDroneState,
  };
};

export default useDroneState;
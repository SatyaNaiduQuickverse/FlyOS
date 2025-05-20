// hooks/useDroneSocket.ts
import { useState, useEffect, useCallback } from 'react';
import SocketClient from '../socketClient';

interface UseDroneSocketOptions {
  token: string | null;
  droneId: string;
  onUpdate?: (data: any) => void;
  onError?: (error: any) => void;
  autoPing?: boolean;
  pingInterval?: number;
}

interface UseDroneSocketReturn {
  isConnected: boolean;
  lastUpdate: Date | null;
  latency: number | null;
  subscribe: () => void;
  unsubscribe: () => void;
  ping: () => void;
}

/**
 * Hook for managing WebSocket connections to a specific drone
 */
export function useDroneSocket({
  token,
  droneId,
  onUpdate,
  onError,
  autoPing = true,
  pingInterval = 10000
}: UseDroneSocketOptions): UseDroneSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  
  // Initialize socket connection
  useEffect(() => {
    if (!token) return;
    
    const socketClient = SocketClient.getInstance();
    socketClient.init(token);
    
    setIsConnected(socketClient.isConnected());
    
    // Clean up on unmount
    return () => {
      // We don't disconnect here because other components might be using the socket
    };
  }, [token]);
  
  // Subscribe to drone updates
  const subscribe = useCallback(() => {
    if (!token || !droneId) return;
    
    const socketClient = SocketClient.getInstance();
    socketClient.subscribeToDrone(droneId);
  }, [token, droneId]);
  
  // Unsubscribe from drone updates
  const unsubscribe = useCallback(() => {
    if (!token || !droneId) return;
    
    const socketClient = SocketClient.getInstance();
    socketClient.unsubscribeFromDrone(droneId);
  }, [token, droneId]);
  
  // Send a ping
  const ping = useCallback(() => {
    if (!token) return;
    
    const socketClient = SocketClient.getInstance();
    socketClient.ping();
  }, [token]);
  
  // Set up event listeners
  useEffect(() => {
    if (!token || !droneId) return;
    
    const socketClient = SocketClient.getInstance();
    
    // Listen for drone updates
    const unsubscribeDroneUpdate = socketClient.onDroneUpdate(droneId, (data) => {
      if (onUpdate) {
        onUpdate(data);
      }
      
      setLastUpdate(new Date());
      
      // Calculate latency if metadata is available
      if (data.data._meta) {
        const now = Date.now();
        const serverTimestamp = data.data._meta.socketServerTimestamp;
        if (serverTimestamp) {
          const pingLatency = now - serverTimestamp;
          setLatency(pingLatency);
        }
      }
    });
    
    // Listen for pong responses
    const unsubscribePong = socketClient.onPong((data) => {
      const roundTripTime = Date.now() - data.clientSentTime;
      setLatency(roundTripTime);
    });
    
    // Set up auto ping if enabled
    let pingTimer: NodeJS.Timeout | null = null;
    if (autoPing) {
      pingTimer = setInterval(() => {
        if (socketClient.isConnected()) {
          socketClient.ping();
        }
      }, pingInterval);
    }
    
    // Subscribe to the drone
    subscribe();
    
    // Clean up on unmount
    return () => {
      unsubscribeDroneUpdate();
      unsubscribePong();
      if (pingTimer) {
        clearInterval(pingTimer);
      }
      unsubscribe();
    };
  }, [token, droneId, onUpdate, onError, autoPing, pingInterval, subscribe, unsubscribe]);
  
  return {
    isConnected,
    lastUpdate,
    latency,
    subscribe,
    unsubscribe,
    ping
  };
}
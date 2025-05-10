import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../auth';

// Hook for real-time drone state
export const useDroneState = (droneId: string) => {
  const [droneState, setDroneState] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const { token } = useAuth();

  useEffect(() => {
    if (!droneId || !token) return;

    // Connect to WebSocket server
    const socketUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4002';
    const socketInstance = io(socketUrl, {
      auth: { token },
      query: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    // Set up event handlers
    socketInstance.on('connect', () => {
      setIsConnected(true);
      setError(null);
      console.log('WebSocket connected');
      
      // Subscribe to drone updates
      socketInstance.emit('subscribe_drone', droneId);
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
      console.log('WebSocket disconnected');
    });

    socketInstance.on('connect_error', (err) => {
      setIsConnected(false);
      setError(`Connection error: ${err.message}`);
      console.error('WebSocket connection error:', err);
    });

    socketInstance.on('error', (err) => {
      setError(err.message);
      console.error('WebSocket error:', err);
    });

    socketInstance.on('drone_state', (data) => {
      if (data.droneId === droneId) {
        setDroneState(data.data);
      }
    });

    socketInstance.on('subscription_status', (data) => {
      console.log(`Subscription status: ${data.status} for drone ${data.droneId}`);
    });

    // Store socket reference
    setSocket(socketInstance);

    // Cleanup on unmount
    return () => {
      if (socketInstance.connected) {
        socketInstance.emit('unsubscribe_drone', droneId);
        socketInstance.disconnect();
      }
    };
  }, [droneId, token]);

  // Function to send a command to the drone
  const sendCommand = async (commandType: string, parameters: any = {}) => {
    try {
      const { sendDroneCommand } = await import('../api/droneApi');
      const result = await sendDroneCommand(droneId, commandType, parameters);
      return result;
    } catch (error) {
      console.error('Error sending command:', error);
      throw error;
    }
  };

  return {
    droneState,
    isConnected,
    error,
    sendCommand,
    socket,
  };
};

import { io, Socket } from 'socket.io-client';
import { logger } from '../utils/logger';

// Create realtime client
const createRealtimeClient = (realtimeUrl: string, jwtToken: string, testRunId: number, recordMetricFn?: Function) => {
  let socket: Socket | null = null;
  const droneSubscriptions = new Set<string>();
  
  // Connect to the realtime service
  const connect = () => {
    try {
      socket = io(realtimeUrl, {
        auth: {
          token: jwtToken
        },
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 500,
        reconnectionAttempts: 10
      });
      
      // Setup event handlers
      setupEventHandlers();
      
      return socket;
    } catch (error) {
      logger.error('Failed to connect to realtime service:', error);
      throw error;
    }
  };
  
  // Setup socket event handlers
  const setupEventHandlers = () => {
    if (!socket) return;
    
    socket.on('connect', () => {
      logger.info('Connected to realtime service');
      
      // Resubscribe to drones
      droneSubscriptions.forEach(droneId => {
        subscribeToDrone(droneId);
      });
    });
    
    socket.on('disconnect', (reason) => {
      logger.info(`Disconnected from realtime service: ${reason}`);
    });
    
    socket.on('error', (error) => {
      logger.error('Realtime service error:', error);
    });
    
    socket.on('subscription_status', (data) => {
      logger.info(`Subscription status for ${data.droneId}: ${data.status}`);
    });
    
    socket.on('drone_state', (data) => {
      // Record the time it took to receive the update
      const now = Date.now();
      const timestamp = data.data.timestamp ? new Date(data.data.timestamp).getTime() : now;
      const latency = now - timestamp;
      
      // Record metric if function provided
      if (recordMetricFn) {
        recordMetricFn(
          'realtime',
          'drone_state_update',
          latency,
          true,
          data.droneId,
          { dataTimestamp: timestamp }
        );
      }
    });
  };
  
  // Subscribe to drone updates
  const subscribeToDrone = (droneId: string) => {
    if (!socket) {
      logger.error('Cannot subscribe to drone, socket not connected');
      return false;
    }
    
    // Record subscription time
    const startTime = Date.now();
    
    // Subscribe to drone updates
    socket.emit('subscribe_drone', droneId);
    
    // Add to subscriptions set
    droneSubscriptions.add(droneId);
    
    // Record metric if function provided
    if (recordMetricFn) {
      recordMetricFn(
        'realtime',
        'subscribe_drone',
        0, // We'll update this when we get a response
        true,
        droneId,
        { subscriptionTime: startTime }
      );
    }
    
    return true;
  };
  
  // Unsubscribe from drone updates
  const unsubscribeFromDrone = (droneId: string) => {
    if (!socket) {
      logger.error('Cannot unsubscribe from drone, socket not connected');
      return false;
    }
    
    // Unsubscribe from drone updates
    socket.emit('unsubscribe_drone', droneId);
    
    // Remove from subscriptions set
    droneSubscriptions.delete(droneId);
    
    return true;
  };
  
  // Disconnect from realtime service
  const disconnect = () => {
    if (!socket) return;
    
    // Unsubscribe from all drones
    droneSubscriptions.forEach(droneId => {
      unsubscribeFromDrone(droneId);
    });
    
    // Disconnect socket
    socket.disconnect();
    socket = null;
  };
  
  return {
    connect,
    subscribeToDrone,
    unsubscribeFromDrone,
    disconnect
  };
};

export { createRealtimeClient };
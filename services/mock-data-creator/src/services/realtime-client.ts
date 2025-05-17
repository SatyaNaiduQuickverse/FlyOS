// services/mock-data-creator/src/services/realtime-client.ts
import { io, Socket } from 'socket.io-client';
import { logger } from '../utils/logger';

// Create realtime client
const createRealtimeClient = (realtimeUrl: string, jwtToken: string, testRunId: number, recordMetricFn?: Function) => {
  let socket: Socket | null = null;
  const droneSubscriptions = new Set<string>();
  const latencyBuffer: number[] = []; // Buffer to store recent latency values
  let isConnected = false;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 10;
  
  // Calculate metrics from the latency buffer
  const calculateLatencyMetrics = () => {
    if (latencyBuffer.length === 0) return { avg: 0, p95: 0 };
    
    // Calculate average
    const avg = latencyBuffer.reduce((sum, val) => sum + val, 0) / latencyBuffer.length;
    
    // Calculate 95th percentile
    const sorted = [...latencyBuffer].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p95 = sorted[p95Index];
    
    return { avg, p95 };
  };
  
  // Connect to the realtime service
  const connect = () => {
    try {
      if (socket && socket.connected) {
        logger.info('Already connected to realtime service');
        return socket;
      }
      
      socket = io(realtimeUrl, {
        auth: {
          token: jwtToken
        },
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 500,
        reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
        timeout: 10000
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
      isConnected = true;
      reconnectAttempts = 0;
      logger.info('Connected to realtime service');
      
      // Send a ping to measure latency
      sendPing();
      
      // Resubscribe to drones
      droneSubscriptions.forEach(droneId => {
        subscribeToDrone(droneId);
      });
    });
    
    socket.on('disconnect', (reason) => {
      isConnected = false;
      logger.info(`Disconnected from realtime service: ${reason}`);
    });
    
    socket.on('error', (error) => {
      logger.error('Realtime service error:', error);
    });
    
    socket.on('connect_error', (error) => {
      reconnectAttempts++;
      logger.error(`Connection error (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}):`, error);
      
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        logger.error('Max reconnection attempts reached, stopping reconnection');
        socket?.close();
      }
    });
    
    socket.on('subscription_status', (data) => {
      logger.info(`Subscription status for ${data.droneId}: ${data.status}`);
      
      // Record subscription latency metrics
      if (data.timestamp && recordMetricFn) {
        const now = Date.now();
        const latency = now - data.timestamp;
        
        recordMetricFn(
          'realtime',
          'subscription_confirmation',
          latency,
          true,
          data.droneId,
          { status: data.status }
        );
      }
    });
    
    socket.on('drone_state', (data) => {
      // Record the time it took to receive the update
      const clientReceivedTimestamp = Date.now();
      
      // Extract timestamps for latency calculation
      const dataTimestamp = data.data.timestamp ? new Date(data.data.timestamp).getTime() : clientReceivedTimestamp;
      const redisTimestamp = data.data._meta?.redisTimestamp || dataTimestamp;
      const socketServerTimestamp = data.data._meta?.socketServerTimestamp || clientReceivedTimestamp;
      
      // Calculate different latency components
      const totalLatency = clientReceivedTimestamp - dataTimestamp; // Total end-to-end latency
      const redisToClientLatency = clientReceivedTimestamp - redisTimestamp; // Redis to client latency
      const serverToClientLatency = clientReceivedTimestamp - socketServerTimestamp; // Socket.IO server to client latency
      
      // Store latency for moving average
      latencyBuffer.push(redisToClientLatency);
      if (latencyBuffer.length > 100) {
        latencyBuffer.shift(); // Keep only last 100 values
      }
      
      // Record metric if function provided
      if (recordMetricFn) {
        recordMetricFn(
          'realtime',
          'drone_state_update',
          redisToClientLatency, // Use Redis-to-client latency as the primary metric
          true,
          data.droneId,
          { 
            totalLatency,
            redisToClientLatency,
            serverToClientLatency,
            type: data.type
          }
        );
      }
    });
    
    socket.on('pong', (data) => {
      const receivedTime = Date.now();
      const roundTripTime = receivedTime - data.clientSentTime;
      
      // Record metric
      if (recordMetricFn) {
        recordMetricFn(
          'realtime',
          'ping_pong',
          roundTripTime,
          true,
          undefined,
          { 
            clientSentTime: data.clientSentTime,
            serverTime: data.serverTime,
            clientReceivedTime: receivedTime
          }
        );
      }
      
      // Schedule another ping after a delay
      setTimeout(sendPing, 5000);
    });
  };
  
  // Send ping to measure basic latency
  const sendPing = () => {
    if (!socket || !socket.connected) return;
    
    socket.emit('ping', {
      timestamp: Date.now()
    });
  };
  
  // Subscribe to drone updates
  const subscribeToDrone = (droneId: string) => {
    if (!socket) {
      logger.error('Cannot subscribe to drone, socket not connected');
      return false;
    }
    
    if (!socket.connected) {
      logger.warn(`Socket not connected, adding ${droneId} to pending subscriptions`);
      droneSubscriptions.add(droneId);
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
        'subscribe_drone_request',
        0, // We'll get the actual latency in the subscription_status callback
        true,
        droneId,
        { subscriptionTime: startTime }
      );
    }
    
    return true;
  };
  
  // Unsubscribe from drone updates
  const unsubscribeFromDrone = (droneId: string) => {
    if (!socket || !socket.connected) {
      logger.error('Cannot unsubscribe from drone, socket not connected');
      droneSubscriptions.delete(droneId); // Remove from tracking anyway
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
    isConnected = false;
  };
  
  // Get current latency metrics
  const getLatencyMetrics = () => {
    return calculateLatencyMetrics();
  };
  
  // Check connection status
  const isSocketConnected = () => {
    return isConnected;
  };
  
  return {
    connect,
    subscribeToDrone,
    unsubscribeFromDrone,
    disconnect,
    getLatencyMetrics,
    isSocketConnected
  };
};

export { createRealtimeClient };
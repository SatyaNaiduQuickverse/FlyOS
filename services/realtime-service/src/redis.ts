// services/realtime-service/src/redis.ts - UPDATED WITH CAMERA STREAMING
import Redis from 'ioredis';
import { logger } from './utils/logger';

// Create Redis clients with proper typing
let redisClient: Redis;
let redisPubSub: Redis;

// Initialize Redis connections
const initRedis = async () => {
  try {
    // Create Redis clients with proper options handling
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not set');
    }
    
    redisClient = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 5
    });
    
    redisPubSub = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 5
    });
    
    // Test Redis connection
    await redisClient.ping();
    logger.info('Redis client connected');
    
    await redisPubSub.ping();
    logger.info('Redis PubSub client connected');
    
    return { redisClient, redisPubSub };
  } catch (error) {
    logger.error('Redis connection failed:', error);
    throw error;
  }
};

// Get drone state from Redis
const getDroneState = async (droneId: string) => {
  try {
    const data = await redisClient.get(`drone:${droneId}:state`);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error(`Failed to get drone state for ${droneId}:`, error);
    return null;
  }
};

// Subscribe to drone updates
const subscribeToDroneUpdates = (droneId: string, callback: (data: any) => void) => {
  const channel = `drone:${droneId}:updates`;
  
  // Subscribe to channel
  redisPubSub.subscribe(channel);
  
  // Set up message handler
  const messageHandler = (subscribedChannel: string, message: string) => {
    if (subscribedChannel === channel) {
      try {
        const data = JSON.parse(message);
        
        // Add Socket.IO server timestamp for latency tracking
        const timestamp = Date.now();
        const enhancedData = {
          ...data,
          _meta: {
            ...(data._meta || {}),
            socketServerTimestamp: timestamp
          }
        };
        
        // Log timestamp data for debugging
        logger.debug(`Redis message for ${droneId}: originalTimestamp=${data.timestamp}, redisTimestamp=${data._meta?.redisTimestamp}, socketServerTimestamp=${timestamp}`);
        
        callback(enhancedData);
      } catch (error) {
        logger.error(`Error parsing message from ${channel}:`, error);
      }
    }
  };
  
  redisPubSub.on('message', messageHandler);
  
  // Return unsubscribe function
  return () => {
    redisPubSub.unsubscribe(channel);
    redisPubSub.off('message', messageHandler);
    logger.debug(`Unsubscribed from ${channel}`);
  };
};

// ADD: Subscribe to camera stream updates
const subscribeToCameraStream = (droneId: string, camera: string, callback: (data: any) => void) => {
  const streamChannel = `camera:${droneId}:${camera}:stream`;
  const controlChannel = `camera:${droneId}:${camera}:control`;
  
  // Subscribe to both stream and control channels
  redisPubSub.subscribe(streamChannel);
  redisPubSub.subscribe(controlChannel);
  
  const messageHandler = (channel: string, message: string) => {
    if (channel === streamChannel || channel === controlChannel) {
      try {
        const data = JSON.parse(message);
        
        // Add realtime service timestamp
        const enhancedData = {
          ...data,
          _meta: {
            ...(data._meta || {}),
            realtimeServiceTimestamp: Date.now()
          }
        };
        
        callback(enhancedData);
        logger.debug(`Camera message received from ${channel}`);
      } catch (error) {
        logger.error(`Error parsing camera message from ${channel}:`, error);
      }
    }
  };
  
  redisPubSub.on('message', messageHandler);
  
  // Return unsubscribe function
  return () => {
    redisPubSub.unsubscribe(streamChannel);
    redisPubSub.unsubscribe(controlChannel);
    redisPubSub.off('message', messageHandler);
    logger.debug(`Unsubscribed from camera ${droneId}:${camera}`);
  };
};

// ADD: Get latest camera frame
const getLatestCameraFrame = async (droneId: string, camera: string) => {
  try {
    const data = await redisClient.get(`camera:${droneId}:${camera}:latest`);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error(`Failed to get camera frame for ${droneId}:${camera}:`, error);
    return null;
  }
};

// ADD: Get camera status
const getCameraStatus = async (droneId: string, camera: string) => {
  try {
    const data = await redisClient.get(`camera:${droneId}:${camera}:status`);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error(`Failed to get camera status for ${droneId}:${camera}:`, error);
    return null;
  }
};

export { 
  initRedis, 
  redisClient, 
  redisPubSub, 
  getDroneState, 
  subscribeToDroneUpdates,
  subscribeToCameraStream,
  getLatestCameraFrame,
  getCameraStatus
};
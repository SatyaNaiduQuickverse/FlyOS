// services/realtime-service/src/redis.ts
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

export { initRedis, redisClient, redisPubSub, getDroneState, subscribeToDroneUpdates };
// services/realtime-service/src/redis.ts - FIXED VERSION
import Redis from 'ioredis';
import { logger } from './utils/logger';

let redisClient: Redis;
let redisPubSub: Redis;

const initRedis = async () => {
  try {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not set');
    }
    
    const redisConfig = {
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      connectTimeout: 10000,
      lazyConnect: true, // FIXED: Enable lazy connect
      family: 4,
      keepAlive: 30000,
      enableReadyCheck: true,
      retryDelayOnFailover: 100,
      enableOfflineQueue: true, // FIXED: Enable offline queue
      stringNumbers: false,
      dropBufferSupport: false
    };
    
    redisClient = new Redis(redisUrl, {
      ...redisConfig,
      keyPrefix: 'realtime:',
      db: 0
    });
    
    redisPubSub = new Redis(redisUrl, {
      ...redisConfig,
      keyPrefix: 'realtime:pubsub:',
      db: 0
    });
    
    // Wait for connection with timeout
    await Promise.race([
      redisClient.ping(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Redis connection timeout')), 10000)
      )
    ]);
    
    await Promise.race([
      redisPubSub.ping(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Redis PubSub connection timeout')), 10000)
      )
    ]);
    
    logger.info('Redis clients connected successfully');
    
    return { redisClient, redisPubSub };
  } catch (error) {
    logger.error('Redis connection failed:', error);
    throw error;
  }
};

// Add connection error handlers
const setupRedisErrorHandlers = () => {
  if (redisClient) {
    redisClient.on('error', (error) => {
      logger.error('Redis client error:', error);
    });
    
    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });
    
    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });
    
    redisClient.on('close', () => {
      logger.warn('Redis client connection closed');
    });
  }
  
  if (redisPubSub) {
    redisPubSub.on('error', (error) => {
      logger.error('Redis PubSub error:', error);
    });
  }
};

const getDroneState = async (droneId: string) => {
  try {
    if (!redisClient) {
      logger.warn('Redis client not available');
      return null;
    }
    const data = await redisClient.get(`drone:${droneId}:state`);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error(`Failed to get drone state for ${droneId}:`, error);
    return null;
  }
};

const subscribeToDroneUpdates = (droneId: string, callback: (data: any) => void) => {
  if (!redisPubSub) {
    logger.warn('Redis PubSub not available for subscription');
    return () => {}; // Return empty unsubscribe function
  }

  const channel = `drone:${droneId}:updates`;
  
  redisPubSub.subscribe(channel);
  
  const messageHandler = (subscribedChannel: string, message: string) => {
    if (subscribedChannel === channel) {
      try {
        const data = JSON.parse(message);
        callback(data);
      } catch (error) {
        logger.error(`Error parsing message from ${channel}:`, error);
      }
    }
  };
  
  redisPubSub.on('message', messageHandler);
  
  return () => {
    redisPubSub.unsubscribe(channel);
    redisPubSub.off('message', messageHandler);
    logger.debug(`Unsubscribed from ${channel}`);
  };
};

export { 
  initRedis, 
  redisClient, 
  redisPubSub, 
  getDroneState, 
  subscribeToDroneUpdates,
  setupRedisErrorHandlers
};

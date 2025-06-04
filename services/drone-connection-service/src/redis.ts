// services/drone-connection-service/src/redis.ts - PRODUCTION READY
import Redis from 'ioredis';
import { logger } from './utils/logger';

let redisClient: Redis;

export const initRedis = async () => {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    redisClient = new Redis(redisUrl, {
      retryStrategy: (times) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableOfflineQueue: false,
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        return err.message.includes(targetError);
      }
    });
    
    // Connect and test
    await redisClient.connect();
    await redisClient.ping();
    
    logger.info('✅ Redis connected for drone connection service');
    
    // Error handling
    redisClient.on('error', (err) => {
      logger.error('Redis error:', err);
    });
    
    redisClient.on('connect', () => {
      logger.info('Redis connected');
    });
    
    redisClient.on('ready', () => {
      logger.info('Redis ready');
    });
    
  } catch (error) {
    logger.error('❌ Redis connection failed:', error);
    throw error;
  }
};

export const storeDroneState = async (droneId: string, data: any) => {
  try {
    const key = `drone:${droneId}:state`;
    const value = JSON.stringify({
      ...data,
      _meta: {
        updatedAt: Date.now(),
        source: 'drone-connection-service'
      }
    });
    
    await redisClient.set(key, value, 'EX', 300); // 5 minute expiry
    
    // Publish for real-time updates
    await redisClient.publish(`drone:${droneId}:updates`, value);
    
    logger.debug(`📊 Stored drone state for ${droneId}`);
    
  } catch (error) {
    logger.error(`❌ Redis store failed for ${droneId}:`, error);
    throw error;
  }
};

export const getDroneState = async (droneId: string) => {
  try {
    const data = await redisClient.get(`drone:${droneId}:state`);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error(`❌ Failed to get drone state for ${droneId}:`, error);
    return null;
  }
};

export const updateDroneStatus = async (droneId: string, status: string) => {
  try {
    const key = `drone:${droneId}:status`;
    await redisClient.set(key, status, 'EX', 600); // 10 minute expiry
    
  } catch (error) {
    logger.error(`❌ Status update failed for ${droneId}:`, error);
  }
};

// Graceful shutdown
export const closeRedis = async () => {
  try {
    if (redisClient) {
      await redisClient.quit();
      logger.info('Redis connection closed');
    }
  } catch (error) {
    logger.error('Error closing Redis:', error);
  }
};
// services/drone-connection-service/src/redis.ts
import Redis from 'ioredis';
import { logger } from './utils/logger';

let redisClient: Redis;

export const initRedis = async () => {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    redisClient = new Redis(redisUrl, {
      retryStrategy: (times) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3
    });
    
    await redisClient.ping();
    logger.info('✅ Redis connected for drone connection service');
    
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
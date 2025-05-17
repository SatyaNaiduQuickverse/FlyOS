// services/drone-db-service/src/redis.ts
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

// Store drone telemetry in Redis (for real-time access)
const storeDroneState = async (droneId: string, telemetry: any) => {
  try {
    // Add processing timestamp to track latency
    const redisTimestamp = Date.now();
    const enhancedTelemetry = {
      ...telemetry,
      _meta: {
        redisTimestamp
      }
    };
    
    // Store with 5 minute expiry
    await redisClient.set(
      `drone:${droneId}:state`,
      JSON.stringify(enhancedTelemetry),
      'EX',
      300
    );
    
    // Publish update for subscribers
    await redisPubSub.publish(
      `drone:${droneId}:updates`,
      JSON.stringify(enhancedTelemetry)
    );
    
    return true;
  } catch (error) {
    logger.error(`Failed to store drone state for ${droneId}:`, error);
    return false;
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

export { initRedis, redisClient, redisPubSub, storeDroneState, getDroneState };
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
    
    redisClient = new Redis(redisUrl);
    redisPubSub = new Redis(redisUrl);
    
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
    // Store with 5 minute expiry
    await redisClient.set(
      `drone:${droneId}:state`,
      JSON.stringify(telemetry),
      'EX',
      300
    );
    
    // Publish update for subscribers
    await redisPubSub.publish(
      `drone:${droneId}:updates`,
      JSON.stringify(telemetry)
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

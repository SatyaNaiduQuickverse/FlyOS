import Redis from 'ioredis';
import { logger } from '../utils/logger';

export const createRedisClient = (recordMetricFn?: Function) => {
  const latencyBuffer: number[] = []; 
  let redisClient: Redis | null = null;
  let redisSub: Redis | null = null;
  let isConnected = false;
  
  const calculateLatencyMetrics = () => {
    if (latencyBuffer.length === 0) return { avg: 0, p95: 0 };
    
    const avg = latencyBuffer.reduce((sum, val) => sum + val, 0) / latencyBuffer.length;
    
    const sorted = [...latencyBuffer].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p95 = sorted[p95Index];
    
    return { avg, p95 };
  };
  
  const connect = async () => {
    try {
      redisClient = new Redis('redis://localhost:6379');
      
      // Test connection
      await redisClient.ping();
      // Use debug level instead of warn
      logger.debug('Connected to Redis directly');
      isConnected = true;
      
      // Subscribe to drone updates
      redisSub = redisClient.duplicate();
      await redisSub.psubscribe('drone:*:updates');
      logger.debug('Subscribed to drone update channels');
      
      redisSub.on('pmessage', (pattern, channel, message) => {
        try {
          const droneId = channel.split(':')[1];
          const data = JSON.parse(message);
          
          const clientReceivedTimestamp = Date.now();
          const dataTimestamp = data.timestamp ? new Date(data.timestamp).getTime() : clientReceivedTimestamp;
          const redisTimestamp = data._meta?.redisTimestamp || dataTimestamp;
          
          const latency = clientReceivedTimestamp - redisTimestamp;
          
          if (latency > 0) {
            latencyBuffer.push(latency);
            if (latencyBuffer.length > 100) {
              latencyBuffer.shift();
            }
          }
          
          // Don't log anything in the terminal - complete silence
          // We'll only log to addEvent for important messages
          
          if (recordMetricFn) {
            recordMetricFn(
              'realtime',
              'drone_state_update',
              latency,
              true,
              droneId,
              { latency }
            );
          }
        } catch (error) {
          // Use error level so it only shows for actual errors
          logger.error('Error processing Redis message:', error);
        }
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      isConnected = false;
      return false;
    }
  };
  
  const disconnect = () => {
    if (redisSub) {
      redisSub.punsubscribe();
      redisSub.quit();
    }
    
    if (redisClient) {
      redisClient.quit();
    }
    
    isConnected = false;
  };
  
  const getLatencyMetrics = () => {
    // Just return the metrics without logging anything
    return calculateLatencyMetrics();
  };
  
  return {
    connect,
    disconnect,
    getLatencyMetrics,
    isConnected: () => isConnected
  };
};

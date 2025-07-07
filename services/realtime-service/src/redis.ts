// services/realtime-service/src/redis.ts - FIXED TYPESCRIPT ERRORS
import Redis from 'ioredis';
import { logger } from './utils/logger';

// Create Redis clients with binary-optimized configuration
let redisClient: Redis;
let redisPubSub: Redis;

// Initialize Redis connections with optimizations for binary data
const initRedis = async () => {
  try {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not set');
    }
    
    // FIXED: Corrected Redis configuration without duplicate properties
    const redisConfig = {
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3, // FIXED: Removed duplicate
      connectTimeout: 10000,
      lazyConnect: false,
      // Optimize for binary data
      family: 4,
      keepAlive: 30000, // FIXED: Changed from boolean to number (30 seconds)
      enableReadyCheck: true,
      retryDelayOnFailover: 100,
      enableOfflineQueue: false,
      // Binary data optimization
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
    
    // Test Redis connection
    await redisClient.ping();
    logger.info('Optimized Redis client connected for binary frame support');
    
    await redisPubSub.ping();
    logger.info('Optimized Redis PubSub client connected for binary streaming');
    
    // Configure Redis for optimal binary performance
    await configureRedisForBinaryFrames();
    
    return { redisClient, redisPubSub };
  } catch (error) {
    logger.error('Optimized Redis connection failed:', error);
    throw error;
  }
};

// Configure Redis settings for optimal binary frame performance
const configureRedisForBinaryFrames = async () => {
  try {
    // Set memory policy for frame data
    await redisClient.config('SET', 'maxmemory-policy', 'allkeys-lru');
    
    // Configure for better performance with binary data
    await redisClient.config('SET', 'tcp-keepalive', '60');
    await redisClient.config('SET', 'timeout', '300');
    
    logger.info('Redis configured for optimal binary frame performance');
  } catch (error) {
    logger.warn('Could not configure Redis optimization settings:', error);
  }
};

// Get drone state from Redis with binary frame metadata
const getDroneState = async (droneId: string) => {
  try {
    const data = await redisClient.get(`drone:${droneId}:state`);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error(`Failed to get drone state for ${droneId}:`, error);
    return null;
  }
};

// Subscribe to drone updates with binary frame support
const subscribeToDroneUpdates = (droneId: string, callback: (data: any) => void) => {
  const channel = `drone:${droneId}:updates`;
  
  // Subscribe to channel
  redisPubSub.subscribe(channel);
  
  // Set up message handler with binary frame optimization
  const messageHandler = (subscribedChannel: string, message: string) => {
    if (subscribedChannel === channel) {
      try {
        const data = JSON.parse(message);
        
        // Add optimized realtime service timestamp
        const timestamp = Date.now();
        const enhancedData = {
          ...data,
          _meta: {
            ...(data._meta || {}),
            optimizedRealtimeTimestamp: timestamp,
            binaryFrameSupport: true
          }
        };
        
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
    logger.debug(`Unsubscribed from optimized ${channel}`);
  };
};

// OPTIMIZED: Subscribe to binary camera stream
const subscribeToBinaryCameraStream = (
  droneId: string, 
  camera: string, 
  callback: (data: any) => void,
  options: {
    transport?: 'binary' | 'json';
    quality?: 'high' | 'medium' | 'low';
    compression?: boolean;
  } = {}
) => {
  const binaryStreamChannel = `camera:${droneId}:${camera}:binary_stream`;
  const controlChannel = `camera:${droneId}:${camera}:control`;
  
  // Subscribe to both binary stream and control channels
  redisPubSub.subscribe(binaryStreamChannel);
  redisPubSub.subscribe(controlChannel);
  
  const messageHandler = (channel: string, message: string) => {
    try {
      const data = JSON.parse(message);
      
      // Filter based on transport preference
      if (channel === binaryStreamChannel && data.action === 'binary_frame') {
        if (options.transport === 'json') {
          // Convert binary to JSON format for compatibility
          const convertedData = convertBinaryToJsonFrame(data.frameData);
          callback({
            ...data,
            frameData: convertedData,
            _meta: {
              originalTransport: 'binary',
              convertedTo: 'json',
              timestamp: Date.now()
            }
          });
        } else {
          // Send binary frame as-is
          callback({
            ...data,
            _meta: {
              transport: 'binary',
              compression: options.compression,
              timestamp: Date.now()
            }
          });
        }
      } else if (channel === controlChannel) {
        // Send control messages
        callback({
          ...data,
          _meta: {
            type: 'control',
            timestamp: Date.now()
          }
        });
      }
      
      logger.debug(`Binary camera message processed from ${channel}`);
    } catch (error) {
      logger.error(`Error parsing binary camera message from ${channel}:`, error);
    }
  };
  
  redisPubSub.on('message', messageHandler);
  
  // Return unsubscribe function
  return () => {
    redisPubSub.unsubscribe(binaryStreamChannel);
    redisPubSub.unsubscribe(controlChannel);
    redisPubSub.off('message', messageHandler);
    logger.debug(`Unsubscribed from binary camera ${droneId}:${camera}`);
  };
};

// Convert binary frame to JSON format for compatibility
const convertBinaryToJsonFrame = (binaryFrameData: any) => {
  try {
    return {
      droneId: binaryFrameData.droneId,
      camera: binaryFrameData.camera,
      timestamp: binaryFrameData.timestamp,
      frame: binaryFrameData.compressedData, // Already base64
      metadata: {
        ...binaryFrameData.metadata,
        originalSize: binaryFrameData.originalSize,
        compressedSize: binaryFrameData.compressedSize,
        compressionRatio: binaryFrameData.originalSize / binaryFrameData.compressedSize,
        transport: 'json_converted_from_binary'
      }
    };
  } catch (error) {
    logger.error('Error converting binary frame to JSON:', error);
    return null;
  }
};

// OPTIMIZED: Get latest binary camera frame with decompression support
const getLatestBinaryCameraFrame = async (
  droneId: string, 
  camera: string,
  options: {
    decompress?: boolean;
    format?: 'binary' | 'json';
  } = {}
) => {
  try {
    const data = await redisClient.get(`camera:${droneId}:${camera}:latest_binary`);
    if (!data) return null;
    
    const frameData = JSON.parse(data);
    
    if (options.format === 'json') {
      return convertBinaryToJsonFrame(frameData);
    }
    
    // Return binary frame data with optional decompression
    if (options.decompress && frameData.compressedData) {
      try {
        const zlib = require('zlib');
        const compressedBuffer = Buffer.from(frameData.compressedData, 'base64');
        const decompressedBuffer = zlib.gunzipSync(compressedBuffer);
        
        return {
          ...frameData,
          decompressedData: decompressedBuffer.toString('base64'),
          decompressed: true,
          decompressionTime: Date.now()
        };
      } catch (decompressionError) {
        logger.error(`Decompression failed for ${droneId}:${camera}:`, decompressionError);
        return frameData; // Return compressed version
      }
    }
    
    return frameData;
  } catch (error) {
    logger.error(`Failed to get binary camera frame for ${droneId}:${camera}:`, error);
    return null;
  }
};

// OPTIMIZED: Get binary camera status with performance metrics
const getBinaryCameraStatus = async (droneId: string, camera: string) => {
  try {
    const [statusData, metricsData, queueData] = await Promise.all([
      redisClient.get(`camera:${droneId}:${camera}:status`),
      redisClient.get(`camera:${droneId}:${camera}:metrics`),
      redisClient.get(`camera:${droneId}:${camera}:queue_status`)
    ]);
    
    const status = statusData ? JSON.parse(statusData) : null;
    const metrics = metricsData ? JSON.parse(metricsData) : null;
    const queueStatus = queueData ? JSON.parse(queueData) : null;
    
    return {
      status,
      metrics,
      queueStatus,
      binarySupport: true,
      optimizations: {
        compression: status?.config?.optimization?.compression || false,
        frameSkipping: status?.config?.optimization?.frameSkipping || false,
        maxQueueSize: status?.config?.optimization?.maxQueueSize || 3
      }
    };
  } catch (error) {
    logger.error(`Failed to get binary camera status for ${droneId}:${camera}:`, error);
    return null;
  }
};

// OPTIMIZED: Store binary camera metrics for performance monitoring
const storeBinaryCameraMetrics = async (
  droneId: string,
  camera: string,
  metrics: {
    framesSent: number;
    framesSkipped: number;
    bytesTransferred: number;
    compressionRatio: number;
    avgLatency: number;
    queueSize: number;
  }
) => {
  try {
    const metricsKey = `camera:${droneId}:${camera}:metrics`;
    const metricsData = {
      ...metrics,
      timestamp: Date.now(),
      transport: 'binary',
      optimized: true
    };
    
    await redisClient.setex(metricsKey, 300, JSON.stringify(metricsData)); // 5 minute expiry
    
    // Also store in time-series for trend analysis
    const timeSeriesKey = `camera:${droneId}:${camera}:metrics_history`;
    await redisClient.lpush(timeSeriesKey, JSON.stringify(metricsData));
    await redisClient.ltrim(timeSeriesKey, 0, 99); // Keep last 100 entries
    await redisClient.expire(timeSeriesKey, 3600); // 1 hour expiry
    
    logger.debug(`Binary camera metrics stored for ${droneId}:${camera}`);
  } catch (error) {
    logger.error(`Failed to store binary camera metrics for ${droneId}:${camera}:`, error);
  }
};

// OPTIMIZED: Get camera performance analytics
const getBinaryCameraAnalytics = async (droneId: string, camera?: string) => {
  try {
    const pattern = camera ? 
      `camera:${droneId}:${camera}:metrics_history` : 
      `camera:${droneId}:*:metrics_history`;
    
    const keys = await redisClient.keys(pattern);
    const analytics: any = {};
    
    for (const key of keys) {
      const keyParts = key.split(':');
      const cameraName = keyParts[2];
      
      const metricsHistory = await redisClient.lrange(key, 0, -1);
      const parsedMetrics = metricsHistory.map(m => JSON.parse(m));
      
      if (parsedMetrics.length > 0) {
        // Calculate averages and trends
        const avgCompressionRatio = parsedMetrics.reduce((sum, m) => sum + m.compressionRatio, 0) / parsedMetrics.length;
        const avgLatency = parsedMetrics.reduce((sum, m) => sum + m.avgLatency, 0) / parsedMetrics.length;
        const totalFramesSent = parsedMetrics.reduce((sum, m) => sum + m.framesSent, 0);
        const totalFramesSkipped = parsedMetrics.reduce((sum, m) => sum + m.framesSkipped, 0);
        const skipRate = totalFramesSent > 0 ? (totalFramesSkipped / totalFramesSent * 100) : 0;
        
        analytics[cameraName] = {
          avgCompressionRatio: parseFloat(avgCompressionRatio.toFixed(2)),
          avgLatency: parseFloat(avgLatency.toFixed(2)),
          totalFramesSent,
          totalFramesSkipped,
          skipRate: parseFloat(skipRate.toFixed(2)),
          dataPoints: parsedMetrics.length,
          timeSpan: parsedMetrics.length > 1 ? 
            parsedMetrics[0].timestamp - parsedMetrics[parsedMetrics.length - 1].timestamp : 0
        };
      }
    }
    
    return analytics;
  } catch (error) {
    logger.error(`Failed to get binary camera analytics for ${droneId}:`, error);
    return {};
  }
};

// OPTIMIZED: Cleanup stale binary camera data
const cleanupStaleBinaryCameraData = async () => {
  try {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    
    // Find all camera status keys
    const statusKeys = await redisClient.keys('camera:*:*:status');
    
    for (const statusKey of statusKeys) {
      const statusData = await redisClient.get(statusKey);
      if (statusData) {
        const status = JSON.parse(statusData);
        const lastUpdate = new Date(status.startedAt || status.updatedAt || 0).getTime();
        
        if (now - lastUpdate > staleThreshold) {
          // Clean up stale camera data
          const keyParts = statusKey.split(':');
          const droneId = keyParts[1];
          const camera = keyParts[2];
          
          await Promise.all([
            redisClient.del(`camera:${droneId}:${camera}:latest_binary`),
            redisClient.del(`camera:${droneId}:${camera}:metrics`),
            redisClient.del(`camera:${droneId}:${camera}:queue_status`),
            redisClient.del(statusKey)
          ]);
          
          logger.info(`Cleaned up stale binary camera data: ${droneId}:${camera}`);
        }
      }
    }
  } catch (error) {
    logger.error('Error during binary camera data cleanup:', error);
  }
};

// OPTIMIZED: Publish binary frame with compression info
const publishBinaryFrame = async (
  droneId: string,
  camera: string,
  frameData: any,
  compressionMetrics: {
    originalSize: number;
    compressedSize: number;
    compressionTime: number;
  }
) => {
  try {
    const channel = `camera:${droneId}:${camera}:binary_stream`;
    const message = {
      action: 'binary_frame',
      droneId,
      camera,
      frameData: {
        ...frameData,
        ...compressionMetrics,
        publishedAt: Date.now()
      },
      timestamp: Date.now()
    };
    
    await redisPubSub.publish(channel, JSON.stringify(message));
    
    // Update metrics
    await storeBinaryCameraMetrics(droneId, camera, {
      framesSent: 1,
      framesSkipped: 0,
      bytesTransferred: compressionMetrics.compressedSize,
      compressionRatio: compressionMetrics.originalSize / compressionMetrics.compressedSize,
      avgLatency: compressionMetrics.compressionTime,
      queueSize: 0
    });
    
    logger.debug(`Binary frame published: ${droneId}:${camera} ` +
      `(${compressionMetrics.originalSize}→${compressionMetrics.compressedSize} bytes)`);
  } catch (error) {
    logger.error(`Failed to publish binary frame for ${droneId}:${camera}:`, error);
  }
};

// COMPATIBILITY: Legacy camera stream subscription (maps to binary)
const subscribeToCameraStream = (droneId: string, camera: string, callback: (data: any) => void) => {
  logger.info(`Legacy camera subscription converted to binary: ${droneId}:${camera}`);
  
  return subscribeToBinaryCameraStream(droneId, camera, callback, {
    transport: 'json', // Legacy compatibility
    quality: 'medium',
    compression: true
  });
};

// COMPATIBILITY: Legacy get latest camera frame
const getLatestCameraFrame = async (droneId: string, camera: string) => {
  return await getLatestBinaryCameraFrame(droneId, camera, {
    decompress: false,
    format: 'json' // Legacy compatibility
  });
};

// COMPATIBILITY: Legacy get camera status
const getCameraStatus = async (droneId: string, camera: string) => {
  const binaryStatus = await getBinaryCameraStatus(droneId, camera);
  
  if (!binaryStatus || !binaryStatus.status) {
    return null;
  }
  
  // Convert to legacy format
  return {
    ...binaryStatus.status,
    binaryOptimizations: binaryStatus.optimizations,
    performanceMetrics: binaryStatus.metrics
  };
};

// Start cleanup interval for binary camera data
setInterval(cleanupStaleBinaryCameraData, 2 * 60 * 1000); // Every 2 minutes

export { 
  initRedis, 
  redisClient, 
  redisPubSub, 
  getDroneState, 
  subscribeToDroneUpdates,
  
  // OPTIMIZED: Binary camera functions
  subscribeToBinaryCameraStream,
  getLatestBinaryCameraFrame,
  getBinaryCameraStatus,
  storeBinaryCameraMetrics,
  getBinaryCameraAnalytics,
  publishBinaryFrame,
  
  // COMPATIBILITY: Legacy functions (mapped to binary)
  subscribeToCameraStream,
  getLatestCameraFrame,
  getCameraStatus
};
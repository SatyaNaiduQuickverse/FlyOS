// services/realtime-service/src/websocket.ts - OPTIMIZED WITH BINARY FRAME SUPPORT
import { Server, Socket } from 'socket.io';
import { ExtendedError } from 'socket.io/dist/namespace';
import { subscribeToDroneUpdates, getDroneState, redisClient, redisPubSub } from './redis';
import { logger } from './utils/logger';
import { verifySupabaseToken } from './utils/supabase-auth';
import * as zlib from 'zlib';
import { promisify } from 'util';

// Promisify decompression
const gunzipAsync = promisify(zlib.gunzip);

// Define interface for authenticated socket with frame optimization
interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    role: string;
    username?: string;
  };
  droneSubscriptions: Map<string, () => void>;
  cameraSubscriptions: Map<string, CameraSubscription>;
  frameOptimization: FrameOptimizationSettings;
}

interface CameraSubscription {
  droneId: string;
  camera: string;
  transport: 'binary' | 'json';
  quality: 'high' | 'medium' | 'low';
  maxFPS: number;
  lastFrameTime: number;
  frameCount: number;
  skipCount: number;
  unsubscribe: () => void;
}

interface FrameOptimizationSettings {
  enableBinaryFrames: boolean;
  enableDecompression: boolean;
  maxFrameRate: number;
  adaptiveQuality: boolean;
  bufferSize: number;
}

interface BinaryFrameData {
  droneId: string;
  camera: string;
  timestamp: number;
  frameNumber: number;
  compressedData: string; // base64 encoded buffer
  originalSize: number;
  compressedSize: number;
  metadata: any;
}

export const setupWebSocketServer = (io: Server) => {
  // Configure CORS properly
  io.engine.on('initial_headers', (headers: any, req: any) => {
    headers['Access-Control-Allow-Origin'] = process.env.CORS_ORIGIN || '*';
    headers['Access-Control-Allow-Credentials'] = 'true';
  });

  // Enhanced authentication middleware
  io.use(async (socket: Socket, next: (err?: ExtendedError) => void) => {
    try {
      logger.info(`New optimized WebSocket connection from ${socket.handshake.address}`);
      
      // Extract token with multiple fallback methods
      let token = null;
      
      if (socket.handshake.auth?.token) {
        token = socket.handshake.auth.token;
        logger.debug('Token found in handshake.auth.token');
      }
      else if (socket.handshake.query?.token) {
        token = Array.isArray(socket.handshake.query.token) 
          ? socket.handshake.query.token[0] 
          : socket.handshake.query.token;
        logger.debug('Token found in handshake.query.token');
      }
      else if (socket.handshake.headers?.authorization) {
        const authHeader = socket.handshake.headers.authorization;
        if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7);
          logger.debug('Token found in authorization header');
        }
      }
      
      if (!token) {
        logger.warn('WebSocket authentication failed: No token provided');
        return next(new Error('Authentication required - No token provided'));
      }
      
      logger.debug('Verifying optimized WebSocket token...');
      
      const user = await verifySupabaseToken(token);
      
      if (!user) {
        logger.warn('WebSocket authentication failed: Invalid or expired token');
        return next(new Error('Invalid or expired token'));
      }
      
      // Set user data and initialize optimized subscriptions
      (socket as AuthenticatedSocket).user = user;
      (socket as AuthenticatedSocket).droneSubscriptions = new Map();
      (socket as AuthenticatedSocket).cameraSubscriptions = new Map();
      (socket as AuthenticatedSocket).frameOptimization = {
        enableBinaryFrames: true,
        enableDecompression: true,
        maxFrameRate: 30,
        adaptiveQuality: true,
        bufferSize: 2
      };
      
      logger.info(`Optimized WebSocket client authenticated: ${user?.username || user?.id} (${user?.role})`);
      next();
    } catch (error: any) {
      logger.error('Socket authentication error:', error.message);
      next(new Error(`Authentication failed: ${error.message}`));
    }
  });
  
  // Handle connections
  io.on('connection', (socket: Socket) => {
    const authenticatedSocket = socket as AuthenticatedSocket;
    const user = authenticatedSocket.user;
    
    logger.info(`Optimized WebSocket client connected: ${authenticatedSocket.id}, user: ${user?.username || user?.id}`);
    
    // Send immediate connection confirmation with optimization capabilities
    authenticatedSocket.emit('connection_status', {
      status: 'connected',
      userId: user?.id,
      timestamp: Date.now(),
      message: 'Optimized WebSocket connection established',
      optimizations: {
        binaryFrames: authenticatedSocket.frameOptimization.enableBinaryFrames,
        decompression: authenticatedSocket.frameOptimization.enableDecompression,
        adaptiveQuality: authenticatedSocket.frameOptimization.adaptiveQuality,
        maxFrameRate: authenticatedSocket.frameOptimization.maxFrameRate
      }
    });

    // Enhanced drone subscription with optimization settings
    authenticatedSocket.on('subscribe_drone', async (data: any) => {
      try {
        const droneId = typeof data === 'object' ? data.droneId : String(data || '').trim();
        const optimizations = typeof data === 'object' ? data.optimizations : {};
        
        if (!droneId) {
          logger.warn(`Invalid drone ID received from ${authenticatedSocket.id}`);
          authenticatedSocket.emit('error', { 
            message: 'Invalid drone ID provided',
            code: 'INVALID_DRONE_ID',
            timestamp: Date.now()
          });
          return;
        }
        
        // Update frame optimization settings if provided
        if (optimizations) {
          authenticatedSocket.frameOptimization = {
            ...authenticatedSocket.frameOptimization,
            ...optimizations
          };
        }
        
        // Check if already subscribed
        if (authenticatedSocket.droneSubscriptions.has(droneId)) {
          logger.debug(`Client ${authenticatedSocket.id} already subscribed to ${droneId}`);
          authenticatedSocket.emit('subscription_status', { 
            droneId, 
            status: 'already_subscribed',
            timestamp: Date.now()
          });
          return;
        }
        
        logger.info(`Client ${authenticatedSocket.id} subscribing to optimized drone ${droneId}`);
        
        // Get and send initial state
        try {
          const currentState = await getDroneState(droneId);
          
          if (currentState) {
            const timestamp = Date.now();
            const enhancedState = {
              ...currentState,
              _meta: {
                ...(currentState._meta || {}),
                optimizedSocketTimestamp: timestamp,
                frameOptimization: authenticatedSocket.frameOptimization
              }
            };
            
            authenticatedSocket.emit('drone_state', { 
              droneId, 
              data: enhancedState,
              type: 'initial',
              timestamp: timestamp
            });
            
            logger.debug(`Sent optimized initial state for drone ${droneId}`);
          } else {
            authenticatedSocket.emit('drone_state', { 
              droneId, 
              data: { id: droneId, connected: false },
              type: 'initial',
              timestamp: Date.now()
            });
          }
        } catch (stateError: any) {
          logger.warn(`Could not get initial state for drone ${droneId}: ${stateError.message}`);
          authenticatedSocket.emit('drone_state', { 
            droneId, 
            data: { id: droneId, connected: false, error: 'State unavailable' },
            type: 'initial',
            timestamp: Date.now()
          });
        }
        
        // Subscribe to real-time updates
        const unsubscribe = subscribeToDroneUpdates(droneId, (data) => {
          try {
            const timestamp = Date.now();
            authenticatedSocket.emit('drone_state', { 
              droneId, 
              data: {
                ...data,
                _meta: {
                  ...(data._meta || {}),
                  optimizedSocketTimestamp: timestamp
                }
              },
              type: 'update',
              timestamp: timestamp
            });
            
            logger.debug(`Sent optimized real-time update for drone ${droneId}`);
          } catch (emitError: any) {
            logger.error(`Error emitting optimized drone state for ${droneId}: ${emitError.message}`);
          }
        });
        
        authenticatedSocket.droneSubscriptions.set(droneId, unsubscribe);
        
        authenticatedSocket.emit('subscription_status', { 
          droneId, 
          status: 'subscribed',
          timestamp: Date.now(),
          optimizations: authenticatedSocket.frameOptimization
        });
        
        logger.info(`Client ${authenticatedSocket.id} successfully subscribed to optimized drone ${droneId}`);
        
      } catch (error: any) {
        logger.error(`Error subscribing to optimized drone: ${error.message}`);
        authenticatedSocket.emit('error', { 
          message: 'Failed to subscribe to drone updates',
          error: error.message,
          code: 'SUBSCRIPTION_FAILED',
          timestamp: Date.now()
        });
      }
    });

    // OPTIMIZED: Binary camera stream subscription
    authenticatedSocket.on('subscribe_camera_binary', async (data: {
      droneId: string;
      camera: string;
      transport?: 'binary' | 'json';
      quality?: 'high' | 'medium' | 'low';
      maxFPS?: number;
    }) => {
      try {
        const { droneId, camera, transport = 'binary', quality = 'high', maxFPS = 30 } = data;
        const subscriptionKey = `${droneId}:${camera}:binary`;
        
        logger.info(`Binary camera subscription: ${droneId}:${camera} (${transport}, ${quality})`);
        
        // Check if already subscribed
        if (authenticatedSocket.cameraSubscriptions.has(subscriptionKey)) {
          logger.debug(`Already subscribed to binary camera: ${subscriptionKey}`);
          return;
        }
        
        // Subscribe to binary camera stream
        const binaryStreamChannel = `camera:${droneId}:${camera}:binary_stream`;
        
        const binaryFrameHandler = async (channel: string, message: string) => {
          if (channel === binaryStreamChannel) {
            try {
              const frameData: { action: string; frameData: BinaryFrameData } = JSON.parse(message);
              
              if (frameData.action === 'binary_frame') {
                await handleOptimizedBinaryFrame(authenticatedSocket, frameData.frameData, subscriptionKey);
              }
            } catch (parseError) {
              logger.error(`Error parsing binary frame message: ${parseError}`);
            }
          }
        };
        
        // Subscribe to Redis channel
        redisPubSub.subscribe(binaryStreamChannel);
        redisPubSub.on('message', binaryFrameHandler);
        
        // Create subscription record
        const subscription: CameraSubscription = {
          droneId,
          camera,
          transport,
          quality,
          maxFPS,
          lastFrameTime: 0,
          frameCount: 0,
          skipCount: 0,
          unsubscribe: () => {
            redisPubSub.unsubscribe(binaryStreamChannel);
            redisPubSub.off('message', binaryFrameHandler);
          }
        };
        
        authenticatedSocket.cameraSubscriptions.set(subscriptionKey, subscription);
        
        // Get latest binary frame if available
        try {
          const latestFrame = await redisClient.get(`camera:${droneId}:${camera}:latest_binary`);
          if (latestFrame) {
            const frameData: BinaryFrameData = JSON.parse(latestFrame);
            await handleOptimizedBinaryFrame(authenticatedSocket, frameData, subscriptionKey);
          }
        } catch (latestError) {
          logger.debug(`No latest binary frame available for ${droneId}:${camera}`);
        }
        
        authenticatedSocket.emit('camera_binary_subscription_status', { 
          droneId, 
          camera, 
          status: 'subscribed',
          transport,
          quality,
          timestamp: Date.now()
        });
        
        logger.info(`Client ${authenticatedSocket.id} subscribed to binary camera ${droneId}:${camera}`);
        
      } catch (error: any) {
        logger.error(`Binary camera subscription error: ${error.message}`);
        authenticatedSocket.emit('camera_binary_subscription_error', { 
          droneId: data.droneId, 
          camera: data.camera, 
          error: error.message,
          timestamp: Date.now()
        });
      }
    });

    // Handle binary camera unsubscribe
    authenticatedSocket.on('unsubscribe_camera_binary', (data: { droneId: string; camera: string }) => {
      try {
        const { droneId, camera } = data;
        const subscriptionKey = `${droneId}:${camera}:binary`;
        
        const subscription = authenticatedSocket.cameraSubscriptions.get(subscriptionKey);
        if (subscription) {
          subscription.unsubscribe();
          authenticatedSocket.cameraSubscriptions.delete(subscriptionKey);
          
          authenticatedSocket.emit('camera_binary_subscription_status', { 
            droneId, 
            camera, 
            status: 'unsubscribed',
            timestamp: Date.now()
          });
          
          logger.info(`Client ${authenticatedSocket.id} unsubscribed from binary camera ${droneId}:${camera}`);
        }
      } catch (error: any) {
        logger.error(`Binary camera unsubscribe error: ${error.message}`);
      }
    });

    // COMPATIBILITY: Legacy camera stream subscription
    authenticatedSocket.on('subscribe_camera_stream', async (data: { 
      droneId: string; 
      camera: string; 
      channels: string[] 
    }) => {
      try {
        const { droneId, camera, channels } = data;
        
        logger.info(`Legacy camera stream subscription: ${droneId}:${camera}`);
        
        // Convert to binary subscription
        await authenticatedSocket.emit('subscribe_camera_binary', {
          droneId,
          camera,
          transport: 'json', // Legacy mode
          quality: 'medium'
        });
        
        logger.info(`Converted legacy camera subscription to optimized: ${droneId}:${camera}`);
        
      } catch (error: any) {
        logger.error(`Legacy camera subscription error: ${error.message}`);
      }
    });

    // Update frame optimization settings
    authenticatedSocket.on('update_frame_optimization', (settings: Partial<FrameOptimizationSettings>) => {
      try {
        authenticatedSocket.frameOptimization = {
          ...authenticatedSocket.frameOptimization,
          ...settings
        };
        
        authenticatedSocket.emit('frame_optimization_updated', {
          settings: authenticatedSocket.frameOptimization,
          timestamp: Date.now()
        });
        
        logger.info(`Frame optimization settings updated for client ${authenticatedSocket.id}`);
      } catch (error: any) {
        logger.error(`Error updating frame optimization: ${error.message}`);
      }
    });

    // Get camera performance metrics
    authenticatedSocket.on('get_camera_metrics', (data: { droneId?: string; camera?: string }) => {
      try {
        const metrics: any = {};
        
        for (const [key, subscription] of authenticatedSocket.cameraSubscriptions.entries()) {
          if (!data.droneId || subscription.droneId === data.droneId) {
            if (!data.camera || subscription.camera === data.camera) {
              metrics[key] = {
                droneId: subscription.droneId,
                camera: subscription.camera,
                transport: subscription.transport,
                quality: subscription.quality,
                frameCount: subscription.frameCount,
                skipCount: subscription.skipCount,
                skipRate: subscription.frameCount > 0 ? 
                  (subscription.skipCount / subscription.frameCount * 100).toFixed(1) : 0,
                maxFPS: subscription.maxFPS,
                actualFPS: calculateActualFPS(subscription)
              };
            }
          }
        }
        
        authenticatedSocket.emit('camera_metrics', {
          metrics,
          frameOptimization: authenticatedSocket.frameOptimization,
          timestamp: Date.now()
        });
      } catch (error: any) {
        logger.error(`Error getting camera metrics: ${error.message}`);
      }
    });

    // Enhanced unsubscribe handler
    authenticatedSocket.on('unsubscribe_drone', (droneId: any) => {
      try {
        const droneIdStr = String(droneId || '').trim();
        
        if (!droneIdStr) {
          logger.warn(`Invalid drone ID for unsubscribe from ${authenticatedSocket.id}`);
          return;
        }
        
        const unsubscribe = authenticatedSocket.droneSubscriptions.get(droneIdStr);
        
        if (unsubscribe) {
          unsubscribe();
          authenticatedSocket.droneSubscriptions.delete(droneIdStr);
          
          authenticatedSocket.emit('subscription_status', { 
            droneId: droneIdStr, 
            status: 'unsubscribed',
            timestamp: Date.now()
          });
          
          logger.info(`Client ${authenticatedSocket.id} unsubscribed from optimized drone ${droneIdStr}`);
        }
      } catch (error: any) {
        logger.error(`Error unsubscribing from drone: ${error.message}`);
      }
    });

    // Enhanced ping/pong with optimization metrics
    authenticatedSocket.on('ping', (data: any) => {
      try {
        const serverTime = Date.now();
        const clientTime = data && typeof data === 'object' ? data.timestamp : serverTime;
        
        // Calculate camera metrics summary
        const cameraMetricsSummary = {
          totalSubscriptions: authenticatedSocket.cameraSubscriptions.size,
          binarySubscriptions: Array.from(authenticatedSocket.cameraSubscriptions.values())
            .filter(s => s.transport === 'binary').length,
          totalFrames: Array.from(authenticatedSocket.cameraSubscriptions.values())
            .reduce((sum, s) => sum + s.frameCount, 0),
          totalSkipped: Array.from(authenticatedSocket.cameraSubscriptions.values())
            .reduce((sum, s) => sum + s.skipCount, 0)
        };
        
        authenticatedSocket.emit('pong', {
          clientSentTime: clientTime,
          serverTime: serverTime,
          roundTripTime: serverTime - clientTime,
          optimizations: authenticatedSocket.frameOptimization,
          cameraMetrics: cameraMetricsSummary
        });
        
        logger.debug(`Handled optimized ping from client ${authenticatedSocket.id}`);
      } catch (error: any) {
        logger.error(`Error handling optimized ping: ${error.message}`);
      }
    });

    // Enhanced disconnect handler
    authenticatedSocket.on('disconnect', (reason: string) => {
      try {
        logger.info(`Optimized WebSocket client disconnecting: ${authenticatedSocket.id}, reason: ${reason}`);
        
        // Clean up drone subscriptions
        const droneSubscriptionCount = authenticatedSocket.droneSubscriptions.size;
        for (const [key, unsubscribe] of authenticatedSocket.droneSubscriptions.entries()) {
          try {
            unsubscribe();
            logger.debug(`Cleaned up drone subscription: ${key}`);
          } catch (cleanupError: any) {
            logger.error(`Error cleaning up drone subscription ${key}: ${cleanupError.message}`);
          }
        }
        authenticatedSocket.droneSubscriptions.clear();
        
        // Clean up camera subscriptions
        const cameraSubscriptionCount = authenticatedSocket.cameraSubscriptions.size;
        for (const [key, subscription] of authenticatedSocket.cameraSubscriptions.entries()) {
          try {
            subscription.unsubscribe();
            logger.debug(`Cleaned up camera subscription: ${key}`);
          } catch (cleanupError: any) {
            logger.error(`Error cleaning up camera subscription ${key}: ${cleanupError.message}`);
          }
        }
        authenticatedSocket.cameraSubscriptions.clear();
        
        logger.info(`Optimized WebSocket client disconnected: ${authenticatedSocket.id}, ` +
          `cleaned up ${droneSubscriptionCount} drone + ${cameraSubscriptionCount} camera subscriptions`);
      } catch (error: any) {
        logger.error(`Error handling optimized disconnect: ${error.message}`);
      }
    });
  });
  
  logger.info('Optimized WebSocket server configured with binary frame support and compression');
  return io;
};

// OPTIMIZATION: Handle binary frame with adaptive quality and frame skipping
async function handleOptimizedBinaryFrame(
  socket: AuthenticatedSocket, 
  frameData: BinaryFrameData, 
  subscriptionKey: string
): Promise<void> {
  try {
    const subscription = socket.cameraSubscriptions.get(subscriptionKey);
    if (!subscription) return;
    
    const now = Date.now();
    const frameInterval = 1000 / subscription.maxFPS;
    
    // OPTIMIZATION 1: Frame rate limiting
    if (now - subscription.lastFrameTime < frameInterval) {
      subscription.skipCount++;
      logger.debug(`Frame skipped for ${subscriptionKey} (rate limiting)`);
      return;
    }
    
    subscription.lastFrameTime = now;
    subscription.frameCount++;
    
    // OPTIMIZATION 2: Adaptive quality based on client settings
    if (socket.frameOptimization.adaptiveQuality) {
      // Adjust quality based on connection performance
      const skipRate = subscription.skipCount / subscription.frameCount;
      if (skipRate > 0.1 && subscription.quality === 'high') {
        subscription.quality = 'medium';
        logger.debug(`Adaptive quality reduction for ${subscriptionKey}`);
      } else if (skipRate < 0.05 && subscription.quality === 'medium') {
        subscription.quality = 'high';
        logger.debug(`Adaptive quality increase for ${subscriptionKey}`);
      }
    }
    
    // OPTIMIZATION 3: Binary frame processing
    if (socket.frameOptimization.enableBinaryFrames && subscription.transport === 'binary') {
      let processedFrameData: any = frameData;
      
      // Decompress if needed and enabled
      if (socket.frameOptimization.enableDecompression && frameData.compressedData) {
        try {
          const compressedBuffer = Buffer.from(frameData.compressedData, 'base64');
          const decompressedBuffer = await gunzipAsync(compressedBuffer);
          
          processedFrameData = {
            ...frameData,
            decompressedData: decompressedBuffer.toString('base64'),
            decompressed: true,
            processingTime: Date.now() - now
          };
        } catch (decompressionError) {
          logger.warn(`Decompression failed for ${subscriptionKey}: ${decompressionError}`);
          processedFrameData = { ...frameData, decompressed: false };
        }
      }
      
      // Send optimized binary frame
      socket.emit('camera_frame_binary', {
        droneId: frameData.droneId,
        camera: frameData.camera,
        timestamp: frameData.timestamp,
        frameNumber: frameData.frameNumber,
        frameData: processedFrameData,
        subscription: {
          quality: subscription.quality,
          transport: subscription.transport,
          actualFPS: calculateActualFPS(subscription)
        },
        optimization: {
          compressed: frameData.compressedSize < frameData.originalSize,
          compressionRatio: frameData.originalSize / frameData.compressedSize,
          decompressed: processedFrameData.decompressed || false,
          skipCount: subscription.skipCount,
          frameCount: subscription.frameCount
        }
      });
      
      logger.debug(`Optimized binary frame sent: ${subscriptionKey} ` +
        `(${frameData.originalSize}→${frameData.compressedSize} bytes, ${subscription.quality})`);
    } else {
      // Fallback to legacy JSON format
      socket.emit('camera_frame', {
        droneId: frameData.droneId,
        camera: frameData.camera,
        timestamp: frameData.timestamp,
        frame: frameData.compressedData, // Already base64
        metadata: {
          ...frameData.metadata,
          transport: 'json_fallback',
          optimization: {
            originalTransport: 'binary',
            fallbackReason: 'client_compatibility'
          }
        }
      });
      
      logger.debug(`Legacy frame sent for ${subscriptionKey} (fallback mode)`);
    }
    
  } catch (error: any) {
    logger.error(`Error handling optimized binary frame for ${subscriptionKey}: ${error.message}`);
  }
}

// Calculate actual FPS for a subscription
function calculateActualFPS(subscription: CameraSubscription): number {
  const timeSinceStart = Date.now() - (subscription.lastFrameTime - (subscription.frameCount * 1000 / subscription.maxFPS));
  if (timeSinceStart > 0 && subscription.frameCount > 0) {
    return (subscription.frameCount * 1000) / timeSinceStart;
  }
  return 0;
}
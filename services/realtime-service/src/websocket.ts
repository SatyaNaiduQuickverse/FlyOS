// services/realtime-service/src/websocket.ts - UPDATED WITH CAMERA STREAMING AND PRECISION LANDING
import { Server, Socket } from 'socket.io';
import { ExtendedError } from 'socket.io/dist/namespace';
import { subscribeToDroneUpdates, getDroneState } from './redis';
import { logger } from './utils/logger';
import { verifySupabaseToken } from './utils/supabase-auth';

// Define interface for authenticated socket
interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    role: string;
    username?: string;
  };
  droneSubscriptions: Map<string, () => void>;
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
      logger.info(`New WebSocket connection attempt from ${socket.handshake.address}`);
      
      // Extract token with multiple fallback methods
      let token = null;
      
      // Method 1: auth object
      if (socket.handshake.auth?.token) {
        token = socket.handshake.auth.token;
        logger.debug('Token found in handshake.auth.token');
      }
      // Method 2: query parameters
      else if (socket.handshake.query?.token) {
        token = Array.isArray(socket.handshake.query.token) 
          ? socket.handshake.query.token[0] 
          : socket.handshake.query.token;
        logger.debug('Token found in handshake.query.token');
      }
      // Method 3: authorization header
      else if (socket.handshake.headers?.authorization) {
        const authHeader = socket.handshake.headers.authorization;
        if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7);
          logger.debug('Token found in authorization header');
        }
      }
      
      if (!token) {
        logger.warn('WebSocket authentication failed: No token provided');
        logger.debug('Available auth sources:', {
          auth: !!socket.handshake.auth?.token,
          query: !!socket.handshake.query?.token,
          headers: !!socket.handshake.headers?.authorization
        });
        return next(new Error('Authentication required - No token provided'));
      }
      
      logger.debug('Verifying WebSocket token...');
      
      // Verify token with enhanced error handling
      let user = null;
      try {
        user = await verifySupabaseToken(token);
      } catch (verifyError: any) {
        logger.error('Token verification error:', verifyError.message);
        return next(new Error(`Token verification failed: ${verifyError.message}`));
      }
      
      if (!user) {
        logger.warn('WebSocket authentication failed: Invalid or expired token');
        return next(new Error('Invalid or expired token'));
      }
      
      // Set user data and initialize subscriptions
      (socket as AuthenticatedSocket).user = user;
      (socket as AuthenticatedSocket).droneSubscriptions = new Map();
      
      logger.info(`WebSocket client authenticated: ${user.username || user.id} (${user.role})`);
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
    
    logger.info(`WebSocket client connected: ${authenticatedSocket.id}, user: ${user?.username || user?.id}`);
    
    // Send immediate connection confirmation
    authenticatedSocket.emit('connection_status', {
      status: 'connected',
      userId: user?.id,
      timestamp: Date.now(),
      message: 'WebSocket connection established successfully'
    });
    
    // Enhanced subscription handler
    authenticatedSocket.on('subscribe_drone', async (droneId: any) => {
      try {
        const droneIdStr = String(droneId || '').trim();
        
        if (!droneIdStr) {
          logger.warn(`Invalid drone ID received from ${authenticatedSocket.id}`);
          authenticatedSocket.emit('error', { 
            message: 'Invalid drone ID provided',
            code: 'INVALID_DRONE_ID',
            timestamp: Date.now()
          });
          return;
        }
        
        // Check if already subscribed
        if (authenticatedSocket.droneSubscriptions.has(droneIdStr)) {
          logger.debug(`Client ${authenticatedSocket.id} already subscribed to ${droneIdStr}`);
          authenticatedSocket.emit('subscription_status', { 
            droneId: droneIdStr, 
            status: 'already_subscribed',
            timestamp: Date.now()
          });
          return;
        }
        
        logger.info(`Client ${authenticatedSocket.id} subscribing to drone ${droneIdStr}`);
        
        // Get and send initial state
        try {
          const currentState = await getDroneState(droneIdStr);
          
          if (currentState) {
            const timestamp = Date.now();
            const enhancedState = {
              ...currentState,
              _meta: {
                ...(currentState._meta || {}),
                socketServerTimestamp: timestamp
              }
            };
            
            authenticatedSocket.emit('drone_state', { 
              droneId: droneIdStr, 
              data: enhancedState,
              type: 'initial',
              timestamp: timestamp
            });
            
            logger.debug(`Sent initial state for drone ${droneIdStr} to client ${authenticatedSocket.id}`);
          } else {
            logger.debug(`No initial state found for drone ${droneIdStr}`);
            
            // Send empty state to indicate subscription is active
            authenticatedSocket.emit('drone_state', { 
              droneId: droneIdStr, 
              data: { id: droneIdStr, connected: false },
              type: 'initial',
              timestamp: Date.now()
            });
          }
        } catch (stateError: any) {
          logger.warn(`Could not get initial state for drone ${droneIdStr}: ${stateError.message}`);
          
          // Send minimal state to indicate subscription
          authenticatedSocket.emit('drone_state', { 
            droneId: droneIdStr, 
            data: { id: droneIdStr, connected: false, error: 'State unavailable' },
            type: 'initial',
            timestamp: Date.now()
          });
        }
        
        // Subscribe to real-time updates
        const unsubscribe = subscribeToDroneUpdates(droneIdStr, (data) => {
          try {
            const timestamp = Date.now();
            authenticatedSocket.emit('drone_state', { 
              droneId: droneIdStr, 
              data: {
                ...data,
                _meta: {
                  ...(data._meta || {}),
                  socketServerTimestamp: timestamp
                }
              },
              type: 'update',
              timestamp: timestamp
            });
            
            logger.debug(`Sent real-time update for drone ${droneIdStr} to client ${authenticatedSocket.id}`);
          } catch (emitError: any) {
            logger.error(`Error emitting drone state for ${droneIdStr}: ${emitError.message}`);
          }
        });
        
        // Store unsubscribe function
        authenticatedSocket.droneSubscriptions.set(droneIdStr, unsubscribe);
        
        // Confirm subscription
        authenticatedSocket.emit('subscription_status', { 
          droneId: droneIdStr, 
          status: 'subscribed',
          timestamp: Date.now(),
          message: `Successfully subscribed to drone ${droneIdStr}`
        });
        
        logger.info(`Client ${authenticatedSocket.id} successfully subscribed to drone ${droneIdStr}`);
        
      } catch (error: any) {
        logger.error(`Error subscribing to drone ${droneId}: ${error.message}`);
        authenticatedSocket.emit('error', { 
          message: 'Failed to subscribe to drone updates',
          droneId: String(droneId || ''),
          error: error.message,
          code: 'SUBSCRIPTION_FAILED',
          timestamp: Date.now()
        });
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
            timestamp: Date.now(),
            message: `Unsubscribed from drone ${droneIdStr}`
          });
          
          logger.info(`Client ${authenticatedSocket.id} unsubscribed from drone ${droneIdStr}`);
        } else {
          logger.warn(`Client ${authenticatedSocket.id} tried to unsubscribe from ${droneIdStr} but was not subscribed`);
        }
      } catch (error: any) {
        logger.error(`Error unsubscribing from drone ${droneId}: ${error.message}`);
      }
    });

    // Camera stream subscription handler
    authenticatedSocket.on('subscribe_camera_stream', async (data: { droneId: string; camera: string; channels: string[] }) => {
      try {
        const { droneId, camera, channels } = data;
        
        logger.info(`Camera stream subscription: ${droneId}:${camera}`);
        
        // Subscribe to each camera channel
        for (const channel of channels) {
          const channelKey = `${channel}:${authenticatedSocket.id}`;
          
          const unsubscribe = subscribeToDroneUpdates(droneId, (streamData) => {
            if (channel.includes('stream')) {
              // Emit camera frame data
              authenticatedSocket.emit('camera_frame', {
                droneId: streamData.droneId,
                camera: streamData.camera,
                frame: streamData.frame,
                timestamp: streamData.timestamp,
                metadata: streamData.metadata
              });
            } else if (channel.includes('control')) {
              // Emit camera control messages
              authenticatedSocket.emit('camera_control', {
                droneId: streamData.droneId,
                camera: streamData.camera,
                action: streamData.action,
                timestamp: streamData.timestamp
              });
            }
          });
          
          // Store unsubscribe function with channel key
          authenticatedSocket.droneSubscriptions.set(channelKey, unsubscribe);
        }
        
        authenticatedSocket.emit('camera_subscription_status', { 
          droneId, 
          camera, 
          status: 'subscribed',
          timestamp: Date.now()
        });
        
        logger.info(`Client ${authenticatedSocket.id} subscribed to camera ${droneId}:${camera}`);
        
      } catch (error: any) {
        logger.error(`Camera subscription error: ${error.message}`);
        authenticatedSocket.emit('camera_subscription_error', { 
          droneId: data.droneId, 
          camera: data.camera, 
          error: error.message,
          timestamp: Date.now()
        });
      }
    });

    // Camera stream unsubscribe handler
    authenticatedSocket.on('unsubscribe_camera_stream', (data: { droneId: string; camera: string }) => {
      try {
        const { droneId, camera } = data;
        const pattern = `camera:${droneId}:${camera}`;
        
        // Find and remove all camera subscriptions for this drone/camera
        for (const [key, unsubscribe] of authenticatedSocket.droneSubscriptions.entries()) {
          if (key.includes(pattern)) {
            unsubscribe();
            authenticatedSocket.droneSubscriptions.delete(key);
          }
        }
        
        authenticatedSocket.emit('camera_subscription_status', { 
          droneId, 
          camera, 
          status: 'unsubscribed',
          timestamp: Date.now()
        });
        
        logger.info(`Client ${authenticatedSocket.id} unsubscribed from camera ${droneId}:${camera}`);
        
      } catch (error: any) {
        logger.error(`Camera unsubscribe error: ${error.message}`);
      }
    });

    // Camera subscriber management
    authenticatedSocket.on('camera_subscriber_added', (data: { droneId: string; camera: string; subscriberId: string }) => {
      logger.info(`Camera subscriber added: ${data.subscriberId} for ${data.droneId}:${data.camera}`);
    });

    authenticatedSocket.on('camera_subscriber_removed', (data: { droneId: string; camera: string; subscriberId: string }) => {
      logger.info(`Camera subscriber removed: ${data.subscriberId} for ${data.droneId}:${data.camera}`);
    });

    // Camera config change handler
    authenticatedSocket.on('camera_config_change', (data: { droneId: string; camera: string; config: any }) => {
      logger.info(`Camera config change requested for ${data.droneId}:${data.camera}:`, data.config);
      // This would typically forward the config change to the drone-connection-service
    });

    // Enhanced subscription handler with precision landing support
    authenticatedSocket.on('subscribe', async (channel: string) => {
      try {
        logger.info(`Client ${authenticatedSocket.id} subscribing to channel: ${channel}`);
        
        // Handle precision landing output subscriptions
        if (channel.startsWith('precision_land_output:')) {
          const droneId = channel.split(':')[1];
          
          if (!droneId) {
            authenticatedSocket.emit('error', { 
              message: 'Invalid precision landing channel format',
              channel,
              timestamp: Date.now()
            });
            return;
          }
          
          // Subscribe to Redis channel for precision landing output
          const { redisPubSub } = await import('./redis');
          
          const messageHandler = (redisChannel: string, message: string) => {
            if (redisChannel === channel) {
              try {
                const data = JSON.parse(message);
                authenticatedSocket.emit('precision_land_output', data);
              } catch (parseError) {
                logger.error(`Error parsing precision landing message: ${parseError}`);
              }
            }
          };
          
          redisPubSub.subscribe(channel);
          redisPubSub.on('message', messageHandler);
          
          // Store cleanup function
          const cleanupKey = `precision_output_${droneId}`;
          authenticatedSocket.droneSubscriptions.set(cleanupKey, () => {
            redisPubSub.unsubscribe(channel);
            redisPubSub.off('message', messageHandler);
          });
          
          authenticatedSocket.emit('subscription_status', { 
            channel, 
            status: 'subscribed',
            timestamp: Date.now()
          });
          
          logger.info(`Client ${authenticatedSocket.id} subscribed to precision landing output: ${droneId}`);
        }
        
        // Handle precision landing status subscriptions
        else if (channel.startsWith('precision_land_status:')) {
          const droneId = channel.split(':')[1];
          
          if (!droneId) {
            authenticatedSocket.emit('error', { 
              message: 'Invalid precision landing status channel format',
              channel,
              timestamp: Date.now()
            });
            return;
          }
          
          // Subscribe to Redis channel for precision landing status
          const { redisPubSub } = await import('./redis');
          
          const statusHandler = (redisChannel: string, message: string) => {
            if (redisChannel === channel) {
              try {
                const data = JSON.parse(message);
                authenticatedSocket.emit('precision_land_status', data);
              } catch (parseError) {
                logger.error(`Error parsing precision landing status: ${parseError}`);
              }
            }
          };
          
          redisPubSub.subscribe(channel);
          redisPubSub.on('message', statusHandler);
          
          // Store cleanup function
          const cleanupKey = `precision_status_${droneId}`;
          authenticatedSocket.droneSubscriptions.set(cleanupKey, () => {
            redisPubSub.unsubscribe(channel);
            redisPubSub.off('message', statusHandler);
          });
          
          authenticatedSocket.emit('subscription_status', { 
            channel, 
            status: 'subscribed',
            timestamp: Date.now()
          });
          
          logger.info(`Client ${authenticatedSocket.id} subscribed to precision landing status: ${droneId}`);
        }
        
      } catch (error: any) {
        logger.error(`Error handling subscription to ${channel}: ${error.message}`);
        authenticatedSocket.emit('error', { 
          message: 'Failed to subscribe to channel',
          channel,
          error: error.message,
          timestamp: Date.now()
        });
      }
    });

    // Add unsubscribe handler for precision landing channels
    authenticatedSocket.on('unsubscribe', (channel: string) => {
      try {
        if (channel.startsWith('precision_land_output:')) {
          const droneId = channel.split(':')[1];
          const cleanupKey = `precision_output_${droneId}`;
          
          const cleanup = authenticatedSocket.droneSubscriptions.get(cleanupKey);
          if (cleanup) {
            cleanup();
            authenticatedSocket.droneSubscriptions.delete(cleanupKey);
          }
          
          logger.info(`Client ${authenticatedSocket.id} unsubscribed from precision landing output: ${droneId}`);
        }
        
        else if (channel.startsWith('precision_land_status:')) {
          const droneId = channel.split(':')[1];
          const cleanupKey = `precision_status_${droneId}`;
          
          const cleanup = authenticatedSocket.droneSubscriptions.get(cleanupKey);
          if (cleanup) {
            cleanup();
            authenticatedSocket.droneSubscriptions.delete(cleanupKey);
          }
          
          logger.info(`Client ${authenticatedSocket.id} unsubscribed from precision landing status: ${droneId}`);
        }
      } catch (error: any) {
        logger.error(`Error unsubscribing from ${channel}: ${error.message}`);
      }
    });
    
    // Enhanced ping/pong handler for latency measurement
    authenticatedSocket.on('ping', (data: any) => {
      try {
        const serverTime = Date.now();
        const clientTime = data && typeof data === 'object' ? data.timestamp : serverTime;
        
        authenticatedSocket.emit('pong', {
          clientSentTime: clientTime,
          serverTime: serverTime,
          roundTripTime: serverTime - clientTime
        });
        
        logger.debug(`Handled ping from client ${authenticatedSocket.id}, RTT: ${serverTime - clientTime}ms`);
      } catch (error: any) {
        logger.error(`Error handling ping from ${authenticatedSocket.id}: ${error.message}`);
      }
    });
    
    // Handle client errors
    authenticatedSocket.on('error', (error: any) => {
      logger.error(`WebSocket client error for ${authenticatedSocket.id}:`, error);
    });
    
    // Enhanced disconnect handler
    authenticatedSocket.on('disconnect', (reason: string) => {
      try {
        logger.info(`WebSocket client disconnecting: ${authenticatedSocket.id}, reason: ${reason}`);
        
        // Clean up all subscriptions
        const subscriptionCount = authenticatedSocket.droneSubscriptions.size;
        
        for (const [key, unsubscribe] of authenticatedSocket.droneSubscriptions.entries()) {
          try {
            unsubscribe();
            logger.debug(`Cleaned up subscription: ${key}`);
          } catch (cleanupError: any) {
            logger.error(`Error cleaning up subscription ${key}: ${cleanupError.message}`);
          }
        }
        
        authenticatedSocket.droneSubscriptions.clear();
        
        logger.info(`WebSocket client disconnected: ${authenticatedSocket.id}, cleaned up ${subscriptionCount} subscriptions`);
      } catch (error: any) {
        logger.error(`Error handling disconnect for ${authenticatedSocket.id}: ${error.message}`);
      }
    });
  });
  
  // Global error handlers
  io.engine.on('connection_error', (err: any) => {
    logger.error('WebSocket connection error:', {
      message: err.message,
      type: err.type,
      description: err.description,
      context: err.context,
      req: err.req?.url
    });
  });
  
  // Log server events
  io.on('connect_error', (err: any) => {
    logger.error('WebSocket server connection error:', err);
  });
  
  logger.info('WebSocket server configured successfully with camera streaming and precision landing support');
  return io;
};
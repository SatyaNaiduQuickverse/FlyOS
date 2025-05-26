// services/realtime-service/src/websocket.ts - COMPREHENSIVE FIX
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
        
        for (const [droneId, unsubscribe] of authenticatedSocket.droneSubscriptions.entries()) {
          try {
            unsubscribe();
            logger.debug(`Cleaned up subscription for drone ${droneId}`);
          } catch (cleanupError: any) {
            logger.error(`Error cleaning up subscription for drone ${droneId}: ${cleanupError.message}`);
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
  
  logger.info('WebSocket server configured successfully');
  return io;
};
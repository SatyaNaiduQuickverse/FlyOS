// services/realtime-service/src/websocket.ts - PATCHED FOR VERSION COMPATIBILITY
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
  // Enhanced authentication middleware with better error handling
  io.use(async (socket: Socket, next: (err?: ExtendedError) => void) => {
    try {
      // Enhanced token extraction with multiple fallbacks
      let token = null;
      
      // Try different token sources
      if (socket.handshake.auth && socket.handshake.auth.token) {
        token = socket.handshake.auth.token;
      } else if (socket.handshake.query && socket.handshake.query.token) {
        token = socket.handshake.query.token;
      } else if (socket.handshake.headers && socket.handshake.headers.authorization) {
        const authHeader = socket.handshake.headers.authorization;
        if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7);
        }
      }
      
      if (!token) {
        logger.warn('WebSocket authentication failed: No token provided');
        return next(new Error('Authentication required - No token provided'));
      }
      
      logger.debug('WebSocket token received, verifying...');
      
      // Verify the token with Supabase with enhanced error handling
      let user = null;
      try {
        user = await verifySupabaseToken(token);
      } catch (verifyError) {
        logger.error('Token verification error:', verifyError);
        return next(new Error('Token verification failed'));
      }
      
      if (!user) {
        logger.warn('WebSocket authentication failed: Invalid token');
        return next(new Error('Invalid or expired token'));
      }
      
      // Set user data and initialize subscriptions map
      (socket as AuthenticatedSocket).user = user;
      (socket as AuthenticatedSocket).droneSubscriptions = new Map();
      
      logger.info(`WebSocket client authenticated: ${user.username} (${user.role})`);
      next();
    } catch (error) {
      logger.error('Socket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  });
  
  // Handle connections with enhanced error handling
  io.on('connection', (socket: Socket) => {
    const authenticatedSocket = socket as AuthenticatedSocket;
    logger.info(`WebSocket client connected: ${authenticatedSocket.id}, user: ${authenticatedSocket.user?.username}`);
    
    // Enhanced subscription handler with better error handling
    authenticatedSocket.on('subscribe_drone', async (droneId: any) => {
      try {
        // Ensure droneId is a string
        const droneIdStr = String(droneId || '').trim();
        
        if (!droneIdStr) {
          logger.warn(`Invalid drone ID received from ${authenticatedSocket.id}`);
          authenticatedSocket.emit('error', { 
            message: 'Invalid drone ID provided',
            code: 'INVALID_DRONE_ID'
          });
          return;
        }
        
        // Check if already subscribed
        if (authenticatedSocket.droneSubscriptions.has(droneIdStr)) {
          authenticatedSocket.emit('subscription_status', { 
            droneId: droneIdStr, 
            status: 'already_subscribed',
            timestamp: Date.now()
          });
          return;
        }
        
        logger.debug(`Client ${authenticatedSocket.id} subscribing to drone ${droneIdStr}`);
        
        // Get initial state with timeout
        try {
          const currentState = await Promise.race([
            getDroneState(droneIdStr),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
          ]);
          
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
            
            logger.debug(`Emitted initial state for ${droneIdStr}`);
          } else {
            logger.debug(`No initial state found for ${droneIdStr}`);
          }
        } catch (stateError) {
          logger.warn(`Could not get initial state for ${droneIdStr}:`, stateError);
          // Continue with subscription even if initial state fails
        }
        
        // Subscribe to updates with enhanced error handling
        const unsubscribe = subscribeToDroneUpdates(droneIdStr, (data) => {
          try {
            const timestamp = Date.now();
            authenticatedSocket.emit('drone_state', { 
              droneId: droneIdStr, 
              data,
              type: 'update',
              timestamp: timestamp
            });
          } catch (emitError) {
            logger.error(`Error emitting drone state for ${droneIdStr}:`, emitError);
          }
        });
        
        // Store unsubscribe function
        authenticatedSocket.droneSubscriptions.set(droneIdStr, unsubscribe);
        
        // Confirm subscription
        authenticatedSocket.emit('subscription_status', { 
          droneId: droneIdStr, 
          status: 'subscribed',
          timestamp: Date.now()
        });
        
        logger.info(`Client ${authenticatedSocket.id} successfully subscribed to drone ${droneIdStr}`);
        
      } catch (error) {
        logger.error(`Error subscribing to drone ${droneId}:`, error);
        authenticatedSocket.emit('error', { 
          message: 'Failed to subscribe to drone updates',
          droneId: String(droneId || ''),
          error: error instanceof Error ? error.message : 'Unknown error'
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
            timestamp: Date.now()
          });
          
          logger.debug(`Client ${authenticatedSocket.id} unsubscribed from drone ${droneIdStr}`);
        } else {
          logger.warn(`Client ${authenticatedSocket.id} tried to unsubscribe from ${droneIdStr} but was not subscribed`);
        }
      } catch (error) {
        logger.error(`Error unsubscribing from drone ${droneId}:`, error);
      }
    });
    
    // Enhanced ping handler
    authenticatedSocket.on('ping', (data: any) => {
      try {
        const serverTime = Date.now();
        const clientTime = data && typeof data === 'object' ? data.timestamp : Date.now();
        
        authenticatedSocket.emit('pong', {
          clientSentTime: clientTime,
          serverTime: serverTime
        });
      } catch (error) {
        logger.error(`Error handling ping from ${authenticatedSocket.id}:`, error);
      }
    });
    
    // Enhanced disconnect handler
    authenticatedSocket.on('disconnect', (reason) => {
      try {
        logger.info(`WebSocket client disconnecting: ${authenticatedSocket.id}, reason: ${reason}`);
        
        // Clean up all subscriptions
        for (const [droneId, unsubscribe] of authenticatedSocket.droneSubscriptions.entries()) {
          try {
            unsubscribe();
            logger.debug(`Cleaned up subscription for drone ${droneId}`);
          } catch (cleanupError) {
            logger.error(`Error cleaning up subscription for drone ${droneId}:`, cleanupError);
          }
        }
        
        authenticatedSocket.droneSubscriptions.clear();
        logger.info(`WebSocket client disconnected: ${authenticatedSocket.id}`);
      } catch (error) {
        logger.error(`Error handling disconnect for ${authenticatedSocket.id}:`, error);
      }
    });
    
    // Enhanced error handler
    authenticatedSocket.on('error', (error) => {
      logger.error(`WebSocket error for client ${authenticatedSocket.id}:`, error);
    });
    
    // Connection success confirmation
    authenticatedSocket.emit('connection_status', {
      status: 'connected',
      userId: authenticatedSocket.user?.id,
      timestamp: Date.now()
    });
  });
  
  // Global error handler
  io.engine.on('connection_error', (err) => {
    logger.error('WebSocket connection error:', {
      message: err.message,
      type: err.type,
      description: err.description,
      context: err.context
    });
  });
  
  return io;
};

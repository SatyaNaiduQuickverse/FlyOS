// services/realtime-service/src/websocket.ts
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
  // Authentication middleware - now using ONLY Supabase
  io.use(async (socket: Socket, next: (err?: ExtendedError) => void) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      
      if (!token) {
        return next(new Error('Authentication required'));
      }
      
      // Verify the token with Supabase
      const user = await verifySupabaseToken(token as string);
      
      if (!user) {
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
  
  // Handle connections
  io.on('connection', (socket: Socket) => {
    const authenticatedSocket = socket as AuthenticatedSocket;
    logger.info(`WebSocket client connected: ${authenticatedSocket.id}, user: ${authenticatedSocket.user?.username}`);
    
    // Subscribe to drone updates
    authenticatedSocket.on('subscribe_drone', async (droneId: string) => {
      try {
        // Check if already subscribed
        if (authenticatedSocket.droneSubscriptions.has(droneId)) {
          authenticatedSocket.emit('subscription_status', { 
            droneId, 
            status: 'already_subscribed',
            timestamp: Date.now()
          });
          return;
        }
        
        logger.debug(`Client ${authenticatedSocket.id} subscribing to drone ${droneId}`);
        
        // Get initial state
        const currentState = await getDroneState(droneId);
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
            droneId, 
            data: enhancedState,
            type: 'initial',
            timestamp: timestamp
          });
          
          logger.debug(`Emitted initial state for ${droneId}`);
        }
        
        // Subscribe to updates
        const unsubscribe = subscribeToDroneUpdates(droneId, (data) => {
          const timestamp = Date.now();
          authenticatedSocket.emit('drone_state', { 
            droneId, 
            data,
            type: 'update',
            timestamp: timestamp
          });
        });
        
        // Store unsubscribe function
        authenticatedSocket.droneSubscriptions.set(droneId, unsubscribe);
        
        // Confirm subscription
        authenticatedSocket.emit('subscription_status', { 
          droneId, 
          status: 'subscribed',
          timestamp: Date.now()
        });
      } catch (error) {
        logger.error(`Error subscribing to drone ${droneId}:`, error);
        authenticatedSocket.emit('error', { 
          message: 'Failed to subscribe to drone updates',
          droneId
        });
      }
    });
    
    // Unsubscribe from drone updates
    authenticatedSocket.on('unsubscribe_drone', (droneId: string) => {
      try {
        const unsubscribe = authenticatedSocket.droneSubscriptions.get(droneId);
        
        if (unsubscribe) {
          unsubscribe();
          authenticatedSocket.droneSubscriptions.delete(droneId);
          
          authenticatedSocket.emit('subscription_status', { 
            droneId, 
            status: 'unsubscribed',
            timestamp: Date.now()
          });
          
          logger.debug(`Client ${authenticatedSocket.id} unsubscribed from drone ${droneId}`);
        }
      } catch (error) {
        logger.error(`Error unsubscribing from drone ${droneId}:`, error);
      }
    });
    
    // Handle ping for latency measurement
    authenticatedSocket.on('ping', (data) => {
      const serverTime = Date.now();
      authenticatedSocket.emit('pong', {
        clientSentTime: data.timestamp,
        serverTime: serverTime
      });
    });
    
    // Handle disconnect
    authenticatedSocket.on('disconnect', () => {
      try {
        // Clean up all subscriptions
        for (const [droneId, unsubscribe] of authenticatedSocket.droneSubscriptions.entries()) {
          unsubscribe();
        }
        authenticatedSocket.droneSubscriptions.clear();
        logger.info(`WebSocket client disconnected: ${authenticatedSocket.id}`);
      } catch (error) {
        logger.error(`Error handling disconnect for ${authenticatedSocket.id}:`, error);
      }
    });
  });
  
  return io;
};

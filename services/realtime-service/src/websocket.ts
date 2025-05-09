import { Server, Socket } from 'socket.io';
import { ExtendedError } from 'socket.io/dist/namespace';
import axios from 'axios';
import { subscribeToDroneUpdates, getDroneState } from './redis';
import { logger } from './utils/logger';
import { verifyToken } from './utils/auth';

// Define interface for authenticated socket
interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    role: string;
  };
  droneSubscriptions: Map<string, () => void>;
}

export const setupWebSocketServer = (io: Server) => {
  // Authentication middleware
  io.use(async (socket: Socket, next: (err?: ExtendedError) => void) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      
      if (!token) {
        return next(new Error('Authentication required'));
      }
      
      // Verify the token
      const user = await verifyToken(token as string);
      
      if (!user) {
        return next(new Error('Invalid token'));
      }
      
      // Set user data and initialize subscriptions map
      (socket as AuthenticatedSocket).user = user;
      (socket as AuthenticatedSocket).droneSubscriptions = new Map();
      
      next();
    } catch (error) {
      logger.error('Socket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  });
  
  // Handle connections
  io.on('connection', (socket: Socket) => {
    const authenticatedSocket = socket as AuthenticatedSocket;
    logger.info(`Client connected: ${authenticatedSocket.id}, user: ${authenticatedSocket.user?.id}`);
    
    // Subscribe to drone updates
    authenticatedSocket.on('subscribe_drone', async (droneId: string) => {
      try {
        // Check if already subscribed
        if (authenticatedSocket.droneSubscriptions.has(droneId)) {
          return;
        }
        
        logger.debug(`Client ${authenticatedSocket.id} subscribing to drone ${droneId}`);
        
        // Get initial state
        const currentState = await getDroneState(droneId);
        if (currentState) {
          authenticatedSocket.emit('drone_state', { droneId, data: currentState });
        }
        
        // Subscribe to updates
        const unsubscribe = subscribeToDroneUpdates(droneId, (data) => {
          authenticatedSocket.emit('drone_state', { droneId, data });
        });
        
        // Store unsubscribe function
        authenticatedSocket.droneSubscriptions.set(droneId, unsubscribe);
        
        // Confirm subscription
        authenticatedSocket.emit('subscription_status', { 
          droneId, 
          status: 'subscribed' 
        });
      } catch (error) {
        logger.error(`Error subscribing to drone ${droneId}:`, error);
        authenticatedSocket.emit('error', { 
          message: 'Failed to subscribe to drone updates'
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
            status: 'unsubscribed' 
          });
          
          logger.debug(`Client ${authenticatedSocket.id} unsubscribed from drone ${droneId}`);
        }
      } catch (error) {
        logger.error(`Error unsubscribing from drone ${droneId}:`, error);
      }
    });
    
    // Handle disconnect
    authenticatedSocket.on('disconnect', () => {
      try {
        // Clean up all subscriptions
        for (const [droneId, unsubscribe] of authenticatedSocket.droneSubscriptions.entries()) {
          unsubscribe();
          logger.debug(`Unsubscribed ${authenticatedSocket.id} from drone ${droneId} due to disconnect`);
        }
        
        authenticatedSocket.droneSubscriptions.clear();
        logger.info(`Client disconnected: ${authenticatedSocket.id}`);
      } catch (error) {
        logger.error(`Error handling disconnect for ${authenticatedSocket.id}:`, error);
      }
    });
  });
  
  return io;
};

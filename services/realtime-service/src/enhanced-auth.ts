import { Server, Socket } from 'socket.io';
import { ExtendedError } from 'socket.io/dist/namespace';
import { verifySupabaseToken } from './utils/supabase-auth';
import { logger } from './utils/logger';

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    role: string;
    username?: string;
  };
  droneSubscriptions: Map<string, () => void>;
}

export const setupProductionAuth = (io: Server) => {
  io.use(async (socket: Socket, next: (err?: ExtendedError) => void) => {
    try {
      const token = extractToken(socket);
      
      if (!token) {
        logger.warn(`WebSocket: No token from ${socket.handshake.address}`);
        return next(new Error('Authentication required'));
      }

      const user = await verifySupabaseToken(token);
      
      if (!user) {
        logger.warn(`WebSocket: Invalid token from ${socket.handshake.address}`);
        return next(new Error('Invalid token'));
      }

      (socket as AuthenticatedSocket).user = user;
      (socket as AuthenticatedSocket).droneSubscriptions = new Map();
      
      logger.info(`WebSocket authenticated: ${user.username} (${user.role})`);
      next();
      
    } catch (error: any) {
      logger.error('WebSocket auth error:', error.message);
      next(new Error('Authentication failed'));
    }
  });
};

function extractToken(socket: Socket): string | null {
  // Authorization header
  const authHeader = socket.handshake.headers?.authorization;
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Auth object
  if (socket.handshake.auth?.token) {
    return socket.handshake.auth.token;
  }
  
  // Query parameter
  const queryToken = socket.handshake.query?.token;
  if (queryToken) {
    return Array.isArray(queryToken) ? queryToken[0] : queryToken;
  }
  
  return null;
}

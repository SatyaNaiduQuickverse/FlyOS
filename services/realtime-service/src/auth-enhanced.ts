import { Server, Socket } from 'socket.io';
import { ExtendedError } from 'socket.io/dist/namespace';
import { createClient } from '@supabase/supabase-js';
import { logger } from './utils/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    role: string;
    username?: string;
    regionId?: string;
  };
  droneSubscriptions: Map<string, () => void>;
}

export const setupEnhancedAuth = (io: Server) => {
  io.use(async (socket: Socket, next: (err?: ExtendedError) => void) => {
    try {
      const token = extractToken(socket);
      
      if (!token) {
        logger.warn(`WebSocket: No token from ${socket.handshake.address}`);
        return next(new Error('Authentication required'));
      }

      // Validate with Supabase
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        logger.warn(`WebSocket: Invalid token - ${error?.message}`);
        return next(new Error('Invalid or expired token'));
      }

      // Set user data
      const metadata = user.user_metadata || {};
      (socket as AuthenticatedSocket).user = {
        id: user.id,
        role: metadata.role || 'OPERATOR',
        username: metadata.username || user.email?.split('@')[0],
        regionId: metadata.region_id
      };

      (socket as AuthenticatedSocket).droneSubscriptions = new Map();
      
      logger.info(`WebSocket authenticated: ${metadata.username} (${metadata.role})`);
      next();
      
    } catch (error: any) {
      logger.error('WebSocket auth error:', error.message);
      next(new Error('Authentication failed'));
    }
  });
};

function extractToken(socket: Socket): string | null {
  // Multiple token extraction methods
  const authHeader = socket.handshake.headers?.authorization;
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  if (socket.handshake.auth?.token) {
    return socket.handshake.auth.token;
  }
  
  const queryToken = socket.handshake.query?.token;
  if (queryToken) {
    return Array.isArray(queryToken) ? queryToken[0] : queryToken;
  }
  
  return null;
}

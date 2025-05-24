// services/realtime-service/src/utils/auth.ts
import axios from 'axios';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { logger } from './logger';

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_here';
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:4000';
const TESTING_MODE = process.env.TESTING_MODE === 'true';

// Supabase client (only initialize if config is available)
let supabase: any = null;
if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  logger.info('Supabase client initialized for WebSocket auth');
}

// Define the user interface
interface User {
  id: string;
  role: string;
  region_id?: string;
  username?: string;
  full_name?: string;
  [key: string]: any;
}

// Extend JwtPayload with our expected properties
interface TokenPayload extends JwtPayload {
  id?: string;
  role?: string;
  regionId?: string;
  username?: string;
  fullName?: string;
}

/**
 * Enhanced token verification with Supabase and JWT fallback
 * @param token JWT token to verify
 * @returns User object if valid, null if invalid
 */
export const verifyToken = async (token: string): Promise<User | null> => {
  try {
    // 1. Try Supabase authentication first (if available)
    if (supabase) {
      try {
        logger.debug('Attempting Supabase WebSocket authentication');
        
        // Verify token with Supabase
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (!error && user) {
          // Get user profile
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
          
          if (!profileError && profile) {
            logger.info(`Supabase WebSocket auth successful: ${profile.username} (${profile.role})`);
            
            return {
              id: user.id,
              role: profile.role,
              region_id: profile.region_id,
              username: profile.username,
              full_name: profile.full_name,
              email: user.email,
              ...profile
            };
          }
        }
        
        logger.debug('Supabase WebSocket auth failed, falling back to JWT');
      } catch (supabaseError) {
        logger.debug('Supabase WebSocket auth error, falling back to JWT:', supabaseError);
      }
    }
    
    // 2. Fallback to testing mode if enabled
    if (TESTING_MODE) {
      try {
        logger.info('Testing mode enabled for WebSocket, verifying token locally');
        
        const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
        return {
          id: decoded.id || 'test-user-id',
          role: decoded.role || 'OPERATOR',
          region_id: decoded.regionId,
          username: decoded.username,
          full_name: decoded.fullName,
          ...Object(decoded)
        };
      } catch (err) {
        logger.warn('Local token verification failed:', (err as Error).message);
      }
    }
    
    // 3. Try Auth Service verification
    try {
      logger.debug(`Verifying token with auth service at ${AUTH_SERVICE_URL}`);
      const response = await axios.get(`${AUTH_SERVICE_URL}/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 3000
      });
      
      if (response.data?.success) {
        logger.debug('Token verified successfully via auth service');
        return {
          id: response.data.user.id,
          role: response.data.user.role,
          region_id: response.data.user.regionId, // Map old to new
          username: response.data.user.username,
          full_name: response.data.user.fullName, // Map old to new
          ...response.data.user
        };
      }
      
      logger.warn('Auth service rejected token:', response.data?.message);
    } catch (authServiceError) {
      logger.warn('Auth service verification failed:', (authServiceError as Error).message);
    }
    
    // 4. Final fallback to local JWT verification
    if (process.env.ALLOW_FALLBACK_VERIFICATION === 'true') {
      try {
        logger.info('Using fallback local verification for WebSocket');
        const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
        return {
          id: decoded.id || 'fallback-user-id',
          role: decoded.role || 'OPERATOR',
          region_id: decoded.regionId,
          username: decoded.username,
          full_name: decoded.fullName,
          ...Object(decoded)
        };
      } catch (fallbackError) {
        logger.error('Fallback verification failed:', (fallbackError as Error).message);
      }
    }
    
    return null;
  } catch (err) {
    const error = err as Error;
    logger.error('Token verification failed:', error.message);
    return null;
  }
};

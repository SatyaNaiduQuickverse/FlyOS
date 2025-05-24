// services/drone-db-service/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

// Extend Express Request type to include user property
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
        region_id?: string;
        username?: string;
        full_name?: string;
        [key: string]: any;
      };
    }
  }
}

// JWT secret from environment
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_here';

// Supabase client (only initialize if Supabase config is available)
let supabase: any = null;
if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Enhanced authentication middleware that supports both old JWT and new Supabase auth
 * This allows for smooth migration without breaking existing functionality
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    
    // Extract token from Bearer format
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : authHeader;
    
    // Try Supabase authentication first (if available)
    if (supabase) {
      try {
        logger.debug('Attempting Supabase authentication');
        
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
            // Set user in request with complete profile data
            req.user = {
              id: user.id,
              role: profile.role,
              region_id: profile.region_id,
              username: profile.username,
              full_name: profile.full_name,
              email: user.email,
              ...profile
            };
            
            logger.debug(`Supabase auth successful: ${profile.username} (${profile.role})`);
            return next();
          }
        }
        
        logger.debug('Supabase auth failed, falling back to JWT');
      } catch (supabaseError) {
        logger.debug('Supabase auth error, falling back to JWT:', supabaseError);
      }
    }
    
    // Fallback to old JWT authentication
    try {
      logger.debug('Using JWT authentication');
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      // Set user in request (compatible with old format)
      req.user = {
        id: decoded.id,
        role: decoded.role,
        region_id: decoded.regionId, // Map old regionId to region_id
        username: decoded.username,
        full_name: decoded.fullName, // Map old fullName to full_name
        ...decoded
      };
      
      logger.debug(`JWT auth successful: ${decoded.username || decoded.id} (${decoded.role})`);
      next();
    } catch (jwtError) {
      logger.error('JWT authentication failed:', jwtError);
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(401).json({ success: false, message: 'Authentication failed' });
  }
};

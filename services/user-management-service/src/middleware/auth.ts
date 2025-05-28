// services/user-management-service/src/middleware/auth.ts - PURE SUPABASE AUTH
import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { prisma } from '../database';

// PURE Supabase client - SAME as your other services
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Clean type declaration
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
        regionId?: string;
        username?: string;
        fullName?: string;
        email?: string;
        supabaseUserId: string;
      };
    }
  }
}

/**
 * PURE Supabase Authentication Middleware - Same pattern as drone-db-service
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      logger.warn('No authorization header provided');
      return res.status(401).json({ 
        success: false, 
        message: 'No token provided' 
      });
    }
    
    const token = authHeader.substring(7);
    logger.debug('Verifying Supabase token for User Management API');
    
    // STEP 1: Verify token with Supabase - ONLY method
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) {
      logger.warn('Supabase token verification failed:', error.message);
      
      if (error.message.includes('expired') || error.message.includes('JWT')) {
        return res.status(401).json({ 
          success: false, 
          message: 'Token expired. Please login again.',
          code: 'TOKEN_EXPIRED'
        });
      }
      
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token' 
      });
    }
    
    if (!user) {
      logger.warn('No user found in Supabase token');
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token' 
      });
    }
    
    logger.debug(`Supabase user verified: ${user.id} (${user.email})`);
    
    // STEP 2: Get user profile from local database (if exists)
    let localUser = null;
    try {
      localUser = await prisma.user.findUnique({
        where: { supabaseUserId: user.id },
        include: { region: true }
      });
    } catch (dbError) {
      logger.warn('Error fetching local user profile:', dbError);
      // Continue with Supabase metadata
    }
    
    // STEP 3: Use local profile or fallback to Supabase metadata
    const profile = localUser || {
      id: user.id, // Use Supabase ID as fallback
      username: user.user_metadata?.username || user.email?.split('@')[0] || 'user',
      role: user.user_metadata?.role || 'OPERATOR',
      regionId: user.user_metadata?.region_id,
      fullName: user.user_metadata?.full_name || 'User',
      email: user.email
    };
    
    // STEP 4: Set user in request
    req.user = {
      id: localUser?.id || user.id, // Use local ID if available, otherwise Supabase ID
      role: profile.role,
      regionId: profile.regionId || localUser?.regionId,
      username: profile.username,
      fullName: profile.fullName || localUser?.fullName,
      email: user.email!,
      supabaseUserId: user.id
    };
    
    logger.debug(`User Management API auth successful: ${profile.username} (${profile.role})`);
    next();
    
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Authentication failed' 
    });
  }
};

/**
 * Role-based authorization middleware
 */
export const requireRole = (allowedRoles: string | string[]) => {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }
    
    if (!roles.includes(req.user.role)) {
      logger.warn(`Access denied for role ${req.user.role} to ${req.path}`);
      return res.status(403).json({ 
        success: false, 
        message: 'Insufficient permissions' 
      });
    }
    
    next();
  };
};

/**
 * MAIN_HQ only middleware
 */
export const requireMainHQ = requireRole('MAIN_HQ');

/**
 * Regional HQ or higher middleware
 */
export const requireRegionalHQOrHigher = requireRole(['MAIN_HQ', 'REGIONAL_HQ']);
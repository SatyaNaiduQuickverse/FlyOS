// services/drone-db-service/src/middleware/supabase-auth.ts - CLEANED VERSION
import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { pool } from '../database';

// PURE Supabase client - ONLY authentication method
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
        region_id?: string;
        username?: string;
        full_name?: string;
        email?: string;
        [key: string]: any;
      };
    }
  }
}

/**
 * PURE Supabase Authentication Middleware
 * No fallbacks, no JWT verification, no auth service calls
 */
export const authenticateSupabase = async (req: Request, res: Response, next: NextFunction) => {
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
    logger.debug('Verifying Supabase token for API request');
    
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
    
    // STEP 2: Get/Create user profile in local database
    let profile = null;
    try {
      // Try to get existing profile
      const { rows } = await pool.query(
        'SELECT * FROM profiles WHERE id = $1',
        [user.id]
      );
      
      if (rows.length > 0) {
        profile = rows[0];
        logger.debug(`Profile found: ${profile.username} (${profile.role})`);
      } else {
        // Create profile from Supabase user data
        logger.info(`Creating profile for new user: ${user.id}`);
        
        const userData = user.user_metadata || {};
        const newProfile = {
          id: user.id,
          username: userData.username || user.email?.split('@')[0] || 'user',
          role: userData.role || 'OPERATOR',  // Default role
          region_id: userData.region_id || null,
          full_name: userData.full_name || 'User',
          email: user.email
        };
        
        // Insert with conflict resolution
        const { rows: insertedRows } = await pool.query(
          `INSERT INTO profiles (id, username, role, region_id, full_name, email) 
           VALUES ($1, $2, $3, $4, $5, $6) 
           ON CONFLICT (id) DO UPDATE SET 
             username = EXCLUDED.username,
             role = EXCLUDED.role,
             region_id = EXCLUDED.region_id,
             full_name = EXCLUDED.full_name,
             email = EXCLUDED.email,
             updated_at = NOW()
           RETURNING *`,
          [newProfile.id, newProfile.username, newProfile.role, 
           newProfile.region_id, newProfile.full_name, newProfile.email]
        );
        
        profile = insertedRows[0];
        logger.info(`Profile created: ${profile.username} (${profile.role})`);
      }
    } catch (profileError) {
      logger.error('Error fetching/creating user profile:', profileError);
      return res.status(500).json({ 
        success: false, 
        message: 'Error processing user profile' 
      });
    }
    
    // STEP 3: Set user in request
    req.user = {
      id: user.id,
      role: profile.role,
      region_id: profile.region_id,
      username: profile.username,
      full_name: profile.full_name,
      email: user.email,
      ...profile
    };
    
    logger.debug(`API authentication successful: ${profile.username} (${profile.role})`);
    next();
    
  } catch (error) {
    logger.error('Supabase authentication error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Authentication failed' 
    });
  }
};
// services/drone-db-service/src/middleware/supabase-auth.ts
import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

export const authenticateSupabase = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    
    const token = authHeader.substring(7);
    
    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      logger.warn('Supabase token verification failed:', error?.message);
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    
    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (profileError || !profile) {
      logger.warn('User profile not found:', profileError?.message);
      return res.status(401).json({ success: false, message: 'User profile not found' });
    }
    
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
    
    logger.debug(`User authenticated: ${profile.username} (${profile.role})`);
    next();
  } catch (error) {
    logger.error('Supabase authentication error:', error);
    return res.status(401).json({ success: false, message: 'Authentication failed' });
  }
};

import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    regionId?: string;
    email?: string;
    username?: string;
  };
}

export const authenticateToken = async (
  req: AuthenticatedRequest, 
  res: Response, 
  next: NextFunction
) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authorization token required',
        code: 'MISSING_TOKEN'
      });
    }

    // Validate with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      logger.warn(`Token validation failed: ${error?.message || 'No user'}`);
      return res.status(403).json({ 
        success: false, 
        message: 'Invalid or expired token',
        code: 'INVALID_TOKEN'
      });
    }

    // Extract user metadata
    const metadata = user.user_metadata || {};
    
    req.user = {
      id: user.id,
      role: metadata.role || 'OPERATOR',
      regionId: metadata.region_id,
      email: user.email,
      username: metadata.username || user.email?.split('@')[0]
    };

    logger.debug(`Authenticated user: ${req.user.username} (${req.user.role})`);
    next();

  } catch (error: any) {
    logger.error('Authentication middleware error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Authentication service error',
      code: 'AUTH_SERVICE_ERROR'
    });
  }
};

// Role-based access control
export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`Access denied: ${req.user.username} (${req.user.role}) attempted ${req.method} ${req.path}`);
      return res.status(403).json({ 
        success: false, 
        message: 'Insufficient permissions',
        required: allowedRoles,
        current: req.user.role
      });
    }
    
    next();
  };
};

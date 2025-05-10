import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

// Extend Express Request type to include user property
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
        [key: string]: any;
      };
    }
  }
}

// JWT secret from environment
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_here';

// Authentication middleware
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
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
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Set user in request
    req.user = decoded as Express.Request['user'];
    
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

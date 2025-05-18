// services/realtime-service/src/utils/auth.ts
import axios from 'axios';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { logger } from './logger';

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_here';
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:4000';
const TESTING_MODE = process.env.TESTING_MODE === 'true';

// Define the user interface
interface User {
  id: string;
  role: string;
  [key: string]: any;
}

// Extend JwtPayload with our expected properties
interface TokenPayload extends JwtPayload {
  id?: string;
  role?: string;
}

/**
 * Verify token with authentication service or locally in testing mode
 * @param token JWT token to verify
 * @returns User object if valid, null if invalid
 */
export const verifyToken = async (token: string): Promise<User | null> => {
  try {
    // 1. First attempt: Try to verify the token locally for testing/development purposes
    if (TESTING_MODE) {
      try {
        // In testing mode, accept any valid JWT structure without external verification
        logger.info('Testing mode enabled, verifying token locally');
        
        // For better debugging, log the token structure (but not the full token)
        try {
          const decoded = jwt.decode(token) as TokenPayload;
          logger.debug('Token structure:', JSON.stringify({
            id: decoded?.id || '[missing]',
            role: decoded?.role || '[missing]',
            tokenStructureValid: !!decoded
          }));
        } catch (err) {
          const decodeErr = err as Error;
          logger.warn('Could not decode token for inspection:', decodeErr.message);
        }
        
        // Verify the token with the local secret
        const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
        return {
          id: decoded.id || 'test-user-id',
          role: decoded.role || 'OPERATOR',
          ...Object(decoded)  // Convert to object before spreading
        };
      } catch (err) {
        const localError = err as Error;
        logger.warn('Local token verification failed:', localError.message);
        // Fall through to next verification method
      }
    }
    
    // 2. Second attempt: Try to verify using Auth Service
    try {
      logger.debug(`Verifying token with auth service at ${AUTH_SERVICE_URL}`);
      const response = await axios.get(`${AUTH_SERVICE_URL}/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 3000 // 3 second timeout to prevent long delays
      });
      
      if (response.data?.success) {
        logger.debug('Token verified successfully via auth service');
        return response.data.user;
      }
      
      logger.warn('Auth service rejected token:', response.data?.message || 'Unknown reason');
      return null;
    } catch (err) {
      const authServiceError = err as Error;
      logger.warn('Auth service verification failed:', authServiceError.message);
      
      // 3. Third attempt: Fall back to local JWT verification if auth service is unavailable
      if (process.env.ALLOW_FALLBACK_VERIFICATION === 'true') {
        try {
          logger.info('Using fallback local verification due to auth service failure');
          const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
          return {
            id: decoded.id || 'fallback-user-id',
            role: decoded.role || 'OPERATOR',
            ...Object(decoded)  // Convert to object before spreading
          };
        } catch (err) {
          const fallbackError = err as Error;
          logger.error('Fallback verification failed:', fallbackError.message);
          return null;
        }
      }
    }
    
    // If all verification methods have failed
    return null;
  } catch (err) {
    const error = err as Error;
    logger.error('Token verification failed:', error.message);
    return null;
  }
};

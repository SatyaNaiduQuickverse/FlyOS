import axios from 'axios';
import { logger } from './logger';

// Verify token with your authentication service
export const verifyToken = async (token: string) => {
  try {
    // Replace with your actual auth service endpoint
    const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:4000';
    
    const response = await axios.get(`${authServiceUrl}/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (response.data.valid) {
      return response.data.user;
    }
    
    return null;
  } catch (error) {
    logger.error('Token verification failed:', error);
    return null;
  }
};

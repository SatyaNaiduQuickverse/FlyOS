// services/auth/src/middleware/auth.js
const jwt = require('jsonwebtoken');

// Get JWT secret from environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'development_secret_key';

/**
 * Authentication middleware
 * Verifies JWT token and adds user data to request object
 */
const authMiddleware = (req, res, next) => {
  try {
    // Get token from Authorization header OR from cookie
    const tokenFromHeader = req.headers.authorization?.split(' ')[1];
    const tokenFromCookie = req.cookies?.access_token;
    const token = tokenFromHeader || tokenFromCookie;
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access denied. No token provided.' 
      });
    }
    
    // Verify token - use try/catch to handle expired tokens gracefully
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Add user data to request
      req.user = decoded;
      next();
    } catch (tokenError) {
      // Check if token is expired but otherwise valid
      if (tokenError.name === 'TokenExpiredError') {
        // Don't immediately reject - let the request continue
        // The token refresh logic in the main request handler will handle this
        req.tokenExpired = true;
        req.expiredToken = token;
        
        try {
          // Decode without verification to get user info
          const decoded = jwt.decode(token);
          req.user = { ...decoded, tokenExpired: true };
          next();
        } catch (decodeError) {
          return res.status(401).json({
            success: false,
            message: 'Invalid token format. Authentication failed.'
          });
        }
      } else {
        // Token is invalid for other reasons
        return res.status(401).json({
          success: false,
          message: 'Invalid token. Authentication failed.'
        });
      }
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during authentication.'
    });
  }
};

module.exports = authMiddleware;

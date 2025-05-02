// services/auth/src/index.js
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { sequelize, User, LoginHistory } = require('./models');
const authMiddleware = require('./middleware/auth');
const { checkRole, checkRegion } = require('./middleware/rbac');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 4000;

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'development_secret_key';
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '1h';
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';
const COOKIE_SECURE = process.env.NODE_ENV === 'production';

// Configure middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || ['http://frontend:3000', 'http://localhost:3001'],
  credentials: true // Important for cookies
}));
app.use(express.json());
app.use(cookieParser());

// Health check endpoint
app.get('/', (req, res) => {
  res.send('Auth Service is running');
});

/**
 * Login endpoint
 * Authenticates user and issues JWT tokens
 */
app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log(`Login attempt for user: ${username}`);
    
    // Find user by username - need to use scope to include password
    const user = await User.scope('withPassword').findOne({ where: { username } });
    
    if (!user || !user.active) {
      // Record failed login attempt
      await LoginHistory.recordLogin(
        { username }, 
        req, 
        'FAILED', 
        user ? 'Account disabled' : 'User not found'
      );
      
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }
    
    // Validate password
    const isValidPassword = await user.validatePassword(password);
    
    if (!isValidPassword) {
      // Record failed login attempt
      await LoginHistory.recordLogin(
        { id: user.id, username }, 
        req, 
        'FAILED', 
        'Invalid password'
      );
      
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }
    
    // Create JWT payload
    const payload = {
      id: user.id,
      username: user.username,
      role: user.role,
      regionId: user.regionId || undefined,
      tokenVersion: user.tokenVersion
    };
    
    // Generate tokens
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const refreshToken = jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
    
    // Record successful login
    const loginRecord = await LoginHistory.recordLogin(
      { id: user.id, username: user.username },
      req
    );
    
    // Update user's last login timestamp
    user.lastLogin = new Date();
    await user.save();
    
    // Set tokens in HTTP-only cookies
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: 'strict',
      maxAge: 60 * 60 * 1000 // 1 hour in milliseconds
    });
    
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
    });
    
    // Store session ID in a regular cookie for logout tracking
    res.cookie('session_id', loginRecord.id, {
      httpOnly: false, // Accessible to JavaScript for logout
      secure: COOKIE_SECURE,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    // Sanitize user object (remove password)
    const userResponse = User.sanitizeUser(user);
    
    console.log(`User authenticated successfully: ${username}`);
    
    // Send response
    res.status(200).json({
      success: true,
      message: 'Authentication successful',
      token: accessToken, // Still include for backward compatibility
      refreshToken, // Include refresh token in response
      user: userResponse,
      sessionId: loginRecord.id
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

/**
 * Token refresh endpoint
 * Issues new access token using refresh token
 */
app.post('/auth/refresh', async (req, res) => {
  try {
    // Get refresh token from cookie
    const refreshToken = req.cookies.refresh_token;
    
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token required'
      });
    }
    
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    
    // Get user from database
    const user = await User.findByPk(decoded.id);
    
    if (!user || !user.active) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }
    
    // Check if token version matches (for token revocation)
    if (decoded.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({
        success: false,
        message: 'Token has been revoked'
      });
    }
    
    // Create payload for new tokens
    const payload = {
      id: user.id,
      username: user.username,
      role: user.role,
      regionId: user.regionId || undefined,
      tokenVersion: user.tokenVersion
    };
    
    // Generate new tokens
    const newAccessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const newRefreshToken = jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
    
    // Set new tokens in cookies
    res.cookie('access_token', newAccessToken, {
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: 'strict',
      maxAge: 60 * 60 * 1000 // 1 hour
    });
    
    res.cookie('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      token: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    
    // Clear cookies on error
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    
    return res.status(401).json({
      success: false,
      message: 'Invalid refresh token'
    });
  }
});

/**
 * Logout endpoint
 * Clears authentication cookies and records logout time
 */
app.post('/auth/logout', async (req, res) => {
  try {
    // Get session ID from cookie
    const sessionId = req.cookies.session_id;
    
    // Record logout if session ID exists
    if (sessionId) {
      await LoginHistory.recordLogout(sessionId);
    }
    
    // Clear authentication cookies
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    res.clearCookie('session_id');
    
    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during logout'
    });
  }
});

/**
 * Verify token endpoint
 * Checks if the current token is valid
 */
app.get('/auth/verify', authMiddleware, async (req, res) => {
  try {
    // Token is already verified by middleware
    // Get user from database for fresh data
    const user = await User.findByPk(req.user.id);
    
    if (!user || !user.active) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found or deactivated' 
      });
    }
    
    // Check if user's token version matches (for token revocation)
    if (req.user.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({
        success: false,
        message: 'Token has been revoked'
      });
    }
    
    // Return user data
    res.status(200).json({
      success: true,
      user: User.sanitizeUser(user)
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

/**
 * Get login history for a user
 * Protected by authentication and role check
 */
app.get('/auth/login-history', authMiddleware, async (req, res) => {
  try {
    // Get query parameters
    const { userId } = req.query;
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;
    
    // Build query options
    const queryOptions = {
      order: [['loginTime', 'DESC']],
      limit,
      offset
    };
    
    // If userId is specified and user has permission
    if (userId) {
      // Only Main HQ or Regional HQ for their operators can view others' history
      if (req.user.role === 'MAIN_HQ' || 
         (req.user.role === 'REGIONAL_HQ' && await isOperatorInRegion(userId, req.user.regionId))) {
        queryOptions.where = { userId };
      } else {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to view this user\'s login history'
        });
      }
    } else {
      // View own login history
      queryOptions.where = { userId: req.user.id };
    }
    
    // Get login history with pagination
    const { count, rows } = await LoginHistory.findAndCountAll(queryOptions);
    
    res.status(200).json({
      success: true,
      totalCount: count,
      pages: Math.ceil(count / limit),
      currentPage: page,
      loginHistory: rows
    });
  } catch (error) {
    console.error('Login history error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving login history'
    });
  }
});

/**
 * Utility function to check if an operator belongs to a region
 */
async function isOperatorInRegion(operatorId, regionId) {
  const operator = await User.findByPk(operatorId);
  return operator && operator.role === 'OPERATOR' && operator.regionId === regionId;
}

/**
 * Initialize database
 */
async function initializeDb() {
  try {
    console.log('Connecting to PostgreSQL database...');
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
    
    console.log('Syncing database models...');
    await sequelize.sync({ force: process.env.FORCE_DB_SYNC === 'true' });
    console.log('Database models synchronized.');
    
    // Check for existing users
    console.log('Checking for existing users...');
    const count = await User.count();
    console.log(`Found ${count} existing users.`);
    
    if (count === 0) {
      console.log('No users found. Seeding initial data...');
      await seedUsers();
    }
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

/**
 * Seed initial users for development
 */
async function seedUsers() {
  try {
    const defaultPassword = 'password';
    
    const initialUsers = [
      {
        username: 'main_admin',
        password: defaultPassword,
        role: 'MAIN_HQ',
        fullName: 'Main HQ Administrator',
        email: 'main@flyos.mil'
      },
      {
        username: 'region_east',
        password: defaultPassword,
        role: 'REGIONAL_HQ',
        regionId: 'east',
        fullName: 'Eastern Region Commander',
        email: 'east@flyos.mil'
      },
      {
        username: 'operator1',
        password: defaultPassword,
        role: 'OPERATOR',
        regionId: 'east',
        fullName: 'Field Operator Alpha',
        email: 'op1@flyos.mil'
      }
    ];
    
    console.log('Creating initial users...');
    await User.bulkCreate(initialUsers);
    console.log('Initial users created successfully');
  } catch (error) {
    console.error('Error seeding users:', error);
    throw error;
  }
}

// Start server and initialize database
initializeDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Auth service listening on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize server:', err);
    process.exit(1);
  });

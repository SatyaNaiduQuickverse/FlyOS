// services/auth/src/index.js
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Sequelize, DataTypes } = require('sequelize');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'development_secret_key';
const JWT_EXPIRATION = '24h';

// Configure middleware
app.use(cors());
app.use(express.json());

// Database connection
const sequelize = new Sequelize(
  process.env.POSTGRES_DB || 'flyos_db',
  process.env.POSTGRES_USER || 'flyos_admin',
  process.env.POSTGRES_PASSWORD || 'secure_password',
  {
    host: process.env.POSTGRES_HOST || 'postgres',
    dialect: 'postgres',
    logging: console.log, // Set to console.log to see SQL queries
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

// Define User model
const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('MAIN_HQ', 'REGIONAL_HQ', 'OPERATOR'),
    allowNull: false
  },
  regionId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  fullName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  }
});

// Initialize database
async function initializeDb() {
  try {
    console.log('Connecting to PostgreSQL database...');
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
    
    console.log('Syncing database models...');
    await sequelize.sync({ force: true }); // Use force:true for development
    console.log('Database models synchronized.');
    
    // Seed initial users
    console.log('Checking for existing users...');
    const count = await User.count();
    console.log(`Found ${count} existing users.`);
    
    if (count === 0) {
      console.log('No users found. Seeding initial data...');
      await seedUsers();
    }
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// Seed initial users for development
async function seedUsers() {
  try {
    const saltRounds = 10;
    const defaultPassword = await bcrypt.hash('password', saltRounds);
    
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
  }
}

// Health check endpoint
app.get('/', (req, res) => {
  res.send('Auth Service is running');
});

// Login endpoint
app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log(`Login attempt for user: ${username}`);
    
    // Find user by username
    const user = await User.findOne({ where: { username } });
    
    if (!user) {
      console.log(`User not found: ${username}`);
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }
    
    // Validate password
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      console.log(`Invalid password for user: ${username}`);
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
      regionId: user.regionId || undefined
    };
    
    // Generate JWT token
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
    
    console.log(`User authenticated successfully: ${username}`);
    
    // Remove password from user object
    const userResponse = {
      id: user.id,
      username: user.username,
      role: user.role,
      regionId: user.regionId,
      fullName: user.fullName,
      email: user.email
    };
    
    // Send response
    res.status(200).json({
      success: true,
      message: 'Authentication successful',
      token,
      user: userResponse
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Verify token endpoint
app.get('/auth/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'No token provided' 
      });
    }
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Get updated user information
    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password'] }
    });
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ 
      success: false, 
      message: 'Invalid token' 
    });
  }
});

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
  });

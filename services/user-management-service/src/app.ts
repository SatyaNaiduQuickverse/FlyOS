// src/app.ts - Enhanced with startup sync
import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { initDatabase } from './database';
import { logger } from './utils/logger';
import { initializeWithSupabaseSync } from './services/supabaseDataSync';

// Import routes
import userRoutes from './routes/users';
import regionRoutes from './routes/regions';
import droneRoutes from './routes/drones';

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 4003;

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.method !== 'GET' ? req.body : undefined
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'user-management-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/regions', regionRoutes);
app.use('/api/drones', droneRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server with enhanced initialization
const startServer = async () => {
  try {
    logger.info('🚀 Starting User Management Service...');
    
    // Step 1: Initialize database connection
    logger.info('📊 Connecting to database...');
    await initDatabase();
    
    // Step 2: Initialize with Supabase sync (load or create data)
    logger.info('🔄 Initializing with Supabase sync...');
    const syncResult = await initializeWithSupabaseSync();
    
    logger.info('✅ Sync initialization complete:', syncResult);
    
    // Step 3: Start the server
    app.listen(PORT, () => {
      logger.info(`🚀 User Management Service running on port ${PORT}`);
      logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🔗 CORS Origin: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
      logger.info(`🎯 Data loaded: ${syncResult.users} users, ${syncResult.regions} regions, ${syncResult.drones} drones`);
    });
    
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
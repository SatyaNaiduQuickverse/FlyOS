// services/realtime-service/src/app.ts
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { Server } from 'socket.io';
import { initRedis } from './redis';
import { setupWebSocketServer } from './websocket';
import { logger } from './utils/logger';

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 4002;

// Create HTTP server
const server = http.createServer(app);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Start server
const startServer = async () => {
  try {
    // Initialize Redis
    await initRedis();
    
    // Setup Socket.IO server
    const io = new Server(server, {
      cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST'],
        credentials: true
      }
    });
    
    // Setup WebSocket handlers
    setupWebSocketServer(io);
    
    server.listen(PORT, () => {
      logger.info(`Real-time service running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      
      // Log configuration for debugging
      logger.info(`Testing mode: ${process.env.TESTING_MODE === 'true' ? 'Enabled' : 'Disabled'}`);
      logger.info(`Auth service URL: ${process.env.AUTH_SERVICE_URL || 'http://localhost:4000'}`);
      logger.info(`Fallback verification: ${process.env.ALLOW_FALLBACK_VERIFICATION === 'true' ? 'Enabled' : 'Disabled'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

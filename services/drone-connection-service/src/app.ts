// services/drone-connection-service/src/app.ts
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { Server } from 'socket.io';
import { setupDroneHandler } from './droneHandler';
import { initRedis } from './redis';
import { logger } from './utils/logger';

// Global type declaration
declare global {
  var connectedDrones: { [key: string]: any };
}

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4005;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'drone-connection-service',
    timestamp: new Date().toISOString()
  });
});

// Connected drones status endpoint
app.get('/status', (req, res) => {
  res.json({
    connectedDrones: global.connectedDrones || {},
    totalConnected: Object.keys(global.connectedDrones || {}).length
  });
});

// Redis data endpoint for specific drone
app.get('/redis/:droneId', async (req, res) => {
  try {
    const droneId = req.params.droneId;
    const { getDroneState } = await import('./redis');
    const data = await getDroneState(droneId);
    res.json(data || {});
  } catch (error) {
    res.json({});
  }
});

// Socket.IO server for drone connections
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling']
});

const startServer = async () => {
  try {
    logger.info('🚀 Starting Drone Connection Service...');
    
    // Initialize Redis connection
    await initRedis();
    logger.info('✅ Redis connected');
    
    // Setup drone connection handlers
    setupDroneHandler(io);
    logger.info('✅ Drone handlers configured');
    
    // Global connected drones registry
    global.connectedDrones = {};
    
    server.listen(PORT, () => {
      logger.info(`🎯 Drone Connection Service running on port ${PORT}`);
      logger.info(`📡 WebSocket endpoint: ws://localhost:${PORT}`);
      logger.info(`📊 Status endpoint: http://localhost:${PORT}/status`);
      logger.info(`🔴 Redis endpoint: http://localhost:${PORT}/redis/:droneId`);
    });
    
  } catch (error) {
    logger.error('❌ Failed to start drone connection service:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('🛑 Shutting down drone connection service...');
  server.close(() => {
    logger.info('✅ Service shutdown complete');
    process.exit(0);
  });
});

startServer();
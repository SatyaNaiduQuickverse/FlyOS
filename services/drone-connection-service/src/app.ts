// services/drone-connection-service/src/app.ts - UPDATED WITH MISSION HANDLER
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { Server } from 'socket.io';
import { setupDroneHandler } from './droneHandler';
import { setupCommandHandler } from './commandHandler';
import { setupMissionHandler } from './missionHandler';
import { initRedis } from './redis';
import { logger } from './utils/logger';
import { cleanupOldMissions } from './missionStorage';

// Global type declaration
declare global {
  var connectedDrones: { [key: string]: any };
}

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4005;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  methods: ["GET", "POST"],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'drone-connection-service',
    timestamp: new Date().toISOString(),
    connectedDrones: Object.keys(global.connectedDrones || {}).length,
    features: ['telemetry', 'commands', 'waypoint-missions']
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
    
    if (data) {
      res.json(data);
    } else {
      res.json({ 
        id: droneId, 
        connected: false, 
        message: 'No data available' 
      });
    }
  } catch (error) {
    logger.error(`Error getting drone state for ${req.params.droneId}:`, error);
    res.status(500).json({ 
      error: 'Failed to get drone state',
      id: req.params.droneId 
    });
  }
});

// Mission history endpoint
app.get('/missions/:droneId', async (req, res) => {
  try {
    const droneId = req.params.droneId;
    const limit = parseInt(req.query.limit as string) || 10;
    
    const { getDroneMissions } = await import('./missionStorage');
    const missions = await getDroneMissions(droneId, limit);
    
    res.json({
      success: true,
      droneId,
      missions,
      count: missions.length
    });
  } catch (error) {
    logger.error(`Error getting missions for ${req.params.droneId}:`, error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get mission history'
    });
  }
});

// Socket.IO server for drone connections
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

const startServer = async () => {
  try {
    logger.info('🚀 Starting Enhanced Drone Connection Service...');
    
    // Initialize Redis connection
    await initRedis();
    logger.info('✅ Redis connected');
    
    // Setup drone connection handlers
    setupDroneHandler(io);
    logger.info('✅ Drone handlers configured');
    
    // Setup command handler for bidirectional communication
    setupCommandHandler(io);
    logger.info('✅ Command handler configured');
    
    // Setup mission handler for waypoint missions
    setupMissionHandler(io);
    logger.info('✅ Mission handler configured');
    
    // Global connected drones registry
    global.connectedDrones = {};
    
    // Setup periodic cleanup (every hour)
    setInterval(async () => {
      try {
        await cleanupOldMissions();
      } catch (error) {
        logger.error('Periodic cleanup error:', error);
      }
    }, 60 * 60 * 1000); // 1 hour
    
    server.listen(PORT, () => {
      logger.info(`🎯 Enhanced Drone Connection Service running on port ${PORT}`);
      logger.info(`📡 WebSocket endpoint: ws://localhost:${PORT}`);
      logger.info(`📊 Status endpoint: http://localhost:${PORT}/status`);
      logger.info(`🔴 Redis endpoint: http://localhost:${PORT}/redis/:droneId`);
      logger.info(`🗺️ Mission endpoint: http://localhost:${PORT}/missions/:droneId`);
      logger.info(`🎮 Command channels: drone:*:commands`);
      logger.info(`✈️ Mission commands: upload_waypoints, start_mission, cancel_mission, clear_waypoints`);
    });
    
  } catch (error) {
    logger.error('❌ Failed to start enhanced drone connection service:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('🛑 Shutting down enhanced drone connection service...');
  server.close(() => {
    logger.info('✅ Service shutdown complete');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('🛑 Received SIGINT, shutting down gracefully...');
  server.close(() => {
    logger.info('✅ Service shutdown complete');
    process.exit(0);
  });
});

startServer();
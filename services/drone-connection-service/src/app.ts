// services/drone-connection-service/src/app.ts - UPDATED WITH REAL DRONE SUPPORT
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { Server } from 'socket.io';
import { setupDroneHandler } from './droneHandler';
import { setupCommandHandler } from './commandHandler';
import { setupMissionHandler } from './missionHandler';
import { setupCameraHandler, setupCameraAPI } from './cameraHandler';
import { setupMAVROSHandler } from './mavrosHandler';

// NEW: Import real drone handlers
import { setupRealDroneHandler } from './handlers/realDroneHandler';
import { setupWebRTCSignaling, setupWebRTCAPI } from './handlers/webrtcSignaling';
import { setupDroneRegistry } from './handlers/droneRegistry';

import { initRedis, redisClient } from './redis';
import { logger } from './utils/logger';
import { cleanupOldMissions } from './missionStorage';

// Global type declaration
declare global {
  var connectedDrones: { [key: string]: any };
}

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4005;

// Enhanced middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  methods: ["GET", "POST", "DELETE"],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Trust proxy for proper IP handling
app.set('trust proxy', true);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'drone-connection-service',
    timestamp: new Date().toISOString(),
    connectedDrones: Object.keys(global.connectedDrones || {}).length,
    features: [
      'telemetry', 
      'commands', 
      'waypoint-missions', 
      'camera-streaming',
      'webrtc-signaling',
      'mavros-logging',
      'precision-landing',
      'real-drone-support'
    ],
    environment: process.env.NODE_ENV || 'development'
  });
});

// Connected drones status endpoint
app.get('/status', (req, res) => {
  const connectedDrones = global.connectedDrones || {};
  const realDrones = Object.values(connectedDrones).filter((drone: any) => drone.droneType === 'REAL');
  const mockDrones = Object.values(connectedDrones).filter((drone: any) => drone.droneType !== 'REAL');
  
  res.json({
    connectedDrones,
    totalConnected: Object.keys(connectedDrones).length,
    realDrones: realDrones.length,
    mockDrones: mockDrones.length,
    breakdown: {
      real: realDrones.map((drone: any) => ({
        droneId: drone.droneId,
        model: drone.model,
        connectedAt: drone.connectedAt,
        connectionQuality: drone.connectionQuality,
        dataChannels: drone.dataChannels
      })),
      mock: mockDrones.map((drone: any) => ({
        droneId: drone.droneId,
        model: drone.model,
        connectedAt: drone.connectedAt
      }))
    }
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

// Precision landing buffer endpoint
app.get('/precision-landing/:droneId/buffer', async (req, res) => {
  try {
    const droneId = req.params.droneId;
    const count = parseInt(req.query.count as string) || 100;
    
    const bufferKey = `precision_landing:${droneId}:buffer`;
    const messages = await redisClient.lrange(bufferKey, 0, count - 1);
    
    const parsedMessages = messages.map(msg => {
      try {
        return JSON.parse(msg);
      } catch {
        return { 
          output: msg, 
          timestamp: new Date().toISOString(),
          type: 'info'
        };
      }
    });
    
    res.json({
      droneId,
      messages: parsedMessages,
      count: parsedMessages.length
    });
    
  } catch (error) {
    logger.error(`Error getting precision landing buffer for ${req.params.droneId}:`, error);
    res.status(500).json({ 
      error: 'Failed to get precision landing buffer',
      id: req.params.droneId 
    });
  }
});

// Precision landing session status endpoint
app.get('/precision-landing/:droneId/status', async (req, res) => {
  try {
    const droneId = req.params.droneId;
    const sessionKey = `precision_landing:${droneId}:session`;
    
    const sessionData = await redisClient.get(sessionKey);
    
    if (!sessionData) {
      return res.json({ 
        droneId,
        status: 'INACTIVE',
        message: 'No active precision landing session'
      });
    }
    
    const session = JSON.parse(sessionData);
    res.json({
      droneId,
      ...session
    });
    
  } catch (error) {
    logger.error(`Error getting precision landing status for ${req.params.droneId}:`, error);
    res.status(500).json({ 
      error: 'Failed to get precision landing status',
      id: req.params.droneId 
    });
  }
});

// MAVROS buffer endpoint
app.get('/mavros/:droneId/buffer', async (req, res) => {
  try {
    const droneId = req.params.droneId;
    const count = parseInt(req.query.count as string) || 100;
    
    const bufferKey = `mavros:${droneId}:buffer`;
    const messages = await redisClient.lrange(bufferKey, 0, count - 1);
    
    const parsedMessages = messages.map(msg => {
      try {
        return JSON.parse(msg);
      } catch {
        return { message: msg, timestamp: new Date().toISOString() };
      }
    });
    
    res.json({
      droneId,
      messages: parsedMessages,
      count: parsedMessages.length
    });
    
  } catch (error) {
    logger.error(`Error getting MAVROS buffer for ${req.params.droneId}:`, error);
    res.status(500).json({ 
      error: 'Failed to get MAVROS buffer',
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
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

const startServer = async () => {
  try {
    logger.info('🚀 Starting Enhanced Drone Connection Service with Real Drone Support...');
    
    // Initialize Redis connection
    await initRedis();
    logger.info('✅ Redis connected');
    
    // Setup drone connection handlers (existing mock support)
    setupDroneHandler(io);
    logger.info('✅ Mock drone handlers configured');
    
    // NEW: Setup real drone handlers
    setupRealDroneHandler(io);
    logger.info('✅ Real drone handlers configured');
    
    // Setup command handler for bidirectional communication
    setupCommandHandler(io);
    logger.info('✅ Command handler configured');
    
    // Setup mission handler for waypoint missions
    setupMissionHandler(io);
    logger.info('✅ Mission handler configured');
    
    // Setup camera handler for video streaming (existing)
    setupCameraHandler(io);
    logger.info('✅ Camera handler configured');
    
    // Setup camera API endpoints
    setupCameraAPI(app);
    logger.info('✅ Camera API configured');
    
    // NEW: Setup WebRTC signaling
    setupWebRTCSignaling(io);
    logger.info('✅ WebRTC signaling configured');
    
    // NEW: Setup WebRTC API endpoints
    setupWebRTCAPI(app);
    logger.info('✅ WebRTC API configured');
    
    // Setup MAVROS handler for message logging
    setupMAVROSHandler(io);
    logger.info('✅ MAVROS handler configured');
    
    // NEW: Setup drone registry endpoints
    setupDroneRegistry(app);
    logger.info('✅ Drone registry configured');
    
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
      logger.info(`🎯 Precision Landing: http://localhost:${PORT}/precision-landing/:droneId/*`);
      logger.info(`📹 WebRTC endpoints: http://localhost:${PORT}/webrtc/*`);
      logger.info(`📝 MAVROS endpoints: http://localhost:${PORT}/mavros/:droneId/*`);
      logger.info(`📋 Registry endpoints: http://localhost:${PORT}/drone/*`);
      logger.info(`🎮 Command channels: drone:*:commands`);
      logger.info(`✈️ Mission commands: upload_waypoints, start_mission, cancel_mission, clear_waypoints`);
      logger.info(`🎯 Precision commands: precision_land, abort_precision_land`);
      logger.info(`🤖 Real drone support: ENABLED`);
      logger.info(`🎬 Mock drone support: ENABLED`);
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
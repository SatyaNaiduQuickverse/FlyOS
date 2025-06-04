#!/bin/bash
# fix-typescript-errors.sh

echo "🔧 FIXING TYPESCRIPT ERRORS"
echo "=========================="

# Fix app.ts file
cat > services/drone-connection-service/src/app.ts << 'EOF'
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

// FIXED: Redis data endpoint for specific drone
app.get('/redis/:droneId', async (req, res) => {
  try {
    const { droneId } = req.params;
    const { getDroneState } = await import('./redis');
    const data = await getDroneState(droneId);
    res.json(data || {});
  } catch (error) {
    logger.error(`Error getting drone state for ${droneId}:`, error);
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
EOF

# Fix redis.ts file
cat > services/drone-connection-service/src/redis.ts << 'EOF'
// services/drone-connection-service/src/redis.ts
import Redis from 'ioredis';
import { logger } from './utils/logger';

let redisClient: Redis;

export const initRedis = async () => {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    redisClient = new Redis(redisUrl, {
      retryStrategy: (times) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3
    });
    
    await redisClient.ping();
    logger.info('✅ Redis connected for drone connection service');
    
  } catch (error) {
    logger.error('❌ Redis connection failed:', error);
    throw error;
  }
};

export const storeDroneState = async (droneId: string, data: any) => {
  try {
    const key = `drone:${droneId}:state`;
    const value = JSON.stringify({
      ...data,
      _meta: {
        updatedAt: Date.now(),
        source: 'drone-connection-service'
      }
    });
    
    await redisClient.set(key, value, 'EX', 300); // 5 minute expiry
    
    // Publish for real-time updates
    await redisClient.publish(`drone:${droneId}:updates`, value);
    
  } catch (error) {
    logger.error(`❌ Redis store failed for ${droneId}:`, error);
    throw error;
  }
};

export const getDroneState = async (droneId: string) => {
  try {
    const data = await redisClient.get(`drone:${droneId}:state`);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error(`❌ Failed to get drone state for ${droneId}:`, error);
    return null;
  }
};

export const updateDroneStatus = async (droneId: string, status: string) => {
  try {
    const key = `drone:${droneId}:status`;
    await redisClient.set(key, status, 'EX', 600); // 10 minute expiry
    
  } catch (error) {
    logger.error(`❌ Status update failed for ${droneId}:`, error);
  }
};
EOF

echo "✅ Fixed TypeScript files"

# Rebuild the drone-connection-service
echo "🔄 Rebuilding drone-connection-service..."
docker-compose build drone-connection-service

# Start the service
echo "🚀 Starting drone-connection-service..."
docker-compose up drone-connection-service -d

# Wait for it to start
sleep 10

# Test the Redis endpoint
echo "🧪 Testing Redis endpoint..."
curl -s http://localhost:4005/redis/drone-001 | jq '.latitude // "No data"'

echo "✅ TypeScript errors fixed!"

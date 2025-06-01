// services/drone-connection-service/src/droneHandler.ts
import { Server, Socket } from 'socket.io';
import { routeTelemetryData, routeCommandData } from './dataRouter';
import { logger } from './utils/logger';

interface DroneSocket extends Socket {
  droneId?: string;
  lastHeartbeat?: number;
}

export const setupDroneHandler = (io: Server) => {
  logger.info('🔧 Setting up drone connection handlers...');
  
  io.on('connection', (socket: DroneSocket) => {
    logger.info(`🔗 New connection attempt: ${socket.id}`);
    
    // Handle drone registration
    socket.on('drone_register', async (data) => {
      try {
        const { droneId, model, version } = data;
        
        if (!droneId) {
          socket.emit('registration_failed', { error: 'Drone ID required' });
          return;
        }
        
        // Set drone info on socket
        socket.droneId = droneId;
        socket.lastHeartbeat = Date.now();
        
        // Add to global registry
        global.connectedDrones[droneId] = {
          socketId: socket.id,
          droneId,
          model: model || 'Unknown',
          version: version || '1.0',
          connectedAt: new Date().toISOString(),
          lastHeartbeat: socket.lastHeartbeat,
          status: 'CONNECTED'
        };
        
        // Update drone status in databases
        await updateDroneStatus(droneId, 'CONNECTED');
        
        socket.emit('registration_success', { droneId, status: 'connected' });
        logger.info(`✅ Drone registered: ${droneId} (${socket.id})`);
        
      } catch (error) {
        logger.error('❌ Drone registration failed:', error);
        socket.emit('registration_failed', { error: 'Registration failed' });
      }
    });
    
    // Handle telemetry data
    socket.on('telemetry', async (data) => {
      try {
        if (!socket.droneId) {
          logger.warn('⚠️ Telemetry from unregistered drone');
          return;
        }
        
        // Update heartbeat
        socket.lastHeartbeat = Date.now();
        if (global.connectedDrones[socket.droneId]) {
          global.connectedDrones[socket.droneId].lastHeartbeat = socket.lastHeartbeat;
        }
        
        // Add metadata
        const enhancedData = {
          ...data,
          droneId: socket.droneId,
          timestamp: data.timestamp || new Date().toISOString(),
          receivedAt: new Date().toISOString()
        };
        
        // Route to Redis and TimescaleDB
        await routeTelemetryData(socket.droneId, enhancedData);
        
        // Send acknowledgment
        socket.emit('telemetry_ack', { 
          timestamp: enhancedData.timestamp,
          status: 'received' 
        });
        
      } catch (error) {
        logger.error(`❌ Telemetry processing failed for ${socket.droneId}:`, error);
      }
    });
    
    // Handle commands from ground control
    socket.on('command_response', async (data) => {
      try {
        if (!socket.droneId) return;
        
        // Log command response
        await routeCommandData(socket.droneId, {
          ...data,
          type: 'response',
          timestamp: new Date().toISOString()
        });
        
        logger.info(`📡 Command response from ${socket.droneId}:`, data);
        
      } catch (error) {
        logger.error(`❌ Command response failed for ${socket.droneId}:`, error);
      }
    });
    
    // Handle heartbeat
    socket.on('heartbeat', () => {
      if (socket.droneId) {
        socket.lastHeartbeat = Date.now();
        if (global.connectedDrones[socket.droneId]) {
          global.connectedDrones[socket.droneId].lastHeartbeat = socket.lastHeartbeat;
        }
        socket.emit('heartbeat_ack');
      }
    });
    
    // Handle disconnection
    socket.on('disconnect', async (reason) => {
      if (socket.droneId) {
        logger.info(`📴 Drone disconnected: ${socket.droneId} (${reason})`);
        
        // Update status
        await updateDroneStatus(socket.droneId, 'OFFLINE');
        
        // Remove from registry
        delete global.connectedDrones[socket.droneId];
      }
    });
    
    // Handle errors
    socket.on('error', (error) => {
      logger.error(`❌ Socket error for ${socket.droneId || socket.id}:`, error);
    });
  });
  
  // Heartbeat monitor - check for stale connections
  setInterval(() => {
    const now = Date.now();
    const staleThreshold = 30000; // 30 seconds
    
    Object.entries(global.connectedDrones).forEach(([droneId, drone]: [string, any]) => {
      if (now - drone.lastHeartbeat > staleThreshold) {
        logger.warn(`⚠️ Stale connection detected: ${droneId}`);
        
        // Find and disconnect the socket
        const socket = io.sockets.sockets.get(drone.socketId);
        if (socket) {
          socket.disconnect(true);
        }
        
        // Clean up registry
        delete global.connectedDrones[droneId];
        updateDroneStatus(droneId, 'OFFLINE');
      }
    });
  }, 10000); // Check every 10 seconds
};

// Helper function to update drone status in databases
const updateDroneStatus = async (droneId: string, status: string) => {
  try {
    // Update Redis with current status
    const { updateDroneStatus: redisUpdate } = await import('./redis');
    await redisUpdate(droneId, status);
    
    // TODO: Update TimescaleDB via drone-db-service API call
    // This ensures drone status is consistent across all systems
    
  } catch (error) {
    logger.error(`❌ Failed to update status for ${droneId}:`, error);
  }
};

// Export function to send commands to specific drone
export const sendCommandToDrone = (io: Server, droneId: string, command: any) => {
  const drone = global.connectedDrones[droneId];
  if (!drone) {
    throw new Error(`Drone ${droneId} not connected`);
  }
  
  const socket = io.sockets.sockets.get(drone.socketId);
  if (!socket) {
    throw new Error(`Socket not found for drone ${droneId}`);
  }
  
  socket.emit('command', command);
  logger.info(`📡 Command sent to ${droneId}:`, command);
  
  return true;
};
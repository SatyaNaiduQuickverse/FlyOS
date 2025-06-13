// services/drone-connection-service/src/commandHandler.ts - EXTENDED WITH PRECISION LANDING
import { Server } from 'socket.io';
import { redisClient } from './redis';
import { logger } from './utils/logger';

export const setupCommandHandler = (io: Server) => {
  logger.info('🎮 Setting up command handler...');
  
  // Create Redis subscriber for command channels
  const subscriber = redisClient.duplicate();
  
  // Subscribe to all drone command channels
  subscriber.psubscribe('drone:*:commands');
  
  subscriber.on('psubscribe', (pattern: string, count: number) => {
    logger.info(`📡 Subscribed to pattern: ${pattern} (total subscriptions: ${count})`);
  });

  // Handle incoming commands from Redis
  subscriber.on('pmessage', async (pattern: string, channel: string, message: string) => {
    try {
      // Extract droneId from channel: drone:drone-001:commands
      const droneId = channel.split(':')[1];
      const command = JSON.parse(message);
      
      logger.info(`📨 Command received for ${droneId}:`, {
        commandType: command.commandType,
        commandId: command.id,
        userId: command.userId
      });
      
      // Handle precision landing commands specially
      if (command.commandType === 'precision_land') {
        await handlePrecisionLandCommand(io, droneId, command, 'start');
        return;
      }
      
      if (command.commandType === 'abort_precision_land') {
        await handlePrecisionLandCommand(io, droneId, command, 'abort');
        return;
      }
      
      // Handle all other commands with existing logic
      const droneConnection = global.connectedDrones[droneId];
      
      if (!droneConnection) {
        logger.warn(`⚠️ Drone ${droneId} not connected, command ignored`);
        
        // Publish command failure back to Redis
        await redisClient.publish(
          `drone:${droneId}:command_responses`,
          JSON.stringify({
            commandId: command.id,
            success: false,
            error: 'Drone not connected',
            timestamp: new Date().toISOString()
          })
        );
        return;
      }
      
      // Find the actual WebSocket connection
      const socket = io.sockets.sockets.get(droneConnection.socketId);
      
      if (!socket) {
        logger.warn(`⚠️ Socket not found for drone ${droneId}`);
        return;
      }
      
      // Send command to specific drone via WebSocket
      socket.emit('command', {
        id: command.id || Date.now(),
        type: command.commandType,
        parameters: command.parameters || {},
        timestamp: command.timestamp,
        userId: command.userId
      });
      
      logger.info(`✅ Command forwarded to drone ${droneId}: ${command.commandType}`);
      
      // Update drone's last command time
      if (global.connectedDrones[droneId]) {
        global.connectedDrones[droneId].lastCommandTime = Date.now();
      }
      
    } catch (error) {
      logger.error('❌ Error processing command from Redis:', error);
    }
  });

  // Handle Redis connection errors
  subscriber.on('error', (err: Error) => {
    logger.error('❌ Redis subscriber error:', err);
  });

  subscriber.on('connect', () => {
    logger.info('🔗 Command subscriber connected to Redis');
  });

  subscriber.on('ready', () => {
    logger.info('✅ Command subscriber ready');
  });

  // Return cleanup function
  return () => {
    subscriber.punsubscribe('drone:*:commands');
    subscriber.quit();
    logger.info('🧹 Command handler cleaned up');
  };
};

// Handle precision landing commands
const handlePrecisionLandCommand = async (
  io: Server, 
  droneId: string, 
  command: any, 
  action: 'start' | 'abort'
) => {
  try {
    logger.info(`🎯 Precision landing ${action} command for ${droneId}`);
    
    const droneConnection = global.connectedDrones[droneId];
    if (!droneConnection) {
      await publishCommandResponse(droneId, command.id, false, 'Drone not connected');
      return;
    }
    
    const socket = io.sockets.sockets.get(droneConnection.socketId);
    if (!socket) {
      await publishCommandResponse(droneId, command.id, false, 'Socket not found');
      return;
    }
    
    // Send precision landing command to drone
    socket.emit('precision_landing_command', {
      id: command.id,
      action: action,
      parameters: command.parameters || {},
      timestamp: new Date().toISOString(),
      userId: command.userId
    });
    
    // Store session info in Redis for start command
    if (action === 'start') {
      await redisClient.setex(
        `precision_landing:${droneId}:session`,
        1800, // 30 minutes
        JSON.stringify({
          sessionId: command.id,
          droneId: droneId,
          startedAt: new Date().toISOString(),
          status: 'ACTIVE',
          userId: command.userId,
          parameters: command.parameters || {}
        })
      );
      
      // Clear any existing output buffer
      await redisClient.del(`precision_landing:${droneId}:buffer`);
    }
    
    logger.info(`✅ Precision landing ${action} command sent to ${droneId}`);
    await publishCommandResponse(
      droneId, 
      command.id, 
      true, 
      `Precision landing ${action} command sent successfully`
    );
    
  } catch (error) {
    logger.error(`❌ Error executing precision landing ${action} for ${droneId}:`, error);
    await publishCommandResponse(
      droneId, 
      command.id, 
      false, 
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
};

// Helper function to publish command responses
const publishCommandResponse = async (
  droneId: string, 
  commandId: any, 
  success: boolean, 
  message: string
) => {
  try {
    await redisClient.publish(
      `drone:${droneId}:command_responses`,
      JSON.stringify({
        commandId,
        success,
        message,
        timestamp: new Date().toISOString()
      })
    );
  } catch (error) {
    logger.error(`Failed to publish command response for ${droneId}:`, error);
  }
};
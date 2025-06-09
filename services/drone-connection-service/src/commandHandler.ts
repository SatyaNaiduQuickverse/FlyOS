// services/drone-connection-service/src/commandHandler.ts - FIXED TYPESCRIPT ERRORS
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
      
      // Find the drone's socket connection
      const droneConnection = global.connectedDrones[droneId];
      
      if (!droneConnection) {
        logger.warn(`⚠️ Drone ${droneId} not connected, command ignored`);
        
        // Optionally publish command failure back to Redis
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
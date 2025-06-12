// services/drone-connection-service/src/mavrosHandler.ts
import { Server, Socket } from 'socket.io';
import { redisClient } from './redis';
import { logger } from './utils/logger';
import { v4 as uuidv4 } from 'uuid';

// Extend Socket interface to include droneId and MAVROS session
interface DroneSocket extends Socket {
  droneId?: string;
  mavrosSessionId?: string;
  lastHeartbeat?: number;
}

interface MAVROSMessage {
  droneId: string;
  timestamp: string;
  message: string;
  messageType: 'INFO' | 'WARN' | 'ERROR' | 'OTHER';
  rawMessage: string;
  source: string;
  severityLevel: number;
  sessionId: string;
  parsedData?: any;
}

interface MAVROSSession {
  sessionId: string;
  droneId: string;
  startedAt: string;
  status: 'ACTIVE' | 'DISCONNECTED' | 'ERROR';
  connectionInfo: any;
  messageCount: number;
  errorCount: number;
}

// Global registry for MAVROS sessions
const mavrosSessions = new Map<string, MAVROSSession>();

export const setupMAVROSHandler = (io: Server) => {
  logger.info('🎯 Setting up MAVROS message handler...');

  io.on('connection', (socket: DroneSocket) => {
    
    // Handle MAVROS session start
    socket.on('mavros_session_start', async (data: { droneId: string; connectionInfo?: any }) => {
      try {
        const { droneId, connectionInfo } = data;
        
        if (!socket.droneId || socket.droneId !== droneId) {
          logger.warn(`⚠️ MAVROS session start from unregistered drone: ${droneId}`);
          return;
        }

        // Create new session
        const sessionId = uuidv4();
        const session: MAVROSSession = {
          sessionId,
          droneId,
          startedAt: new Date().toISOString(),
          status: 'ACTIVE',
          connectionInfo: connectionInfo || {},
          messageCount: 0,
          errorCount: 0
        };

        // Store session
        mavrosSessions.set(sessionId, session);
        socket.mavrosSessionId = sessionId;

        // Store in Redis for persistence
        await redisClient.setex(
          `mavros:session:${sessionId}`,
          3600, // 1 hour expiry
          JSON.stringify(session)
        );

        // Publish session start event
        await redisClient.publish(
          `mavros:${droneId}:session`,
          JSON.stringify({
            action: 'session_start',
            sessionId,
            droneId,
            timestamp: new Date().toISOString()
          })
        );

        socket.emit('mavros_session_ack', { sessionId, status: 'started' });
        logger.info(`📡 MAVROS session started: ${droneId} -> ${sessionId}`);

      } catch (error) {
        logger.error('❌ Error starting MAVROS session:', error);
        socket.emit('mavros_session_error', { error: 'Failed to start session' });
      }
    });

    // Handle MAVROS messages
    socket.on('mavros_message', async (data: any) => {
      try {
        const { message, rawMessage, timestamp, source, parsedData } = data;
        
        if (!socket.droneId || !socket.mavrosSessionId) {
          logger.warn('⚠️ MAVROS message from unregistered session');
          return;
        }

        // Parse message type and severity
        const messageType = parseMessageType(message);
        const severityLevel = parseSeverityLevel(message);

        // Create standardized MAVROS message
        const mavrosMessage: MAVROSMessage = {
          droneId: socket.droneId,
          timestamp: timestamp || new Date().toISOString(),
          message: sanitizeMessage(message),
          messageType,
          rawMessage: rawMessage || message,
          source: source || 'mavros',
          severityLevel,
          sessionId: socket.mavrosSessionId,
          parsedData: parsedData || extractStructuredData(message)
        };

        // Update session statistics
        const session = mavrosSessions.get(socket.mavrosSessionId);
        if (session) {
          session.messageCount++;
          if (severityLevel >= 2) session.errorCount++;
          mavrosSessions.set(socket.mavrosSessionId, session);
        }

        // Store latest message in Redis with short expiry for real-time access
        await redisClient.setex(
          `mavros:${socket.droneId}:latest`,
          60, // 1 minute expiry
          JSON.stringify(mavrosMessage)
        );

        // Publish message for real-time subscribers
        await redisClient.publish(
          `mavros:${socket.droneId}:output`,
          JSON.stringify(mavrosMessage)
        );

        // Store in Redis list for recent message buffer (keep last 1000)
        const listKey = `mavros:${socket.droneId}:buffer`;
        await redisClient.lpush(listKey, JSON.stringify(mavrosMessage));
        await redisClient.ltrim(listKey, 0, 999); // Keep only last 1000 messages
        await redisClient.expire(listKey, 3600); // 1 hour expiry

        logger.debug(`📨 MAVROS message processed: ${socket.droneId} [${messageType}]`);

        // Send acknowledgment
        socket.emit('mavros_message_ack', { 
          timestamp: mavrosMessage.timestamp,
          status: 'received',
          messageType
        });

      } catch (error) {
        logger.error(`❌ MAVROS message processing failed for ${socket.droneId}:`, error);
        socket.emit('mavros_message_error', { error: 'Message processing failed' });
      }
    });

    // Handle MAVROS session end
    socket.on('mavros_session_end', async (data: { reason?: string }) => {
      await handleMAVROSSessionEnd(socket, data?.reason || 'manual');
    });

    // Handle disconnect - automatically end MAVROS session
    socket.on('disconnect', async (reason: string) => {
      await handleMAVROSSessionEnd(socket, `disconnect: ${reason}`);
    });

    // Handle MAVROS heartbeat
    socket.on('mavros_heartbeat', async () => {
      if (socket.mavrosSessionId) {
        await redisClient.setex(
          `mavros:heartbeat:${socket.mavrosSessionId}`,
          30, // 30 second expiry
          new Date().toISOString()
        );
        socket.emit('mavros_heartbeat_ack');
      }
    });
  });

  // Cleanup stale sessions every 5 minutes
  setInterval(async () => {
    await cleanupStaleSessions();
  }, 5 * 60 * 1000);

  logger.info('✅ MAVROS handler configured successfully');
};

/**
 * Handle MAVROS session end
 */
const handleMAVROSSessionEnd = async (socket: DroneSocket, reason: string) => {
  if (!socket.mavrosSessionId) return;

  try {
    const session = mavrosSessions.get(socket.mavrosSessionId);
    if (session) {
      session.status = reason.includes('error') ? 'ERROR' : 'DISCONNECTED';
      
      // Update Redis
      await redisClient.setex(
        `mavros:session:${socket.mavrosSessionId}`,
        3600,
        JSON.stringify({
          ...session,
          endedAt: new Date().toISOString(),
          disconnectReason: reason
        })
      );

      // Publish session end event
      if (socket.droneId) {
        await redisClient.publish(
          `mavros:${socket.droneId}:session`,
          JSON.stringify({
            action: 'session_end',
            sessionId: socket.mavrosSessionId,
            droneId: socket.droneId,
            reason,
            messageCount: session.messageCount,
            errorCount: session.errorCount,
            timestamp: new Date().toISOString()
          })
        );
      }

      mavrosSessions.delete(socket.mavrosSessionId);
      logger.info(`📡 MAVROS session ended: ${socket.mavrosSessionId} (${reason})`);
    }

    socket.mavrosSessionId = undefined;

  } catch (error) {
    logger.error('❌ Error ending MAVROS session:', error);
  }
};

/**
 * Parse message type from MAVROS message content
 */
const parseMessageType = (message: string): 'INFO' | 'WARN' | 'ERROR' | 'OTHER' => {
  const upperMessage = message.toUpperCase();
  
  if (upperMessage.includes('[ERROR]') || upperMessage.includes('ERROR:')) {
    return 'ERROR';
  } else if (upperMessage.includes('[WARN]') || upperMessage.includes('WARNING:')) {
    return 'WARN';
  } else if (upperMessage.includes('[INFO]') || upperMessage.includes('INFO:')) {
    return 'INFO';
  } else {
    return 'OTHER';
  }
};

/**
 * Parse severity level from message content
 */
const parseSeverityLevel = (message: string): number => {
  const upperMessage = message.toUpperCase();
  
  if (upperMessage.includes('CRITICAL') || upperMessage.includes('FATAL')) {
    return 3; // Critical
  } else if (upperMessage.includes('ERROR')) {
    return 2; // Error
  } else if (upperMessage.includes('WARN')) {
    return 1; // Warning
  } else {
    return 0; // Info
  }
};

/**
 * Sanitize message content for safe storage and display
 */
const sanitizeMessage = (message: string): string => {
  // Remove potential HTML/script content
  return message
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '[SCRIPT_REMOVED]')
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .trim()
    .substring(0, 2000); // Limit length
};

/**
 * Extract structured data from message content
 */
const extractStructuredData = (message: string): any => {
  try {
    const data: any = {};
    
    // Extract timestamp if present
    const timestampMatch = message.match(/(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2})/);
    if (timestampMatch) {
      data.extractedTimestamp = timestampMatch[1];
    }
    
    // Extract numeric values
    const numericMatches = message.match(/(\w+):\s*([+-]?\d*\.?\d+)/g);
    if (numericMatches) {
      numericMatches.forEach(match => {
        const [key, value] = match.split(':');
        data[key.trim()] = parseFloat(value.trim());
      });
    }
    
    // Extract status indicators
    if (message.includes('connected')) data.connectionStatus = 'connected';
    if (message.includes('disconnected')) data.connectionStatus = 'disconnected';
    if (message.includes('armed')) data.armed = true;
    if (message.includes('disarmed')) data.armed = false;
    
    return Object.keys(data).length > 0 ? data : null;
    
  } catch (error) {
    return null;
  }
};

/**
 * Cleanup stale MAVROS sessions
 */
const cleanupStaleSessions = async () => {
  try {
    const now = Date.now();
    const staleThreshold = 10 * 60 * 1000; // 10 minutes
    
    for (const [sessionId, session] of mavrosSessions.entries()) {
      const sessionAge = now - new Date(session.startedAt).getTime();
      
      if (sessionAge > staleThreshold) {
        // Check for recent heartbeat
        const heartbeat = await redisClient.get(`mavros:heartbeat:${sessionId}`);
        
        if (!heartbeat) {
          logger.warn(`🧹 Cleaning up stale MAVROS session: ${sessionId}`);
          
          // Mark as disconnected in Redis
          await redisClient.setex(
            `mavros:session:${sessionId}`,
            3600,
            JSON.stringify({
              ...session,
              status: 'DISCONNECTED',
              endedAt: new Date().toISOString(),
              disconnectReason: 'timeout'
            })
          );
          
          mavrosSessions.delete(sessionId);
        }
      }
    }
    
  } catch (error) {
    logger.error('❌ Error during MAVROS session cleanup:', error);
  }
};

/**
 * Get current MAVROS session for a drone
 */
export const getCurrentMAVROSSession = (droneId: string): MAVROSSession | null => {
  for (const session of mavrosSessions.values()) {
    if (session.droneId === droneId && session.status === 'ACTIVE') {
      return session;
    }
  }
  return null;
};

/**
 * Get MAVROS statistics
 */
export const getMAVROSStats = () => {
  const activeSessions = Array.from(mavrosSessions.values()).filter(s => s.status === 'ACTIVE');
  const totalMessages = activeSessions.reduce((sum, s) => sum + s.messageCount, 0);
  const totalErrors = activeSessions.reduce((sum, s) => sum + s.errorCount, 0);
  
  return {
    activeSessions: activeSessions.length,
    totalSessions: mavrosSessions.size,
    totalMessages,
    totalErrors,
    sessionDetails: activeSessions
  };
};
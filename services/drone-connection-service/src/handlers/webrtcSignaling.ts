// services/drone-connection-service/src/handlers/webrtcSignaling.ts
import { Server, Socket } from 'socket.io';
import { redisClient } from '../redis';
import { logger } from '../utils/logger';

interface WebRTCSession {
  droneId: string;
  sessionId: string;
  offer?: any;
  answer?: any;
  iceCandidates: any[];
  status: 'negotiating' | 'connected' | 'failed' | 'closed';
  createdAt: string;
  connectedAt?: string;
  quality?: {
    bitrate: number;
    fps: number;
    latency: number;
    packetLoss: number;
  };
}

const activeSessions = new Map<string, WebRTCSession>();

export const setupWebRTCSignaling = (io: Server) => {
  logger.info('📹 Setting up WebRTC signaling server...');

  // Subscribe to WebRTC signaling events from Redis
  const setupRedisSubscription = async () => {
    try {
      const subscriber = redisClient.duplicate();
      await subscriber.psubscribe('webrtc:*:signaling');
      
      subscriber.on('pmessage', (pattern: string, channel: string, message: string) => {
        try {
          const data = JSON.parse(message);
          const droneId = channel.split(':')[1];
          
          // Forward WebRTC signaling to frontend clients
          io.emit('webrtc_signaling', {
            droneId,
            ...data
          });
          
          logger.debug(`🔄 WebRTC signaling forwarded: ${data.type} for ${droneId}`);
        } catch (error) {
          logger.error('❌ Error processing WebRTC signaling:', error);
        }
      });
      
    } catch (error) {
      logger.error('❌ WebRTC Redis subscription failed:', error);
    }
  };

  setupRedisSubscription();

  io.on('connection', (socket: Socket) => {
    
    // Frontend initiates WebRTC connection to drone
    socket.on('webrtc_create_session', async (data: { droneId: string, sessionType: 'camera' | 'data' }) => {
      try {
        const { droneId, sessionType } = data;
        const sessionId = `${droneId}_${Date.now()}`;
        
        // Check if drone is connected
        const droneConnection = global.connectedDrones[droneId];
        if (!droneConnection) {
          socket.emit('webrtc_error', { 
            error: 'Drone not connected',
            droneId,
            sessionId 
          });
          return;
        }
        
        // Create session
        const session: WebRTCSession = {
          droneId,
          sessionId,
          iceCandidates: [],
          status: 'negotiating',
          createdAt: new Date().toISOString()
        };
        
        activeSessions.set(sessionId, session);
        
        // Request offer from drone
        const droneSocket = io.sockets.sockets.get(droneConnection.socketId);
        if (droneSocket) {
          droneSocket.emit('webrtc_request_offer', {
            sessionId,
            sessionType,
            stunServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' }
            ]
          });
        }
        
        socket.emit('webrtc_session_created', { sessionId, droneId, status: 'waiting_for_offer' });
        logger.info(`📹 WebRTC session created: ${sessionId} for ${droneId}`);
        
      } catch (error) {
        logger.error('❌ WebRTC session creation failed:', error);
        socket.emit('webrtc_error', { error: 'Session creation failed' });
      }
    });

    // Frontend sends answer to drone's offer
    socket.on('webrtc_answer', async (data: { sessionId: string, answer: any }) => {
      try {
        const { sessionId, answer } = data;
        const session = activeSessions.get(sessionId);
        
        if (!session) {
          socket.emit('webrtc_error', { error: 'Session not found', sessionId });
          return;
        }
        
        session.answer = answer;
        
        // Send answer to drone
        const droneConnection = global.connectedDrones[session.droneId];
        if (droneConnection) {
          const droneSocket = io.sockets.sockets.get(droneConnection.socketId);
          if (droneSocket) {
            droneSocket.emit('webrtc_answer', {
              sessionId,
              answer
            });
          }
        }
        
        logger.info(`📹 WebRTC answer sent to drone: ${session.droneId}`);
        
      } catch (error) {
        logger.error('❌ WebRTC answer failed:', error);
        socket.emit('webrtc_error', { error: 'Answer processing failed' });
      }
    });

    // Handle ICE candidates from frontend
    socket.on('webrtc_ice_candidate', async (data: { sessionId: string, candidate: any }) => {
      try {
        const { sessionId, candidate } = data;
        const session = activeSessions.get(sessionId);
        
        if (!session) {
          socket.emit('webrtc_error', { error: 'Session not found', sessionId });
          return;
        }
        
        session.iceCandidates.push(candidate);
        
        // Forward ICE candidate to drone
        const droneConnection = global.connectedDrones[session.droneId];
        if (droneConnection) {
          const droneSocket = io.sockets.sockets.get(droneConnection.socketId);
          if (droneSocket) {
            droneSocket.emit('webrtc_ice_candidate', {
              sessionId,
              candidate
            });
          }
        }
        
        logger.debug(`🧊 ICE candidate forwarded to drone: ${session.droneId}`);
        
      } catch (error) {
        logger.error('❌ ICE candidate processing failed:', error);
      }
    });

    // Handle connection status updates
    socket.on('webrtc_connection_state', async (data: { sessionId: string, state: string, stats?: any }) => {
      try {
        const { sessionId, state, stats } = data;
        const session = activeSessions.get(sessionId);
        
        if (!session) return;
        
        session.status = state as any;
        
        if (state === 'connected') {
          session.connectedAt = new Date().toISOString();
          
          if (stats) {
            session.quality = {
              bitrate: stats.bitrate || 0,
              fps: stats.fps || 0,
              latency: stats.latency || 0,
              packetLoss: stats.packetLoss || 0
            };
          }
          
          logger.info(`📹 WebRTC connection established: ${sessionId}`);
          
          // Store connection info in Redis
          await redisClient.setex(
            `webrtc:${session.droneId}:active_session`,
            3600,
            JSON.stringify({
              sessionId,
              connectedAt: session.connectedAt,
              quality: session.quality
            })
          );
        }
        
        // Broadcast connection state to all clients
        io.emit('webrtc_connection_update', {
          droneId: session.droneId,
          sessionId,
          state,
          quality: session.quality
        });
        
      } catch (error) {
        logger.error('❌ WebRTC connection state update failed:', error);
      }
    });

    // Close WebRTC session
    socket.on('webrtc_close_session', async (data: { sessionId: string }) => {
      try {
        const { sessionId } = data;
        const session = activeSessions.get(sessionId);
        
        if (session) {
          session.status = 'closed';
          
          // Notify drone to close connection
          const droneConnection = global.connectedDrones[session.droneId];
          if (droneConnection) {
            const droneSocket = io.sockets.sockets.get(droneConnection.socketId);
            if (droneSocket) {
              droneSocket.emit('webrtc_close', { sessionId });
            }
          }
          
          // Clean up Redis
          await redisClient.del(`webrtc:${session.droneId}:active_session`);
          
          activeSessions.delete(sessionId);
          
          logger.info(`📹 WebRTC session closed: ${sessionId}`);
        }
        
      } catch (error) {
        logger.error('❌ WebRTC session close failed:', error);
      }
    });

    // Get active WebRTC sessions
    socket.on('webrtc_get_sessions', () => {
      try {
        const sessions = Array.from(activeSessions.values()).map(session => ({
          sessionId: session.sessionId,
          droneId: session.droneId,
          status: session.status,
          createdAt: session.createdAt,
          connectedAt: session.connectedAt,
          quality: session.quality
        }));
        
        socket.emit('webrtc_sessions', { sessions });
        
      } catch (error) {
        logger.error('❌ Failed to get WebRTC sessions:', error);
        socket.emit('webrtc_error', { error: 'Failed to get sessions' });
      }
    });

    // Handle WebRTC statistics reporting
    socket.on('webrtc_stats', async (data: { sessionId: string, stats: any }) => {
      try {
        const { sessionId, stats } = data;
        const session = activeSessions.get(sessionId);
        
        if (session) {
          session.quality = {
            bitrate: stats.bitrate || 0,
            fps: stats.fps || 0,
            latency: stats.latency || 0,
            packetLoss: stats.packetLoss || 0
          };
          
          // Store latest stats in Redis
          await redisClient.setex(
            `webrtc:${session.droneId}:stats`,
            60, // 1 minute
            JSON.stringify({
              sessionId,
              timestamp: new Date().toISOString(),
              ...session.quality
            })
          );
          
          // Publish stats for monitoring
          await redisClient.publish(
            `webrtc:${session.droneId}:stats_update`,
            JSON.stringify({
              sessionId,
              droneId: session.droneId,
              timestamp: new Date().toISOString(),
              ...session.quality
            })
          );
          
          logger.debug(`📊 WebRTC stats updated for ${session.droneId}: ${stats.latency}ms latency`);
        }
        
      } catch (error) {
        logger.error('❌ WebRTC stats update failed:', error);
      }
    });
  });

  // Cleanup stale sessions
  setInterval(() => {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    
    for (const [sessionId, session] of activeSessions.entries()) {
      const sessionAge = now - new Date(session.createdAt).getTime();
      
      if (sessionAge > staleThreshold && session.status !== 'connected') {
        logger.warn(`🧹 Cleaning up stale WebRTC session: ${sessionId}`);
        activeSessions.delete(sessionId);
        
        // Clean up Redis
        redisClient.del(`webrtc:${session.droneId}:active_session`).catch(() => {});
      }
    }
  }, 60000); // Check every minute

  logger.info('✅ WebRTC signaling server configured successfully');
};

// API endpoints for WebRTC management
export const setupWebRTCAPI = (app: any) => {
  // Get active WebRTC sessions
  app.get('/webrtc/sessions', async (req: any, res: any) => {
    try {
      const sessions = Array.from(activeSessions.values()).map(session => ({
        sessionId: session.sessionId,
        droneId: session.droneId,
        status: session.status,
        createdAt: session.createdAt,
        connectedAt: session.connectedAt,
        quality: session.quality
      }));
      
      res.json({ 
        success: true, 
        sessions,
        total: sessions.length 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to get sessions' 
      });
    }
  });

  // Get WebRTC capabilities for a drone
  app.get('/webrtc/:droneId/capability', async (req: any, res: any) => {
    try {
      const { droneId } = req.params;
      
      const capability = await redisClient.get(`webrtc:${droneId}:capability`);
      
      if (!capability) {
        return res.status(404).json({ 
          success: false, 
          error: 'Drone not found or WebRTC not supported' 
        });
      }
      
      res.json({ 
        success: true, 
        capability: JSON.parse(capability) 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to get capability' 
      });
    }
  });

  // Get current WebRTC stats for a drone
  app.get('/webrtc/:droneId/stats', async (req: any, res: any) => {
    try {
      const { droneId } = req.params;
      
      const stats = await redisClient.get(`webrtc:${droneId}:stats`);
      
      if (!stats) {
        return res.status(404).json({ 
          success: false, 
          error: 'No active WebRTC session' 
        });
      }
      
      res.json({ 
        success: true, 
        stats: JSON.parse(stats) 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to get stats' 
      });
    }
  });
};
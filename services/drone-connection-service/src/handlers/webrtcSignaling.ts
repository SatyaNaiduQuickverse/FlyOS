// services/drone-connection-service/src/handlers/webrtcSignaling.ts - UPDATED WITH DATA CHANNELS
import { Server, Socket } from 'socket.io';
import { redisClient } from '../redis';
import { logger } from '../utils/logger';

interface WebRTCSession {
  droneId: string;
  sessionId: string;
  offer?: any;
  answer?: any;
  iceCandidates: any[];
  dataChannels: Map<string, any>;
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
  logger.info('📹 Setting up WebRTC signaling server with data channels...');

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
    
    // Enhanced WebRTC session creation with data channel support
    socket.on('webrtc_create_session', async (data: { 
      droneId: string, 
      sessionType: 'camera' | 'data',
      dataChannels?: string[] 
    }) => {
      try {
        const { droneId, sessionType, dataChannels = ['camera_frames'] } = data;
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
        
        // Create session with data channel support
        const session: WebRTCSession = {
          droneId,
          sessionId,
          iceCandidates: [],
          dataChannels: new Map(),
          status: 'negotiating',
          createdAt: new Date().toISOString()
        };
        
        activeSessions.set(sessionId, session);
        
        // Request offer from drone with data channel specification
        const droneSocket = io.sockets.sockets.get(droneConnection.socketId);
        if (droneSocket) {
          droneSocket.emit('webrtc_request_offer', {
            sessionId,
            sessionType,
            dataChannels, // Request specific data channels
            stunServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' }
            ],
            config: {
              iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }
              ],
              dataChannelConfig: {
                ordered: false, // Allow out-of-order delivery for video
                maxRetransmits: 0 // No retransmits for real-time data
              }
            }
          });
        }
        
        socket.emit('webrtc_session_created', { sessionId, droneId, status: 'waiting_for_offer' });
        logger.info(`📹 WebRTC session created with data channels: ${sessionId} for ${droneId}`);
        
      } catch (error) {
        logger.error('❌ WebRTC session creation failed:', error);
        socket.emit('webrtc_error', { error: 'Session creation failed' });
      }
    });

    // Handle data channel creation from drone
    socket.on('webrtc_data_channel_created', async (data: { 
      sessionId: string, 
      channelLabel: string,
      channelConfig: any 
    }) => {
      try {
        const { sessionId, channelLabel, channelConfig } = data;
        const session = activeSessions.get(sessionId);
        
        if (!session) {
          socket.emit('webrtc_error', { error: 'Session not found', sessionId });
          return;
        }
        
        // Store data channel info
        session.dataChannels.set(channelLabel, {
          label: channelLabel,
          config: channelConfig,
          createdAt: new Date().toISOString()
        });
        
        logger.info(`📡 Data channel created: ${channelLabel} for session ${sessionId}`);
        
        // Notify frontend
        socket.emit('webrtc_data_channel_ready', {
          sessionId,
          droneId: session.droneId,
          channelLabel,
          config: channelConfig
        });
        
      } catch (error) {
        logger.error('❌ Data channel creation error:', error);
      }
    });

    // Handle data channel frames from drone
    socket.on('webrtc_data_frame', async (data: { 
      sessionId: string,
      channelLabel: string,
      frameData: any,
      metadata: any 
    }) => {
      try {
        const { sessionId, channelLabel, frameData, metadata } = data;
        const session = activeSessions.get(sessionId);
        
        if (!session) {
          logger.warn(`Data frame received for unknown session: ${sessionId}`);
          return;
        }
        
        // Process camera frames specifically
        if (channelLabel === 'camera_frames') {
          await processCameraDataFrame(session.droneId, frameData, metadata);
        }
        
        // Update session quality metrics
        if (metadata.stats) {
          session.quality = {
            bitrate: metadata.stats.bitrate || 0,
            fps: metadata.stats.fps || 0,
            latency: metadata.stats.latency || 0,
            packetLoss: metadata.stats.packetLoss || 0
          };
        }
        
        logger.debug(`📡 Data frame processed: ${channelLabel} for ${session.droneId}`);
        
      } catch (error) {
        logger.error('❌ Data frame processing error:', error);
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
              quality: session.quality,
              dataChannels: Array.from(session.dataChannels.keys())
            })
          );
        }
        
        // Broadcast connection state to all clients
        io.emit('webrtc_connection_update', {
          droneId: session.droneId,
          sessionId,
          state,
          quality: session.quality,
          dataChannels: Array.from(session.dataChannels.keys())
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
              dataChannels: Array.from(session.dataChannels.keys()),
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
              dataChannels: Array.from(session.dataChannels.keys()),
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

  logger.info('✅ WebRTC signaling server configured successfully with data channel support');
};

// Process camera data frames from WebRTC data channels
const processCameraDataFrame = async (droneId: string, frameData: any, metadata: any) => {
  try {
    // Extract camera info from metadata
    const camera = metadata.camera || 'front';
    const timestamp = metadata.timestamp || new Date().toISOString();
    
    // Create camera frame object compatible with existing Redis structure
    const cameraFrame = {
      droneId,
      camera,
      timestamp,
      frame: frameData, // Binary or base64 frame data
      metadata: {
        resolution: metadata.resolution || '1920x1080',
        fps: metadata.fps || 30,
        quality: metadata.quality || 85,
        frameNumber: metadata.frameNumber || 0,
        bandwidth: metadata.bandwidth || 'N/A',
        transport: 'webrtc_datachannel', // Mark as WebRTC transport
        latency: metadata.latency || 0
      },
      receivedAt: new Date().toISOString(),
      transport: 'webrtc'
    };
    
    // Store latest frame in Redis for immediate access
    const streamKey = `camera:${droneId}:${camera}:latest`;
    await redisClient.setex(streamKey, 5, JSON.stringify(cameraFrame));

    // Publish to subscribers (realtime service will pick this up)
    await redisClient.publish(`camera:${droneId}:${camera}:stream`, JSON.stringify(cameraFrame));

    logger.debug(`📸 WebRTC camera frame processed: ${droneId}:${camera} (${frameData.length} bytes)`);
    
  } catch (error) {
    logger.error('❌ Error processing WebRTC camera frame:', error);
  }
};

// API endpoints for WebRTC management - UPDATED
export const setupWebRTCAPI = (app: any) => {
  // Get active WebRTC sessions with data channel info
  app.get('/webrtc/sessions', async (req: any, res: any) => {
    try {
      const sessions = Array.from(activeSessions.values()).map(session => ({
        sessionId: session.sessionId,
        droneId: session.droneId,
        status: session.status,
        createdAt: session.createdAt,
        connectedAt: session.connectedAt,
        quality: session.quality,
        dataChannels: Array.from(session.dataChannels.keys())
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
      
      const capabilityData = JSON.parse(capability);
      
      res.json({ 
        success: true, 
        capability: {
          ...capabilityData,
          dataChannelSupport: true,
          supportedChannels: ['camera_frames', 'telemetry_backup']
        }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to get capability' 
      });
    }
  });

  // Get current WebRTC stats for a drone with data channel info
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
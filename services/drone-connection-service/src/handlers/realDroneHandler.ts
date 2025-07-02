// services/drone-connection-service/src/handlers/realDroneHandler.ts - UPDATED FOR WEBRTC
import { Server, Socket } from 'socket.io';
import { routeTelemetryData, routeCommandData, routePrecisionLandingData } from '../dataRouter';
import { logger } from '../utils/logger';
import { redisClient } from '../redis';

interface RealDroneSocket extends Socket {
  droneId?: string;
  droneType?: 'REAL' | 'MOCK';
  lastHeartbeat?: number;
  connectionQuality: number;
  webrtcPeer?: any;
  webrtcDataChannels?: Map<string, any>;
}

interface DroneRegistration {
  droneId: string;
  model: string;
  version: string;
  capabilities: string[];
  jetsonInfo: {
    ip: string;
    serialNumber: string;
    gpuMemory: number;
  };
}

export const setupRealDroneHandler = (io: Server) => {
  logger.info('🚁 Setting up REAL drone connection handlers with WebRTC support...');
  
  io.on('connection', (socket: Socket) => {
    const realSocket = socket as RealDroneSocket;
    realSocket.connectionQuality = 100;
    realSocket.webrtcDataChannels = new Map();
    
    logger.info(`🔗 New connection attempt: ${realSocket.id} from ${realSocket.handshake.address}`);
    
    // Enhanced drone registration for real drones with WebRTC capabilities
    realSocket.on('drone_register_real', async (data: DroneRegistration) => {
      try {
        const { droneId, model, version, capabilities, jetsonInfo } = data;
        
        if (!droneId || !jetsonInfo?.serialNumber) {
          realSocket.emit('registration_failed', { error: 'Missing required drone identification' });
          return;
        }
        
        // Validate drone is not already connected
        const existingDrone = global.connectedDrones[droneId];
        if (existingDrone && existingDrone.droneType === 'REAL') {
          logger.warn(`⚠️ Real drone ${droneId} already connected, disconnecting old connection`);
          const oldSocket = io.sockets.sockets.get(existingDrone.socketId);
          if (oldSocket) {
            oldSocket.disconnect(true);
          }
        }
        
        // Set drone info on socket
        realSocket.droneId = droneId;
        realSocket.droneType = 'REAL';
        realSocket.lastHeartbeat = Date.now();
        realSocket.connectionQuality = 100;
        
        // Check WebRTC capabilities
        const hasWebRTC = capabilities.includes('webrtc') || capabilities.includes('camera_webrtc');
        
        // Add to global registry with enhanced metadata
        global.connectedDrones[droneId] = {
          socketId: realSocket.id,
          droneId,
          model: model || 'Unknown',
          version: version || '1.0',
          droneType: 'REAL',
          capabilities: capabilities || [],
          jetsonInfo,
          connectedAt: new Date().toISOString(),
          lastHeartbeat: realSocket.lastHeartbeat,
          status: 'CONNECTED',
          connectionQuality: 100,
          webrtcSupported: hasWebRTC,
          dataChannels: {
            telemetry: false,
            camera: false,
            mavros: false,
            commands: true,
            webrtc: hasWebRTC
          }
        };
        
        // Update drone status in databases
        await updateRealDroneStatus(droneId, 'CONNECTED', jetsonInfo);
        
        // Initialize WebRTC signaling capability
        if (hasWebRTC) {
          await initializeWebRTCForDrone(realSocket, droneId);
        }
        
        realSocket.emit('registration_success', { 
          droneId, 
          status: 'connected',
          serverCapabilities: [
            'telemetry', 'commands', 'camera_webrtc', 
            'mavros_logging', 'precision_landing', 'mission_planning'
          ],
          webrtcSupported: hasWebRTC,
          recommendedDataRates: {
            telemetry: '10Hz',
            mavros: '1Hz',
            heartbeat: '0.1Hz',
            camera: hasWebRTC ? 'webrtc_datachannel' : 'websocket'
          }
        });
        
        logger.info(`✅ REAL drone registered: ${droneId} (${model}) from Jetson ${jetsonInfo.serialNumber} - WebRTC: ${hasWebRTC}`);
        
      } catch (error) {
        logger.error('❌ Real drone registration failed:', error);
        realSocket.emit('registration_failed', { error: 'Registration failed' });
      }
    });
    
    // Enhanced telemetry handler for real drones
    realSocket.on('telemetry_real', async (data) => {
      try {
        if (!realSocket.droneId || realSocket.droneType !== 'REAL') {
          logger.warn('⚠️ Telemetry from unregistered real drone');
          return;
        }
        
        // Update heartbeat and connection quality
        realSocket.lastHeartbeat = Date.now();
        updateConnectionQuality(realSocket, data);
        
        if (global.connectedDrones[realSocket.droneId]) {
          global.connectedDrones[realSocket.droneId].lastHeartbeat = realSocket.lastHeartbeat;
          global.connectedDrones[realSocket.droneId].connectionQuality = realSocket.connectionQuality;
          global.connectedDrones[realSocket.droneId].dataChannels.telemetry = true;
        }
        
        // Add real drone metadata
        const enhancedData = {
          ...data,
          droneId: realSocket.droneId,
          droneType: 'REAL',
          timestamp: data.timestamp || new Date().toISOString(),
          receivedAt: new Date().toISOString(),
          connectionQuality: realSocket.connectionQuality,
          jetsonTimestamp: data.jetsonTimestamp || null
        };
        
        // Route to Redis and TimescaleDB
        await routeTelemetryData(realSocket.droneId, enhancedData);
        
        // Send enhanced acknowledgment
        realSocket.emit('telemetry_ack', { 
          timestamp: enhancedData.timestamp,
          status: 'received',
          connectionQuality: realSocket.connectionQuality,
          latency: Date.now() - new Date(enhancedData.timestamp).getTime()
        });
        
      } catch (error) {
        logger.error(`❌ Real telemetry processing failed for ${realSocket.droneId}:`, error);
      }
    });

    // MAVROS message handler for real drones
    realSocket.on('mavros_real', async (data) => {
      try {
        if (!realSocket.droneId || realSocket.droneType !== 'REAL') {
          logger.warn('⚠️ MAVROS from unregistered real drone');
          return;
        }

        // Update data channel status
        if (global.connectedDrones[realSocket.droneId]) {
          global.connectedDrones[realSocket.droneId].dataChannels.mavros = true;
        }

        // Store in Redis buffer for real-time display
        const bufferKey = `mavros:${realSocket.droneId}:buffer`;
        const mavrosMessage = {
          timestamp: new Date().toISOString(),
          droneId: realSocket.droneId,
          droneType: 'REAL',
          message: data.message || String(data),
          rawMessage: data.rawMessage || data.message || String(data),
          source: data.source || 'jetson_mavros',
          messageType: parseMessageType(data.message || String(data)),
          severityLevel: parseSeverityLevel(data.message || String(data)),
          sessionId: data.sessionId || 'default',
          parsedData: data.parsedData || null
        };

        await redisClient.lpush(bufferKey, JSON.stringify(mavrosMessage));
        await redisClient.ltrim(bufferKey, 0, 499);
        await redisClient.expire(bufferKey, 3600);

        // Publish for real-time WebSocket subscribers
        await redisClient.publish(
          `mavros:${realSocket.droneId}:output`,
          JSON.stringify(mavrosMessage)
        );

        logger.debug(`📨 MAVROS message processed from real drone: ${realSocket.droneId}`);
        
      } catch (error) {
        logger.error(`❌ Error processing MAVROS from real drone ${realSocket.droneId}:`, error);
      }
    });

    // NEW: WebRTC data channel setup
    realSocket.on('webrtc_datachannel_setup', async (data: { 
      droneId: string;
      channels: { label: string; config: any }[] 
    }) => {
      try {
        if (realSocket.droneId !== data.droneId || realSocket.droneType !== 'REAL') {
          logger.warn('⚠️ WebRTC datachannel setup from invalid drone');
          return;
        }

        logger.info(`📡 WebRTC datachannel setup for real drone: ${realSocket.droneId}`);
        
        // Store datachannel configurations
        for (const channel of data.channels) {
          realSocket.webrtcDataChannels?.set(channel.label, {
            config: channel.config,
            setupAt: new Date().toISOString(),
            active: false
          });
        }

        // Update Redis with datachannel capabilities
        await redisClient.setex(
          `webrtc:${realSocket.droneId}:dataChannels`,
          300,
          JSON.stringify({
            channels: data.channels.map(c => c.label),
            setupAt: new Date().toISOString(),
            droneType: 'REAL'
          })
        );

        realSocket.emit('webrtc_datachannel_ack', { 
          status: 'setup_complete',
          channels: data.channels.map(c => c.label)
        });
        
      } catch (error) {
        logger.error(`❌ WebRTC datachannel setup failed: ${error}`);
      }
    });

    // NEW: WebRTC data channel ready
    realSocket.on('webrtc_datachannel_ready', async (data: { 
      droneId: string;
      channelLabel: string 
    }) => {
      try {
        if (realSocket.droneId !== data.droneId) return;

        const channel = realSocket.webrtcDataChannels?.get(data.channelLabel);
        if (channel) {
          channel.active = true;
          channel.readyAt = new Date().toISOString();
        }

        // Update global drone info
        if (global.connectedDrones[realSocket.droneId] && data.channelLabel === 'camera_frames') {
          global.connectedDrones[realSocket.droneId].dataChannels.camera = true;
        }

        logger.info(`📡 WebRTC datachannel ready: ${realSocket.droneId}:${data.channelLabel}`);
        
      } catch (error) {
        logger.error(`❌ WebRTC datachannel ready failed: ${error}`);
      }
    });

    // Enhanced WebRTC signaling for camera streams
    realSocket.on('webrtc_offer', async (data: { offer: any, droneId: string, dataChannels?: string[] }) => {
      try {
        if (realSocket.droneId !== data.droneId || realSocket.droneType !== 'REAL') {
          logger.warn('⚠️ WebRTC offer from invalid drone');
          return;
        }

        logger.info(`📹 WebRTC offer received from real drone: ${realSocket.droneId}`);
        
        // Store offer with datachannel info
        await redisClient.setex(
          `webrtc:${realSocket.droneId}:offer`,
          300,
          JSON.stringify({
            offer: data.offer,
            timestamp: new Date().toISOString(),
            droneType: 'REAL',
            dataChannels: data.dataChannels || ['camera_frames']
          })
        );

        // Publish to frontend subscribers
        await redisClient.publish(
          `webrtc:${realSocket.droneId}:signaling`,
          JSON.stringify({
            type: 'offer',
            droneId: realSocket.droneId,
            offer: data.offer,
            dataChannels: data.dataChannels,
            timestamp: new Date().toISOString()
          })
        );

        // Update camera capability
        if (global.connectedDrones[realSocket.droneId]) {
          global.connectedDrones[realSocket.droneId].dataChannels.camera = true;
        }

        realSocket.emit('webrtc_offer_received', { 
          status: 'forwarded_to_clients',
          dataChannels: data.dataChannels 
        });
        
      } catch (error) {
        logger.error(`❌ WebRTC offer processing failed: ${error}`);
      }
    });

    realSocket.on('webrtc_ice_candidate', async (data: { candidate: any, droneId: string }) => {
      try {
        if (realSocket.droneId !== data.droneId) return;

        // Forward ICE candidate to frontend clients
        await redisClient.publish(
          `webrtc:${realSocket.droneId}:signaling`,
          JSON.stringify({
            type: 'ice_candidate',
            droneId: realSocket.droneId,
            candidate: data.candidate,
            timestamp: new Date().toISOString()
          })
        );

        logger.debug(`🧊 ICE candidate forwarded for ${realSocket.droneId}`);
        
      } catch (error) {
        logger.error(`❌ ICE candidate processing failed: ${error}`);
      }
    });

    // Enhanced precision landing for real drones
    realSocket.on('precision_land_real', async (data) => {
      try {
        if (!realSocket.droneId || realSocket.droneType !== 'REAL') {
          logger.warn('⚠️ Precision landing data from unregistered real drone');
          return;
        }

        // Get session ID from active session
        let sessionId = 'default';
        try {
          const sessionKey = `precision_landing:${realSocket.droneId}:session`;
          const sessionData = await redisClient.get(sessionKey);
          if (sessionData) {
            const session = JSON.parse(sessionData);
            sessionId = session.sessionId;
          }
        } catch (sessionError) {
          logger.warn(`Could not get session ID for ${realSocket.droneId}, using default`);
        }

        // Store in Redis buffer for real-time display
        const bufferKey = `precision_landing:${realSocket.droneId}:buffer`;
        const outputMessage = {
          timestamp: new Date().toISOString(),
          droneId: realSocket.droneId,
          droneType: 'REAL',
          output: data.output || data.message || String(data),
          type: data.type || 'info',
          sessionId: sessionId,
          stage: data.stage,
          altitude: data.altitude,
          targetDetected: data.target_detected || data.targetDetected,
          confidence: data.confidence || data.target_confidence
        };

        await redisClient.lpush(bufferKey, JSON.stringify(outputMessage));
        await redisClient.ltrim(bufferKey, 0, 499);
        await redisClient.expire(bufferKey, 3600);

        // Publish for real-time WebSocket subscribers
        await redisClient.publish(
          `precision_land_output:${realSocket.droneId}`,
          JSON.stringify(outputMessage)
        );

        // Store in TimescaleDB for historical analysis
        await routePrecisionLandingData(realSocket.droneId, {
          sessionId: sessionId,
          message: outputMessage.output,
          stage: data.stage,
          altitude: data.altitude,
          targetDetected: data.target_detected || data.targetDetected,
          targetConfidence: data.confidence || data.target_confidence,
          lateralError: data.lateral_error || data.lateralError,
          verticalError: data.vertical_error || data.verticalError,
          batteryLevel: data.battery_level || data.batteryLevel,
          windSpeed: data.wind_speed || data.windSpeed,
          rawData: data
        });

        logger.debug(`🎯 Precision landing data processed from real drone: ${realSocket.droneId}`);
        
      } catch (error) {
        logger.error(`❌ Error processing precision landing from real drone ${realSocket.droneId}:`, error);
      }
    });
    
    // Enhanced heartbeat for real drones
    realSocket.on('heartbeat_real', (data) => {
      if (realSocket.droneId && realSocket.droneType === 'REAL') {
        realSocket.lastHeartbeat = Date.now();
        
        // Update connection quality based on heartbeat data
        if (data && typeof data === 'object') {
          updateConnectionQuality(realSocket, data);
        }
        
        if (global.connectedDrones[realSocket.droneId]) {
          global.connectedDrones[realSocket.droneId].lastHeartbeat = realSocket.lastHeartbeat;
          global.connectedDrones[realSocket.droneId].connectionQuality = realSocket.connectionQuality;
        }
        
        realSocket.emit('heartbeat_ack', {
          serverTimestamp: Date.now(),
          connectionQuality: realSocket.connectionQuality,
          recommendedDataRate: realSocket.connectionQuality > 80 ? '10Hz' : '5Hz',
          webrtcRecommended: realSocket.connectionQuality > 70
        });
      }
    });
    
    // Handle real drone disconnection
    realSocket.on('disconnect', async (reason) => {
      if (realSocket.droneId && realSocket.droneType === 'REAL') {
        logger.info(`📴 REAL drone disconnected: ${realSocket.droneId} (${reason})`);
        
        // Update status
        await updateRealDroneStatus(realSocket.droneId, 'OFFLINE');
        
        // Remove from registry
        delete global.connectedDrones[realSocket.droneId];
        
        // Clean up WebRTC resources
        await cleanupWebRTCForDrone(realSocket.droneId);
      }
    });
  });
  
  // Enhanced heartbeat monitor for real drones
  setInterval(() => {
    const now = Date.now();
    const staleThreshold = 30000; // 30 seconds
    
    Object.entries(global.connectedDrones).forEach(([droneId, drone]: [string, any]) => {
      if (drone.droneType === 'REAL' && now - drone.lastHeartbeat > staleThreshold) {
        logger.warn(`⚠️ Stale REAL drone connection detected: ${droneId}`);
        
        // Find and disconnect the socket
        const socket = io.sockets.sockets.get(drone.socketId);
        if (socket) {
          socket.disconnect(true);
        }
        
        // Clean up registry
        delete global.connectedDrones[droneId];
        updateRealDroneStatus(droneId, 'OFFLINE');
      }
    });
  }, 10000); // Check every 10 seconds

  logger.info('✅ REAL drone handlers configured with WebRTC datachannel support');
};

// Helper function to update connection quality
const updateConnectionQuality = (realSocket: RealDroneSocket, data: any) => {
  try {
    const now = Date.now();
    const timeSinceLastHeartbeat = now - (realSocket.lastHeartbeat || now);
    
    // Base quality on various factors
    let quality = 100;
    
    // Reduce quality based on heartbeat delay
    if (timeSinceLastHeartbeat > 5000) quality -= 30;
    else if (timeSinceLastHeartbeat > 2000) quality -= 15;
    
    // Factor in jetson metrics if available
    if (data.jetsonMetrics) {
      const { cpuUsage, memoryUsage, temperature } = data.jetsonMetrics;
      if (cpuUsage > 80) quality -= 10;
      if (memoryUsage > 90) quality -= 15;
      if (temperature > 70) quality -= 10;
    }
    
    // Factor in network metrics
    if (data.networkMetrics) {
      const { latency, packetLoss } = data.networkMetrics;
      if (latency > 200) quality -= 20;
      if (packetLoss > 1) quality -= 25;
    }
    
    realSocket.connectionQuality = Math.max(0, Math.min(100, quality));
  } catch (error) {
    realSocket.connectionQuality = 50; // Default to medium quality on error
  }
};

// Helper function to initialize WebRTC for drone
const initializeWebRTCForDrone = async (realSocket: RealDroneSocket, droneId: string) => {
  try {
    // Store WebRTC capability with datachannel support
    await redisClient.setex(
      `webrtc:${droneId}:capability`,
      3600,
      JSON.stringify({
        supported: true,
        droneType: 'REAL',
        codecs: ['H264', 'VP8'],
        maxBitrate: '5000kbps',
        dataChannelSupport: true,
        supportedChannels: ['camera_frames', 'telemetry_backup'],
        timestamp: new Date().toISOString()
      })
    );
    
    logger.info(`📹 WebRTC with datachannel support initialized for real drone: ${droneId}`);
  } catch (error) {
    logger.error(`❌ WebRTC initialization failed for ${droneId}:`, error);
  }
};

// Helper function to clean up WebRTC resources
const cleanupWebRTCForDrone = async (droneId: string) => {
  try {
    await Promise.all([
      redisClient.del(`webrtc:${droneId}:capability`),
      redisClient.del(`webrtc:${droneId}:offer`),
      redisClient.del(`webrtc:${droneId}:active_session`),
      redisClient.del(`webrtc:${droneId}:dataChannels`),
      redisClient.del(`webrtc:${droneId}:stats`)
    ]);
    
    logger.info(`🧹 WebRTC cleanup completed for: ${droneId}`);
  } catch (error) {
    logger.error(`❌ WebRTC cleanup failed for ${droneId}:`, error);
  }
};

// Helper function to update real drone status
const updateRealDroneStatus = async (droneId: string, status: string, jetsonInfo?: any) => {
  try {
    // Update Redis with current status
    const { updateDroneStatus } = await import('../redis');
    await updateDroneStatus(droneId, status);
    
    // Store additional real drone metadata
    if (jetsonInfo) {
      await redisClient.setex(
        `drone:${droneId}:jetson_info`,
        86400, // 24 hours
        JSON.stringify({
          ...jetsonInfo,
          lastUpdate: new Date().toISOString(),
          status
        })
      );
    }
    
  } catch (error) {
    logger.error(`❌ Failed to update status for real drone ${droneId}:`, error);
  }
};

// Helper functions for message parsing
const parseMessageType = (message: string): string => {
  const upperMessage = message.toUpperCase();
  if (upperMessage.includes('[ERROR]') || upperMessage.includes('ERROR:')) return 'ERROR';
  if (upperMessage.includes('[WARN]') || upperMessage.includes('WARNING:')) return 'WARN';
  if (upperMessage.includes('[INFO]') || upperMessage.includes('INFO:')) return 'INFO';
  return 'OTHER';
};

const parseSeverityLevel = (message: string): number => {
  const upperMessage = message.toUpperCase();
  if (upperMessage.includes('CRITICAL') || upperMessage.includes('FATAL')) return 3;
  if (upperMessage.includes('ERROR')) return 2;
  if (upperMessage.includes('WARN')) return 1;
  return 0;
};
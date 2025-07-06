// services/drone-connection-service/src/cameraHandler.ts - CONTROL ONLY (DATA VIA WEBRTC)
import { Server, Socket } from 'socket.io';
import { redisClient } from './redis';
import { logger } from './utils/logger';

// Extend Socket interface to include droneId
interface DroneSocket extends Socket {
  droneId?: string;
}

interface CameraControlCommand {
  droneId: string;
  camera: 'front' | 'bottom';
  action: 'start' | 'stop' | 'configure';
  config?: {
    resolution?: string;
    fps?: number;
    quality?: number;
    transport?: 'webrtc' | 'websocket';
  };
}

export const setupCameraHandler = (io: Server) => {
  logger.info('🎥 Setting up camera control handler (WebRTC data channels for frames)...');

  io.on('connection', (socket: DroneSocket) => {
    
    // CONTROL: Handle camera stream start (WebSocket command)
    socket.on('camera_stream_start', async (data: CameraControlCommand) => {
      try {
        const { droneId, camera, config } = data;
        
        if (!socket.droneId || socket.droneId !== droneId) {
          logger.warn(`⚠️ Camera start command from unregistered drone: ${droneId}`);
          return;
        }

        logger.info(`📹 Camera stream start command: ${droneId}:${camera}`);
        
        // Store stream control status in Redis
        const streamKey = `camera:${droneId}:${camera}:status`;
        const streamStatus = {
          status: 'starting',
          config: {
            ...config,
            preferredTransport: 'webrtc', // Force WebRTC for data
            controlTransport: 'websocket'  // Commands via WebSocket
          },
          startedAt: new Date().toISOString(),
          droneSocketId: socket.id,
          controlMethod: 'websocket'
        };

        await redisClient.setex(streamKey, 300, JSON.stringify(streamStatus));

        // Check WebRTC capability for this drone
        const webrtcCapability = await redisClient.get(`webrtc:${droneId}:capability`);
        const hasWebRTC = webrtcCapability ? JSON.parse(webrtcCapability).dataChannelSupport : false;

        if (hasWebRTC) {
          // WebRTC available - recommend data channel for frames
          logger.info(`📡 WebRTC data channels available for ${droneId}:${camera}`);
          
          // Update status to indicate WebRTC readiness
          await redisClient.setex(streamKey, 300, JSON.stringify({
            ...streamStatus,
            status: 'webrtc_ready',
            recommendedDataTransport: 'webrtc_datachannel',
            dataChannelReady: true
          }));
        } else {
          // Fallback to WebSocket for data
          logger.warn(`⚠️ WebRTC not available for ${droneId}, using WebSocket fallback`);
          
          await redisClient.setex(streamKey, 300, JSON.stringify({
            ...streamStatus,
            status: 'websocket_fallback',
            recommendedDataTransport: 'websocket',
            dataChannelReady: false
          }));
        }

        // Publish control event (NOT frame data)
        await redisClient.publish(`camera:${droneId}:${camera}:control`, JSON.stringify({
          action: 'stream_start_command',
          droneId,
          camera,
          config: streamStatus.config,
          hasWebRTC,
          timestamp: new Date().toISOString()
        }));

        // Send acknowledgment (control only)
        socket.emit('camera_stream_ack', { 
          droneId, 
          camera, 
          status: 'start_command_received',
          recommendedTransport: hasWebRTC ? 'webrtc_datachannel' : 'websocket',
          controlTransport: 'websocket',
          webrtcAvailable: hasWebRTC
        });
        
        logger.info(`✅ Camera start command processed: ${droneId}:${camera} (WebRTC: ${hasWebRTC})`);

      } catch (error) {
        logger.error('❌ Error processing camera start command:', error);
      }
    });

    // CONTROL: Handle camera stream stop (WebSocket command)
    socket.on('camera_stream_stop', async (data: { droneId: string; camera: string }) => {
      try {
        const { droneId, camera } = data;
        
        if (!socket.droneId || socket.droneId !== droneId) {
          logger.warn(`⚠️ Camera stop command from unregistered drone: ${droneId}`);
          return;
        }

        logger.info(`🛑 Camera stream stop command: ${droneId}:${camera}`);
        
        // Update stream status
        const streamKey = `camera:${droneId}:${camera}:status`;
        await redisClient.setex(streamKey, 60, JSON.stringify({
          status: 'stopped',
          stoppedAt: new Date().toISOString(),
          controlMethod: 'websocket'
        }));

        // Publish control event
        await redisClient.publish(`camera:${droneId}:${camera}:control`, JSON.stringify({
          action: 'stream_stop_command',
          droneId,
          camera,
          timestamp: new Date().toISOString()
        }));

        // Clean up any WebRTC streaming status
        await redisClient.del(`webrtc:${droneId}:camera_streaming`);

        socket.emit('camera_stream_ack', { 
          droneId, 
          camera, 
          status: 'stop_command_received',
          controlTransport: 'websocket'
        });
        
        logger.info(`✅ Camera stop command processed: ${droneId}:${camera}`);

      } catch (error) {
        logger.error('❌ Error processing camera stop command:', error);
      }
    });

    // CONTROL: Handle camera configuration (WebSocket command)
    socket.on('camera_configure', async (data: CameraControlCommand) => {
      try {
        const { droneId, camera, config } = data;
        
        if (!socket.droneId || socket.droneId !== droneId) {
          logger.warn(`⚠️ Camera configure command from unregistered drone: ${droneId}`);
          return;
        }

        logger.info(`⚙️ Camera configure command: ${droneId}:${camera}`, config);
        
        // Update camera configuration in Redis
        const configKey = `camera:${droneId}:${camera}:config`;
        await redisClient.setex(configKey, 3600, JSON.stringify({
          ...config,
          updatedAt: new Date().toISOString(),
          controlMethod: 'websocket'
        }));

        // Publish configuration change
        await redisClient.publish(`camera:${droneId}:${camera}:control`, JSON.stringify({
          action: 'configure_command',
          droneId,
          camera,
          config,
          timestamp: new Date().toISOString()
        }));

        socket.emit('camera_configure_ack', { 
          droneId, 
          camera, 
          status: 'configure_command_received',
          config,
          controlTransport: 'websocket'
        });
        
        logger.info(`✅ Camera configure command processed: ${droneId}:${camera}`);

      } catch (error) {
        logger.error('❌ Error processing camera configure command:', error);
      }
    });

    // REMOVED: All frame handling (camera_frame, webrtc_camera_frame)
    // Frame data now flows exclusively through WebRTC data channels

    // NEW: Handle WebRTC transport readiness notification
    socket.on('webrtc_transport_ready', async (data: { droneId: string; cameras: string[] }) => {
      try {
        const { droneId, cameras } = data;
        
        if (!socket.droneId || socket.droneId !== droneId) {
          logger.warn(`⚠️ WebRTC transport ready from unregistered drone: ${droneId}`);
          return;
        }

        logger.info(`📡 WebRTC transport ready notification: ${droneId}`);
        
        // Update camera capabilities to indicate WebRTC readiness
        for (const camera of cameras) {
          const capabilityKey = `camera:${droneId}:${camera}:capability`;
          await redisClient.setex(capabilityKey, 3600, JSON.stringify({
            transport: 'webrtc_datachannel',
            dataChannelReady: true,
            protocol: 'udp',
            ordered: false,
            maxRetransmits: 0,
            updatedAt: new Date().toISOString()
          }));

          // Update stream status if streaming
          const statusKey = `camera:${droneId}:${camera}:status`;
          const currentStatus = await redisClient.get(statusKey);
          
          if (currentStatus) {
            const status = JSON.parse(currentStatus);
            if (status.status === 'starting' || status.status === 'webrtc_ready') {
              status.status = 'active';
              status.dataTransport = 'webrtc_datachannel';
              status.webrtcConnected = true;
              await redisClient.setex(statusKey, 300, JSON.stringify(status));
            }
          }
        }

        // Notify subscribers about WebRTC readiness
        await redisClient.publish(`webrtc:${droneId}:transport_ready`, JSON.stringify({
          action: 'webrtc_transport_ready',
          droneId,
          cameras,
          timestamp: new Date().toISOString(),
          capabilities: {
            dataChannels: true,
            udpOptimized: true,
            lowLatency: true
          }
        }));

        socket.emit('webrtc_transport_ack', { 
          droneId, 
          status: 'ready_acknowledged', 
          cameras,
          dataChannelMode: 'udp_optimized'
        });
        
        logger.info(`✅ WebRTC transport ready for ${droneId}: cameras [${cameras.join(', ')}]`);

      } catch (error) {
        logger.error('❌ Error handling WebRTC transport ready:', error);
      }
    });

    // NEW: Handle transport switching (between WebRTC and WebSocket)
    socket.on('camera_switch_transport', async (data: { 
      droneId: string; 
      camera: string; 
      transport: 'webrtc' | 'websocket';
      reason?: string;
    }) => {
      try {
        const { droneId, camera, transport, reason } = data;
        
        if (!socket.droneId || socket.droneId !== droneId) {
          logger.warn(`⚠️ Transport switch command from unregistered drone: ${droneId}`);
          return;
        }

        logger.info(`🔄 Camera transport switch: ${droneId}:${camera} -> ${transport} (${reason || 'manual'})`);
        
        // Update stream status with new transport
        const streamKey = `camera:${droneId}:${camera}:status`;
        const currentStatus = await redisClient.get(streamKey);
        
        if (currentStatus) {
          const status = JSON.parse(currentStatus);
          status.dataTransport = transport;
          status.transportSwitchedAt = new Date().toISOString();
          status.switchReason = reason || 'manual';
          
          // Update capability flags
          if (transport === 'webrtc') {
            status.webrtcActive = true;
            status.udpOptimized = true;
          } else {
            status.webrtcActive = false;
            status.udpOptimized = false;
          }
          
          await redisClient.setex(streamKey, 300, JSON.stringify(status));
        }

        // Publish transport change event
        await redisClient.publish(`camera:${droneId}:${camera}:control`, JSON.stringify({
          action: 'transport_switched',
          droneId,
          camera,
          transport,
          reason: reason || 'manual',
          timestamp: new Date().toISOString()
        }));

        socket.emit('camera_transport_ack', { 
          droneId, 
          camera, 
          transport, 
          status: 'switched',
          controlTransport: 'websocket'
        });
        
        logger.info(`✅ Camera transport switched: ${droneId}:${camera} -> ${transport}`);

      } catch (error) {
        logger.error('❌ Error switching camera transport:', error);
      }
    });

    // CONTROL: Handle camera quality adjustment
    socket.on('camera_adjust_quality', async (data: {
      droneId: string;
      camera: string;
      quality: number;
      bitrate?: number;
      fps?: number;
    }) => {
      try {
        const { droneId, camera, quality, bitrate, fps } = data;
        
        if (!socket.droneId || socket.droneId !== droneId) {
          logger.warn(`⚠️ Camera quality adjust from unregistered drone: ${droneId}`);
          return;
        }

        logger.info(`🎛️ Camera quality adjustment: ${droneId}:${camera} quality=${quality}`);
        
        // Store quality settings
        const qualityKey = `camera:${droneId}:${camera}:quality`;
        await redisClient.setex(qualityKey, 3600, JSON.stringify({
          quality,
          bitrate: bitrate || 'auto',
          fps: fps || 30,
          adjustedAt: new Date().toISOString(),
          controlMethod: 'websocket'
        }));

        // Publish quality change
        await redisClient.publish(`camera:${droneId}:${camera}:control`, JSON.stringify({
          action: 'quality_adjusted',
          droneId,
          camera,
          quality,
          bitrate,
          fps,
          timestamp: new Date().toISOString()
        }));

        socket.emit('camera_quality_ack', { 
          droneId, 
          camera, 
          quality,
          status: 'quality_adjusted'
        });
        
        logger.info(`✅ Camera quality adjusted: ${droneId}:${camera}`);

      } catch (error) {
        logger.error('❌ Error adjusting camera quality:', error);
      }
    });
  });

  // Enhanced cleanup for both control and data channels
  setInterval(async () => {
    try {
      const keys = await redisClient.keys('camera:*:*:status');
      const now = Date.now();
      
      for (const key of keys) {
        const data = await redisClient.get(key);
        if (data) {
          const status = JSON.parse(data);
          const lastUpdate = new Date(status.startedAt || status.stoppedAt || status.updatedAt).getTime();
          
          // Mark streams as inactive after 60 seconds of no updates
          if (now - lastUpdate > 60000 && status.status === 'active') {
            await redisClient.setex(key, 30, JSON.stringify({
              ...status,
              status: 'inactive',
              reason: 'timeout',
              inactiveAt: new Date().toISOString()
            }));
            
            const [, droneId, camera] = key.split(':');
            await redisClient.publish(`camera:${droneId}:${camera}:control`, JSON.stringify({
              action: 'stream_inactive',
              droneId,
              camera,
              reason: 'timeout',
              lastTransport: status.dataTransport || 'unknown',
              timestamp: new Date().toISOString()
            }));
            
            logger.warn(`⚠️ Camera stream marked inactive: ${droneId}:${camera} (timeout)`);
          }
        }
      }
    } catch (error) {
      logger.error('❌ Error in camera stream cleanup:', error);
    }
  }, 30000); // Check every 30 seconds

  logger.info('✅ Camera control handler configured (WebRTC data channels for frames)');
};

// API endpoints for camera control and status
export const setupCameraAPI = (app: any) => {
  // Get available camera streams with transport and WebRTC info
  app.get('/camera/streams', async (req: any, res: any) => {
    try {
      const keys = await redisClient.keys('camera:*:*:status');
      const streams = [];
      
      for (const key of keys) {
        const data = await redisClient.get(key);
        if (data) {
          const status = JSON.parse(data);
          const [, droneId, camera] = key.split(':');
          
          // Get transport capability and WebRTC info
          const [capabilityData, webrtcCapability, qualityData] = await Promise.all([
            redisClient.get(`camera:${droneId}:${camera}:capability`),
            redisClient.get(`webrtc:${droneId}:capability`),
            redisClient.get(`camera:${droneId}:${camera}:quality`)
          ]);
          
          const capability = capabilityData ? JSON.parse(capabilityData) : {};
          const webrtc = webrtcCapability ? JSON.parse(webrtcCapability) : {};
          const quality = qualityData ? JSON.parse(qualityData) : {};
          
          streams.push({
            droneId,
            camera,
            ...status,
            capability,
            webrtc,
            quality,
            transports: {
              control: 'websocket',
              data: capability.transport || 'websocket',
              webrtcAvailable: webrtc.dataChannelSupport || false
            }
          });
        }
      }
      
      res.json({ 
        success: true,
        streams,
        summary: {
          total: streams.length,
          active: streams.filter(s => s.status === 'active').length,
          webrtcCapable: streams.filter(s => s.transports?.webrtcAvailable).length,
          webrtcActive: streams.filter(s => s.dataTransport === 'webrtc_datachannel').length,
          controlMethod: 'websocket',
          dataMethod: 'mixed'
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get streams' });
    }
  });

  // Get latest frame metadata (not frame data)
  app.get('/camera/:droneId/:camera/latest', async (req: any, res: any) => {
    try {
      const { droneId, camera } = req.params;
      const frameKey = `camera:${droneId}:${camera}:latest`;
      
      const data = await redisClient.get(frameKey);
      if (!data) {
        return res.status(404).json({ error: 'No frame available' });
      }
      
      const frame = JSON.parse(data);
      
      // Return metadata only, not frame data (for security and performance)
      res.json({
        droneId: frame.droneId,
        camera: frame.camera,
        timestamp: frame.timestamp,
        receivedAt: frame.receivedAt,
        metadata: frame.metadata,
        transport: frame.transport,
        frameAvailable: true,
        frameSize: frame.metadata?.frameSize || frame.frame?.length || 0
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get frame metadata' });
    }
  });

  // Enhanced stream status with WebRTC details
  app.get('/camera/:droneId/:camera/status', async (req: any, res: any) => {
    try {
      const { droneId, camera } = req.params;
      
      const [statusData, capabilityData, qualityData, webrtcData] = await Promise.all([
        redisClient.get(`camera:${droneId}:${camera}:status`),
        redisClient.get(`camera:${droneId}:${camera}:capability`),
        redisClient.get(`camera:${droneId}:${camera}:quality`),
        redisClient.get(`webrtc:${droneId}:active_session`)
      ]);
      
      if (!statusData) {
        return res.json({ 
          droneId,
          camera,
          status: 'unavailable',
          controlTransport: 'websocket',
          dataTransport: 'none',
          webrtcAvailable: false
        });
      }
      
      const status = JSON.parse(statusData);
      const capability = capabilityData ? JSON.parse(capabilityData) : {};
      const quality = qualityData ? JSON.parse(qualityData) : {};
      const webrtc = webrtcData ? JSON.parse(webrtcData) : {};
      
      res.json({
        ...status,
        capability,
        quality,
        webrtc,
        transports: {
          control: 'websocket',
          data: status.dataTransport || capability.transport || 'websocket',
          webrtcAvailable: capability.dataChannelReady || false,
          udpOptimized: capability.transport === 'webrtc_datachannel'
        },
        recommendations: {
          preferredDataTransport: capability.dataChannelReady ? 'webrtc_datachannel' : 'websocket',
          controlTransport: 'websocket',
          qualityOptimization: quality.quality >= 80 ? 'high' : 'standard'
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get status' });
    }
  });

  // WebRTC transport capabilities endpoint
  app.get('/camera/:droneId/webrtc-capability', async (req: any, res: any) => {
    try {
      const { droneId } = req.params;
      
      const [webrtcCapability, sessionData] = await Promise.all([
        redisClient.get(`webrtc:${droneId}:capability`),
        redisClient.get(`webrtc:${droneId}:active_session`)
      ]);
      
      const capability = webrtcCapability ? JSON.parse(webrtcCapability) : null;
      const session = sessionData ? JSON.parse(sessionData) : null;
      
      if (!capability) {
        return res.status(404).json({ 
          error: 'WebRTC not supported for this drone',
          droneId,
          webrtcAvailable: false
        });
      }
      
      res.json({
        success: true,
        droneId,
        webrtcAvailable: true,
        capability: {
          ...capability,
          dataChannelSupport: true,
          udpOptimized: true,
          orderedDelivery: false,
          maxRetransmits: 0
        },
        activeSession: session,
        transport: {
          protocol: 'UDP',
          reliability: 'unreliable',
          ordered: false,
          maxRetransmits: 0,
          lowLatency: true
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get WebRTC capability' });
    }
  });

  // Force transport switch endpoint
  app.post('/camera/:droneId/:camera/force-transport', async (req: any, res: any) => {
    try {
      const { droneId, camera } = req.params;
      const { transport, reason } = req.body;
      
      if (!['webrtc', 'websocket'].includes(transport)) {
        return res.status(400).json({ error: 'Invalid transport type' });
      }
      
      // Update status to reflect forced transport
      const statusKey = `camera:${droneId}:${camera}:status`;
      const statusData = await redisClient.get(statusKey);
      
      if (statusData) {
        const status = JSON.parse(statusData);
        status.dataTransport = transport;
        status.forcedTransport = true;
        status.forcedAt = new Date().toISOString();
        status.forceReason = reason || 'manual';
        
        await redisClient.setex(statusKey, 300, JSON.stringify(status));
        
        // Publish transport change
        await redisClient.publish(`camera:${droneId}:${camera}:control`, JSON.stringify({
          action: 'force_transport_switch',
          droneId,
          camera,
          transport,
          reason: reason || 'manual',
          timestamp: new Date().toISOString()
        }));
        
        res.json({ 
          success: true, 
          message: `Transport forced to ${transport}`,
          droneId,
          camera,
          transport,
          controlMethod: 'websocket'
        });
      } else {
        res.status(404).json({ error: 'Camera stream not found' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to force transport switch' });
    }
  });
};
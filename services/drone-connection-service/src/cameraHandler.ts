// services/drone-connection-service/src/cameraHandler.ts - UPDATED FOR WEBRTC DATA CHANNELS
import { Server, Socket } from 'socket.io';
import { redisClient } from './redis';
import { logger } from './utils/logger';

// Extend Socket interface to include droneId
interface DroneSocket extends Socket {
  droneId?: string;
}

interface CameraFrame {
  droneId: string;
  camera: 'front' | 'bottom';
  timestamp: string;
  frame: string; // Base64 encoded image or stream chunk
  metadata: {
    resolution: string;
    fps: number;
    quality: number;
    transport?: string;
  };
}

interface WebRTCCameraFrame {
  droneId: string;
  camera: 'front' | 'bottom';
  timestamp: string;
  frameData: ArrayBuffer | string;
  metadata: {
    resolution: string;
    fps: number;
    quality: number;
    frameNumber: number;
    bandwidth: string;
    latency: number;
    transport: 'webrtc_datachannel';
  };
}

export const setupCameraHandler = (io: Server) => {
  logger.info('🎥 Setting up hybrid camera handler (WebSocket control + WebRTC data)...');

  io.on('connection', (socket: DroneSocket) => {
    
    // LEGACY: Handle camera frame from WebSocket (keep for backward compatibility)
    socket.on('camera_frame', async (data: CameraFrame) => {
      try {
        const { droneId, camera, frame, timestamp, metadata } = data;
        const receiveTime = Date.now();
        
        if (!socket.droneId || socket.droneId !== droneId) {
          logger.warn(`⚠️ WebSocket camera frame from unregistered drone: ${droneId}`);
          return;
        }

        // Mark as WebSocket transport
        const enhancedMetadata = {
          ...metadata,
          transport: 'websocket',
          receivedAt: new Date().toISOString()
        };

        // Store latest frame in Redis for immediate access
        const streamKey = `camera:${droneId}:${camera}:latest`;
        await redisClient.setex(streamKey, 5, JSON.stringify({
          frame,
          timestamp,
          metadata: enhancedMetadata,
          receivedAt: new Date().toISOString(),
          transport: 'websocket'
        }));

        // Publish to subscribers
        await redisClient.publish(`camera:${droneId}:${camera}:stream`, JSON.stringify({
          droneId,
          camera,
          frame,
          timestamp,
          metadata: enhancedMetadata
        }));

        // Send acknowledgment back to drone
        socket.emit('camera_stream_ack', {
          droneId,
          camera,
          timestamp,
          status: 'received',
          serverTimestamp: receiveTime,
          frameSize: frame.length,
          processingTime: Date.now() - receiveTime,
          transport: 'websocket'
        });

        logger.debug(`📸 WebSocket camera frame processed: ${droneId}:${camera} (${frame.length} bytes)`);

      } catch (error) {
        logger.error('❌ Error processing WebSocket camera frame:', error);
      }
    });

    // NEW: Handle WebRTC data channel camera frames
    socket.on('webrtc_camera_frame', async (data: WebRTCCameraFrame) => {
      try {
        const { droneId, camera, frameData, timestamp, metadata } = data;
        const receiveTime = Date.now();
        
        if (!socket.droneId || socket.droneId !== droneId) {
          logger.warn(`⚠️ WebRTC camera frame from unregistered drone: ${droneId}`);
          return;
        }

        // Convert ArrayBuffer to base64 if needed
        let frameString: string;
        if (frameData instanceof ArrayBuffer) {
          frameString = Buffer.from(frameData).toString('base64');
        } else {
          frameString = frameData as string;
        }

        // Enhanced metadata for WebRTC frames
        const enhancedMetadata = {
          ...metadata,
          transport: 'webrtc_datachannel',
          receivedAt: new Date().toISOString(),
          serverProcessingTime: Date.now() - receiveTime
        };

        // Store latest frame in Redis
        const streamKey = `camera:${droneId}:${camera}:latest`;
        await redisClient.setex(streamKey, 5, JSON.stringify({
          frame: frameString,
          timestamp,
          metadata: enhancedMetadata,
          receivedAt: new Date().toISOString(),
          transport: 'webrtc'
        }));

        // Publish to subscribers (realtime service picks this up)
        await redisClient.publish(`camera:${droneId}:${camera}:stream`, JSON.stringify({
          droneId,
          camera,
          frame: frameString,
          timestamp,
          metadata: enhancedMetadata
        }));

        // Optional: Send acknowledgment (WebRTC has its own reliability)
        socket.emit('webrtc_camera_ack', {
          droneId,
          camera,
          timestamp,
          status: 'received',
          serverTimestamp: receiveTime,
          frameSize: frameString.length,
          processingTime: Date.now() - receiveTime,
          transport: 'webrtc'
        });

        logger.debug(`📸 WebRTC camera frame processed: ${droneId}:${camera} (${frameString.length} bytes, UDP)`);

      } catch (error) {
        logger.error('❌ Error processing WebRTC camera frame:', error);
      }
    });

    // Handle camera stream start (CONTROL - stays on WebSocket)
    socket.on('camera_stream_start', async (data: { droneId: string; camera: string; config: any }) => {
      try {
        const { droneId, camera, config } = data;
        
        const streamKey = `camera:${droneId}:${camera}:status`;
        await redisClient.setex(streamKey, 60, JSON.stringify({
          status: 'active',
          config: {
            ...config,
            preferredTransport: 'webrtc', // Prefer WebRTC for data
            fallbackTransport: 'websocket'
          },
          startedAt: new Date().toISOString(),
          droneSocketId: socket.id
        }));

        // Notify subscribers that stream is available
        await redisClient.publish(`camera:${droneId}:${camera}:control`, JSON.stringify({
          action: 'stream_started',
          droneId,
          camera,
          config: {
            ...config,
            preferredTransport: 'webrtc'
          }
        }));

        socket.emit('camera_stream_ack', { 
          droneId, 
          camera, 
          status: 'started',
          recommendedTransport: 'webrtc',
          fallbackTransport: 'websocket'
        });
        
        logger.info(`📹 Camera stream started: ${droneId}:${camera} (WebRTC preferred)`);

      } catch (error) {
        logger.error('❌ Error starting camera stream:', error);
      }
    });

    // Handle camera stream stop (CONTROL - stays on WebSocket)
    socket.on('camera_stream_stop', async (data: { droneId: string; camera: string }) => {
      try {
        const { droneId, camera } = data;
        
        const streamKey = `camera:${droneId}:${camera}:status`;
        await redisClient.setex(streamKey, 10, JSON.stringify({
          status: 'stopped',
          stoppedAt: new Date().toISOString()
        }));

        await redisClient.publish(`camera:${droneId}:${camera}:control`, JSON.stringify({
          action: 'stream_stopped',
          droneId,
          camera
        }));

        socket.emit('camera_stream_ack', { droneId, camera, status: 'stopped' });
        logger.info(`📹 Camera stream stopped: ${droneId}:${camera}`);

      } catch (error) {
        logger.error('❌ Error stopping camera stream:', error);
      }
    });

    // NEW: Handle WebRTC transport readiness
    socket.on('webrtc_transport_ready', async (data: { droneId: string; cameras: string[] }) => {
      try {
        const { droneId, cameras } = data;
        
        // Update camera capabilities to indicate WebRTC is ready
        for (const camera of cameras) {
          const capabilityKey = `camera:${droneId}:${camera}:capability`;
          await redisClient.setex(capabilityKey, 300, JSON.stringify({
            transport: 'webrtc',
            dataChannelReady: true,
            preferredProtocol: 'udp',
            fallbackProtocol: 'websocket',
            updatedAt: new Date().toISOString()
          }));
        }

        // Notify that WebRTC transport is ready for cameras
        await redisClient.publish(`camera:${droneId}:transport`, JSON.stringify({
          action: 'webrtc_ready',
          droneId,
          cameras,
          timestamp: new Date().toISOString()
        }));

        socket.emit('webrtc_transport_ack', { 
          droneId, 
          status: 'ready', 
          cameras 
        });
        
        logger.info(`📡 WebRTC transport ready for ${droneId}: cameras [${cameras.join(', ')}]`);

      } catch (error) {
        logger.error('❌ Error handling WebRTC transport ready:', error);
      }
    });

    // NEW: Handle transport switching
    socket.on('camera_switch_transport', async (data: { 
      droneId: string; 
      camera: string; 
      transport: 'webrtc' | 'websocket' 
    }) => {
      try {
        const { droneId, camera, transport } = data;
        
        // Update stream status with new transport
        const streamKey = `camera:${droneId}:${camera}:status`;
        const currentStatus = await redisClient.get(streamKey);
        
        if (currentStatus) {
          const status = JSON.parse(currentStatus);
          status.activeTransport = transport;
          status.transportSwitchedAt = new Date().toISOString();
          
          await redisClient.setex(streamKey, 60, JSON.stringify(status));
        }

        // Notify subscribers of transport change
        await redisClient.publish(`camera:${droneId}:${camera}:control`, JSON.stringify({
          action: 'transport_switched',
          droneId,
          camera,
          transport,
          timestamp: new Date().toISOString()
        }));

        socket.emit('camera_transport_ack', { 
          droneId, 
          camera, 
          transport, 
          status: 'switched' 
        });
        
        logger.info(`🔄 Camera transport switched: ${droneId}:${camera} -> ${transport}`);

      } catch (error) {
        logger.error('❌ Error switching camera transport:', error);
      }
    });
  });

  // Enhanced cleanup for both transports
  setInterval(async () => {
    try {
      const keys = await redisClient.keys('camera:*:*:status');
      const now = Date.now();
      
      for (const key of keys) {
        const data = await redisClient.get(key);
        if (data) {
          const status = JSON.parse(data);
          const lastUpdate = new Date(status.startedAt || status.stoppedAt).getTime();
          
          // Mark streams as inactive after 30 seconds
          if (now - lastUpdate > 30000 && status.status === 'active') {
            await redisClient.setex(key, 10, JSON.stringify({
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
              lastTransport: status.activeTransport || 'unknown'
            }));
            
            logger.warn(`⚠️ Camera stream marked inactive: ${droneId}:${camera} (timeout)`);
          }
        }
      }
    } catch (error) {
      logger.error('❌ Error in camera stream cleanup:', error);
    }
  }, 10000);

  logger.info('✅ Hybrid camera handler configured (WebSocket control + WebRTC data)');
};

// API endpoints for camera streams - ENHANCED
export const setupCameraAPI = (app: any) => {
  // Get available camera streams with transport info
  app.get('/camera/streams', async (req: any, res: any) => {
    try {
      const keys = await redisClient.keys('camera:*:*:status');
      const streams = [];
      
      for (const key of keys) {
        const data = await redisClient.get(key);
        if (data) {
          const status = JSON.parse(data);
          const [, droneId, camera] = key.split(':');
          
          // Get transport capability
          const capabilityKey = `camera:${droneId}:${camera}:capability`;
          const capability = await redisClient.get(capabilityKey);
          const capabilityData = capability ? JSON.parse(capability) : {};
          
          streams.push({
            droneId,
            camera,
            ...status,
            capability: capabilityData
          });
        }
      }
      
      res.json({ 
        success: true,
        streams,
        summary: {
          total: streams.length,
          active: streams.filter(s => s.status === 'active').length,
          webrtc: streams.filter(s => s.capability?.transport === 'webrtc').length,
          websocket: streams.filter(s => s.activeTransport === 'websocket').length
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get streams' });
    }
  });

  // Get latest frame from specific camera with transport info
  app.get('/camera/:droneId/:camera/latest', async (req: any, res: any) => {
    try {
      const { droneId, camera } = req.params;
      const frameKey = `camera:${droneId}:${camera}:latest`;
      
      const data = await redisClient.get(frameKey);
      if (!data) {
        return res.status(404).json({ error: 'No frame available' });
      }
      
      const frame = JSON.parse(data);
      res.json({
        ...frame,
        performance: {
          transport: frame.transport || 'unknown',
          latency: frame.metadata?.latency || 0,
          serverProcessingTime: frame.metadata?.serverProcessingTime || 0
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get frame' });
    }
  });

  // Stream status endpoint with transport details
  app.get('/camera/:droneId/:camera/status', async (req: any, res: any) => {
    try {
      const { droneId, camera } = req.params;
      const statusKey = `camera:${droneId}:${camera}:status`;
      const capabilityKey = `camera:${droneId}:${camera}:capability`;
      
      const [statusData, capabilityData] = await Promise.all([
        redisClient.get(statusKey),
        redisClient.get(capabilityKey)
      ]);
      
      if (!statusData) {
        return res.json({ 
          status: 'unavailable',
          transport: 'none'
        });
      }
      
      const status = JSON.parse(statusData);
      const capability = capabilityData ? JSON.parse(capabilityData) : {};
      
      res.json({
        ...status,
        capability,
        recommendations: {
          preferredTransport: capability.transport || 'websocket',
          fallbackTransport: 'websocket',
          dataChannelReady: capability.dataChannelReady || false
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get status' });
    }
  });

  // NEW: Transport capabilities endpoint
  app.get('/camera/:droneId/capabilities', async (req: any, res: any) => {
    try {
      const { droneId } = req.params;
      const cameras = ['front', 'bottom'];
      const capabilities: { [key: string]: any } = {};
      
      for (const camera of cameras) {
        const capabilityKey = `camera:${droneId}:${camera}:capability`;
        const data = await redisClient.get(capabilityKey);
        capabilities[camera] = data ? JSON.parse(data) : { transport: 'websocket' };
      }
      
      res.json({
        success: true,
        droneId,
        capabilities,
        summary: {
          webrtcReady: Object.values(capabilities).some((cap: any) => cap.dataChannelReady),
          preferredTransport: Object.values(capabilities).every((cap: any) => cap.transport === 'webrtc') ? 'webrtc' : 'mixed'
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get capabilities' });
    }
  });

  // NEW: Force transport switch endpoint
  app.post('/camera/:droneId/:camera/switch-transport', async (req: any, res: any) => {
    try {
      const { droneId, camera } = req.params;
      const { transport } = req.body;
      
      if (!['webrtc', 'websocket'].includes(transport)) {
        return res.status(400).json({ error: 'Invalid transport type' });
      }
      
      // Update status to reflect forced transport
      const statusKey = `camera:${droneId}:${camera}:status`;
      const statusData = await redisClient.get(statusKey);
      
      if (statusData) {
        const status = JSON.parse(statusData);
        status.activeTransport = transport;
        status.forcedTransport = true;
        status.forcedAt = new Date().toISOString();
        
        await redisClient.setex(statusKey, 60, JSON.stringify(status));
        
        // Publish transport change
        await redisClient.publish(`camera:${droneId}:${camera}:control`, JSON.stringify({
          action: 'force_transport_switch',
          droneId,
          camera,
          transport,
          timestamp: new Date().toISOString()
        }));
        
        res.json({ 
          success: true, 
          message: `Transport switched to ${transport}`,
          droneId,
          camera,
          transport
        });
      } else {
        res.status(404).json({ error: 'Camera stream not found' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to switch transport' });
    }
  });
};
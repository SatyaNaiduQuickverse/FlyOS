// services/drone-connection-service/src/cameraHandler.ts
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
  };
}

export const setupCameraHandler = (io: Server) => {
  logger.info('🎥 Setting up camera stream handler...');

  io.on('connection', (socket: DroneSocket) => {
    // Handle camera frame from drone
    socket.on('camera_frame', async (data: CameraFrame) => {
      try {
        const { droneId, camera, frame, timestamp, metadata } = data;
        
        if (!socket.droneId || socket.droneId !== droneId) {
          logger.warn(`⚠️ Camera frame from unregistered drone: ${droneId}`);
          return;
        }

        // Store latest frame in Redis for immediate access
        const streamKey = `camera:${droneId}:${camera}:latest`;
        await redisClient.setex(streamKey, 5, JSON.stringify({
          frame,
          timestamp,
          metadata,
          receivedAt: new Date().toISOString()
        }));

        // Publish to subscribers
        await redisClient.publish(`camera:${droneId}:${camera}:stream`, JSON.stringify({
          droneId,
          camera,
          frame,
          timestamp,
          metadata
        }));

        logger.debug(`📸 Camera frame published: ${droneId}:${camera}`);

      } catch (error) {
        logger.error('❌ Error processing camera frame:', error);
      }
    });

    // Handle camera stream start
    socket.on('camera_stream_start', async (data: { droneId: string; camera: string; config: any }) => {
      try {
        const { droneId, camera, config } = data;
        
        const streamKey = `camera:${droneId}:${camera}:status`;
        await redisClient.setex(streamKey, 60, JSON.stringify({
          status: 'active',
          config,
          startedAt: new Date().toISOString(),
          droneSocketId: socket.id
        }));

        // Notify subscribers that stream is available
        await redisClient.publish(`camera:${droneId}:${camera}:control`, JSON.stringify({
          action: 'stream_started',
          droneId,
          camera,
          config
        }));

        socket.emit('camera_stream_ack', { droneId, camera, status: 'started' });
        logger.info(`📹 Camera stream started: ${droneId}:${camera}`);

      } catch (error) {
        logger.error('❌ Error starting camera stream:', error);
      }
    });

    // Handle camera stream stop
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
  });

  // Cleanup inactive streams
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
              reason: 'timeout'
            }));
            
            const [, droneId, camera] = key.split(':');
            await redisClient.publish(`camera:${droneId}:${camera}:control`, JSON.stringify({
              action: 'stream_inactive',
              droneId,
              camera,
              reason: 'timeout'
            }));
          }
        }
      }
    } catch (error) {
      logger.error('❌ Error in camera stream cleanup:', error);
    }
  }, 10000);
};

// API endpoints for camera streams
export const setupCameraAPI = (app: any) => {
  // Get available camera streams
  app.get('/camera/streams', async (req: any, res: any) => {
    try {
      const keys = await redisClient.keys('camera:*:*:status');
      const streams = [];
      
      for (const key of keys) {
        const data = await redisClient.get(key);
        if (data) {
          const status = JSON.parse(data);
          const [, droneId, camera] = key.split(':');
          
          streams.push({
            droneId,
            camera,
            ...status
          });
        }
      }
      
      res.json({ streams });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get streams' });
    }
  });

  // Get latest frame from specific camera
  app.get('/camera/:droneId/:camera/latest', async (req: any, res: any) => {
    try {
      const { droneId, camera } = req.params;
      const frameKey = `camera:${droneId}:${camera}:latest`;
      
      const data = await redisClient.get(frameKey);
      if (!data) {
        return res.status(404).json({ error: 'No frame available' });
      }
      
      const frame = JSON.parse(data);
      res.json(frame);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get frame' });
    }
  });

  // Stream status endpoint
  app.get('/camera/:droneId/:camera/status', async (req: any, res: any) => {
    try {
      const { droneId, camera } = req.params;
      const statusKey = `camera:${droneId}:${camera}:status`;
      
      const data = await redisClient.get(statusKey);
      if (!data) {
        return res.json({ status: 'unavailable' });
      }
      
      const status = JSON.parse(data);
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get status' });
    }
  });
};
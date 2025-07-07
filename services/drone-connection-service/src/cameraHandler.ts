// services/drone-connection-service/src/cameraHandler.ts - OPTIMIZED WITH BINARY FRAMES & COMPRESSION
import { Server, Socket } from 'socket.io';
import { redisClient } from './redis';
import { logger } from './utils/logger';
import * as zlib from 'zlib';
import { promisify } from 'util';

// Promisify compression functions
const gzipAsync = promisify(zlib.gzip);
const gunzipAsync = promisify(zlib.gunzip);

// Extend Socket interface to include droneId and frame queues
interface DroneSocket extends Socket {
  droneId?: string;
  frameQueues?: Map<string, FrameQueue>;
}

interface FrameQueue {
  frames: BinaryFrame[];
  maxSize: number;
  skipCount: number;
  totalFrames: number;
  lastProcessed: number;
}

interface BinaryFrame {
  droneId: string;
  camera: string;
  timestamp: number;
  frameNumber: number;
  compressedData: Buffer;
  originalSize: number;
  compressedSize: number;
  metadata: FrameMetadata;
}

interface FrameMetadata {
  resolution: string;
  fps: number;
  quality: number;
  frameNumber: number;
  compressionRatio: number;
  transport: 'websocket_binary' | 'websocket_json' | 'webrtc';
}

interface CameraControlCommand {
  droneId: string;
  camera: 'front' | 'bottom';
  action: 'start' | 'stop' | 'configure';
  config?: {
    resolution?: string;
    fps?: number;
    quality?: number;
    transport?: 'websocket_binary' | 'websocket_json' | 'webrtc';
    optimization?: {
      compression: boolean;
      frameSkipping: boolean;
      maxQueueSize: number;
    };
  };
}

// Global frame queue management
const frameQueues = new Map<string, Map<string, FrameQueue>>();
const queueMetrics = new Map<string, QueueMetrics>();

interface QueueMetrics {
  totalFramesReceived: number;
  totalFramesSkipped: number;
  totalFramesSent: number;
  averageCompressionRatio: number;
  averageQueueSize: number;
  lastMetricUpdate: number;
}

export const setupCameraHandler = (io: Server) => {
  logger.info('🎥 Setting up optimized camera handler (Binary + Compression + Frame Skipping)...');

  // Initialize queue cleanup interval
  setInterval(() => {
    cleanupStaleQueues();
  }, 30000); // Cleanup every 30 seconds

  // Metrics reporting interval
  setInterval(() => {
    reportQueueMetrics();
  }, 10000); // Report every 10 seconds

  io.on('connection', (socket: DroneSocket) => {
    socket.frameQueues = new Map();
    
    // OPTIMIZED: Handle binary camera frames with compression and frame skipping
    socket.on('camera_frame_binary', async (data: {
      droneId: string;
      camera: string;
      timestamp: number;
      frameNumber: number;
      frameData: Buffer;
      metadata: Partial<FrameMetadata>;
    }) => {
      try {
        const { droneId, camera, timestamp, frameNumber, frameData, metadata } = data;
        
        if (!socket.droneId || socket.droneId !== droneId) {
          logger.warn(`⚠️ Binary frame from unregistered drone: ${droneId}`);
          return;
        }

        const startTime = Date.now();
        
        // Get or create frame queue for this drone/camera
        const queueKey = `${droneId}:${camera}`;
        let queue = getOrCreateFrameQueue(droneId, camera);
        
        // Update metrics
        updateQueueMetrics(droneId, 'frame_received');

        // OPTIMIZATION 1: Frame Skipping - Skip if queue is backing up
        if (queue.frames.length >= queue.maxSize) {
          queue.skipCount++;
          updateQueueMetrics(droneId, 'frame_skipped');
          
          // Remove oldest frame to make room
          const oldFrame = queue.frames.shift();
          if (oldFrame) {
            logger.debug(`🔄 Frame skipped for ${queueKey}, queue full (${queue.frames.length})`);
          }
        }

        // OPTIMIZATION 2: Binary Frame Compression
        let compressedData: Buffer;
        let compressionRatio: number;
        
        try {
          compressedData = await gzipAsync(frameData);
          compressionRatio = frameData.length / compressedData.length;
        } catch (compressionError) {
          logger.error(`❌ Compression failed for ${queueKey}:`, compressionError);
          // Fallback to uncompressed
          compressedData = frameData;
          compressionRatio = 1.0;
        }

        // Create optimized binary frame
        const binaryFrame: BinaryFrame = {
          droneId,
          camera,
          timestamp,
          frameNumber,
          compressedData,
          originalSize: frameData.length,
          compressedSize: compressedData.length,
          metadata: {
            resolution: metadata.resolution || '1920x1080',
            fps: metadata.fps || 30,
            quality: metadata.quality || 85,
            frameNumber,
            compressionRatio,
            transport: 'websocket_binary'
          }
        };

        // Add frame to queue
        queue.frames.push(binaryFrame);
        queue.totalFrames++;

        // Process queue immediately (non-blocking)
        setImmediate(() => processFrameQueue(droneId, camera));

        const processingTime = Date.now() - startTime;
        logger.debug(`📸 Binary frame processed: ${queueKey} (${processingTime}ms, compression: ${compressionRatio.toFixed(2)}x)`);

        // Send processing acknowledgment
        socket.emit('camera_frame_ack', {
          droneId,
          camera,
          frameNumber,
          status: 'processed',
          compressionRatio,
          queueSize: queue.frames.length,
          processingTime
        });

      } catch (error) {
        logger.error('❌ Error processing binary camera frame:', error);
      }
    });

    // COMPATIBILITY: Handle legacy JSON camera frames
    socket.on('camera_frame', async (data: {
      droneId: string;
      camera: string;
      timestamp: number;
      frame: string; // base64 encoded
      metadata: any;
    }) => {
      try {
        const { droneId, camera, timestamp, frame, metadata } = data;
        
        if (!socket.droneId || socket.droneId !== droneId) {
          logger.warn(`⚠️ Legacy frame from unregistered drone: ${droneId}`);
          return;
        }

        // Convert base64 to binary
        const frameBuffer = Buffer.from(frame, 'base64');
        
        // Process as binary frame
        await socket.emit('camera_frame_binary', {
          droneId,
          camera,
          timestamp: timestamp || Date.now(),
          frameNumber: metadata?.frameNumber || 0,
          frameData: frameBuffer,
          metadata: {
            ...metadata,
            transport: 'websocket_json'
          }
        });

        logger.debug(`🔄 Legacy frame converted to binary: ${droneId}:${camera}`);

      } catch (error) {
        logger.error('❌ Error processing legacy camera frame:', error);
      }
    });

    // CONTROL: Handle optimized camera stream start
    socket.on('camera_stream_start', async (data: CameraControlCommand) => {
      try {
        const { droneId, camera, config } = data;
        
        if (!socket.droneId || socket.droneId !== droneId) {
          logger.warn(`⚠️ Camera start command from unregistered drone: ${droneId}`);
          return;
        }

        logger.info(`📹 Optimized camera stream start: ${droneId}:${camera}`);
        
        // Initialize frame queue with optimization settings
        const queueConfig = config?.optimization || {
          compression: true,
          frameSkipping: true,
          maxQueueSize: 3
        };

        initializeFrameQueue(droneId, camera, queueConfig.maxQueueSize);

        // Store stream control status in Redis
        const streamKey = `camera:${droneId}:${camera}:status`;
        const streamStatus = {
          status: 'active',
          config: {
            ...config,
            optimization: queueConfig,
            transport: 'websocket_binary'
          },
          startedAt: new Date().toISOString(),
          droneSocketId: socket.id,
          optimizations: {
            compression: queueConfig.compression,
            frameSkipping: queueConfig.frameSkipping,
            maxQueueSize: queueConfig.maxQueueSize
          }
        };

        await redisClient.setex(streamKey, 300, JSON.stringify(streamStatus));

        // Publish control event
        await redisClient.publish(`camera:${droneId}:${camera}:control`, JSON.stringify({
          action: 'stream_start_optimized',
          droneId,
          camera,
          config: streamStatus.config,
          timestamp: new Date().toISOString()
        }));

        socket.emit('camera_stream_ack', { 
          droneId, 
          camera, 
          status: 'start_command_received',
          transport: 'websocket_binary',
          optimizations: queueConfig
        });
        
        logger.info(`✅ Optimized camera start processed: ${droneId}:${camera}`);

      } catch (error) {
        logger.error('❌ Error processing optimized camera start:', error);
      }
    });

    // CONTROL: Handle camera stream stop
    socket.on('camera_stream_stop', async (data: { droneId: string; camera: string }) => {
      try {
        const { droneId, camera } = data;
        
        if (!socket.droneId || socket.droneId !== droneId) {
          logger.warn(`⚠️ Camera stop command from unregistered drone: ${droneId}`);
          return;
        }

        logger.info(`🛑 Camera stream stop: ${droneId}:${camera}`);
        
        // Clean up frame queue
        cleanupFrameQueue(droneId, camera);

        // Update stream status
        const streamKey = `camera:${droneId}:${camera}:status`;
        await redisClient.setex(streamKey, 60, JSON.stringify({
          status: 'stopped',
          stoppedAt: new Date().toISOString()
        }));

        // Publish control event
        await redisClient.publish(`camera:${droneId}:${camera}:control`, JSON.stringify({
          action: 'stream_stop_optimized',
          droneId,
          camera,
          timestamp: new Date().toISOString()
        }));

        socket.emit('camera_stream_ack', { 
          droneId, 
          camera, 
          status: 'stop_command_received'
        });
        
        logger.info(`✅ Camera stop processed: ${droneId}:${camera}`);

      } catch (error) {
        logger.error('❌ Error processing camera stop:', error);
      }
    });

    // Handle socket disconnect - cleanup frame queues
    socket.on('disconnect', async () => {
      if (socket.droneId) {
        cleanupDroneQueues(socket.droneId);
      }
    });
  });

  logger.info('✅ Optimized camera handler configured with binary compression and frame skipping');
};

// OPTIMIZATION 3: Frame Queue Management
function getOrCreateFrameQueue(droneId: string, camera: string): FrameQueue {
  const queueKey = `${droneId}:${camera}`;
  
  if (!frameQueues.has(droneId)) {
    frameQueues.set(droneId, new Map());
  }
  
  const droneQueues = frameQueues.get(droneId)!;
  
  if (!droneQueues.has(camera)) {
    droneQueues.set(camera, {
      frames: [],
      maxSize: 3, // Default max queue size
      skipCount: 0,
      totalFrames: 0,
      lastProcessed: Date.now()
    });
  }
  
  return droneQueues.get(camera)!;
}

function initializeFrameQueue(droneId: string, camera: string, maxSize: number = 3): void {
  const queue = getOrCreateFrameQueue(droneId, camera);
  queue.maxSize = maxSize;
  queue.frames = []; // Clear existing frames
  queue.skipCount = 0;
  queue.totalFrames = 0;
  queue.lastProcessed = Date.now();
  
  // Initialize metrics
  if (!queueMetrics.has(droneId)) {
    queueMetrics.set(droneId, {
      totalFramesReceived: 0,
      totalFramesSkipped: 0,
      totalFramesSent: 0,
      averageCompressionRatio: 1.0,
      averageQueueSize: 0,
      lastMetricUpdate: Date.now()
    });
  }
  
  logger.info(`🎛️ Frame queue initialized: ${droneId}:${camera} (maxSize: ${maxSize})`);
}

async function processFrameQueue(droneId: string, camera: string): Promise<void> {
  try {
    const droneQueues = frameQueues.get(droneId);
    if (!droneQueues) return;
    
    const queue = droneQueues.get(camera);
    if (!queue || queue.frames.length === 0) return;

    // Get the next frame to process
    const frame = queue.frames.shift();
    if (!frame) return;

    // Store optimized frame in Redis for real-time access
    const frameKey = `camera:${droneId}:${camera}:latest_binary`;
    
    // Create frame data for Redis storage
    const redisFrameData = {
      droneId: frame.droneId,
      camera: frame.camera,
      timestamp: frame.timestamp,
      frameNumber: frame.frameNumber,
      compressedData: frame.compressedData.toString('base64'), // Convert buffer to base64 for Redis
      originalSize: frame.originalSize,
      compressedSize: frame.compressedSize,
      metadata: frame.metadata,
      queueSize: queue.frames.length,
      receivedAt: new Date().toISOString()
    };

    await redisClient.setex(frameKey, 30, JSON.stringify(redisFrameData)); // 30 second expiry

    // Publish binary frame for real-time subscribers
    await redisClient.publish(`camera:${droneId}:${camera}:binary_stream`, JSON.stringify({
      action: 'binary_frame',
      droneId,
      camera,
      frameData: redisFrameData,
      timestamp: new Date().toISOString()
    }));

    // Update metrics
    updateQueueMetrics(droneId, 'frame_sent', frame.metadata.compressionRatio);
    queue.lastProcessed = Date.now();

    logger.debug(`📤 Binary frame processed: ${droneId}:${camera} (queue: ${queue.frames.length})`);

  } catch (error) {
    logger.error(`❌ Error processing frame queue for ${droneId}:${camera}:`, error);
  }
}

function updateQueueMetrics(droneId: string, action: 'frame_received' | 'frame_skipped' | 'frame_sent', compressionRatio?: number): void {
  const metrics = queueMetrics.get(droneId);
  if (!metrics) return;

  switch (action) {
    case 'frame_received':
      metrics.totalFramesReceived++;
      break;
    case 'frame_skipped':
      metrics.totalFramesSkipped++;
      break;
    case 'frame_sent':
      metrics.totalFramesSent++;
      if (compressionRatio) {
        // Update rolling average compression ratio
        const currentAvg = metrics.averageCompressionRatio;
        const totalSent = metrics.totalFramesSent;
        metrics.averageCompressionRatio = ((currentAvg * (totalSent - 1)) + compressionRatio) / totalSent;
      }
      break;
  }

  metrics.lastMetricUpdate = Date.now();
}

function cleanupFrameQueue(droneId: string, camera: string): void {
  const droneQueues = frameQueues.get(droneId);
  if (!droneQueues) return;

  const queue = droneQueues.get(camera);
  if (queue) {
    const queueSize = queue.frames.length;
    queue.frames = [];
    droneQueues.delete(camera);
    
    logger.info(`🧹 Frame queue cleaned up: ${droneId}:${camera} (${queueSize} frames discarded)`);
  }
}

function cleanupDroneQueues(droneId: string): void {
  const droneQueues = frameQueues.get(droneId);
  if (droneQueues) {
    const queueCount = droneQueues.size;
    frameQueues.delete(droneId);
    
    logger.info(`🧹 All frame queues cleaned up for drone: ${droneId} (${queueCount} queues)`);
  }
  
  // Clean up metrics
  queueMetrics.delete(droneId);
}

function cleanupStaleQueues(): void {
  const now = Date.now();
  const staleThreshold = 60000; // 1 minute

  for (const [droneId, droneQueues] of frameQueues.entries()) {
    for (const [camera, queue] of droneQueues.entries()) {
      if (now - queue.lastProcessed > staleThreshold) {
        logger.info(`🧹 Cleaning up stale queue: ${droneId}:${camera}`);
        cleanupFrameQueue(droneId, camera);
      }
    }
    
    // Clean up empty drone entries
    if (droneQueues.size === 0) {
      frameQueues.delete(droneId);
    }
  }
}

function reportQueueMetrics(): void {
  for (const [droneId, metrics] of queueMetrics.entries()) {
    const skipRate = metrics.totalFramesReceived > 0 ? 
      (metrics.totalFramesSkipped / metrics.totalFramesReceived * 100).toFixed(1) : '0.0';
    
    logger.info(`📊 Queue metrics for ${droneId}: ` +
      `Received: ${metrics.totalFramesReceived}, ` +
      `Skipped: ${metrics.totalFramesSkipped} (${skipRate}%), ` +
      `Sent: ${metrics.totalFramesSent}, ` +
      `Avg Compression: ${metrics.averageCompressionRatio.toFixed(2)}x`);
  }
}

// API endpoints for optimized camera control and status
export const setupCameraAPI = (app: any) => {
  // Get camera performance metrics
  app.get('/camera/metrics', async (req: any, res: any) => {
    try {
      const allMetrics = Array.from(queueMetrics.entries()).map(([droneId, metrics]) => ({
        droneId,
        ...metrics,
        skipRate: metrics.totalFramesReceived > 0 ? 
          metrics.totalFramesSkipped / metrics.totalFramesReceived * 100 : 0
      }));
      
      res.json({
        success: true,
        metrics: allMetrics,
        summary: {
          totalDrones: allMetrics.length,
          globalFramesReceived: allMetrics.reduce((sum, m) => sum + m.totalFramesReceived, 0),
          globalFramesSkipped: allMetrics.reduce((sum, m) => sum + m.totalFramesSkipped, 0),
          globalFramesSent: allMetrics.reduce((sum, m) => sum + m.totalFramesSent, 0),
          averageCompressionRatio: allMetrics.length > 0 ? 
            allMetrics.reduce((sum, m) => sum + m.averageCompressionRatio, 0) / allMetrics.length : 1.0
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get metrics' });
    }
  });

  // Get binary frame data
  app.get('/camera/:droneId/:camera/latest-binary', async (req: any, res: any) => {
    try {
      const { droneId, camera } = req.params;
      const frameKey = `camera:${droneId}:${camera}:latest_binary`;
      
      const data = await redisClient.get(frameKey);
      if (!data) {
        return res.status(404).json({ error: 'No binary frame available' });
      }
      
      const frame = JSON.parse(data);
      
      // Return metadata with option to get binary data
      res.json({
        droneId: frame.droneId,
        camera: frame.camera,
        timestamp: frame.timestamp,
        frameNumber: frame.frameNumber,
        originalSize: frame.originalSize,
        compressedSize: frame.compressedSize,
        compressionRatio: frame.metadata.compressionRatio,
        queueSize: frame.queueSize,
        metadata: frame.metadata,
        binaryDataAvailable: true
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get binary frame' });
    }
  });

  // Force queue cleanup
  app.post('/camera/cleanup', async (req: any, res: any) => {
    try {
      const { droneId, camera } = req.body;
      
      if (droneId && camera) {
        cleanupFrameQueue(droneId, camera);
        res.json({ success: true, message: `Queue cleaned for ${droneId}:${camera}` });
      } else if (droneId) {
        cleanupDroneQueues(droneId);
        res.json({ success: true, message: `All queues cleaned for ${droneId}` });
      } else {
        cleanupStaleQueues();
        res.json({ success: true, message: 'All stale queues cleaned' });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: 'Cleanup failed' });
    }
  });
};
// lib/hooks/useCameraStream.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface CameraFrame {
  droneId: string;
  camera: 'front' | 'bottom';
  frame: string;
  timestamp: string;
  metadata: {
    resolution: string;
    fps: number;
    quality: number;
  };
}

interface StreamConfig {
  quality: 'high' | 'medium' | 'low';
  fps: number;
}

export const useCameraStream = (droneId: string, camera: 'front' | 'bottom' = 'front') => {
  const [currentFrame, setCurrentFrame] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState<'connecting' | 'active' | 'inactive' | 'error'>('connecting');
  const [metadata, setMetadata] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  const socketRef = useRef<Socket | null>(null);
  const subscribersRef = useRef<Set<string>>(new Set());

  // Initialize socket connection
  useEffect(() => {
    if (!droneId) return;

    const socket = io(`${process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4002'}`, {
      transports: ['websocket'],
      timeout: 5000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log(`📹 Connected to camera stream service`);
    });

    socket.on('disconnect', () => {
      console.log(`📴 Disconnected from camera stream service`);
      setStreamStatus('inactive');
    });

    socket.on('connect_error', (error) => {
      console.error('Camera stream connection error:', error);
      setStreamStatus('error');
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Subscribe to camera stream
  useEffect(() => {
    if (!socketRef.current || !droneId || !camera) return;

    const streamChannel = `camera:${droneId}:${camera}:stream`;
    const controlChannel = `camera:${droneId}:${camera}:control`;
    
    console.log(`📡 Subscribing to camera stream: ${droneId}:${camera}`);

    // Subscribe to Redis channels through realtime service
    socketRef.current.emit('subscribe_camera_stream', {
      droneId,
      camera,
      channels: [streamChannel, controlChannel]
    });

    // Handle incoming camera frames
    socketRef.current.on('camera_frame', (data: CameraFrame) => {
      if (data.droneId === droneId && data.camera === camera) {
        setCurrentFrame(data.frame);
        setMetadata(data.metadata);
        setLastUpdate(new Date());
        setStreamStatus('active');
      }
    });

    // Handle stream control messages
    socketRef.current.on('camera_control', (data: any) => {
      if (data.droneId === droneId && data.camera === camera) {
        switch (data.action) {
          case 'stream_started':
            setStreamStatus('active');
            break;
          case 'stream_stopped':
          case 'stream_inactive':
            setStreamStatus('inactive');
            break;
        }
      }
    });

    return () => {
      socketRef.current?.emit('unsubscribe_camera_stream', {
        droneId,
        camera
      });
    };
  }, [droneId, camera]);

  // Request latest frame on mount
  useEffect(() => {
    if (!droneId || !camera) return;

    const fetchLatestFrame = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4002'}/camera/${droneId}/${camera}/latest`);
        if (response.ok) {
          const data = await response.json();
          setCurrentFrame(data.frame);
          setMetadata(data.metadata);
          setLastUpdate(new Date());
        }
      } catch (error) {
        console.log('No cached frame available');
      }
    };

    fetchLatestFrame();
  }, [droneId, camera]);

  // Add subscriber (for AI components)
  const addSubscriber = useCallback((subscriberId: string) => {
    subscribersRef.current.add(subscriberId);
    
    // Notify that a new subscriber is listening
    if (socketRef.current) {
      socketRef.current.emit('camera_subscriber_added', {
        droneId,
        camera,
        subscriberId
      });
    }
  }, [droneId, camera]);

  // Remove subscriber
  const removeSubscriber = useCallback((subscriberId: string) => {
    subscribersRef.current.delete(subscriberId);
    
    if (socketRef.current) {
      socketRef.current.emit('camera_subscriber_removed', {
        droneId,
        camera,
        subscriberId
      });
    }
  }, [droneId, camera]);

  // Request stream config change
  const changeStreamConfig = useCallback((config: StreamConfig) => {
    if (socketRef.current) {
      socketRef.current.emit('camera_config_change', {
        droneId,
        camera,
        config
      });
    }
  }, [droneId, camera]);

  return {
    currentFrame,
    streamStatus,
    metadata,
    lastUpdate,
    addSubscriber,
    removeSubscriber,
    changeStreamConfig,
    isConnected: socketRef.current?.connected || false
  };
};
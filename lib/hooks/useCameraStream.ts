// lib/hooks/useCameraStream.ts - DIRECT CONNECTION FIX
import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";

// FIXED: Use environment variable for production deployment
const REALTIME_SERVICE_URL = process.env.NEXT_PUBLIC_WS_URL || 
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' 
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:4002`
    : 'http://localhost:4002');

export const useCameraStream = (droneId: string, camera: "front" | "bottom") => {
  const [state, setState] = useState({
    currentFrame: null,
    metadata: null,
    streamStatus: "inactive",
    isConnected: false,
    lastFrameTime: null,
    frameCount: 0,
    subscribers: new Set()
  });

  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionAttemptsRef = useRef(0);
  const maxConnectionAttempts = 3;

  const getAuthToken = () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("flyos_token");
  };

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    setState(prev => ({ 
      ...prev, 
      isConnected: false, 
      streamStatus: "inactive" 
    }));
  }, []);

  const initializeConnection = useCallback(async () => {
    if (socketRef.current?.connected) return;

    const token = getAuthToken();
    if (!token) {
      console.warn("No authentication token for camera stream");
      setState(prev => ({ ...prev, streamStatus: "error" }));
      return;
    }

    if (connectionAttemptsRef.current >= maxConnectionAttempts) {
      console.error(`Max connection attempts reached for ${droneId}:${camera}`);
      setState(prev => ({ ...prev, streamStatus: "error" }));
      return;
    }

    try {
      setState(prev => ({ ...prev, streamStatus: "connecting" }));
      connectionAttemptsRef.current++;

      console.log(`Connecting camera ${droneId}:${camera} to ${REALTIME_SERVICE_URL}`);

      const socket = io(REALTIME_SERVICE_URL, {
        auth: { token },
        query: { token },
        extraHeaders: {
          'Authorization': `Bearer ${token}`
        },
        transports: ["websocket", "polling"],
        timeout: 15000,
        reconnection: false,
        forceNew: true
      });

      socket.on("connect", () => {
        console.log(`✅ Camera stream connected: ${droneId}:${camera}`);
        connectionAttemptsRef.current = 0;
        
        setState(prev => ({ 
          ...prev, 
          isConnected: true, 
          streamStatus: "active" 
        }));

        // Subscribe to camera streams
        socket.emit("subscribe_camera_stream", {
          droneId,
          camera,
          channels: [
            `camera:${droneId}:${camera}:stream`,
            `camera:${droneId}:${camera}:control`
          ]
        });
      });

      socket.on("connect_error", (error) => {
        console.error(`❌ Camera connection error ${droneId}:${camera}:`, error.message);
        setState(prev => ({ 
          ...prev, 
          streamStatus: "error", 
          isConnected: false 
        }));

        // Retry with backoff
        if (connectionAttemptsRef.current < maxConnectionAttempts) {
          const delay = Math.min(2000 * connectionAttemptsRef.current, 10000);
          reconnectTimeoutRef.current = setTimeout(initializeConnection, delay);
        }
      });

      socket.on("disconnect", (reason) => {
        console.log(`📴 Camera disconnected ${droneId}:${camera}: ${reason}`);
        setState(prev => ({ 
          ...prev, 
          isConnected: false,
          streamStatus: "inactive"
        }));

        if (reason !== 'io client disconnect' && connectionAttemptsRef.current < maxConnectionAttempts) {
          reconnectTimeoutRef.current = setTimeout(initializeConnection, 3000);
        }
      });

      socket.on("camera_frame", (data: any) => {
        if (data.droneId === droneId && data.camera === camera) {
          setState(prev => ({
            ...prev,
            currentFrame: data.frame,
            metadata: data.metadata,
            lastFrameTime: new Date(),
            frameCount: prev.frameCount + 1
          }));
        }
      });

      socket.on("camera_control", (data: any) => {
        if (data.droneId === droneId && data.camera === camera) {
          console.log(`📹 Camera control: ${droneId}:${camera}`, data);
        }
      });

      socketRef.current = socket;

    } catch (error) {
      console.error("Camera stream initialization failed:", error);
      setState(prev => ({ ...prev, streamStatus: "error" }));
    }
  }, [droneId, camera]);

  useEffect(() => {
    initializeConnection();
    return cleanup;
  }, [initializeConnection, cleanup]);

  return {
    ...state,
    reconnect: initializeConnection,
    addSubscriber: (id: string) => {
      setState(prev => ({
        ...prev,
        subscribers: new Set([...prev.subscribers, id])
      }));
    },
    removeSubscriber: (id: string) => {
      setState(prev => {
        const newSubscribers = new Set(prev.subscribers);
        newSubscribers.delete(id);
        return { ...prev, subscribers: newSubscribers };
      });
    },
    changeStreamConfig: (config: any) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('camera_config_change', {
          droneId,
          camera,
          config
        });
      }
    }
  };
};
import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";

// FIXED: Use secure routing through port 3001
const REALTIME_SERVICE_URL = process.env.NEXT_PUBLIC_WS_URL || 
  (typeof window !== 'undefined' ? window.location.origin : "http://localhost:3001");

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

  const getAuthToken = () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("flyos_token") || 
           localStorage.getItem("auth_token") ||
           sessionStorage.getItem("token");
  };

  const initializeConnection = useCallback(async () => {
    if (socketRef.current?.connected) return;

    try {
      setState(prev => ({ ...prev, streamStatus: "connecting" }));
      
      const token = getAuthToken();
      if (!token) {
        console.warn("No authentication token available for camera stream");
        setState(prev => ({ ...prev, streamStatus: "error" }));
        return;
      }

      const socket = io(REALTIME_SERVICE_URL, {
        auth: { token },
        extraHeaders: {
          Authorization: `Bearer ${token}`
        },
        query: { token },
        transports: ["polling", "websocket"],
        timeout: 10000
      });

      socket.on("connect", () => {
        console.log(`Camera stream connected for ${droneId}:${camera}`);
        setState(prev => ({ 
          ...prev, 
          isConnected: true, 
          streamStatus: "active" 
        }));

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
        console.error(`Camera stream auth error: ${error.message}`);
        setState(prev => ({ 
          ...prev, 
          streamStatus: "error", 
          isConnected: false 
        }));
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
          console.log(`Camera control message:`, data);
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
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [initializeConnection]);

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
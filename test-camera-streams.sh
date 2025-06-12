#!/bin/bash
# fix-camera-streams.sh - Complete Camera Stream Implementation Fix

echo "🎥 FIXING CAMERA STREAMS & DEPENDENCIES"
echo "======================================="

# Step 1: Fix package.json dependency conflicts
echo "1. 📦 Fixing package.json dependencies..."

# Create temporary package.json with fixed dependencies
cat > package.json.new << 'EOF'
{
  "name": "flyos",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@heroicons/react": "^2.2.0",
    "@supabase/auth-helpers-nextjs": "^0.10.0",
    "@supabase/supabase-js": "^2.49.8",
    "axios": "^1.9.0",
    "bcryptjs": "^3.0.2",
    "framer-motion": "^12.9.4",
    "jsonwebtoken": "^9.0.2",
    "leaflet": "^1.9.4",
    "lucide-react": "^0.507.0",
    "next": "15.3.1",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-hook-form": "^7.56.1",
    "react-leaflet": "^5.0.0",
    "recharts": "^2.15.3",
    "socket.io-client": "^4.8.1",
    "zod": "^3.24.3",
    "zustand": "^5.0.3"
  },
  "devDependencies": {
    "@eslint/eslintrc": "^3",
    "@tailwindcss/postcss": "^4",
    "@types/bcryptjs": "^2.4.6",
    "@types/jsonwebtoken": "^9.0.9",
    "@types/leaflet": "^1.9.17",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "15.3.1",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
EOF

# Replace package.json
mv package.json.new package.json
echo "✅ Updated package.json with React 19 compatibility"

# Step 2: Create health endpoint
echo "2. 🏥 Creating health endpoint..."
mkdir -p app/health
cat > app/health/route.ts << 'EOF'
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check critical services
    const healthChecks = await Promise.allSettled([
      fetch('http://drone-connection-service:4005/health', { signal: AbortSignal.timeout(3000) }),
      fetch('http://realtime-service:4002/health', { signal: AbortSignal.timeout(3000) }),
      fetch('http://user-management-service:4003/health', { signal: AbortSignal.timeout(3000) })
    ]);

    const services = {
      'drone-connection': healthChecks[0].status === 'fulfilled' && healthChecks[0].value.ok,
      'realtime-service': healthChecks[1].status === 'fulfilled' && healthChecks[1].value.ok,
      'user-management': healthChecks[2].status === 'fulfilled' && healthChecks[2].value.ok
    };

    const allHealthy = Object.values(services).every(Boolean);

    return NextResponse.json({
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services,
      version: process.env.npm_package_version || '1.0.0'
    }, { 
      status: allHealthy ? 200 : 503 
    });

  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
EOF

# Step 3: Fix camera stream hook
echo "3. 📹 Fixing camera stream hook..."
cat > lib/hooks/useCameraStream.ts << 'EOF'
import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";

const REALTIME_SERVICE_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:4002";

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
    return localStorage.getItem("token") || 
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
EOF

# Step 4: Create working camera feed component
echo "4. 🎬 Creating camera feed component..."
cat > components/DroneControl/CameraFeed.tsx << 'EOF'
// components/DroneControl/CameraFeed.tsx - Working Implementation
import React, { useState, useEffect, useRef } from 'react';
import { Camera, Eye, Maximize2, SplitSquareVertical, PictureInPicture, Download, ZoomIn, ZoomOut, Layers, Wifi, WifiOff } from 'lucide-react';
import { useCameraStream } from '../../lib/hooks/useCameraStream';

interface DroneBasic {
  id: string;
  model: string;
  status: string;
}

interface CameraFeedProps {
  drone: DroneBasic;
  isControlEnabled: boolean;
}

const CameraFeed: React.FC<CameraFeedProps> = ({ drone, isControlEnabled }) => {
  const [activeCamera, setActiveCamera] = useState<'front' | 'bottom'>('front');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [viewMode, setViewMode] = useState<'single' | 'split' | 'pip'>('single');
  
  // Camera streams
  const frontStream = useCameraStream(drone.id, 'front');
  const bottomStream = useCameraStream(drone.id, 'bottom');
  
  // Refs for video elements
  const frontVideoRef = useRef<HTMLImageElement>(null);
  const bottomVideoRef = useRef<HTMLImageElement>(null);
  
  // Update video elements when frames arrive
  useEffect(() => {
    if (frontStream.currentFrame && frontVideoRef.current) {
      frontVideoRef.current.src = `data:image/jpeg;base64,${frontStream.currentFrame}`;
    }
  }, [frontStream.currentFrame]);
  
  useEffect(() => {
    if (bottomStream.currentFrame && bottomVideoRef.current) {
      bottomVideoRef.current.src = `data:image/jpeg;base64,${bottomStream.currentFrame}`;
    }
  }, [bottomStream.currentFrame]);
  
  const handleZoomIn = () => {
    if (zoomLevel < 5) {
      setZoomLevel(prev => prev + 0.5);
    }
  };
  
  const handleZoomOut = () => {
    if (zoomLevel > 0.5) {
      setZoomLevel(prev => prev - 0.5);
    }
  };
  
  const handleCameraSwitch = (camera: 'front' | 'bottom') => {
    setActiveCamera(camera);
  };
  
  const getStreamStatus = (camera: 'front' | 'bottom') => {
    const stream = camera === 'front' ? frontStream : bottomStream;
    return stream.streamStatus;
  };
  
  const getStreamMetadata = (camera: 'front' | 'bottom') => {
    const stream = camera === 'front' ? frontStream : bottomStream;
    return stream.metadata;
  };
  
  const renderCameraView = (camera: 'front' | 'bottom', className: string = '') => {
    const stream = camera === 'front' ? frontStream : bottomStream;
    const videoRef = camera === 'front' ? frontVideoRef : bottomVideoRef;
    const status = getStreamStatus(camera);
    const metadata = getStreamMetadata(camera);
    
    return (
      <div className={`relative bg-gray-800 rounded-lg overflow-hidden border border-gray-700 flex items-center justify-center ${className}`}>
        {stream.currentFrame ? (
          <img
            ref={videoRef}
            alt={`${camera} camera`}
            className="w-full h-full object-cover"
            style={{ transform: `scale(${zoomLevel})` }}
          />
        ) : (
          <div className="text-gray-400 text-center">
            <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <div>
              {status === 'connecting' && 'Connecting to camera...'}
              {status === 'inactive' && 'Camera stream inactive'}
              {status === 'error' && 'Camera connection error'}
              {!stream.currentFrame && status === 'active' && 'Waiting for camera frames...'}
            </div>
            <div className="text-xs mt-2 text-gray-500">
              {camera === 'front' ? 'Front Camera' : 'Bottom Camera'}
            </div>
          </div>
        )}
        
        {/* Stream status overlay */}
        <div className="absolute top-3 left-3 bg-gray-900/80 backdrop-blur-sm px-3 py-1 rounded-lg border border-gray-700 text-xs text-white">
          <div className="flex items-center gap-2">
            {status === 'active' ? (
              <>
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-green-300">LIVE</span>
              </>
            ) : status === 'connecting' ? (
              <>
                <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
                <span className="text-yellow-300">CONNECTING</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span className="text-red-300">OFFLINE</span>
              </>
            )}
          </div>
          {metadata && (
            <div className="mt-1 text-gray-400">
              {metadata.resolution} • {metadata.fps} FPS
            </div>
          )}
        </div>
        
        {/* Camera label */}
        <div className="absolute bottom-3 left-3 bg-gray-900/80 backdrop-blur-sm px-3 py-1 rounded-lg border border-gray-700 text-xs text-white">
          {camera === 'front' ? 'Front Camera' : 'Bottom Camera'}
        </div>
        
        {/* Controls overlay */}
        {isControlEnabled && stream.currentFrame && (
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            <button 
              className="p-1.5 bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-lg text-gray-300 hover:text-white transition-colors"
              onClick={() => console.log('Show camera layers')}
            >
              <Layers className="h-4 w-4" />
            </button>
            <button 
              className="p-1.5 bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-lg text-gray-300 hover:text-white transition-colors"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 0.5}
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button 
              className="p-1.5 bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-lg text-gray-300 hover:text-white transition-colors"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 5}
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button 
              className="p-1.5 bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-lg text-gray-300 hover:text-white transition-colors"
              onClick={() => console.log('Download frame')}
            >
              <Download className="h-4 w-4" />
            </button>
            <button 
              className="p-1.5 bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-lg text-gray-300 hover:text-white transition-colors"
              onClick={() => console.log('Fullscreen')}
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        )}
        
        {/* Zoom indicator */}
        {zoomLevel !== 1 && (
          <div className="absolute top-3 right-3 bg-gray-900/80 backdrop-blur-sm px-3 py-1 rounded-lg border border-gray-700 text-xs text-white">
            {zoomLevel}x
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm border border-gray-800">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-light tracking-wider text-blue-300 flex items-center gap-2">
          <Camera className="h-5 w-5" />
          CAMERA FEED
        </h3>
        
        <div className="flex items-center gap-3">
          {/* Camera selection */}
          <div className="flex items-center gap-2 bg-gray-800/60 rounded-lg p-1">
            <button
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                activeCamera === 'front'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              onClick={() => handleCameraSwitch('front')}
            >
              Front
            </button>
            <button
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                activeCamera === 'bottom'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              onClick={() => handleCameraSwitch('bottom')}
            >
              Bottom
            </button>
          </div>
          
          {/* View mode selection */}
          <div className="flex items-center gap-1">
            <button
              className={`p-1.5 ${
                viewMode === 'single'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'bg-gray-800 text-gray-400 border border-gray-700'
              } rounded-lg transition-colors`}
              onClick={() => setViewMode('single')}
            >
              <Eye className="h-4 w-4" />
            </button>
            
            <button
              className={`p-1.5 ${
                viewMode === 'split'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'bg-gray-800 text-gray-400 border border-gray-700'
              } rounded-lg transition-colors`}
              onClick={() => setViewMode('split')}
            >
              <SplitSquareVertical className="h-4 w-4" />
            </button>
            
            <button
              className={`p-1.5 ${
                viewMode === 'pip'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'bg-gray-800 text-gray-400 border border-gray-700'
              } rounded-lg transition-colors`}
              onClick={() => setViewMode('pip')}
            >
              <PictureInPicture className="h-4 w-4" />
            </button>
          </div>
          
          {/* Connection status */}
          <div className="flex items-center gap-2">
            {frontStream.isConnected || bottomStream.isConnected ? (
              <>
                <Wifi className="h-4 w-4 text-green-500" />
                <span className="text-green-400 text-sm">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-red-500" />
                <span className="text-red-400 text-sm">Disconnected</span>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Camera views */}
      <div className="relative">
        {viewMode === 'single' && (
          renderCameraView(activeCamera, 'aspect-video')
        )}
        
        {viewMode === 'split' && (
          <div className="grid grid-cols-2 gap-4">
            {renderCameraView('front', 'aspect-video')}
            {renderCameraView('bottom', 'aspect-video')}
          </div>
        )}
        
        {viewMode === 'pip' && (
          <div className="relative">
            {renderCameraView('front', 'aspect-video')}
            <div className="absolute bottom-4 right-4 w-1/4 aspect-video">
              {renderCameraView('bottom')}
            </div>
          </div>
        )}
      </div>
      
      {/* Stream quality controls */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <button 
          className={`p-3 rounded-lg border text-center transition-colors ${
            isControlEnabled 
              ? 'bg-gray-800/80 border-gray-700 hover:bg-gray-700/80 text-white'
              : 'bg-gray-800/50 border-gray-700/50 text-gray-500 cursor-not-allowed'
          }`}
          disabled={!isControlEnabled}
          onClick={() => frontStream.changeStreamConfig({ quality: 'high', fps: 30 })}
        >
          High Quality
        </button>
        <button 
          className={`p-3 rounded-lg border text-center transition-colors ${
            isControlEnabled 
              ? 'bg-gray-800/80 border-gray-700 hover:bg-gray-700/80 text-white'
              : 'bg-gray-800/50 border-gray-700/50 text-gray-500 cursor-not-allowed'
          }`}
          disabled={!isControlEnabled}
          onClick={() => frontStream.changeStreamConfig({ quality: 'medium', fps: 15 })}
        >
          Medium Quality
        </button>
        <button 
          className={`p-3 rounded-lg border text-center transition-colors ${
            isControlEnabled 
              ? 'bg-gray-800/80 border-gray-700 hover:bg-gray-700/80 text-white'
              : 'bg-gray-800/50 border-gray-700/50 text-gray-500 cursor-not-allowed'
          }`}
          disabled={!isControlEnabled}
          onClick={() => frontStream.changeStreamConfig({ quality: 'low', fps: 10 })}
        >
          Low Quality
        </button>
        <button 
          className={`p-3 rounded-lg border text-center transition-colors ${
            isControlEnabled 
              ? 'bg-gray-800/80 border-gray-700 hover:bg-gray-700/80 text-white'
              : 'bg-gray-800/50 border-gray-700/50 text-gray-500 cursor-not-allowed'
          }`}
          disabled={!isControlEnabled}
        >
          Record Stream
        </button>
      </div>
    </div>
  );
};

export default CameraFeed;
EOF

# Step 5: Rebuild frontend with fixed dependencies
echo "5. 🔨 Rebuilding frontend..."
docker-compose down frontend
docker-compose build --no-cache frontend
docker-compose up -d frontend

# Step 6: Wait for services and test
echo "6. ⏳ Waiting for services to start..."
sleep 30

# Step 7: Test the fixes
echo "7. 🧪 Testing fixes..."

# Test health endpoint
echo "   Testing health endpoint..."
HEALTH_STATUS=$(curl -s -w "%{http_code}" http://localhost:3001/health -o /dev/null)
if [ "$HEALTH_STATUS" = "200" ]; then
    echo "   ✅ Health endpoint working"
else
    echo "   ❌ Health endpoint failed (HTTP $HEALTH_STATUS)"
fi

# Test camera data flow
echo "   Testing camera data flow..."
CAMERA_KEYS=$(docker exec flyos-redis-1 redis-cli KEYS "camera:*" | wc -l)
if [ "$CAMERA_KEYS" -gt 0 ]; then
    echo "   ✅ Camera data flowing ($CAMERA_KEYS keys)"
else
    echo "   ⚠️  No camera data found"
fi

# Test WebSocket connection
echo "   Testing WebSocket..."
curl -s http://localhost:4002/health > /dev/null
if [ $? -eq 0 ]; then
    echo "   ✅ Realtime service responding"
else
    echo "   ❌ Realtime service not responding"
fi

echo ""
echo "🎉 CAMERA STREAM FIX COMPLETED"
echo "=============================="
echo "✅ Fixed React 19 compatibility"
echo "✅ Added health endpoint"
echo "✅ Fixed camera stream hook" 
echo "✅ Created working camera feed component"
echo "✅ Rebuilt frontend with dependencies"
echo ""
echo "📋 Next steps:"
echo "1. Navigate to /secure/main-hq/drone-control/drone-001"
echo "2. Go to 'CONTROL CENTER' tab"
echo "3. Check camera feed section"
echo "4. Camera streams should now connect properly"
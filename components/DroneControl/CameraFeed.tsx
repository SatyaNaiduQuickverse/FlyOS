// components/DroneControl/CameraFeed.tsx - ENHANCED WITH BINARY OPTIMIZATION SUPPORT
import React, { useState, useEffect, useRef } from 'react';
import { Camera, Eye, Maximize2, SplitSquareVertical, PictureInPicture, Download, ZoomIn, ZoomOut, Layers, Wifi, WifiOff, Zap, Settings } from 'lucide-react';
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

interface OptimizationSettings {
  enableBinaryFrames: boolean;
  enableDecompression: boolean;
  adaptiveQuality: boolean;
  maxFrameRate: number;
  transport: 'binary' | 'json' | 'auto';
}

const CameraFeed: React.FC<CameraFeedProps> = ({ drone, isControlEnabled }) => {
  const [activeCamera, setActiveCamera] = useState<'front' | 'bottom'>('front');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [viewMode, setViewMode] = useState<'single' | 'split' | 'pip'>('single');
  const [useOptimizedStreaming, setUseOptimizedStreaming] = useState(true); // NEW: Toggle optimization
  const [showOptimizationSettings, setShowOptimizationSettings] = useState(false);
  const [optimizationSettings, setOptimizationSettings] = useState<OptimizationSettings>({
    enableBinaryFrames: true,
    enableDecompression: true,
    adaptiveQuality: true,
    maxFrameRate: 30,
    transport: 'auto'
  });
  
  // ENHANCED: Use optimized streams when available, fallback to legacy
  const frontStreamOptimized = useCameraStream(
    drone.id, 
    'front', 
    useOptimizedStreaming ? optimizationSettings : null
  );
  const bottomStreamOptimized = useCameraStream(
    drone.id, 
    'bottom', 
    useOptimizedStreaming ? optimizationSettings : null
  );
  
  // COMPATIBILITY: Legacy camera streams (still work!)
  const frontStreamLegacy = useCameraStream(drone.id, 'front');
  const bottomStreamLegacy = useCameraStream(drone.id, 'bottom');
  
  // Choose which streams to use based on optimization setting
  const frontStream = useOptimizedStreaming ? frontStreamOptimized : frontStreamLegacy;
  const bottomStream = useOptimizedStreaming ? bottomStreamOptimized : bottomStreamLegacy;
  
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

  // NEW: Get optimization metrics
  const getOptimizationMetrics = (camera: 'front' | 'bottom') => {
    if (!useOptimizedStreaming) return null;
    const stream = camera === 'front' ? frontStreamOptimized : bottomStreamOptimized;
    return stream.optimizationMetrics || null;
  };

  // NEW: Handle optimization settings change
  const handleOptimizationChange = (newSettings: Partial<OptimizationSettings>) => {
    setOptimizationSettings(prev => ({ ...prev, ...newSettings }));
    
    // Apply settings to active streams
    if (useOptimizedStreaming) {
      frontStreamOptimized.updateOptimizationSettings?.(newSettings);
      bottomStreamOptimized.updateOptimizationSettings?.(newSettings);
    }
  };

  // NEW: Toggle between optimized and legacy streaming
  const toggleOptimizedStreaming = () => {
    setUseOptimizedStreaming(prev => !prev);
  };
  
  const renderCameraView = (camera: 'front' | 'bottom', className: string = '') => {
    const stream = camera === 'front' ? frontStream : bottomStream;
    const videoRef = camera === 'front' ? frontVideoRef : bottomVideoRef;
    const status = getStreamStatus(camera);
    const metadata = getStreamMetadata(camera);
    const optimizationMetrics = getOptimizationMetrics(camera);
    
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
        
        {/* ENHANCED: Stream status overlay with optimization info */}
        <div className="absolute top-3 left-3 bg-gray-900/80 backdrop-blur-sm px-3 py-1 rounded-lg border border-gray-700 text-xs text-white">
          <div className="flex items-center gap-2">
            {status === 'active' ? (
              <>
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-green-300">LIVE</span>
                {useOptimizedStreaming && (
                  <Zap className="h-3 w-3 text-blue-400" title="Optimized streaming active" />
                )}
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
              {optimizationMetrics && (
                <>
                  <br />
                  {optimizationMetrics.transport === 'binary' && '📦 Binary'}
                  {optimizationMetrics.compressionRatio && 
                    ` • ${optimizationMetrics.compressionRatio.toFixed(1)}x compression`}
                </>
              )}
            </div>
          )}
        </div>
        
        {/* Camera label */}
        <div className="absolute bottom-3 left-3 bg-gray-900/80 backdrop-blur-sm px-3 py-1 rounded-lg border border-gray-700 text-xs text-white">
          {camera === 'front' ? 'Front Camera' : 'Bottom Camera'}
          {useOptimizedStreaming && (
            <div className="text-blue-400 text-xs mt-1">
              Optimized • {optimizationSettings.transport}
            </div>
          )}
        </div>
        
        {/* NEW: Optimization metrics overlay */}
        {useOptimizedStreaming && optimizationMetrics && (
          <div className="absolute top-3 right-3 bg-gray-900/90 backdrop-blur-sm px-2 py-1 rounded-lg border border-gray-700 text-xs">
            <div className="text-blue-300 font-medium">Performance</div>
            <div className="text-gray-300 space-y-1">
              {optimizationMetrics.skipRate !== undefined && (
                <div>Skip: {optimizationMetrics.skipRate.toFixed(1)}%</div>
              )}
              {optimizationMetrics.actualFPS && (
                <div>FPS: {optimizationMetrics.actualFPS.toFixed(1)}</div>
              )}
              {optimizationMetrics.compressionRatio && (
                <div>Comp: {optimizationMetrics.compressionRatio.toFixed(1)}x</div>
              )}
            </div>
          </div>
        )}
        
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
          <div className="absolute top-16 right-3 bg-gray-900/80 backdrop-blur-sm px-3 py-1 rounded-lg border border-gray-700 text-xs text-white">
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
          {useOptimizedStreaming && (
            <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-lg border border-blue-500/30">
              OPTIMIZED
            </span>
          )}
        </h3>
        
        <div className="flex items-center gap-3">
          {/* NEW: Optimization toggle */}
          <button
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              useOptimizedStreaming
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
            }`}
            onClick={toggleOptimizedStreaming}
          >
            <Zap className="h-4 w-4" />
            {useOptimizedStreaming ? 'Optimized' : 'Legacy'}
          </button>

          {/* NEW: Optimization settings */}
          {useOptimizedStreaming && (
            <button
              className="p-2 bg-gray-800 text-gray-400 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors"
              onClick={() => setShowOptimizationSettings(!showOptimizationSettings)}
            >
              <Settings className="h-4 w-4" />
            </button>
          )}
          
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

      {/* NEW: Optimization settings panel */}
      {showOptimizationSettings && useOptimizedStreaming && (
        <div className="mb-6 bg-gray-800/60 p-4 rounded-lg border border-gray-700">
          <h4 className="text-sm font-medium text-blue-300 mb-4">Optimization Settings</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={optimizationSettings.enableBinaryFrames}
                onChange={(e) => handleOptimizationChange({ enableBinaryFrames: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm text-gray-300">Binary Frames</span>
            </label>
            
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={optimizationSettings.enableDecompression}
                onChange={(e) => handleOptimizationChange({ enableDecompression: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm text-gray-300">Decompression</span>
            </label>
            
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={optimizationSettings.adaptiveQuality}
                onChange={(e) => handleOptimizationChange({ adaptiveQuality: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm text-gray-300">Adaptive Quality</span>
            </label>
            
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-300">Max FPS:</label>
              <select
                value={optimizationSettings.maxFrameRate}
                onChange={(e) => handleOptimizationChange({ maxFrameRate: Number(e.target.value) })}
                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={30}>30</option>
                <option value={60}>60</option>
              </select>
            </div>
          </div>
        </div>
      )}
      
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
      
      {/* ENHANCED: Stream quality controls with optimization options */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <button 
          className={`p-3 rounded-lg border text-center transition-colors ${
            isControlEnabled 
              ? 'bg-gray-800/80 border-gray-700 hover:bg-gray-700/80 text-white'
              : 'bg-gray-800/50 border-gray-700/50 text-gray-500 cursor-not-allowed'
          }`}
          disabled={!isControlEnabled}
          onClick={() => {
            const config = { quality: 'high', fps: 30 };
            if (useOptimizedStreaming) {
              frontStreamOptimized.changeStreamConfig?.(config);
              bottomStreamOptimized.changeStreamConfig?.(config);
            } else {
              frontStreamLegacy.changeStreamConfig?.(config);
              bottomStreamLegacy.changeStreamConfig?.(config);
            }
          }}
        >
          High Quality
          {useOptimizedStreaming && <div className="text-xs text-blue-400 mt-1">Binary + Compression</div>}
        </button>
        <button 
          className={`p-3 rounded-lg border text-center transition-colors ${
            isControlEnabled 
              ? 'bg-gray-800/80 border-gray-700 hover:bg-gray-700/80 text-white'
              : 'bg-gray-800/50 border-gray-700/50 text-gray-500 cursor-not-allowed'
          }`}
          disabled={!isControlEnabled}
          onClick={() => {
            const config = { quality: 'medium', fps: 15 };
            if (useOptimizedStreaming) {
              frontStreamOptimized.changeStreamConfig?.(config);
              bottomStreamOptimized.changeStreamConfig?.(config);
            } else {
              frontStreamLegacy.changeStreamConfig?.(config);
              bottomStreamLegacy.changeStreamConfig?.(config);
            }
          }}
        >
          Medium Quality
          {useOptimizedStreaming && <div className="text-xs text-blue-400 mt-1">Adaptive FPS</div>}
        </button>
        <button 
          className={`p-3 rounded-lg border text-center transition-colors ${
            isControlEnabled 
              ? 'bg-gray-800/80 border-gray-700 hover:bg-gray-700/80 text-white'
              : 'bg-gray-800/50 border-gray-700/50 text-gray-500 cursor-not-allowed'
          }`}
          disabled={!isControlEnabled}
          onClick={() => {
            const config = { quality: 'low', fps: 10 };
            if (useOptimizedStreaming) {
              frontStreamOptimized.changeStreamConfig?.(config);
              bottomStreamOptimized.changeStreamConfig?.(config);
            } else {
              frontStreamLegacy.changeStreamConfig?.(config);
              bottomStreamLegacy.changeStreamConfig?.(config);
            }
          }}
        >
          Low Quality
          {useOptimizedStreaming && <div className="text-xs text-blue-400 mt-1">High Compression</div>}
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
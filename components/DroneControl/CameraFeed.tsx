// components/DroneControl/CameraFeed.tsx
import React, { useState } from 'react';
import { Camera, Eye, Maximize2, SplitSquareVertical, PictureInPicture, Download, ZoomIn, ZoomOut, Layers } from 'lucide-react';

interface DroneBasic {
  id: string;
  model: string;
  status: string;
}

interface CameraFeedProps {
  drone: DroneBasic;
  isControlEnabled: boolean;
}

const CameraFeed: React.FC<CameraFeedProps> = ({ isControlEnabled }) => {
  const [activeCamera, setActiveCamera] = useState('main');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [viewMode, setViewMode] = useState('single');
  
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
  
  return (
    <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm border border-gray-800">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-light tracking-wider text-blue-300 flex items-center gap-2">
          <Camera className="h-5 w-5" />
          CAMERA FEED
        </h3>
        
        <div className="flex items-center gap-3">
          <select
            className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-sm"
            value={activeCamera}
            onChange={(e) => setActiveCamera(e.target.value)}
            disabled={!isControlEnabled}
          >
            <option value="main">Main Camera</option>
            <option value="infrared">Infrared</option>
            <option value="thermal">Thermal Vision</option>
            <option value="night">Night Vision</option>
          </select>
          
          <button
            className={`p-1.5 ${
              viewMode === 'single'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                : 'bg-gray-800 text-gray-400 border border-gray-700'
            } rounded-lg transition-colors`}
            onClick={() => setViewMode('single')}
            disabled={!isControlEnabled}
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
            disabled={!isControlEnabled}
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
            disabled={!isControlEnabled}
          >
            <PictureInPicture className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      {/* Camera view */}
      <div className="relative">
        {viewMode === 'single' && (
          <div className="aspect-video bg-gray-800 rounded-lg overflow-hidden border border-gray-700 flex items-center justify-center relative">
            <div className="text-gray-400">Camera feed will be displayed here</div>
            
            {/* Overlay for camera type */}
            <div className="absolute top-3 left-3 bg-gray-900/80 backdrop-blur-sm px-3 py-1 rounded-lg border border-gray-700 text-xs text-white">
              {activeCamera === 'main' && 'Main Camera'}
              {activeCamera === 'infrared' && 'Infrared View'}
              {activeCamera === 'thermal' && 'Thermal Vision'}
              {activeCamera === 'night' && 'Night Vision'}
            </div>
            
            {/* Overlay for status info */}
            <div className="absolute bottom-3 left-3 bg-gray-900/80 backdrop-blur-sm px-3 py-1 rounded-lg border border-gray-700 text-xs flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span className="text-blue-300">LIVE</span>
              </div>
              <span className="text-gray-400">|</span>
              <span className="text-white">1080p</span>
              <span className="text-gray-400">|</span>
              <span className="text-white">30 FPS</span>
            </div>
            
            {/* Camera controls overlay */}
            {isControlEnabled && (
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                <button className="p-1.5 bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-lg text-gray-300 hover:text-white transition-colors">
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
                <button className="p-1.5 bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-lg text-gray-300 hover:text-white transition-colors">
                  <Download className="h-4 w-4" />
                </button>
                <button className="p-1.5 bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-lg text-gray-300 hover:text-white transition-colors">
                  <Maximize2 className="h-4 w-4" />
                </button>
              </div>
            )}
            
            {/* Zoom indicator */}
            <div className="absolute top-3 right-3 bg-gray-900/80 backdrop-blur-sm px-3 py-1 rounded-lg border border-gray-700 text-xs text-white">
              {zoomLevel}x
            </div>
          </div>
        )}
        
        {viewMode === 'split' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="aspect-video bg-gray-800 rounded-lg overflow-hidden border border-gray-700 flex items-center justify-center relative">
              <div className="text-gray-400">Main Camera</div>
              {isControlEnabled && (
                <div className="absolute bottom-2 right-2 flex items-center gap-2">
                  <button className="p-1 bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-lg text-xs text-gray-300">
                    <ZoomIn className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
            <div className="aspect-video bg-gray-800 rounded-lg overflow-hidden border border-gray-700 flex items-center justify-center relative">
              <div className="text-gray-400">
                {activeCamera === 'infrared' && 'Infrared View'}
                {activeCamera === 'thermal' && 'Thermal Vision'}
                {activeCamera === 'night' && 'Night Vision'}
              </div>
              {isControlEnabled && (
                <div className="absolute bottom-2 right-2 flex items-center gap-2">
                  <button className="p-1 bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-lg text-xs text-gray-300">
                    <ZoomIn className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        
        {viewMode === 'pip' && (
          <div className="relative">
            <div className="aspect-video bg-gray-800 rounded-lg overflow-hidden border border-gray-700 flex items-center justify-center">
              <div className="text-gray-400">Main Camera</div>
            </div>
            <div className="absolute bottom-4 right-4 w-1/4 aspect-video bg-gray-800 rounded-lg overflow-hidden border-2 border-gray-700 flex items-center justify-center text-xs">
              <div className="text-gray-400">
                {activeCamera === 'infrared' && 'Infrared View'}
                {activeCamera === 'thermal' && 'Thermal Vision'}
                {activeCamera === 'night' && 'Night Vision'}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Camera presets and options */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <button 
          className={`p-3 rounded-lg border text-center ${
            isControlEnabled 
              ? 'bg-gray-800/80 border-gray-700 hover:bg-gray-700/80 text-white transition-colors'
              : 'bg-gray-800/50 border-gray-700/50 text-gray-500 cursor-not-allowed'
          }`}
          disabled={!isControlEnabled}
        >
          Surveillance Mode
        </button>
        <button 
          className={`p-3 rounded-lg border text-center ${
            isControlEnabled 
              ? 'bg-gray-800/80 border-gray-700 hover:bg-gray-700/80 text-white transition-colors'
              : 'bg-gray-800/50 border-gray-700/50 text-gray-500 cursor-not-allowed'
          }`}
          disabled={!isControlEnabled}
        >
          Tracking Mode
        </button>
        <button 
          className={`p-3 rounded-lg border text-center ${
            isControlEnabled 
              ? 'bg-gray-800/80 border-gray-700 hover:bg-gray-700/80 text-white transition-colors'
              : 'bg-gray-800/50 border-gray-700/50 text-gray-500 cursor-not-allowed'
          }`}
          disabled={!isControlEnabled}
        >
          Object Detection
        </button>
        <button 
          className={`p-3 rounded-lg border text-center ${
            isControlEnabled 
              ? 'bg-gray-800/80 border-gray-700 hover:bg-gray-700/80 text-white transition-colors'
              : 'bg-gray-800/50 border-gray-700/50 text-gray-500 cursor-not-allowed'
          }`}
          disabled={!isControlEnabled}
        >
          Record Footage
        </button>
      </div>
    </div>
  );
};

export default CameraFeed;
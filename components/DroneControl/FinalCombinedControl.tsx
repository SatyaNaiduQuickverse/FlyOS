// Final Combined Control with Enhanced Emergency Controls
import React, { useState } from 'react';
import { 
  Camera, Eye, Maximize2, SplitSquareVertical, 
  PictureInPicture, Download, ZoomIn, ZoomOut, Layers,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight, 
  Navigation
} from 'lucide-react';
import EnhancedEmergencyControls from './EnhancedEmergencyControls';

interface DroneBasic {
  id: string;
  model: string;
  status: string;
  altitude?: number;
  speed?: number;
}

interface CombinedControlProps {
  drone: DroneBasic;
}

const FinalCombinedControl: React.FC<CombinedControlProps> = ({ drone }) => {
  // Camera state
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
  
  // Emergency functions
  const handleEmergencyHold = () => {
    console.log('EMERGENCY: Holding drone position');
  };
  
  const handleReturnToBase = () => {
    console.log('EMERGENCY: Returning drone to base');
  };
  
  const handleEmergencyShutdown = () => {
    console.log('EMERGENCY: Shutting down drone systems');
  };
  
  return (
    <div>
      {/* Emergency Controls at the top for quick access */}
      <div className="mb-6">
        <EnhancedEmergencyControls 
          onHoldPosition={handleEmergencyHold}
          onReturnToBase={handleReturnToBase}
          onEmergencyShutdown={handleEmergencyShutdown}
        />
      </div>
    
      <div className="grid grid-cols-12 gap-6">
        {/* Left side - Camera feed (8 columns) */}
        <div className="col-span-12 lg:col-span-8 bg-gray-900/80 rounded-lg shadow-lg backdrop-blur-sm border border-gray-800">
          <div className="flex justify-between items-center p-4 border-b border-gray-800">
            <h3 className="text-lg font-light tracking-wider text-blue-300 flex items-center gap-2">
              <Camera className="h-5 w-5" />
              CAMERA FEED
            </h3>
            
            <div className="flex items-center gap-3">
              <select
                className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-sm"
                value={activeCamera}
                onChange={(e) => setActiveCamera(e.target.value)}
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
          </div>
          
          {/* Camera view */}
          <div className="relative p-4">
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
                </div>
                <div className="aspect-video bg-gray-800 rounded-lg overflow-hidden border border-gray-700 flex items-center justify-center relative">
                  <div className="text-gray-400">
                    {activeCamera === 'infrared' && 'Infrared View'}
                    {activeCamera === 'thermal' && 'Thermal Vision'}
                    {activeCamera === 'night' && 'Night Vision'}
                  </div>
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
        </div>

        {/* Right side - Control panel (4 columns) */}
        <div className="col-span-12 lg:col-span-4 bg-gray-900/80 rounded-lg shadow-lg backdrop-blur-sm border border-gray-800">
          <div className="p-4 border-b border-gray-800">
            <h3 className="text-lg font-light tracking-wider text-blue-300 flex items-center gap-2">
              <Navigation className="h-5 w-5" />
              FLIGHT CONTROL
            </h3>
          </div>
          
          <div className="p-4 space-y-6">
            {/* Directional Control */}
            <div className="bg-gray-800/80 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-300 mb-4">DIRECTIONAL CONTROL</h4>
              
              <div className="flex flex-col items-center gap-2">
                <button className="p-3 bg-gray-700 hover:bg-blue-900/30 rounded-lg transition-colors">
                  <ArrowUp className="h-6 w-6 text-blue-400" />
                </button>
                
                <div className="flex gap-2">
                  <button className="p-3 bg-gray-700 hover:bg-blue-900/30 rounded-lg transition-colors">
                    <ArrowLeft className="h-6 w-6 text-blue-400" />
                  </button>
                  
                  <button className="p-3 bg-gray-700 hover:bg-blue-900/30 rounded-lg transition-colors">
                    <ArrowDown className="h-6 w-6 text-blue-400" />
                  </button>
                  
                  <button className="p-3 bg-gray-700 hover:bg-blue-900/30 rounded-lg transition-colors">
                    <ArrowRight className="h-6 w-6 text-blue-400" />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Altitude Control */}
            <div className="bg-gray-800/80 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-300 mb-4">ALTITUDE CONTROL</h4>
              
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Current Altitude:</span>
                  <span className="text-white">{drone.altitude || 0} m</span>
                </div>
                
                <div className="flex gap-2">
                  <button className="flex-1 py-3 bg-gray-700 hover:bg-blue-900/30 rounded-lg transition-colors flex items-center justify-center gap-2">
                    <ArrowUp className="h-4 w-4 text-blue-400" />
                    <span>Increase Altitude</span>
                  </button>
                  
                  <button className="flex-1 py-3 bg-gray-700 hover:bg-blue-900/30 rounded-lg transition-colors flex items-center justify-center gap-2">
                    <ArrowDown className="h-4 w-4 text-blue-400" />
                    <span>Decrease Altitude</span>
                  </button>
                </div>
              </div>
            </div>
            
            {/* Speed Controls */}
            <div className="bg-gray-800/80 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-300 mb-4">SPEED CONTROL</h4>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Current Speed:</span>
                  <span className="text-white">{drone.speed || 0} km/h</span>
                </div>
                
                <div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={drone.speed || 0} 
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" 
                    readOnly
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>0</span>
                    <span>25</span>
                    <span>50</span>
                    <span>75</span>
                    <span>100</span>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button className="flex-1 py-2 bg-gray-700 hover:bg-blue-900/30 rounded-lg transition-colors text-sm">
                    DECREASE
                  </button>
                  <button className="flex-1 py-2 bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-300 hover:bg-blue-500/30 transition-colors text-sm">
                    MAINTAIN
                  </button>
                  <button className="flex-1 py-2 bg-gray-700 hover:bg-blue-900/30 rounded-lg transition-colors text-sm">
                    INCREASE
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinalCombinedControl;

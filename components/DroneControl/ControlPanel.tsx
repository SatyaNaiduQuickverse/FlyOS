// components/DroneControl/ControlPanel.tsx
import React from 'react';
import { Navigation, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Lock, AlertTriangle } from 'lucide-react';

interface DroneData {
  id: string;
  altitude?: number;
  speed?: number;
}

interface ControlPanelProps {
  drone: DroneData;
  isControlEnabled: boolean;
  onRequestControl: () => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ 
  drone, 
  isControlEnabled,
  onRequestControl 
}) => {
  return (
    <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm border border-gray-800">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-light tracking-wider text-blue-300 flex items-center gap-2">
          <Navigation className="h-5 w-5" />
          FLIGHT CONTROL
        </h3>
        
        {!isControlEnabled && (
          <button
            onClick={onRequestControl}
            className="px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-300 text-sm hover:bg-blue-500/30 transition-colors"
          >
            REQUEST CONTROL
          </button>
        )}
      </div>
      
      {!isControlEnabled ? (
        <div className="bg-gray-800/80 rounded-lg p-8 text-center">
          <Lock className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <h4 className="text-xl font-light text-gray-400 mb-2">Control Lock Active</h4>
          <p className="text-sm text-gray-500 mb-6">You are currently in monitor mode. Request control to operate this drone.</p>
          <button
            onClick={onRequestControl}
            className="px-6 py-3 bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-300 hover:bg-blue-500/30 transition-colors"
          >
            REQUEST CONTROL ACCESS
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Navigation Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-800/80 rounded-lg p-6">
              <h4 className="text-sm font-medium text-gray-300 mb-4">DIRECTIONAL CONTROL</h4>
              
              <div className="flex flex-col items-center gap-2">
                <button className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
                  <ArrowUp className="h-6 w-6 text-blue-400" />
                </button>
                
                <div className="flex gap-2">
                  <button className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
                    <ArrowLeft className="h-6 w-6 text-blue-400" />
                  </button>
                  
                  <button className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
                    <ArrowDown className="h-6 w-6 text-blue-400" />
                  </button>
                  
                  <button className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
                    <ArrowRight className="h-6 w-6 text-blue-400" />
                  </button>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-800/80 rounded-lg p-6">
              <h4 className="text-sm font-medium text-gray-300 mb-4">ALTITUDE CONTROL</h4>
              
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Current Altitude:</span>
                  <span className="text-white">{drone.altitude || 0} m</span>
                </div>
                
                <div className="flex gap-2">
                  <button className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors flex items-center justify-center gap-2">
                    <ArrowUp className="h-4 w-4 text-blue-400" />
                    <span>Increase Altitude</span>
                  </button>
                  
                  <button className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors flex items-center justify-center gap-2">
                    <ArrowDown className="h-4 w-4 text-blue-400" />
                    <span>Decrease Altitude</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Speed Controls */}
          <div className="bg-gray-800/80 rounded-lg p-6">
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
                <button className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-sm">
                  DECREASE
                </button>
                <button className="flex-1 py-2 bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-300 hover:bg-blue-500/30 transition-colors text-sm">
                  MAINTAIN
                </button>
                <button className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-sm">
                  INCREASE
                </button>
              </div>
            </div>
          </div>
          
          {/* Emergency Controls */}
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <h4 className="text-sm font-medium text-red-300">EMERGENCY CONTROLS</h4>
            </div>
            
            <div className="flex gap-4">
              <button className="flex-1 py-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 hover:bg-red-500/30 transition-colors">
                HOLD POSITION
              </button>
              
              <button className="flex-1 py-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 hover:bg-red-500/30 transition-colors">
                RETURN TO BASE
              </button>
              
              <button className="flex-1 py-3 bg-red-700/20 border border-red-700/30 rounded-lg text-red-400 hover:bg-red-700/30 transition-colors">
                EMERGENCY SHUTDOWN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ControlPanel;
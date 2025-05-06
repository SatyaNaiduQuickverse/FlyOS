// Enhanced Emergency Controls Component
import React, { useState } from 'react';
import { 
  AlertTriangle, ShieldAlert, Home, Power, 
  X, CheckCircle
} from 'lucide-react';

interface EmergencyControlsProps {
  onHoldPosition: () => void;
  onReturnToBase: () => void;
  onEmergencyShutdown: () => void;
}

const EnhancedEmergencyControls: React.FC<EmergencyControlsProps> = ({
  onHoldPosition,
  onReturnToBase,
  onEmergencyShutdown
}) => {
  const [confirmShutdown, setConfirmShutdown] = useState(false);
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  
  const handleHoldPosition = () => {
    onHoldPosition();
    showNotification('HOLDING POSITION: Drone will maintain current altitude and coordinates');
  };
  
  const handleReturnToBase = () => {
    onReturnToBase();
    showNotification('RETURNING TO BASE: Drone will fly back to home coordinates');
  };
  
  const handleEmergencyShutdown = () => {
    if (confirmShutdown) {
      onEmergencyShutdown();
      setConfirmShutdown(false);
      showNotification('EMERGENCY SHUTDOWN INITIATED: All systems powering down');
    } else {
      setConfirmShutdown(true);
    }
  };
  
  const cancelShutdown = () => {
    setConfirmShutdown(false);
  };
  
  const showNotification = (message: string) => {
    setNotificationMessage(message);
    setNotificationVisible(true);
    setTimeout(() => {
      setNotificationVisible(false);
    }, 5000);
  };
  
  return (
    <div className="relative">
      {/* Notification */}
      {notificationVisible && (
        <div className="absolute -top-16 left-0 right-0 bg-blue-900/30 border border-blue-500/40 text-blue-300 px-4 py-3 rounded-lg flex items-center justify-between transition-opacity duration-300 z-10">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            <span>{notificationMessage}</span>
          </div>
          <button 
            onClick={() => setNotificationVisible(false)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      
      {/* Emergency Controls */}
      <div className="bg-gray-900/60 rounded-lg p-4 border border-red-500/20">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="h-6 w-6 text-red-400" />
          <h4 className="text-base font-medium text-red-300">EMERGENCY CONTROLS</h4>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Hold Position Button */}
          <button 
            onClick={handleHoldPosition}
            className="relative overflow-hidden py-3 bg-amber-900/20 border border-amber-500/30 rounded-lg text-amber-300 hover:bg-amber-900/40 transition-all group"
          >
            <div className="absolute inset-0 flex justify-center items-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute inset-0 bg-amber-900/20"></div>
              <ShieldAlert className="h-20 w-20 text-amber-500/20" />
            </div>
            <div className="relative z-10 flex flex-col items-center justify-center">
              <ShieldAlert className="h-6 w-6 mb-1" />
              <span className="font-medium">HOLD POSITION</span>
              <span className="text-xs text-amber-400/80 mt-1">Maintain current coordinates</span>
            </div>
          </button>
          
          {/* Return to Base Button */}
          <button 
            onClick={handleReturnToBase}
            className="relative overflow-hidden py-3 bg-blue-900/20 border border-blue-500/30 rounded-lg text-blue-300 hover:bg-blue-900/40 transition-all group"
          >
            <div className="absolute inset-0 flex justify-center items-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute inset-0 bg-blue-900/20"></div>
              <Home className="h-20 w-20 text-blue-500/20" />
            </div>
            <div className="relative z-10 flex flex-col items-center justify-center">
              <Home className="h-6 w-6 mb-1" />
              <span className="font-medium">RETURN TO BASE</span>
              <span className="text-xs text-blue-400/80 mt-1">Automated flight to home</span>
            </div>
          </button>
          
          {/* Emergency Shutdown Button */}
          {confirmShutdown ? (
            <div className="bg-red-900/30 border border-red-500/40 rounded-lg p-3 text-center">
              <p className="text-red-300 mb-2">Confirm emergency shutdown?</p>
              <div className="flex gap-2">
                <button 
                  onClick={handleEmergencyShutdown}
                  className="flex-1 py-2 bg-red-700/40 hover:bg-red-700/60 rounded-lg text-white transition-colors"
                >
                  CONFIRM
                </button>
                <button 
                  onClick={cancelShutdown}
                  className="flex-1 py-2 bg-gray-700/80 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors"
                >
                  CANCEL
                </button>
              </div>
            </div>
          ) : (
            <button 
              onClick={handleEmergencyShutdown}
              className="relative overflow-hidden py-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-300 hover:bg-red-900/40 transition-all group"
            >
              <div className="absolute inset-0 flex justify-center items-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="absolute inset-0 bg-red-900/20"></div>
                <Power className="h-20 w-20 text-red-500/20" />
              </div>
              <div className="relative z-10 flex flex-col items-center justify-center">
                <Power className="h-6 w-6 mb-1" />
                <span className="font-medium">EMERGENCY SHUTDOWN</span>
                <span className="text-xs text-red-400/80 mt-1">Cut power to all systems</span>
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnhancedEmergencyControls;

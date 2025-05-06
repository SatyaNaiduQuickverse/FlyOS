// components/DroneControl/WaypointDropbox.tsx
import React, { useState, useRef, useEffect } from 'react';
// Comment out actual socket implementation
// import socketManager from '../../utils/socketManager';
// import { waypointStore } from '../../utils/waypointStore';

interface Waypoint {
  seq: number;
  lat: number;
  lng: number;
  alt: number;
}

// Mock socket manager for UI functionality with proper type definitions
const socketManager = {
  isConnected: (): boolean => true,
  connect: (): void => console.log('Mock: Socket connected'),
  disconnect: (): void => console.log('Mock: Socket disconnected'),
  subscribe: (event: string, callback: (data: any) => void): void => 
    console.log(`Mock: Subscribed to ${event}`),
  unsubscribe: (event: string, callback: (data: any) => void): void => 
    console.log(`Mock: Unsubscribed from ${event}`),
  sendCommand: (command: string, data?: any): boolean => {
    console.log(`Mock: Sending command ${command}`, data);
    return true;
  }
};

// Mock waypoint store for UI functionality
const waypointStore = {
  setWaypoints: (waypoints: Waypoint[]): void => console.log('Mock: Setting waypoints', waypoints),
};

interface StatusMessage {
  type: 'success' | 'error';
  message: string;
}

interface ValidationStatus {
  isValid: boolean;
  message: string;
}

const WaypointDropbox: React.FC = () => {
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [missionStatus, setMissionStatus] = useState<'idle' | 'uploaded' | 'running'>('idle');
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [validationStatus, setValidationStatus] = useState<ValidationStatus | null>(null);
  const [waypointCount, setWaypointCount] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(true); // Mock connected state
  const [isArmed, setIsArmed] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // Connect to drone
    socketManager.connect();

    // Subscribe to various status updates
    const handleConnection = (data: any): void => {
      // Mock implementation
      setIsConnected(true);
      console.log('Mock: Connected to drone');
    };

    const handleTelemetry = (data: any): void => {
      // Mock implementation
      // If real data is needed, uncomment and implement properly
      /*
      if (data.flight_mode === 'AUTO') {
        setMissionStatus('running');
      }
      if (data.armed !== undefined) {
        setIsArmed(data.armed);
      }
      */
    };

    const handleCommandResponse = (data: any): void => {
      // Mock implementation
      // Real implementation would process actual response data
      console.log('Mock Command response:', data);
    };

    socketManager.subscribe('connection', handleConnection);
    socketManager.subscribe('telemetry', handleTelemetry);
    socketManager.subscribe('command_response', handleCommandResponse);

    return () => {
      socketManager.unsubscribe('connection', handleConnection);
      socketManager.unsubscribe('telemetry', handleTelemetry);
      socketManager.unsubscribe('command_response', handleCommandResponse);
      socketManager.disconnect();
    };
  }, []);

  const validateWaypointFile = async (file: File): Promise<boolean> => {
    try {
      const content = await file.text();
      // Simplified validation for UI demo
      // Actual implementation would parse and validate the content
      
      console.log('Mock: Validating waypoint file');
      
      // Mock successful validation
      const mockWaypoints: Waypoint[] = Array(12).fill({}).map((_, i) => ({
        seq: i,
        lat: 40.7128 + (Math.random() * 0.01),
        lng: -74.0060 + (Math.random() * 0.01),
        alt: 100 + (Math.random() * 50)
      }));
      
      // Update waypoint store (mocked)
      waypointStore.setWaypoints(mockWaypoints);
      
      // Simulate sending to drone if connected
      if (socketManager.isConnected()) {
        socketManager.sendCommand('update_mission_data', {
          waypoints: mockWaypoints
        });
      }

      setValidationStatus({
        isValid: true,
        message: `Valid waypoint file with ${mockWaypoints.length} waypoints`
      });
      setWaypointCount(mockWaypoints.length);
      return true;

    } catch (error) {
      console.error("VALIDATION ERROR:", error);
      setValidationStatus({
        isValid: false,
        message: error instanceof Error ? error.message : 'Error validating waypoint file'
      });
      return false;
    }
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>): Promise<void> => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.txt')) {
        const isValid = await validateWaypointFile(file);
        if (isValid) {
          setSelectedFile(file);
          setStatusMessage(null);
        } else {
          setSelectedFile(null);
        }
      } else {
        setValidationStatus({
          isValid: false,
          message: 'Please upload a .txt file'
        });
      }
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files && event.target.files[0];
    if (file && file.name.endsWith('.txt')) {
      const isValid = await validateWaypointFile(file);
      if (isValid) {
        setSelectedFile(file);
        setStatusMessage(null);
      } else {
        setSelectedFile(null);
      }
    } else if (file) {
      setValidationStatus({
        isValid: false,
        message: 'Please upload a .txt file'
      });
    }
  };

  const handleRun = async (): Promise<void> => {
    if (!selectedFile || !isConnected) {
      setStatusMessage({
        type: 'error',
        message: !isConnected ? 'Not connected to drone' : 'Please select a file'
      });
      return;
    }

    if (isArmed) {
      setStatusMessage({
        type: 'error',
        message: 'Cannot upload mission: Drone is armed. Disarm first.'
      });
      return;
    }

    setIsUploading(true);
    
    // Mock upload process
    try {
      // In a real implementation, would read the file and send to drone
      console.log('Mock: Sending waypoint upload command...');
      
      // Simulate successful upload after delay
      setTimeout(() => {
        setIsUploading(false);
        setMissionStatus('uploaded');
        setStatusMessage({
          type: 'success',
          message: 'Mission uploaded to drone. Arm the drone and click Start Mission.'
        });
      }, 1500);
      
    } catch (error) {
      console.error('Upload error:', error);
      setStatusMessage({
        type: 'error',
        message: `Error: ${error instanceof Error ? error.message : 'Upload failed'}`
      });
      setIsUploading(false);
    }
  };

  const handleStartMission = (): void => {
    if (!isConnected) {
      setStatusMessage({
        type: 'error',
        message: 'Not connected to drone'
      });
      return;
    }

    // Mock start mission
    const success = socketManager.sendCommand('start_mission');
    if (success) {
      setMissionStatus('running');
      setStatusMessage({
        type: 'success',
        message: 'Mission started successfully!'
      });
    } else {
      setStatusMessage({
        type: 'error',
        message: 'Failed to send start mission command: Not connected'
      });
    }
  };

  const handleAbort = (): void => {
    if (!isConnected) {
      setStatusMessage({
        type: 'error',
        message: 'Not connected to drone'
      });
      return;
    }

    // Mock abort mission
    const success = socketManager.sendCommand('cancel_mission');
    if (success) {
      setMissionStatus('idle');
      setSelectedFile(null);
      setStatusMessage({
        type: 'success',
        message: 'Mission aborted. Drone will land safely.'
      });
    } else {
      setStatusMessage({
        type: 'error',
        message: 'Failed to send abort command: Not connected'
      });
    }
  };

  const handleClearMission = (): void => {
    if (!isConnected) {
      setStatusMessage({
        type: 'error',
        message: 'Not connected to drone'
      });
      return;
    }

    if (isArmed) {
      setStatusMessage({
        type: 'error',
        message: 'Cannot clear mission: Drone is armed. Disarm first.'
      });
      return;
    }

    setIsClearing(true);
    
    // Mock clear mission
    console.log('Mock: Sending clear mission command...');
    
    // Simulate success after delay
    setTimeout(() => {
      setIsClearing(false);
      setMissionStatus('idle');
      setSelectedFile(null);
      setWaypointCount(0);
      setValidationStatus(null);
      setStatusMessage({
        type: 'success',
        message: 'Mission waypoints cleared successfully.'
      });
    }, 1000);
  };

  const handleDivClick = (): void => {
    if (missionStatus === 'running' || isArmed) {
      return;
    }
    inputRef.current?.click();
  };

  return (
    <div className="max-w-lg mx-auto p-6 bg-slate-900/50 text-white rounded-lg shadow-lg border border-gray-800 backdrop-blur-sm shadow-slate-900/50">
      {/* Header with Status */}
      <div className="mb-6">
        <h2 className="text-2xl font-light tracking-wider text-center mb-4">WAYPOINT MISSION</h2>

        {/* Connection Status */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-sm text-gray-400 tracking-wider">
            {isConnected ? 'CONNECTED TO DRONE' : 'NOT CONNECTED'}
          </span>
        </div>
        
        {/* Armed Status */}
        <div className="flex items-center justify-center gap-2">
          <div className={`w-2 h-2 rounded-full ${!isArmed ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-gray-400 tracking-wider">
            {isArmed ? 'ARMED' : 'DISARMED'}
          </span>
        </div>
      </div>

      {/* Status Messages - Enhanced */}
      {statusMessage && (
        <div className={`mb-6 p-4 rounded-lg border backdrop-blur-sm ${
          statusMessage.type === 'success'
            ? 'bg-green-500/10 border-green-500/30 text-green-300'
            : 'bg-red-500/10 border-red-500/30 text-red-300'
        } tracking-wider font-light`}>
          {statusMessage.message}
        </div>
      )}

      {/* Validation Status - Enhanced */}
      {validationStatus && (
        <div className={`mb-6 p-4 rounded-lg border backdrop-blur-sm ${
          validationStatus.isValid
            ? 'bg-green-500/10 border-green-500/30 text-green-300'
            : 'bg-red-500/10 border-red-500/30 text-red-300'
        }`}>
          <p className="tracking-wider font-light">{validationStatus.message}</p>
          {validationStatus.isValid && waypointCount > 0 && (
            <div className="mt-3 text-sm space-y-1 font-light tracking-wider text-gray-300">
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 bg-green-500 rounded-full"></div>
                QGC WPL 110 format
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 bg-green-500 rounded-full"></div>
                {waypointCount} valid waypoints
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 bg-green-500 rounded-full"></div>
                All coordinates in valid range
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dropbox - Enhanced */}
      <div
        className={`border-2 ${
          dragActive
            ? 'border-blue-500/50 bg-blue-500/5'
            : 'border-dashed border-gray-700 bg-slate-800/50'
        } p-8 rounded-lg text-center cursor-pointer transition-all duration-300 hover:bg-slate-800/80
        ${missionStatus === 'running' || isArmed ? 'opacity-50 cursor-not-allowed' : ''}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={handleDivClick}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".txt"
          onChange={handleFileUpload}
          className="hidden"
          disabled={missionStatus === 'running' || isArmed}
        />
        {selectedFile ? (
          <div className="space-y-2">
            <p className="text-green-300 font-light tracking-wider">✓ {selectedFile.name}</p>
            <p className="text-sm text-gray-400 tracking-wider">File validated successfully</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-gray-300 tracking-wider font-light">
              Drag & drop your <span className="text-blue-400">.txt</span> waypoint file here
              <br />or click to select
            </p>
            <p className="text-sm text-gray-500 tracking-wider">
              Must be in QGC WPL 110 format
            </p>
          </div>
        )}
      </div>

      {/* Upload/Abort/Clear Buttons - Enhanced */}
      <div className="flex flex-wrap gap-4 mt-6">
        {missionStatus === 'idle' && (
          <>
            <button
              onClick={handleRun}
              disabled={!selectedFile || !isConnected || isUploading || isArmed}
              className={`flex-1 py-3 px-4 rounded-lg text-white font-light tracking-wider transition-all duration-300
              ${(selectedFile && isConnected && !isUploading && !isArmed)
                ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30'
                : 'bg-slate-800/50 text-gray-500 cursor-not-allowed border border-gray-800'}`}
            >
              {isUploading ? 'UPLOADING...' : 'UPLOAD TO DRONE'}
            </button>
            {waypointCount > 0 && (
              <button
                onClick={handleClearMission}
                disabled={!isConnected || isClearing || isArmed}
                className={`py-3 px-4 rounded-lg font-light tracking-wider transition-all duration-300
                ${(isConnected && !isClearing && !isArmed)
                  ? 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/30'
                  : 'bg-slate-800/50 text-gray-500 cursor-not-allowed border border-gray-800'}`}
              >
                {isClearing ? 'CLEARING...' : 'CLEAR MISSION'}
              </button>
            )}
          </>
        )}
        
        {missionStatus === 'uploaded' && (
          <>
            <button
              onClick={handleStartMission}
              disabled={!isConnected}
              className={`flex-1 py-3 px-4 rounded-lg font-light tracking-wider transition-all duration-300
              ${isConnected
                ? 'bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30'
                : 'bg-slate-800/50 text-gray-500 cursor-not-allowed border border-gray-800'}`}
            >
              START MISSION
            </button>
            <button
              onClick={handleAbort}
              disabled={!isConnected}
              className="flex-1 py-3 px-4 rounded-lg text-red-300 font-light tracking-wider
                bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 transition-all duration-300"
            >
              ABORT MISSION
            </button>
            <button
              onClick={handleClearMission}
              disabled={!isConnected || isClearing || isArmed}
              className={`w-full mt-2 py-3 px-4 rounded-lg font-light tracking-wider transition-all duration-300
              ${(isConnected && !isClearing && !isArmed)
                ? 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/30'
                : 'bg-slate-800/50 text-gray-500 cursor-not-allowed border border-gray-800'}`}
            >
              {isClearing ? 'CLEARING...' : 'CLEAR MISSION'}
            </button>
            {selectedFile && (
              <button
                onClick={handleRun}
                disabled={!selectedFile || !isConnected || isUploading || isArmed}
                className={`w-full mt-2 py-3 px-4 rounded-lg text-white font-light tracking-wider transition-all duration-300
                ${(selectedFile && isConnected && !isUploading && !isArmed)
                  ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30'
                  : 'bg-slate-800/50 text-gray-500 cursor-not-allowed border border-gray-800'}`}
              >
                {isUploading ? 'UPLOADING...' : 'UPLOAD NEW MISSION'}
              </button>
            )}
          </>
        )}
        
        {missionStatus === 'running' && (
          <button
            onClick={handleAbort}
            disabled={!isConnected}
            className="flex-1 py-3 px-4 rounded-lg text-red-300 font-light tracking-wider
              bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 transition-all duration-300"
          >
            ABORT MISSION
          </button>
        )}
      </div>

      {/* Status Message - Enhanced */}
      <p className="mt-6 text-sm text-gray-400 text-center tracking-wider font-light">
        {missionStatus === 'uploaded'
          ? 'Mission uploaded to drone - Arm drone then press Start Mission'
          : missionStatus === 'running'
          ? 'Mission in progress - Click Abort for safe landing'
          : isArmed
          ? 'Drone is armed - Disarm first to upload or clear missions'
          : 'Select a waypoint file to begin'}
      </p>

      {/* Debug Info - Enhanced */}
      <div className="mt-6 pt-4 border-t border-gray-800 text-sm text-gray-400 tracking-wider font-light flex items-center justify-center gap-4 flex-wrap">
        <span>STATUS: {missionStatus.toUpperCase()}</span>
        <span className="text-gray-600">•</span>
        <span>ARMED: {isArmed ? 'YES' : 'NO'}</span>
        <span className="text-gray-600">•</span>
        <span>CONNECTED: {isConnected ? 'YES' : 'NO'}</span>
      </div>
    </div>
  );
};

export default WaypointDropbox;
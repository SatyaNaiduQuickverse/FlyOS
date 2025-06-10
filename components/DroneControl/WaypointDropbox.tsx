// components/DroneControl/WaypointDropbox.tsx - COMPLETE WITH BACKEND INTEGRATION
import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '../../lib/auth';

interface Waypoint {
  seq: number;
  lat: number;
  lng: number;
  alt: number;
  command: number;
  frame: number;
  param1: number;
  param2: number;
  param3: number;
  param4: number;
}

interface StatusMessage {
  type: 'success' | 'error';
  message: string;
}

interface ValidationStatus {
  isValid: boolean;
  message: string;
}

const WaypointDropbox: React.FC = () => {
  const params = useParams();
  const droneId = params?.droneId as string;
  const { token } = useAuth();
  
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [missionStatus, setMissionStatus] = useState<'idle' | 'uploaded' | 'running'>('idle');
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [validationStatus, setValidationStatus] = useState<ValidationStatus | null>(null);
  const [waypointCount, setWaypointCount] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isArmed, setIsArmed] = useState<boolean>(false);
  const [missionId, setMissionId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Parse QGC waypoint file format
  const parseWaypointFile = async (file: File): Promise<Waypoint[]> => {
    const fileContent = await file.text();
    const lines = fileContent.trim().split('\n');
    const waypoints: Waypoint[] = [];

    // Skip QGC header if present
    const startIdx = lines[0].startsWith('QGC') ? 1 : 0;

    for (let i = startIdx; i < lines.length; i++) {
      const parts = lines[i].trim().split('\t');
      if (parts.length < 12) continue;

      const waypoint: Waypoint = {
        seq: parseInt(parts[0]),
        frame: parseInt(parts[2]), // 0 = global, 3 = relative
        command: parseInt(parts[3]), // MAV_CMD
        param1: parseFloat(parts[4]), // Hold time
        param2: parseFloat(parts[5]), // Accept radius
        param3: parseFloat(parts[6]), // Pass radius
        param4: parseFloat(parts[7]), // Yaw
        lat: parseFloat(parts[8]),
        lng: parseFloat(parts[9]),
        alt: parseFloat(parts[10])
      };

      waypoints.push(waypoint);
    }

    return waypoints;
  };

  const validateWaypointFile = async (file: File): Promise<boolean> => {
    try {
      const waypoints = await parseWaypointFile(file);
      
      if (waypoints.length === 0) {
        setValidationStatus({
          isValid: false,
          message: 'No valid waypoints found in file'
        });
        return false;
      }

      // Validate waypoint data
      for (const wp of waypoints) {
        if (isNaN(wp.lat) || isNaN(wp.lng) || isNaN(wp.alt)) {
          setValidationStatus({
            isValid: false,
            message: 'Invalid coordinates found in waypoint data'
          });
          return false;
        }
        
        if (Math.abs(wp.lat) > 90 || Math.abs(wp.lng) > 180) {
          setValidationStatus({
            isValid: false,
            message: 'Coordinates out of valid range'
          });
          return false;
        }
      }

      setValidationStatus({
        isValid: true,
        message: `Valid waypoint file with ${waypoints.length} waypoints`
      });
      setWaypointCount(waypoints.length);
      return true;

    } catch (error) {
      setValidationStatus({
        isValid: false,
        message: 'Error parsing waypoint file'
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

  const handleDivClick = (): void => {
    if (missionStatus === 'running' || isArmed) {
      return;
    }
    inputRef.current?.click();
  };

  const handleRun = async (): Promise<void> => {
    if (!selectedFile || !token || !droneId) {
      setStatusMessage({
        type: 'error',
        message: 'Missing required data for upload'
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
    
    try {
      // Parse waypoints from file
      const waypoints = await parseWaypointFile(selectedFile);
      
      // Create mission payload
      const missionData = {
        waypoints: waypoints,
        fileName: selectedFile.name,
        totalWaypoints: waypoints.length,
        uploadedBy: 'user', // Will be filled by backend with actual user
        uploadedAt: new Date().toISOString()
      };

      // Send to backend API
      const response = await fetch(`/api/drones/${droneId}/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          commandType: 'upload_waypoints',
          parameters: missionData
        })
      });

      const result = await response.json();

      if (result.success) {
        setMissionStatus('uploaded');
        setMissionId(result.missionId || result.commandId || Date.now().toString());
        setStatusMessage({
          type: 'success',
          message: `Mission uploaded successfully! ${waypoints.length} waypoints sent to drone.`
        });
      } else {
        setStatusMessage({
          type: 'error',
          message: `Upload failed: ${result.message || 'Unknown error'}`
        });
      }
    } catch (error) {
      setStatusMessage({
        type: 'error',
        message: `Upload error: ${error instanceof Error ? error.message : 'Network error'}`
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleStartMission = async (): Promise<void> => {
    if (!token || !droneId) return;

    try {
      const response = await fetch(`/api/drones/${droneId}/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          commandType: 'start_mission',
          parameters: { missionId }
        })
      });

      const result = await response.json();

      if (result.success) {
        setMissionStatus('running');
        setStatusMessage({
          type: 'success',
          message: 'Mission started successfully!'
        });
      } else {
        setStatusMessage({
          type: 'error',
          message: `Failed to start mission: ${result.message}`
        });
      }
    } catch (error) {
      setStatusMessage({
        type: 'error',
        message: 'Network error starting mission'
      });
    }
  };

  const handleAbort = async (): Promise<void> => {
    if (!token || !droneId) return;

    try {
      const response = await fetch(`/api/drones/${droneId}/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          commandType: 'cancel_mission',
          parameters: { missionId }
        })
      });

      const result = await response.json();

      if (result.success) {
        setMissionStatus('idle');
        setSelectedFile(null);
        setMissionId(null);
        setStatusMessage({
          type: 'success',
          message: 'Mission aborted. Drone will land safely.'
        });
      } else {
        setStatusMessage({
          type: 'error',
          message: `Failed to abort mission: ${result.message}`
        });
      }
    } catch (error) {
      setStatusMessage({
        type: 'error',
        message: 'Network error aborting mission'
      });
    }
  };

  const handleClearMission = async (): Promise<void> => {
    if (!token || !droneId) return;

    if (isArmed) {
      setStatusMessage({
        type: 'error',
        message: 'Cannot clear mission: Drone is armed. Disarm first.'
      });
      return;
    }

    setIsClearing(true);
    
    try {
      const response = await fetch(`/api/drones/${droneId}/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          commandType: 'clear_waypoints',
          parameters: { missionId }
        })
      });

      const result = await response.json();

      if (result.success) {
        setMissionStatus('idle');
        setSelectedFile(null);
        setWaypointCount(0);
        setValidationStatus(null);
        setMissionId(null);
        setStatusMessage({
          type: 'success',
          message: 'Mission waypoints cleared successfully.'
        });
      } else {
        setStatusMessage({
          type: 'error',
          message: `Failed to clear mission: ${result.message}`
        });
      }
    } catch (error) {
      setStatusMessage({
        type: 'error',
        message: 'Network error clearing mission'
      });
    } finally {
      setIsClearing(false);
    }
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

      {/* Status Messages */}
      {statusMessage && (
        <div className={`mb-6 p-4 rounded-lg border backdrop-blur-sm ${
          statusMessage.type === 'success'
            ? 'bg-green-500/10 border-green-500/30 text-green-300'
            : 'bg-red-500/10 border-red-500/30 text-red-300'
        } tracking-wider font-light`}>
          {statusMessage.message}
        </div>
      )}

      {/* Validation Status */}
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

      {/* Dropbox */}
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

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-4 mt-6">
        {missionStatus === 'idle' && (
          <>
            <button
              onClick={handleRun}
              disabled={!selectedFile || !isConnected || isUploading || isArmed || !token}
              className={`flex-1 py-3 px-4 rounded-lg text-white font-light tracking-wider transition-all duration-300
              ${(selectedFile && isConnected && !isUploading && !isArmed && token)
                ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30'
                : 'bg-slate-800/50 text-gray-500 cursor-not-allowed border border-gray-800'}`}
            >
              {isUploading ? 'UPLOADING...' : 'UPLOAD TO DRONE'}
            </button>
            {waypointCount > 0 && (
              <button
                onClick={handleClearMission}
                disabled={!isConnected || isClearing || isArmed || !token}
                className={`py-3 px-4 rounded-lg font-light tracking-wider transition-all duration-300
                ${(isConnected && !isClearing && !isArmed && token)
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
              disabled={!isConnected || !token}
              className={`flex-1 py-3 px-4 rounded-lg font-light tracking-wider transition-all duration-300
              ${(isConnected && token)
                ? 'bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30'
                : 'bg-slate-800/50 text-gray-500 cursor-not-allowed border border-gray-800'}`}
            >
              START MISSION
            </button>
            <button
              onClick={handleAbort}
              disabled={!isConnected || !token}
              className="flex-1 py-3 px-4 rounded-lg text-red-300 font-light tracking-wider
                bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 transition-all duration-300"
            >
              ABORT MISSION
            </button>
            <button
              onClick={handleClearMission}
              disabled={!isConnected || isClearing || isArmed || !token}
              className={`w-full mt-2 py-3 px-4 rounded-lg font-light tracking-wider transition-all duration-300
              ${(isConnected && !isClearing && !isArmed && token)
                ? 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/30'
                : 'bg-slate-800/50 text-gray-500 cursor-not-allowed border border-gray-800'}`}
            >
              {isClearing ? 'CLEARING...' : 'CLEAR MISSION'}
            </button>
          </>
        )}
        
        {missionStatus === 'running' && (
          <button
            onClick={handleAbort}
            disabled={!isConnected || !token}
            className="flex-1 py-3 px-4 rounded-lg text-red-300 font-light tracking-wider
              bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 transition-all duration-300"
          >
            ABORT MISSION
          </button>
        )}
      </div>

      {/* Status Message */}
      <p className="mt-6 text-sm text-gray-400 text-center tracking-wider font-light">
        {missionStatus === 'uploaded'
          ? 'Mission uploaded to drone - Arm drone then press Start Mission'
          : missionStatus === 'running'
          ? 'Mission in progress - Click Abort for safe landing'
          : isArmed
          ? 'Drone is armed - Disarm first to upload or clear missions'
          : 'Select a waypoint file to begin'}
      </p>

      {/* Debug Info */}
      <div className="mt-6 pt-4 border-t border-gray-800 text-sm text-gray-400 tracking-wider font-light flex items-center justify-center gap-4 flex-wrap">
        <span>STATUS: {missionStatus.toUpperCase()}</span>
        <span className="text-gray-600">•</span>
        <span>ARMED: {isArmed ? 'YES' : 'NO'}</span>
        <span className="text-gray-600">•</span>
        <span>CONNECTED: {isConnected ? 'YES' : 'NO'}</span>
        {missionId && (
          <>
            <span className="text-gray-600">•</span>
            <span>ID: {missionId.slice(-8)}</span>
          </>
        )}
      </div>
    </div>
  );
};

export default WaypointDropbox;
import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { AlertCircle, Crosshair, Square, RefreshCw, Activity } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { io } from 'socket.io-client';

const DronePrecisionLand = () => {
  const params = useParams();
  const droneId = params?.droneId as string;
  const { token } = useAuth();
  
  const [isRunning, setIsRunning] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState(null);
  const [selectedButton, setSelectedButton] = useState('confirm');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionStatus, setSessionStatus] = useState('INACTIVE');
  const [isConnected, setIsConnected] = useState(false);
  
  const modalRef = useRef(null);
  const outputRef = useRef(null);
  const socketRef = useRef(null);

  // Initialize WebSocket connection - FIXED URL
  useEffect(() => {
    if (!token || !droneId) return;

    // Use direct realtime service URL for precision landing
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://3.111.215.70:4002';
      
    const socket = io(wsUrl, {
      auth: { token },
      transports: ['websocket'],
      timeout: 10000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to precision landing WebSocket');
      setIsConnected(true);
      
      // Subscribe to precision landing events
      socket.emit('subscribe', `precision_land_output:${droneId}`);
      socket.emit('subscribe', `precision_land_status:${droneId}`);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from precision landing WebSocket');
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setIsConnected(false);
      setError('WebSocket connection failed');
    });

    // Handle precision landing output
    socket.on('precision_land_output', (data) => {
      if (data?.droneId === droneId && data?.output) {
        setTerminalOutput(prev => [...prev, data.output]);
        
        // Auto-scroll to bottom
        if (outputRef.current) {
          outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
      }
    });

    // Handle precision landing status updates
    socket.on('precision_land_status', (data) => {
      if (data?.droneId === droneId) {
        setSessionStatus(data.status);
        
        if (data.status === 'COMPLETED' || data.status === 'ABORTED' || data.status === 'DISCONNECTED') {
          setIsRunning(false);
        } else if (data.status === 'ACTIVE') {
          setIsRunning(true);
        }
        
        // Add status message to terminal
        if (data.message) {
          setTerminalOutput(prev => [...prev, `[STATUS] ${data.message}`]);
        }
      }
    });

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [droneId, token]);

  // Load existing buffer on mount
  useEffect(() => {
    const loadBuffer = async () => {
      if (!droneId || !token) return;
      
      try {
        const response = await fetch(`/api/precision-landing/${droneId}/buffer`, {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Cache-Control': 'no-cache'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.messages && data.messages.length > 0) {
            const outputs = data.messages
              .reverse() // Show oldest first
              .map(msg => msg.output || msg.message || 'Unknown message');
            setTerminalOutput(outputs);
          }
        }
      } catch (err) {
        console.warn('Could not load precision landing buffer:', err);
      }
    };
    
    loadBuffer();
  }, [droneId, token]);

  // Check session status on mount
  useEffect(() => {
    const checkStatus = async () => {
      if (!droneId || !token) return;
      
      try {
        const response = await fetch(`http://localhost:4005/precision-landing/${droneId}/status`);
        if (response.ok) {
          const data = await response.json();
          setSessionStatus(data.status || 'INACTIVE');
          if (data.status === 'ACTIVE') {
            setIsRunning(true);
          }
        }
      } catch (err) {
        console.warn('Could not check precision landing status:', err);
      }
    };
    
    checkStatus();
  }, [droneId, token]);

  const sendCommand = async (commandType, parameters = {}) => {
    if (!token || !droneId) {
      setError('Missing authentication or drone ID');
      return { success: false };
    }

    try {
      const response = await fetch(`/api/drones/${droneId}/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          commandType,
          parameters,
          timestamp: new Date().toISOString()
        })
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error(`Command ${commandType} failed:`, error);
      return { success: false, message: error.message };
    }
  };

  const handleStart = () => {
    if (isRunning) {
      setError('Precision landing is already running');
      return;
    }
    setShowConfirmation(true);
  };

  const handleConfirm = async () => {
    setShowConfirmation(false);
    setError(null);
    setIsLoading(true);
    
    try {
      const result = await sendCommand('precision_land', {
        targetConfirmed: true,
        userId: token,
        initiatedBy: 'dashboard'
      });
      
      if (result.success) {
        setIsRunning(true);
        setSessionStatus('ACTIVE');
        setTerminalOutput(prev => [...prev, '[SYSTEM] Precision landing sequence initiated...']);
        setTerminalOutput(prev => [...prev, '[INFO] Searching for landing target...']);
      } else {
        setError(result.message || 'Failed to start precision landing');
      }
    } catch (err) {
      setError('Command failed to send');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAbort = async () => {
    if (!isRunning) {
      setError('No active precision landing sequence to abort');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const result = await sendCommand('abort_precision_land', {
        reason: 'user_requested',
        userId: token
      });
      
      if (result.success) {
        setIsRunning(false);
        setSessionStatus('ABORTED');
        setTerminalOutput(prev => [...prev, '[SYSTEM] Precision landing aborted by user']);
        setTerminalOutput(prev => [...prev, '[INFO] Drone switching to altitude hold mode']);
      } else {
        setError(result.message || 'Failed to abort precision landing');
      }
    } catch (err) {
      setError('Abort command failed to send');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearTerminal = () => {
    setTerminalOutput([]);
  };

  const handleModalKeyDown = (event) => {
    if (['ArrowLeft', 'ArrowRight', 'Tab'].includes(event.key)) {
      event.preventDefault();
      setSelectedButton(prev => prev === 'confirm' ? 'cancel' : 'confirm');
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (selectedButton === 'confirm') {
        handleConfirm();
      } else {
        setShowConfirmation(false);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setShowConfirmation(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ACTIVE': return 'text-green-400 border-green-500/30 bg-green-500/20';
      case 'COMPLETED': return 'text-blue-400 border-blue-500/30 bg-blue-500/20';
      case 'ABORTED': return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/20';
      case 'DISCONNECTED': return 'text-red-400 border-red-500/30 bg-red-500/20';
      default: return 'text-gray-400 border-gray-500/30 bg-gray-500/20';
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto bg-slate-900/50 text-white rounded-lg shadow-lg border border-gray-800 backdrop-blur-sm">
      <div className="p-6 border-b border-gray-800">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${
              isRunning ? 'bg-green-500 animate-pulse' : 
              isConnected ? 'bg-blue-500' : 'bg-red-500'
            }`}></div>
            <h2 className="text-xl tracking-wider font-light">PRECISION LANDING</h2>
            <div className="text-xs text-gray-500 bg-gray-800/50 px-2 py-1 rounded">
              {droneId}
            </div>
            <div className={`text-xs px-2 py-1 rounded border tracking-wider ${getStatusColor(sessionStatus)}`}>
              {sessionStatus}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isConnected ? (
              <div className="flex items-center gap-1 text-green-400">
                <Activity className="h-3 w-3" />
                <span className="text-xs">LIVE</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-red-400">
                <Activity className="h-3 w-3" />
                <span className="text-xs">OFFLINE</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-200 tracking-wider font-light flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Control Buttons */}
          <div className="flex gap-4">
            <button
              onClick={handleStart}
              disabled={isRunning || isLoading || !isConnected}
              className={`flex-1 py-3 px-6 rounded-lg font-light tracking-wider transition-all flex items-center justify-center gap-2 ${
                isRunning || isLoading || !isConnected
                  ? 'bg-slate-800/50 text-gray-500 cursor-not-allowed border border-gray-800'
                  : 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border border-blue-500/30'
              }`}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  PROCESSING...
                </>
              ) : (
                <>
                  <Crosshair className="h-4 w-4" />
                  INITIATE PRECISION LANDING
                </>
              )}
            </button>
            <button
              onClick={handleAbort}
              disabled={!isRunning || isLoading || !isConnected}
              className={`flex-1 py-3 px-6 rounded-lg font-light tracking-wider transition-all flex items-center justify-center gap-2 ${
                !isRunning || isLoading || !isConnected
                  ? 'bg-slate-800/50 text-gray-500 cursor-not-allowed border border-gray-800'
                  : 'bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30'
              }`}
            >
              <Square className="h-4 w-4" />
              ABORT SEQUENCE
            </button>
            <button
              onClick={handleClearTerminal}
              disabled={terminalOutput.length === 0}
              className={`px-6 py-3 rounded-lg font-light tracking-wider transition-all ${
                terminalOutput.length === 0
                  ? 'bg-slate-800/50 text-gray-500 cursor-not-allowed border border-gray-800'
                  : 'bg-gray-600/20 text-gray-300 hover:bg-gray-600/30 border border-gray-600/30'
              }`}
            >
              CLEAR
            </button>
          </div>

          {/* Terminal Output */}
          <div
            ref={outputRef}
            className="bg-slate-950 rounded-lg p-6 h-80 w-full overflow-y-auto font-mono text-sm border border-gray-800"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#1E293B #0F172A'
            }}
          >
            <style jsx>{`
              div::-webkit-scrollbar {
                width: 8px;
              }
              div::-webkit-scrollbar-track {
                background: #0F172A;
                border-radius: 4px;
              }
              div::-webkit-scrollbar-thumb {
                background: #1E293B;
                border-radius: 4px;
                border: 1px solid #334155;
              }
              div::-webkit-scrollbar-thumb:hover {
                background: #334155;
              }
            `}</style>
            {terminalOutput.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500 tracking-wider font-light text-center">
                  AWAITING PRECISION LANDING SEQUENCE...<br />
                  <span className="text-xs text-gray-600 mt-2 block">
                    Connect to drone and initiate landing to see real-time output
                  </span>
                </p>
              </div>
            ) : (
              terminalOutput.map((line, index) => (
                <div key={index} className="text-gray-300 min-w-max font-light tracking-wide mb-1 hover:bg-slate-900/30 transition-colors">
                  <span className="text-blue-400 mr-2">→</span>
                  <span className="text-gray-500 text-xs mr-2">
                    {new Date().toLocaleTimeString()}
                  </span>
                  {line}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Confirmation Modal */}
        {showConfirmation && (
          <div
            className="fixed inset-0 flex items-center justify-center z-50"
            onKeyDown={handleModalKeyDown}
            tabIndex={0}
            ref={modalRef}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="bg-slate-900 p-8 rounded-lg shadow-lg z-10 max-w-md w-full border border-gray-800">
              <h3 className="text-xl font-light tracking-wider mb-4">CONFIRM PRECISION LANDING</h3>
              <p className="mb-6 text-gray-300 tracking-wide">
                Initiating precision landing sequence. Ensure the landing area is clear and the target is visible to the drone's camera.
              </p>
              <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 rounded mb-6">
                <p className="text-yellow-300 text-sm">
                  ⚠️ This will override manual control. The drone will autonomously land on the detected target.
                </p>
              </div>
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setShowConfirmation(false)}
                  className={`px-6 py-3 rounded-lg tracking-wider font-light transition-colors
                    ${selectedButton === 'cancel' 
                      ? 'bg-red-500/20 text-red-300 border border-red-500/30 ring-2 ring-red-500/50' 
                      : 'bg-red-500/10 text-red-300 border border-red-500/20 hover:bg-red-500/20'}`}
                >
                  CANCEL
                </button>
                <button
                  onClick={handleConfirm}
                  className={`px-6 py-3 rounded-lg tracking-wider font-light transition-colors
                    ${selectedButton === 'confirm' 
                      ? 'bg-green-500/20 text-green-300 border border-green-500/30 ring-2 ring-green-500/50' 
                      : 'bg-green-500/10 text-green-300 border border-green-500/20 hover:bg-green-500/20'}`}
                >
                  CONFIRM LANDING
                </button>
              </div>
              <p className="mt-4 text-sm text-gray-500 tracking-wider">
                Use Arrow Keys to navigate • Enter to confirm • ESC to cancel
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Status Footer */}
      <div className="px-6 pb-4 text-xs text-gray-400 tracking-wider border-t border-gray-800 pt-4">
        <div className="flex justify-between items-center">
          <p>PRECISION LANDING SYSTEM • {terminalOutput.length} operations logged</p>
          <div className="flex items-center gap-4">
            <span>Session: {sessionStatus}</span>
            <span>Connection: {isConnected ? 'ACTIVE' : 'OFFLINE'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DronePrecisionLand;

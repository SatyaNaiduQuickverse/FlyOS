// components/DroneControl/DronePayload.tsx - CONNECTED TO LIVE REDIS DATA
import React, { useState, useEffect } from 'react';
import { Package, AlertCircle } from 'lucide-react';
import { useParams } from 'next/navigation';

// Live telemetry interface for payload data
interface LiveTelemetryData {
  latch_status?: string;
  teensy_connected?: boolean;
  connected?: boolean;
  timestamp?: string;
  // Additional payload-related fields from Redis
  payload_weight?: number;
  payload_detected?: boolean;
  bay_temperature?: number;
}

const DronePayload: React.FC = () => {
  // Get droneId from URL params
  const params = useParams();
  const droneId = params?.droneId as string;

  // LIVE TELEMETRY STATE - Connected to Redis
  const [liveTelemetry, setLiveTelemetry] = useState<LiveTelemetryData | null>(null);
  const [bayStatus, setBayStatus] = useState<string>('UNKNOWN');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [telemetryError, setTelemetryError] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);

  // FETCH LIVE TELEMETRY DATA FROM REDIS
  const fetchTelemetry = async () => {
    if (!droneId) {
      setTelemetryError('No drone ID found in URL');
      return;
    }

    try {
      setTelemetryError(null);
      const response = await fetch(`/api/drone-telemetry/${droneId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data) {
        setLiveTelemetry(data);
        setLastUpdateTime(new Date());
        
        // Update connection status from live data
        const connected = data.connected || data.teensy_connected || false;
        setIsConnected(connected);
        
        // Update bay status from live data
        if (data.latch_status) {
          setBayStatus(data.latch_status);
        }
        
        // Clear loading if we get a definitive status
        if (data.latch_status === 'OPENED' || data.latch_status === 'CLOSED') {
          setIsLoading(false);
        }
      } else {
        setTelemetryError('No telemetry data available');
      }
    } catch (err) {
      console.error('Error fetching payload telemetry:', err);
      setTelemetryError(err instanceof Error ? err.message : 'Failed to fetch telemetry');
      setIsConnected(false);
    }
  };

  // LIVE DATA POLLING - Connect to Redis stream
  useEffect(() => {
    if (droneId) {
      fetchTelemetry();
      const interval = setInterval(fetchTelemetry, 2000); // Poll every 2 seconds
      return () => clearInterval(interval);
    }
  }, [droneId]);

  const handleBayDoor = async (command: string): Promise<void> => {
    if (!isConnected) {
      setError('Cannot send command: Payload bay not connected');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      // TODO: This will be connected to actual command API later
      console.log(`Sending payload command ${command} to drone ${droneId}`);
      
      // Update status immediately to show operation starting
      setBayStatus(command === 'OPEN' ? 'MOVING_OPEN' : 'MOVING_CLOSE');
      
      // For now, simulate operation completion
      // Later this will be replaced with actual command sending and status updates from Redis
      setTimeout(() => {
        setBayStatus(command === 'OPEN' ? 'OPENED' : 'CLOSED');
        setIsLoading(false);
      }, 2000);

    } catch (error) {
      console.error('Failed to send payload command:', error);
      setError(`Failed to send command: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsLoading(false);
    }
  };

  // Status text formatting - Enhanced with live data
  const getStatusDisplay = (status: string): string => {
    switch (status) {
      case 'MOVING_OPEN': return 'Opening Bay...';
      case 'MOVING_CLOSE': return 'Closing Bay...';
      case 'OPENED': return 'Bay Open';
      case 'CLOSED': return 'Bay Closed';
      case 'OK': return 'Bay Operational';
      case 'ERROR': return 'Bay Error';
      case 'JAMMED': return 'Bay Jammed';
      default: return 'Bay Status Unknown';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'MOVING_OPEN':
      case 'MOVING_CLOSE':
        return 'text-yellow-400';
      case 'OPENED':
      case 'CLOSED':
      case 'OK':
        return 'text-green-400';
      case 'ERROR':
      case 'JAMMED':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getConnectionStatus = () => {
    if (telemetryError) {
      return { color: 'bg-red-500', text: 'DATA ERROR' };
    }
    if (isConnected) {
      return { color: 'bg-green-500', text: 'LIVE DATA' };
    }
    return { color: 'bg-red-500', text: 'NO DATA' };
  };

  const connectionStatus = getConnectionStatus();

  return (
    <div className="w-full">
      <div className="bg-slate-900/50 text-white rounded-lg shadow-lg border border-gray-800 backdrop-blur-sm shadow-slate-900/50">
        {/* Header */}
        <div className="border-b border-gray-800 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5 text-blue-400" />
              <h1 className="text-xl tracking-wider font-light">PAYLOAD BAY</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${connectionStatus.color} animate-pulse`}></div>
              <span className="text-sm text-gray-400 tracking-wide">
                {connectionStatus.text}
              </span>
              {lastUpdateTime && (
                <span className="text-xs text-gray-500">
                  {lastUpdateTime.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Status and Warning */}
        <div className="p-6">
          {/* Connection Error */}
          {telemetryError && (
            <div className="mb-4 bg-red-950/30 p-4 rounded-lg border border-red-900">
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="w-5 h-5" />
                <p className="text-sm tracking-wider font-light">
                  Telemetry Error: {telemetryError}
                </p>
              </div>
            </div>
          )}

          {/* Connection Warning */}
          {!isConnected && !telemetryError && (
            <div className="mb-4 bg-red-950/30 p-4 rounded-lg border border-red-900">
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="w-5 h-5" />
                <p className="text-sm tracking-wider font-light">
                  Payload bay not connected. Commands disabled.
                </p>
              </div>
            </div>
          )}

          {/* Command Error */}
          {error && (
            <div className="mb-4 bg-red-950/30 p-4 rounded-lg border border-red-900">
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="w-5 h-5" />
                <p className="text-sm tracking-wider font-light">
                  {error}
                </p>
              </div>
            </div>
          )}

          {/* LIVE STATUS from Redis */}
          <div className="bg-slate-800/50 p-6 rounded-lg border border-gray-800 mb-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-sm text-gray-300 tracking-wider font-light">LIVE STATUS</h2>
                <p className={`mt-2 tracking-wider font-light text-lg ${getStatusColor(bayStatus)}`}>
                  {getStatusDisplay(bayStatus)}
                </p>
                {liveTelemetry?.latch_status && (
                  <p className="text-xs text-gray-500 mt-1">
                    Raw Status: {liveTelemetry.latch_status}
                  </p>
                )}
              </div>
              
              {/* Additional live data */}
              {liveTelemetry && (
                <div className="text-right text-sm text-gray-400">
                  {liveTelemetry.payload_detected !== undefined && (
                    <div className="mb-1">
                      Payload: {liveTelemetry.payload_detected ? 'Detected' : 'None'}
                    </div>
                  )}
                  {liveTelemetry.payload_weight !== undefined && (
                    <div className="mb-1">
                      Weight: {liveTelemetry.payload_weight}kg
                    </div>
                  )}
                  {liveTelemetry.bay_temperature !== undefined && (
                    <div className="mb-1">
                      Temp: {liveTelemetry.bay_temperature}°C
                    </div>
                  )}
                  {liveTelemetry.teensy_connected !== undefined && (
                    <div className={`text-xs ${liveTelemetry.teensy_connected ? 'text-green-400' : 'text-red-400'}`}>
                      Controller: {liveTelemetry.teensy_connected ? 'OK' : 'ERROR'}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="bg-slate-800/50 p-6 rounded-lg border border-gray-800">
            <h2 className="text-sm text-gray-300 mb-4 tracking-wider font-light">BAY DOOR CONTROLS</h2>
            <div className="flex gap-4">
              <button
                onClick={() => handleBayDoor('OPEN')}
                disabled={!isConnected || isLoading}
                className="flex-1 py-3 px-6 rounded-lg font-light tracking-wider text-sm
                          bg-slate-700/50 text-white border border-slate-600
                          hover:bg-slate-700 disabled:opacity-50
                          disabled:cursor-not-allowed transition-colors"
              >
                {isLoading && bayStatus === 'MOVING_OPEN' ? 'OPENING...' : 'OPEN BAY'}
              </button>

              <button
                onClick={() => handleBayDoor('CLOSE')}
                disabled={!isConnected || isLoading}
                className="flex-1 py-3 px-6 rounded-lg font-light tracking-wider text-sm
                          bg-slate-700/50 text-white border border-slate-600
                          hover:bg-slate-700 disabled:opacity-50
                          disabled:cursor-not-allowed transition-colors"
              >
                {isLoading && bayStatus === 'MOVING_CLOSE' ? 'CLOSING...' : 'CLOSE BAY'}
              </button>
            </div>
            
            {/* Command status */}
            <div className="mt-4 text-center">
              <p className="text-xs text-gray-400">
                {isConnected 
                  ? 'Commands will be sent to payload controller'
                  : 'Connect to drone to enable payload controls'
                }
              </p>
            </div>
          </div>

          {/* DEBUG: Live telemetry data display (for development) */}
          {liveTelemetry && process.env.NODE_ENV === 'development' && (
            <div className="mt-4 bg-gray-800/30 p-3 rounded-lg border border-gray-700">
              <h3 className="text-xs text-gray-400 mb-2">DEBUG - Live Telemetry:</h3>
              <pre className="text-xs text-gray-500 overflow-auto">
                {JSON.stringify(liveTelemetry, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DronePayload;
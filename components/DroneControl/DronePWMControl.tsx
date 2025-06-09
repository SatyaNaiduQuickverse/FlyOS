// components/DroneControl/DronePWMControl.tsx - WITH LIVE DATA INTEGRATION
import React, { useState, useRef, ReactElement, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { AlertCircle, Wifi, WifiOff } from 'lucide-react';

interface PWMValues {
  throttle: number;
  yaw: number;
  pitch: number;
  roll: number;
}

interface KeyMapping {
  action: string;
  control: 'throttle' | 'yaw' | 'pitch' | 'roll';
  increment: boolean;
}

interface FlightAction {
  name: string;
  endpoint: string;
  color: string;
}

interface LiveTelemetryData {
  armed: boolean;
  flight_mode: string;
  connected: boolean;
  percentage: number;
}

type CommandParams = Record<string, unknown>;

const DronePWMControl: React.FC = () => {
  // Get droneId from URL params
  const params = useParams();
  const droneId = params?.droneId as string;

  const PWM_STEP = 50;
  const INITIAL_PWM: PWMValues = { throttle: 1000, yaw: 1500, pitch: 1500, roll: 1500 };

  // Live telemetry state
  const [liveTelemetry, setLiveTelemetry] = useState<LiveTelemetryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [telemetryError, setTelemetryError] = useState<string | null>(null);

  // PWM and control state
  const [_pwmValues, setPwmValues] = useState<PWMValues>(INITIAL_PWM);
  const [pendingPWM, setPendingPWM] = useState<PWMValues>(INITIAL_PWM);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [pendingFlightAction, setPendingFlightAction] = useState<FlightAction | null>(null);
  const [_pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [autoPWMUpdate, setAutoPWMUpdate] = useState<boolean>(false);
  const [selectedModalButton, setSelectedModalButton] = useState<'confirm' | 'cancel'>('confirm');
  const [lastCommandTime, setLastCommandTime] = useState<number>(0);

  const pressedKeysRef = useRef<Set<string>>(new Set());
  const modalRef = useRef<HTMLDivElement>(null);

  const flightActions: FlightAction[] = [
    { name: 'Arm', endpoint: 'arm', color: 'bg-slate-700 hover:bg-slate-600' },
    { name: 'Disarm', endpoint: 'disarm', color: 'bg-slate-700 hover:bg-slate-600' },
    { name: 'Stabilize', endpoint: 'stabilize', color: 'bg-slate-700 hover:bg-slate-600' },
    { name: 'Altitude Hold', endpoint: 'altitude-hold', color: 'bg-slate-700 hover:bg-slate-600' },
    { name: 'Loiter', endpoint: 'loiter', color: 'bg-slate-700 hover:bg-slate-600' },
    { name: 'Smart RTL', endpoint: 'smart-rtl', color: 'bg-slate-700 hover:bg-slate-600' },
    { name: 'Land', endpoint: 'land', color: 'bg-slate-700 hover:bg-slate-600' },
  ];

  const keyMappings: Record<string, KeyMapping> = {
    w: { action: 'Throttle Up', control: 'throttle', increment: true },
    s: { action: 'Throttle Down', control: 'throttle', increment: false },
    a: { action: 'Yaw Left', control: 'yaw', increment: false },
    d: { action: 'Yaw Right', control: 'yaw', increment: true },
    p: { action: 'Pitch Forward', control: 'pitch', increment: false },
    ';': { action: 'Pitch Backward', control: 'pitch', increment: true },
    l: { action: 'Roll Left', control: 'roll', increment: false },
    "'": { action: 'Roll Right', control: 'roll', increment: true },
  };

  // Fetch live telemetry data
  const fetchTelemetry = async () => {
    if (!droneId) {
      setTelemetryError('No drone ID found in URL');
      setIsLoading(false);
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
      
      if (data && typeof data.armed === 'boolean') {
        setLiveTelemetry({
          armed: data.armed,
          flight_mode: data.flight_mode || 'UNKNOWN',
          connected: data.connected || false,
          percentage: data.percentage || 0
        });
        setIsLoading(false);
      } else {
        setTelemetryError('No telemetry data available');
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Error fetching telemetry:', err);
      setTelemetryError(err instanceof Error ? err.message : 'Failed to fetch telemetry');
      setIsLoading(false);
    }
  };

  // Initial fetch and polling
  useEffect(() => {
    if (droneId) {
      fetchTelemetry();
      const interval = setInterval(fetchTelemetry, 2000);
      return () => clearInterval(interval);
    }
  }, [droneId]);

  // Send command to drone - wait for response before updating UI
  const sendCommand = async (command: string, params: CommandParams = {}): Promise<{ success: boolean; message?: string }> => {
    if (!droneId) {
      return { success: false, message: 'No drone ID available' };
    }

    try {
      const response = await fetch(`/api/drones/${droneId}/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          commandType: command,
          parameters: params,
          timestamp: new Date().toISOString()
        })
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        setLastCommandTime(Date.now());
        return { success: true, message: result.message };
      } else {
        return { success: false, message: result.message || 'Command failed' };
      }
    } catch (error) {
      console.error(`Command ${command} failed:`, error);
      return { success: false, message: error instanceof Error ? error.message : 'Network error' };
    }
  };

  const handleFlightAction = async (action: FlightAction): Promise<void> => {
    try {
      setActionInProgress(action.endpoint);
      setError(null);
      
      const result = await sendCommand(action.endpoint);
      
      if (result.success) {
        // Don't update UI immediately - wait for telemetry to reflect changes
        console.log(`${action.name} command sent successfully`);
        // Force telemetry refresh to get updated state
        setTimeout(fetchTelemetry, 500);
      } else {
        setError(`${action.name} failed: ${result.message}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error executing ${action.name}:`, error);
      setError(`Error: ${errorMessage}`);
    } finally {
      setActionInProgress(null);
    }
  };

  // Key events for PWM (keep manual control untouched)
  const handleKeyDown = (event: React.KeyboardEvent): void => {
    if (pendingFlightAction) return;
    if (!autoPWMUpdate) return;

    const key = event.key.toLowerCase();
    if (keyMappings[key] && !pressedKeysRef.current.has(key)) {
      event.preventDefault();
      pressedKeysRef.current.add(key);
      setPressedKeys(new Set(pressedKeysRef.current));
      
      const mapping = keyMappings[key];
      setPendingPWM(prev => {
        const currentValue = prev[mapping.control];
        const newValue = mapping.increment
          ? Math.min(currentValue + PWM_STEP, 2000)
          : Math.max(currentValue - PWM_STEP, 1000);
        return { ...prev, [mapping.control]: newValue };
      });
    }
  };

  const handleKeyUp = (event: React.KeyboardEvent): void => {
    if (!autoPWMUpdate) return;

    const key = event.key.toLowerCase();
    if (keyMappings[key]) {
      event.preventDefault();
      pressedKeysRef.current.delete(key);
      setPressedKeys(new Set(pressedKeysRef.current));
    }
  };

  // Modal key handler
  const handleModalKeyDown = (event: React.KeyboardEvent): void => {
    event.stopPropagation();
    if (['ArrowLeft', 'ArrowRight', 'Tab'].includes(event.key)) {
      event.preventDefault();
      setSelectedModalButton((prev) => (prev === 'confirm' ? 'cancel' : 'confirm'));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (selectedModalButton === 'confirm' && pendingFlightAction) {
        handleFlightAction(pendingFlightAction);
      }
      setPendingFlightAction(null);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setPendingFlightAction(null);
    }
  };

  // PWM gauge rendering
  const renderPWMGauge = (label: string, value: number, control: 'throttle' | 'yaw' | 'pitch' | 'roll'): ReactElement => {
    const percentage = ((value - 1000) / 1000) * 100;
    const isActive = Array.from(pressedKeysRef.current).some(
      (key) => keyMappings[key]?.control === control
    );

    return (
      <div className="mb-6" key={control}>
        <div className="flex items-center justify-between mb-2">
          <span className={`font-light tracking-wider ${isActive ? 'text-blue-400' : 'text-gray-300'}`}>
            {label.toUpperCase()}
          </span>
          <span className="font-mono text-gray-400">{value}</span>
        </div>
        <div className="w-full bg-slate-950/50 rounded-full h-2 border border-gray-800">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              isActive ? 'bg-blue-500' : 'bg-blue-400/50'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div
      className="bg-slate-900/50 text-white rounded-lg shadow-lg border border-gray-800 backdrop-blur-sm shadow-slate-900/50 max-w-5xl mx-auto p-6"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      style={{ outline: 'none' }}
    >
      {/* Connection Status */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-light tracking-wider">DRONE CONTROL</h2>
        <div className="flex items-center gap-3">
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              <span className="text-sm text-gray-400">Connecting...</span>
            </div>
          ) : liveTelemetry?.connected ? (
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-400">LIVE</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <WifiOff className="h-4 w-4 text-red-500" />
              <span className="text-sm text-red-400">OFFLINE</span>
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {(error || telemetryError) && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg tracking-wider font-light flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error || telemetryError}
        </div>
      )}

      {/* Two-Column Layout */}
      <div className="flex flex-row space-x-8">
        {/* Column 1: Status & Flight Controls */}
        <div className="w-1/2 space-y-6">
          {/* Status Bar - Using Live Telemetry */}
          <div className="bg-slate-800/50 p-6 rounded-lg border border-gray-800 space-y-4">
            <div className="flex flex-col space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 tracking-wider">STATUS</span>
                <span className={`px-3 py-1 rounded-md text-xs tracking-wider font-light ${
                  liveTelemetry?.armed 
                    ? 'bg-red-500/20 text-red-300 border border-red-500/30' 
                    : 'bg-green-500/20 text-green-300 border border-green-500/30'
                }`}>
                  {liveTelemetry?.armed ? 'ARMED' : 'DISARMED'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 tracking-wider">MODE</span>
                <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-md text-xs tracking-wider font-light border border-blue-500/30">
                  {liveTelemetry?.flight_mode || 'UNKNOWN'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 tracking-wider">BATTERY</span>
                <span className={`px-3 py-1 rounded-md text-xs tracking-wider font-light ${
                  (liveTelemetry?.percentage || 0) > 20
                    ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                    : 'bg-red-500/20 text-red-300 border border-red-500/30'
                }`}>
                  {liveTelemetry?.percentage || 0}%
                </span>
              </div>
            </div>
          </div>

          {/* Flight Controls */}
          <div className="space-y-4">
            <h2 className="text-lg font-light tracking-wider">FLIGHT CONTROLS</h2>
            <div className="grid grid-cols-2 gap-4">
              {flightActions.map((action) => {
                const isLoading = actionInProgress === action.endpoint;
                const isDisabled = !liveTelemetry?.connected || isLoading;
                
                return (
                  <button
                    key={action.name}
                    onClick={() => setPendingFlightAction(action)}
                    disabled={isDisabled}
                    className={`px-4 py-2 rounded-lg font-light tracking-wider text-white transition-colors
                      ${isDisabled 
                        ? 'bg-slate-800/30 text-gray-600 cursor-not-allowed' 
                        : 'bg-slate-800/50 hover:bg-slate-700/50 border border-gray-800'
                      }
                      ${isLoading ? 'animate-pulse' : ''}`}
                  >
                    {isLoading ? 'PROCESSING...' : action.name.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Column 2: PWM Values & Toggle */}
        <div className="w-1/2 space-y-6">
          <div className="space-y-4">
            <h2 className="text-lg font-light tracking-wider">PWM VALUES</h2>
            
            {/* Gauges */}
            {renderPWMGauge('Throttle', pendingPWM.throttle, 'throttle')}
            {renderPWMGauge('Yaw', pendingPWM.yaw, 'yaw')}
            {renderPWMGauge('Pitch', pendingPWM.pitch, 'pitch')}
            {renderPWMGauge('Roll', pendingPWM.roll, 'roll')}

            {/* Auto Update Toggle */}
            <div className="flex items-center justify-between mt-6 bg-slate-800/50 p-4 rounded-lg border border-gray-800">
              <span className="text-gray-300 tracking-wider">AUTO UPDATE PWM</span>
              <button
                onClick={() => setAutoPWMUpdate((prev) => !prev)}
                disabled={!liveTelemetry?.connected}
                className={`relative inline-flex items-center h-6 rounded-full w-12 transition-colors ${
                  autoPWMUpdate ? 'bg-green-500/50' : 'bg-red-500/50'
                } border ${autoPWMUpdate ? 'border-green-500/30' : 'border-red-500/30'}
                ${!liveTelemetry?.connected ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
                    autoPWMUpdate ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {pendingFlightAction && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          onKeyDown={handleModalKeyDown}
          tabIndex={0}
          ref={modalRef}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="bg-slate-900/90 text-white p-8 rounded-lg shadow-lg border border-gray-800 backdrop-blur-sm z-10 max-w-md w-full">
            <h3 className="text-xl font-light tracking-wider mb-4">CONFIRM ACTION</h3>
            <p className="mb-6 text-gray-300 tracking-wide">
              Are you sure you want to execute{' '}
              <span className="text-blue-400">{pendingFlightAction.name.toUpperCase()}</span>?
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setPendingFlightAction(null)}
                className={`px-6 py-3 rounded-lg tracking-wider font-light transition-colors
                  ${selectedModalButton === 'cancel' 
                    ? 'bg-red-500/20 text-red-300 border border-red-500/30 ring-2 ring-red-500/50' 
                    : 'bg-red-500/10 text-red-300 border border-red-500/20 hover:bg-red-500/20'}`}
              >
                CANCEL
              </button>
              <button
                onClick={async () => {
                  if (pendingFlightAction) {
                    await handleFlightAction(pendingFlightAction);
                  }
                  setPendingFlightAction(null);
                }}
                className={`px-6 py-3 rounded-lg tracking-wider font-light transition-colors
                  ${selectedModalButton === 'confirm' 
                    ? 'bg-green-500/20 text-green-300 border border-green-500/30 ring-2 ring-green-500/50' 
                    : 'bg-green-500/10 text-green-300 border border-green-500/20 hover:bg-green-500/20'}`}
              >
                CONFIRM
              </button>
            </div>
            <p className="mt-4 text-sm text-gray-500 tracking-wider">
              Use Arrow Keys to navigate • Enter to confirm • ESC to cancel
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DronePWMControl;
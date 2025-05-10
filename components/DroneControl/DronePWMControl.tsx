// components/DroneControl/DronePWMControl.tsx
import React, { useState, useRef, ReactElement } from 'react';

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

type CommandParams = Record<string, unknown>;

const DronePWMControl: React.FC = () => {
  const PWM_STEP = 50;
  const INITIAL_PWM: PWMValues = { throttle: 1000, yaw: 1500, pitch: 1500, roll: 1500 };

  // Using underscore prefix for unused variables to satisfy ESLint
  const [_pwmValues, setPwmValues] = useState<PWMValues>(INITIAL_PWM);
  const [pendingPWM, setPendingPWM] = useState<PWMValues>(INITIAL_PWM);
  const [flightMode, setFlightMode] = useState<string>('STABILIZE');
  const [armed, setArmed] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [_batteryLevel, _setBatteryLevel] = useState<number>(85); // Mock default
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [pendingFlightAction, setPendingFlightAction] = useState<FlightAction | null>(null);
  const [_pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [autoPWMUpdate, setAutoPWMUpdate] = useState<boolean>(false);
  const [selectedModalButton, setSelectedModalButton] = useState<'confirm' | 'cancel'>('confirm');

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

  // Mock command function - adding underscore to satisfy ESLint
  const _sendCommand = async (command: string, params: CommandParams = {}): Promise<{ success: boolean; message?: string }> => {
    console.log(`Mock sendCommand: ${command}`, params);
    // Simulate a success response
    return { success: true };
  };

  const handleFlightAction = async (action: FlightAction): Promise<void> => {
    try {
      setActionInProgress(action.endpoint);
      setError(null);
      console.log(`Executing ${action.name} command...`);
      
      // Simulate command execution
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update mock state to simulate response
      if (action.endpoint === 'arm') setArmed(true);
      if (action.endpoint === 'disarm') setArmed(false);
      if (['stabilize', 'altitude-hold', 'loiter', 'smart-rtl', 'land'].includes(action.endpoint)) {
        setFlightMode(action.name.toUpperCase());
      }
      
      console.log(`${action.name} command successful`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error executing ${action.name}:`, error);
      setError(`Error: ${errorMessage}`);
    } finally {
      setActionInProgress(null);
    }
  };

  // "Change Now" sends the pending PWM values - adding underscore to satisfy ESLint
  const _handlePWMChangeNow = async (): Promise<void> => {
    try {
      setError(null);
      console.log('Mock: Sending pending PWM values:', pendingPWM);
      
      // In a real implementation, this would send to the drone
      // For mock, just update the confirmed values
      setPwmValues(pendingPWM);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(`Error: ${errorMessage}`);
    }
  };

  // Key events for PWM
  const handleKeyDown = (event: React.KeyboardEvent): void => {
    if (pendingFlightAction) return;
    if (!autoPWMUpdate) return;

    const key = event.key.toLowerCase();
    if (keyMappings[key] && !pressedKeysRef.current.has(key)) {
      event.preventDefault();
      pressedKeysRef.current.add(key);
      setPressedKeys(new Set(pressedKeysRef.current));
      
      // Update the pending PWM value based on the key
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

  // Enhanced PWM gauge rendering - fixed return type to use React.ReactElement instead of JSX.Element
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
      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg tracking-wider font-light">
          {error}
        </div>
      )}

      {/* Two-Column Layout (removed the Control Mapping column) */}
      <div className="flex flex-row space-x-8">
        {/* Column 1: Status & Flight Controls */}
        <div className="w-1/2 space-y-6">
          {/* Status Bar */}
          <div className="bg-slate-800/50 p-6 rounded-lg border border-gray-800 space-y-4">
            <div className="flex flex-col space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 tracking-wider">STATUS</span>
                <span className={`px-3 py-1 rounded-md text-xs tracking-wider font-light ${
                  armed 
                    ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                    : 'bg-red-500/20 text-red-300 border border-red-500/30'
                }`}>
                  {armed ? 'ARMED' : 'DISARMED'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 tracking-wider">MODE</span>
                <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-md text-xs tracking-wider font-light border border-blue-500/30">
                  {flightMode}
                </span>
              </div>
              {_batteryLevel !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 tracking-wider">BATTERY</span>
                  <span className={`px-3 py-1 rounded-md text-xs tracking-wider font-light ${
                    _batteryLevel > 20
                      ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                      : 'bg-red-500/20 text-red-300 border border-red-500/30'
                  }`}>
                    {_batteryLevel}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Flight Controls */}
          <div className="space-y-4">
            <h2 className="text-lg font-light tracking-wider">FLIGHT CONTROLS</h2>
            <div className="grid grid-cols-2 gap-4">
              {flightActions.map((action) => {
                const isLoading = actionInProgress === action.endpoint;
                return (
                  <button
                    key={action.name}
                    onClick={() => setPendingFlightAction(action)}
                    className={`px-4 py-2 rounded-lg font-light tracking-wider text-white
                      bg-slate-800/50 hover:bg-slate-700/50 border border-gray-800
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
                className={`relative inline-flex items-center h-6 rounded-full w-12 transition-colors ${
                  autoPWMUpdate ? 'bg-green-500/50' : 'bg-red-500/50'
                } border ${autoPWMUpdate ? 'border-green-500/30' : 'border-red-500/30'}`}
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

      {/* Confirmation Modal - Enhanced */}
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
                className={`px-6 py-3 rounded-lg tracking-wider font-light
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
                className={`px-6 py-3 rounded-lg tracking-wider font-light
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
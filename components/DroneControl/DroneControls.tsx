// components/DroneControl/DroneControls.tsx
import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel
} from '../ui/AlertDialog';

interface PWMValues {
  throttle: number;
  yaw: number;
  pitch: number;
  roll: number;
}

type StatusData = {
  success: boolean;
  data?: {
    armed?: boolean;
    mode?: string;
  };
};

type CommandParams = {
  key?: string;
  pressed?: boolean;
} | Record<string, unknown>;

const DroneControls: React.FC = () => {
  const [pressedKeys, setPressedKeys] = useState<string[]>([]);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState<boolean>(false);
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [status, setStatus] = useState<StatusData>({ 
    success: true,
    data: { 
      armed: false,
      mode: 'STABILIZE'
    }
  });
  const [error, setError] = useState<string | null>(null);
  const [pwmValues] = useState<PWMValues>({
    throttle: 1500,
    yaw: 1500,
    pitch: 1500,
    roll: 1500
  });

  // Mock sendCommand that will be replaced with actual implementation later
  const sendCommand = async (command: string, params: CommandParams = {}): Promise<{ success: boolean; message?: string }> => {
    console.log(`Mock sendCommand: ${command}`, params);
    
    // Handle move commands specially to update UI
    if (command === 'move' && 'key' in params && params.key) {
      // This is a placeholder - in a real implementation, this would send to the drone
      console.log(`Mock: Moving drone with key ${params.key}, pressed: ${params.pressed}`);
      return { success: true };
    }
    
    // For flight mode commands, update the mock status
    if (['altitude-hold', 'land', 'smart-rtl', 'arm', 'disarm'].includes(command)) {
      // Update mock status based on command
      if (command === 'arm') {
        setStatus(prev => ({ ...prev, data: { ...prev.data, armed: true } }));
      } else if (command === 'disarm') {
        setStatus(prev => ({ ...prev, data: { ...prev.data, armed: false } }));
      } else {
        setStatus(prev => ({ ...prev, data: { ...prev.data, mode: command.toUpperCase() } }));
      }
      return { success: true };
    }
    
    return { success: true };
  };

  const handleKeyDown = async (event: React.KeyboardEvent) => {
    const key = event.key.toUpperCase();
    if (Object.keys(keyFunctions).includes(key) && !pressedKeys.includes(key)) {
      setPressedKeys((prevKeys) => [...prevKeys, key]);
      
      // In a real implementation, this would send to the drone
      console.log(`Mock: Key down - ${key}`);
    }
  };

  const handleKeyUp = async (event: React.KeyboardEvent) => {
    const key = event.key.toUpperCase();
    if (Object.keys(keyFunctions).includes(key)) {
      setPressedKeys((prevKeys) => prevKeys.filter((k) => k !== key));
      
      // In a real implementation, this would send to the drone
      console.log(`Mock: Key up - ${key}`);
    }
  };

  const keyFunctions: Record<string, string[]> = {
    W: ['Pitch Forward'],
    S: ['Pitch Backward'],
    A: ['Yaw Left'],
    D: ['Yaw Right'],
    ARROWUP: ['Throttle Up'],
    ARROWDOWN: ['Throttle Down'],
    ARROWLEFT: ['Roll Left'],
    ARROWRIGHT: ['Roll Right'],
  };

  const handleButtonClick = (action: string) => {
    setSelectedAction(action);
    setIsConfirmationOpen(true);
  };

  const handleConfirmation = async () => {
    const actionMap: Record<string, string> = {
      'Altitude Hold': 'altitude-hold',
      'Land': 'land',
      'Return to Launch': 'smart-rtl',
      'Arm': 'arm',
      'Disarm': 'disarm'
    };

    const endpoint = actionMap[selectedAction];
    if (endpoint) {
      try {
        // In real implementation, you would use this:
        // await sendCommand(endpoint);
        
        console.log(`Mock: Executing ${selectedAction} command`);
        
        // Update UI based on command
        if (endpoint === 'arm') {
          setStatus(prev => ({ ...prev, data: { ...prev.data, armed: true } }));
        } else if (endpoint === 'disarm') {
          setStatus(prev => ({ ...prev, data: { ...prev.data, armed: false } }));
        } else if (endpoint === 'altitude-hold' || endpoint === 'land' || endpoint === 'smart-rtl') {
          setStatus(prev => ({ ...prev, data: { ...prev.data, mode: endpoint.toUpperCase() } }));
        }
      } catch (err) {
        console.error('Command error:', err);
        setError(`Failed to send ${selectedAction} command`);
      }
    }

    setIsConfirmationOpen(false);
  };

  const renderPWMValues = () => (
    <div className="mb-4 p-4 bg-slate-800/50 rounded-lg border border-gray-700">
      <h3 className="text-lg font-light tracking-wider mb-2 text-blue-300">PWM VALUES</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex justify-between px-3 py-2 bg-slate-900/50 rounded">
          <span className="text-gray-400">Throttle:</span>
          <span className="text-white">{pwmValues.throttle}</span>
        </div>
        <div className="flex justify-between px-3 py-2 bg-slate-900/50 rounded">
          <span className="text-gray-400">Yaw:</span>
          <span className="text-white">{pwmValues.yaw}</span>
        </div>
        <div className="flex justify-between px-3 py-2 bg-slate-900/50 rounded">
          <span className="text-gray-400">Pitch:</span>
          <span className="text-white">{pwmValues.pitch}</span>
        </div>
        <div className="flex justify-between px-3 py-2 bg-slate-900/50 rounded">
          <span className="text-gray-400">Roll:</span>
          <span className="text-white">{pwmValues.roll}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-slate-900/50 text-white rounded-lg border border-gray-800 backdrop-blur-sm p-6">
      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg tracking-wider font-light">
          {error}
        </div>
      )}

      {renderPWMValues()}

      {status && (
        <div className="mb-4 p-4 bg-slate-800/50 rounded-lg border border-gray-700">
          <h3 className="text-lg font-light tracking-wider mb-2 text-blue-300">DRONE STATUS</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex justify-between px-3 py-2 bg-slate-900/50 rounded">
              <span className="text-gray-400">Connection:</span>
              <span className={status.success ? 'text-green-400' : 'text-red-400'}>
                {status.success ? 'CONNECTED' : 'DISCONNECTED'}
              </span>
            </div>
            {status.data?.armed !== undefined && (
              <div className="flex justify-between px-3 py-2 bg-slate-900/50 rounded">
                <span className="text-gray-400">Armed:</span>
                <span className={status.data.armed ? 'text-green-400' : 'text-red-400'}>
                  {status.data.armed ? 'YES' : 'NO'}
                </span>
              </div>
            )}
            {status.data?.mode && (
              <div className="flex justify-between px-3 py-2 bg-slate-900/50 rounded">
                <span className="text-gray-400">Mode:</span>
                <span className="text-blue-400">{status.data.mode}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div
        className="border border-gray-700 rounded-lg p-4 bg-slate-800/50 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
      >
        <h2 className="text-lg font-light tracking-wider mb-4 text-blue-300">DRONE CONTROLS</h2>
        <p className="mb-4 text-gray-400">Control mapping:</p>
        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
          <div className="px-3 py-2 bg-slate-900/50 rounded text-gray-300">W/S: Pitch Forward/Back</div>
          <div className="px-3 py-2 bg-slate-900/50 rounded text-gray-300">A/D: Yaw Left/Right</div>
          <div className="px-3 py-2 bg-slate-900/50 rounded text-gray-300">↑/↓: Throttle Up/Down</div>
          <div className="px-3 py-2 bg-slate-900/50 rounded text-gray-300">←/→: Roll Left/Right</div>
        </div>

        <div className="mt-6 flex flex-col items-center justify-center space-y-4">
          <div className="flex flex-row items-center space-x-2">
            {['W'].map((key) => (
              <div key={key} className="flex items-center space-x-0">
                <span className={`inline-block px-4 py-2 rounded-lg ${
                  pressedKeys.includes(key) 
                    ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50' 
                    : 'bg-slate-900/60 text-gray-400 border border-gray-800'
                }`}>
                  {key}
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-row items-center space-x-2">
            {['A', 'S', 'D'].map((key) => (
              <div key={key} className="flex items-center space-x-2">
                <span className={`inline-block px-4 py-2 rounded-lg ${
                  pressedKeys.includes(key) 
                    ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50' 
                    : 'bg-slate-900/60 text-gray-400 border border-gray-800'
                }`}>
                  {key}
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-row items-center space-x-2">
            {['ARROWUP'].map((key) => (
              <div key={key} className="flex items-center space-x-2">
                <span className={`inline-block px-4 py-2 rounded-lg ${
                  pressedKeys.includes(key) 
                    ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50' 
                    : 'bg-slate-900/60 text-gray-400 border border-gray-800'
                }`}>
                  ↑
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-row items-center space-x-2">
            {['ARROWLEFT', 'ARROWDOWN', 'ARROWRIGHT'].map((key) => (
              <div key={key} className="flex items-center space-x-2">
                <span className={`inline-block px-4 py-2 rounded-lg ${
                  pressedKeys.includes(key) 
                    ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50' 
                    : 'bg-slate-900/60 text-gray-400 border border-gray-800'
                }`}>
                  {key === 'ARROWLEFT' ? '←' : key === 'ARROWDOWN' ? '↓' : '→'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          'Altitude Hold',
          'Land',
          'Return to Launch',
          'Arm',
          'Disarm',
        ].map((action) => (
          <button
            key={action}
            className="bg-slate-800/50 hover:bg-slate-700/60 text-white px-4 py-2 rounded-lg border border-gray-700 tracking-wider font-light"
            onClick={() => handleButtonClick(action)}
          >
            {action.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Custom Alert Dialog */}
      <AlertDialog open={isConfirmationOpen} onOpenChange={setIsConfirmationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>CONFIRM ACTION</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {selectedAction.toLowerCase()}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsConfirmationOpen(false)}>
              CANCEL
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmation}>
              CONFIRM
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DroneControls;
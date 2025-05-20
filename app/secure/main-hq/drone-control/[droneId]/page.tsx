// app/secure/main-hq/drone-control/[droneId]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  Plane, ArrowLeft, Signal, Battery, Activity,
  LineChart, Settings, Globe
} from 'lucide-react';
import { useAuth } from '../../../../../lib/auth';
import { useDroneState } from '../../../../../lib/hooks/useDroneState';
import DroneInfoPanel from '../../../../../components/DroneControl/DroneInfoPanel';
import TelemetryDashboard from '../../../../../components/DroneControl/TelemetryDashboard';
import DetailedTelemetry from '../../../../../components/DroneControl/DetailedTelemetry';
import DroneSettings from '../../../../../components/DroneControl/DroneSettings';
import FinalCombinedControl from '../../../../../components/DroneControl/FinalCombinedControl';

export default function DroneControlPage() {
  const router = useRouter();
  const params = useParams();
  const { droneId } = params;
  const { token } = useAuth();
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [socketConnected, setSocketConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [networkLatency, setNetworkLatency] = useState<number | null>(null);

  // Use the custom hook to manage drone state and WebSocket connection
  const { 
    drone, 
    isLoading, 
    error, 
    isConnected,
    latency,
    lastUpdate: lastStateUpdate,
    sendCommand 
  } = useDroneState({
    droneId: droneId as string,
    token,
    initialFetch: true
  });

  // Update UI state based on WebSocket connection
  useEffect(() => {
    setSocketConnected(isConnected);
  }, [isConnected]);

  // Update UI with last update time
  useEffect(() => {
    if (lastStateUpdate) {
      setLastUpdate(lastStateUpdate);
    }
  }, [lastStateUpdate]);

  // Update network latency
  useEffect(() => {
    if (latency !== null) {
      setNetworkLatency(latency);
    }
  }, [latency]);

  const handleReturnToDashboard = () => {
    router.push('/secure/main-hq/dashboard');
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
          <div className="text-white">Connecting to drone {droneId}...</div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-xl mb-4">Connection Error</div>
          <div className="text-white mb-6">{error}</div>
          <button 
            onClick={handleReturnToDashboard}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Show not found state
  if (!drone) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-xl">Drone not found</div>
          <button 
            onClick={handleReturnToDashboard}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-900/90 backdrop-blur-lg shadow-xl border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <button 
                onClick={handleReturnToDashboard}
                className="mr-4 p-2 rounded-full bg-gray-800/60 hover:bg-gray-800 transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-400" />
              </button>
              
              <div className="flex flex-col">
                <div className="flex items-center gap-3">
                  <Plane className="h-6 w-6 text-blue-400" />
                  <h1 className="text-2xl tracking-wide font-light">DRONE CONTROL SYSTEM</h1>
                </div>
                <div className="text-sm text-gray-400">
                  Drone ID: <span className="text-blue-300">{drone.id}</span> | 
                  Model: <span className="text-blue-300">{drone.model || 'Unknown'}</span> | 
                  Status: <span className="text-blue-300">{drone.status || (drone.connected ? 'ACTIVE' : 'OFFLINE')}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-2">
                <Battery className={`h-5 w-5 ${drone.percentage && drone.percentage > 70 ? 'text-blue-500' : drone.percentage && drone.percentage > 30 ? 'text-amber-500' : 'text-rose-500'}`} />
                <span className="text-white">{drone.percentage || 0}%</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Signal className={`h-5 w-5 ${socketConnected ? 'text-blue-500' : 'text-red-500'}`} />
                <span className="text-white">{socketConnected ? 'Connected' : 'Disconnected'}</span>
              </div>
              
              {/* Live Mission Indicator */}
              <div className="bg-blue-900/30 px-3 py-1 rounded-lg border border-blue-500/30">
                <span className="text-sm font-light text-blue-300 tracking-wider">{drone.flight_mode || 'UNKNOWN'}</span>
              </div>
            </div>
          </div>
        </div>
      </header>
      
      {/* Connection info */}
      {lastUpdate && (
        <div className="bg-gray-900/60 border-b border-gray-800">
          <div className="max-w-7xl mx-auto px-4 py-2 sm:px-6 lg:px-8 text-xs text-gray-400 flex justify-between">
            <div>
              Last update: {lastUpdate.toLocaleTimeString()}
            </div>
            <div>
              Latency: {networkLatency !== null ? `${networkLatency}ms` : 'Unknown'}
            </div>
          </div>
        </div>
      )}
      
      {/* Tabs */}
      <div className="bg-gray-900/60 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex overflow-x-auto py-1 no-scrollbar">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-3 mx-1 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2
                ${activeTab === 'dashboard' 
                  ? 'bg-blue-900/20 text-blue-300 border border-blue-500/40' 
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/30'}`}
            >
              <Activity className="h-4 w-4" />
              DASHBOARD
            </button>
            <button 
              onClick={() => setActiveTab('control')}
              className={`px-4 py-3 mx-1 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2
                ${activeTab === 'control' 
                  ? 'bg-blue-900/20 text-blue-300 border border-blue-500/40' 
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/30'}`}
            >
              <Globe className="h-4 w-4" />
              CONTROL CENTER
            </button>
            <button 
              onClick={() => setActiveTab('telemetry')}
              className={`px-4 py-3 mx-1 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2
                ${activeTab === 'telemetry' 
                  ? 'bg-blue-900/20 text-blue-300 border border-blue-500/40' 
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/30'}`}
            >
              <LineChart className="h-4 w-4" />
              TELEMETRY
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-3 mx-1 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2
                ${activeTab === 'settings' 
                  ? 'bg-blue-900/20 text-blue-300 border border-blue-500/40' 
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/30'}`}
            >
              <Settings className="h-4 w-4" />
              SETTINGS
            </button>
          </div>
        </div>
      </div>
      
      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <DroneInfoPanel drone={drone} />
            </div>
            <div className="lg:col-span-2">
              <TelemetryDashboard drone={drone} />
            </div>
          </div>
        )}
        
        {activeTab === 'control' && (
          <div className="space-y-6">
            {/* Camera and basic controls */}
            <FinalCombinedControl 
              drone={drone} 
              onSendCommand={sendCommand} 
              connected={socketConnected}
            />
          </div>
        )}
        
        {activeTab === 'telemetry' && (
          <DetailedTelemetry drone={drone} />
        )}
        
        {activeTab === 'settings' && (
          <DroneSettings 
            drone={drone} 
            onSendCommand={sendCommand} 
            isControlEnabled={socketConnected} 
          />
        )}
      </main>
    </div>
  );
}
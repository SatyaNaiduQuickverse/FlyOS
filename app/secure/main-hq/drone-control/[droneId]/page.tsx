// app/secure/main-hq/drone-control/[droneId]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  Plane, ArrowLeft, Signal, Battery, Activity,
  Camera, Navigation, LineChart, Settings
} from 'lucide-react';
import DroneInfoPanel from '../../../../../components/DroneControl/DroneInfoPanel';
import TelemetryDashboard from '../../../../../components/DroneControl/TelemetryDashboard';
import ControlPanel from '../../../../../components/DroneControl/ControlPanel';
import CameraFeed from '../../../../../components/DroneControl/CameraFeed';
import DetailedTelemetry from '../../../../../components/DroneControl/DetailedTelemetry';
import DroneSettings from '../../../../../components/DroneControl/DroneSettings';

interface DroneData {
  id: string;
  model: string;
  status: string;
  location: string;
  batteryLevel: number;
  signalStrength: number;
  lastActive: string;
  mission: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  altitude: number;
  speed: number;
  heading: number;
}

export default function DroneControlPage() {
  const router = useRouter();
  const params = useParams();
  const { droneId } = params;
  
  const [drone, setDrone] = useState<DroneData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [controlMode, setControlMode] = useState('monitor');
  
  useEffect(() => {
    // Fetch drone data - would connect to your API
    setIsLoading(true);
    setTimeout(() => {
      // Simulated API response
      setDrone({
        id: typeof droneId === 'string' ? droneId : 'unknown',
        model: 'FlyOS-MQ7',
        status: 'ACTIVE',
        location: 'New York',
        batteryLevel: 87,
        signalStrength: 92,
        lastActive: new Date().toISOString(),
        mission: 'Surveillance',
        coordinates: { lat: 40.7128, lng: -74.0060 },
        altitude: 650,
        speed: 45,
        heading: 275,
      });
      setIsLoading(false);
    }, 800);
  }, [droneId]);

  const handleReturnToHub = () => {
    router.push('/secure/main-hq/dashboard');
  };

  const toggleControlMode = () => {
    if (controlMode === 'monitor') {
      if (window.confirm(`Request control of drone ${droneId}?`)) {
        setControlMode('control');
      }
    } else {
      setControlMode('monitor');
    }
  };

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

  if (!drone) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-xl">Drone not found</div>
          <button 
            onClick={handleReturnToHub}
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
                onClick={handleReturnToHub}
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
                  Model: <span className="text-blue-300">{drone.model}</span> | 
                  Status: <span className="text-blue-300">{drone.status}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-2">
                <Battery className={`h-5 w-5 ${drone.batteryLevel > 70 ? 'text-blue-500' : drone.batteryLevel > 30 ? 'text-amber-500' : 'text-rose-500'}`} />
                <span className="text-white">{drone.batteryLevel}%</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Signal className="h-5 w-5 text-blue-500" />
                <span className="text-white">{drone.signalStrength}%</span>
              </div>
              
              <button
                onClick={toggleControlMode}
                className={`px-4 py-2 rounded-lg text-sm border ${
                  controlMode === 'control'
                    ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                    : 'bg-gray-800 border-gray-700 text-gray-300'
                }`}
              >
                {controlMode === 'control' ? 'RELEASE CONTROL' : 'REQUEST CONTROL'}
              </button>
            </div>
          </div>
        </div>
      </header>
      
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
              <Navigation className="h-4 w-4" />
              CONTROL
            </button>
            <button 
              onClick={() => setActiveTab('camera')}
              className={`px-4 py-3 mx-1 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2
                ${activeTab === 'camera' 
                  ? 'bg-blue-900/20 text-blue-300 border border-blue-500/40' 
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/30'}`}
            >
              <Camera className="h-4 w-4" />
              CAMERA FEED
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
          <ControlPanel 
            drone={drone} 
            isControlEnabled={controlMode === 'control'} 
            onRequestControl={toggleControlMode}
          />
        )}
        
        {activeTab === 'camera' && (
          <CameraFeed 
            drone={drone}
            isControlEnabled={controlMode === 'control'}
          />
        )}
        
        {activeTab === 'telemetry' && (
          <DetailedTelemetry />
        )}
        
        {activeTab === 'settings' && (
          <DroneSettings 
            isControlEnabled={controlMode === 'control'}
          />
        )}
      </main>
    </div>
  );
}
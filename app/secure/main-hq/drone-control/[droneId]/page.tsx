// app/secure/main-hq/drone-control/[droneId]/page.tsx - COMPLETE WITH MAVROS IN TELEMETRY
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  Plane, ArrowLeft, Signal, Battery, Activity,
  LineChart, Settings, Globe, Wifi, WifiOff,
  RefreshCw, AlertTriangle, Camera, MapPin,
  Package, Sliders, Upload, Route
} from 'lucide-react';
import { useAuth } from '../../../../../lib/auth';
import { useDroneState } from '../../../../../lib/hooks/useDroneState';

// Import ALL components including the new MAVROS component
import DroneInfoPanel from '../../../../../components/DroneControl/DroneInfoPanel';
import TelemetryDashboard from '../../../../../components/DroneControl/TelemetryDashboard';
import DetailedTelemetry from '../../../../../components/DroneControl/DetailedTelemetry';
import DroneSettings from '../../../../../components/DroneControl/DroneSettings';
import CameraFeed from '../../../../../components/DroneControl/CameraFeed';
import DronePWMControl from '../../../../../components/DroneControl/DronePWMControl';
import WaypointDropbox from '../../../../../components/DroneControl/WaypointDropbox';
import DronePayload from '../../../../../components/DroneControl/DronePayload';
import DroneMap from '../../../../../components/DroneControl/DroneMap';
import ParameterManager from '../../../../../components/ParameterManager';
import MissionPlanner from '../../../../../components/MissionPlanner';
import DroneBattery from '../../../../../components/DroneControl/DroneBattery';
import MAVROSMonitor from '../../../../../components/DroneControl/MAVROSMonitor'; // NEW IMPORT

export default function DroneControlPage() {
  const router = useRouter();
  const params = useParams();
  const { droneId } = params;
  const { token } = useAuth();
  
  const [activeTab, setActiveTab] = useState('dashboard');

  // Use the existing WebSocket-enabled hook (no changes needed)
  const { 
    drone, 
    isLoading, 
    error, 
    isConnected,
    latency,
    lastUpdate,
    sendCommand,
    refreshDrone
  } = useDroneState({
    droneId: droneId as string,
    token,
    initialFetch: true
  });

  const handleManualRefresh = async () => {
    try {
      await refreshDrone();
    } catch (err) {
      console.error('Manual refresh failed:', err);
    }
  };

  const handleReturnToDashboard = () => {
    router.push('/secure/main-hq/dashboard');
  };

  // Format latency with color coding
  const formatLatency = (lat: number | null) => {
    if (lat === null) return { value: 'Unknown', color: 'text-gray-400', status: 'Unknown' };
    if (lat < 50) return { value: `${lat}ms`, color: 'text-green-400', status: 'Excellent' };
    if (lat < 100) return { value: `${lat}ms`, color: 'text-yellow-400', status: 'Good' };
    if (lat < 300) return { value: `${lat}ms`, color: 'text-orange-400', status: 'Fair' };
    return { value: `${lat}ms`, color: 'text-red-400', status: 'Poor' };
  };

  const latencyInfo = formatLatency(latency);

  // Show loading state
  if (isLoading && !drone) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
          <div className="text-white">Connecting to drone {droneId}...</div>
          <div className="text-gray-400 text-sm mt-2">Establishing connection...</div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && !drone) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <div className="text-red-500 text-xl mb-4">Connection Error</div>
          <div className="text-white mb-6 bg-gray-800 p-4 rounded-lg">{error}</div>
          <div className="space-y-3">
            <button 
              onClick={handleManualRefresh}
              className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center justify-center gap-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Retrying...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  <span>Retry Connection</span>
                </>
              )}
            </button>
            <button 
              onClick={handleReturnToDashboard}
              className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show not found state
  if (!drone && !isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Plane className="h-16 w-16 text-gray-500 mx-auto mb-4" />
          <div className="text-white text-xl mb-4">Drone not found</div>
          <button 
            onClick={handleReturnToDashboard}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
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
                  Drone ID: <span className="text-blue-300">{drone?.id}</span> | 
                  Model: <span className="text-blue-300">{drone?.model || 'Unknown'}</span> | 
                  Status: <span className="text-blue-300">{drone?.status || (drone?.connected ? 'ACTIVE' : 'OFFLINE')}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-5">
              {/* Battery indicator */}
              <div className="flex items-center gap-2">
                <Battery className={`h-5 w-5 ${
                  drone?.percentage && drone.percentage > 70 ? 'text-green-500' : 
                  drone?.percentage && drone.percentage > 30 ? 'text-amber-500' : 'text-red-500'
                }`} />
                <span className="text-white">{drone?.percentage || 0}%</span>
              </div>
              
              {/* Connection indicator */}
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <>
                    <Wifi className="h-5 w-5 text-green-500" />
                    <span className="text-green-400">Live</span>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-5 w-5 text-red-500" />
                    <span className="text-red-400">Offline</span>
                  </>
                )}
              </div>
              
              {/* Manual refresh button */}
              <button
                onClick={handleManualRefresh}
                disabled={isLoading}
                className="p-2 bg-gray-800/60 hover:bg-gray-800 border border-gray-700 rounded-lg transition-colors"
                title="Manual Refresh"
              >
                <RefreshCw className={`h-4 w-4 text-gray-300 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              
              {/* Flight mode indicator */}
              <div className="bg-blue-900/30 px-3 py-1 rounded-lg border border-blue-500/30">
                <span className="text-sm font-light text-blue-300 tracking-wider">
                  {drone?.flight_mode || 'UNKNOWN'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>
      
      {/* Connection status bar */}
      <div className="bg-gray-900/60 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-2 sm:px-6 lg:px-8 text-xs text-gray-400 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span>Connection:</span>
              <span className={isConnected ? 'text-green-400' : 'text-red-400'}>
                {isConnected ? 'WebSocket Active' : 'API Polling'}
              </span>
            </div>
            
            {lastUpdate && (
              <div className="flex items-center gap-2">
                <span>Last update:</span>
                <span className="text-white">{lastUpdate.toLocaleTimeString()}</span>
              </div>
            )}
            
            {latency !== null && (
              <div className="flex items-center gap-2">
                <span>Response time:</span>
                <span className={latencyInfo.color} title={`${latencyInfo.status} connection quality`}>
                  {latencyInfo.value}
                </span>
              </div>
            )}
          </div>
          
          {/* Error indicator */}
          {error && (
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-4 w-4" />
              <span className="truncate max-w-md">{error}</span>
            </div>
          )}
        </div>
      </div>
      
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
              onClick={() => setActiveTab('planning')}
              className={`px-4 py-3 mx-1 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2
                ${activeTab === 'planning' 
                  ? 'bg-blue-900/20 text-blue-300 border border-blue-500/40' 
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/30'}`}
            >
              <Route className="h-4 w-4" />
              PLANNING
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
              onClick={() => setActiveTab('params')}
              className={`px-4 py-3 mx-1 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2
                ${activeTab === 'params' 
                  ? 'bg-blue-900/20 text-blue-300 border border-blue-500/40' 
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/30'}`}
            >
              <Sliders className="h-4 w-4" />
              PARAMS
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
        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && drone && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <DroneInfoPanel drone={drone} token={token} />
            </div>
            <div className="lg:col-span-2">
              <TelemetryDashboard drone={drone} />
            </div>
          </div>
        )}
        
        {/* PLANNING TAB */}
        {activeTab === 'planning' && (
          <div className="bg-black text-white min-h-[600px]">
            <MissionPlanner />
          </div>
        )}
        
        {/* UNIFIED CONTROL CENTER TAB */}
        {activeTab === 'control' && drone && (
          <div className="space-y-6">
            {/* Camera Feed */}
            <CameraFeed drone={drone} isControlEnabled={isConnected} />

            {/* Control Grid - 2x2 Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Map */}
              <div className="h-[400px] rounded-lg overflow-hidden">
                <DroneMap className="w-full h-full" />
              </div>

              {/* Payload */}
              <DronePayload />

              {/* PWM Control */}
              <DronePWMControl />

              {/* Waypoint */}
              <div className="flex justify-center">
                <WaypointDropbox />
              </div>
            </div>
          </div>
        )}
        
        {/* TELEMETRY TAB - WITH INTEGRATED BATTERY AND MAVROS COMPONENTS */}
        {activeTab === 'telemetry' && (
          <div className="space-y-6">
            {/* Detailed Telemetry */}
            <DetailedTelemetry droneId={droneId as string} token={token} />
            
            {/* Grid Layout: Battery and MAVROS side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Battery Component */}
              <div className="lg:col-span-1">
                <DroneBattery />
              </div>
              
              {/* NEW: MAVROS Monitor Component */}
              <div className="lg:col-span-1">
                <MAVROSMonitor droneId={droneId as string} />
              </div>
            </div>
          </div>
        )}
        
        {/* PARAMS TAB */}
        {activeTab === 'params' && (
          <ParameterManager 
            droneId={droneId as string}
            isControlEnabled={isConnected}
          />
        )}
        
        {/* SETTINGS TAB */}
        {activeTab === 'settings' && drone && (
          <DroneSettings 
            drone={drone} 
            onSendCommand={sendCommand} 
            isControlEnabled={isConnected} 
          />
        )}
      </main>
    </div>
  );
}
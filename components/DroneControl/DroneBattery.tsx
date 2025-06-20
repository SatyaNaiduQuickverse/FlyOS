// components/DroneControl/DroneBattery.tsx - CLEAN UI VERSION
import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Battery, Zap, AlertTriangle, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useDroneState } from '../../lib/hooks/useDroneState';
import { useAuth } from '../../lib/auth';

interface TelemetryPoint {
  time: string;
  timestamp: number;
  voltage: number;
  current: number;
  power: number;
}

const DroneBattery: React.FC = () => {
  const params = useParams();
  const droneId = params?.droneId as string;
  const { token } = useAuth();

  // Use existing drone state hook that handles both WebSocket and API polling
  const { 
    drone, 
    isLoading, 
    error: droneError, 
    isConnected,
    lastUpdate
  } = useDroneState({
    droneId: droneId as string,
    token,
    initialFetch: true
  });

  // Core state
  const [voltage, setVoltage] = useState(16.8);
  const [current, setCurrent] = useState(0);
  const [percentage, setPercentage] = useState(100);
  const [showPowerGraph, setShowPowerGraph] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());
  const [showAllTime, setShowAllTime] = useState(false);
  const [windowSize, setWindowSize] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`graphWindowSize_${droneId}`);
      return saved ? parseInt(saved) : 30;
    }
    return 30;
  });
  const [error, setError] = useState<string | null>(null);
  const [currentDomain, setCurrentDomain] = useState([0, 20]);

  // Persistent data state using drone-specific localStorage
  const [telemetryHistory, setTelemetryHistory] = useState<TelemetryPoint[]>(() => {
    if (typeof window !== 'undefined' && droneId) {
      const saved = localStorage.getItem(`batteryHistory_${droneId}`);
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  // Constants
  const MAX_VOLTAGE = 16.8;
  const MIN_VOLTAGE = 14.8;
  const WARNING_VOLTAGE = 15.0;
  const CRITICAL_PERCENTAGE = 15;
  const MIN_DOMAIN_CURRENT = [0, 20];

  // Derived calculations
  const instantPower = voltage * current;
  const batteryPercentage = Math.max(0, Math.min(100,
    ((voltage - MIN_VOLTAGE) / (MAX_VOLTAGE - MIN_VOLTAGE)) * 100
  ));
  const isLowVoltage = voltage <= WARNING_VOLTAGE;
  const isCriticalPercentage = percentage <= CRITICAL_PERCENTAGE;
  const totalPowerDraw = telemetryHistory.reduce((acc, point) => acc + (point.power * (1/36000)), 0);

  // Save to localStorage whenever history updates
  useEffect(() => {
    if (typeof window !== 'undefined' && droneId) {
      localStorage.setItem(`batteryHistory_${droneId}`, JSON.stringify(telemetryHistory));
    }
  }, [telemetryHistory, droneId]);

  // Save window size to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && droneId) {
      localStorage.setItem(`graphWindowSize_${droneId}`, windowSize.toString());
    }
  }, [windowSize, droneId]);

  // Update battery data when drone state changes (from WebSocket or API)
  useEffect(() => {
    if (drone) {
      console.log('🔋 Updating battery from drone state:', {
        voltage: drone.voltage,
        current: drone.current,
        percentage: drone.percentage,
        connected: drone.connected
      });

      // Update battery metrics from the unified drone state
      if (typeof drone.voltage === 'number' && !isNaN(drone.voltage) && drone.voltage >= 0) {
        setVoltage(drone.voltage);
      }
      if (typeof drone.current === 'number' && !isNaN(drone.current)) {
        setCurrent(Math.abs(drone.current));
      }
      if (typeof drone.percentage === 'number' && !isNaN(drone.percentage)) {
        setPercentage(drone.percentage);
      }
      
      setLastUpdateTime(Date.now());
      
      // Update telemetry history with new data point
      updateTelemetry(
        drone.voltage || voltage, 
        Math.abs(drone.current || current)
      );
    }
  }, [drone]); // React to changes in the unified drone state

  // Handle errors from the drone state hook
  useEffect(() => {
    if (droneError) {
      setError(droneError);
    } else {
      setError(null);
    }
  }, [droneError]);

  // Update telemetry data
  const updateTelemetry = useCallback((v: number, c: number) => {
    const now = Date.now();
    const newPoint: TelemetryPoint = {
      time: new Date().toLocaleTimeString(),
      timestamp: now,
      voltage: v,
      current: c,
      power: v * c
    };

    setTelemetryHistory(prev => {
      const updatedHistory = [...prev, newPoint];
      // Dynamically adjust current domain based on WINDOWED data
      const windowedData = updatedHistory.slice(-windowSize);
      const currentValues = windowedData.map(p => p.current);
      const minCurrent = Math.min(0, ...currentValues);
      const maxCurrent = Math.max(...currentValues, MIN_DOMAIN_CURRENT[1]);

      setCurrentDomain([
        Math.min(minCurrent, MIN_DOMAIN_CURRENT[0]),
        maxCurrent * 1.2
      ]);
      return updatedHistory;
    });
  }, [windowSize]);

  const clearHistory = () => {
    setTelemetryHistory([]);
    if (typeof window !== 'undefined' && droneId) {
      localStorage.removeItem(`batteryHistory_${droneId}`);
    }
  };

  // Get data based on view mode
  const displayData = showAllTime ? telemetryHistory : telemetryHistory.slice(-windowSize);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 p-2 rounded-lg border border-slate-700">
          <p className="text-white">{payload[0].payload.time}</p>
          <p className="text-blue-400">Voltage: {payload[0].payload.voltage.toFixed(2)}V</p>
          <p className="text-yellow-400">Current: {payload[0].payload.current.toFixed(1)}A</p>
          <p className="text-green-400">Power: {payload[0].payload.power.toFixed(1)}W</p>
        </div>
      );
    }
    return null;
  };

  // Show loading state while drone data is being fetched
  if (isLoading && !drone) {
    return (
      <div className="bg-slate-900/50 text-white rounded-lg shadow-lg border border-gray-800 backdrop-blur-sm shadow-slate-900/50 p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mr-3"></div>
          <span className="text-gray-400">Loading battery telemetry...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/50 text-white rounded-lg shadow-lg border border-gray-800 backdrop-blur-sm shadow-slate-900/50 space-y-6">
      {/* Connection Error Display */}
      {error && (
        <div className="mx-6 mt-6 p-4 bg-red-500/10 border border-red-500 rounded-lg">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* CLEAN HEADER SECTION */}
      <div className="p-6 pb-3">
        {/* Row 1: Clean Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
          <h2 className="text-lg font-light tracking-wider text-blue-300">BATTERY STATUS</h2>
          <div className="text-xs text-gray-400 bg-gray-800/50 px-2 py-1 rounded">
            {droneId}
          </div>
        </div>
        
        {/* Row 2: Controls */}
        <div className="flex items-center gap-4 text-sm">
          {!showAllTime && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400 tracking-wider">WINDOW:</span>
              <select
                value={windowSize}
                onChange={(e) => setWindowSize(Number(e.target.value))}
                className="bg-slate-800/70 text-white px-2 py-1 rounded border border-gray-800 text-xs"
              >
                <option value="10">10 points</option>
                <option value="30">30 points</option>
                <option value="60">60 points</option>
                <option value="120">120 points</option>
                <option value="300">300 points</option>
              </select>
            </div>
          )}
          <button
            onClick={() => setShowAllTime(!showAllTime)}
            className="flex items-center gap-1 px-2 py-1 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 border border-blue-500/30 text-xs tracking-wider"
          >
            {showAllTime ? 'Real-time' : 'All-time'}
          </button>
          <button
            onClick={clearHistory}
            className="flex items-center gap-1 px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/30 text-xs tracking-wider"
          >
            <Trash2 size={12} />
            Clear
          </button>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-3 gap-6 px-6">
        <div className="bg-slate-800/50 p-6 rounded-lg border border-gray-800">
          <div className="flex items-center gap-2 text-blue-400 mb-3">
            <Battery />
            <span className="text-sm tracking-wider">VOLTAGE</span>
          </div>
          <div className="text-2xl font-light tracking-wider">{voltage.toFixed(2)}V</div>
          <div className="text-sm text-gray-400 tracking-wider mt-2">Range: {MIN_VOLTAGE}V - {MAX_VOLTAGE}V</div>
        </div>

        <div className="bg-slate-800/50 p-6 rounded-lg border border-gray-800">
          <div className="flex items-center gap-2 text-yellow-400 mb-3">
            <Zap />
            <span className="text-sm tracking-wider">CURRENT DRAW</span>
          </div>
          <div className="text-2xl font-light tracking-wider">{current.toFixed(1)}A</div>
          <div className="text-sm text-gray-400 tracking-wider mt-2">Power: {instantPower.toFixed(1)}W</div>
        </div>

        <div className="bg-slate-800/50 p-6 rounded-lg border border-gray-800">
          <div className="flex items-center gap-2 text-green-400 mb-3">
            <Battery className={percentage <= 20 ? 'animate-pulse text-red-400' : ''} />
            <span className="text-sm tracking-wider">BATTERY STATUS</span>
          </div>
          <div className="text-2xl font-light tracking-wider">{Math.max(0, Math.min(100, percentage)).toFixed(1)}%</div>
          <div className="text-sm text-gray-400 tracking-wider mt-2">
            Total: {totalPowerDraw.toFixed(2)} Wh
          </div>
        </div>
      </div>

      {/* Main Graph */}
      <div className="bg-slate-800/50 mx-6 p-6 rounded-lg border border-gray-800">
        <h3 className="text-lg font-light tracking-wider mb-4 text-blue-300">VOLTAGE & CURRENT HISTORY</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={displayData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="time"
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF' }}
              />
              <YAxis
                yAxisId="current"
                domain={currentDomain}
                stroke="#EAB308"
                tick={{ fill: '#9CA3AF' }}
                label={{
                  value: 'Current (A)',
                  angle: -90,
                  position: 'insideLeft',
                  fill: '#9CA3AF'
                }}
              />
              <YAxis
                yAxisId="voltage"
                orientation="right"
                domain={[14, 17]}
                stroke="#3B82F6"
                tick={{ fill: '#9CA3AF' }}
                label={{
                  value: 'Voltage (V)',
                  angle: 90,
                  position: 'insideRight',
                  fill: '#9CA3AF'
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                yAxisId="current"
                type="monotone"
                dataKey="current"
                stroke="#EAB308"
                strokeWidth={2}
                dot={false}
              />
              <Line
                yAxisId="voltage"
                type="monotone"
                dataKey="voltage"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Power Graph Toggle - UNCHANGED */}
      <div className="mx-6">
        <button
          onClick={() => setShowPowerGraph(prev => !prev)}
          className="w-full py-2 px-4 rounded-md bg-slate-800/50 hover:bg-slate-700/50 flex items-center justify-center gap-2 border border-gray-800 tracking-wider"
        >
          {showPowerGraph ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          {showPowerGraph ? 'HIDE POWER GRAPH' : 'SHOW POWER GRAPH'}
        </button>
      </div>

      {/* Power Graph - UNCHANGED */}
      {showPowerGraph && (
        <div className="bg-slate-800/50 mx-6 p-6 rounded-lg border border-gray-800">
          <h3 className="text-lg font-light tracking-wider mb-4 text-blue-300">POWER CONSUMPTION HISTORY</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={displayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="time"
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF' }}
                />
                <YAxis
                  stroke="#10B981"
                  tick={{ fill: '#9CA3AF' }}
                  label={{
                    value: 'Power (W)',
                    angle: -90,
                    position: 'insideLeft',
                    fill: '#9CA3AF'
                  }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="power"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Warning Indicator */}
      {(isLowVoltage || isCriticalPercentage) && (
        <div className="mx-6 p-6 rounded-lg border border-red-500 bg-red-500/10 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="bg-red-500/20 rounded-full p-2 border border-red-500/30">
              <AlertTriangle className="animate-pulse text-red-400" size={24} />
            </div>
            <div>
              <h4 className="text-red-200 font-light text-lg tracking-wider">
                {isCriticalPercentage ? 'CRITICAL BATTERY LEVEL' : 'LOW BATTERY WARNING'}
              </h4>
              <p className="text-red-200 tracking-wider mt-1">
                {isCriticalPercentage
                  ? `Battery at ${percentage.toFixed(1)}% - Land immediately!`
                  : `Battery voltage at ${voltage.toFixed(1)}V - Prepare to land`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ENHANCED STATUS MESSAGE - WITH CONNECTION INFO */}
      <div className="text-sm text-gray-400 px-6 pb-6 tracking-wider space-y-1">
        <div className="flex items-center gap-4 flex-wrap">
          <span>STATUS: {isCriticalPercentage ? 'CRITICAL' : isLowVoltage ? 'WARNING' : 'NORMAL'}</span>
          <span className="text-gray-600">•</span>
          <span>LAST UPDATED: {new Date(lastUpdateTime).toLocaleTimeString()}</span>
          <span className="text-gray-600">•</span>
          <span>DRONE: {droneId}</span>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <span>CONNECTION: {isConnected ? 'WebSocket Active' : 'API Polling'}</span>
          {lastUpdate && (
            <>
              <span className="text-gray-600">•</span>
              <span>DATA SOURCE: {isConnected ? 'Live Stream' : 'Periodic Fetch'}</span>
              <span className="text-gray-600">•</span>
              <span>SYNC: {lastUpdate.toLocaleTimeString()}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DroneBattery;
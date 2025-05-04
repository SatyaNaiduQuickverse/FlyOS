// components/DroneControl/DetailedTelemetry.tsx
import React, { useState, useEffect } from 'react';
import { LineChart, Clock, Database, Download, Filter, ArrowDownCircle } from 'lucide-react';

interface DetailedTelemetryProps {
  // Since drone isn't used, we can either remove it or keep the interface minimal
  droneId?: string;
}

interface TelemetryLogEntry {
  timestamp: Date;
  altitude: number;
  speed: number;
  heading: number;
  battery: number;
  signalStrength: number;
  coordinates: {
    lat: number;
    lng: number;
  };
}

const DetailedTelemetry: React.FC<DetailedTelemetryProps> = () => {
  const [timeRange, setTimeRange] = useState('15min');
  const [isRecording, setIsRecording] = useState(false);
  const [telemetryLog, setTelemetryLog] = useState<TelemetryLogEntry[]>([]);
  
  // Simulate fetching telemetry logs
  useEffect(() => {
    // This would be replaced with actual API call
    const generateLogs = () => {
      const now = new Date();
      const logs: TelemetryLogEntry[] = [];
      
      // Generate dummy logs for the last hour
      for (let i = 60; i >= 0; i--) {
        const timestamp = new Date(now.getTime() - i * 60000);
        logs.push({
          timestamp,
          altitude: 500 + Math.sin(i / 5) * 100 + Math.random() * 50,
          speed: 40 + Math.cos(i / 10) * 15 + Math.random() * 5,
          heading: (i * 6) % 360,
          battery: 100 - (i * 0.5),
          signalStrength: 95 - Math.sin(i / 8) * 10,
          coordinates: {
            lat: 40.7128 + (Math.sin(i / 30) * 0.01),
            lng: -74.0060 + (Math.cos(i / 20) * 0.01)
          }
        });
      }
      
      setTelemetryLog(logs);
    };
    
    generateLogs();
    
    // Simulate real-time updates
    if (isRecording) {
      const interval = setInterval(() => {
        setTelemetryLog(prev => {
          if (prev.length === 0) return prev;
          
          const lastEntry = prev[prev.length - 1];
          const newTimestamp = new Date();
          
          const newEntry: TelemetryLogEntry = {
            timestamp: newTimestamp,
            altitude: lastEntry.altitude + (Math.random() * 20 - 10),
            speed: lastEntry.speed + (Math.random() * 5 - 2.5),
            heading: (lastEntry.heading + (Math.random() * 10 - 5)) % 360,
            battery: lastEntry.battery - 0.1,
            signalStrength: Math.min(Math.max(lastEntry.signalStrength + (Math.random() * 4 - 2), 60), 100),
            coordinates: {
              lat: lastEntry.coordinates.lat + (Math.random() * 0.001 - 0.0005),
              lng: lastEntry.coordinates.lng + (Math.random() * 0.001 - 0.0005)
            }
          };
          
          return [...prev.slice(1), newEntry];
        });
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [isRecording]);
  
  const filteredLogs = () => {
    const now = new Date();
    let cutoff: Date;
    
    switch (timeRange) {
      case '5min':
        cutoff = new Date(now.getTime() - 5 * 60000);
        break;
      case '15min':
        cutoff = new Date(now.getTime() - 15 * 60000);
        break;
      case '30min':
        cutoff = new Date(now.getTime() - 30 * 60000);
        break;
      case '1hour':
        cutoff = new Date(now.getTime() - 60 * 60000);
        break;
      default:
        cutoff = new Date(now.getTime() - 15 * 60000);
    }
    
    return telemetryLog.filter(log => log.timestamp >= cutoff);
  };
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  
  return (
    <div className="space-y-6">
      <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm border border-gray-800">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <LineChart className="h-5 w-5 text-blue-400" />
            <h3 className="text-lg font-light tracking-wider text-blue-300">TELEMETRY LOGS</h3>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-gray-400" />
              <select
                className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-sm"
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
              >
                <option value="5min">Last 5 minutes</option>
                <option value="15min">Last 15 minutes</option>
                <option value="30min">Last 30 minutes</option>
                <option value="1hour">Last hour</option>
              </select>
            </div>
            
            <button
              onClick={() => setIsRecording(!isRecording)}
              className={`px-4 py-1.5 rounded-lg text-sm flex items-center gap-2 ${
                isRecording 
                  ? 'bg-red-500/20 border border-red-500/30 text-red-300' 
                  : 'bg-blue-500/20 border border-blue-500/30 text-blue-300'
              }`}
            >
              {isRecording ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
                  <span>Recording</span>
                </>
              ) : (
                <>
                  <Database className="h-4 w-4" />
                  <span>Start Recording</span>
                </>
              )}
            </button>
            
            <button className="p-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 hover:text-white transition-colors">
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        {/* Telemetry Chart - This would be replaced with a real chart library like recharts */}
        <div className="bg-gray-800/80 rounded-lg border border-gray-700 p-4 h-80 relative">
          {/* Chart placeholder */}
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-gray-400">Telemetry data chart would be rendered here</p>
          </div>
          
          {/* Y-axis labels */}
          <div className="absolute left-4 top-0 bottom-0 flex flex-col justify-between text-xs text-gray-400">
            <span>1000m</span>
            <span>750m</span>
            <span>500m</span>
            <span>250m</span>
            <span>0m</span>
          </div>
          
          {/* X-axis labels */}
          <div className="absolute left-12 right-4 bottom-4 flex justify-between text-xs text-gray-400">
            {filteredLogs().length > 0 && (
              <>
                <span>{formatTime(filteredLogs()[0].timestamp)}</span>
                <span>{formatTime(filteredLogs()[Math.floor(filteredLogs().length/3)].timestamp)}</span>
                <span>{formatTime(filteredLogs()[Math.floor(filteredLogs().length*2/3)].timestamp)}</span>
                <span>{formatTime(filteredLogs()[filteredLogs().length-1].timestamp)}</span>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Telemetry Log Table */}
      <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm border border-gray-800">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-medium text-blue-300 flex items-center gap-2">
            <Database className="h-4 w-4" />
            TELEMETRY LOG
          </h3>
          
          <div className="flex items-center gap-2">
            <button className="p-1.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 hover:text-white transition-colors">
              <Filter className="h-4 w-4" />
            </button>
            <button className="p-1.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 hover:text-white transition-colors">
              <ArrowDownCircle className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto max-h-96">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-800/80">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Timestamp
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Altitude
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Speed
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Heading
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Battery
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Signal
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Coordinates
                </th>
              </tr>
            </thead>
            <tbody className="bg-gray-900/30 divide-y divide-gray-800">
              {filteredLogs().slice(-10).reverse().map((log, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-gray-800/20' : 'bg-gray-800/40'}>
                  <td className="px-6 py-2 whitespace-nowrap text-sm text-white">
                    {formatTime(log.timestamp)}
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-sm text-white">
                    {Math.round(log.altitude)} m
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-sm text-white">
                    {Math.round(log.speed)} km/h
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-sm text-white">
                    {Math.round(log.heading)}°
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-sm">
                    <span className={
                      log.battery > 70 ? 'text-green-400' : 
                      log.battery > 30 ? 'text-yellow-400' : 'text-red-400'
                    }>
                      {Math.round(log.battery)}%
                    </span>
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-sm">
                    <span className={
                      log.signalStrength > 80 ? 'text-green-400' : 
                      log.signalStrength > 60 ? 'text-yellow-400' : 'text-red-400'
                    }>
                      {Math.round(log.signalStrength)}%
                    </span>
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-sm text-white">
                    {log.coordinates.lat.toFixed(4)}, {log.coordinates.lng.toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DetailedTelemetry;
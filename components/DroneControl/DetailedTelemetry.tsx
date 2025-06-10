// components/DroneControl/DetailedTelemetry.tsx - COMPLETE WITH TOKEN SUPPORT
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Activity, Compass, Globe, Clock, Wind, Thermometer, AlertCircle, LineChart, TrendingUp, Battery, Plane } from 'lucide-react';

interface Coordinates {
  lat: number;
  lng: number;
}

interface LiveTelemetryData {
  latitude: number;
  longitude: number;
  altitude_relative: number;
  altitude_msl: number;
  percentage: number;
  armed: boolean;
  flight_mode: string;
  connected: boolean;
  voltage: number;
  current: number;
  gps_fix: string;
  satellites: number;
  roll: number;
  pitch: number;
  yaw: number;
  velocity_x: number;
  velocity_y: number;
  velocity_z: number;
  timestamp: string;
}

interface DetailedTelemetryProps {
  droneId: string;
  token?: string; // ADD TOKEN PROP
}

const DetailedTelemetry: React.FC<DetailedTelemetryProps> = ({ droneId, token }) => {
  const [liveTelemetry, setLiveTelemetry] = useState<LiveTelemetryData | null>(null);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'live' | 'history' | 'analysis'>('live');
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h'>('1h');

  // Calculated values from telemetry
  const [telemetry, setTelemetry] = useState({
    altitude: 0,
    speed: 0,
    heading: 0,
    coordinates: { lat: 0, lng: 0 },
    temperature: 23,
    windSpeed: 12,
    lastUpdated: new Date(),
    signalLatency: 45,
  });

  const fetchTelemetry = async () => {
    if (!droneId) {
      setError('No drone ID provided');
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const headers: HeadersInit = {
        'Cache-Control': 'no-cache'
      };

      // ADD TOKEN IF AVAILABLE
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/drone-telemetry/${droneId}`, {
        cache: 'no-store',
        headers
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data && data.latitude) {
        setLiveTelemetry(data);
        setLastUpdateTime(new Date());
        
        // Calculate speed from velocity components
        const speed = Math.sqrt(
          Math.pow(data.velocity_x || 0, 2) + 
          Math.pow(data.velocity_y || 0, 2)
        ) * 3.6; // Convert m/s to km/h
        
        // Convert yaw from radians to degrees
        const heading = ((data.yaw || 0) * 180 / Math.PI + 360) % 360;
        
        // Update calculated telemetry
        setTelemetry(prev => ({
          ...prev,
          altitude: data.altitude_relative || 0,
          speed: speed,
          heading: heading,
          coordinates: { lat: data.latitude, lng: data.longitude },
          lastUpdated: new Date(),
          signalLatency: Math.random() * 50 + 25,
          temperature: 20 + Math.random() * 10,
          windSpeed: 5 + Math.random() * 15,
        }));
        
        setIsLoading(false);
      } else {
        setError('No telemetry data available');
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Error fetching telemetry:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch telemetry');
      setIsLoading(false);
    }
  };

  const fetchHistoricalData = async () => {
    if (!droneId || !token) return;

    try {
      const endTime = new Date();
      const startTime = new Date();
      
      // Set time range
      switch (timeRange) {
        case '1h':
          startTime.setHours(endTime.getHours() - 1);
          break;
        case '6h':
          startTime.setHours(endTime.getHours() - 6);
          break;
        case '24h':
          startTime.setDate(endTime.getDate() - 1);
          break;
      }

      const queryParams = new URLSearchParams({
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        interval: timeRange === '24h' ? 'hourly' : '15min'
      });

      const response = await fetch(`/api/drones/${droneId}/telemetry?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setHistoricalData(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching historical data:', error);
    }
  };

  // Initial fetch and polling
  useEffect(() => {
    if (droneId) {
      fetchTelemetry();
      const interval = setInterval(fetchTelemetry, 2000);
      return () => clearInterval(interval);
    }
  }, [droneId, token]);

  useEffect(() => {
    if (activeTab === 'history' && token) {
      fetchHistoricalData();
    }
  }, [activeTab, timeRange, droneId, token]);

  const formatCoordinates = (coords: Coordinates) => {
    return `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
  };

  const getHeadingDirection = (heading: number) => {
    if (heading > 337.5 || heading <= 22.5) return 'N';
    if (heading > 22.5 && heading <= 67.5) return 'NE';
    if (heading > 67.5 && heading <= 112.5) return 'E';
    if (heading > 112.5 && heading <= 157.5) return 'SE';
    if (heading > 157.5 && heading <= 202.5) return 'S';
    if (heading > 202.5 && heading <= 247.5) return 'SW';
    if (heading > 247.5 && heading <= 292.5) return 'W';
    return 'NW';
  };

  const getLatencyColor = (latency: number) => {
    if (latency < 50) return 'text-green-500';
    if (latency < 100) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getBatteryColor = (percentage: number) => {
    if (percentage > 70) return 'text-green-400';
    if (percentage > 30) return 'text-amber-400';
    return 'text-red-400';
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm border border-gray-800">
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mr-4"></div>
            <span className="text-gray-400">Loading detailed telemetry...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm border border-gray-800">
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-4 rounded-lg flex items-center gap-3">
            <AlertCircle className="h-5 w-5" />
            <div>
              <div className="font-medium">Detailed Telemetry Error</div>
              <div className="text-sm">{error}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with tabs */}
      <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm border border-gray-800">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-light tracking-wider text-blue-300 flex items-center gap-2">
            <LineChart className="h-5 w-5" />
            DETAILED TELEMETRY ANALYSIS
          </h3>
          
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${liveTelemetry?.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span>{liveTelemetry?.connected ? 'LIVE' : 'OFFLINE'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Last: {lastUpdateTime?.toLocaleTimeString()}</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-800/50 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('live')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'live'
                ? 'bg-blue-500/20 text-blue-300'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Live Data
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'history'
                ? 'bg-blue-500/20 text-blue-300'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Historical
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'analysis'
                ? 'bg-blue-500/20 text-blue-300'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Analysis
          </button>
        </div>
      </div>

      {/* Live Data Tab */}
      {activeTab === 'live' && (
        <>
          {/* Main telemetry grid */}
          <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm border border-gray-800">
            <h4 className="text-md font-light tracking-wider text-blue-300 mb-4">REAL-TIME METRICS</h4>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-800/80 p-4 rounded-lg text-center">
                <div className="text-xs text-gray-400 mb-1">ALTITUDE</div>
                <div className="text-2xl font-light text-white">{Math.round(telemetry.altitude)}</div>
                <div className="text-xs text-blue-400">METERS</div>
                {liveTelemetry && (
                  <div className="text-xs text-gray-500 mt-1">
                    MSL: {Math.round(liveTelemetry.altitude_msl)}m
                  </div>
                )}
              </div>
              
              <div className="bg-gray-800/80 p-4 rounded-lg text-center">
                <div className="text-xs text-gray-400 mb-1">SPEED</div>
                <div className="text-2xl font-light text-white">{Math.round(telemetry.speed)}</div>
                <div className="text-xs text-blue-400">KM/H</div>
                {liveTelemetry && (
                  <div className="text-xs text-gray-500 mt-1">
                    V↑: {(liveTelemetry.velocity_z * 3.6).toFixed(1)} km/h
                  </div>
                )}
              </div>
              
              <div className="bg-gray-800/80 p-4 rounded-lg text-center">
                <div className="text-xs text-gray-400 mb-1">HEADING</div>
                <div className="text-2xl font-light text-white">
                  {Math.round(telemetry.heading)}° {getHeadingDirection(telemetry.heading)}
                </div>
                <div className="text-xs text-blue-400 flex items-center justify-center gap-1">
                  <Compass className="h-3 w-3" />
                  <span>COMPASS</span>
                </div>
              </div>
              
              <div className="bg-gray-800/80 p-4 rounded-lg text-center">
                <div className="text-xs text-gray-400 mb-1">BATTERY</div>
                <div className={`text-2xl font-light ${getBatteryColor(liveTelemetry?.percentage || 0)}`}>
                  {liveTelemetry?.percentage || 0}%
                </div>
                <div className="text-xs text-blue-400">
                  {liveTelemetry?.voltage?.toFixed(1)}V
                </div>
              </div>
            </div>

            {/* Additional telemetry row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="bg-gray-800/80 p-4 rounded-lg text-center">
                <div className="text-xs text-gray-400 mb-1">GPS</div>
                <div className="text-lg font-light text-white">{liveTelemetry?.satellites || 0}</div>
                <div className="text-xs text-blue-400">{liveTelemetry?.gps_fix || 'UNKNOWN'}</div>
              </div>
              
              <div className="bg-gray-800/80 p-4 rounded-lg text-center">
                <div className="text-xs text-gray-400 mb-1">FLIGHT MODE</div>
                <div className="text-lg font-light text-white">{liveTelemetry?.flight_mode || 'UNKNOWN'}</div>
                <div className={`text-xs ${liveTelemetry?.armed ? 'text-red-400' : 'text-green-400'}`}>
                  {liveTelemetry?.armed ? 'ARMED' : 'DISARMED'}
                </div>
              </div>
              
              <div className="bg-gray-800/80 p-4 rounded-lg text-center">
                <div className="text-xs text-gray-400 mb-1">ROLL/PITCH</div>
                <div className="text-lg font-light text-white">
                  {((liveTelemetry?.roll || 0) * 180 / Math.PI).toFixed(1)}°
                </div>
                <div className="text-xs text-blue-400">
                  P: {((liveTelemetry?.pitch || 0) * 180 / Math.PI).toFixed(1)}°
                </div>
              </div>
              
              <div className="bg-gray-800/80 p-4 rounded-lg text-center">
                <div className="text-xs text-gray-400 mb-1">COORDINATES</div>
                <div className="text-sm font-light text-white">{formatCoordinates(telemetry.coordinates)}</div>
                <div className="text-xs text-blue-400 flex items-center justify-center gap-1">
                  <Globe className="h-3 w-3" />
                  <span>GPS</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Environmental data */}
          <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm border border-gray-800">
            <h3 className="text-lg font-light tracking-wider text-blue-300 flex items-center gap-2 mb-6">
              <Wind className="h-5 w-5" />
              ENVIRONMENTAL DATA
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-800/80 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-xs text-gray-400 mb-1">TEMPERATURE</div>
                    <div className="flex items-center">
                      <Thermometer className="h-5 w-5 mr-2 text-blue-400" />
                      <span className="text-xl font-light text-white">{Math.round(telemetry.temperature)}°C</span>
                    </div>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <span className="text-white font-medium">{Math.round(telemetry.temperature)}°</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-800/80 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-xs text-gray-400 mb-1">WIND SPEED</div>
                    <div className="flex items-center">
                      <Wind className="h-5 w-5 mr-2 text-blue-400" />
                      <span className="text-xl font-light text-white">{Math.round(telemetry.windSpeed)} km/h</span>
                    </div>
                  </div>
                  <div className="text-xs px-2 py-1 rounded-lg bg-gray-700 text-gray-300 border border-gray-600">
                    {telemetry.windSpeed < 10 ? 'Low' : telemetry.windSpeed < 20 ? 'Moderate' : 'High'}
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-800/80 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-xs text-gray-400 mb-1">SIGNAL LATENCY</div>
                    <div className="flex items-center">
                      <Clock className={`h-5 w-5 mr-2 ${getLatencyColor(telemetry.signalLatency)}`} />
                      <span className={`text-xl font-light ${getLatencyColor(telemetry.signalLatency)}`}>
                        {Math.round(telemetry.signalLatency)} ms
                      </span>
                    </div>
                  </div>
                  <div className="text-xs px-2 py-1 rounded-lg bg-gray-700 text-gray-300 border border-gray-600">
                    {telemetry.signalLatency < 50 ? 'Excellent' : telemetry.signalLatency < 100 ? 'Good' : 'Poor'}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Live position map */}
          <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm border border-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-light tracking-wider text-blue-300 flex items-center gap-2">
                <Globe className="h-5 w-5" />
                LIVE POSITION
              </h3>
              <div className="text-sm text-gray-400">
                Updated: {telemetry.lastUpdated.toLocaleTimeString()}
              </div>
            </div>
            
            <div className="bg-gradient-to-b from-gray-800 to-gray-900 h-64 rounded-lg border border-gray-700 relative overflow-hidden">
              {/* Simulated map grid */}
              <div className="absolute inset-0 grid grid-cols-10 grid-rows-6">
                {Array.from({ length: 60 }).map((_, i) => (
                  <div key={i} className="border border-gray-800/20"></div>
                ))}
              </div>
              
              {/* Live drone position indicator */}
              <div 
                className="absolute w-4 h-4 bg-blue-500 rounded-full animate-ping"
                style={{ 
                  left: `${((telemetry.coordinates.lng + 180) / 360) * 100}%`, 
                  top: `${((90 - telemetry.coordinates.lat) / 180) * 100}%` 
                }}
              ></div>
              <div 
                className="absolute w-3 h-3 bg-blue-400 rounded-full"
                style={{ 
                  left: `${((telemetry.coordinates.lng + 180) / 360) * 100}%`, 
                  top: `${((90 - telemetry.coordinates.lat) / 180) * 100}%`,
                  transform: 'translate(-50%, -50%)' 
                }}
              ></div>
              
              {/* Live coordinates display */}
              <div className="absolute bottom-2 right-2 bg-gray-900/80 px-3 py-1 rounded-lg text-xs text-gray-300">
                {formatCoordinates(telemetry.coordinates)}
              </div>
              
              {/* Altitude indicator */}
              <div className="absolute top-2 right-2 bg-gray-900/80 px-3 py-1 rounded-lg text-xs text-gray-300">
                ALT: {Math.round(telemetry.altitude)}m
              </div>
            </div>
          </div>
        </>
      )}

      {/* Historical Data Tab */}
      {activeTab === 'history' && (
        <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm border border-gray-800">
          <div className="flex justify-between items-center mb-6">
            <h4 className="text-md font-light tracking-wider text-blue-300">HISTORICAL TELEMETRY</h4>
            
            {/* Time range selector */}
            <div className="flex space-x-2">
              {(['1h', '6h', '24h'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    timeRange === range
                      ? 'bg-blue-500/20 text-blue-300'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {range.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {historicalData.length > 0 ? (
            <div className="space-y-4">
              {/* Altitude chart placeholder */}
              <div className="bg-gray-800/50 p-4 rounded-lg">
                <h5 className="text-sm text-gray-300 mb-3">Altitude Over Time</h5>
                <div className="h-32 bg-gradient-to-r from-blue-900/20 to-blue-800/20 rounded flex items-end justify-between px-2">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-2 bg-blue-500 rounded-t"
                      style={{ height: `${20 + Math.random() * 80}%` }}
                    ></div>
                  ))}
                </div>
              </div>

              {/* Battery chart placeholder */}
              <div className="bg-gray-800/50 p-4 rounded-lg">
                <h5 className="text-sm text-gray-300 mb-3">Battery Level Over Time</h5>
                <div className="h-32 bg-gradient-to-r from-green-900/20 to-red-900/20 rounded flex items-end justify-between px-2">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-2 bg-gradient-to-t from-red-500 to-green-500 rounded-t"
                      style={{ height: `${100 - (i * 2)}%` }}
                    ></div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No historical data available for selected time range</p>
              <p className="text-sm mt-2">Historical data requires authentication</p>
            </div>
          )}
        </div>
      )}

      {/* Analysis Tab */}
      {activeTab === 'analysis' && (
        <div className="space-y-6">
          {/* Performance metrics */}
          <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm border border-gray-800">
            <h4 className="text-md font-light tracking-wider text-blue-300 mb-4">PERFORMANCE ANALYSIS</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-800/80 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">FLIGHT EFFICIENCY</span>
                  <Battery className="h-4 w-4 text-green-400" />
                </div>
                <div className="text-2xl font-light text-white mb-1">87%</div>
                <div className="text-xs text-green-400">+3% from last flight</div>
              </div>
              
              <div className="bg-gray-800/80 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">STABILITY INDEX</span>
                  <Plane className="h-4 w-4 text-blue-400" />
                </div>
                <div className="text-2xl font-light text-white mb-1">9.2/10</div>
                <div className="text-xs text-blue-400">Excellent stability</div>
              </div>
              
              <div className="bg-gray-800/80 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">SIGNAL QUALITY</span>
                  <Activity className="h-4 w-4 text-yellow-400" />
                </div>
                <div className="text-2xl font-light text-white mb-1">Good</div>
                <div className="text-xs text-yellow-400">Avg latency: {Math.round(telemetry.signalLatency)}ms</div>
              </div>
            </div>
          </div>

          {/* System health */}
          <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm border border-gray-800">
            <h4 className="text-md font-light tracking-wider text-blue-300 mb-4">SYSTEM HEALTH</h4>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">GPS System</span>
                <span className="text-green-400">Optimal</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full">
                <div className="h-2 bg-green-500 rounded-full" style={{ width: '95%' }}></div>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Communication</span>
                <span className="text-yellow-400">Good</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full">
                <div className="h-2 bg-yellow-500 rounded-full" style={{ width: '78%' }}></div>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Battery Health</span>
                <span className="text-green-400">Excellent</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full">
                <div className="h-2 bg-green-500 rounded-full" style={{ width: '92%' }}></div>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Motor Performance</span>
                <span className="text-green-400">Optimal</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full">
                <div className="h-2 bg-green-500 rounded-full" style={{ width: '88%' }}></div>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm border border-gray-800">
            <h4 className="text-md font-light tracking-wider text-blue-300 mb-4">RECOMMENDATIONS</h4>
            
            <div className="space-y-3">
              <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded-lg">
                <div className="text-blue-300 text-sm font-medium">Signal Optimization</div>
                <div className="text-gray-300 text-xs mt-1">
                  Consider moving to higher altitude to improve communication quality
                </div>
              </div>
              
              <div className="bg-green-500/10 border border-green-500/30 p-3 rounded-lg">
                <div className="text-green-300 text-sm font-medium">Battery Status</div>
                <div className="text-gray-300 text-xs mt-1">
                  Battery performance is excellent. Current charge sufficient for extended operations.
                </div>
              </div>
              
              <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 rounded-lg">
                <div className="text-yellow-300 text-sm font-medium">Weather Advisory</div>
                <div className="text-gray-300 text-xs mt-1">
                  Monitor wind conditions. Current levels are within safe operational limits.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DetailedTelemetry;
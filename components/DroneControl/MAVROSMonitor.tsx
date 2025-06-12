// components/DroneControl/MAVROSMonitor.tsx - SIMPLIFIED INTEGRATION
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Pause, Play, XCircle, Download, Activity, AlertTriangle, Info, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { getMAVROSLogs, getMAVROSBuffer, MAVROSMessage } from '../../lib/api/droneApi';
import { 
  formatTimestamp, 
  getMessageTypeColor, 
  getFilterStyle, 
  formatMessage,
  exportMAVROSLogs 
} from '../../lib/utils/browser';

interface MAVROSMonitorProps {
  droneId: string;
  className?: string;
}

const MAVROSMonitor: React.FC<MAVROSMonitorProps> = ({ droneId, className = '' }) => {
  const { token } = useAuth();
  
  // State management
  const [messages, setMessages] = useState<MAVROSMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [activeFilters, setActiveFilters] = useState({
    INFO: true,
    WARN: true,
    ERROR: true,
    OTHER: true
  });
  
  const outputRef = useRef<HTMLDivElement>(null);

  // Load initial MAVROS data
  useEffect(() => {
    const loadMAVROSData = async () => {
      if (!token || !droneId) return;

      try {
        setIsLoading(true);
        setError(null);
        
        // Try to get recent buffer first (faster)
        try {
          const bufferData = await getMAVROSBuffer(droneId, 100);
          if (bufferData && bufferData.length > 0) {
            setMessages(bufferData);
            setIsLoading(false);
            return;
          }
        } catch (bufferError) {
          console.warn('Buffer not available, trying historical logs');
        }
        
        // Fallback to historical logs
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
        
        const response = await getMAVROSLogs(droneId, {
          startTime,
          endTime,
          limit: 500
        });
        
        if (response.success && response.logs) {
          setMessages(response.logs);
        } else {
          setMessages([]);
        }
        
      } catch (err: any) {
        console.error('Error loading MAVROS data:', err);
        setError(err.message || 'Failed to load MAVROS data');
        setMessages([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadMAVROSData();
  }, [droneId, token]);

  // Setup WebSocket for real-time updates (simplified)
  useEffect(() => {
    if (!token || !droneId || isPaused) return;

    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connectWebSocket = () => {
      try {
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4002';
        ws = new WebSocket(`${wsUrl}?token=${token}`);
        
        ws.onopen = () => {
          console.log('MAVROS WebSocket connected');
          setError(null);
          
          // Subscribe to MAVROS output
          if (ws) {
            ws.send(JSON.stringify({
              type: 'subscribe_mavros_output',
              droneId: droneId
            }));
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'mavros_output' && data.droneId === droneId && data.message) {
              setMessages(prev => {
                const newMessages = [data.message, ...prev];
                return newMessages.slice(0, 1000); // Keep last 1000
              });
            }
          } catch (parseError) {
            console.error('Error parsing WebSocket message:', parseError);
          }
        };

        ws.onerror = () => {
          setError('WebSocket connection failed');
        };

        ws.onclose = () => {
          // Auto-reconnect after 3 seconds
          reconnectTimeout = setTimeout(() => {
            if (!isPaused) {
              connectWebSocket();
            }
          }, 3000);
        };

      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
        setError('Connection failed');
      }
    };

    connectWebSocket();

    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (ws) {
        ws.close();
      }
    };
  }, [droneId, token, isPaused]);

  // Filter messages
  const filteredMessages = useMemo(() => {
    return messages.filter(message => {
      const matchesSearch = searchTerm === '' || 
        message.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        message.rawMessage.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch && activeFilters[message.messageType];
    });
  }, [messages, searchTerm, activeFilters]);

  // Calculate message counts
  const messageCounts = useMemo(() => {
    return messages.reduce((acc, message) => {
      acc.total++;
      switch (message.messageType) {
        case 'ERROR': acc.errors++; break;
        case 'WARN': acc.warnings++; break;
        case 'INFO': acc.info++; break;
        case 'OTHER': acc.other++; break;
      }
      return acc;
    }, { total: 0, errors: 0, warnings: 0, info: 0, other: 0 });
  }, [messages]);

  // Handlers
  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
      
      const response = await getMAVROSLogs(droneId, {
        startTime,
        endTime,
        limit: 500
      });
      
      if (response.success && response.logs) {
        setMessages(response.logs);
      }
    } catch (err: any) {
      setError('Failed to refresh');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    exportMAVROSLogs(filteredMessages, droneId);
  };

  const handleClear = () => {
    setMessages([]);
  };

  // Show loading state
  if (isLoading && messages.length === 0) {
    return (
      <div className={`w-full bg-slate-900/50 text-white rounded-lg shadow-lg border border-gray-800 backdrop-blur-sm ${className}`}>
        <div className="p-6 flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mr-4"></div>
          <span className="text-gray-400">Loading MAVROS data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full bg-slate-900/50 text-white rounded-lg shadow-lg border border-gray-800 backdrop-blur-sm ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${!isPaused ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <h2 className="text-xl tracking-wider font-light">MAVROS MONITOR</h2>
            <span className="text-xs text-gray-500">Drone: {droneId}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className={`text-xs px-3 py-1 rounded-md border tracking-wider ${
              !isPaused ? 'bg-green-500/20 text-green-300 border-green-500/30' :
              'bg-red-500/20 text-red-300 border-red-500/30'
            }`}>
              {!isPaused ? 'LIVE MAVROS' : 'PAUSED'}
            </span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="px-6 pt-6 flex items-center gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search MAVROS messages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-gray-800 rounded-lg pl-10 pr-4 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {Object.entries(activeFilters).map(([type, isActive]) => (
            <button
              key={type}
              onClick={() => setActiveFilters(prev => ({ ...prev, [type]: !prev[type] }))}
              className={`px-3 py-1 rounded text-xs font-medium tracking-wider transition-all border ${
                getFilterStyle(type, isActive)
              }`}
            >
              {type === 'OTHER' ? 'SYSTEM' : type}
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`p-2 rounded-lg transition-all ${
              isPaused
                ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30 border border-green-500/30'
                : 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/30'
            }`}
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>
          
          <button
            onClick={handleRefresh}
            className="p-2 rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border border-blue-500/30 transition-all"
            title="Refresh"
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          
          <button
            onClick={handleExport}
            className="p-2 rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border border-blue-500/30 transition-all"
            title="Export logs"
          >
            <Download className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleClear}
            className="p-2 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30 transition-all"
            title="Clear"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Messages Display */}
      <div className="p-6">
        <div
          ref={outputRef}
          className="bg-slate-950 rounded-lg p-6 h-96 w-full overflow-x-auto overflow-y-auto font-mono text-sm border border-gray-800 relative"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#4B5563 #1F2937'
          }}
        >
          <style jsx>{`
            div::-webkit-scrollbar {
              width: 8px;
              height: 8px;
            }
            div::-webkit-scrollbar-track {
              background: #0F172A;
              border-radius: 4px;
            }
            div::-webkit-scrollbar-thumb {
              background: #1E293B;
              border-radius: 4px;
              border: 1px solid #334155;
            }
            div::-webkit-scrollbar-thumb:hover {
              background: #334155;
            }
          `}</style>
          
          {filteredMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Activity className="h-12 w-12 text-gray-500 mx-auto mb-4 opacity-50" />
                <p className="text-gray-500 tracking-wider font-light">
                  {messages.length === 0 ? 'AWAITING MAVROS DATA...' : 'NO MATCHING MESSAGES'}
                </p>
                <p className="text-gray-600 text-xs mt-2">
                  {isPaused ? 'Monitoring paused' : 'Check drone connection'}
                </p>
              </div>
            </div>
          ) : (
            filteredMessages.map((message, index) => (
              <div 
                key={message.id || index} 
                className={`min-w-max font-light tracking-wide py-1 hover:bg-slate-900/50 transition-colors border-l-2 border-transparent hover:border-blue-500/30 pl-3 ${getMessageTypeColor(message.messageType)}`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-gray-500 text-xs mt-0.5 w-16 flex-shrink-0">
                    {formatTimestamp(message.timestamp)}
                  </span>
                  <div className="flex items-center gap-1 mt-0.5">
                    {message.messageType === 'ERROR' && <AlertCircle className="h-3 w-3" />}
                    {message.messageType === 'WARN' && <AlertTriangle className="h-3 w-3" />}
                    {message.messageType === 'INFO' && <Info className="h-3 w-3" />}
                    {message.messageType === 'OTHER' && <Activity className="h-3 w-3" />}
                  </div>
                  <span 
                    className="flex-1"
                    dangerouslySetInnerHTML={{ 
                      __html: formatMessage(message.message) 
                    }}
                  />
                  {message.severityLevel >= 2 && (
                    <span className="text-red-400 text-xs mt-0.5">⚠</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 pb-4 flex justify-between items-center text-xs text-gray-400 tracking-wider border-t border-gray-800 pt-4">
        <div className="flex items-center gap-4">
          <p>MAVROS Monitor • {filteredMessages.length} / {messages.length} messages</p>
          <div className="flex items-center gap-2">
            <span className="text-green-400">●</span>
            <span>Total: {messageCounts.total}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-red-400">●</span>
            <span>Errors: {messageCounts.errors}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-yellow-400">●</span>
            <span>Warnings: {messageCounts.warnings}</span>
          </div>
        </div>
        <p>Buffer: 1000 lines</p>
      </div>
    </div>
  );
};

export default MAVROSMonitor;
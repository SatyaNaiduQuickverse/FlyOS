import { useState, useEffect } from 'react';
import { getHistoricalTelemetry } from '../api/droneApi';

// Types of time ranges
type TimeRange = '5min' | '15min' | '30min' | '1hour' | '1day';

// Hook for historical telemetry data
export const useHistoricalTelemetry = (
  droneId: string,
  timeRange: TimeRange = '15min',
  refreshInterval: number = 30000 // 30 seconds
) => {
  const [telemetry, setTelemetry] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Calculate start time based on time range
  const getStartTime = (range: TimeRange): Date => {
    const now = new Date();
    
    switch (range) {
      case '5min':
        return new Date(now.getTime() - 5 * 60 * 1000);
      case '15min':
        return new Date(now.getTime() - 15 * 60 * 1000);
      case '30min':
        return new Date(now.getTime() - 30 * 60 * 1000);
      case '1hour':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case '1day':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 15 * 60 * 1000);
    }
  };

  // Function to fetch telemetry data
  const fetchTelemetry = async () => {
    if (!droneId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const startTime = getStartTime(timeRange);
      const endTime = new Date();
      
      // For long time ranges, use hourly aggregated data
      const interval = timeRange === '1day' ? 'hourly' : undefined;
      
      const response = await getHistoricalTelemetry(droneId, startTime, endTime, interval);
      
      if (response.success) {
        setTelemetry(response.data);
        setLastUpdated(new Date());
      } else {
        setError(response.message || 'Failed to fetch telemetry data');
      }
    } catch (error) {
      console.error('Error fetching telemetry:', error);
      setError('Failed to fetch telemetry data');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch data on mount and when dependencies change
  useEffect(() => {
    fetchTelemetry();
    
    // Set up interval for periodic refresh
    const intervalId = setInterval(fetchTelemetry, refreshInterval);
    
    // Clean up on unmount
    return () => clearInterval(intervalId);
  }, [droneId, timeRange, refreshInterval]);

  return {
    telemetry,
    isLoading,
    error,
    lastUpdated,
    refresh: fetchTelemetry,
  };
};

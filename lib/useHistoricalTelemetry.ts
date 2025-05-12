// lib/useHistoricalTelemetry.ts
import { useState, useEffect, useCallback } from 'react';
import { getHistoricalTelemetry } from './api/droneApi';

// Define proper type instead of using 'any'
interface TelemetryDataPoint {
  timestamp: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  batteryLevel?: number;
  [key: string]: unknown; // For other properties
}

export const useHistoricalTelemetry = (droneId: string, initialTimeRange = 30) => {
  const [telemetry, setTelemetry] = useState<TelemetryDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch telemetry data
  const fetchTelemetry = useCallback(async (
    startTime: Date,
    endTime: Date,
    interval?: string
  ) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await getHistoricalTelemetry(
        droneId,
        startTime,
        endTime,
        interval
      );
      
      if (response.success && response.data) {
        setTelemetry(response.data);
      } else {
        setError(response.message || 'Failed to fetch telemetry data');
        setTelemetry([]);
      }
    } catch (err) {
      console.error('Error fetching historical telemetry:', err);
      setError('An error occurred while fetching telemetry data');
      setTelemetry([]);
    } finally {
      setIsLoading(false);
    }
  }, [droneId]);

  // Fetch initial data on mount
  useEffect(() => {
    const now = new Date();
    const startTime = new Date(now.getTime() - initialTimeRange * 60 * 1000);
    
    fetchTelemetry(startTime, now);
  }, [droneId, initialTimeRange, fetchTelemetry]);

  return {
    telemetry,
    isLoading,
    error,
    fetchTelemetry,
  };
};

export default useHistoricalTelemetry;

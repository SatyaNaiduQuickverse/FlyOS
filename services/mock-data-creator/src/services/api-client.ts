import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { logger } from '../utils/logger';

// Custom interface for request config with metadata
interface RequestConfigWithMetadata extends InternalAxiosRequestConfig {
  metadata?: {
    startTime: number;
  };
}

// Configure API client
const createApiClient = (baseUrl: string, jwtToken: string, testRunId: number, recordMetricFn?: Function) => {
  // Create axios instance with default config
  const apiClient = axios.create({
    baseURL: baseUrl,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwtToken}`
    },
    timeout: 10000, // 10 seconds
  });
  
  // Add request interceptor for timing
  apiClient.interceptors.request.use((config: RequestConfigWithMetadata) => {
    // Add start time to request
    config.metadata = { startTime: Date.now() };
    return config;
  }, (error) => {
    return Promise.reject(error);
  });
  
  // Add response interceptor for timing and metrics
  apiClient.interceptors.response.use((response) => {
    // Calculate request duration
    const endTime = Date.now();
    const config = response.config as RequestConfigWithMetadata;
    const startTime = config.metadata?.startTime;
    const duration = startTime ? endTime - startTime : 0;
    
    // Extract operation details
    const url = response.config.url || '';
    const method = response.config.method?.toUpperCase() || '';
    const operation = `${method} ${url}`;
    
    // Get drone ID from URL if present
    const droneIdMatch = url.match(/\/drones\/([^\/]+)/);
    const droneId = droneIdMatch ? droneIdMatch[1] : undefined;
    
    // Record metric if function provided
    if (recordMetricFn) {
      recordMetricFn(
        'http',
        operation,
        duration,
        true,
        droneId,
        { 
          status: response.status,
          statusText: response.statusText
        }
      );
    }
    
    return response;
  }, (error: AxiosError) => {
    // Handle errors and still record metrics
    const endTime = Date.now();
    const config = error.config as RequestConfigWithMetadata | undefined;
    const startTime = config?.metadata?.startTime;
    const duration = startTime ? endTime - startTime : 0;
    
    // Extract operation details
    const url = config?.url || '';
    const method = config?.method?.toUpperCase() || '';
    const operation = `${method} ${url}`;
    
    // Get drone ID from URL if present
    const droneIdMatch = url.match(/\/drones\/([^\/]+)/);
    const droneId = droneIdMatch ? droneIdMatch[1] : undefined;
    
    // Record metric if function provided
    if (recordMetricFn) {
      recordMetricFn(
        'http',
        operation,
        duration,
        false,
        droneId,
        { 
          status: error.response?.status || 0,
          statusText: error.response?.statusText || error.message
        }
      );
    }
    
    return Promise.reject(error);
  });
  
  // Methods for interacting with the drone-db-service
  return {
    // Get current drone state
    getDroneState: async (droneId: string) => {
      try {
        const response = await apiClient.get(`/api/drones/${droneId}/state`);
        return response.data;
      } catch (error) {
        logger.error(`Failed to get drone state for ${droneId}:`, error);
        throw error;
      }
    },
    
    // Store telemetry data
    storeTelemetry: async (droneId: string, telemetry: any) => {
      try {
        const response = await apiClient.post(`/api/drones/${droneId}/telemetry`, telemetry);
        return response.data;
      } catch (error) {
        logger.error(`Failed to store telemetry for ${droneId}:`, error);
        throw error;
      }
    },
    
    // Get historical telemetry
    getHistoricalTelemetry: async (droneId: string, startTime: Date, endTime: Date, interval?: string) => {
      try {
        const params: any = {
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        };
        
        if (interval) {
          params.interval = interval;
        }
        
        const response = await apiClient.get(`/api/drones/${droneId}/telemetry`, { params });
        return response.data;
      } catch (error) {
        logger.error(`Failed to get historical telemetry for ${droneId}:`, error);
        throw error;
      }
    },
    
    // Send command to drone
    sendCommand: async (droneId: string, commandType: string, parameters: any = {}) => {
      try {
        const response = await apiClient.post(`/api/drones/${droneId}/command`, {
          commandType,
          parameters
        });
        return response.data;
      } catch (error) {
        logger.error(`Failed to send command to ${droneId}:`, error);
        throw error;
      }
    },
    
    // Get command history
    getCommandHistory: async (droneId: string, limit: number = 20) => {
      try {
        const response = await apiClient.get(`/api/drones/${droneId}/commands`, {
          params: { limit }
        });
        return response.data;
      } catch (error) {
        logger.error(`Failed to get command history for ${droneId}:`, error);
        throw error;
      }
    }
  };
};

export { createApiClient };
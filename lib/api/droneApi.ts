// lib/api/droneApi.ts - EXTENDED WITH MAVROS API FUNCTIONS
import axios from 'axios';
import { getLocalStorageItem } from '../utils/browser';

// Define types to replace 'any'
interface CommandParameters {
  [key: string]: string | number | boolean | object;
}

// NEW: MAVROS-specific interfaces
interface MAVROSMessage {
  id?: number;
  droneId: string;
  timestamp: string;
  message: string;
  messageType: 'INFO' | 'WARN' | 'ERROR' | 'OTHER';
  rawMessage: string;
  source: string;
  severityLevel: number;
  parsedData?: any;
  sessionId: string;
}

interface MAVROSLogsResponse {
  success: boolean;
  logs: MAVROSMessage[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

interface MAVROSStatus {
  droneId: string;
  sessionId?: string;
  status: string;
  connectionStatus: 'CONNECTED' | 'STALE' | 'DISCONNECTED';
  messageCount: number;
  errorCount: number;
  lastMessageAt?: string;
}

// Create API client
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add authentication interceptor
apiClient.interceptors.request.use(
  (config) => {
    // CHANGED FROM 'token' to 'flyos_token' to match the rest of the application
    const token = getLocalStorageItem('flyos_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// EXISTING DRONE API FUNCTIONS
// ============================

// Get current drone state
export const getDroneState = async (droneId: string) => {
  try {
    const response = await apiClient.get(`/drones/${droneId}/state`);
    return response.data;
  } catch (error) {
    console.error(`Error getting drone state:`, error);
    throw error;
  }
};

// Get historical telemetry data
export const getHistoricalTelemetry = async (
  droneId: string,
  startTime: Date,
  endTime: Date,
  interval?: string
) => {
  try {
    const response = await apiClient.get(`/drones/${droneId}/telemetry`, {
      params: {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        interval,
      },
    });
    return response.data;
  } catch (error) {
    console.error(`Error getting historical telemetry:`, error);
    throw error;
  }
};

// Send command to drone
export const sendDroneCommand = async (
  droneId: string,
  commandType: string,
  parameters: CommandParameters = {}
) => {
  try {
    const response = await apiClient.post(`/drones/${droneId}/command`, {
      commandType,
      parameters,
    });
    return response.data;
  } catch (error) {
    console.error(`Error sending drone command:`, error);
    throw error;
  }
};

// Get command history
export const getCommandHistory = async (
  droneId: string,
  limit: number = 20
) => {
  try {
    const response = await apiClient.get(`/drones/${droneId}/commands`, {
      params: { limit },
    });
    return response.data;
  } catch (error) {
    console.error(`Error getting command history:`, error);
    throw error;
  }
};

// NEW: MAVROS API FUNCTIONS
// =========================

/**
 * Get MAVROS logs with filtering and pagination
 */
export const getMAVROSLogs = async (
  droneId: string,
  options: {
    startTime?: Date;
    endTime?: Date;
    messageType?: string;
    severityLevel?: number;
    sessionId?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<MAVROSLogsResponse> => {
  try {
    const params: any = {};
    
    if (options.startTime) params.startTime = options.startTime.toISOString();
    if (options.endTime) params.endTime = options.endTime.toISOString();
    if (options.messageType) params.messageType = options.messageType;
    if (options.severityLevel !== undefined) params.severityLevel = options.severityLevel;
    if (options.sessionId) params.sessionId = options.sessionId;
    if (options.search) params.search = options.search;
    if (options.limit) params.limit = options.limit;
    if (options.offset) params.offset = options.offset;
    
    const response = await apiClient.get(`/drones/${droneId}/mavros/logs`, { params });
    return response.data;
  } catch (error) {
    console.error(`Error getting MAVROS logs:`, error);
    throw error;
  }
};

/**
 * Get current MAVROS status for a drone
 */
export const getMAVROSStatus = async (droneId: string): Promise<MAVROSStatus> => {
  try {
    const response = await apiClient.get(`/drones/${droneId}/mavros/status`);
    return response.data;
  } catch (error) {
    console.error(`Error getting MAVROS status:`, error);
    throw error;
  }
};

/**
 * Get MAVROS statistics for a time period
 */
export const getMAVROSStatistics = async (
  droneId: string,
  startTime: Date,
  endTime: Date
) => {
  try {
    const response = await apiClient.get(`/drones/${droneId}/mavros/statistics`, {
      params: {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString()
      }
    });
    return response.data;
  } catch (error) {
    console.error(`Error getting MAVROS statistics:`, error);
    throw error;
  }
};

/**
 * Search MAVROS logs with full-text search
 */
export const searchMAVROSLogs = async (
  droneId: string,
  searchTerm: string,
  limit: number = 50
): Promise<MAVROSMessage[]> => {
  try {
    const response = await apiClient.get(`/drones/${droneId}/mavros/search`, {
      params: { q: searchTerm, limit }
    });
    return response.data.logs || [];
  } catch (error) {
    console.error(`Error searching MAVROS logs:`, error);
    throw error;
  }
};

/**
 * Get real-time MAVROS buffer from Redis
 */
export const getMAVROSBuffer = async (
  droneId: string,
  count: number = 100
): Promise<MAVROSMessage[]> => {
  try {
    const response = await apiClient.get(`/drones/${droneId}/mavros/buffer`, {
      params: { count }
    });
    return response.data.messages || [];
  } catch (error) {
    console.error(`Error getting MAVROS buffer:`, error);
    throw error;
  }
};

/**
 * Get specific MAVROS session information
 */
export const getMAVROSSession = async (
  droneId: string,
  sessionId: string
) => {
  try {
    const response = await apiClient.get(`/drones/${droneId}/mavros/session/${sessionId}`);
    return response.data;
  } catch (error) {
    console.error(`Error getting MAVROS session:`, error);
    throw error;
  }
};

// Export types for use in components
export type { MAVROSMessage, MAVROSLogsResponse, MAVROSStatus };
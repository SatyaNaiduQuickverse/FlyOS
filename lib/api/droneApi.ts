import axios from 'axios';

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
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Get current drone state
export const getDroneState = async (droneId: string) => {
  try {
    const response = await apiClient.get(`/drones/${droneId}/state`);
    return response.data;
  } catch (error) {
    console.error(`Error getting drone state: ${error}`);
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
    console.error(`Error getting historical telemetry: ${error}`);
    throw error;
  }
};

// Send command to drone
export const sendDroneCommand = async (
  droneId: string,
  commandType: string,
  parameters: any = {}
) => {
  try {
    const response = await apiClient.post(`/drones/${droneId}/command`, {
      commandType,
      parameters,
    });
    return response.data;
  } catch (error) {
    console.error(`Error sending drone command: ${error}`);
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
    console.error(`Error getting command history: ${error}`);
    throw error;
  }
};

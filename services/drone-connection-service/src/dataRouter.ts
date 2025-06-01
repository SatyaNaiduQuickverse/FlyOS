// services/drone-connection-service/src/dataRouter.ts
import { storeDroneState } from './redis';
import { logger } from './utils/logger';
import axios from 'axios';

// Route telemetry data to Redis and TimescaleDB
export const routeTelemetryData = async (droneId: string, telemetryData: any) => {
  try {
    // Store in Redis for real-time access
    await storeDroneState(droneId, {
      ...telemetryData,
      connected: true,
      lastUpdate: new Date().toISOString()
    });
    
    // Store in TimescaleDB via drone-db-service
    await storeTelemetryInDB(droneId, telemetryData);
    
    logger.debug(`📊 Telemetry routed for ${droneId}`);
    
  } catch (error) {
    logger.error(`❌ Failed to route telemetry for ${droneId}:`, error);
  }
};

// Route command data for audit trail
export const routeCommandData = async (droneId: string, commandData: any) => {
  try {
    // Store command in TimescaleDB for audit
    await storeCommandInDB(droneId, commandData);
    
    logger.debug(`📡 Command logged for ${droneId}`);
    
  } catch (error) {
    logger.error(`❌ Failed to route command for ${droneId}:`, error);
  }
};

// Store telemetry in TimescaleDB
const storeTelemetryInDB = async (droneId: string, data: any) => {
  try {
    const droneDbUrl = process.env.DRONE_DB_SERVICE_URL || 'http://drone-db-service:4001';
    
    await axios.post(`${droneDbUrl}/api/drones/${droneId}/telemetry`, data, {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
        'X-Service': 'drone-connection-service',
        'Authorization': 'Bearer service-internal-token'
      }
    });
    
  } catch (error: any) {
    logger.warn(`⚠️ TimescaleDB storage failed for ${droneId}:`, error.message);
  }
};

// Store command in TimescaleDB
const storeCommandInDB = async (droneId: string, data: any) => {
  try {
    const droneDbUrl = process.env.DRONE_DB_SERVICE_URL || 'http://drone-db-service:4001';
    
    await axios.post(`${droneDbUrl}/api/drones/${droneId}/command`, data, {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
        'X-Service': 'drone-connection-service'
      }
    });
    
  } catch (error: any) {
    logger.warn(`⚠️ Command logging failed for ${droneId}:`, error.message);
  }
};
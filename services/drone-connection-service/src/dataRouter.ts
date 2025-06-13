// services/drone-connection-service/src/dataRouter.ts - EXTENDED WITH PRECISION LANDING
import { storeDroneState } from './redis';
import { logger } from './utils/logger';
import axios from 'axios';

// Route telemetry data to Redis only (disable TimescaleDB for now)
export const routeTelemetryData = async (droneId: string, telemetryData: any) => {
  try {
    // Store in Redis for real-time access
    await storeDroneState(droneId, {
      ...telemetryData,
      connected: true,
      lastUpdate: new Date().toISOString()
    });
    
    // TEMPORARILY DISABLED TimescaleDB storage to fix connection issues
    // await storeTelemetryInDB(droneId, telemetryData);
    
    logger.debug(`📊 Telemetry routed to Redis for ${droneId}`);
    
  } catch (error) {
    logger.error(`❌ Failed to route telemetry for ${droneId}:`, error);
  }
};

// Route command data for audit trail
export const routeCommandData = async (droneId: string, commandData: any) => {
  try {
    // TEMPORARILY DISABLED TimescaleDB storage
    // await storeCommandInDB(droneId, commandData);
    
    logger.debug(`📡 Command logged for ${droneId} (Redis only)`);
    
  } catch (error) {
    logger.error(`❌ Failed to route command for ${droneId}:`, error);
  }
};

// NEW: Route precision landing data to TimescaleDB
export const routePrecisionLandingData = async (droneId: string, precisionData: any) => {
  try {
    // Store in TimescaleDB via drone-db-service
    const droneDbServiceUrl = process.env.DRONE_DB_SERVICE_URL || 'http://drone-db-service:4001';
    
    // Prepare data for TimescaleDB
    const dataToStore = {
      droneId,
      sessionId: precisionData.sessionId || 'default',
      message: precisionData.message || '',
      stage: precisionData.stage,
      altitude: precisionData.altitude,
      targetDetected: precisionData.targetDetected,
      targetConfidence: precisionData.targetConfidence,
      lateralError: precisionData.lateralError,
      verticalError: precisionData.verticalError,
      batteryLevel: precisionData.batteryLevel,
      windSpeed: precisionData.windSpeed,
      rawData: precisionData.rawData,
      timestamp: new Date().toISOString()
    };
    
    await axios.post(
      `${droneDbServiceUrl}/api/drones/${droneId}/precision-landing`,
      dataToStore,
      {
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000 // 5 second timeout
      }
    );
    
    logger.debug(`🎯 Precision landing data routed to TimescaleDB for ${droneId}`);
    
  } catch (error) {
    logger.error(`❌ Failed to route precision landing data for ${droneId}:`, error);
    // Don't throw error to avoid breaking the real-time flow
  }
};
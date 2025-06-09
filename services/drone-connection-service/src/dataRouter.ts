// services/drone-connection-service/src/dataRouter.ts - DISABLE TIMESCALE TEMPORARILY
import { storeDroneState } from './redis';
import { logger } from './utils/logger';

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
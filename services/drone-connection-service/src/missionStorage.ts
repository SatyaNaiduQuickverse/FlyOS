// services/drone-connection-service/src/missionStorage.ts
import { redisClient } from './redis';
import { logger } from './utils/logger';

interface StoredMissionData {
  missionId: string;
  droneId: string;
  waypoints: any[];
  fileName: string;
  totalWaypoints: number;
  uploadedBy: string;
  uploadedAt: string;
  commandId: any;
  status: 'uploaded' | 'started' | 'completed' | 'cancelled' | 'failed';
  startedAt?: string;
  completedAt?: string;
  failureReason?: string;
}

// Store mission data in Redis with expiry (for safety and audit)
export const storeMissionData = async (missionId: string, missionData: StoredMissionData): Promise<boolean> => {
  try {
    const key = `mission:${missionId}`;
    const value = JSON.stringify({
      ...missionData,
      storedAt: new Date().toISOString()
    });
    
    // Store with 7 day expiry (604800 seconds)
    await redisClient.setex(key, 604800, value);
    
    // Also store in mission index for drone
    await redisClient.lpush(`missions:${missionData.droneId}`, missionId);
    await redisClient.expire(`missions:${missionData.droneId}`, 604800);
    
    logger.info(`📦 Stored mission data: ${missionId} for drone ${missionData.droneId}`);
    return true;
  } catch (error) {
    logger.error(`❌ Failed to store mission ${missionId}:`, error);
    return false;
  }
};

// Get mission data from Redis
export const getMissionData = async (missionId: string): Promise<StoredMissionData | null> => {
  try {
    const data = await redisClient.get(`mission:${missionId}`);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error(`❌ Failed to get mission ${missionId}:`, error);
    return null;
  }
};

// Update mission status
export const updateMissionStatus = async (
  missionId: string, 
  status: StoredMissionData['status'], 
  additionalData?: { [key: string]: any }
): Promise<boolean> => {
  try {
    const existingData = await getMissionData(missionId);
    if (!existingData) {
      logger.warn(`Mission ${missionId} not found for status update`);
      return false;
    }
    
    const updatedData = {
      ...existingData,
      status,
      lastUpdated: new Date().toISOString(),
      ...additionalData
    };
    
    const key = `mission:${missionId}`;
    const value = JSON.stringify(updatedData);
    
    await redisClient.setex(key, 604800, value);
    
    logger.info(`📊 Updated mission ${missionId} status to: ${status}`);
    return true;
  } catch (error) {
    logger.error(`❌ Failed to update mission ${missionId} status:`, error);
    return false;
  }
};

// Get all missions for a drone
export const getDroneMissions = async (droneId: string, limit: number = 10): Promise<StoredMissionData[]> => {
  try {
    const missionIds = await redisClient.lrange(`missions:${droneId}`, 0, limit - 1);
    const missions: StoredMissionData[] = [];
    
    for (const missionId of missionIds) {
      const missionData = await getMissionData(missionId);
      if (missionData) {
        missions.push(missionData);
      }
    }
    
    return missions.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  } catch (error) {
    logger.error(`❌ Failed to get missions for drone ${droneId}:`, error);
    return [];
  }
};

// Clean up old missions (called periodically)
export const cleanupOldMissions = async (): Promise<void> => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7); // 7 days ago
    
    // This is a simplified cleanup - in production you might want more sophisticated cleanup
    logger.info(`🧹 Mission cleanup completed (Redis TTL handles automatic expiry)`);
  } catch (error) {
    logger.error('❌ Error during mission cleanup:', error);
  }
};
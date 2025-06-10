// services/drone-db-service/src/services/missionService.ts - FIXED TYPESCRIPT ERROR
import { pool } from '../database';
import { logger } from '../utils/logger';

export interface MissionData {
  missionId: string;
  droneId: string;
  userId: string;
  fileName: string;
  waypoints: Waypoint[];
  totalWaypoints: number;
  status: 'uploaded' | 'started' | 'completed' | 'cancelled' | 'failed';
  commandId?: string;
}

export interface Waypoint {
  seq: number;
  frame: number;
  command: number;
  param1: number;
  param2: number;
  param3: number;
  param4: number;
  lat: number;
  lng: number;
  alt: number;
}

// Store mission metadata and waypoints in TimescaleDB
export const storeMissionInDB = async (missionData: MissionData) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Insert mission metadata
    const missionQuery = `
      INSERT INTO drone_missions (
        mission_id, drone_id, user_id, file_name, total_waypoints, 
        status, command_id, uploaded_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id;
    `;
    
    const missionResult = await client.query(missionQuery, [
      missionData.missionId,
      missionData.droneId,
      missionData.userId,
      missionData.fileName,
      missionData.totalWaypoints,
      missionData.status,
      missionData.commandId
    ]);
    
    // Insert waypoints
    for (const waypoint of missionData.waypoints) {
      const waypointQuery = `
        INSERT INTO mission_waypoints (
          mission_id, sequence_number, frame, command, param1, param2, 
          param3, param4, latitude, longitude, altitude, autocontinue
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);
      `;
      
      await client.query(waypointQuery, [
        missionData.missionId,
        waypoint.seq,
        waypoint.frame,
        waypoint.command,
        waypoint.param1,
        waypoint.param2,
        waypoint.param3,
        waypoint.param4,
        waypoint.lat,
        waypoint.lng,
        waypoint.alt,
        true
      ]);
    }
    
    await client.query('COMMIT');
    
    logger.info(`📦 Mission stored in DB: ${missionData.missionId} (${missionData.waypoints.length} waypoints)`);
    return { success: true, id: missionResult.rows[0].id };
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`❌ Failed to store mission ${missionData.missionId}:`, error);
    throw error;
  } finally {
    client.release();
  }
};

// Update mission status - FIXED: Handle null rowCount
export const updateMissionStatusInDB = async (
  missionId: string, 
  status: string, 
  additionalFields?: { [key: string]: any }
) => {
  try {
    let updateQuery = 'UPDATE drone_missions SET status = $1, updated_at = NOW()';
    const values = [status];
    let paramCount = 1;
    
    if (additionalFields?.startedAt) {
      updateQuery += `, started_at = $${++paramCount}`;
      values.push(additionalFields.startedAt);
    }
    
    if (additionalFields?.completedAt) {
      updateQuery += `, completed_at = $${++paramCount}`;
      values.push(additionalFields.completedAt);
    }
    
    if (additionalFields?.failureReason) {
      updateQuery += `, failure_reason = $${++paramCount}`;
      values.push(additionalFields.failureReason);
    }
    
    updateQuery += ` WHERE mission_id = $${++paramCount} RETURNING id;`;
    values.push(missionId);
    
    const result = await pool.query(updateQuery, values);
    
    // FIXED: Check for both rowCount and null
    if (result.rowCount && result.rowCount > 0) {
      logger.info(`📊 Mission status updated: ${missionId} → ${status}`);
      return true;
    } else {
      logger.warn(`Mission not found for status update: ${missionId}`);
      return false;
    }
  } catch (error) {
    logger.error(`❌ Failed to update mission status ${missionId}:`, error);
    throw error;
  }
};

// Get mission history for a drone
export const getDroneMissionHistory = async (droneId: string, limit: number = 20) => {
  try {
    const query = `
      SELECT 
        mission_id, drone_id, user_id, file_name, status,
        uploaded_at, started_at, completed_at, failure_reason,
        total_waypoints
      FROM drone_missions 
      WHERE drone_id = $1 
      ORDER BY uploaded_at DESC 
      LIMIT $2;
    `;
    
    const result = await pool.query(query, [droneId, limit]);
    return result.rows;
  } catch (error) {
    logger.error(`❌ Failed to get mission history for ${droneId}:`, error);
    throw error;
  }
};

// Get specific mission with waypoints
export const getMissionWithWaypoints = async (missionId: string) => {
  try {
    const missionQuery = `
      SELECT * FROM drone_missions WHERE mission_id = $1;
    `;
    
    const waypointsQuery = `
      SELECT * FROM mission_waypoints 
      WHERE mission_id = $1 
      ORDER BY sequence_number;
    `;
    
    const [missionResult, waypointsResult] = await Promise.all([
      pool.query(missionQuery, [missionId]),
      pool.query(waypointsQuery, [missionId])
    ]);
    
    if (missionResult.rows.length === 0) {
      return null;
    }
    
    return {
      mission: missionResult.rows[0],
      waypoints: waypointsResult.rows
    };
  } catch (error) {
    logger.error(`❌ Failed to get mission ${missionId}:`, error);
    throw error;
  }
};
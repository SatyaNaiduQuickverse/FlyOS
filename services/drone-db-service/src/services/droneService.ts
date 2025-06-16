// services/drone-db-service/src/services/droneService.ts - FIXED TYPESCRIPT ERRORS
import { pool, prisma } from '../database';
import { storeDroneState } from '../redis';
import { logger } from '../utils/logger';

// Store telemetry data in TimescaleDB
export const storeTelemetryData = async (droneId: string, data: any) => {
  try {
    // First, update drone state in Redis for real-time access
    await storeDroneState(droneId, data);
    
    // Then insert into TimescaleDB for historical storage
    const query = `
      INSERT INTO drone_telemetry (
        drone_id, timestamp, 
        latitude, longitude, altitude_msl, altitude_relative,
        armed, flight_mode, connected,
        gps_fix, satellites, hdop, position_error,
        voltage, current, percentage,
        roll, pitch, yaw,
        velocity_x, velocity_y, velocity_z,
        latency, teensy_connected, latch_status
      ) VALUES (
        $1, $2, 
        $3, $4, $5, $6, 
        $7, $8, $9, 
        $10, $11, $12, $13, 
        $14, $15, $16, 
        $17, $18, $19, 
        $20, $21, $22, 
        $23, $24, $25
      ) RETURNING id;
    `;
    
    const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();
    
    const values = [
      droneId, timestamp,
      data.latitude, data.longitude, data.altitudeMSL, data.altitudeRelative,
      data.armed, data.flight_mode, data.connected,
      data.gps_fix, data.satellites, data.hdop, data.position_error,
      data.voltage, data.current, data.percentage,
      data.orientation?.x, data.orientation?.y, data.orientation?.z,
      data.linear?.x, data.linear?.y, data.linear?.z,
      data.latency, data.connected, data.latch_status
    ];
    
    const result = await pool.query(query, values);
    return { id: result.rows[0].id };
  } catch (error) {
    logger.error(`Error storing telemetry data: ${error}`);
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
    // If interval is specified, use continuous aggregate (for better performance)
    if (interval === 'hourly') {
      const query = `
        SELECT 
          time_bucket('1 hour', bucket) as time,
          drone_id,
          avg_altitude,
          min_altitude,
          max_altitude,
          avg_battery
        FROM drone_telemetry_hourly
        WHERE drone_id = $1 AND bucket BETWEEN $2 AND $3
        ORDER BY time;
      `;
      
      const result = await pool.query(query, [droneId, startTime, endTime]);
      return result.rows;
    }
    
    // Otherwise, query raw data
    const query = `
      SELECT 
        timestamp,
        latitude, longitude, altitude_relative,
        armed, flight_mode,
        voltage, current, percentage,
        roll, pitch, yaw,
        velocity_x, velocity_y, velocity_z
      FROM drone_telemetry
      WHERE drone_id = $1 AND timestamp BETWEEN $2 AND $3
      ORDER BY timestamp;
    `;
    
    const result = await pool.query(query, [droneId, startTime, endTime]);
    return result.rows;
  } catch (error) {
    logger.error(`Error getting historical telemetry: ${error}`);
    throw error;
  }
};

// Record a command in the database
export const recordCommand = async (
  droneId: string, 
  userId: string, 
  commandType: string, 
  parameters: any
) => {
  try {
    const query = `
      INSERT INTO drone_commands (
        drone_id, user_id, command_type, parameters, timestamp
      ) VALUES (
        $1, $2, $3, $4, NOW()
      ) RETURNING id;
    `;
    
    const values = [droneId, userId, commandType, parameters];
    const result = await pool.query(query, values);
    
    return { id: result.rows[0].id };
  } catch (error) {
    logger.error(`Error recording command: ${error}`);
    throw error;
  }
};

// Get command history
export const getCommandHistory = async (droneId: string, limit: number = 20) => {
  try {
    const query = `
      SELECT 
        id, drone_id, user_id, command_type, parameters, 
        timestamp, status, executed_at, completed_at, response_data
      FROM drone_commands
      WHERE drone_id = $1
      ORDER BY timestamp DESC
      LIMIT $2;
    `;
    
    const result = await pool.query(query, [droneId, limit]);
    return result.rows;
  } catch (error) {
    logger.error(`Error getting command history: ${error}`);
    throw error;
  }
};

// NEW: Precision Landing Data Interface
export interface PrecisionLandingData {
  droneId: string;
  sessionId: string;
  timestamp?: string;
  stage?: string;
  message: string;
  altitude?: number;
  targetDetected?: boolean;
  targetConfidence?: number;
  lateralError?: number;
  verticalError?: number;
  batteryLevel?: number;
  windSpeed?: number;
  rawData?: any;
}

// NEW: Store precision landing data in TimescaleDB - FIXED TYPE ISSUES
export const storePrecisionLandingData = async (data: PrecisionLandingData) => {
  try {
    const query = `
      INSERT INTO precision_landing_logs (
        drone_id, timestamp, session_id, stage, message,
        altitude, target_detected, target_confidence,
        lateral_error, vertical_error, battery_level, wind_speed, raw_data
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
      ) RETURNING id;
    `;
    
    const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();
    
    // FIXED: Explicitly handle type conversions and null values
    const values: (string | number | boolean | Date | null)[] = [
      data.droneId,                                                    // $1 - string
      timestamp,                                                       // $2 - Date
      data.sessionId,                                                  // $3 - string
      data.stage || null,                                             // $4 - string | null
      data.message,                                                    // $5 - string
      data.altitude || null,                                          // $6 - number | null
      data.targetDetected || null,                                    // $7 - boolean | null
      data.targetConfidence || null,                                  // $8 - number | null
      data.lateralError || null,                                      // $9 - number | null
      data.verticalError || null,                                     // $10 - number | null
      data.batteryLevel || null,                                      // $11 - number | null
      data.windSpeed || null,                                         // $12 - number | null
      data.rawData ? JSON.stringify(data.rawData) : null             // $13 - string | null
    ];
    
    const result = await pool.query(query, values);
    logger.debug(`🎯 Precision landing data stored: ${data.droneId} - ${data.message.substring(0, 50)}...`);
    return { id: result.rows[0].id };
  } catch (error) {
    logger.error(`Error storing precision landing data: ${error}`);
    throw error;
  }
};

// NEW: Get precision landing history
export const getPrecisionLandingHistory = async (
  droneId: string,
  startTime?: Date,
  endTime?: Date,
  limit: number = 100
) => {
  try {
    let query = `
      SELECT 
        id, drone_id, timestamp, session_id, stage, message,
        altitude, target_detected, target_confidence,
        lateral_error, vertical_error, battery_level, wind_speed,
        raw_data, created_at
      FROM precision_landing_logs
      WHERE drone_id = $1
    `;
    const values: (string | Date | number)[] = [droneId];
    
    if (startTime && endTime) {
      query += ` AND timestamp BETWEEN $2 AND $3`;
      values.push(startTime, endTime);
    }
    
    query += ` ORDER BY timestamp DESC LIMIT $${values.length + 1}`;
    values.push(limit);
    
    const result = await pool.query(query, values);
    
    // Parse raw_data back to objects
    const parsedRows = result.rows.map(row => ({
      ...row,
      raw_data: row.raw_data ? JSON.parse(row.raw_data) : null
    }));
    
    return parsedRows;
  } catch (error) {
    logger.error(`Error getting precision landing history: ${error}`);
    throw error;
  }
};

// NEW: Get precision landing session summary
export const getPrecisionLandingSessionSummary = async (
  droneId: string,
  sessionId: string
) => {
  try {
    const query = `
      SELECT 
        session_id,
        MIN(timestamp) as session_start,
        MAX(timestamp) as session_end,
        COUNT(*) as total_messages,
        COUNT(CASE WHEN stage = 'LANDED' THEN 1 END) as successful_landing,
        AVG(target_confidence) as avg_confidence,
        AVG(lateral_error) as avg_lateral_error,
        AVG(vertical_error) as avg_vertical_error,
        MIN(altitude) as min_altitude,
        MAX(altitude) as max_altitude
      FROM precision_landing_logs
      WHERE drone_id = $1 AND session_id = $2
      GROUP BY session_id;
    `;
    
    const result = await pool.query(query, [droneId, sessionId]);
    return result.rows[0] || null;
  } catch (error) {
    logger.error(`Error getting precision landing session summary: ${error}`);
    throw error;
  }
};
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

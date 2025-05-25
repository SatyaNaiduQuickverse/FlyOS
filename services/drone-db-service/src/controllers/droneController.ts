// services/drone-db-service/src/controllers/droneController.ts - FIXED VERSION
import { Request, Response } from 'express';
import { 
  storeTelemetryData, 
  getHistoricalTelemetry,
  recordCommand,
  getCommandHistory
} from '../services/droneService';
import { pool } from '../database';
import { logger } from '../utils/logger';

// Get drone state from Redis (with fallback)
const getDroneStateFromRedis = async (droneId: string) => {
  try {
    // Try to import and use Redis
    const { getDroneState } = await import('../redis');
    return await getDroneState(droneId);
  } catch (error) {
    // Redis not available, return null
    logger.warn(`Redis not available for drone ${droneId}, using database only`);
    return null;
  }
};

// Get all drones (with role-based filtering)
export const getAllDronesController = async (req: Request, res: Response) => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { role, region_id } = req.user;
    
    let whereClause = '';
    let values: any[] = [];
    
    // Apply role-based filtering
    if (role === 'MAIN_HQ') {
      // Main HQ can see all drones
      whereClause = '';
    } else if (role === 'REGIONAL_HQ') {
      // Regional HQ can only see drones in their region
      whereClause = 'WHERE d.region_id = $1';
      values = [region_id];
    } else if (role === 'OPERATOR') {
      // Operators can only see drones assigned to them
      whereClause = 'WHERE d.operator_id = $1';
      values = [req.user.username]; // Use username for now since we're using TEXT
    } else {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }
    
    // Simplified query without complex joins
    const query = `
      SELECT 
        d.id,
        d.model,
        d.status,
        d.region_id,
        d.operator_id,
        d.last_maintenance,
        d.created_at,
        d.updated_at,
        r.name as region_name
      FROM drones d
      LEFT JOIN regions r ON d.region_id = r.id
      ${whereClause}
      ORDER BY d.status, d.id;
    `;
    
    logger.info(`Executing query: ${query} with values: ${JSON.stringify(values)}`);
    
    const result = await pool.query(query, values);
    const drones = result.rows;
    
    // Enhance with real-time state from Redis (if available)
    const enhancedDrones = await Promise.all(
      drones.map(async (drone) => {
        try {
          const realTimeState = await getDroneStateFromRedis(drone.id);
          return {
            ...drone,
            // Add real-time telemetry data if available
            latitude: realTimeState?.latitude || null,
            longitude: realTimeState?.longitude || null,
            altitude: realTimeState?.altitudeRelative || null,
            battery_percentage: realTimeState?.percentage || null,
            connected: realTimeState?.connected || false,
            flight_mode: realTimeState?.flight_mode || 'UNKNOWN',
            armed: realTimeState?.armed || false,
            last_telemetry: realTimeState?._meta?.redisTimestamp ? 
              new Date(realTimeState._meta.redisTimestamp) : null
          };
        } catch (error) {
          logger.warn(`Failed to get real-time state for drone ${drone.id}:`, error);
          return {
            ...drone,
            connected: false,
            last_telemetry: null,
            latitude: null,
            longitude: null,
            altitude: null,
            battery_percentage: null,
            flight_mode: 'UNKNOWN',
            armed: false
          };
        }
      })
    );
    
    logger.info(`Retrieved ${enhancedDrones.length} drones for user ${req.user.username} (${role})`);
    
    return res.status(200).json({
      success: true,
      data: enhancedDrones,
      count: enhancedDrones.length,
      user_role: role,
      user_region: region_id
    });
  } catch (error) {
    logger.error(`Error getting all drones: ${error}`);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get current drone state from Redis
export const getDroneStateController = async (req: Request, res: Response) => {
  try {
    const { droneId } = req.params;
    
    const state = await getDroneStateFromRedis(droneId);
    
    if (!state) {
      return res.status(404).json({ 
        success: false, 
        message: 'No drone state found' 
      });
    }
    
    return res.status(200).json({
      success: true,
      data: state
    });
  } catch (error) {
    logger.error(`Error getting drone state: ${error}`);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// Store telemetry data from drone
export const storeTelemetryController = async (req: Request, res: Response) => {
  try {
    const { droneId } = req.params;
    const telemetryData = req.body;
    
    if (!telemetryData) {
      return res.status(400).json({
        success: false,
        message: 'No telemetry data provided'
      });
    }
    
    const result = await storeTelemetryData(droneId, telemetryData);
    
    return res.status(200).json({
      success: true,
      message: 'Telemetry data stored successfully',
      id: result.id
    });
  } catch (error) {
    logger.error(`Error storing telemetry: ${error}`);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// Get historical telemetry data
export const getHistoricalTelemetryController = async (req: Request, res: Response) => {
  try {
    const { droneId } = req.params;
    const { startTime, endTime, interval } = req.query;
    
    if (!startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'Start time and end time are required'
      });
    }
    
    const telemetry = await getHistoricalTelemetry(
      droneId,
      new Date(startTime as string),
      new Date(endTime as string),
      interval as string
    );
    
    return res.status(200).json({
      success: true,
      data: telemetry
    });
  } catch (error) {
    logger.error(`Error getting historical telemetry: ${error}`);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// Send command to drone
export const sendCommandController = async (req: Request, res: Response) => {
  try {
    const { droneId } = req.params;
    const { commandType, parameters } = req.body;
    
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const userId = req.user.id;
    
    if (!commandType) {
      return res.status(400).json({
        success: false,
        message: 'Command type is required'
      });
    }
    
    const command = await recordCommand(droneId, userId, commandType, parameters || {});
    
    return res.status(200).json({
      success: true,
      message: 'Command sent successfully',
      commandId: command.id
    });
  } catch (error) {
    logger.error(`Error sending command: ${error}`);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// Get command history
export const getCommandHistoryController = async (req: Request, res: Response) => {
  try {
    const { droneId } = req.params;
    const { limit = '20' } = req.query;
    
    const commands = await getCommandHistory(droneId, parseInt(limit as string));
    
    return res.status(200).json({
      success: true,
      data: commands
    });
  } catch (error) {
    logger.error(`Error getting command history: ${error}`);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// services/drone-db-service/src/controllers/droneController.ts - FIXED JSON PARSING
import { Request, Response } from 'express';
import { 
  storeTelemetryData, 
  getHistoricalTelemetry,
  recordCommand,
  getCommandHistory
} from '../services/droneService';
import { 
  storeMissionInDB, 
  updateMissionStatusInDB,
  getDroneMissionHistory 
} from '../services/missionService';
import { pool } from '../database';
import { redisClient } from '../redis';
import { logger } from '../utils/logger';

// Get drone state from Redis (with fallback)
const getDroneStateFromRedis = async (droneId: string) => {
  try {
    const { getDroneState } = await import('../redis');
    return await getDroneState(droneId);
  } catch (error) {
    logger.warn(`Redis not available for drone ${droneId}, using database only`);
    return null;
  }
};

// Get all drones (with role-based filtering)
export const getAllDronesController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { role, region_id } = req.user;
    
    let whereClause = '';
    let values: any[] = [];
    
    if (role === 'MAIN_HQ') {
      whereClause = '';
    } else if (role === 'REGIONAL_HQ') {
      whereClause = 'WHERE d.region_id = $1';
      values = [region_id];
    } else if (role === 'OPERATOR') {
      whereClause = 'WHERE d.operator_id = $1';
      values = [req.user.username];
    } else {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }
    
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
    
    const result = await pool.query(query, values);
    const drones = result.rows;
    
    const enhancedDrones = await Promise.all(
      drones.map(async (drone) => {
        try {
          const realTimeState = await getDroneStateFromRedis(drone.id);
          return {
            ...drone,
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

// Helper function to determine if command is manual control
const isManualControl = (commandType: string): boolean => {
  const manualControls = ['throttle', 'yaw', 'pitch', 'roll', 'move', 'pwm_update'];
  return manualControls.includes(commandType.toLowerCase());
};

// Helper function to determine if command is mission-related
const isMissionCommand = (commandType: string): boolean => {
  const missionCommands = ['upload_waypoints', 'start_mission', 'cancel_mission', 'clear_waypoints'];
  return missionCommands.includes(commandType.toLowerCase());
};

// FIXED: Enhanced send command controller with proper JSON error handling
export const sendCommandController = async (req: Request, res: Response) => {
  try {
    const { droneId } = req.params;
    const { commandType, parameters } = req.body;
    
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
    
    // Handle mission commands specially
    if (isMissionCommand(commandType)) {
      return await handleMissionCommand(req, res, droneId, commandType, parameters, userId);
    }
    
    // Handle regular commands (existing logic)
    const commandPayload = {
      id: Date.now(),
      droneId,
      commandType,
      parameters: parameters || {},
      userId,
      timestamp: new Date().toISOString()
    };
    
    logger.info(`📤 Sending command to ${droneId}: ${commandType}`);
    
    try {
      // FIXED: Wrap Redis operations in proper error handling
      if (isManualControl(commandType)) {
        // Fast path for manual controls - don't wait for Redis response
        try {
          await redisClient.publish(
            `drone:${droneId}:commands`,
            JSON.stringify(commandPayload)
          );
          
          // Background logging - don't block response
          recordCommand(droneId, userId, commandType, parameters || {})
            .catch(err => logger.warn(`Background logging failed for ${commandType}:`, err));
          
          logger.info(`⚡ Fast command sent to ${droneId}: ${commandType}`);
        } catch (redisError) {
          logger.warn(`Redis publish failed for manual control ${commandType}:`, redisError);
          // For manual controls, we can continue without Redis
        }
        
      } else {
        // Safe path for critical commands
        try {
          const command = await recordCommand(droneId, userId, commandType, parameters || {});
          
          const payloadWithDbId = {
            ...commandPayload,
            dbId: command.id
          };
          
          await redisClient.publish(
            `drone:${droneId}:commands`,
            JSON.stringify(payloadWithDbId)
          );
          
          logger.info(`🔒 Critical command sent to ${droneId}: ${commandType}`);
        } catch (redisError) {
          logger.error(`Redis publish failed for critical command ${commandType}:`, redisError);
          
          // Still record in database for audit
          try {
            const command = await recordCommand(droneId, userId, commandType, parameters || {});
            return res.status(202).json({
              success: true,
              message: 'Command recorded but real-time delivery failed',
              commandId: command.id,
              warning: 'Drone may not receive command immediately'
            });
          } catch (dbError) {
            logger.error(`Database recording also failed:`, dbError);
            return res.status(500).json({
              success: false,
              message: 'Command failed - both Redis and database unavailable'
            });
          }
        }
      }
      
      return res.status(200).json({
        success: true,
        message: 'Command sent successfully',
        commandId: commandPayload.id,
        droneId: droneId,
        commandType: commandType,
        timestamp: commandPayload.timestamp
      });
      
    } catch (error) {
      logger.error(`Unexpected error in command processing:`, error);
      return res.status(500).json({
        success: false,
        message: 'Command processing failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
  } catch (error) {
    logger.error(`Error in sendCommandController: ${error}`);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// FIXED: Handle mission-specific commands with proper error handling
const handleMissionCommand = async (
  req: Request, 
  res: Response, 
  droneId: string, 
  commandType: string, 
  parameters: any, 
  userId: string
) => {
  try {
    const missionId = `mission_${Date.now()}_${droneId}`;
    
    // Handle waypoint upload specially
    if (commandType === 'upload_waypoints') {
      const { waypoints, fileName, totalWaypoints } = parameters;
      
      if (!waypoints || !Array.isArray(waypoints) || waypoints.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Valid waypoints array is required'
        });
      }
      
      // Store mission in database for safety
      const missionData = {
        missionId,
        droneId,
        userId,
        fileName: fileName || 'uploaded_waypoints.txt',
        waypoints,
        totalWaypoints: waypoints.length,
        status: 'uploaded' as const,
        commandId: missionId
      };
      
      try {
        await storeMissionInDB(missionData);
        logger.info(`💾 Mission stored in database: ${missionId}`);
      } catch (dbError) {
        logger.error(`Failed to store mission in database:`, dbError);
        // Continue with Redis publish even if DB storage fails
      }
    }
    
    // Create command payload for Redis
    const commandPayload = {
      id: missionId,
      droneId,
      commandType,
      parameters: {
        ...parameters,
        missionId
      },
      userId,
      timestamp: new Date().toISOString()
    };
    
    // Record command in audit log (non-blocking)
    recordCommand(droneId, userId, commandType, commandPayload.parameters)
      .catch(err => logger.warn(`Audit logging failed for ${commandType}:`, err));
    
    // FIXED: Wrap Redis publish in proper error handling
    try {
      await redisClient.publish(
        `drone:${droneId}:commands`,
        JSON.stringify(commandPayload)
      );
      
      logger.info(`🗺️ Mission command sent: ${commandType} for ${droneId}`);
      
      return res.status(200).json({
        success: true,
        message: `Mission command processed: ${commandType}`,
        commandId: missionId,
        missionId: missionId,
        droneId: droneId,
        commandType: commandType,
        timestamp: commandPayload.timestamp
      });
      
    } catch (redisError) {
      logger.error(`Redis publish failed for mission command ${commandType}:`, redisError);
      
      // Mission commands are critical - return error if Redis fails
      return res.status(500).json({
        success: false,
        message: 'Mission command failed - real-time delivery unavailable',
        error: 'Redis connection failed'
      });
    }
    
  } catch (error) {
    logger.error(`Mission command error: ${error}`);
    return res.status(500).json({
      success: false,
      message: 'Mission command failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get mission history for a drone
export const getMissionHistoryController = async (req: Request, res: Response) => {
  try {
    const { droneId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const missions = await getDroneMissionHistory(droneId, limit);
    
    return res.status(200).json({
      success: true,
      droneId,
      missions,
      count: missions.length
    });
  } catch (error) {
    logger.error(`Error getting mission history: ${error}`);
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

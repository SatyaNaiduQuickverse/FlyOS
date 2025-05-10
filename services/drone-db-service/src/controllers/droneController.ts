import { Request, Response } from 'express';
import { 
  storeTelemetryData, 
  getHistoricalTelemetry,
  recordCommand,
  getCommandHistory
} from '../services/droneService';
import { getDroneState } from '../redis';
import { logger } from '../utils/logger';

// Get current drone state from Redis
export const getDroneStateController = async (req: Request, res: Response) => {
  try {
    const { droneId } = req.params;
    
    const state = await getDroneState(droneId);
    
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
    
    const userId = req.user.id; // Now TypeScript knows req.user exists
    
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

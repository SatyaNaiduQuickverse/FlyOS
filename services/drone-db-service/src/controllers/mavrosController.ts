// services/drone-db-service/src/controllers/mavrosController.ts
import { Request, Response } from 'express';
import {
  storeMAVROSMessage,
  storeMAVROSSession,
  getMAVROSLogs,
  getMAVROSStatus,
  getMAVROSStatistics,
  getMAVROSSession,
  searchMAVROSLogs,
  getMAVROSBuffer,
  cleanupOldMAVROSData,
  getMAVROSMessageTypes,
  MAVROSLogQuery
} from '../services/mavrosService';
import { logger } from '../utils/logger';

/**
 * Store MAVROS message (called by drone-connection-service)
 */
export const storeMAVROSMessageController = async (req: Request, res: Response) => {
  try {
    const { droneId } = req.params;
    const messageData = {
      ...req.body,
      droneId
    };
    
    // Validate required fields
    if (!messageData.message || !messageData.messageType || !messageData.sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: message, messageType, sessionId'
      });
    }
    
    const result = await storeMAVROSMessage(messageData);
    
    res.status(201).json({
      success: true,
      message: 'MAVROS message stored successfully',
      id: result.id
    });
    
  } catch (error) {
    logger.error(`Error storing MAVROS message for ${req.params.droneId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to store MAVROS message',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get MAVROS logs with filtering and pagination
 */
export const getMAVROSLogsController = async (req: Request, res: Response) => {
  try {
    const { droneId } = req.params;
    const {
      startTime,
      endTime,
      messageType,
      severityLevel,
      sessionId,
      search,
      limit = '100',
      offset = '0'
    } = req.query;
    
    // Build query parameters
    const queryParams: MAVROSLogQuery = {
      droneId,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    };
    
    if (startTime) queryParams.startTime = new Date(startTime as string);
    if (endTime) queryParams.endTime = new Date(endTime as string);
    if (messageType) queryParams.messageType = messageType as string;
    if (severityLevel !== undefined) queryParams.severityLevel = parseInt(severityLevel as string);
    if (sessionId) queryParams.sessionId = sessionId as string;
    if (search) queryParams.search = search as string;
    
    const result = await getMAVROSLogs(queryParams);
    
    res.json({
      success: true,
      data: result.logs,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        hasMore: result.hasMore
      }
    });
    
  } catch (error) {
    logger.error(`Error getting MAVROS logs for ${req.params.droneId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve MAVROS logs'
    });
  }
};

/**
 * Get current MAVROS status
 */
export const getMAVROSStatusController = async (req: Request, res: Response) => {
  try {
    const { droneId } = req.params;
    
    const status = await getMAVROSStatus(droneId);
    
    res.json({
      success: true,
      status
    });
    
  } catch (error) {
    logger.error(`Error getting MAVROS status for ${req.params.droneId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve MAVROS status'
    });
  }
};

/**
 * Get MAVROS statistics
 */
export const getMAVROSStatisticsController = async (req: Request, res: Response) => {
  try {
    const { droneId } = req.params;
    const { startTime, endTime } = req.query;
    
    if (!startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'startTime and endTime parameters are required'
      });
    }
    
    const statistics = await getMAVROSStatistics(
      droneId,
      new Date(startTime as string),
      new Date(endTime as string)
    );
    
    res.json({
      success: true,
      statistics
    });
    
  } catch (error) {
    logger.error(`Error getting MAVROS statistics for ${req.params.droneId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve MAVROS statistics'
    });
  }
};

/**
 * Get MAVROS session information
 */
export const getMAVROSSessionController = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    const session = await getMAVROSSession(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'MAVROS session not found'
      });
    }
    
    res.json({
      success: true,
      session
    });
    
  } catch (error) {
    logger.error(`Error getting MAVROS session ${req.params.sessionId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve MAVROS session'
    });
  }
};

/**
 * Search MAVROS logs
 */
export const searchMAVROSLogsController = async (req: Request, res: Response) => {
  try {
    const { droneId } = req.params;
    const { q: searchTerm, limit = '50' } = req.query;
    
    if (!searchTerm) {
      return res.status(400).json({
        success: false,
        message: 'Search term (q parameter) is required'
      });
    }
    
    const results = await searchMAVROSLogs(
      droneId,
      searchTerm as string,
      parseInt(limit as string)
    );
    
    res.json({
      success: true,
      searchTerm,
      results
    });
    
  } catch (error) {
    logger.error(`Error searching MAVROS logs for ${req.params.droneId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to search MAVROS logs'
    });
  }
};

/**
 * Get real-time MAVROS buffer
 */
export const getMAVROSBufferController = async (req: Request, res: Response) => {
  try {
    const { droneId } = req.params;
    const { count = '100' } = req.query;
    
    const buffer = await getMAVROSBuffer(droneId, parseInt(count as string));
    
    res.json({
      success: true,
      buffer,
      count: buffer.length
    });
    
  } catch (error) {
    logger.error(`Error getting MAVROS buffer for ${req.params.droneId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve MAVROS buffer'
    });
  }
};

/**
 * Cleanup old MAVROS data (admin only)
 */
export const cleanupMAVROSDataController = async (req: Request, res: Response) => {
  try {
    // Check if user has admin permissions
    if (!req.user || req.user.role !== 'MAIN_HQ') {
      return res.status(403).json({
        success: false,
        message: 'Admin permissions required'
      });
    }
    
    const { retentionDays = '90' } = req.query;
    
    const result = await cleanupOldMAVROSData(parseInt(retentionDays as string));
    
    res.json({
      success: true,
      message: 'MAVROS data cleanup completed',
      result
    });
    
  } catch (error) {
    logger.error('Error cleaning up MAVROS data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup MAVROS data'
    });
  }
};

/**
 * Get MAVROS message types summary
 */
export const getMAVROSMessageTypesController = async (req: Request, res: Response) => {
  try {
    const { droneId } = req.params;
    
    const messageTypes = await getMAVROSMessageTypes(droneId);
    
    res.json({
      success: true,
      messageTypes
    });
    
  } catch (error) {
    logger.error(`Error getting MAVROS message types for ${req.params.droneId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve MAVROS message types'
    });
  }
};
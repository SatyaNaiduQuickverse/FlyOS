// services/user-management-service/src/controllers/droneController.ts
import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import {
  createDrone,
  updateDrone,
  deleteDrone,
  getDrones,
  getDroneById,
  assignDroneToUser,
  CreateDroneInput,
  UpdateDroneInput,
  GetDronesOptions
} from '../services/droneService';

/**
 * GET /api/drones - List drones with filtering
 */
export const getDronesController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const {
      page = '1',
      limit = '20',
      region,
      status,
      operator
    } = req.query;

    const options: GetDronesOptions = {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      regionId: region as string,
      status: status as string,
      operatorId: operator as string,
      requestingUserRole: req.user.role,
      requestingUserRegionId: req.user.regionId,
      requestingUserId: req.user.id
    };

    const result = await getDrones(options);

    logger.info(`Retrieved ${result.drones.length} drones for ${req.user.username}`);

    return res.status(200).json({
      success: true,
      data: result.drones,
      totalCount: result.totalCount,
      pages: result.pages,
      currentPage: result.currentPage,
      metadata: {
        requestingUser: req.user.username,
        role: req.user.role,
        filters: {
          region: options.regionId || null,
          status: options.status || null,
          operator: options.operatorId || null
        }
      }
    });

  } catch (error: any) {
    logger.error('Error in getDronesController:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve drones',
      error: error.message
    });
  }
};

/**
 * GET /api/drones/:id - Get single drone
 */
export const getDroneController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const drone = await getDroneById(id);

    if (!drone) {
      return res.status(404).json({
        success: false,
        message: 'Drone not found'
      });
    }

    // Role-based access control
    if (req.user?.role === 'REGIONAL_HQ' && drone.regionId !== req.user.regionId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - drone not in your region'
      });
    }

    if (req.user?.role === 'OPERATOR' && req.user) {
      const hasAccess = drone.operatorId === req.user.id || 
                       (drone.assignedUsers && drone.assignedUsers.some((userId: string) => userId === req.user!.id));
      
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied - drone not assigned to you'
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: drone
    });

  } catch (error: any) {
    logger.error('Error in getDroneController:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve drone',
      error: error.message
    });
  }
};

/**
 * POST /api/drones - Create new drone
 */
export const createDroneController = async (req: Request, res: Response) => {
  try {
    const {
      id,
      model,
      status,
      regionId,
      operatorId
    } = req.body;

    // Validate required fields
    if (!id || !model) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: id, model'
      });
    }

    // Validate model
    if (!['FlyOS_MQ5', 'FlyOS_MQ7', 'FlyOS_MQ9'].includes(model)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid model. Must be FlyOS_MQ5, FlyOS_MQ7, or FlyOS_MQ9'
      });
    }

    // Validate status
    if (status && !['ACTIVE', 'STANDBY', 'MAINTENANCE', 'OFFLINE'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be ACTIVE, STANDBY, MAINTENANCE, or OFFLINE'
      });
    }

    // Validate drone ID format (basic check)
    if (!/^[a-zA-Z0-9-_]+$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid drone ID format. Use alphanumeric characters, hyphens, and underscores only'
      });
    }

    const droneData: CreateDroneInput = {
      id: id.trim(),
      model,
      status: status || 'STANDBY',
      regionId: regionId || null,
      operatorId: operatorId || null
    };

    const newDrone = await createDrone(droneData);

    logger.info(`Drone created by ${req.user?.username}: ${newDrone.id}`);

    return res.status(201).json({
      success: true,
      message: 'Drone created successfully',
      data: newDrone
    });

  } catch (error: any) {
    logger.error('Error in createDroneController:', error);
    
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }
    
    if (error.message.includes('not found')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create drone',
      error: error.message
    });
  }
};

/**
 * PUT /api/drones/:id - Update drone
 */
export const updateDroneController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      model,
      status,
      regionId,
      operatorId
    } = req.body;

    // Check if drone exists
    const existingDrone = await getDroneById(id);
    if (!existingDrone) {
      return res.status(404).json({
        success: false,
        message: 'Drone not found'
      });
    }

    // Role-based access control
    if (req.user?.role === 'REGIONAL_HQ' && existingDrone.regionId !== req.user.regionId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - drone not in your region'
      });
    }

    // Validate model if provided
    if (model && !['FlyOS_MQ5', 'FlyOS_MQ7', 'FlyOS_MQ9'].includes(model)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid model. Must be FlyOS_MQ5, FlyOS_MQ7, or FlyOS_MQ9'
      });
    }

    // Validate status if provided
    if (status && !['ACTIVE', 'STANDBY', 'MAINTENANCE', 'OFFLINE'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be ACTIVE, STANDBY, MAINTENANCE, or OFFLINE'
      });
    }

    const updateData: UpdateDroneInput = {};
    
    if (model !== undefined) updateData.model = model;
    if (status !== undefined) updateData.status = status;
    if (regionId !== undefined) updateData.regionId = regionId;
    if (operatorId !== undefined) updateData.operatorId = operatorId;

    const updatedDrone = await updateDrone(id, updateData);

    logger.info(`Drone updated by ${req.user?.username}: ${updatedDrone.id}`);

    return res.status(200).json({
      success: true,
      message: 'Drone updated successfully',
      data: updatedDrone
    });

  } catch (error: any) {
    logger.error('Error in updateDroneController:', error);
    
    if (error.message.includes('not found')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update drone',
      error: error.message
    });
  }
};

/**
 * PUT /api/drones/:id/assign - Assign/unassign drone to users
 */
export const assignDroneController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      regionId,
      operatorId,
      additionalUsers
    } = req.body;

    // Check if drone exists
    const existingDrone = await getDroneById(id);
    if (!existingDrone) {
      return res.status(404).json({
        success: false,
        message: 'Drone not found'
      });
    }

    // Role-based access control
    if (req.user?.role === 'REGIONAL_HQ' && existingDrone.regionId !== req.user.regionId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - drone not in your region'
      });
    }

    const updateData: UpdateDroneInput = {};
    
    if (regionId !== undefined) updateData.regionId = regionId;
    if (operatorId !== undefined) updateData.operatorId = operatorId;

    // Update drone basic assignments
    const updatedDrone = await updateDrone(id, updateData);

    // Handle additional user assignments
    if (additionalUsers && Array.isArray(additionalUsers)) {
      for (const userId of additionalUsers) {
        try {
          await assignDroneToUser(id, userId);
          logger.info(`Assigned drone ${id} to user ${userId}`);
        } catch (error) {
          logger.warn(`Failed to assign drone ${id} to user ${userId}:`, error);
        }
      }
    }

    // Get updated drone with all assignments
    const finalDrone = await getDroneById(id);

    logger.info(`Drone assignments updated by ${req.user?.username}: ${id}`);

    return res.status(200).json({
      success: true,
      message: 'Drone assignments updated successfully',
      data: finalDrone
    });

  } catch (error: any) {
    logger.error('Error in assignDroneController:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update drone assignments',
      error: error.message
    });
  }
};

/**
 * DELETE /api/drones/:id - Delete drone
 */
export const deleteDroneController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if drone exists
    const existingDrone = await getDroneById(id);
    if (!existingDrone) {
      return res.status(404).json({
        success: false,
        message: 'Drone not found'
      });
    }

    // Role-based access control
    if (req.user?.role === 'REGIONAL_HQ' && existingDrone.regionId !== req.user.regionId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - drone not in your region'
      });
    }

    const result = await deleteDrone(id);

    logger.info(`Drone deleted by ${req.user?.username}: ${id}`);

    return res.status(200).json({
      success: true,
      message: 'Drone deleted successfully',
      data: {
        deletedDrone: id,
        removedAssignments: result.removedAssignments
      }
    });

  } catch (error: any) {
    logger.error('Error in deleteDroneController:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete drone',
      error: error.message
    });
  }
};
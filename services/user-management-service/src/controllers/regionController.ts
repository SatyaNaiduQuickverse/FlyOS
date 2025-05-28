// services/user-management-service/src/controllers/regionController.ts
import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import {
  createRegion,
  updateRegion,
  deleteRegion,
  getRegions,
  getRegionById,
  CreateRegionInput,
  UpdateRegionInput
} from '../services/regionService';

/**
 * GET /api/regions - List all regions
 */
export const getRegionsController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const regions = await getRegions();

    logger.info(`Retrieved ${regions.length} regions for ${req.user.username}`);

    return res.status(200).json({
      success: true,
      data: regions
    });

  } catch (error: any) {
    logger.error('Error in getRegionsController:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve regions',
      error: error.message
    });
  }
};

/**
 * GET /api/regions/:id - Get single region
 */
export const getRegionController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const region = await getRegionById(id);

    if (!region) {
      return res.status(404).json({
        success: false,
        message: 'Region not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: region
    });

  } catch (error: any) {
    logger.error('Error in getRegionController:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve region',
      error: error.message
    });
  }
};

/**
 * POST /api/regions - Create new region
 */
export const createRegionController = async (req: Request, res: Response) => {
  try {
    const {
      name,
      area,
      commanderName,
      status
    } = req.body;

    // Validate required fields
    if (!name || !area) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, area'
      });
    }

    // Validate status
    if (status && !['ACTIVE', 'INACTIVE'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be ACTIVE or INACTIVE'
      });
    }

    const regionData: CreateRegionInput = {
      name: name.trim(),
      area: area.trim(),
      commanderName: commanderName?.trim() || null,
      status: status || 'ACTIVE'
    };

    const newRegion = await createRegion(regionData);

    if (!newRegion) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create region - no data returned'
      });
    }

    logger.info(`Region created by ${req.user?.username}: ${newRegion.name}`);

    return res.status(201).json({
      success: true,
      message: 'Region created successfully',
      data: newRegion
    });

  } catch (error: any) {
    logger.error('Error in createRegionController:', error);
    
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create region',
      error: error.message
    });
  }
};

/**
 * PUT /api/regions/:id - Update region
 */
export const updateRegionController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      area,
      commanderName,
      status
    } = req.body;

    // Check if region exists
    const existingRegion = await getRegionById(id);
    if (!existingRegion) {
      return res.status(404).json({
        success: false,
        message: 'Region not found'
      });
    }

    // Validate status if provided
    if (status && !['ACTIVE', 'INACTIVE'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be ACTIVE or INACTIVE'
      });
    }

    const updateData: UpdateRegionInput = {};
    
    if (name !== undefined) updateData.name = name.trim();
    if (area !== undefined) updateData.area = area.trim();
    if (commanderName !== undefined) updateData.commanderName = commanderName?.trim() || null;
    if (status !== undefined) updateData.status = status;

    const updatedRegion = await updateRegion(id, updateData);

    if (!updatedRegion) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update region - no data returned'
      });
    }

    logger.info(`Region updated by ${req.user?.username}: ${updatedRegion.name}`);

    return res.status(200).json({
      success: true,
      message: 'Region updated successfully',
      data: updatedRegion
    });

  } catch (error: any) {
    logger.error('Error in updateRegionController:', error);
    
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update region',
      error: error.message
    });
  }
};

/**
 * DELETE /api/regions/:id - Delete region
 */
export const deleteRegionController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if region exists
    const existingRegion = await getRegionById(id);
    if (!existingRegion) {
      return res.status(404).json({
        success: false,
        message: 'Region not found'
      });
    }

    const result = await deleteRegion(id);

    logger.info(`Region deleted by ${req.user?.username}: ${existingRegion.name}`);

    return res.status(200).json({
      success: true,
      message: 'Region deleted successfully',
      data: {
        deletedRegion: existingRegion.name,
        deletedUsers: result.deletedUsers,
        unassignedDrones: result.unassignedDrones,
        regionName: result.regionName
      }
    });

  } catch (error: any) {
    logger.error('Error in deleteRegionController:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete region',
      error: error.message
    });
  }
};
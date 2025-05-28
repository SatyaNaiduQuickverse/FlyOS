// services/user-management-service/src/controllers/userController.ts
import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import {
  createUser,
  updateUser,
  deleteUser,
  getUsers,
  getUserById,
  CreateUserInput,
  UpdateUserInput
} from '../services/userService';

/**
 * GET /api/users - List users with filtering
 */
export const getUsersController = async (req: Request, res: Response) => {
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
      role,
      region,
      status
    } = req.query;

    const options = {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      role: role as string,
      regionId: region as string,
      status: status as string,
      requestingUserRole: req.user.role,
      requestingUserRegionId: req.user.regionId
    };

    const result = await getUsers(options);

    logger.info(`Retrieved ${result.users.length} users for ${req.user.username}`);

    return res.status(200).json({
      success: true,
      data: result.users,
      totalCount: result.totalCount,
      pages: result.pages,
      currentPage: result.currentPage,
      metadata: {
        requestingUser: req.user.username,
        role: req.user.role,
        filters: {
          role: options.role || null,
          region: options.regionId || null,
          status: options.status || null
        }
      }
    });

  } catch (error: any) {
    logger.error('Error in getUsersController:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve users',
      error: error.message
    });
  }
};

/**
 * GET /api/users/:id - Get single user
 */
export const getUserController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = await getUserById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Role-based access control
    if (req.user?.role === 'REGIONAL_HQ' && user.regionId !== req.user.regionId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - user not in your region'
      });
    }

    return res.status(200).json({
      success: true,
      data: user
    });

  } catch (error: any) {
    logger.error('Error in getUserController:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve user',
      error: error.message
    });
  }
};

/**
 * POST /api/users - Create new user
 */
export const createUserController = async (req: Request, res: Response) => {
  try {
    const {
      username,
      fullName,
      email,
      password,
      role,
      regionId,
      status
    } = req.body;

    // Validate required fields
    if (!username || !fullName || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: username, fullName, email, password, role'
      });
    }

    // Validate role
    if (!['MAIN_HQ', 'REGIONAL_HQ', 'OPERATOR'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be MAIN_HQ, REGIONAL_HQ, or OPERATOR'
      });
    }

    // Regional HQ requires regionId
    if (role === 'REGIONAL_HQ' && !regionId) {
      return res.status(400).json({
        success: false,
        message: 'Regional HQ users must be assigned to a region'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }

    const userData: CreateUserInput = {
      username: username.trim(),
      fullName: fullName.trim(),
      email: email.toLowerCase().trim(),
      password,
      role,
      regionId: regionId || undefined,
      status: status || 'ACTIVE'
    };

    const newUser = await createUser(userData);

    logger.info(`User created by ${req.user?.username}: ${newUser.username}`);

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: newUser
    });

  } catch (error: any) {
    logger.error('Error in createUserController:', error);
    
    // Handle specific errors
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }
    
    if (error.message.includes('Region') && error.message.includes('not found')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create user',
      error: error.message
    });
  }
};

/**
 * PUT /api/users/:id - Update user
 */
export const updateUserController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      username,
      fullName,
      email,
      role,
      regionId,
      status
    } = req.body;

    // Check if user exists
    const existingUser = await getUserById(id);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Role-based access control
    if (req.user?.role === 'REGIONAL_HQ' && existingUser.regionId !== req.user.regionId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - user not in your region'
      });
    }

    // Validate role if provided
    if (role && !['MAIN_HQ', 'REGIONAL_HQ', 'OPERATOR'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be MAIN_HQ, REGIONAL_HQ, or OPERATOR'
      });
    }

    // Regional HQ requires regionId
    if (role === 'REGIONAL_HQ' && !regionId && !existingUser.regionId) {
      return res.status(400).json({
        success: false,
        message: 'Regional HQ users must be assigned to a region'
      });
    }

    // Validate email format if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }
    }

    const updateData: UpdateUserInput = {};
    
    if (username !== undefined) updateData.username = username.trim();
    if (fullName !== undefined) updateData.fullName = fullName.trim();
    if (email !== undefined) updateData.email = email.toLowerCase().trim();
    if (role !== undefined) updateData.role = role;
    if (regionId !== undefined) updateData.regionId = regionId;
    if (status !== undefined) updateData.status = status;

    const updatedUser = await updateUser(id, updateData);

    logger.info(`User updated by ${req.user?.username}: ${updatedUser.username}`);

    return res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser
    });

  } catch (error: any) {
    logger.error('Error in updateUserController:', error);
    
    // Handle specific errors
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }
    
    if (error.message.includes('Region') && error.message.includes('not found')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: error.message
    });
  }
};

/**
 * DELETE /api/users/:id - Delete user
 */
export const deleteUserController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const existingUser = await getUserById(id);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Role-based access control
    if (req.user?.role === 'REGIONAL_HQ' && existingUser.regionId !== req.user.regionId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - user not in your region'
      });
    }

    // Prevent self-deletion
    if (existingUser.id === req.user?.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    const result = await deleteUser(id);

    logger.info(`User deleted by ${req.user?.username}: ${existingUser.username}`);

    return res.status(200).json({
      success: true,
      message: 'User deleted successfully',
      data: {
        deletedUser: existingUser.username,
        unassignedDrones: result.unassignedDrones
      }
    });

  } catch (error: any) {
    logger.error('Error in deleteUserController:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message
    });
  }
};
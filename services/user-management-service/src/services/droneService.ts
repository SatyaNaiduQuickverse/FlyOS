// services/user-management-service/src/services/droneService.ts
import { prisma } from '../database';
import { logger } from '../utils/logger';

// Input Types
export interface CreateDroneInput {
  id: string; // User-defined ID
  model: 'FlyOS_MQ5' | 'FlyOS_MQ7' | 'FlyOS_MQ9';
  status?: 'ACTIVE' | 'STANDBY' | 'MAINTENANCE' | 'OFFLINE';
  regionId?: string | null;
  operatorId?: string | null;
}

export interface UpdateDroneInput {
  model?: 'FlyOS_MQ5' | 'FlyOS_MQ7' | 'FlyOS_MQ9';
  status?: 'ACTIVE' | 'STANDBY' | 'MAINTENANCE' | 'OFFLINE';
  regionId?: string | null;
  operatorId?: string | null;
}

export interface GetDronesOptions {
  page: number;
  limit: number;
  regionId?: string;
  status?: string;
  operatorId?: string;
  requestingUserRole: string;
  requestingUserRegionId?: string;
  requestingUserId: string;
}

/**
 * Create a new drone
 */
export const createDrone = async (droneData: CreateDroneInput) => {
  logger.info(`Creating drone: ${droneData.id}`);

  // Check if drone ID already exists
  const existingDrone = await prisma.drone.findUnique({
    where: { id: droneData.id }
  });
  
  if (existingDrone) {
    throw new Error(`Drone with ID '${droneData.id}' already exists`);
  }

  // Validate region exists if provided
  if (droneData.regionId) {
    const region = await prisma.region.findUnique({
      where: { id: droneData.regionId }
    });
    
    if (!region) {
      throw new Error(`Region with ID ${droneData.regionId} not found`);
    }
    
    if (region.status !== 'ACTIVE') {
      throw new Error(`Cannot assign drone to inactive region: ${region.name}`);
    }
  }

  // Validate operator exists if provided
  if (droneData.operatorId) {
    const operator = await prisma.user.findUnique({
      where: { id: droneData.operatorId }
    });
    
    if (!operator) {
      throw new Error(`Operator with ID ${droneData.operatorId} not found`);
    }
    
    if (operator.status !== 'ACTIVE') {
      throw new Error(`Cannot assign drone to inactive operator: ${operator.username}`);
    }

    // Check if operator is in the same region (if both have regions)
    if (droneData.regionId && operator.regionId && droneData.regionId !== operator.regionId) {
      throw new Error('Operator must be in the same region as the drone');
    }
  }

  try {
    const newDrone = await prisma.drone.create({
      data: {
        id: droneData.id,
        model: droneData.model as any,
        status: droneData.status || 'STANDBY',
        regionId: droneData.regionId,
        operatorId: droneData.operatorId
      },
      include: {
        region: true,
        operator: true,
        userAssignments: {
          include: {
            user: true
          }
        }
      }
    });

    logger.info(`✅ Drone created: ${newDrone.id}`);

    return transformDroneResponse(newDrone);

  } catch (error) {
    logger.error('Error creating drone:', error);
    throw error;
  }
};

/**
 * Update an existing drone
 */
export const updateDrone = async (droneId: string, updateData: UpdateDroneInput) => {
  logger.info(`Updating drone: ${droneId}`);

  // Check if drone exists
  const existingDrone = await prisma.drone.findUnique({
    where: { id: droneId }
  });

  if (!existingDrone) {
    throw new Error('Drone not found');
  }

  // Validate region exists if changing
  if (updateData.regionId && updateData.regionId !== existingDrone.regionId) {
    const region = await prisma.region.findUnique({
      where: { id: updateData.regionId }
    });
    
    if (!region) {
      throw new Error(`Region with ID ${updateData.regionId} not found`);
    }
    
    if (region.status !== 'ACTIVE') {
      throw new Error(`Cannot assign drone to inactive region: ${region.name}`);
    }
  }

  // Validate operator exists if changing
  if (updateData.operatorId && updateData.operatorId !== existingDrone.operatorId) {
    const operator = await prisma.user.findUnique({
      where: { id: updateData.operatorId }
    });
    
    if (!operator) {
      throw new Error(`Operator with ID ${updateData.operatorId} not found`);
    }
    
    if (operator.status !== 'ACTIVE') {
      throw new Error(`Cannot assign drone to inactive operator: ${operator.username}`);
    }

    // Check region compatibility
    const finalRegionId = updateData.regionId !== undefined ? updateData.regionId : existingDrone.regionId;
    if (finalRegionId && operator.regionId && finalRegionId !== operator.regionId) {
      throw new Error('Operator must be in the same region as the drone');
    }
  }

  try {
    const updatedDrone = await prisma.drone.update({
      where: { id: droneId },
      data: {
        ...(updateData.model !== undefined && { model: updateData.model as any }),
        ...(updateData.status !== undefined && { status: updateData.status as any }),
        ...(updateData.regionId !== undefined && { regionId: updateData.regionId }),
        ...(updateData.operatorId !== undefined && { operatorId: updateData.operatorId }),
        updatedAt: new Date()
      },
      include: {
        region: true,
        operator: true,
        userAssignments: {
          include: {
            user: true
          }
        }
      }
    });

    logger.info(`✅ Drone updated: ${updatedDrone.id}`);

    return transformDroneResponse(updatedDrone);

  } catch (error) {
    logger.error('Error updating drone:', error);
    throw error;
  }
};

/**
 * Delete a drone
 */
export const deleteDrone = async (droneId: string) => {
  logger.info(`Deleting drone: ${droneId}`);

  const drone = await prisma.drone.findUnique({
    where: { id: droneId },
    include: {
      userAssignments: true
    }
  });

  if (!drone) {
    throw new Error('Drone not found');
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Step 1: Remove all user assignments
      const removedAssignments = await tx.userDroneAssignment.deleteMany({
        where: { droneId }
      });

      // Step 2: Delete the drone
      await tx.drone.delete({
        where: { id: droneId }
      });

      return {
        removedAssignments: removedAssignments.count
      };
    });

    logger.info(`✅ Drone deleted: ${droneId} (${result.removedAssignments} assignments removed)`);

    return {
      success: true,
      removedAssignments: result.removedAssignments
    };

  } catch (error) {
    logger.error('Error deleting drone:', error);
    throw error;
  }
};

/**
 * Get drones with role-based filtering
 */
export const getDrones = async (options: GetDronesOptions) => {
  const { page, limit, regionId, status, operatorId, requestingUserRole, requestingUserRegionId, requestingUserId } = options;
  
  const skip = (page - 1) * limit;
  
  // Build filters
  const where: any = {};
  
  if (regionId) where.regionId = regionId;
  if (status) where.status = status;
  if (operatorId) where.operatorId = operatorId;
  
  // Role-based access control
  if (requestingUserRole === 'REGIONAL_HQ') {
    where.regionId = requestingUserRegionId;
  } else if (requestingUserRole === 'OPERATOR') {
    // Operators can only see drones assigned to them
    where.OR = [
      { operatorId: requestingUserId },
      { 
        userAssignments: {
          some: {
            userId: requestingUserId
          }
        }
      }
    ];
  }
  // MAIN_HQ can see all drones
  
  const [drones, totalCount] = await Promise.all([
    prisma.drone.findMany({
      where,
      skip,
      take: limit,
      include: {
        region: true,
        operator: true,
        userAssignments: {
          include: {
            user: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.drone.count({ where })
  ]);
  
  // Transform drones for frontend
  const transformedDrones = drones.map(transformDroneResponse);
  
  return {
    drones: transformedDrones,
    totalCount,
    pages: Math.ceil(totalCount / limit),
    currentPage: page
  };
};

/**
 * Get single drone by ID
 */
export const getDroneById = async (droneId: string) => {
  const drone = await prisma.drone.findUnique({
    where: { id: droneId },
    include: {
      region: true,
      operator: true,
      userAssignments: {
        include: {
          user: true
        }
      }
    }
  });

  if (!drone) {
    return null;
  }

  return transformDroneResponse(drone);
};

/**
 * Assign drone to a user (many-to-many relationship)
 */
export const assignDroneToUser = async (droneId: string, userId: string) => {
  logger.info(`Assigning drone ${droneId} to user ${userId}`);

  // Validate drone exists
  const drone = await prisma.drone.findUnique({
    where: { id: droneId }
  });
  
  if (!drone) {
    throw new Error('Drone not found');
  }

  // Validate user exists
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });
  
  if (!user) {
    throw new Error('User not found');
  }

  if (user.status !== 'ACTIVE') {
    throw new Error(`Cannot assign drone to inactive user: ${user.username}`);
  }

  // Check region compatibility
  if (drone.regionId && user.regionId && drone.regionId !== user.regionId) {
    throw new Error('User must be in the same region as the drone');
  }

  try {
    // Create assignment (ignore if already exists)
    await prisma.userDroneAssignment.upsert({
      where: {
        userId_droneId: {
          userId,
          droneId
        }
      },
      update: {
        assignedAt: new Date()
      },
      create: {
        userId,
        droneId,
        assignedAt: new Date()
      }
    });

    logger.info(`✅ Drone ${droneId} assigned to user ${userId}`);

    return { success: true };

  } catch (error) {
    logger.error('Error assigning drone to user:', error);
    throw error;
  }
};

/**
 * Unassign drone from a user
 */
export const unassignDroneFromUser = async (droneId: string, userId: string) => {
  logger.info(`Unassigning drone ${droneId} from user ${userId}`);

  try {
    await prisma.userDroneAssignment.deleteMany({
      where: {
        userId,
        droneId
      }
    });

    logger.info(`✅ Drone ${droneId} unassigned from user ${userId}`);

    return { success: true };

  } catch (error) {
    logger.error('Error unassigning drone from user:', error);
    throw error;
  }
};

/**
 * Transform drone data for consistent API response
 */
const transformDroneResponse = (drone: any) => {
  return {
    id: drone.id,
    model: drone.model,
    status: drone.status,
    regionId: drone.regionId,
    operatorId: drone.operatorId,
    createdAt: drone.createdAt.toISOString(),
    updatedAt: drone.updatedAt.toISOString(),
    region: drone.region ? {
      id: drone.region.id,
      name: drone.region.name,
      area: drone.region.area
    } : null,
    operator: drone.operator ? {
      id: drone.operator.id,
      username: drone.operator.username,
      fullName: drone.operator.fullName
    } : null,
    assignedUsers: drone.userAssignments?.map((assignment: any) => assignment.user.id) || []
  };
};
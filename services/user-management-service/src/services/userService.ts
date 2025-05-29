// services/user-management-service/src/services/userService.ts - COMPLETE FIXED VERSION
import { prisma } from '../database';
import { logger } from '../utils/logger';
import {
  createSupabaseUser,
  updateSupabaseUser,
  deleteSupabaseUser,
  CreateUserData
} from './supabaseSync';

// Input Types
export interface CreateUserInput {
  username: string;
  fullName: string;
  email: string;
  password: string;
  role: 'MAIN_HQ' | 'REGIONAL_HQ' | 'OPERATOR';
  regionId?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface UpdateUserInput {
  username?: string;
  fullName?: string;
  email?: string;
  role?: 'MAIN_HQ' | 'REGIONAL_HQ' | 'OPERATOR';
  regionId?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface GetUsersOptions {
  page: number;
  limit: number;
  role?: string;
  regionId?: string;
  status?: string;
  requestingUserRole: string;
  requestingUserRegionId?: string;
}

/**
 * Create a new user (local + Supabase)
 */
export const createUser = async (userData: CreateUserInput) => {
  logger.info(`Creating user: ${userData.username} (${userData.role})`);

  // Validate region exists if provided
  if (userData.regionId) {
    const region = await prisma.region.findUnique({
      where: { id: userData.regionId }
    });
    
    if (!region) {
      throw new Error(`Region with ID ${userData.regionId} not found`);
    }
    
    if (region.status !== 'ACTIVE') {
      throw new Error(`Cannot assign user to inactive region: ${region.name}`);
    }
  }

  // Check for existing username
  const existingUsername = await prisma.user.findUnique({
    where: { username: userData.username }
  });
  
  if (existingUsername) {
    throw new Error(`Username '${userData.username}' already exists`);
  }

  // Check for existing email
  const existingEmail = await prisma.user.findUnique({
    where: { email: userData.email }
  });
  
  if (existingEmail) {
    throw new Error(`Email '${userData.email}' already exists`);
  }

  let supabaseUser = null;
  let localUser = null;

  try {
    // Step 1: Create user in Supabase Auth
    const supabaseUserData: CreateUserData = {
      email: userData.email,
      password: userData.password,
      username: userData.username,
      role: userData.role,
      regionId: userData.regionId,
      fullName: userData.fullName
    };
    
    supabaseUser = await createSupabaseUser(supabaseUserData);
    logger.info(`✅ Supabase user created: ${supabaseUser.id}`);

    // Step 2: Create user in local database
    localUser = await prisma.user.create({
      data: {
        username: userData.username,
        fullName: userData.fullName,
        email: userData.email,
        role: userData.role as any,
        regionId: userData.regionId || null,
        status: userData.status || 'ACTIVE',
        supabaseUserId: supabaseUser.id
      },
      include: {
        region: true,
        droneAssignments: {
          include: {
            drone: true
          }
        }
      }
    });

    logger.info(`✅ Local user created: ${localUser.id}`);

    // Transform response to match frontend expectations
    return {
      id: localUser.id,
      username: localUser.username,
      fullName: localUser.fullName,
      email: localUser.email,
      role: localUser.role,
      regionId: localUser.regionId,
      status: localUser.status,
      createdAt: localUser.createdAt.toISOString(),
      assignedDrones: localUser.droneAssignments.map(a => a.drone.id),
      region: localUser.region ? {
        id: localUser.region.id,
        name: localUser.region.name,
        area: localUser.region.area
      } : null
    };

  } catch (error) {
    logger.error('Error creating user:', error);

    // Cleanup on failure
    if (supabaseUser?.id && !localUser) {
      logger.warn('Cleaning up Supabase user due to local creation failure');
      await deleteSupabaseUser(supabaseUser.id);
    }

    throw error;
  }
};

/**
 * Update an existing user
 */
export const updateUser = async (userId: string, updateData: UpdateUserInput) => {
  logger.info(`Updating user: ${userId}`);

  // Get existing user
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { region: true }
  });

  if (!existingUser) {
    throw new Error('User not found');
  }

  // Validate region exists if changing
  if (updateData.regionId && updateData.regionId !== existingUser.regionId) {
    const region = await prisma.region.findUnique({
      where: { id: updateData.regionId }
    });
    
    if (!region) {
      throw new Error(`Region with ID ${updateData.regionId} not found`);
    }
    
    if (region.status !== 'ACTIVE') {
      throw new Error(`Cannot assign user to inactive region: ${region.name}`);
    }
  }

  // Check for username conflicts if changing
  if (updateData.username && updateData.username !== existingUser.username) {
    const usernameConflict = await prisma.user.findUnique({
      where: { username: updateData.username }
    });
    
    if (usernameConflict) {
      throw new Error(`Username '${updateData.username}' already exists`);
    }
  }

  // Check for email conflicts if changing
  if (updateData.email && updateData.email !== existingUser.email) {
    const emailConflict = await prisma.user.findUnique({
      where: { email: updateData.email }
    });
    
    if (emailConflict) {
      throw new Error(`Email '${updateData.email}' already exists`);
    }
  }

  try {
    // Step 1: Update Supabase user metadata
    if (existingUser.supabaseUserId) {
      await updateSupabaseUser(existingUser.supabaseUserId, {
        username: updateData.username,
        role: updateData.role,
        regionId: updateData.regionId,
        fullName: updateData.fullName,
        email: updateData.email
      });
      logger.info(`✅ Supabase user updated: ${existingUser.supabaseUserId}`);
    }

    // Step 2: Update local user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(updateData.username !== undefined && { username: updateData.username }),
        ...(updateData.fullName !== undefined && { fullName: updateData.fullName }),
        ...(updateData.email !== undefined && { email: updateData.email }),
        ...(updateData.role !== undefined && { role: updateData.role as any }),
        ...(updateData.regionId !== undefined && { regionId: updateData.regionId }),
        ...(updateData.status !== undefined && { status: updateData.status as any }),
        updatedAt: new Date()
      },
      include: {
        region: true,
        droneAssignments: {
          include: {
            drone: true
          }
        }
      }
    });

    logger.info(`✅ Local user updated: ${updatedUser.id}`);

    // Transform response
    return {
      id: updatedUser.id,
      username: updatedUser.username,
      fullName: updatedUser.fullName,
      email: updatedUser.email,
      role: updatedUser.role,
      regionId: updatedUser.regionId,
      status: updatedUser.status,
      createdAt: updatedUser.createdAt.toISOString(),
      updatedAt: updatedUser.updatedAt.toISOString(),
      assignedDrones: updatedUser.droneAssignments.map(a => a.drone.id),
      region: updatedUser.region ? {
        id: updatedUser.region.id,
        name: updatedUser.region.name,
        area: updatedUser.region.area
      } : null
    };

  } catch (error) {
    logger.error('Error updating user:', error);
    throw error;
  }
};

/**
 * Delete a user (local + Supabase)
 */
export const deleteUser = async (userId: string) => {
  logger.info(`Deleting user: ${userId}`);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      droneAssignments: true,
      operatedDrones: true
    }
  });

  if (!user) {
    throw new Error('User not found');
  }

  try {
    // Step 1: Unassign all drones
    const droneUnassignments = await prisma.$transaction([
      // Remove drone assignments
      prisma.userDroneAssignment.deleteMany({
        where: { userId }
      }),
      // Clear operator assignments
      prisma.drone.updateMany({
        where: { operatorId: userId },
        data: { operatorId: null }
      })
    ]);

    logger.info(`✅ Unassigned ${user.droneAssignments.length} drone assignments and ${user.operatedDrones.length} operated drones`);

    // Step 2: Delete local user
    await prisma.user.delete({
      where: { id: userId }
    });

    logger.info(`✅ Local user deleted: ${userId}`);

    // Step 3: Delete Supabase user
    if (user.supabaseUserId) {
      await deleteSupabaseUser(user.supabaseUserId);
      logger.info(`✅ Supabase user deleted: ${user.supabaseUserId}`);
    }

    return {
      success: true,
      deletedUser: user.username,
      unassignedDrones: user.droneAssignments.length + user.operatedDrones.length
    };

  } catch (error) {
    logger.error('Error deleting user:', error);
    throw error;
  }
};

/**
 * Get users with role-based filtering
 */
export const getUsers = async (options: GetUsersOptions) => {
  const { page, limit, role, regionId, status, requestingUserRole, requestingUserRegionId } = options;
  
  const skip = (page - 1) * limit;
  
  // Build filters
  const where: any = {};
  
  if (role) where.role = role;
  if (regionId) where.regionId = regionId;
  if (status) where.status = status;
  
  // Role-based access control
  if (requestingUserRole === 'REGIONAL_HQ') {
    where.regionId = requestingUserRegionId;
  }
  // MAIN_HQ can see all users
  // OPERATOR cannot access this endpoint (handled by auth middleware)
  
  const [users, totalCount] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      include: {
        region: true,
        droneAssignments: {
          include: {
            drone: true
          }
        },
        operatedDrones: true
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.user.count({ where })
  ]);
  
  // Transform users for frontend
  const transformedUsers = users.map(user => ({
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    regionId: user.regionId,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    assignedDrones: [
      ...user.droneAssignments.map(a => a.drone.id),
      ...user.operatedDrones.map(d => d.id)
    ],
    assignedOperators: user.role === 'REGIONAL_HQ' ? 
      [] : // TODO: Implement operator assignment logic
      undefined,
    region: user.region ? {
      id: user.region.id,
      name: user.region.name,
      area: user.region.area
    } : null
  }));
  
  return {
    users: transformedUsers,
    totalCount,
    pages: Math.ceil(totalCount / limit),
    currentPage: page
  };
};

/**
 * Get single user by ID
 */
export const getUserById = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      region: true,
      droneAssignments: {
        include: {
          drone: true
        }
      },
      operatedDrones: true
    }
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    regionId: user.regionId,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    assignedDrones: [
      ...user.droneAssignments.map(a => a.drone.id),
      ...user.operatedDrones.map(d => d.id)
    ],
    region: user.region ? {
      id: user.region.id,
      name: user.region.name,
      area: user.region.area
    } : null
  };
};
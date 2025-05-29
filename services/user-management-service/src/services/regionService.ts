// src/services/regionService.ts - Enhanced with auto-sync
import { prisma } from '../database';
import { logger } from '../utils/logger';
import { deleteSupabaseUser } from './supabaseSync';
import { syncRegionToSupabase, deleteRegionFromSupabase, deleteUserFromSupabase } from './supabaseDataSync';

// Keep existing interfaces...
export interface CreateRegionInput {
  name: string;
  area: string;
  commanderName?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface UpdateRegionInput {
  name?: string;
  area?: string;
  commanderName?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
}

/**
 * Create region with Supabase sync
 */
export const createRegion = async (regionData: CreateRegionInput) => {
  logger.info(`Creating region: ${regionData.name}`);

  const existingRegion = await prisma.region.findFirst({
    where: { name: regionData.name }
  });
  
  if (existingRegion) {
    throw new Error(`Region name '${regionData.name}' already exists`);
  }

  try {
    const newRegion = await prisma.region.create({
      data: {
        name: regionData.name,
        area: regionData.area,
        commanderName: regionData.commanderName,
        status: regionData.status || 'ACTIVE'
      }
    });

    // Sync to Supabase
    await syncRegionToSupabase(newRegion);

    logger.info(`✅ Region created and synced: ${newRegion.name}`);

    return await getRegionWithStats(newRegion.id);

  } catch (error) {
    logger.error('Error creating region:', error);
    throw error;
  }
};

/**
 * Update region with Supabase sync
 */
export const updateRegion = async (regionId: string, updateData: UpdateRegionInput) => {
  logger.info(`Updating region: ${regionId}`);

  const existingRegion = await prisma.region.findUnique({
    where: { id: regionId }
  });

  if (!existingRegion) {
    throw new Error('Region not found');
  }

  if (updateData.name && updateData.name !== existingRegion.name) {
    const nameConflict = await prisma.region.findFirst({
      where: { 
        name: updateData.name,
        NOT: { id: regionId }
      }
    });
    
    if (nameConflict) {
      throw new Error(`Region name '${updateData.name}' already exists`);
    }
  }

  try {
    const updatedRegion = await prisma.region.update({
      where: { id: regionId },
      data: {
        ...(updateData.name !== undefined && { name: updateData.name }),
        ...(updateData.area !== undefined && { area: updateData.area }),
        ...(updateData.commanderName !== undefined && { commanderName: updateData.commanderName }),
        ...(updateData.status !== undefined && { status: updateData.status as any }),
        updatedAt: new Date()
      }
    });

    // Sync to Supabase
    await syncRegionToSupabase(updatedRegion);

    logger.info(`✅ Region updated and synced: ${updatedRegion.name}`);

    return await getRegionWithStats(updatedRegion.id);

  } catch (error) {
    logger.error('Error updating region:', error);
    throw error;
  }
};

/**
 * Delete region with complete cleanup and sync
 */
export const deleteRegion = async (regionId: string) => {
  logger.info(`Deleting region: ${regionId}`);

  const region = await prisma.region.findUnique({
    where: { id: regionId },
    include: {
      users: true,
      drones: true
    }
  });

  if (!region) {
    throw new Error('Region not found');
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Delete users in the region
      const usersToDelete = region.users;
      let deletedUsersCount = 0;

      for (const user of usersToDelete) {
        // Delete drone assignments
        await tx.userDroneAssignment.deleteMany({
          where: { userId: user.id }
        });

        // Clear operator assignments
        await tx.drone.updateMany({
          where: { operatorId: user.id },
          data: { operatorId: null }
        });

        // Delete user from local DB
        await tx.user.delete({
          where: { id: user.id }
        });

        // Delete from Supabase Auth (non-blocking)
        if (user.supabaseUserId) {
          deleteSupabaseUser(user.supabaseUserId).catch(error => {
            logger.warn(`Failed to delete Supabase user ${user.supabaseUserId}:`, error);
          });
        }

        // Delete from Supabase profiles (non-blocking)
        deleteUserFromSupabase(user.id).catch(error => {
          logger.warn(`Failed to delete user from Supabase profiles:`, error);
        });

        deletedUsersCount++;
      }

      // Unassign drones
      const dronesInRegion = region.drones;
      await tx.drone.updateMany({
        where: { regionId },
        data: { 
          regionId: null,
          operatorId: null
        }
      });

      // Delete the region
      await tx.region.delete({
        where: { id: regionId }
      });

      return {
        deletedUsers: deletedUsersCount,
        unassignedDrones: dronesInRegion.length,
        regionName: region.name
      };
    });

    // Delete from Supabase regions table
    await deleteRegionFromSupabase(regionId);

    logger.info(`✅ Region deleted and synced: ${region.name}`);

    return {
      success: true,
      deletedUsers: result.deletedUsers,
      unassignedDrones: result.unassignedDrones,
      regionName: result.regionName
    };

  } catch (error) {
    logger.error('Error deleting region:', error);
    throw error;
  }
};

/**
 * Get all regions with statistics
 */
export const getRegions = async () => {
  const regions = await prisma.region.findMany({
    include: {
      users: true,
      drones: true
    },
    orderBy: { name: 'asc' }
  });

  return regions.map(region => ({
    id: region.id,
    name: region.name,
    area: region.area,
    commanderName: region.commanderName,
    status: region.status,
    createdAt: region.createdAt.toISOString(),
    updatedAt: region.updatedAt.toISOString(),
    userCount: region.users.length,
    droneCount: region.drones.length,
    users: region.users.map(user => ({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      status: user.status
    })),
    drones: region.drones.map(drone => ({
      id: drone.id,
      model: drone.model,
      status: drone.status
    }))
  }));
};

/**
 * Get single region by ID with statistics
 */
export const getRegionById = async (regionId: string) => {
  return await getRegionWithStats(regionId);
};

/**
 * Helper function to get region with full statistics
 */
const getRegionWithStats = async (regionId: string) => {
  const region = await prisma.region.findUnique({
    where: { id: regionId },
    include: {
      users: {
        orderBy: { username: 'asc' }
      },
      drones: {
        orderBy: { id: 'asc' }
      }
    }
  });

  if (!region) {
    return null;
  }

  return {
    id: region.id,
    name: region.name,
    area: region.area,
    commanderName: region.commanderName,
    status: region.status,
    createdAt: region.createdAt.toISOString(),
    updatedAt: region.updatedAt.toISOString(),
    userCount: region.users.length,
    droneCount: region.drones.length,
    users: region.users.map(user => ({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      status: user.status
    })),
    drones: region.drones.map(drone => ({
      id: drone.id,
      model: drone.model,
      status: drone.status
    }))
  };
};
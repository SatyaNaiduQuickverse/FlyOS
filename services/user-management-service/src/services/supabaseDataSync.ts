// src/services/supabaseDataSync.ts - COMPLETE PRODUCTION VERSION
import { createClient } from '@supabase/supabase-js';
import { prisma } from '../database';
import { logger } from '../utils/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Map Supabase drone model names to Prisma enum values
 */
const mapDroneModel = (supabaseModel: string): any => {
  const modelMap: { [key: string]: string } = {
    // Legacy drone names from Supabase
    'MQ-9 Reaper': 'FlyOS_MQ9',
    'MQ-1 Predator': 'FlyOS_MQ5',
    'RQ-4 Global Hawk': 'FlyOS_MQ7',
    'RQ-170 Sentinel': 'FlyOS_MQ7',
    // Direct FlyOS mappings
    'FlyOS-MQ5': 'FlyOS_MQ5',
    'FlyOS-MQ7': 'FlyOS_MQ7',
    'FlyOS-MQ9': 'FlyOS_MQ9',
    // Prisma enum format
    'FlyOS_MQ5': 'FlyOS_MQ5',
    'FlyOS_MQ7': 'FlyOS_MQ7',
    'FlyOS_MQ9': 'FlyOS_MQ9'
  };
  
  return modelMap[supabaseModel] || 'FlyOS_MQ5';
};

/**
 * Map Supabase status to Prisma enum values
 */
const mapDroneStatus = (supabaseStatus: string): any => {
  const validStatuses = ['ACTIVE', 'STANDBY', 'MAINTENANCE', 'OFFLINE'];
  return validStatuses.includes(supabaseStatus) ? supabaseStatus : 'STANDBY';
};

/**
 * Map user role to Prisma enum values
 */
const mapUserRole = (supabaseRole: string): any => {
  const validRoles = ['MAIN_HQ', 'REGIONAL_HQ', 'OPERATOR'];
  return validRoles.includes(supabaseRole) ? supabaseRole : 'OPERATOR';
};

/**
 * Sync local user to Supabase profiles table
 */
export const syncUserToSupabase = async (localUser: any) => {
  try {
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: localUser.id,
        username: localUser.username,
        full_name: localUser.fullName,
        email: localUser.email,
        role: localUser.role,
        region_id: localUser.regionId,
        status: localUser.status,
        supabase_user_id: localUser.supabaseUserId,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
    logger.debug(`✅ Synced user to Supabase: ${localUser.username}`);
  } catch (error: any) {
    logger.warn(`⚠️ Failed to sync user ${localUser.username}:`, error.message);
  }
};

/**
 * Sync local region to Supabase regions table
 */
export const syncRegionToSupabase = async (localRegion: any) => {
  try {
    const { error } = await supabase
      .from('regions')
      .upsert({
        id: localRegion.id,
        name: localRegion.name,
        area: localRegion.area,
        commander_name: localRegion.commanderName,
        status: localRegion.status,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
    logger.debug(`✅ Synced region to Supabase: ${localRegion.name}`);
  } catch (error: any) {
    logger.warn(`⚠️ Failed to sync region ${localRegion.name}:`, error.message);
  }
};

/**
 * Sync local drone to Supabase drones table
 */
export const syncDroneToSupabase = async (localDrone: any) => {
  try {
    const { error } = await supabase
      .from('drones')
      .upsert({
        id: localDrone.id,
        model: localDrone.model,
        status: localDrone.status,
        region_id: localDrone.regionId,
        operator_id: localDrone.operatorId,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
    logger.debug(`✅ Synced drone to Supabase: ${localDrone.id}`);
  } catch (error: any) {
    logger.warn(`⚠️ Failed to sync drone ${localDrone.id}:`, error.message);
  }
};

/**
 * Delete user from Supabase profiles
 */
export const deleteUserFromSupabase = async (userId: string) => {
  try {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (error) throw error;
    logger.debug(`✅ Deleted user from Supabase: ${userId}`);
  } catch (error: any) {
    logger.warn(`⚠️ Failed to delete user from Supabase:`, error.message);
  }
};

/**
 * Delete region from Supabase
 */
export const deleteRegionFromSupabase = async (regionId: string) => {
  try {
    const { error } = await supabase
      .from('regions')
      .delete()
      .eq('id', regionId);

    if (error) throw error;
    logger.debug(`✅ Deleted region from Supabase: ${regionId}`);
  } catch (error: any) {
    logger.warn(`⚠️ Failed to delete region from Supabase:`, error.message);
  }
};

/**
 * Delete drone from Supabase
 */
export const deleteDroneFromSupabase = async (droneId: string) => {
  try {
    const { error } = await supabase
      .from('drones')
      .delete()
      .eq('id', droneId);

    if (error) throw error;
    logger.debug(`✅ Deleted drone from Supabase: ${droneId}`);
  } catch (error: any) {
    logger.warn(`⚠️ Failed to delete drone from Supabase:`, error.message);
  }
};

/**
 * Sync user-drone assignments to Supabase
 */
export const syncAssignmentsToSupabase = async (assignments: any[]) => {
  if (!assignments.length) return;

  try {
    const { error } = await supabase
      .from('user_drone_assignments')
      .upsert(assignments.map(a => ({
        id: a.id,
        user_id: a.userId,
        drone_id: a.droneId,
        assigned_at: a.assignedAt
      })));

    if (error) throw error;
    logger.debug(`✅ Synced ${assignments.length} assignments to Supabase`);
  } catch (error: any) {
    logger.warn(`⚠️ Failed to sync assignments:`, error.message);
  }
};

/**
 * Load all data from Supabase and recreate in local DB - PRODUCTION VERSION
 */
export const loadAllDataFromSupabase = async () => {
  try {
    logger.info('🔄 Loading data from Supabase...');

    // Load regions first (no dependencies)
    const { data: supabaseRegions } = await supabase
      .from('regions')
      .select('*')
      .order('created_at');

    if (supabaseRegions?.length) {
      for (const region of supabaseRegions) {
        try {
          await prisma.region.upsert({
            where: { id: region.id },
            update: {
              name: region.name,
              area: region.area,
              commanderName: region.commander_name,
              status: region.status === 'ACTIVE' ? 'ACTIVE' as any : 'INACTIVE' as any
            },
            create: {
              id: region.id,
              name: region.name,
              area: region.area,
              commanderName: region.commander_name,
              status: region.status === 'ACTIVE' ? 'ACTIVE' as any : 'INACTIVE' as any
            }
          });
        } catch (regionError: any) {
          logger.error(`Failed to create region ${region.id}:`, regionError.message);
        }
      }
      logger.info(`✅ Loaded ${supabaseRegions.length} regions`);
    }

    // Load users with validation
    const { data: supabaseUsers } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at');

    let loadedUsers = 0;
    if (supabaseUsers?.length) {
      for (const user of supabaseUsers) {
        // Skip users without required fields
        if (!user.email || !user.username) {
          logger.warn(`⚠️ Skipping incomplete user: ${user.username || user.id} (missing email or username)`);
          continue;
        }

        try {
          await prisma.user.upsert({
            where: { id: user.id },
            update: {
              username: user.username,
              fullName: user.full_name || 'User',
              email: user.email,
              role: mapUserRole(user.role) as any,
              regionId: user.region_id,
              status: user.status === 'ACTIVE' ? 'ACTIVE' as any : 'INACTIVE' as any,
              supabaseUserId: user.supabase_user_id
            },
            create: {
              id: user.id,
              username: user.username,
              fullName: user.full_name || 'User',
              email: user.email,
              role: mapUserRole(user.role) as any,
              regionId: user.region_id,
              status: user.status === 'ACTIVE' ? 'ACTIVE' as any : 'INACTIVE' as any,
              supabaseUserId: user.supabase_user_id
            }
          });
          loadedUsers++;
        } catch (userError: any) {
          logger.error(`Failed to create user ${user.username}:`, userError.message);
        }
      }
      logger.info(`✅ Loaded ${loadedUsers} users`);
    }

    // Load drones with model mapping
    const { data: supabaseDrones } = await supabase
      .from('drones')
      .select('*')
      .order('created_at');

    let loadedDrones = 0;
    if (supabaseDrones?.length) {
      for (const drone of supabaseDrones) {
        try {
          await prisma.drone.upsert({
            where: { id: drone.id },
            update: {
              model: mapDroneModel(drone.model) as any,
              status: mapDroneStatus(drone.status) as any,
              regionId: drone.region_id,
              operatorId: drone.operator_id
            },
            create: {
              id: drone.id,
              model: mapDroneModel(drone.model) as any,
              status: mapDroneStatus(drone.status) as any,
              regionId: drone.region_id,
              operatorId: drone.operator_id
            }
          });
          loadedDrones++;
        } catch (droneError: any) {
          logger.error(`Failed to create drone ${drone.id}:`, droneError.message);
        }
      }
      logger.info(`✅ Loaded ${loadedDrones} drones`);
    }

    // Load assignments
    const { data: supabaseAssignments } = await supabase
      .from('user_drone_assignments')
      .select('*');

    let loadedAssignments = 0;
    if (supabaseAssignments?.length) {
      for (const assignment of supabaseAssignments) {
        try {
          await prisma.userDroneAssignment.upsert({
            where: {
              userId_droneId: {
                userId: assignment.user_id,
                droneId: assignment.drone_id
              }
            },
            update: {
              assignedAt: new Date(assignment.assigned_at)
            },
            create: {
              id: assignment.id,
              userId: assignment.user_id,
              droneId: assignment.drone_id,
              assignedAt: new Date(assignment.assigned_at)
            }
          });
          loadedAssignments++;
        } catch (assignmentError: any) {
          logger.debug(`Skipped invalid assignment: ${assignment.id}`);
        }
      }
      logger.info(`✅ Loaded ${loadedAssignments} assignments`);
    }

    return {
      regions: supabaseRegions?.length || 0,
      users: loadedUsers,
      drones: loadedDrones,
      assignments: loadedAssignments
    };

  } catch (error: any) {
    logger.error('❌ Failed to load from Supabase:', error);
    throw error;
  }
};

/**
 * Push all local data to Supabase
 */
export const pushAllDataToSupabase = async () => {
  try {
    logger.info('📤 Pushing local data to Supabase...');

    const [regions, users, drones, assignments] = await Promise.all([
      prisma.region.findMany(),
      prisma.user.findMany(),
      prisma.drone.findMany(),
      prisma.userDroneAssignment.findMany()
    ]);

    // Push in sequence to handle dependencies
    for (const region of regions) {
      await syncRegionToSupabase(region);
    }

    for (const user of users) {
      await syncUserToSupabase(user);
    }

    for (const drone of drones) {
      await syncDroneToSupabase(drone);
    }

    await syncAssignmentsToSupabase(assignments);

    logger.info('✅ All data pushed to Supabase');
    return {
      regions: regions.length,
      users: users.length,
      drones: drones.length,
      assignments: assignments.length
    };

  } catch (error: any) {
    logger.error('❌ Failed to push to Supabase:', error);
    throw error;
  }
};

/**
 * Initialize with Supabase sync - PRODUCTION VERSION
 */
export const initializeWithSupabaseSync = async () => {
  try {
    logger.info('🚀 Initializing with Supabase sync...');

    // Try to load existing data first
    const loaded = await loadAllDataFromSupabase();
    
    if (loaded.users > 0 || loaded.regions > 0) {
      logger.info(`✅ Restored from Supabase: ${loaded.users} users, ${loaded.regions} regions, ${loaded.drones} drones`);
      return loaded;
    }

    // No data in Supabase, create initial dataset
    logger.info('🆕 Creating initial dataset...');
    
    // Create regions first
    const regionsData = [
      { id: 'east-region', name: 'Eastern Region', area: 'Eastern Seaboard', commanderName: 'Col. Sarah Mitchell', status: 'ACTIVE' as any },
      { id: 'west-region', name: 'Western Region', area: 'Pacific Coast', commanderName: 'Maj. David Chen', status: 'ACTIVE' as any },
      { id: 'south-region', name: 'Southern Region', area: 'Gulf Coast', commanderName: 'Col. Robert Garcia', status: 'ACTIVE' as any }
    ];

    for (const regionData of regionsData) {
      const region = await prisma.region.upsert({
        where: { id: regionData.id },
        update: regionData,
        create: regionData
      });
      await syncRegionToSupabase(region);
    }

    // Create users with proper emails
    const usersData = [
      { username: 'main_admin', fullName: 'Main Administrator', email: 'main@flyos.mil', role: 'MAIN_HQ' as any, regionId: null },
      { username: 'region_east', fullName: 'Col. Sarah Mitchell', email: 'east@flyos.mil', role: 'REGIONAL_HQ' as any, regionId: 'east-region' },
      { username: 'region_west', fullName: 'Maj. David Chen', email: 'west@flyos.mil', role: 'REGIONAL_HQ' as any, regionId: 'west-region' },
      { username: 'operator1', fullName: 'Lt. Michael Rodriguez', email: 'operator1@flyos.mil', role: 'OPERATOR' as any, regionId: 'east-region' },
      { username: 'operator2', fullName: 'Lt. Jessica Kim', email: 'operator2@flyos.mil', role: 'OPERATOR' as any, regionId: 'east-region' }
    ];

    for (const userData of usersData) {
      const user = await prisma.user.upsert({
        where: { email: userData.email },
        update: { ...userData, status: 'ACTIVE' as any },
        create: { ...userData, status: 'ACTIVE' as any }
      });
      await syncUserToSupabase(user);
    }

    // Create initial drones with proper models
    const dronesData = [
      { id: 'drone-001', model: 'FlyOS_MQ5' as any, status: 'ACTIVE' as any, regionId: 'east-region', operatorId: null },
      { id: 'drone-002', model: 'FlyOS_MQ7' as any, status: 'STANDBY' as any, regionId: 'west-region', operatorId: null },
      { id: 'drone-003', model: 'FlyOS_MQ9' as any, status: 'MAINTENANCE' as any, regionId: 'south-region', operatorId: null }
    ];

    for (const droneData of dronesData) {
      const drone = await prisma.drone.upsert({
        where: { id: droneData.id },
        update: droneData,
        create: droneData
      });
      await syncDroneToSupabase(drone);
    }

    const created = {
      regions: regionsData.length,
      users: usersData.length,
      drones: dronesData.length,
      assignments: 0
    };

    logger.info(`✅ Created and synced initial data: ${created.users} users, ${created.regions} regions, ${created.drones} drones`);
    return created;

  } catch (error: any) {
    logger.error('❌ Initialization failed:', error);
    throw error;
  }
};
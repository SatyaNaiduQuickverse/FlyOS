// src/services/supabaseDataSync.ts
import { createClient } from '@supabase/supabase-js';
import { prisma } from '../database';
import { logger } from '../utils/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    // Don't throw - local operations should continue
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
 * Load all data from Supabase and recreate in local DB
 */
export const loadAllDataFromSupabase = async () => {
  try {
    logger.info('🔄 Loading data from Supabase...');

    // Load regions first
    const { data: supabaseRegions } = await supabase
      .from('regions')
      .select('*')
      .order('created_at');

    if (supabaseRegions?.length) {
      for (const region of supabaseRegions) {
        await prisma.region.upsert({
          where: { id: region.id },
          update: {
            name: region.name,
            area: region.area,
            commanderName: region.commander_name,
            status: region.status as any
          },
          create: {
            id: region.id,
            name: region.name,
            area: region.area,
            commanderName: region.commander_name,
            status: region.status as any
          }
        });
      }
      logger.info(`✅ Loaded ${supabaseRegions.length} regions`);
    }

    // Load users
    const { data: supabaseUsers } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at');

    if (supabaseUsers?.length) {
      for (const user of supabaseUsers) {
        await prisma.user.upsert({
          where: { id: user.id },
          update: {
            username: user.username,
            fullName: user.full_name,
            email: user.email,
            role: user.role as any,
            regionId: user.region_id,
            status: user.status as any,
            supabaseUserId: user.supabase_user_id
          },
          create: {
            id: user.id,
            username: user.username,
            fullName: user.full_name,
            email: user.email,
            role: user.role as any,
            regionId: user.region_id,
            status: user.status as any,
            supabaseUserId: user.supabase_user_id
          }
        });
      }
      logger.info(`✅ Loaded ${supabaseUsers.length} users`);
    }

    // Load drones
    const { data: supabaseDrones } = await supabase
      .from('drones')
      .select('*')
      .order('created_at');

    if (supabaseDrones?.length) {
      for (const drone of supabaseDrones) {
        await prisma.drone.upsert({
          where: { id: drone.id },
          update: {
            model: drone.model as any,
            status: drone.status as any,
            regionId: drone.region_id,
            operatorId: drone.operator_id
          },
          create: {
            id: drone.id,
            model: drone.model as any,
            status: drone.status as any,
            regionId: drone.region_id,
            operatorId: drone.operator_id
          }
        });
      }
      logger.info(`✅ Loaded ${supabaseDrones.length} drones`);
    }

    // Load assignments
    const { data: supabaseAssignments } = await supabase
      .from('user_drone_assignments')
      .select('*');

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
        } catch (error) {
          // Skip invalid assignments
          logger.debug(`Skipped invalid assignment: ${assignment.id}`);
        }
      }
      logger.info(`✅ Loaded ${supabaseAssignments.length} assignments`);
    }

    return {
      regions: supabaseRegions?.length || 0,
      users: supabaseUsers?.length || 0,
      drones: supabaseDrones?.length || 0,
      assignments: supabaseAssignments?.length || 0
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
 * Initialize with Supabase sync - try to load, fallback to create
 */
export const initializeWithSupabaseSync = async () => {
  try {
    logger.info('🚀 Initializing with Supabase sync...');

    // Try to load existing data
    const loaded = await loadAllDataFromSupabase();
    
    if (loaded.users > 0) {
      logger.info(`✅ Restored from Supabase: ${loaded.users} users, ${loaded.regions} regions, ${loaded.drones} drones`);
      return loaded;
    }

    // No data in Supabase, create initial dataset
    logger.info('🆕 Creating initial dataset...');
    
    // Create regions first
    const regions = [
      { id: 'east-region', name: 'Eastern Region', area: 'Eastern Seaboard', commanderName: 'Col. Sarah Mitchell', status: 'ACTIVE' as const },
      { id: 'west-region', name: 'Western Region', area: 'Pacific Coast', commanderName: 'Maj. David Chen', status: 'ACTIVE' as const },
      { id: 'south-region', name: 'Southern Region', area: 'Gulf Coast', commanderName: 'Col. Robert Garcia', status: 'ACTIVE' as const }
    ];

    for (const regionData of regions) {
      const region = await prisma.region.create({ data: regionData });
      await syncRegionToSupabase(region);
    }

    // Create users
    const users = [
      { username: 'main_admin', fullName: 'Main Administrator', email: 'main@flyos.mil', role: 'MAIN_HQ' as const, regionId: null },
      { username: 'region_east', fullName: 'Col. Sarah Mitchell', email: 'east@flyos.mil', role: 'REGIONAL_HQ' as const, regionId: 'east-region' },
      { username: 'region_west', fullName: 'Maj. David Chen', email: 'west@flyos.mil', role: 'REGIONAL_HQ' as const, regionId: 'west-region' }
    ];

    for (const userData of users) {
      const user = await prisma.user.create({
        data: { ...userData, status: 'ACTIVE' }
      });
      await syncUserToSupabase(user);
    }

    // Create initial drones
    const drones = [
      { id: 'drone-001', model: 'FlyOS_MQ5' as const, status: 'ACTIVE' as const, regionId: 'east-region', operatorId: null },
      { id: 'drone-002', model: 'FlyOS_MQ7' as const, status: 'STANDBY' as const, regionId: 'west-region', operatorId: null }
    ];

    for (const droneData of drones) {
      const drone = await prisma.drone.create({ data: droneData });
      await syncDroneToSupabase(drone);
    }

    const created = {
      regions: regions.length,
      users: users.length,
      drones: drones.length,
      assignments: 0
    };

    logger.info(`✅ Created and synced initial data: ${created.users} users, ${created.regions} regions, ${created.drones} drones`);
    return created;

  } catch (error: any) {
    logger.error('❌ Initialization failed:', error);
    throw error;
  }
};
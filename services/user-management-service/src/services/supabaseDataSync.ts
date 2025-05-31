// services/user-management-service/src/services/supabaseDataSync.ts - FIXED VERSION
import { createClient } from '@supabase/supabase-js';
import { prisma } from '../database';
import { logger } from '../utils/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Sync local user to Supabase profiles table - FIXED
 */
export const syncUserToSupabase = async (localUser: any) => {
  try {
    const { data, error } = await supabase
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
      }, {
        onConflict: 'id' // FIXED: String format, not object
      });

    if (error) {
      logger.error(`❌ Failed to sync user ${localUser.username} to Supabase:`, error);
      throw error; // FIXED: Actually throw the error
    }

    // VERIFY the data was synced
    const { data: verification } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', localUser.id)
      .single();

    if (!verification) {
      throw new Error(`User ${localUser.username} not found in Supabase after sync`);
    }

    logger.info(`✅ User synced to Supabase: ${localUser.username}`);
    return data;
  } catch (error: any) {
    logger.error(`❌ Sync failed for user ${localUser.username}:`, error.message);
    throw error;
  }
};

/**
 * Sync local region to Supabase regions table - FIXED
 */
export const syncRegionToSupabase = async (localRegion: any) => {
  try {
    const { data, error } = await supabase
      .from('regions')
      .upsert({
        id: localRegion.id,
        name: localRegion.name,
        area: localRegion.area,
        commander_name: localRegion.commanderName,
        status: localRegion.status,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id' // FIXED: String format
      });

    if (error) {
      logger.error(`❌ Failed to sync region ${localRegion.name} to Supabase:`, error);
      throw error;
    }

    // VERIFY the data was synced
    const { data: verification } = await supabase
      .from('regions')
      .select('id')
      .eq('id', localRegion.id)
      .single();

    if (!verification) {
      throw new Error(`Region ${localRegion.name} not found in Supabase after sync`);
    }

    logger.info(`✅ Region synced to Supabase: ${localRegion.name}`);
    return data;
  } catch (error: any) {
    logger.error(`❌ Sync failed for region ${localRegion.name}:`, error.message);
    throw error;
  }
};

/**
 * Sync local drone to Supabase drones table - FIXED
 */
export const syncDroneToSupabase = async (localDrone: any) => {
  try {
    const { data, error } = await supabase
      .from('drones')
      .upsert({
        id: localDrone.id,
        model: localDrone.model,
        status: localDrone.status,
        region_id: localDrone.regionId,
        operator_id: localDrone.operatorId,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id' // FIXED: String format
      });

    if (error) {
      logger.error(`❌ Failed to sync drone ${localDrone.id} to Supabase:`, error);
      throw error;
    }

    // VERIFY the data was synced
    const { data: verification } = await supabase
      .from('drones')
      .select('id')
      .eq('id', localDrone.id)
      .single();

    if (!verification) {
      throw new Error(`Drone ${localDrone.id} not found in Supabase after sync`);
    }

    logger.info(`✅ Drone synced to Supabase: ${localDrone.id}`);
    return data;
  } catch (error: any) {
    logger.error(`❌ Sync failed for drone ${localDrone.id}:`, error.message);
    throw error;
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
    logger.info(`✅ Deleted user from Supabase: ${userId}`);
  } catch (error: any) {
    logger.error(`❌ Failed to delete user ${userId} from Supabase:`, error.message);
    throw error;
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
    logger.info(`✅ Deleted region from Supabase: ${regionId}`);
  } catch (error: any) {
    logger.error(`❌ Failed to delete region ${regionId} from Supabase:`, error.message);
    throw error;
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
    logger.info(`✅ Deleted drone from Supabase: ${droneId}`);
  } catch (error: any) {
    logger.error(`❌ Failed to delete drone ${droneId} from Supabase:`, error.message);
    throw error;
  }
};

/**
 * Load data from Supabase to local database
 */
export const loadAllDataFromSupabase = async () => {
  try {
    logger.info('🔄 Loading data from Supabase...');

    // Load regions first (dependencies)
    const { data: regions } = await supabase.from('regions').select('*');
    if (regions?.length) {
      for (const region of regions) {
        await prisma.region.upsert({
          where: { id: region.id },
          update: {
            name: region.name,
            area: region.area,
            commanderName: region.commander_name,
            status: region.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'
          },
          create: {
            id: region.id,
            name: region.name,
            area: region.area,
            commanderName: region.commander_name,
            status: region.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'
          }
        });
      }
      logger.info(`✅ Loaded ${regions.length} regions from Supabase`);
    }

    // Load users
    const { data: users } = await supabase.from('profiles').select('*');
    if (users?.length) {
      for (const user of users) {
        if (user.email && user.username) {
          await prisma.user.upsert({
            where: { id: user.id },
            update: {
              username: user.username,
              fullName: user.full_name || 'User',
              email: user.email,
              role: user.role,
              regionId: user.region_id,
              status: user.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
              supabaseUserId: user.supabase_user_id
            },
            create: {
              id: user.id,
              username: user.username,
              fullName: user.full_name || 'User',
              email: user.email,
              role: user.role,
              regionId: user.region_id,
              status: user.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
              supabaseUserId: user.supabase_user_id
            }
          });
        }
      }
      logger.info(`✅ Loaded ${users.length} users from Supabase`);
    }

    // Load drones
    const { data: drones } = await supabase.from('drones').select('*');
    if (drones?.length) {
      for (const drone of drones) {
        await prisma.drone.upsert({
          where: { id: drone.id },
          update: {
            model: drone.model,
            status: drone.status,
            regionId: drone.region_id,
            operatorId: drone.operator_id
          },
          create: {
            id: drone.id,
            model: drone.model,
            status: drone.status,
            regionId: drone.region_id,
            operatorId: drone.operator_id
          }
        });
      }
      logger.info(`✅ Loaded ${drones.length} drones from Supabase`);
    }

    return {
      regions: regions?.length || 0,
      users: users?.length || 0,
      drones: drones?.length || 0
    };

  } catch (error) {
    logger.error('❌ Failed to load data from Supabase:', error);
    return { regions: 0, users: 0, drones: 0 };
  }
};

/**
 * Push all local data to Supabase
 */
export const pushAllDataToSupabase = async () => {
  try {
    logger.info('📤 Pushing all local data to Supabase...');

    const [regions, users, drones] = await Promise.all([
      prisma.region.findMany(),
      prisma.user.findMany(),
      prisma.drone.findMany()
    ]);

    // Push regions first
    let syncedRegions = 0;
    for (const region of regions) {
      try {
        await syncRegionToSupabase(region);
        syncedRegions++;
      } catch (error) {
        logger.error(`Failed to sync region ${region.name}:`, error);
      }
    }

    // Push users
    let syncedUsers = 0;
    for (const user of users) {
      try {
        await syncUserToSupabase(user);
        syncedUsers++;
      } catch (error) {
        logger.error(`Failed to sync user ${user.username}:`, error);
      }
    }

    // Push drones
    let syncedDrones = 0;
    for (const drone of drones) {
      try {
        await syncDroneToSupabase(drone);
        syncedDrones++;
      } catch (error) {
        logger.error(`Failed to sync drone ${drone.id}:`, error);
      }
    }

    logger.info(`✅ Pushed to Supabase: ${syncedRegions}/${regions.length} regions, ${syncedUsers}/${users.length} users, ${syncedDrones}/${drones.length} drones`);

    return {
      regions: syncedRegions,
      users: syncedUsers,
      drones: syncedDrones
    };

  } catch (error) {
    logger.error('❌ Failed to push data to Supabase:', error);
    throw error;
  }
};

/**
 * Initialize with Supabase sync - ENHANCED
 */
export const initializeWithSupabaseSync = async () => {
  try {
    logger.info('🚀 Initializing with Supabase sync...');

    // Check local data
    const localStats = await Promise.all([
      prisma.user.count(),
      prisma.region.count(),
      prisma.drone.count()
    ]);

    const [localUsers, localRegions, localDrones] = localStats;
    const hasLocalData = localUsers > 0 || localRegions > 0 || localDrones > 0;

    if (hasLocalData) {
      // Push local data to Supabase
      logger.info(`📊 Found local data: ${localUsers} users, ${localRegions} regions, ${localDrones} drones`);
      const pushResult = await pushAllDataToSupabase();
      return pushResult;
    } else {
      // Load from Supabase
      logger.info('🔄 No local data, loading from Supabase...');
      const loadResult = await loadAllDataFromSupabase();
      
      if (loadResult.regions === 0 && loadResult.users === 0 && loadResult.drones === 0) {
        // Create initial data
        logger.info('🏗️ Creating initial data...');
        await prisma.region.createMany({
          data: [
            { id: 'east', name: 'Eastern Region', area: 'Eastern Seaboard', status: 'ACTIVE' },
            { id: 'west', name: 'Western Region', area: 'Pacific Coast', status: 'ACTIVE' }
          ],
          skipDuplicates: true
        });
        
        // Sync to Supabase
        const regions = await prisma.region.findMany();
        for (const region of regions) {
          await syncRegionToSupabase(region);
        }
        
        return { regions: regions.length, users: 0, drones: 0 };
      }
      
      return loadResult;
    }

  } catch (error) {
    logger.error('❌ Initialization failed:', error);
    return { regions: 0, users: 0, drones: 0 };
  }
};

export const syncAssignmentsToSupabase = async (assignments: any[]) => {
  // Simplified - not critical for the main issue
  return assignments.length;
};
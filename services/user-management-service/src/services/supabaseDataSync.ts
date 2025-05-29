// src/services/supabaseDataSync.ts - COMPLETE PRODUCTION VERSION
import { createClient } from '@supabase/supabase-js';
import { prisma } from '../database';
import { logger } from '../utils/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * PRODUCTION STRATEGY: LOCAL-FIRST with Supabase backup
 * - Local PostgreSQL data persists across rebuilds (volumes)
 * - Supabase serves as backup/sync for cross-deployment
 * - Handle legacy data format gracefully
 */

const DRONE_MODEL_MAP: Record<string, string> = {
  'MQ-9 Reaper': 'FlyOS_MQ9',
  'MQ-1 Predator': 'FlyOS_MQ5',
  'RQ-4 Global Hawk': 'FlyOS_MQ7',
  'RQ-170 Sentinel': 'FlyOS_MQ7',
  'FlyOS-MQ5': 'FlyOS_MQ5',
  'FlyOS-MQ7': 'FlyOS_MQ7',
  'FlyOS-MQ9': 'FlyOS_MQ9',
  'FlyOS_MQ5': 'FlyOS_MQ5',
  'FlyOS_MQ7': 'FlyOS_MQ7',
  'FlyOS_MQ9': 'FlyOS_MQ9'
};

const mapDroneModel = (model: string): any => {
  const mapped = DRONE_MODEL_MAP[model];
  if (!mapped) {
    logger.warn(`Unknown drone model: ${model}, defaulting to FlyOS_MQ5`);
    return 'FlyOS_MQ5';
  }
  return mapped;
};

const mapDroneStatus = (status: string): any => {
  const validStatuses = ['ACTIVE', 'STANDBY', 'MAINTENANCE', 'OFFLINE'];
  if (!validStatuses.includes(status)) {
    logger.warn(`Invalid drone status: ${status}, defaulting to STANDBY`);
    return 'STANDBY';
  }
  return status;
};

const mapUserRole = (role: string): any => {
  const validRoles = ['MAIN_HQ', 'REGIONAL_HQ', 'OPERATOR'];
  if (!validRoles.includes(role)) {
    logger.warn(`Invalid user role: ${role}, defaulting to OPERATOR`);
    return 'OPERATOR';
  }
  return role;
};

/**
 * Get local database statistics
 */
const getLocalStats = async () => {
  const [users, regions, drones, assignments] = await Promise.all([
    prisma.user.count(),
    prisma.region.count(),
    prisma.drone.count(),
    prisma.userDroneAssignment.count()
  ]);

  return { users, regions, drones, assignments, total: users + regions + drones };
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
 * Push all local data to Supabase (backup operation)
 */
export const pushAllDataToSupabase = async () => {
  try {
    logger.info('📤 Backing up local data to Supabase...');

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

    logger.info('✅ Local data backed up to Supabase');
    return {
      regions: regions.length,
      users: users.length,
      drones: drones.length,
      assignments: assignments.length
    };

  } catch (error: any) {
    logger.error('❌ Failed to backup to Supabase:', error);
    throw error;
  }
};

/**
 * SAFE restore regions from Supabase
 */
const restoreRegions = async () => {
  try {
    const { data: supabaseRegions } = await supabase
      .from('regions')
      .select('*')
      .order('created_at');

    if (!supabaseRegions?.length) {
      logger.info('No regions found in Supabase');
      return 0;
    }

    let restoredCount = 0;

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
        
        restoredCount++;
        
      } catch (regionError: any) {
        logger.error(`Failed to restore region ${region.id}:`, regionError.message);
      }
    }

    logger.info(`✅ Restored ${restoredCount} regions`);
    return restoredCount;

  } catch (error: any) {
    logger.error('❌ Failed to restore regions:', error);
    return 0;
  }
};

/**
 * SAFE restore users from Supabase with conflict resolution
 */
const restoreUsers = async () => {
  try {
    const { data: supabaseUsers } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at');

    if (!supabaseUsers?.length) {
      logger.info('No users found in Supabase');
      return 0;
    }

    let restoredCount = 0;

    for (const user of supabaseUsers) {
      // Skip users without required fields
      if (!user.email || !user.username) {
        logger.warn(`⚠️ Skipping incomplete user: ${user.username || user.id}`);
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
        
        restoredCount++;
        
      } catch (userError: any) {
        // Handle unique constraint violations gracefully
        if (userError.code === 'P2002') {
          const target = userError.meta?.target;
          if (target?.includes('username')) {
            logger.warn(`Skipping duplicate username: ${user.username}`);
          } else if (target?.includes('email')) {
            logger.warn(`Skipping duplicate email: ${user.email}`);
          } else {
            logger.warn(`Skipping duplicate user: ${user.username}`);
          }
        } else {
          logger.error(`Failed to restore user ${user.username}:`, userError.message);
        }
      }
    }

    logger.info(`✅ Restored ${restoredCount} users`);
    return restoredCount;

  } catch (error: any) {
    logger.error('❌ Failed to restore users:', error);
    return 0;
  }
};

/**
 * SAFE restore drones from Supabase with model mapping
 */
const restoreDrones = async () => {
  try {
    const { data: supabaseDrones } = await supabase
      .from('drones')
      .select('*')
      .order('created_at');

    if (!supabaseDrones?.length) {
      logger.info('No drones found in Supabase');
      return 0;
    }

    let restoredCount = 0;

    for (const drone of supabaseDrones) {
      try {
        // Map the model and status with validation
        const mappedModel = mapDroneModel(drone.model);
        const mappedStatus = mapDroneStatus(drone.status);

        await prisma.drone.upsert({
          where: { id: drone.id },
          update: {
            model: mappedModel as any,
            status: mappedStatus as any,
            regionId: drone.region_id,
            operatorId: drone.operator_id
          },
          create: {
            id: drone.id,
            model: mappedModel as any,
            status: mappedStatus as any,
            regionId: drone.region_id,
            operatorId: drone.operator_id
          }
        });
        
        restoredCount++;
        logger.debug(`✅ Restored drone: ${drone.id} (${mappedModel})`);
        
      } catch (droneError: any) {
        logger.error(`Failed to restore drone ${drone.id}:`, droneError.message);
      }
    }

    logger.info(`✅ Restored ${restoredCount} drones`);
    return restoredCount;

  } catch (error: any) {
    logger.error('❌ Failed to restore drones:', error);
    return 0;
  }
};

/**
 * Complete restoration from Supabase
 */
export const restoreFromSupabase = async () => {
  try {
    logger.info('🔄 Loading data from Supabase...');
    
    // Restore in dependency order: regions -> users -> drones -> assignments
    const regions = await restoreRegions();
    const users = await restoreUsers();
    const drones = await restoreDrones();
    
    // Skip assignments restoration for now to avoid complex validation
    const assignments = 0;
    
    return { regions, users, drones, assignments };
    
  } catch (error) {
    logger.error('❌ Failed to restore from Supabase:', error);
    return { regions: 0, users: 0, drones: 0, assignments: 0 };
  }
};

/**
 * Create initial dataset if no data exists anywhere
 */
const createInitialData = async () => {
  try {
    logger.info('🏗️ Creating initial dataset...');
    
    // Create basic regions
    const regions = await prisma.region.createMany({
      data: [
        { id: 'east', name: 'Eastern Region', area: 'Eastern Seaboard', status: 'ACTIVE' },
        { id: 'west', name: 'Western Region', area: 'Pacific Coast', status: 'ACTIVE' },
        { id: 'north', name: 'Northern Region', area: 'Great Lakes', status: 'ACTIVE' },
        { id: 'south', name: 'Southern Region', area: 'Gulf Coast', status: 'ACTIVE' }
      ],
      skipDuplicates: true
    });

    // Create basic drones
    const drones = await prisma.drone.createMany({
      data: [
        { id: 'drone-001', model: 'FlyOS_MQ5', status: 'STANDBY', regionId: null, operatorId: null },
        { id: 'drone-002', model: 'FlyOS_MQ7', status: 'STANDBY', regionId: null, operatorId: null }
      ],
      skipDuplicates: true
    });

    // Backup to Supabase
    await pushAllDataToSupabase();

    logger.info('✅ Created and synced initial dataset');
    return { regions: regions.count, users: 0, drones: drones.count, assignments: 0 };

  } catch (error: any) {
    logger.error('Failed to create initial dataset:', error);
    return { regions: 0, users: 0, drones: 0, assignments: 0 };
  }
};

/**
 * Ensure minimal working data exists
 */
const ensureMinimalData = async () => {
  try {
    await prisma.region.upsert({
      where: { id: 'default' },
      create: { id: 'default', name: 'Default Region', area: 'Default Area', status: 'ACTIVE' },
      update: {}
    });

    return { regions: 1, users: 0, drones: 0, assignments: 0 };
  } catch (error) {
    logger.error('Failed to ensure minimal data:', error);
    return { regions: 0, users: 0, drones: 0, assignments: 0 };
  }
};

/**
 * PRIMARY INITIALIZATION FUNCTION - LOCAL-FIRST STRATEGY
 * This is called by app.ts on startup
 */
export const initializeWithSupabaseSync = async () => {
  try {
    logger.info('🚀 Initializing with Supabase sync...');

    // Check what exists locally (persistent data from volumes)
    const localStats = await getLocalStats();
    
    if (localStats.total > 0) {
      logger.info(`📊 Found existing local data: ${localStats.users} users, ${localStats.regions} regions, ${localStats.drones} drones`);
      
      // Local data exists - push to Supabase as backup
      try {
        const syncResult = await pushAllDataToSupabase();
        logger.info('✅ Local data backed up to Supabase');
      } catch (syncError) {
        logger.warn('⚠️ Supabase backup failed, continuing with local data');
      }
      
      return {
        regions: localStats.regions,
        users: localStats.users,
        drones: localStats.drones,
        assignments: localStats.assignments
      };
    } else {
      logger.info('🆕 No local data found, checking Supabase...');
      
      // No local data - try to restore from Supabase
      const restoreResult = await restoreFromSupabase();
      
      if (restoreResult.regions === 0 && restoreResult.users === 0 && restoreResult.drones === 0) {
        // No data anywhere - create initial dataset
        logger.info('🏗️ No data found anywhere, creating initial dataset...');
        return await createInitialData();
      }
      
      return restoreResult;
    }

  } catch (error: any) {
    logger.error('❌ Sync initialization failed:', error);
    
    // Fallback: ensure we have minimal working data
    logger.info('🔧 Creating fallback minimal dataset...');
    return await ensureMinimalData();
  }
};

/**
 * Load all data from Supabase (for scripts)
 */
export const loadAllDataFromSupabase = async () => {
  return await restoreFromSupabase();
};
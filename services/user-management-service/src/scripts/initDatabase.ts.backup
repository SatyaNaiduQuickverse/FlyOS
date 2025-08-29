// services/user-management-service/src/scripts/initDatabase.ts - COMPLETE FIXED VERSION
import { prisma } from '../database';
import { logger } from '../utils/logger';
import { 
  createSupabaseUser, 
  repairUserSync, 
  syncExistingUsersToSupabase 
} from '../services/supabaseSync';

/**
 * Enhanced database initialization with sync repair
 */
export const initDatabase = async () => {
  try {
    logger.info('🚀 Initializing database...');

    // STEP 1: Create regions first
    const regions = [
      {
        id: 'east-region',
        name: 'Eastern Region',
        area: 'Eastern Seaboard',
        commanderName: 'Col. Sarah Mitchell',
        status: 'ACTIVE' as const
      },
      {
        id: 'west-region',
        name: 'Western Region',
        area: 'Pacific Coast',
        commanderName: 'Maj. David Chen',
        status: 'ACTIVE' as const
      },
      {
        id: 'south-region',
        name: 'Southern Region',
        area: 'Gulf Coast',
        commanderName: 'Col. Robert Garcia',
        status: 'ACTIVE' as const
      },
      {
        id: 'north-region',
        name: 'Northern Region',
        area: 'Great Lakes',
        commanderName: null,
        status: 'INACTIVE' as const
      }
    ];

    logger.info('Creating regions...');
    for (const region of regions) {
      await prisma.region.upsert({
        where: { id: region.id },
        update: {
          name: region.name,
          area: region.area,
          commanderName: region.commanderName,
          status: region.status
        },
        create: {
          id: region.id,
          name: region.name,
          area: region.area,
          commanderName: region.commanderName,
          status: region.status
        }
      });
      logger.info(`✅ Region created/updated: ${region.name}`);
    }

    // STEP 2: Repair existing user sync first
    logger.info('🔧 Repairing user synchronization...');
    await repairUserSync();

    // STEP 3: Create users with enhanced error handling
    const users = [
      {
        username: 'main_admin',
        fullName: 'Main Administrator',
        email: 'main@flyos.mil',
        role: 'MAIN_HQ' as const,
        regionId: null,
        password: 'FlyOS2025!',
        status: 'ACTIVE' as const
      },
      {
        username: 'region_east',
        fullName: 'Col. Sarah Mitchell',
        email: 'east@flyos.mil',
        role: 'REGIONAL_HQ' as const,
        regionId: 'east-region',
        password: 'FlyOS2025!',
        status: 'ACTIVE' as const
      },
      {
        username: 'region_west',
        fullName: 'Maj. David Chen',
        email: 'west@flyos.mil',
        role: 'REGIONAL_HQ' as const,
        regionId: 'west-region',
        password: 'FlyOS2025!',
        status: 'ACTIVE' as const
      },
      {
        username: 'operator1',
        fullName: 'Lt. Michael Rodriguez',
        email: 'operator1@flyos.mil',
        role: 'OPERATOR' as const,
        regionId: 'east-region',
        password: 'FlyOS2025!',
        status: 'ACTIVE' as const
      },
      {
        username: 'operator2',
        fullName: 'Lt. Jessica Kim',
        email: 'operator2@flyos.mil',
        role: 'OPERATOR' as const,
        regionId: 'east-region',
        password: 'FlyOS2025!',
        status: 'ACTIVE' as const
      }
    ];

    logger.info('Processing users...');
    for (const userData of users) {
      try {
        // Check if user already exists locally
        const existingLocalUser = await prisma.user.findFirst({
          where: {
            OR: [
              { username: userData.username },
              { email: userData.email }
            ]
          }
        });

        if (existingLocalUser) {
          logger.info(`⏭️  Local user already exists: ${userData.username}`);
          
          // If user exists locally but has no Supabase ID, try to create/link
          if (!existingLocalUser.supabaseUserId) {
            logger.info(`🔗 Attempting to link user to Supabase: ${userData.username}`);
            
            try {
              const supabaseUser = await createSupabaseUser({
                email: userData.email,
                password: userData.password,
                username: userData.username,
                role: userData.role,
                regionId: userData.regionId || undefined,
                fullName: userData.fullName
              });

              // Update local user with Supabase ID
              await prisma.user.update({
                where: { id: existingLocalUser.id },
                data: { supabaseUserId: supabaseUser.id }
              });

              logger.info(`✅ Linked existing user to Supabase: ${userData.username} -> ${supabaseUser.id}`);

            } catch (linkError: any) {
              logger.warn(`⚠️  Failed to link ${userData.username} to Supabase: ${linkError.message}`);
            }
          }
          
          continue;
        }

        // Create new user (both local and Supabase)
        logger.info(`➕ Creating new user: ${userData.username}`);
        
        try {
          // Create in Supabase first
          const supabaseUser = await createSupabaseUser({
            email: userData.email,
            password: userData.password,
            username: userData.username,
            role: userData.role,
            regionId: userData.regionId || undefined,
            fullName: userData.fullName
          });

          // Create in local database
          await prisma.user.create({
            data: {
              username: userData.username,
              fullName: userData.fullName,
              email: userData.email,
              role: userData.role,
              regionId: userData.regionId,
              status: userData.status,
              supabaseUserId: supabaseUser.id
            }
          });

          logger.info(`✅ User created successfully: ${userData.username} (${supabaseUser.id})`);

        } catch (createError: any) {
          logger.error(`❌ Failed to create user ${userData.username}: ${createError.message}`);
          
          // If Supabase creation failed but error suggests user exists, try to recover
          if (createError.message.includes('already exists') || createError.message.includes('already been registered')) {
            logger.info(`🔄 User might exist in Supabase, attempting recovery for: ${userData.username}`);
            
            // Try to run repair sync again to catch this user
            await repairUserSync();
          }
        }

      } catch (error: any) {
        logger.error(`💥 Error processing user ${userData.username}:`, error.message);
      }
    }

    // STEP 4: Create drones
    const drones = [
      {
        id: 'drone-001',
        model: 'FlyOS_MQ5' as const,
        status: 'ACTIVE' as const,
        regionId: 'east-region',
        operatorId: null
      },
      {
        id: 'drone-002',
        model: 'FlyOS_MQ5' as const,
        status: 'ACTIVE' as const,
        regionId: 'east-region',
        operatorId: null
      },
      {
        id: 'drone-003',
        model: 'FlyOS_MQ7' as const,
        status: 'MAINTENANCE' as const,
        regionId: 'west-region',
        operatorId: null
      },
      {
        id: 'drone-004',
        model: 'FlyOS_MQ7' as const,
        status: 'ACTIVE' as const,
        regionId: 'west-region',
        operatorId: null
      },
      {
        id: 'drone-005',
        model: 'FlyOS_MQ9' as const,
        status: 'ACTIVE' as const,
        regionId: 'south-region',
        operatorId: null
      },
      {
        id: 'drone-006',
        model: 'FlyOS_MQ9' as const,
        status: 'OFFLINE' as const,
        regionId: null,
        operatorId: null
      },
      {
        id: 'drone-007',
        model: 'FlyOS_MQ5' as const,
        status: 'STANDBY' as const,
        regionId: null,
        operatorId: null
      }
    ];

    logger.info('Creating drones...');
    for (const drone of drones) {
      await prisma.drone.upsert({
        where: { id: drone.id },
        update: {
          model: drone.model,
          status: drone.status,
          regionId: drone.regionId,
          operatorId: drone.operatorId
        },
        create: {
          id: drone.id,
          model: drone.model,
          status: drone.status,
          regionId: drone.regionId,
          operatorId: drone.operatorId
        }
      });
      logger.info(`✅ Drone created/updated: ${drone.id}`);
    }

    // STEP 5: Final sync check
    logger.info('🔄 Running final sync verification...');
    await syncExistingUsersToSupabase();

    logger.info('✅ Database initialization completed successfully!');

    // Print comprehensive summary
    const stats = await getDatabaseStats();
    logger.info('📊 Final Database Summary:');
    logger.info(`   🌍 Regions: ${stats.regions}`);
    logger.info(`   👥 Local Users: ${stats.users}`);
    logger.info(`   🔗 Synced Users: ${stats.syncedUsers}`);
    logger.info(`   ⚠️  Unsynced Users: ${stats.unsyncedUsers}`);
    logger.info(`   🚁 Drones: ${stats.drones}`);

    if (stats.unsyncedUsers > 0) {
      logger.warn('⚠️  Some users are not synced with Supabase. You may need to run sync repair manually.');
    }

  } catch (error) {
    logger.error('❌ Database initialization failed:', error);
    throw error;
  }
};

/**
 * Get comprehensive database statistics
 */
const getDatabaseStats = async () => {
  const [regions, users, drones] = await Promise.all([
    prisma.region.count(),
    prisma.user.count(),
    prisma.drone.count()
  ]);

  const syncedUsers = await prisma.user.count({
    where: {
      supabaseUserId: {
        not: null
      }
    }
  });

  const unsyncedUsers = users - syncedUsers;

  return { regions, users, drones, syncedUsers, unsyncedUsers };
};

/**
 * Standalone repair script
 */
export const repairSync = async () => {
  try {
    logger.info('🔧 Starting standalone sync repair...');
    await repairUserSync();
    await syncExistingUsersToSupabase();
    
    const stats = await getDatabaseStats();
    logger.info('📊 Repair Results:');
    logger.info(`   👥 Total Users: ${stats.users}`);
    logger.info(`   🔗 Synced Users: ${stats.syncedUsers}`);
    logger.info(`   ⚠️  Unsynced Users: ${stats.unsyncedUsers}`);
    
    logger.info('🎉 Sync repair completed!');
  } catch (error) {
    logger.error('❌ Sync repair failed:', error);
    throw error;
  }
};

// Run initialization if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--repair-only')) {
    repairSync()
      .then(() => {
        logger.info('🎉 Sync repair completed successfully');
        process.exit(0);
      })
      .catch((error) => {
        logger.error('💥 Sync repair failed:', error);
        process.exit(1);
      });
  } else {
    initDatabase()
      .then(() => {
        logger.info('🎉 Database initialization completed successfully');
        process.exit(0);
      })
      .catch((error) => {
        logger.error('💥 Database initialization failed:', error);
        process.exit(1);
      });
  }
}
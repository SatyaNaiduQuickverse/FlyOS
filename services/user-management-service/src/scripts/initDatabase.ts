// services/user-management-service/src/scripts/initDatabase.ts
import { prisma } from '../database';
import { logger } from '../utils/logger';
import { createSupabaseUser } from '../services/supabaseSync';

/**
 * Initialize database with seed data
 */
export const initDatabase = async () => {
  try {
    logger.info('🚀 Initializing database...');

    // Create initial regions
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

    // Create initial users (if not exist)
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

    logger.info('Creating users...');
    for (const userData of users) {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { username: userData.username }
      });

      if (existingUser) {
        logger.info(`⏭️  User already exists: ${userData.username}`);
        continue;
      }

      try {
        // Create Supabase user
        const supabaseUser = await createSupabaseUser({
          email: userData.email,
          password: userData.password,
          username: userData.username,
          role: userData.role,
          regionId: userData.regionId || undefined,
          fullName: userData.fullName
        });

        // Create local user
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

        logger.info(`✅ User created: ${userData.username}`);
      } catch (error: any) {
        logger.error(`❌ Failed to create user ${userData.username}:`, error.message);
      }
    }

    // Create initial drones
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

    logger.info('✅ Database initialization completed successfully!');

    // Print summary
    const stats = await getDatabaseStats();
    logger.info('📊 Database Summary:');
    logger.info(`   Regions: ${stats.regions}`);
    logger.info(`   Users: ${stats.users}`);
    logger.info(`   Drones: ${stats.drones}`);

  } catch (error) {
    logger.error('❌ Database initialization failed:', error);
    throw error;
  }
};

/**
 * Get database statistics
 */
const getDatabaseStats = async () => {
  const [regions, users, drones] = await Promise.all([
    prisma.region.count(),
    prisma.user.count(),
    prisma.drone.count()
  ]);

  return { regions, users, drones };
};

// Run initialization if called directly
if (require.main === module) {
  initDatabase()
    .then(() => {
      logger.info('🎉 Database initialization script completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Database initialization script failed:', error);
      process.exit(1);
    });
}
#!/bin/bash
# manual-throttle-fix.sh - Apply throttling manually

echo "🔧 Applying sync throttling fix manually..."

# Create the throttled version of initDatabase.ts
cat > services/user-management-service/src/scripts/initDatabase.ts << 'EOF'
// services/user-management-service/src/scripts/initDatabase.ts - WITH THROTTLING
import { prisma } from '../database';
import { logger } from '../utils/logger';
import { 
  createSupabaseUser, 
  repairUserSync, 
  syncExistingUsersToSupabase 
} from '../services/supabaseSync';

// SURGICAL FIX: Add throttling to prevent CPU spikes
let syncInProgress = false;
let lastSyncTime = 0;
const SYNC_COOLDOWN = 30000; // 30 seconds

const optimizedRepairUserSync = async () => {
  const now = Date.now();
  if (syncInProgress || (now - lastSyncTime < SYNC_COOLDOWN)) {
    logger.info('⏭️ Sync skipped (in progress or cooldown)');
    return;
  }
  syncInProgress = true;
  lastSyncTime = now;
  try {
    await repairUserSync();
  } finally {
    syncInProgress = false;
  }
};

export const initDatabase = async () => {
  try {
    logger.info('🚀 Initializing database...');

    // Create regions
    const regions = [
      { id: 'east-region', name: 'Eastern Region', area: 'Eastern Seaboard', commanderName: 'Col. Sarah Mitchell', status: 'ACTIVE' as const },
      { id: 'west-region', name: 'Western Region', area: 'Pacific Coast', commanderName: 'Maj. David Chen', status: 'ACTIVE' as const },
      { id: 'south-region', name: 'Southern Region', area: 'Gulf Coast', commanderName: 'Col. Robert Garcia', status: 'ACTIVE' as const },
      { id: 'north-region', name: 'Northern Region', area: 'Great Lakes', commanderName: null, status: 'INACTIVE' as const }
    ];

    for (const region of regions) {
      await prisma.region.upsert({
        where: { id: region.id },
        update: { name: region.name, area: region.area, commanderName: region.commanderName, status: region.status },
        create: { id: region.id, name: region.name, area: region.area, commanderName: region.commanderName, status: region.status }
      });
    }

    // THROTTLED sync
    await optimizedRepairUserSync();

    // Create users
    const users = [
      { username: 'main_admin', fullName: 'Main Administrator', email: 'main@flyos.mil', role: 'MAIN_HQ' as const, regionId: null, password: 'FlyOS2025!', status: 'ACTIVE' as const },
      { username: 'region_east', fullName: 'Col. Sarah Mitchell', email: 'east@flyos.mil', role: 'REGIONAL_HQ' as const, regionId: 'east-region', password: 'FlyOS2025!', status: 'ACTIVE' as const },
      { username: 'region_west', fullName: 'Maj. David Chen', email: 'west@flyos.mil', role: 'REGIONAL_HQ' as const, regionId: 'west-region', password: 'FlyOS2025!', status: 'ACTIVE' as const },
      { username: 'operator1', fullName: 'Lt. Michael Rodriguez', email: 'operator1@flyos.mil', role: 'OPERATOR' as const, regionId: 'east-region', password: 'FlyOS2025!', status: 'ACTIVE' as const },
      { username: 'operator2', fullName: 'Lt. Jessica Kim', email: 'operator2@flyos.mil', role: 'OPERATOR' as const, regionId: 'east-region', password: 'FlyOS2025!', status: 'ACTIVE' as const }
    ];

    for (const userData of users) {
      try {
        const existingUser = await prisma.user.findFirst({
          where: { OR: [{ username: userData.username }, { email: userData.email }] }
        });

        if (existingUser) {
          if (!existingUser.supabaseUserId && !syncInProgress) {
            try {
              const supabaseUser = await createSupabaseUser({
                email: userData.email, password: userData.password, username: userData.username,
                role: userData.role, regionId: userData.regionId || undefined, fullName: userData.fullName
              });
              await prisma.user.update({ where: { id: existingUser.id }, data: { supabaseUserId: supabaseUser.id } });
            } catch (linkError: any) {
              if (linkError.message.includes('already exists') && !syncInProgress) {
                await optimizedRepairUserSync();
              }
            }
          }
          continue;
        }

        // Create new user
        const supabaseUser = await createSupabaseUser({
          email: userData.email, password: userData.password, username: userData.username,
          role: userData.role, regionId: userData.regionId || undefined, fullName: userData.fullName
        });

        await prisma.user.create({
          data: { ...userData, supabaseUserId: supabaseUser.id }
        });

      } catch (error: any) {
        logger.error(`Error processing user ${userData.username}:`, error.message);
        if ((error.message.includes('already exists') || error.message.includes('already been registered')) && !syncInProgress) {
          await optimizedRepairUserSync();
        }
      }
    }

    // Create drones
    const drones = [
      { id: 'drone-001', model: 'FlyOS_MQ5' as const, status: 'ACTIVE' as const, regionId: 'east-region', operatorId: null },
      { id: 'drone-002', model: 'FlyOS_MQ5' as const, status: 'ACTIVE' as const, regionId: 'east-region', operatorId: null },
      { id: 'drone-003', model: 'FlyOS_MQ7' as const, status: 'MAINTENANCE' as const, regionId: 'west-region', operatorId: null },
      { id: 'drone-004', model: 'FlyOS_MQ7' as const, status: 'ACTIVE' as const, regionId: 'west-region', operatorId: null },
      { id: 'drone-005', model: 'FlyOS_MQ9' as const, status: 'ACTIVE' as const, regionId: 'south-region', operatorId: null },
      { id: 'drone-006', model: 'FlyOS_MQ9' as const, status: 'OFFLINE' as const, regionId: null, operatorId: null },
      { id: 'drone-007', model: 'FlyOS_MQ5' as const, status: 'STANDBY' as const, regionId: null, operatorId: null }
    ];

    for (const drone of drones) {
      await prisma.drone.upsert({
        where: { id: drone.id },
        update: { model: drone.model, status: drone.status, regionId: drone.regionId, operatorId: drone.operatorId },
        create: { id: drone.id, model: drone.model, status: drone.status, regionId: drone.regionId, operatorId: drone.operatorId }
      });
    }

    // Final sync (throttled)
    if (!syncInProgress) {
      await syncExistingUsersToSupabase();
    }

    logger.info('✅ Database initialization completed!');

  } catch (error) {
    logger.error('❌ Database initialization failed:', error);
    throw error;
  }
};

if (require.main === module) {
  initDatabase().then(() => process.exit(0)).catch(() => process.exit(1));
}
EOF

echo "✅ Throttling applied manually"

# Rebuild and restart
echo "🔄 Rebuilding service..."
docker-compose build user-management-service
docker-compose up -d user-management-service

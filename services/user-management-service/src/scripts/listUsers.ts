// services/user-management-service/src/scripts/listUsers.ts - COMPLETE DIAGNOSTIC SCRIPT
import { prisma } from '../database';
import { logger } from '../utils/logger';
import { listSupabaseUsers, getSupabaseUser } from '../services/supabaseSync';

/**
 * Comprehensive user sync diagnostic
 */
const diagnosticUserSync = async () => {
  try {
    logger.info('🔍 Running user sync diagnostic...');
    
    // Get local users
    const localUsers = await prisma.user.findMany({
      include: {
        region: true
      },
      orderBy: { createdAt: 'asc' }
    });
    
    // Get Supabase users
    const { users: supabaseUsers } = await listSupabaseUsers(1, 1000);
    
    logger.info('📊 SYNC DIAGNOSTIC REPORT');
    logger.info('========================');
    logger.info(`🏠 Local Database Users: ${localUsers.length}`);
    logger.info(`☁️  Supabase Users: ${supabaseUsers.length}`);
    
    // Analyze local users
    logger.info('\n🏠 LOCAL USERS ANALYSIS:');
    logger.info('------------------------');
    
    let syncedCount = 0;
    let unsyncedCount = 0;
    let brokenSyncCount = 0;
    
    for (const user of localUsers) {
      const status = user.supabaseUserId ? '🔗' : '❌';
      const regionName = user.region?.name || 'No Region';
      
      logger.info(`${status} ${user.username} (${user.role}) - ${user.email} - ${regionName}`);
      
      if (user.supabaseUserId) {
        syncedCount++;
        
        // Verify Supabase user still exists
        const supabaseUser = await getSupabaseUser(user.supabaseUserId);
        if (!supabaseUser) {
          logger.warn(`⚠️  BROKEN LINK: ${user.username} -> ${user.supabaseUserId} (Supabase user not found)`);
          brokenSyncCount++;
        }
      } else {
        unsyncedCount++;
        
        // Check if user exists in Supabase by email
        const existingSupabaseUser = supabaseUsers.find(su => su.email === user.email);
        if (existingSupabaseUser) {
          logger.warn(`🔧 NEEDS LINKING: ${user.username} exists in Supabase as ${existingSupabaseUser.id}`);
        }
      }
    }
    
    // Analyze Supabase users
    logger.info('\n☁️  SUPABASE USERS ANALYSIS:');
    logger.info('----------------------------');
    
    let orphanedSupabaseUsers = 0;
    
    for (const supabaseUser of supabaseUsers) {
      const localUser = localUsers.find(lu => 
        lu.supabaseUserId === supabaseUser.id || lu.email === supabaseUser.email
      );
      
      const status = localUser ? '🔗' : '👻';
      const metadata = supabaseUser.user_metadata || {};
      
      logger.info(`${status} ${supabaseUser.email} (${metadata.role || 'NO_ROLE'}) - ID: ${supabaseUser.id}`);
      
      if (!localUser) {
        orphanedSupabaseUsers++;
        logger.warn(`👻 ORPHANED: Supabase user ${supabaseUser.email} has no local counterpart`);
      }
    }
    
    // Summary
    logger.info('\n📈 SYNC SUMMARY:');
    logger.info('================');
    logger.info(`✅ Properly Synced: ${syncedCount}`);
    logger.info(`❌ Unsynced Local: ${unsyncedCount}`);
    logger.info(`🔗 Broken Links: ${brokenSyncCount}`);
    logger.info(`👻 Orphaned Supabase: ${orphanedSupabaseUsers}`);
    
    // Recommendations
    logger.info('\n🔧 RECOMMENDATIONS:');
    logger.info('===================');
    
    if (unsyncedCount > 0) {
      logger.info(`• Run sync repair: npm run repair-sync`);
    }
    
    if (brokenSyncCount > 0) {
      logger.info(`• Fix broken links manually or run full repair`);
    }
    
    if (orphanedSupabaseUsers > 0) {
      logger.info(`• Consider creating local users for orphaned Supabase users`);
    }
    
    if (syncedCount === localUsers.length && brokenSyncCount === 0 && orphanedSupabaseUsers === 0) {
      logger.info(`🎉 ALL USERS ARE PROPERLY SYNCED!`);
    }
    
    return {
      localUsers: localUsers.length,
      supabaseUsers: supabaseUsers.length,
      synced: syncedCount,
      unsynced: unsyncedCount,
      brokenLinks: brokenSyncCount,
      orphaned: orphanedSupabaseUsers
    };
    
  } catch (error) {
    logger.error('❌ Diagnostic failed:', error);
    throw error;
  }
};

/**
 * Quick sync status check
 */
const quickSyncCheck = async () => {
  try {
    const stats = await diagnosticUserSync();
    
    if (stats.unsynced > 0 || stats.brokenLinks > 0) {
      logger.warn('⚠️  SYNC ISSUES DETECTED - Run repair recommended');
      process.exit(1);
    } else {
      logger.info('✅ All users properly synced');
      process.exit(0);
    }
    
  } catch (error) {
    logger.error('❌ Sync check failed:', error);
    process.exit(1);
  }
};

// Run diagnostic if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--quick')) {
    quickSyncCheck();
  } else {
    diagnosticUserSync()
      .then(() => {
        logger.info('🎉 Diagnostic completed');
        process.exit(0);
      })
      .catch((error) => {
        logger.error('💥 Diagnostic failed:', error);
        process.exit(1);
      });
  }
}

export { diagnosticUserSync, quickSyncCheck };
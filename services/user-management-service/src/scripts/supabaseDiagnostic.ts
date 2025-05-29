// services/user-management-service/src/scripts/supabaseDiagnostic.ts
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { prisma } from '../database';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Complete diagnostic of Supabase and local database state
 */
export const runSupabaseDiagnostic = async () => {
  try {
    logger.info('🔍 SUPABASE DIAGNOSTIC STARTING...');
    logger.info('=====================================');

    // 1. Test Supabase connection
    logger.info('\n1. 🔗 Testing Supabase Connection...');
    try {
      const { data: { users }, error } = await supabase.auth.admin.listUsers();
      if (error) {
        logger.error('❌ Supabase connection failed:', error);
        return;
      }
      logger.info(`✅ Supabase connected - Found ${users.length} auth users`);
    } catch (error) {
      logger.error('❌ Supabase connection error:', error);
      return;
    }

    // 2. Check profiles table in Supabase
    logger.info('\n2. 📋 Checking Supabase profiles table...');
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .limit(1);
      
      if (profilesError) {
        logger.error('❌ Profiles table error:', profilesError);
        logger.info('💡 You may need to create the profiles table in Supabase');
      } else {
        logger.info('✅ Profiles table exists and accessible');
        
        // Count profiles
        const { count, error: countError } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });
        
        if (!countError) {
          logger.info(`📊 Profiles table has ${count} records`);
        }
      }
    } catch (error) {
      logger.error('❌ Error checking profiles table:', error);
    }

    // 3. Check login_history table in Supabase
    logger.info('\n3. 📝 Checking Supabase login_history table...');
    try {
      const { data: loginHistory, error: loginError } = await supabase
        .from('login_history')
        .select('*')
        .limit(1);
      
      if (loginError) {
        logger.error('❌ Login history table error:', loginError);
        logger.info('💡 You may need to create the login_history table in Supabase');
      } else {
        logger.info('✅ Login history table exists and accessible');
        
        // Count login history
        const { count, error: countError } = await supabase
          .from('login_history')
          .select('*', { count: 'exact', head: true });
        
        if (!countError) {
          logger.info(`📊 Login history table has ${count} records`);
        }
      }
    } catch (error) {
      logger.error('❌ Error checking login_history table:', error);
    }

    // 4. Get all Supabase auth users
    logger.info('\n4. 👥 Analyzing Supabase Auth Users...');
    const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      logger.error('❌ Error getting auth users:', authError);
    } else {
      logger.info(`📊 Found ${authUsers.length} auth users in Supabase:`);
      
      for (const user of authUsers) {
        const metadata = user.user_metadata || {};
        logger.info(`  🔑 ${user.email} (${user.id}) - Role: ${metadata.role || 'NONE'} - Confirmed: ${user.email_confirmed_at ? 'YES' : 'NO'}`);
      }
    }

    // 5. Get all local database users
    logger.info('\n5. 🏠 Analyzing Local Database Users...');
    const localUsers = await prisma.user.findMany({
      include: { region: true }
    });
    
    logger.info(`📊 Found ${localUsers.length} users in local database:`);
    for (const user of localUsers) {
      const syncStatus = user.supabaseUserId ? '🔗' : '❌';
      logger.info(`  ${syncStatus} ${user.username} (${user.email}) - Role: ${user.role} - Supabase ID: ${user.supabaseUserId || 'NONE'}`);
    }

    // 6. Find sync issues
    logger.info('\n6. 🔍 Identifying Sync Issues...');
    
    // Local users without Supabase ID
    const unsyncedLocal = localUsers.filter(u => !u.supabaseUserId);
    if (unsyncedLocal.length > 0) {
      logger.warn(`❌ ${unsyncedLocal.length} local users NOT synced to Supabase:`);
      unsyncedLocal.forEach(u => logger.warn(`  - ${u.username} (${u.email})`));
    }

    // Supabase users without local counterpart
    const orphanedSupabase = authUsers.filter(su => 
      !localUsers.some(lu => lu.email === su.email || lu.supabaseUserId === su.id)
    );
    if (orphanedSupabase.length > 0) {
      logger.warn(`👻 ${orphanedSupabase.length} Supabase users without local counterpart:`);
      orphanedSupabase.forEach(su => logger.warn(`  - ${su.email} (${su.id})`));
    }

    // Local users with Supabase ID but Supabase user doesn't exist
    const brokenLinks = [];
    for (const user of localUsers.filter(u => u.supabaseUserId)) {
      const supabaseUser = authUsers.find(su => su.id === user.supabaseUserId);
      if (!supabaseUser) {
        brokenLinks.push(user);
      }
    }
    if (brokenLinks.length > 0) {
      logger.warn(`🔗 ${brokenLinks.length} local users with broken Supabase links:`);
      brokenLinks.forEach(u => logger.warn(`  - ${u.username} -> ${u.supabaseUserId} (missing)`));
    }

    // 7. Test login functionality
    logger.info('\n7. 🔐 Testing Login Functionality...');
    
    // Try to find a test user
    const testUser = authUsers.find(u => u.email === 'main@flyos.mil');
    if (testUser) {
      logger.info(`🧪 Testing with user: ${testUser.email}`);
      
      // Check if user is confirmed
      if (!testUser.email_confirmed_at) {
        logger.warn('⚠️  User email not confirmed - this will cause login issues');
        
        // Auto-confirm the user
        logger.info('🔧 Auto-confirming user email...');
        const { error: confirmError } = await supabase.auth.admin.updateUserById(
          testUser.id,
          { email_confirm: true }
        );
        
        if (confirmError) {
          logger.error('❌ Failed to confirm user:', confirmError);
        } else {
          logger.info('✅ User email confirmed');
        }
      } else {
        logger.info('✅ User email already confirmed');
      }
      
      // Check user metadata
      logger.info(`📋 User metadata:`, testUser.user_metadata);
      
    } else {
      logger.warn('⚠️  No test user found (main@flyos.mil)');
    }

    // 8. Summary and recommendations
    logger.info('\n8. 📋 DIAGNOSTIC SUMMARY');
    logger.info('========================');
    logger.info(`Local Users: ${localUsers.length}`);
    logger.info(`Supabase Auth Users: ${authUsers.length}`);
    logger.info(`Unsynced Local: ${unsyncedLocal.length}`);
    logger.info(`Orphaned Supabase: ${orphanedSupabase.length}`);
    logger.info(`Broken Links: ${brokenLinks.length}`);

    logger.info('\n🔧 RECOMMENDATIONS:');
    logger.info('===================');
    
    if (unsyncedLocal.length > 0) {
      logger.info('• Run: npm run repair-sync');
    }
    
    if (orphanedSupabase.length > 0) {
      logger.info('• Consider cleaning up orphaned Supabase users');
    }
    
    if (brokenLinks.length > 0) {
      logger.info('• Fix broken links with repair script');
    }

    // Check for unconfirmed users
    const unconfirmedUsers = authUsers.filter(u => !u.email_confirmed_at);
    if (unconfirmedUsers.length > 0) {
      logger.warn(`⚠️  ${unconfirmedUsers.length} users have unconfirmed emails - this will prevent login`);
      logger.info('• Run email confirmation fix');
    }

    return {
      localUsers: localUsers.length,
      supabaseUsers: authUsers.length,
      unsynced: unsyncedLocal.length,
      orphaned: orphanedSupabase.length,
      broken: brokenLinks.length,
      unconfirmed: unconfirmedUsers.length
    };

  } catch (error) {
    logger.error('❌ Diagnostic failed:', error);
    throw error;
  }
};

/**
 * Quick fix for common issues
 */
export const quickFixSupabase = async () => {
  try {
    logger.info('🔧 QUICK FIX STARTING...');
    
    // 1. Confirm all users
    logger.info('1. 📧 Confirming all user emails...');
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      logger.error('❌ Failed to get users:', error);
      return;
    }

    for (const user of users) {
      if (!user.email_confirmed_at) {
        logger.info(`📧 Confirming email for: ${user.email}`);
        const { error: confirmError } = await supabase.auth.admin.updateUserById(
          user.id,
          { email_confirm: true }
        );
        
        if (confirmError) {
          logger.error(`❌ Failed to confirm ${user.email}:`, confirmError);
        } else {
          logger.info(`✅ Confirmed: ${user.email}`);
        }
      }
    }

    // 2. Ensure proper metadata
    logger.info('2. 🏷️  Updating user metadata...');
    const localUsers = await prisma.user.findMany();
    
    for (const localUser of localUsers) {
      if (localUser.supabaseUserId) {
        const supabaseUser = users.find(u => u.id === localUser.supabaseUserId);
        if (supabaseUser) {
          const { error: updateError } = await supabase.auth.admin.updateUserById(
            localUser.supabaseUserId,
            {
              user_metadata: {
                username: localUser.username,
                role: localUser.role,
                region_id: localUser.regionId,
                full_name: localUser.fullName
              }
            }
          );
          
          if (updateError) {
            logger.error(`❌ Failed to update metadata for ${localUser.username}:`, updateError);
          } else {
            logger.info(`✅ Updated metadata: ${localUser.username}`);
          }
        }
      }
    }

    logger.info('🎉 Quick fix completed!');
    
  } catch (error) {
    logger.error('❌ Quick fix failed:', error);
    throw error;
  }
};

// Run diagnostic if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--fix')) {
    quickFixSupabase()
      .then(() => {
        logger.info('🎉 Quick fix completed');
        process.exit(0);
      })
      .catch((error) => {
        logger.error('💥 Quick fix failed:', error);
        process.exit(1);
      });
  } else {
    runSupabaseDiagnostic()
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
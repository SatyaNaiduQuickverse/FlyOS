// services/user-management-service/src/services/supabaseSync.ts - COMPLETE FIXED VERSION
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface CreateUserData {
  email: string;
  password: string;
  username: string;
  role: string;
  regionId?: string;
  fullName: string;
}

/**
 * Create user in Supabase Auth with enhanced error handling
 */
export const createSupabaseUser = async (userData: CreateUserData) => {
  try {
    logger.info(`Creating Supabase user: ${userData.email}`);
    
    // Check if user already exists by listing users and finding by email
    const { data: usersList, error: listError } = await supabase.auth.admin.listUsers();
    
    if (!listError && usersList?.users) {
      const existingUser = usersList.users.find(u => u.email === userData.email);
      if (existingUser) {
        logger.warn(`User already exists in Supabase: ${userData.email}`);
        return existingUser;
      }
    }
    
    // Create new user with auto-confirmation
    const { data, error } = await supabase.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      user_metadata: {
        username: userData.username,
        role: userData.role,
        region_id: userData.regionId,
        full_name: userData.fullName
      },
      email_confirm: true, // Auto-confirm email
      phone_confirm: true  // Auto-confirm phone if provided
    });
    
    if (error) {
      // Handle specific error types
      if (error.message.includes('already been registered') || error.code === 'email_exists') {
        logger.warn(`User already exists, attempting to fetch: ${userData.email}`);
        
        // Try to get existing user by email from the list
        const { data: usersListRetry, error: listErrorRetry } = await supabase.auth.admin.listUsers();
        
        if (!listErrorRetry && usersListRetry?.users) {
          const existingUser = usersListRetry.users.find(u => u.email === userData.email);
          if (existingUser) {
            logger.info(`Found existing user: ${existingUser.id}`);
            
            // Update metadata for existing user
            const { data: updatedUserResponse, error: updateError } = await supabase.auth.admin.updateUserById(
              existingUser.id,
              {
                user_metadata: {
                  username: userData.username,
                  role: userData.role,
                  region_id: userData.regionId,
                  full_name: userData.fullName
                }
              }
            );
            
            if (updateError) {
              logger.warn(`Failed to update existing user metadata: ${updateError.message}`);
            } else {
              logger.info(`Updated existing user metadata: ${existingUser.id}`);
            }
            
            return existingUser;
          }
        }
        
        throw new Error(`User exists but could not be retrieved: ${userData.email}`);
      }
      
      // Handle database errors
      if (error.message.includes('Database error') || error.code === 'unexpected_failure') {
        logger.error('Supabase database error:', error);
        throw new Error(`Database error creating user: ${error.message}. Please check Supabase project status.`);
      }
      
      logger.error('Supabase user creation failed:', error);
      throw new Error(`Failed to create Supabase user: ${error.message}`);
    }
    
    if (!data?.user) {
      throw new Error('No user data returned from Supabase');
    }
    
    logger.info(`✅ Supabase user created successfully: ${data.user.id}`);
    return data.user;
    
  } catch (error: any) {
    logger.error('Error in createSupabaseUser:', error);
    throw error;
  }
};

/**
 * Update user metadata in Supabase with enhanced error handling
 */
export const updateSupabaseUser = async (supabaseUserId: string, updates: {
  username?: string;
  role?: string;
  regionId?: string;
  fullName?: string;
  email?: string;
}) => {
  try {
    logger.info(`Updating Supabase user metadata: ${supabaseUserId}`);
    
    // Prepare update data
    const updateData: any = {};
    
    // Update email if provided
    if (updates.email) {
      updateData.email = updates.email;
    }
    
    // Update metadata
    const metadataUpdates: any = {};
    if (updates.username) metadataUpdates.username = updates.username;
    if (updates.role) metadataUpdates.role = updates.role;
    if (updates.regionId !== undefined) metadataUpdates.region_id = updates.regionId;
    if (updates.fullName) metadataUpdates.full_name = updates.fullName;
    
    if (Object.keys(metadataUpdates).length > 0) {
      updateData.user_metadata = metadataUpdates;
    }
    
    const { data, error } = await supabase.auth.admin.updateUserById(
      supabaseUserId,
      updateData
    );
    
    if (error) {
      logger.error('Supabase user update failed:', error);
      // Don't throw error - local update should succeed even if Supabase fails
      logger.warn('⚠️ Continuing despite Supabase update failure');
      return null;
    }
    
    logger.info(`✅ Supabase user updated successfully: ${supabaseUserId}`);
    return data?.user || null;
    
  } catch (error: any) {
    logger.error('Error in updateSupabaseUser:', error);
    // Don't throw - local update should succeed even if Supabase fails
    logger.warn('⚠️ Continuing despite Supabase update failure');
    return null;
  }
};

/**
 * Delete user from Supabase Auth with enhanced error handling
 */
export const deleteSupabaseUser = async (supabaseUserId: string) => {
  try {
    logger.info(`Deleting Supabase user: ${supabaseUserId}`);
    
    const { error } = await supabase.auth.admin.deleteUser(supabaseUserId);
    
    if (error) {
      logger.error('Supabase user deletion failed:', error);
      // Don't throw - local deletion should succeed even if Supabase fails
      logger.warn('⚠️ Continuing despite Supabase deletion failure');
      return false;
    }
    
    logger.info(`✅ Supabase user deleted successfully: ${supabaseUserId}`);
    return true;
    
  } catch (error: any) {
    logger.error('Error in deleteSupabaseUser:', error);
    // Don't throw - local deletion should succeed even if Supabase fails
    logger.warn('⚠️ Continuing despite Supabase deletion failure');
    return false;
  }
};

/**
 * Get user from Supabase by ID with enhanced error handling
 */
export const getSupabaseUser = async (supabaseUserId: string) => {
  try {
    const { data, error } = await supabase.auth.admin.getUserById(supabaseUserId);
    
    if (error) {
      logger.warn('Failed to get Supabase user:', error);
      return null;
    }
    
    return data?.user || null;
    
  } catch (error) {
    logger.error('Error getting Supabase user:', error);
    return null;
  }
};

/**
 * List all Supabase users with pagination
 */
export const listSupabaseUsers = async (page = 1, perPage = 100) => {
  try {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage
    });
    
    if (error) {
      logger.error('Failed to list Supabase users:', error);
      return { users: [], aud: '', nextPage: null, lastPage: 0, total: 0 };
    }
    
    return data || { users: [], aud: '', nextPage: null, lastPage: 0, total: 0 };
    
  } catch (error) {
    logger.error('Error listing Supabase users:', error);
    return { users: [], aud: '', nextPage: null, lastPage: 0, total: 0 };
  }
};

/**
 * Sync existing local users to Supabase
 */
export const syncExistingUsersToSupabase = async () => {
  try {
    logger.info('🔄 Starting sync of existing users to Supabase...');
    
    const { prisma } = await import('../database');
    
    const localUsers = await prisma.user.findMany({
      where: {
        supabaseUserId: null // Only sync users without Supabase ID
      }
    });
    
    logger.info(`Found ${localUsers.length} local users to sync`);
    
    for (const user of localUsers) {
      try {
        // Create user in Supabase
        const supabaseUser = await createSupabaseUser({
          email: user.email,
          password: 'FlyOS2025!', // Default password - users will need to reset
          username: user.username,
          role: user.role,
          regionId: user.regionId || undefined,
          fullName: user.fullName
        });
        
        // Update local user with Supabase ID
        await prisma.user.update({
          where: { id: user.id },
          data: { supabaseUserId: supabaseUser.id }
        });
        
        logger.info(`✅ Synced user: ${user.username} -> ${supabaseUser.id}`);
        
      } catch (error: any) {
        logger.error(`❌ Failed to sync user ${user.username}:`, error.message);
      }
    }
    
    logger.info('🎉 User sync completed');
    
  } catch (error) {
    logger.error('Error in syncExistingUsersToSupabase:', error);
    throw error;
  }
};

/**
 * Repair broken user sync by checking Supabase vs local database
 */
export const repairUserSync = async () => {
  try {
    logger.info('🔧 Starting user sync repair...');
    
    const { prisma } = await import('../database');
    
    // Get all Supabase users
    const { users: supabaseUsers } = await listSupabaseUsers(1, 1000);
    logger.info(`Found ${supabaseUsers.length} users in Supabase`);
    
    // Get all local users
    const localUsers = await prisma.user.findMany();
    logger.info(`Found ${localUsers.length} users in local database`);
    
    // Find users that exist in Supabase but not linked in local DB
    for (const supabaseUser of supabaseUsers) {
      const localUser = localUsers.find(u => 
        u.email === supabaseUser.email || u.supabaseUserId === supabaseUser.id
      );
      
      if (localUser && !localUser.supabaseUserId) {
        // Link existing local user to Supabase user
        await prisma.user.update({
          where: { id: localUser.id },
          data: { supabaseUserId: supabaseUser.id }
        });
        
        logger.info(`🔗 Linked user: ${localUser.username} -> ${supabaseUser.id}`);
      } else if (!localUser) {
        // Create local user for Supabase user
        const metadata = supabaseUser.user_metadata || {};
        
        try {
          await prisma.user.create({
            data: {
              username: metadata.username || supabaseUser.email?.split('@')[0] || 'user',
              fullName: metadata.full_name || 'User',
              email: supabaseUser.email!,
              role: metadata.role || 'OPERATOR',
              regionId: metadata.region_id || null,
              status: 'ACTIVE',
              supabaseUserId: supabaseUser.id
            }
          });
          
          logger.info(`➕ Created local user for Supabase user: ${supabaseUser.email}`);
        } catch (createError) {
          logger.warn(`Failed to create local user for ${supabaseUser.email}:`, createError);
        }
      }
    }
    
    logger.info('🎉 User sync repair completed');
    
  } catch (error) {
    logger.error('Error in repairUserSync:', error);
    throw error;
  }
};
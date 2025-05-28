// services/user-management-service/src/services/supabaseSync.ts
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
 * Create user in Supabase Auth with metadata
 */
export const createSupabaseUser = async (userData: CreateUserData) => {
  try {
    logger.info(`Creating Supabase user: ${userData.email}`);
    
    const { data, error } = await supabase.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      user_metadata: {
        username: userData.username,
        role: userData.role,
        region_id: userData.regionId,
        full_name: userData.fullName
      },
      email_confirm: true // Auto-confirm for admin creation
    });
    
    if (error) {
      logger.error('Supabase user creation failed:', error);
      throw new Error(`Failed to create Supabase user: ${error.message}`);
    }
    
    if (!data.user) {
      throw new Error('No user data returned from Supabase');
    }
    
    logger.info(`✅ Supabase user created: ${data.user.id}`);
    return data.user;
    
  } catch (error: any) {
    logger.error('Error in createSupabaseUser:', error);
    throw new Error(`Supabase user creation failed: ${error.message}`);
  }
};

/**
 * Update user metadata in Supabase
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
    
    const updateData: any = {};
    
    // Update email if provided
    if (updates.email) {
      updateData.email = updates.email;
    }
    
    // Update metadata
    if (updates.username || updates.role || updates.regionId || updates.fullName) {
      updateData.user_metadata = {
        ...(updates.username && { username: updates.username }),
        ...(updates.role && { role: updates.role }),
        ...(updates.regionId && { region_id: updates.regionId }),
        ...(updates.fullName && { full_name: updates.fullName })
      };
    }
    
    const { data, error } = await supabase.auth.admin.updateUserById(
      supabaseUserId,
      updateData
    );
    
    if (error) {
      logger.error('Supabase user update failed:', error);
      throw new Error(`Failed to update Supabase user: ${error.message}`);
    }
    
    logger.info(`✅ Supabase user updated: ${supabaseUserId}`);
    return data.user;
    
  } catch (error: any) {
    logger.error('Error in updateSupabaseUser:', error);
    // Don't throw - local update should succeed even if Supabase fails
    logger.warn('⚠️ Continuing despite Supabase update failure');
  }
};

/**
 * Delete user from Supabase Auth
 */
export const deleteSupabaseUser = async (supabaseUserId: string) => {
  try {
    logger.info(`Deleting Supabase user: ${supabaseUserId}`);
    
    const { error } = await supabase.auth.admin.deleteUser(supabaseUserId);
    
    if (error) {
      logger.error('Supabase user deletion failed:', error);
      throw new Error(`Failed to delete Supabase user: ${error.message}`);
    }
    
    logger.info(`✅ Supabase user deleted: ${supabaseUserId}`);
    
  } catch (error: any) {
    logger.error('Error in deleteSupabaseUser:', error);
    // Don't throw - local deletion should succeed even if Supabase fails
    logger.warn('⚠️ Continuing despite Supabase deletion failure');
  }
};

/**
 * Get user from Supabase by ID
 */
export const getSupabaseUser = async (supabaseUserId: string) => {
  try {
    const { data, error } = await supabase.auth.admin.getUserById(supabaseUserId);
    
    if (error) {
      logger.warn('Failed to get Supabase user:', error);
      return null;
    }
    
    return data.user;
    
  } catch (error) {
    logger.error('Error getting Supabase user:', error);
    return null;
  }
};

/**
 * List all Supabase users (for admin purposes)
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
    
    return data;
    
  } catch (error) {
    logger.error('Error listing Supabase users:', error);
    return { users: [], aud: '', nextPage: null, lastPage: 0, total: 0 };
  }
};
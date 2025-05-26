// services/realtime-service/src/utils/auth.ts - CLEANED FOR SUPABASE ONLY
import { createClient } from '@supabase/supabase-js';
import { logger } from './logger';

// Supabase client - ONLY authentication method
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Define the user interface
interface User {
  id: string;
  role: string;
  region_id?: string;
  username?: string;
  full_name?: string;
  email?: string;
  [key: string]: any;
}

/**
 * PURE Supabase token verification - No fallbacks, no JWT, no auth service
 * @param token Supabase JWT token to verify
 * @returns User object if valid, null if invalid
 */
export const verifyToken = async (token: string): Promise<User | null> => {
  try {
    logger.debug('Verifying Supabase token for WebSocket connection');
    
    // Verify token with Supabase - ONLY method
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) {
      logger.warn('Supabase WebSocket token verification failed:', error.message);
      return null;
    }
    
    if (!user) {
      logger.warn('No user found in Supabase token');
      return null;
    }
    
    logger.debug(`Supabase WebSocket user verified: ${user.id} (${user.email})`);
    
    // Get user profile from Supabase database
    let profile = null;
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (!profileError && profileData) {
        profile = profileData;
        logger.info(`WebSocket profile found: ${profile.username} (${profile.role})`);
      } else {
        // Use user metadata as fallback
        logger.info('Creating WebSocket profile from user metadata');
        profile = {
          username: user.user_metadata?.username || user.email?.split('@')[0] || 'user',
          role: user.user_metadata?.role || 'OPERATOR',
          region_id: user.user_metadata?.region_id,
          full_name: user.user_metadata?.full_name || 'User'
        };
      }
    } catch (profileError) {
      logger.warn('Profile fetch failed, using user metadata:', profileError);
      profile = {
        username: user.user_metadata?.username || user.email?.split('@')[0] || 'user',
        role: user.user_metadata?.role || 'OPERATOR',
        region_id: user.user_metadata?.region_id,
        full_name: user.user_metadata?.full_name || 'User'
      };
    }
    
    const userData: User = {
      id: user.id,
      role: profile.role,
      region_id: profile.region_id,
      username: profile.username,
      full_name: profile.full_name,
      email: user.email,
      ...profile
    };
    
    logger.info(`WebSocket authentication successful: ${userData.username} (${userData.role})`);
    return userData;
    
  } catch (error) {
    logger.error('WebSocket token verification failed:', error);
    return null;
  }
};
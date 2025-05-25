import { createClient } from '@supabase/supabase-js';
import { logger } from './logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface User {
  id: string;
  role: string;
  region_id?: string;
  username?: string;
  full_name?: string;
  email?: string;
  [key: string]: any;
}

export const verifySupabaseToken = async (token: string): Promise<User | null> => {
  try {
    logger.debug('Verifying Supabase token for WebSocket connection');
    
    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      logger.warn('Supabase WebSocket token verification failed:', error?.message);
      return null;
    }
    
    logger.debug(`Supabase WebSocket user verified: ${user.id} (${user.email})`);
    
    // Extract user data from token metadata
    const userData = user.user_metadata || {};
    
    return {
      id: user.id,
      role: userData.role || 'OPERATOR',
      region_id: userData.region_id,
      username: userData.username || user.email?.split('@')[0],
      full_name: userData.full_name || 'User',
      email: user.email,
    };
  } catch (error) {
    logger.error('Supabase WebSocket token verification error:', error);
    return null;
  }
};

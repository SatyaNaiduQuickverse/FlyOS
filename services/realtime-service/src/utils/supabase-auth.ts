// services/realtime-service/src/utils/supabase-auth.ts
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
  [key: string]: any;
}

export const verifySupabaseToken = async (token: string): Promise<User | null> => {
  try {
    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      logger.warn('Supabase token verification failed:', error?.message);
      return null;
    }
    
    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (profileError || !profile) {
      logger.warn('User profile not found:', profileError?.message);
      return null;
    }
    
    logger.debug(`WebSocket user authenticated: ${profile.username} (${profile.role})`);
    
    return {
      id: user.id,
      role: profile.role,
      region_id: profile.region_id,
      username: profile.username,
      full_name: profile.full_name,
      email: user.email,
      ...profile
    };
  } catch (error) {
    logger.error('Supabase token verification error:', error);
    return null;
  }
};

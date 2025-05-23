// ==============================
// File: lib/api/auth.ts (UPDATE - add compatibility layer)
// ==============================
import { supabase } from '../supabase';
import { User } from '../../types/auth';

// Compatibility layer for existing code
export const authApi = {
  /**
   * Login - now redirects to new email-based login
   * Kept for backward compatibility
   */
  login: async (username: string, password: string) => {
    // For now, we'll assume username is actually email
    // In production, you might want to look up email by username first
    const { data, error } = await supabase.auth.signInWithPassword({
      email: username, // Assuming username is email for now
      password,
    });
    
    if (error) throw new Error(error.message);
    
    return {
      success: true,
      token: data.session?.access_token || '',
      refreshToken: data.session?.refresh_token || '',
      user: data.user,
      sessionId: data.session?.access_token || '',
    };
  },
  
  /**
   * Verify token
   */
  verifyToken: async (): Promise<User> => {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      throw new Error('Invalid token');
    }
    
    // Return user data (you might need to fetch profile here)
    return user as any; // Type assertion for compatibility
  },
  
  /**
   * Refresh token
   */
  refreshToken: async (): Promise<string> => {
    const { data, error } = await supabase.auth.refreshSession();
    
    if (error || !data.session) {
      throw new Error('Failed to refresh token');
    }
    
    return data.session.access_token;
  },
  
  /**
   * Logout
   */
  logout: async (): Promise<void> => {
    await supabase.auth.signOut();
  }
};

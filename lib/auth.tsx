// ==============================
// File: lib/auth.tsx (REPLACE ENTIRELY)
// ==============================
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { User, UserRole, PERMISSIONS } from '../types/auth';

// Profile interface for Supabase
interface Profile {
  id: string;
  username: string;
  role: 'MAIN_HQ' | 'REGIONAL_HQ' | 'OPERATOR';
  region_id?: string;
  full_name: string;
  created_at?: string;
  updated_at?: string;
}

// Auth context type definition
interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  refreshSession: () => Promise<void>;
  clearError: () => void;
}

// Role-based routing map
const ROLE_HOME_ROUTES = {
  [UserRole.MAIN_HQ]: '/secure/main-hq/dashboard',
  [UserRole.REGIONAL_HQ]: '/secure/regional-hq/dashboard',
  [UserRole.OPERATOR]: '/secure/operator/dashboard',
};

// Create the auth context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Authentication Provider component
 * Now uses Supabase for authentication
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Clear authentication error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Convert Supabase profile to our User type
  const convertProfileToUser = (supabaseUser: SupabaseUser, profile: Profile): User => {
    return {
      id: profile.id,
      username: profile.username,
      role: profile.role as UserRole,
      regionId: profile.region_id,
      fullName: profile.full_name,
      email: supabaseUser.email || '',
    };
  };

  // Fetch user profile from Supabase
  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  };

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Get initial session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          setLoading(false);
          return;
        }

        if (session?.user) {
          setToken(session.access_token);
          
          // Fetch user profile
          const profile = await fetchProfile(session.user.id);
          if (profile) {
            const userData = convertProfileToUser(session.user, profile);
            setUser(userData);
            
            // Store user data in localStorage for compatibility
            if (typeof window !== 'undefined') {
              localStorage.setItem('flyos_user', JSON.stringify(userData));
              localStorage.setItem('flyos_token', session.access_token);
            }
          }
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Authentication check error:', error);
        setLoading(false);
      }
    };

    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event);
        
        if (session?.user) {
          setToken(session.access_token);
          
          // Fetch user profile
          const profile = await fetchProfile(session.user.id);
          if (profile) {
            const userData = convertProfileToUser(session.user, profile);
            setUser(userData);
            
            // Store user data in localStorage for compatibility
            if (typeof window !== 'undefined') {
              localStorage.setItem('flyos_user', JSON.stringify(userData));
              localStorage.setItem('flyos_token', session.access_token);
            }
          }
        } else {
          setUser(null);
          setToken(null);
          
          // Clear localStorage
          if (typeof window !== 'undefined') {
            localStorage.removeItem('flyos_user');
            localStorage.removeItem('flyos_token');
            localStorage.removeItem('flyos_refresh_token');
            localStorage.removeItem('flyos_session_id');
          }
        }
        
        setLoading(false);
      }
    );

    return () => subscription?.unsubscribe();
  }, []);

  /**
   * Login function - now uses email instead of username
   */
  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    
    try {
      // Sign in with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        setError(error.message);
        return false;
      }
      
      if (data.user && data.session) {
        setToken(data.session.access_token);
        
        // Fetch user profile
        const profile = await fetchProfile(data.user.id);
        if (profile) {
          const userData = convertProfileToUser(data.user, profile);
          setUser(userData);
          
          // Store user data in localStorage for compatibility
          if (typeof window !== 'undefined') {
            localStorage.setItem('flyos_user', JSON.stringify(userData));
            localStorage.setItem('flyos_token', data.session.access_token);
            // Store refresh token for compatibility (though Supabase handles this)
            localStorage.setItem('flyos_refresh_token', data.session.refresh_token || '');
          }
          
          // Check for redirect URL
          const redirectUrl = localStorage.getItem('flyos_redirect_after_login');
          if (redirectUrl) {
            localStorage.removeItem('flyos_redirect_after_login');
            router.push(redirectUrl);
          } else {
            // Redirect based on role
            router.push(ROLE_HOME_ROUTES[userData.role as keyof typeof ROLE_HOME_ROUTES]);
          }
          
          return true;
        } else {
          setError('User profile not found');
          return false;
        }
      }
      
      return false;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [router]);

  /**
   * Logout function
   */
  const logout = useCallback(async (): Promise<void> => {
    setLoading(true);
    
    try {
      // Sign out from Supabase
      await supabase.auth.signOut();
      
      // Clear local state
      setUser(null);
      setToken(null);
      
      // Clear localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('flyos_user');
        localStorage.removeItem('flyos_token');
        localStorage.removeItem('flyos_refresh_token');
        localStorage.removeItem('flyos_session_id');
        localStorage.removeItem('flyos_redirect_after_login');
      }
      
      // Redirect to login page
      router.push('/auth/login');
    } catch (error) {
      console.error('Logout error:', error);
      
      // Still clear state and redirect on error
      setUser(null);
      setToken(null);
      router.push('/auth/login');
    } finally {
      setLoading(false);
    }
  }, [router]);

  /**
   * Refresh session - Supabase handles this automatically, but we expose for compatibility
   */
  const refreshSession = useCallback(async (): Promise<void> => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('Session refresh error:', error);
        await logout();
        return;
      }
      
      if (data.session?.access_token) {
        setToken(data.session.access_token);
        
        // Update localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('flyos_token', data.session.access_token);
        }
      }
    } catch (error) {
      console.error('Session refresh error:', error);
      await logout();
    }
  }, [logout]);

  /**
   * Permission check function - unchanged from original
   */
  const hasPermission = useCallback((permission: string): boolean => {
    if (!user) return false;
    
    const rolePermissions = PERMISSIONS[user.role];
    if (!rolePermissions) return false;
    
    // Check if permission exists for user's role
    return Object.prototype.hasOwnProperty.call(rolePermissions, permission) && 
           rolePermissions[permission as keyof typeof rolePermissions] === true;
  }, [user]);

  // Create context value
  const contextValue: AuthContextType = {
    user,
    token,
    loading,
    error,
    login,
    logout,
    hasPermission,
    refreshSession,
    clearError
  };

  // Render provider with context value
  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Custom hook to use auth context
 */
export function useAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}

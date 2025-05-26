// lib/auth.tsx - UPDATED WITH LOGIN HISTORY SUPPORT
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from './supabase';

// User interface matching your requirements
export interface User {
  id: string;
  username: string;
  role: 'MAIN_HQ' | 'REGIONAL_HQ' | 'OPERATOR';
  regionId?: string;
  fullName: string;
  email: string;
}

// Auth context interface
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

// Role-based routing
const ROLE_ROUTES = {
  'MAIN_HQ': '/secure/main-hq/dashboard',
  'REGIONAL_HQ': '/secure/regional-hq/dashboard',
  'OPERATOR': '/secure/operator/dashboard',
} as const;

// Permissions system
const PERMISSIONS = {
  'MAIN_HQ': {
    view_all: true,
    control_all: true,
    manage_users: true,
    view_system_logs: true,
  },
  'REGIONAL_HQ': {
    view_region: true,
    control_region: true,
    manage_operators: true,
  },
  'OPERATOR': {
    view_assigned: true,
    control_assigned: true,
  },
} as const;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loginHistoryId, setLoginHistoryId] = useState<string | null>(null);
  const router = useRouter();

  const clearError = useCallback(() => setError(null), []);

  // Convert auth user to our User type
  const createUserFromAuth = useCallback((authUser: SupabaseUser, profileData?: any): User => {
    const emailUsername = authUser.email?.split('@')[0] || 'user';
    
    return {
      id: authUser.id,
      username: profileData?.username || authUser.user_metadata?.username || emailUsername,
      role: profileData?.role || authUser.user_metadata?.role || 'OPERATOR',
      regionId: profileData?.region_id || authUser.user_metadata?.region_id,
      fullName: profileData?.full_name || authUser.user_metadata?.full_name || 'User',
      email: authUser.email || '',
    };
  }, []);

  // Record logout in login history
  const recordLogout = useCallback(async () => {
    if (!loginHistoryId || !token) return;
    
    try {
      const response = await fetch('/api/auth/login-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ loginHistoryId })
      });
      
      if (response.ok) {
        console.log('Logout recorded successfully');
      } else {
        console.warn('Failed to record logout');
      }
    } catch (error) {
      console.warn('Error recording logout:', error);
    }
  }, [loginHistoryId, token]);

  // Initialize auth state
  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        // Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          if (isMounted) {
            setError('Session initialization failed');
            setLoading(false);
          }
          return;
        }

        if (session?.user && isMounted) {
          // Try to get profile, but don't block on it
          let profileData = null;
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
            profileData = profile;
          } catch (profileError) {
            console.warn('Could not fetch profile, using auth metadata');
          }

          const userData = createUserFromAuth(session.user, profileData);
          setUser(userData);
          setToken(session.access_token);
          
          // Store in localStorage for compatibility
          localStorage.setItem('flyos_user', JSON.stringify(userData));
          localStorage.setItem('flyos_token', session.access_token);
          
          // Try to get login history ID from localStorage
          const storedLoginHistoryId = localStorage.getItem('flyos_login_history_id');
          if (storedLoginHistoryId) {
            setLoginHistoryId(storedLoginHistoryId);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (isMounted) {
          setError('Authentication initialization failed');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      console.log('Auth event:', event);

      if (event === 'SIGNED_IN' && session?.user) {
        // Get profile data if available
        let profileData = null;
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          profileData = profile;
        } catch (profileError) {
          console.warn('Profile fetch failed, using auth metadata');
        }

        const userData = createUserFromAuth(session.user, profileData);
        setUser(userData);
        setToken(session.access_token);
        
        localStorage.setItem('flyos_user', JSON.stringify(userData));
        localStorage.setItem('flyos_token', session.access_token);
      } else if (event === 'SIGNED_OUT') {
        // Record logout before clearing state
        await recordLogout();
        
        setUser(null);
        setToken(null);
        setLoginHistoryId(null);
        localStorage.removeItem('flyos_user');
        localStorage.removeItem('flyos_token');
        localStorage.removeItem('flyos_login_history_id');
      } else if (event === 'TOKEN_REFRESHED' && session) {
        setToken(session.access_token);
        localStorage.setItem('flyos_token', session.access_token);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [createUserFromAuth, recordLogout]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      // Use our custom login API that records history
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Login failed');
        setLoading(false);
        return false;
      }

      if (data.success && data.user) {
        setUser(data.user);
        setToken(data.token);
        
        // Store login history ID for logout tracking
        if (data.loginHistoryId) {
          setLoginHistoryId(data.loginHistoryId);
          localStorage.setItem('flyos_login_history_id', data.loginHistoryId);
        }
        
        localStorage.setItem('flyos_user', JSON.stringify(data.user));
        localStorage.setItem('flyos_token', data.token);

        // Navigate to appropriate dashboard
        const route = ROLE_ROUTES[data.user.role as keyof typeof ROLE_ROUTES];
        router.push(route);
        
        setLoading(false);
        return true;
      }

      setLoading(false);
      return false;
    } catch (error) {
      console.error('Login error:', error);
      setError('Login failed. Please try again.');
      setLoading(false);
      return false;
    }
  }, [router]);

  const logout = useCallback(async () => {
    try {
      // Record logout first
      await recordLogout();
      
      // Then sign out from Supabase
      await supabase.auth.signOut();
      
      setUser(null);
      setToken(null);
      setLoginHistoryId(null);
      localStorage.removeItem('flyos_user');
      localStorage.removeItem('flyos_token');
      localStorage.removeItem('flyos_login_history_id');
      router.push('/auth/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout anyway
      setUser(null);
      setToken(null);
      setLoginHistoryId(null);
      localStorage.removeItem('flyos_user');
      localStorage.removeItem('flyos_token');
      localStorage.removeItem('flyos_login_history_id');
      router.push('/auth/login');
    }
  }, [router, recordLogout]);

  const refreshSession = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        console.error('Session refresh failed:', error);
        await logout();
      } else if (data.session) {
        setToken(data.session.access_token);
        localStorage.setItem('flyos_token', data.session.access_token);
      }
    } catch (error) {
      console.error('Session refresh error:', error);
      await logout();
    }
  }, [logout]);

  const hasPermission = useCallback((permission: string): boolean => {
    if (!user) return false;
    const rolePermissions = PERMISSIONS[user.role];
    return rolePermissions?.[permission as keyof typeof rolePermissions] || false;
  }, [user]);

  const value: AuthContextType = {
    user,
    token,
    loading,
    error,
    login,
    logout,
    hasPermission,
    refreshSession,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
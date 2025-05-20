// lib/auth.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { User, UserRole, PERMISSIONS } from '../types/auth';
import { authApi } from './api/auth';

// Auth context type definition
interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<boolean>;
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
 * Manages auth state and provides authentication methods
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Rename unused variable with underscore prefix
  const [_sessionChecked, setSessionChecked] = useState(false);
  const [refreshTimer, setRefreshTimer] = useState<NodeJS.Timeout | null>(null);
  const router = useRouter();

  // Clear authentication error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Setup token refresh timer
  const setupRefreshTimer = useCallback((expiresIn: number = 55 * 60 * 1000) => {
    // Clear existing timer if any
    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }
    
    // Set new timer to refresh 5 minutes before expiry
    // Default expiry is 1 hour, refresh after 55 minutes
    const timer = setTimeout(async () => {
      console.log('Auto refreshing token...');
      try {
        await authApi.refreshToken();
        console.log('Token refreshed automatically');
        
        // Reset timer for next refresh
        setupRefreshTimer();
      } catch (error) {
        console.error('Auto token refresh failed:', error);
        // Don't logout on refresh failure - let the interceptor handle it
      }
    }, expiresIn);
    
    setRefreshTimer(timer);
    return timer;
  }, [refreshTimer]);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Skip on server side
        if (typeof window === 'undefined') {
          setLoading(false);
          return;
        }

        // Check for existing token in localStorage
        const storedToken = localStorage.getItem('flyos_token');
        const storedUser = localStorage.getItem('flyos_user');
        
        // If no token, clear session and exit
        if (!storedToken) {
          setLoading(false);
          setSessionChecked(true);
          return;
        }

        // Set token in state
        setToken(storedToken);

        // Set user from localStorage while we verify the token
        if (storedUser) {
          try {
            setUser(JSON.parse(storedUser));
          } catch (parseError) {
            console.error('Failed to parse stored user:', parseError);
          }
        }

        // Verify token with backend
        try {
          console.log('Verifying existing token...');
          const userData = await authApi.verifyToken();
          
          // Update user state with fresh data from server
          setUser(userData);
          
          // Update localStorage with fresh data
          localStorage.setItem('flyos_user', JSON.stringify(userData));
          
          console.log('Session verified successfully');
          
          // Setup refresh timer
          setupRefreshTimer();
        } catch (verifyError) {
          console.error('Token verification failed:', verifyError);
          
          // Try to refresh the token if verification fails
          try {
            console.log('Attempting to refresh token after verification failure');
            const newToken = await authApi.refreshToken();
            if (newToken) {
              // Token refreshed, update state
              setToken(newToken);
              
              // Token refreshed, try to get user data again
              const userData = await authApi.verifyToken();
              setUser(userData);
              localStorage.setItem('flyos_user', JSON.stringify(userData));
              console.log('Session refreshed successfully');
              
              // Setup refresh timer
              setupRefreshTimer();
            } else {
              throw new Error('Token refresh failed');
            }
          } catch (refreshError) {
            // Both verification and refresh failed, clear session
            console.error('Token refresh failed:', refreshError);
            localStorage.removeItem('flyos_user');
            localStorage.removeItem('flyos_token');
            localStorage.removeItem('flyos_refresh_token');
            setToken(null);
            setUser(null);
          }
        }
      } catch (error) {
        console.error('Authentication session error:', error);
        
        // Clear invalid session data
        localStorage.removeItem('flyos_user');
        localStorage.removeItem('flyos_token');
        localStorage.removeItem('flyos_refresh_token');
        
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
        setSessionChecked(true);
      }
    };

    checkAuth();
    
    // Cleanup refresh timer on unmount
    return () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
    };
  }, [setupRefreshTimer]);

/**
 * Login function
 */
const login = useCallback(async (username: string, password: string): Promise<boolean> => {
  setLoading(true);
  setError(null);
  
  try {
    // Call login API
    const response = await authApi.login(username, password);
    
    // Set user in state
    setUser(response.user);
    setToken(response.token);
    
    // Store tokens (handled in authApi.login, but double check here)
    if (typeof window !== 'undefined') {
      localStorage.setItem('flyos_token', response.token);
      localStorage.setItem('flyos_refresh_token', response.refreshToken);
      localStorage.setItem('flyos_user', JSON.stringify(response.user));
      localStorage.setItem('flyos_session_id', response.sessionId);
    }
    
    // Setup refresh timer
    setupRefreshTimer();
    
    // Check for redirect URL
    const redirectUrl = localStorage.getItem('flyos_redirect_after_login');
    if (redirectUrl) {
      localStorage.removeItem('flyos_redirect_after_login');
      router.push(redirectUrl);
    } else {
      // Redirect to appropriate dashboard based on role
      router.push(ROLE_HOME_ROUTES[response.user.role as keyof typeof ROLE_HOME_ROUTES]);
    }
    
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
    setError(errorMessage);
    setToken(null);
    return false;
  } finally {
    setLoading(false);
  }
}, [router, setupRefreshTimer]);

  /**
   * Logout function
   */
  const logout = useCallback(async (): Promise<void> => {
    setLoading(true);
    
    try {
      // Clear refresh timer if exists
      if (refreshTimer) {
        clearTimeout(refreshTimer);
        setRefreshTimer(null);
      }
      
      // Call logout API
      await authApi.logout();
      
      // Clear user state
      setUser(null);
      setToken(null);
      
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
  }, [router, refreshTimer]);

  /**
   * Refresh session
   * Verifies current token and refreshes user data
   */
  const refreshSession = useCallback(async (): Promise<void> => {
    try {
      // Skip if no user
      if (!user) return;
      
      // Verify token and get fresh user data
      try {
        const userData = await authApi.verifyToken();
        
        // Update user state
        setUser(userData);
        
        // Update localStorage
        localStorage.setItem('flyos_user', JSON.stringify(userData));
        
        // Reset refresh timer
        setupRefreshTimer();
      } catch (verifyError) {
        console.error('Session verification failed:', verifyError);
        
        // Try to refresh the token if verification fails
        try {
          const newToken = await authApi.refreshToken();
          if (newToken) {
            // Update token state
            setToken(newToken);
            
            // Token refreshed, try to get user data again
            const userData = await authApi.verifyToken();
            setUser(userData);
            localStorage.setItem('flyos_user', JSON.stringify(userData));
            console.log('Session refreshed successfully');
            
            // Setup refresh timer
            setupRefreshTimer();
          } else {
            // If token is invalid, logout
            await logout();
          }
        } catch (refreshError) {
          // If token is invalid, logout
          console.error('Token refresh failed:', refreshError);
          await logout();
        }
      }
    } catch (error) {
      console.error('Session refresh error:', error);
      await logout();
    }
  }, [user, logout, setupRefreshTimer]);

  /**
   * Permission check function
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
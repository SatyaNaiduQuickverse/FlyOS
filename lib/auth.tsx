'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { User, UserRole, PERMISSIONS } from '../types/auth';
import { authApi } from './api/auth';

// Auth context type definition
interface AuthContextType {
  user: User | null;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Clear authentication error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Skip on server side
        if (typeof window === 'undefined') {
          setLoading(false);
          return;
        }

        // Check for existing user in localStorage (for backward compatibility)
        const storedUser = localStorage.getItem('flyos_user');
        const token = localStorage.getItem('flyos_token');
        
        // If no token, clear session and exit
        if (!token) {
          setLoading(false);
          return;
        }

        // Set user from localStorage while we verify the token
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }

        // Verify token with backend
        const userData = await authApi.verifyToken();
        
        // Update user state with fresh data from server
        setUser(userData);
        
        // Update localStorage with fresh data
        localStorage.setItem('flyos_user', JSON.stringify(userData));
      } catch (error) {
        console.error('Authentication session error:', error);
        
        // Clear invalid session data
        localStorage.removeItem('flyos_user');
        localStorage.removeItem('flyos_token');
        
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Set up token refresh interval
  useEffect(() => {
    // Skip on server side
    if (typeof window === 'undefined') return;
    
    // If no user, don't set up refresh interval
    if (!user) return;
    
    // Refresh token every 30 minutes
    const refreshInterval = setInterval(async () => {
      try {
        await authApi.refreshToken();
      } catch (error) {
        console.error('Token refresh error:', error);
        // Don't log user out on refresh failure - let the interceptor handle it
      }
    }, 30 * 60 * 1000); // 30 minutes in milliseconds
    
    // Clear interval on unmount
    return () => clearInterval(refreshInterval);
  }, [user]);

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
      // Call logout API
      await authApi.logout();
      
      // Clear user state
      setUser(null);
      
      // Redirect to login page
      router.push('/auth/login');
    } catch (error) {
      console.error('Logout error:', error);
      
      // Still clear state and redirect on error
      setUser(null);
      router.push('/auth/login');
    } finally {
      setLoading(false);
    }
  }, [router]);

  /**
   * Refresh session
   * Verifies current token and refreshes user data
   */
  const refreshSession = useCallback(async (): Promise<void> => {
    try {
      // Skip if no user
      if (!user) return;
      
      // Verify token and get fresh user data
      const userData = await authApi.verifyToken();
      
      // Update user state
      setUser(userData);
      
      // Update localStorage
      localStorage.setItem('flyos_user', JSON.stringify(userData));
    } catch (error) {
      console.error('Session refresh error:', error);
      
      // If token is invalid, logout
      if (error instanceof Error && error.message === 'Invalid authentication session') {
        await logout();
      }
    }
  }, [user, logout]);

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

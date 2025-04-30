'use client';

import React from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, UserRole, PERMISSIONS } from '../types/auth';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

// Create context with undefined default value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Role-based routing map
const ROLE_HOME_ROUTES = {
  [UserRole.MAIN_HQ]: '/secure/main-hq/dashboard',
  [UserRole.REGIONAL_HQ]: '/secure/regional-hq/dashboard',
  [UserRole.OPERATOR]: '/secure/operator/dashboard',
};

// Auth Provider component
export function AuthProvider(props: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Check for existing session on client side only
  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (typeof window !== 'undefined') {
          const storedUser = localStorage.getItem('flyos_user');
          if (storedUser) {
            setUser(JSON.parse(storedUser));
          }
        }
      } catch (error) {
        console.error('Authentication error:', error);
        setError('Failed to restore authentication session');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Login function
  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Authentication failed');
      }

      setUser(data.user);
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('flyos_user', JSON.stringify(data.user));
        localStorage.setItem('flyos_token', data.token);
      }

      // Fix for TypeScript error
      router.push(ROLE_HOME_ROUTES[data.user.role as keyof typeof ROLE_HOME_ROUTES]);
      return true;
    } catch (error: unknown) {
      if (error instanceof Error) {
        setError(error.message || 'Authentication failed');
      } else {
        setError('Authentication failed');
      }
      return false;
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Logout function
  const logout = useCallback(() => {
    setUser(null);
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('flyos_user');
      localStorage.removeItem('flyos_token');
    }
    
    router.push('/auth/login');
  }, [router]);

  // Permission check function with fixed TypeScript error
  const hasPermission = useCallback((permission: string): boolean => {
    if (!user) return false;
    
    // Type assertion to fix TypeScript error
    const rolePermissions = PERMISSIONS[user.role];
    // Check if the permission exists in the role's permissions
    return (permission in rolePermissions) && rolePermissions[permission as keyof typeof rolePermissions] === true;
  }, [user]);

  // Create context value
  const contextValue = {
    user,
    loading,
    error,
    login,
    logout,
    hasPermission
  };

  // Use createElement instead of JSX
  return React.createElement(
    AuthContext.Provider,
    { value: contextValue },
    props.children
  );
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

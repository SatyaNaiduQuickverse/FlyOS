'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth';
import { UserRole } from '../types/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requireAuth?: boolean;
}

/**
 * Protected Route Component
 * Ensures pages are only accessible to authenticated users with appropriate roles
 */
export default function ProtectedRoute({ 
  children, 
  allowedRoles = [], 
  requireAuth = true
}: ProtectedRouteProps) {
  const { user, loading, refreshSession } = useAuth();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    // Skip authorization check if auth is not required
    if (!requireAuth) {
      setAuthorized(true);
      return;
    }
    
    // If still loading auth state, don't redirect yet
    if (loading) return;
    
    const checkAuthorization = async () => {
      // If no user is logged in, redirect to login
      if (!user) {
        // Save current path for redirect after login
        if (typeof window !== 'undefined') {
          const currentPath = window.location.pathname + window.location.search;
          localStorage.setItem('flyos_redirect_after_login', currentPath);
        }
        
        router.push('/auth/login');
        return;
      }
      
      // If specific roles are required, check user role
      if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        // Redirect to appropriate dashboard based on role
        router.push(`/secure/${user.role.toLowerCase().replace('_', '-')}/dashboard`);
        return;
      }
      
      // Refresh session to ensure token is valid and user data is fresh
      try {
        await refreshSession();
        // User is authorized
        setAuthorized(true);
      } catch (error) {
        console.error('Authorization error:', error);
        // Session refresh failed, redirect to login
        router.push('/auth/login');
      }
    };
    
    checkAuthorization();
  }, [user, loading, router, allowedRoles, requireAuth, refreshSession]);

  // Show loading state while checking authorization
  if (requireAuth && (loading || !authorized)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-2xl text-white">
          <div className="animate-pulse flex flex-col items-center">
            <div className="h-12 w-12 mb-4 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <div>Loading secure environment...</div>
          </div>
        </div>
      </div>
    );
  }

  // Render children if authorized or auth not required
  return <>{children}</>;
}

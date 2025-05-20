// app/secure/layout.tsx
'use client';

import { useAuth } from '../../lib/auth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function SecureLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, token, loading, refreshSession } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sessionChecked, setSessionChecked] = useState(false);

  // First-level authentication check
  useEffect(() => {
    if (!loading && !user) {
      // If not authenticated and not loading, redirect to login
      console.log('No authenticated user found, redirecting to login');
      router.push(`/auth/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [user, loading, router, pathname]);

  // Deep token validation on mount
  useEffect(() => {
    const validateSession = async () => {
      if (!loading && user && token) {
        try {
          console.log('Performing deep session validation');
          await refreshSession();
          console.log('Session validated successfully');
        } catch (error) {
          console.error('Session validation failed:', error);
          // refreshSession will handle redirects if token is invalid
        } finally {
          setSessionChecked(true);
        }
      } else {
        setSessionChecked(true);
      }
    };

    validateSession();
  }, [loading, user, token, refreshSession]);

  // Show loading state while checking authentication or validating session
  if (loading || !sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
          <div className="text-white text-xl">Verifying authentication...</div>
        </div>
      </div>
    );
  }

  // If user is authenticated, render children
  return user ? <>{children}</> : null;
}
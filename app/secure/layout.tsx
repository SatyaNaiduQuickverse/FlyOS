'use client';

import { useAuth } from '../../lib/auth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

export default function SecureLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      // If not authenticated and not loading, redirect to login
      router.push(`/auth/login?redirect=${pathname}`);
    }
  }, [user, loading, router, pathname]);

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  // If user is authenticated, render children
  return user ? <>{children}</> : null;
}
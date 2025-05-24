// app/secure/layout.tsx - PROFESSIONAL VERSION
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
      console.log('No authenticated user, redirecting to login');
      router.push('/auth/login');
    }
  }, [user, loading, router]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
          <div className="text-white text-xl">Authenticating...</div>
        </div>
      </div>
    );
  }

  // No user state
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-xl">Redirecting...</div>
      </div>
    );
  }

  // Authenticated - render content
  return <>{children}</>;
}

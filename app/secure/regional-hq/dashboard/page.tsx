// app/secure/regional-hq/dashboard/page.tsx
'use client';

import { useAuth } from '../../../../lib/auth';
import { UserRole } from '../../../../types/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function RegionalHQDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();

  // Check role-specific access
  useEffect(() => {
    if (user && user.role !== UserRole.REGIONAL_HQ) {
      router.push(`/secure/${user.role.toLowerCase().replace('_', '-')}/dashboard`);
    }
  }, [user, router]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold">Regional HQ: {user.regionId?.toUpperCase()}</h1>
          <div className="flex items-center">
            <span className="mr-4">{user.fullName}</span>
            <button 
              onClick={logout}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-md text-sm font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="bg-gray-800 shadow-lg rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Welcome to the Regional Command Dashboard</h2>
          <p className="mb-4">This is a protected page for Regional HQ users only.</p>
          <div className="bg-gray-700 p-4 rounded-md">
            <h3 className="font-medium mb-2">User Details:</h3>
            <p>ID: {user.id}</p>
            <p>Username: {user.username}</p>
            <p>Role: {user.role}</p>
            <p>Region: {user.regionId}</p>
            <p>Email: {user.email}</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold mb-4">Regional Fleet</h3>
            <div className="text-4xl font-bold text-blue-500">47</div>
            <p className="text-gray-400">Drones in your region</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold mb-4">Active Missions</h3>
            <div className="text-4xl font-bold text-green-500">12</div>
            <p className="text-gray-400">Current operations</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold mb-4">Field Operators</h3>
            <div className="text-4xl font-bold text-yellow-500">8</div>
            <p className="text-gray-400">Active field personnel</p>
          </div>
        </div>
        
        <div className="mt-6">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold mb-4">Regional Territory Map</h3>
            <div className="bg-gray-700 h-64 rounded-lg flex items-center justify-center">
              <p className="text-gray-400">Interactive map will be displayed here</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
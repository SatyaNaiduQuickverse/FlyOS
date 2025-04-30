// app/secure/operator/dashboard/page.tsx
'use client';

import { useAuth } from '../../../../lib/auth';
import { UserRole } from '../../../../types/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function OperatorDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();

  // Check role-specific access
  useEffect(() => {
    if (user && user.role !== UserRole.OPERATOR) {
      router.push(`/secure/${user.role.toLowerCase().replace('_', '-')}/dashboard`);
    }
  }, [user, router]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold">Field Operator Console</h1>
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
          <h2 className="text-xl font-semibold mb-4">Welcome to the Field Operator Console</h2>
          <p className="mb-4">This is a protected page for field operators only.</p>
          <div className="bg-gray-700 p-4 rounded-md">
            <h3 className="font-medium mb-2">User Details:</h3>
            <p>ID: {user.id}</p>
            <p>Username: {user.username}</p>
            <p>Role: {user.role}</p>
            <p>Assigned Region: {user.regionId}</p>
            <p>Email: {user.email}</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-6 mt-6">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold mb-4">Assigned Drones</h3>
            <div className="text-4xl font-bold text-blue-500">3</div>
            <p className="text-gray-400">Under your control</p>
          </div>
          
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold mb-4">Current Mission</h3>
            <div className="bg-blue-900 text-white p-4 rounded-lg">
              <div className="font-bold">Surveillance Operation #42</div>
              <div className="text-sm text-gray-300 mt-1">Sector: East Quadrant</div>
              <div className="flex justify-between mt-3">
                <div>
                  <div className="text-xs text-gray-400">Status</div>
                  <div className="text-green-400 font-medium">Active</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Duration</div>
                  <div>03:42:18</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Command</div>
                  <div>Eastern HQ</div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold mb-4">Field Map</h3>
            <div className="bg-gray-700 h-64 flex items-center justify-center rounded-lg">
              <p className="text-gray-400">Interactive map will be displayed here</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <button className="bg-blue-600 hover:bg-blue-700 p-3 rounded-lg text-sm font-medium">
                View Drone Locations
              </button>
              <button className="bg-gray-700 hover:bg-gray-600 p-3 rounded-lg text-sm font-medium">
                Show Terrain Details
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
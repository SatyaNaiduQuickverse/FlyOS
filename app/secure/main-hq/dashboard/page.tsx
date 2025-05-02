'use client';

import { useAuth } from '../../../../lib/auth';
import { UserRole } from '../../../../types/auth';
import LoginHistoryTable from '../../../../components/LoginHistoryTable';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MainHQDashboard() {
  const { user, logout } = useAuth();
  const [showLoginHistory, setShowLoginHistory] = useState(false);
  const router = useRouter();

  // Check role-specific access - consistent with other dashboards
  useEffect(() => {
    if (user && user.role !== UserRole.MAIN_HQ) {
      router.push(`/secure/${user.role.toLowerCase().replace('_', '-')}/dashboard`);
    }
  }, [user, router]);

  // Add debug logging
  useEffect(() => {
    console.log('Main HQ Dashboard - User:', user);
  }, [user]);

  // Return null if user not loaded yet
  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold">Main HQ Command Center</h1>
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
          <h2 className="text-xl font-semibold mb-4">Welcome to the Main HQ Dashboard</h2>
          <p className="mb-4">You have top-level access to the drone control system.</p>
          <div className="bg-gray-700 p-4 rounded-md mb-6">
            <h3 className="font-medium mb-2">User Details:</h3>
            <p>ID: {user.id}</p>
            <p>Username: {user.username}</p>
            <p>Role: {user.role}</p>
            <p>Email: {user.email}</p>
          </div>
          
          <button
            onClick={() => setShowLoginHistory(!showLoginHistory)}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md text-sm font-medium mb-6"
          >
            {showLoginHistory ? 'Hide Login History' : 'Show Login History'}
          </button>
          
          {showLoginHistory && (
            <LoginHistoryTable 
              title="System-wide Login History" 
              showAllUsers={true} // Explicitly tell component to show all users
            />
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold mb-4">Global Fleet Status</h3>
            <div className="text-4xl font-bold text-blue-500">142</div>
            <p className="text-gray-400">Total drones deployed</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold mb-4">Active Missions</h3>
            <div className="text-4xl font-bold text-green-500">38</div>
            <p className="text-gray-400">Operations in progress</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold mb-4">Regional Commands</h3>
            <div className="text-4xl font-bold text-purple-500">4</div>
            <p className="text-gray-400">Active command centers</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-6 mt-6">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold mb-4">Security Status</h3>
            <div className="flex items-center mb-4">
              <div className="w-4 h-4 rounded-full bg-green-500 mr-2"></div>
              <span>System authentication status: Online</span>
            </div>
            <div className="flex items-center mb-4">
              <div className="w-4 h-4 rounded-full bg-green-500 mr-2"></div>
              <span>Token refresh service: Active</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 rounded-full bg-green-500 mr-2"></div>
              <span>Login monitoring: Enabled</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

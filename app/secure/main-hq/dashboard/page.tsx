// app/secure/main-hq/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../../lib/auth';
import { UserRole } from '../../../../types/auth';
import { useRouter } from 'next/navigation';
import LoginHistoryTable from '../../../../components/LoginHistoryTable';
import RegionalConsole from '../../../../components/RegionalConsole';
import UserManagement from '../../../../components/UserManagement';
import { 
  LayoutGrid as LayoutGridIcon, 
  Users as UsersIcon,
  Shield as ShieldIcon,
  Bell as BellIcon, 
  CircleAlert as CircleAlertIcon,
  Server as ServerIcon,
  ArrowRightCircle as ArrowRightCircleIcon,
  LineChart as LineChartIcon,
  ShieldOff as ShieldOffIcon 
} from 'lucide-react';

interface Alert {
  id: number;
  type: 'critical' | 'warning' | 'info';
  message: string;
  time: string;
}

export default function MainHQDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [showLoginHistory, setShowLoginHistory] = useState<boolean>(false);
  const [alerts, setAlerts] = useState<Alert[]>([
    { id: 1, type: 'warning', message: 'Drone drone-003 scheduled for maintenance in 2 days', time: '10:15 AM' },
    { id: 2, type: 'critical', message: 'Unauthorized access attempt detected from 198.51.100.24', time: '09:42 AM' },
    { id: 3, type: 'info', message: 'System update completed successfully', time: 'Yesterday' },
  ]);
  const router = useRouter();

  // Check role-specific access
  useEffect(() => {
    if (user && user.role !== UserRole.MAIN_HQ) {
      router.push(`/secure/${user.role.toLowerCase().replace('_', '-')}/dashboard`);
    }
  }, [user, router]);

  // Return null if user not loaded yet
  if (!user) return null;

  const dismissAlert = (id: number) => {
    setAlerts(alerts.filter(alert => alert.id !== id));
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold">Main HQ Command Center</h1>
          <div className="flex items-center">
            <div className="mr-4 flex items-center gap-2">
              <div className="relative">
                <BellIcon className="h-6 w-6 text-gray-400 hover:text-white cursor-pointer" />
                {alerts.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                    {alerts.length}
                  </span>
                )}
              </div>
              <span className="text-sm bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full border border-blue-500/30">
                {user.fullName}
              </span>
            </div>
            <button 
              onClick={logout}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      
      {/* Tabs */}
      <div className="bg-gray-800/60 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex overflow-x-auto py-2 no-scrollbar">
            <button 
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 mx-1 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2
                ${activeTab === 'overview' 
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'}`}
            >
              <LayoutGridIcon className="h-4 w-4" />
              Overview
            </button>
            <button 
              onClick={() => setActiveTab('regional')}
              className={`px-4 py-2 mx-1 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2
                ${activeTab === 'regional' 
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'}`}
            >
              <ShieldIcon className="h-4 w-4" />
              Regional Management
            </button>
            <button 
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 mx-1 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2
                ${activeTab === 'users' 
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'}`}
            >
              <UsersIcon className="h-4 w-4" />
              User Management
            </button>
            <button 
              onClick={() => {
                setActiveTab('logs');
                setShowLoginHistory(true);
              }}
              className={`px-4 py-2 mx-1 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2
                ${activeTab === 'logs' 
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'}`}
            >
              <ServerIcon className="h-4 w-4" />
              System Logs
            </button>
          </div>
        </div>
      </div>
      
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Alert messages */}
        {alerts.length > 0 && activeTab === 'overview' && (
          <div className="mb-6 space-y-3">
            {alerts.map(alert => (
              <div 
                key={alert.id} 
                className={`p-4 rounded-lg flex items-center justify-between
                  ${alert.type === 'critical' 
                    ? 'bg-red-500/10 border border-red-500/30 text-red-300' 
                    : alert.type === 'warning'
                      ? 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-300'
                      : 'bg-blue-500/10 border border-blue-500/30 text-blue-300'}`}
              >
                <div className="flex items-center gap-3">
                  {alert.type === 'critical' ? (
                    <CircleAlertIcon className="h-5 w-5" />
                  ) : alert.type === 'warning' ? (
                    <ShieldOffIcon className="h-5 w-5" />
                  ) : (
                    <LineChartIcon className="h-5 w-5" />
                  )}
                  <div>
                    <p className="font-light tracking-wider">{alert.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{alert.time}</p>
                  </div>
                </div>
                <button 
                  onClick={() => dismissAlert(alert.id)}
                  className="text-gray-400 hover:text-white p-1"
                >
                  <ArrowRightCircleIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <>
            <div className="bg-gray-800 shadow-lg rounded-lg p-6 mb-6">
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
                onClick={() => {
                  setShowLoginHistory(!showLoginHistory);
                  if (!showLoginHistory) setActiveTab('logs');
                }}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md text-sm font-medium mb-6 transition-colors"
              >
                {showLoginHistory ? 'Hide Login History' : 'Show Login History'}
              </button>
              
              {showLoginHistory && (
                <LoginHistoryTable 
                  title="System-wide Login History" 
                  showAllUsers={true}
                />
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
                <h3 className="text-xl font-semibold mb-4">Global Fleet Status</h3>
                <div className="text-4xl font-bold text-blue-500">142</div>
                <p className="text-gray-400">Total drones deployed</p>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="bg-green-500/20 rounded-lg p-2 border border-green-500/30">
                    <div className="text-green-400 font-bold">119</div>
                    <div className="text-xs text-gray-400">ACTIVE</div>
                  </div>
                  <div className="bg-yellow-500/20 rounded-lg p-2 border border-yellow-500/30">
                    <div className="text-yellow-400 font-bold">14</div>
                    <div className="text-xs text-gray-400">MAINTENANCE</div>
                  </div>
                  <div className="bg-red-500/20 rounded-lg p-2 border border-red-500/30">
                    <div className="text-red-400 font-bold">9</div>
                    <div className="text-xs text-gray-400">OFFLINE</div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
                <h3 className="text-xl font-semibold mb-4">Active Missions</h3>
                <div className="text-4xl font-bold text-green-500">38</div>
                <p className="text-gray-400">Operations in progress</p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="bg-gray-700 rounded-lg p-2 flex flex-col items-center justify-center">
                    <div className="text-blue-400 font-bold">24</div>
                    <div className="text-xs text-gray-400">SURVEILLANCE</div>
                  </div>
                  <div className="bg-gray-700 rounded-lg p-2 flex flex-col items-center justify-center">
                    <div className="text-purple-400 font-bold">14</div>
                    <div className="text-xs text-gray-400">TRANSPORT</div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
                <h3 className="text-xl font-semibold mb-4">Regional Commands</h3>
                <div className="text-4xl font-bold text-purple-500">4</div>
                <p className="text-gray-400">Active command centers</p>
                <div className="mt-4">
                  <button 
                    onClick={() => setActiveTab('regional')}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors"
                  >
                    Manage Regional Assignments
                  </button>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-6">
              <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
                <h3 className="text-xl font-semibold mb-4">Security Status</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center bg-gray-700/50 p-4 rounded-lg">
                    <div className="w-4 h-4 rounded-full bg-green-500 mr-2"></div>
                    <span>System authentication: Online</span>
                  </div>
                  <div className="flex items-center bg-gray-700/50 p-4 rounded-lg">
                    <div className="w-4 h-4 rounded-full bg-green-500 mr-2"></div>
                    <span>Token refresh service: Active</span>
                  </div>
                  <div className="flex items-center bg-gray-700/50 p-4 rounded-lg">
                    <div className="w-4 h-4 rounded-full bg-green-500 mr-2"></div>
                    <span>Login monitoring: Enabled</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'regional' && <RegionalConsole />}
        
        {activeTab === 'users' && (
          <UserManagement />
        )}

        {activeTab === 'logs' && (
          <div className="bg-gray-800 shadow-lg rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-6">System Logs</h2>
            <LoginHistoryTable 
              title="System-wide Login History" 
              showAllUsers={true}
            />
          </div>
        )}
      </main>
    </div>
  );
}

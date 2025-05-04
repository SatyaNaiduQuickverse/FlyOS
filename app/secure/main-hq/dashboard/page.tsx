// app/secure/main-hq/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../../lib/auth';
import { UserRole } from '../../../../types/auth';
import { useRouter } from 'next/navigation';
import LoginHistoryTable from '../../../../components/LoginHistoryTable';
import RegionalConsole from '../../../../components/RegionalConsole';
import UserManagement from '../../../../components/UserManagement';
import GradientText from '../../../../components/GradientText';
import DroneControlHub from '../../../../components/DroneControl/DroneControlHub';
import { 
  LayoutGrid, Users, Shield, Bell, 
  CircleAlert, Server, ArrowRightCircle,
  LineChart, ShieldOff, Plane 
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

  useEffect(() => {
    if (user && user.role !== UserRole.MAIN_HQ) {
      router.push(`/secure/${user.role.toLowerCase().replace('_', '-')}/dashboard`);
    }
  }, [user, router]);

  if (!user) return null;

  const dismissAlert = (id: number) => {
    setAlerts(alerts.filter(alert => alert.id !== id));
  };

  return (
    <div className="min-h-screen bg-black text-gray-200">
      <header className="bg-gray-900/90 backdrop-blur-lg shadow-xl border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex flex-col">
              <GradientText 
                text="FLYOS COMMAND" 
                className="text-5xl tracking-wide font-extralight mb-2"
              />
              <div className="h-[1px] w-48 bg-gradient-to-r from-blue-500/40 to-transparent" />
              <p className="text-sm text-gray-400 tracking-[0.3em] mt-2 font-light">
                MAIN HQ INTERFACE
              </p>
            </div>
            <div className="flex items-center gap-5">
              <div className="relative group">
                <Bell className="h-6 w-6 text-gray-400 hover:text-blue-400 transition-colors cursor-pointer" />
                {alerts.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                    {alerts.length}
                  </span>
                )}
                
                <div className="absolute right-0 mt-2 w-80 bg-gray-900 rounded-lg shadow-xl border border-gray-800 hidden group-hover:block z-50">
                  <div className="p-3 border-b border-gray-800">
                    <p className="text-sm font-medium">Notifications</p>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {alerts.map(alert => (
                      <div key={alert.id} className="p-3 border-b border-gray-800 last:border-0">
                        <div className="flex items-start gap-2">
                          {alert.type === 'critical' ? (
                            <CircleAlert className="h-4 w-4 text-red-400 mt-0.5" />
                          ) : alert.type === 'warning' ? (
                            <ShieldOff className="h-4 w-4 text-yellow-400 mt-0.5" />
                          ) : (
                            <LineChart className="h-4 w-4 text-blue-400 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <p className="text-sm mb-1">{alert.message}</p>
                            <p className="text-xs text-gray-400">{alert.time}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-800/60 rounded-lg px-3 py-2 border border-gray-700">
                <span className="text-sm text-gray-300">{user.fullName}</span>
              </div>
              
              <button 
                onClick={logout}
                className="bg-gray-800/80 hover:bg-gray-700 border border-gray-700 px-4 py-2 rounded-md text-sm font-medium tracking-wide transition-colors"
              >
                LOGOUT
              </button>
            </div>
          </div>
        </div>
      </header>
      
      {/* Tabs */}
      <div className="bg-gray-900/60 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex overflow-x-auto py-1 no-scrollbar">
            <button 
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-3 mx-1 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2
                ${activeTab === 'overview' 
                  ? 'bg-blue-900/20 text-blue-300 border border-blue-500/40' 
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/30'}`}
            >
              <LayoutGrid className="h-4 w-4" />
              OVERVIEW
            </button>
            <button 
              onClick={() => setActiveTab('regional')}
              className={`px-4 py-3 mx-1 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2
                ${activeTab === 'regional' 
                  ? 'bg-blue-900/20 text-blue-300 border border-blue-500/40' 
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/30'}`}
            >
              <Shield className="h-4 w-4" />
              REGIONAL CONTROL
            </button>
            <button 
              onClick={() => setActiveTab('users')}
              className={`px-4 py-3 mx-1 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2
                ${activeTab === 'users' 
                  ? 'bg-blue-900/20 text-blue-300 border border-blue-500/40' 
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/30'}`}
            >
              <Users className="h-4 w-4" />
              USER MANAGEMENT
            </button>
            <button 
              onClick={() => {
                setActiveTab('logs');
                setShowLoginHistory(true);
              }}
              className={`px-4 py-3 mx-1 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2
                ${activeTab === 'logs' 
                  ? 'bg-blue-900/20 text-blue-300 border border-blue-500/40' 
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/30'}`}
            >
              <Server className="h-4 w-4" />
              SYSTEM LOGS
            </button>
            <button 
              onClick={() => setActiveTab('drone-control')}
              className={`px-4 py-3 mx-1 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2
                ${activeTab === 'drone-control' 
                  ? 'bg-blue-900/20 text-blue-300 border border-blue-500/40' 
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/30'}`}
            >
              <Plane className="h-4 w-4" />
              DRONE CONTROL
            </button>
          </div>
        </div>
      </div>
      
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Alert messages */}
        {alerts.length > 0 && activeTab === 'overview' && (
          <div className="mb-8 space-y-3">
            {alerts.map(alert => (
              <div 
                key={alert.id} 
                className={`p-4 rounded-lg flex items-center justify-between backdrop-blur-sm
                  ${alert.type === 'critical' 
                    ? 'bg-gray-900/60 border-l-4 border-red-500 text-red-300' 
                    : alert.type === 'warning'
                      ? 'bg-gray-900/60 border-l-4 border-yellow-500 text-yellow-300'
                      : 'bg-gray-900/60 border-l-4 border-blue-500 text-blue-300'}`}
              >
                <div className="flex items-center gap-3">
                  {alert.type === 'critical' ? (
                    <CircleAlert className="h-5 w-5" />
                  ) : alert.type === 'warning' ? (
                    <ShieldOff className="h-5 w-5" />
                  ) : (
                    <LineChart className="h-5 w-5" />
                  )}
                  <div>
                    <p className="font-light tracking-wide">{alert.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{alert.time}</p>
                  </div>
                </div>
                <button 
                  onClick={() => dismissAlert(alert.id)}
                  className="text-gray-400 hover:text-white p-1"
                >
                  <ArrowRightCircle className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm">
                <h3 className="text-lg font-light tracking-wider mb-4 text-blue-300">Global Fleet Status</h3>
                <div className="relative">
                  <div className="text-6xl font-extralight text-white">142</div>
                  <div className="absolute -top-1 -right-1 text-sm bg-blue-500/20 px-2 py-0.5 rounded-md border border-blue-500/30">
                    TOTAL
                  </div>
                </div>
                <p className="text-gray-400 mt-1">Drone units deployed</p>
                <div className="mt-6 grid grid-cols-3 gap-3">
                  <div className="bg-gray-800/80 rounded-lg p-3">
                    <div className="text-white font-light text-2xl">119</div>
                    <div className="text-xs text-blue-400 mt-1">ACTIVE</div>
                  </div>
                  <div className="bg-gray-800/80 rounded-lg p-3">
                    <div className="text-white font-light text-2xl">14</div>
                    <div className="text-xs text-yellow-400 mt-1">MAINTENANCE</div>
                  </div>
                  <div className="bg-gray-800/80 rounded-lg p-3">
                    <div className="text-white font-light text-2xl">9</div>
                    <div className="text-xs text-red-400 mt-1">OFFLINE</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm">
                <h3 className="text-lg font-light tracking-wider mb-4 text-blue-300">Active Missions</h3>
                <div className="relative">
                  <div className="text-6xl font-extralight text-white">38</div>
                  <div className="absolute -top-1 -right-1 text-sm bg-blue-500/20 px-2 py-0.5 rounded-md border border-blue-500/30">
                    ACTIVE
                  </div>
                </div>
                <p className="text-gray-400 mt-1">Operations in progress</p>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="bg-gray-800/80 rounded-lg p-3">
                    <div className="flex justify-between items-center mb-1">
                      <div className="text-white font-light text-2xl">24</div>
                      <Plane className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="text-xs text-blue-400">SURVEILLANCE</div>
                  </div>
                  <div className="bg-gray-800/80 rounded-lg p-3">
                    <div className="flex justify-between items-center mb-1">
                      <div className="text-white font-light text-2xl">14</div>
                      <Plane className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="text-xs text-blue-400">TRANSPORT</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm">
                <h3 className="text-lg font-light tracking-wider mb-4 text-blue-300">Regional Commands</h3>
                <div className="relative">
                  <div className="text-6xl font-extralight text-white">4</div>
                  <div className="absolute -top-1 -right-1 text-sm bg-blue-500/20 px-2 py-0.5 rounded-md border border-blue-500/30">
                    REGIONS
                  </div>
                </div>
                <p className="text-gray-400 mt-1">Active command centers</p>
                <div className="mt-6">
                  <button 
                    onClick={() => setActiveTab('regional')}
                    className="w-full py-2.5 bg-blue-900/30 hover:bg-blue-800/50 border border-blue-800/50 text-white rounded text-sm tracking-wider transition-colors"
                  >
                    MANAGE REGIONAL ASSIGNMENTS
                  </button>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm">
                <h3 className="text-lg font-light tracking-wider mb-4 text-blue-300">User Information</h3>
                <div className="bg-gray-800/80 p-4 rounded-md space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">ID:</span>
                    <span className="text-gray-200">{user.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Username:</span>
                    <span className="text-gray-200">{user.username}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Role:</span>
                    <span className="bg-blue-500/20 text-blue-300 text-xs px-2 py-0.5 rounded-md">{user.role}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Email:</span>
                    <span className="text-gray-200">{user.email}</span>
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    setShowLoginHistory(!showLoginHistory);
                    if (!showLoginHistory) setActiveTab('logs');
                  }}
                  className="mt-4 w-full bg-gray-800/80 hover:bg-gray-700/80 px-4 py-2 rounded-md text-sm tracking-wider transition-colors"
                >
                  {showLoginHistory ? 'HIDE LOGIN HISTORY' : 'SHOW LOGIN HISTORY'}
                </button>
              </div>
              
              <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm">
                <h3 className="text-lg font-light tracking-wider mb-4 text-blue-300">System Security</h3>
                <div className="space-y-3">
                  <div className="flex items-center p-3 bg-gray-800/80 rounded-lg">
                    <div className="w-3 h-3 rounded-full bg-blue-500 mr-3"></div>
                    <div className="flex justify-between items-center w-full">
                      <span className="text-sm text-gray-300">System Authentication</span>
                      <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">ONLINE</span>
                    </div>
                  </div>
                  <div className="flex items-center p-3 bg-gray-800/80 rounded-lg">
                    <div className="w-3 h-3 rounded-full bg-blue-500 mr-3"></div>
                    <div className="flex justify-between items-center w-full">
                      <span className="text-sm text-gray-300">Token Refresh Service</span>
                      <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">ACTIVE</span>
                    </div>
                  </div>
                  <div className="flex items-center p-3 bg-gray-800/80 rounded-lg">
                    <div className="w-3 h-3 rounded-full bg-blue-500 mr-3"></div>
                    <div className="flex justify-between items-center w-full">
                      <span className="text-sm text-gray-300">Login Monitoring</span>
                      <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">ENABLED</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {showLoginHistory && (
              <LoginHistoryTable 
                title="System-wide Login History" 
                showAllUsers={true}
              />
            )}
          </>
        )}

        {activeTab === 'regional' && <RegionalConsole />}
        
        {activeTab === 'users' && <UserManagement />}

        {activeTab === 'logs' && (
          <div className="bg-gray-900/80 shadow-lg rounded-lg p-6 backdrop-blur-sm">
            <h2 className="text-xl font-light tracking-wider mb-6 text-blue-300">System Logs</h2>
            <LoginHistoryTable 
              title="System-wide Login History" 
              showAllUsers={true}
            />
          </div>
        )}
        
        {activeTab === 'drone-control' && <DroneControlHub />}
      </main>
    </div>
  );
}
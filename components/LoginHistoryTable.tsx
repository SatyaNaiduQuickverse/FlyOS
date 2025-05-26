// components/LoginHistoryTable.tsx - FIXED FOR SUPABASE
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { RefreshCw, AlertTriangle, Clock, Shield, Database, Wifi } from 'lucide-react';

interface LoginHistoryEntry {
  id: string;
  userId: string;
  username: string;
  ipAddress: string;
  userAgent: string;
  loginTime: string;
  logoutTime: string | null;
  status: 'SUCCESS' | 'FAILED' | 'EXPIRED';
  failureReason: string | null;
  sessionDuration: number | null;
}

interface LoginHistoryTableProps {
  userId?: string;
  limit?: number;
  title?: string;
  showAllUsers?: boolean;
}

export default function LoginHistoryTable({ 
  userId, 
  limit = 20,
  title = "Login History",
  showAllUsers = false
}: LoginHistoryTableProps) {
  const [loginHistory, setLoginHistory] = useState<LoginHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);
  const { user, token } = useAuth();
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatDuration = (seconds: number | null, loginTime: string, logoutTime: string | null) => {
    let duration = seconds;
    
    if (!logoutTime && loginTime) {
      const loginDate = new Date(loginTime);
      const now = new Date(lastUpdated);
      duration = Math.floor((now.getTime() - loginDate.getTime()) / 1000);
    }
    
    if (!duration) return 'N/A';
    
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const remainingSeconds = Math.floor(duration % 60);
    
    return [
      hours > 0 ? `${hours}h` : '',
      minutes > 0 ? `${minutes}m` : '',
      `${remainingSeconds}s`
    ].filter(Boolean).join(' ');
  };

  const formatIpAddress = (ipAddress: string) => {
    if (ipAddress && ipAddress.startsWith('::ffff:')) {
      return ipAddress.substring(7);
    }
    return ipAddress || 'N/A';
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'SUCCESS':
        return (
          <span className="px-2 py-1 rounded text-xs font-medium flex items-center gap-1 bg-gradient-to-r from-emerald-500/20 to-blue-500/20 text-blue-300 border border-blue-500/30">
            <span className="h-2 w-2 rounded-full bg-blue-400"></span>
            {status}
          </span>
        );
      case 'FAILED':
        return (
          <span className="px-2 py-1 rounded text-xs font-medium flex items-center gap-1 bg-gradient-to-r from-red-500/20 to-rose-500/20 text-rose-300 border border-rose-500/30">
            <span className="h-2 w-2 rounded-full bg-rose-400"></span>
            {status}
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="px-2 py-1 rounded text-xs font-medium flex items-center gap-1 bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/30">
            <span className="h-2 w-2 rounded-full bg-amber-400"></span>
            {status}
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 rounded text-xs font-medium bg-gray-600 text-gray-300">
            {status}
          </span>
        );
    }
  };

  // Fetch login history from Supabase or your backend API
  const fetchLoginHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      if (!user || !token) {
        setError('Authentication required');
        return;
      }

      // Option 1: If you have login history in Supabase
      // This would require a login_history table in Supabase
      /*
      let query = supabase
        .from('login_history')
        .select('*')
        .order('login_time', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      // Role-based filtering
      if (user.role !== 'MAIN_HQ' || !showAllUsers) {
        const targetUserId = userId || user.id;
        query = query.eq('user_id', targetUserId);
      }

      const { data, error: supabaseError, count } = await query;
      
      if (supabaseError) {
        throw new Error(supabaseError.message);
      }
      */

      // Option 2: Call your backend API (TimescaleDB)
      const queryUserId = (user?.role === 'MAIN_HQ' && showAllUsers) ? undefined : userId || user?.id;
      
      const response = await fetch(`/api/auth/login-history?page=${page}&limit=${limit}${queryUserId ? `&userId=${queryUserId}` : ''}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Session expired. Please login again.');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Transform the data to match our interface
        const transformedHistory = data.loginHistory.map((entry: any) => ({
          id: entry.id,
          userId: entry.userId || entry.user_id,
          username: entry.username,
          ipAddress: entry.ipAddress || entry.ip_address,
          userAgent: entry.userAgent || entry.user_agent,
          loginTime: entry.loginTime || entry.login_time,
          logoutTime: entry.logoutTime || entry.logout_time,
          status: entry.status || 'SUCCESS',
          failureReason: entry.failureReason || entry.failure_reason,
          sessionDuration: entry.sessionDuration || entry.session_duration,
        }));
        
        setLoginHistory(transformedHistory);
        setTotalPages(data.pages || 1);
        setTotalEntries(data.totalCount || transformedHistory.length);
        setLastUpdated(new Date());
      } else {
        throw new Error(data.message || 'Failed to fetch login history');
      }
    } catch (error) {
      console.error('Error fetching login history:', error);
      
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Error loading login history data');
      }
      
      // Fallback: Generate mock data for demo purposes
      const mockHistory = generateMockLoginHistory();
      setLoginHistory(mockHistory);
      setTotalEntries(mockHistory.length);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, limit, userId, user, showAllUsers, token]);

  // Generate mock login history for demo purposes
  const generateMockLoginHistory = (): LoginHistoryEntry[] => {
    if (!user) return [];

    const mockEntries: LoginHistoryEntry[] = [];
    const now = new Date();
    
    // Generate some realistic mock data
    for (let i = 0; i < Math.min(limit, 10); i++) {
      const loginTime = new Date(now.getTime() - (i * 2 * 60 * 60 * 1000)); // Every 2 hours
      const logoutTime = i < 3 ? null : new Date(loginTime.getTime() + (1.5 * 60 * 60 * 1000)); // 1.5 hour sessions
      
      mockEntries.push({
        id: `mock-${i + 1}`,
        userId: user.id,
        username: user.username,
        ipAddress: `192.168.1.${100 + i}`,
        userAgent: 'Mozilla/5.0 (compatible; FlyOS Dashboard)',
        loginTime: loginTime.toISOString(),
        logoutTime: logoutTime?.toISOString() || null,
        status: i === 7 ? 'FAILED' : 'SUCCESS',
        failureReason: i === 7 ? 'Invalid credentials' : null,
        sessionDuration: logoutTime ? Math.floor((logoutTime.getTime() - loginTime.getTime()) / 1000) : null,
      });
    }
    
    return mockEntries;
  };

  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchLoginHistory();
    }, 60000); // Refresh every minute
    
    return () => clearInterval(intervalId);
  }, [fetchLoginHistory]);

  useEffect(() => {
    fetchLoginHistory();
  }, [fetchLoginHistory]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const showUserColumn = user?.role === 'MAIN_HQ' || 
                        (title && title.toLowerCase().includes('system-wide')) ||
                        showAllUsers;

  return (
    <div className="bg-gradient-to-b from-gray-900/80 to-black/80 shadow-2xl rounded-lg backdrop-blur-sm overflow-hidden border border-gray-800">
      <div className="flex justify-between items-center p-5 border-b border-gray-800 bg-gradient-to-r from-blue-900/10 to-indigo-900/10">
        <div className="flex flex-col">
          <h2 className="text-xl font-light tracking-wider text-blue-300 flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-400" />
            {title.toUpperCase()}
          </h2>
          <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Last updated: {formatDate(lastUpdated.toISOString())}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {totalEntries > 0 && (
            <div className="text-sm bg-gradient-to-r from-blue-900/20 to-indigo-900/20 px-3 py-1 rounded-md border border-blue-500/30">
              <span className="text-gray-400">Showing</span> <span className="text-blue-300 font-light">{loginHistory.length}</span> <span className="text-gray-400">of</span> <span className="text-blue-300 font-light">{totalEntries}</span>
            </div>
          )}
          <button 
            onClick={fetchLoginHistory}
            className="p-2 bg-gradient-to-r from-gray-800 to-gray-900 text-gray-300 hover:text-blue-400 rounded-md transition-colors border border-gray-700 group"
          >
            <RefreshCw className="h-5 w-5 group-hover:text-blue-400" />
          </button>
        </div>
      </div>
      
      {error && (
        <div className="m-5 p-4 bg-gradient-to-r from-rose-900/20 to-red-900/20 border-l-4 border-rose-500 rounded-md flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-rose-400" />
          <div className="flex-1 text-rose-300">{error}</div>
          <button 
            className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-white rounded-md text-sm border border-gray-700 transition-colors" 
            onClick={fetchLoginHistory}
          >
            Retry
          </button>
        </div>
      )}
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="relative">
            <div className="animate-ping absolute inset-0 rounded-full h-12 w-12 bg-blue-400 opacity-10"></div>
            <div className="animate-spin relative rounded-full h-12 w-12 border-2 border-gray-600 border-t-blue-500"></div>
          </div>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto p-3">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gradient-to-r from-blue-900/10 to-indigo-900/10 text-gray-400 text-xs uppercase tracking-wider">
                  {showUserColumn && (
                    <th scope="col" className="px-6 py-3 text-left font-medium">
                      User
                    </th>
                  )}
                  <th scope="col" className="px-6 py-3 text-left font-medium">
                    Login Time
                  </th>
                  <th scope="col" className="px-6 py-3 text-left font-medium">
                    Logout Time
                  </th>
                  <th scope="col" className="px-6 py-3 text-left font-medium">
                    Duration
                  </th>
                  <th scope="col" className="px-6 py-3 text-left font-medium">
                    IP Address
                  </th>
                  <th scope="col" className="px-6 py-3 text-left font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {loginHistory.length === 0 ? (
                  <tr>
                    <td colSpan={showUserColumn ? 6 : 5} className="px-6 py-8 text-center">
                      <div className="flex flex-col items-center text-gray-400">
                        <Shield className="h-10 w-10 mb-3 opacity-30" />
                        <p className="text-sm">No login history available</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  loginHistory.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gradient-to-r hover:from-blue-900/5 hover:to-indigo-900/5 transition-colors">
                      {showUserColumn && (
                        <td className="px-6 py-4 text-sm">
                          <div className="font-medium text-blue-300">{entry.username}</div>
                        </td>
                      )}
                      <td className="px-6 py-4 text-sm text-gray-200">
                        {formatDate(entry.loginTime)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {entry.logoutTime ? (
                          <span className="text-gray-200">{formatDate(entry.logoutTime)}</span>
                        ) : (
                          <span className="text-emerald-400 font-medium flex items-center gap-1">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            Active Session
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="bg-gradient-to-r from-blue-900/10 to-indigo-900/10 px-2 py-1 rounded text-gray-200">
                          {formatDuration(entry.sessionDuration, entry.loginTime, entry.logoutTime)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Wifi className="h-3 w-3 text-blue-400" />
                          <span className="text-gray-200">{formatIpAddress(entry.ipAddress)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(entry.status)}
                          {entry.failureReason && (
                            <span className="text-xs text-gray-400">
                              ({entry.failureReason})
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {totalPages > 1 && (
            <div className="flex justify-center p-4 border-t border-gray-800 bg-gradient-to-r from-blue-900/5 to-indigo-900/5">
              <nav className="flex items-center">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-md mr-2 bg-gradient-to-r from-gray-800 to-gray-900 border border-gray-700 text-white hover:from-blue-900/20 hover:to-indigo-900/20 disabled:opacity-50 disabled:hover:from-gray-800 disabled:hover:to-gray-900 transition-all text-sm"
                >
                  Previous
                </button>
                
                <div className="flex space-x-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`w-8 h-8 flex items-center justify-center rounded-md transition-all ${
                        pageNum === page
                          ? 'bg-gradient-to-r from-blue-900/30 to-indigo-900/30 text-blue-300 border border-blue-500/40'
                          : 'bg-gradient-to-r from-gray-800 to-gray-900 border border-gray-700 text-white hover:from-blue-900/10 hover:to-indigo-900/10'
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}
                </div>
                
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-md ml-2 bg-gradient-to-r from-gray-800 to-gray-900 border border-gray-700 text-white hover:from-blue-900/20 hover:to-indigo-900/20 disabled:opacity-50 disabled:hover:from-gray-800 disabled:hover:to-gray-900 transition-all text-sm"
                >
                  Next
                </button>
              </nav>
            </div>
          )}
        </>
      )}
    </div>
  );
}
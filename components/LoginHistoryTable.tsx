'use client';

import { useState, useEffect, useCallback } from 'react';
import { authApi } from '../lib/api/auth';
import { useAuth } from '../lib/auth';

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

// Interface used when fetching login history data
interface LoginHistoryResponse {
  success: boolean;
  totalCount: number;
  pages: number;
  currentPage: number;
  loginHistory: LoginHistoryEntry[];
}

interface LoginHistoryTableProps {
  userId?: string;
  limit?: number;
  title?: string;
  showAllUsers?: boolean; // New prop to explicitly control whether to show all users
}

/**
 * Login History Table Component
 * Displays a table of user login history with pagination
 */
export default function LoginHistoryTable({ 
  userId, 
  limit = 20, // Increased limit to show more history
  title = "Login History",
  showAllUsers = false
}: LoginHistoryTableProps) {
  const [loginHistory, setLoginHistory] = useState<LoginHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);
  const { user } = useAuth();
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Format date in a user-friendly way
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Format duration in a user-friendly way - fixed to prevent continuous updates
  const formatDuration = (seconds: number | null, loginTime: string, logoutTime: string | null) => {
    let duration = seconds;
    
    // If session is active (no logoutTime), calculate duration once
    if (!logoutTime && loginTime) {
      const loginDate = new Date(loginTime);
      const now = new Date(lastUpdated); // Use lastUpdated instead of current time
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

  // Format IP address in a user-friendly way
  const formatIpAddress = (ipAddress: string) => {
    // Remove IPv6 prefix if it's an IPv4-mapped address
    if (ipAddress && ipAddress.startsWith('::ffff:')) {
      return ipAddress.substring(7);
    }
    return ipAddress || 'N/A';
  };

  // Format status with color coding
  const formatStatus = (status: string) => {
    const statusStyles = {
      SUCCESS: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      FAILED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      EXPIRED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    };
    
    const style = statusStyles[status as keyof typeof statusStyles] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${style}`}>
        {status}
      </span>
    );
  };

  // Fetch login history data - using useCallback to avoid recreating this function on each render
  const fetchLoginHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // System-wide history for Main HQ if showAllUsers is true, otherwise respect userId
      const queryUserId = (user?.role === 'MAIN_HQ' && showAllUsers) ? undefined : userId || user?.id;
      
      console.log('Fetching login history with userId:', queryUserId, 'showAllUsers:', showAllUsers);
      
      // Use a larger limit to get more history
      const response = await authApi.getLoginHistory(page, limit, queryUserId) as LoginHistoryResponse;
      
      if (response.success) {
        setLoginHistory(response.loginHistory);
        setTotalPages(response.pages);
        setTotalEntries(response.totalCount);
        // Update the lastUpdated timestamp
        setLastUpdated(new Date());
      } else {
        setError('Failed to fetch login history');
      }
    } catch (error) {
      console.error('Error fetching login history:', error);
      setError('Error loading login history data');
    } finally {
      setLoading(false);
    }
  }, [page, limit, userId, user, showAllUsers]);

  // Run a refresh every minute to update any active sessions (but not continuously)
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchLoginHistory();
    }, 60000); // Refresh every minute
    
    return () => clearInterval(intervalId);
  }, [fetchLoginHistory]);

  // Fetch data when component mounts or when dependencies change
  useEffect(() => {
    fetchLoginHistory();
  }, [fetchLoginHistory]);

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  // Determine if we should show the username column
  const showUserColumn = user?.role === 'MAIN_HQ' || 
                         (title && title.toLowerCase().includes('system-wide')) ||
                         showAllUsers;

  return (
    <div className="bg-gray-800 shadow-lg rounded-lg p-6 overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <div className="flex flex-col">
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <div className="text-xs text-gray-400 mt-1">
            Last updated: {formatDate(lastUpdated.toISOString())}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-sm text-gray-400">
            {totalEntries > 0 && `Showing ${loginHistory.length} of ${totalEntries} entries`}
          </div>
          <button 
            onClick={fetchLoginHistory} 
            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm"
          >
            Refresh
          </button>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-900 text-white p-4 rounded-md mb-4">
          {error}
          <button 
            className="ml-4 underline" 
            onClick={fetchLoginHistory}
          >
            Retry
          </button>
        </div>
      )}
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-700">
                <tr>
                  {showUserColumn && (
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      User
                    </th>
                  )}
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Login Time
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Logout Time
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Duration
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    IP Address
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {loginHistory.length === 0 ? (
                  <tr>
                    <td colSpan={showUserColumn ? 6 : 5} className="px-6 py-4 text-sm text-gray-400 text-center">
                      No login history available
                    </td>
                  </tr>
                ) : (
                  loginHistory.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-700">
                      {showUserColumn && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                          {entry.username}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        {formatDate(entry.loginTime)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        {entry.logoutTime ? formatDate(entry.logoutTime) : 'Active Session'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        {formatDuration(entry.sessionDuration, entry.loginTime, entry.logoutTime)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        {formatIpAddress(entry.ipAddress)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {formatStatus(entry.status)}
                        {entry.failureReason && (
                          <span className="ml-2 text-xs text-gray-400">
                            ({entry.failureReason})
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-6">
              <nav className="flex items-center">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="px-3 py-1 rounded-md mr-2 bg-gray-700 text-white disabled:opacity-50"
                >
                  Previous
                </button>
                
                <div className="flex space-x-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`px-3 py-1 rounded-md ${
                        pageNum === page
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-white'
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}
                </div>
                
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                  className="px-3 py-1 rounded-md ml-2 bg-gray-700 text-white disabled:opacity-50"
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

'use client';

import { useState, useEffect } from 'react';
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
}

/**
 * Login History Table Component
 * Displays a table of user login history with pagination
 */
export default function LoginHistoryTable({ 
  userId, 
  limit = 10,
  title = "Login History"
}: LoginHistoryTableProps) {
  const [loginHistory, setLoginHistory] = useState<LoginHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);
  const { user } = useAuth();

  // Format date in a user-friendly way
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Format duration in a user-friendly way
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    return [
      hours > 0 ? `${hours}h` : '',
      minutes > 0 ? `${minutes}m` : '',
      `${remainingSeconds}s`
    ].filter(Boolean).join(' ');
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

  // Fetch login history data
  const fetchLoginHistory = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await authApi.getLoginHistory(page, limit, userId);
      
      if (response.success) {
        setLoginHistory(response.loginHistory);
        setTotalPages(response.pages);
        setTotalEntries(response.totalCount);
      } else {
        setError('Failed to fetch login history');
      }
    } catch (error) {
      console.error('Error fetching login history:', error);
      setError('Error loading login history data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when component mounts or when page/userId changes
  useEffect(() => {
    fetchLoginHistory();
  }, [page, userId]);

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  return (
    <div className="bg-gray-800 shadow-lg rounded-lg p-6 overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <div className="text-sm text-gray-400">
          {totalEntries > 0 && `Showing ${loginHistory.length} of ${totalEntries} entries`}
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
                  {!userId && user?.role === 'MAIN_HQ' && (
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
                    <td colSpan={userId ? 5 : 6} className="px-6 py-4 text-sm text-gray-400 text-center">
                      No login history available
                    </td>
                  </tr>
                ) : (
                  loginHistory.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-700">
                      {!userId && user?.role === 'MAIN_HQ' && (
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
                        {formatDuration(entry.sessionDuration)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        {entry.ipAddress || 'N/A'}
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

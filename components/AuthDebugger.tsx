// components/AuthDebugger.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { getLocalStorageKeys, getLocalStorageItem } from '../lib/utils/browser';

const AuthDebugger: React.FC = () => {
  const { user, token, loading, error, refreshSession } = useAuth();
  const [storageItems, setStorageItems] = useState<Record<string, string>>({});
  
  useEffect(() => {
    // Get all localStorage items related to auth
    const keys = getLocalStorageKeys().filter(key => key.startsWith('flyos_'));
    const items: Record<string, string> = {};
    
    keys.forEach(key => {
      const value = getLocalStorageItem(key);
      if (value) {
        // Mask tokens
        if (key.includes('token')) {
          items[key] = value.substring(0, 10) + '...' + value.substring(value.length - 5);
        } else {
          items[key] = value;
        }
      } else {
        items[key] = '[empty]';
      }
    });
    
    setStorageItems(items);
  }, [loading, user, token]);
  
  const handleRefreshSession = async () => {
    try {
      await refreshSession();
      alert('Session refreshed successfully');
    } catch (error) {
      alert(`Failed to refresh session: ${error}`);
    }
  };
  
  return (
    <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm text-white text-sm mt-8">
      <h3 className="text-lg font-light tracking-wider mb-6 text-blue-300">
        Authentication Debugger
      </h3>
      
      <div className="space-y-4">
        <div className="bg-gray-800/60 p-4 rounded-lg">
          <h4 className="text-blue-400 mb-2">Auth Context State</h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="text-gray-400">Loading:</div>
            <div className={loading ? 'text-yellow-400' : 'text-green-400'}>
              {loading ? 'True' : 'False'}
            </div>
            
            <div className="text-gray-400">User:</div>
            <div className={user ? 'text-green-400' : 'text-red-400'}>
              {user ? `${user.username} (${user.role})` : 'Not authenticated'}
            </div>
            
            <div className="text-gray-400">Token:</div>
            <div className={token ? 'text-green-400' : 'text-red-400'}>
              {token ? `${token.substring(0, 10)}...` : 'No token'}
            </div>
            
            <div className="text-gray-400">Error:</div>
            <div className={error ? 'text-red-400' : 'text-green-400'}>
              {error || 'None'}
            </div>
          </div>
        </div>
        
        <div className="bg-gray-800/60 p-4 rounded-lg">
          <h4 className="text-blue-400 mb-2">LocalStorage Items</h4>
          {Object.keys(storageItems).length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(storageItems).map(([key, value]) => (
                <React.Fragment key={key}>
                  <div className="text-gray-400">{key}:</div>
                  <div className="text-green-400 break-all">{value}</div>
                </React.Fragment>
              ))}
            </div>
          ) : (
            <div className="text-red-400">No authentication items in localStorage</div>
          )}
        </div>
        
        <div className="flex gap-3 mt-4">
          <button 
            onClick={handleRefreshSession}
            className="bg-blue-500/30 hover:bg-blue-500/40 text-blue-300 px-4 py-2 rounded-md transition-colors"
          >
            Manual Token Refresh
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthDebugger;
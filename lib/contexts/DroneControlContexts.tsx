// lib/contexts/DroneControlContext.tsx - Centralized token and command management
'use client';

import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { useAuth } from '../auth';

interface CommandParams {
  [key: string]: unknown;
}

interface CommandResult {
  success: boolean;
  message?: string;
}

interface DroneControlContextType {
  token: string | null;
  isAuthenticated: boolean;
  sendCommand: (droneId: string, commandType: string, params?: CommandParams) => Promise<CommandResult>;
  sendManualCommand: (droneId: string, commandType: string, params?: CommandParams) => Promise<CommandResult>;
}

const DroneControlContext = createContext<DroneControlContextType | null>(null);

export const DroneControlProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();

  // Optimized command sender with different paths for manual vs critical commands
  const sendCommand = useCallback(async (
    droneId: string, 
    commandType: string, 
    params: CommandParams = {}
  ): Promise<CommandResult> => {
    if (!token) {
      return { success: false, message: 'No authentication token available' };
    }

    if (!droneId) {
      return { success: false, message: 'No drone ID provided' };
    }

    try {
      const response = await fetch(`/api/drones/${droneId}/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          commandType,
          parameters: params,
          timestamp: new Date().toISOString()
        })
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        return { success: true, message: result.message };
      } else {
        return { success: false, message: result.message || 'Command failed' };
      }
    } catch (error) {
      console.error(`Command ${commandType} failed:`, error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Network error' 
      };
    }
  }, [token]);

  // Manual commands use same endpoint but with different logging behavior on backend
  const sendManualCommand = useCallback(async (
    droneId: string, 
    commandType: string, 
    params: CommandParams = {}
  ): Promise<CommandResult> => {
    // Manual commands are just regular commands - backend handles fast path
    return sendCommand(droneId, commandType, params);
  }, [sendCommand]);

  const contextValue = useMemo(() => ({
    token,
    isAuthenticated: !!token,
    sendCommand,
    sendManualCommand
  }), [token, sendCommand, sendManualCommand]);

  return (
    <DroneControlContext.Provider value={contextValue}>
      {children}
    </DroneControlContext.Provider>
  );
};

export const useDroneControl = (): DroneControlContextType => {
  const context = useContext(DroneControlContext);
  if (!context) {
    throw new Error('useDroneControl must be used within a DroneControlProvider');
  }
  return context;
};
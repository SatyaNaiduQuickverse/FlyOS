// components/UserManagement/index.tsx - UPDATED TO USE FRONTEND API ROUTES
'use client';

import React, { useState, useEffect } from 'react';
import { Users, Clock, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { UserRole } from '../../types/auth';
import { useAuth } from '../../lib/auth';
import UserManagementTabs from './UserManagementTabs';
import RegionalCommandersList from './RegionalCommandersList';
import OperatorsList from './OperatorsList';
import CreateUserForm from './CreateUserForm';
import DroneManagement from './DroneManagement';
import CreateDroneForm from './CreateDroneForm';
import RegionManagement from './RegionManagement';
import CreateRegionForm from './CreateRegionForm';
import { User, Region, Drone, UserManagementTab, Notification } from './types';

const UserManagement: React.FC = () => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<UserManagementTab>(UserManagementTab.MANAGE_REGIONS);
  const [users, setUsers] = useState<User[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showInactive, setShowInactive] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingRegion, setEditingRegion] = useState<Region | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Load data from API routes (not direct backend)
  useEffect(() => {
    loadData();
  }, [token]);

  const loadData = async () => {
    if (!token) return;
    
    setIsLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      const [usersRes, regionsRes, dronesRes] = await Promise.all([
        fetch('/api/users', { headers }),
        fetch('/api/regions', { headers }),
        fetch('/api/drones', { headers })
      ]);

      const [usersData, regionsData, dronesData] = await Promise.all([
        usersRes.json(),
        regionsRes.json(), 
        dronesRes.json()
      ]);

      if (usersData.success !== false) setUsers(usersData.users || []);
      if (regionsData.success !== false) setRegions(regionsData.regions || []);
      if (dronesData.success !== false) setDrones(dronesData.drones || []);
      
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to load data:', error);
      showNotification('Failed to load data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return 'N/A';
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const refreshData = () => {
    loadData();
    showNotification('Data refreshed successfully');
  };

  // User management functions
  const handleCreateUser = async (userData: any) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(userData)
      });

      const result = await response.json();
      
      if (response.ok && result.success !== false) {
        await loadData();
        setActiveTab(userData.role === UserRole.REGIONAL_HQ ? UserManagementTab.REGIONAL_COMMANDERS : UserManagementTab.OPERATORS);
        showNotification(`Successfully created ${userData.role === UserRole.REGIONAL_HQ ? 'Regional Commander' : 'Field Operator'}`);
      } else {
        throw new Error(result.message || 'Failed to create user');
      }
    } catch (error: any) {
      showNotification(`Failed to create user: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateUser = async (userData: any) => {
    if (!editingUser) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(userData)
      });

      const result = await response.json();
      
      if (response.ok && result.success !== false) {
        await loadData();
        setActiveTab(userData.role === UserRole.REGIONAL_HQ ? UserManagementTab.REGIONAL_COMMANDERS : UserManagementTab.OPERATORS);
        showNotification(`Successfully updated ${userData.role === UserRole.REGIONAL_HQ ? 'Regional Commander' : 'Field Operator'}`);
        setEditingUser(null);
      } else {
        throw new Error(result.message || 'Failed to update user');
      }
    } catch (error: any) {
      showNotification(`Failed to update user: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      const result = await response.json();
      
      if (response.ok && result.success !== false) {
        await loadData();
        showNotification('User deleted successfully');
      } else {
        throw new Error(result.message || 'Failed to delete user');
      }
    } catch (error: any) {
      showNotification(`Failed to delete user: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setActiveTab(UserManagementTab.CREATE_USER);
  };

  // Region management functions
  const handleCreateRegion = async (regionData: any) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/regions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(regionData)
      });

      const result = await response.json();
      
      if (response.ok && result.success !== false) {
        await loadData();
        setActiveTab(UserManagementTab.MANAGE_REGIONS);
        showNotification('Successfully created new region');
      } else {
        throw new Error(result.message || 'Failed to create region');
      }
    } catch (error: any) {
      showNotification(`Failed to create region: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateRegion = async (regionData: any) => {
    if (!editingRegion) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/regions/${editingRegion.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(regionData)
      });

      const result = await response.json();
      
      if (response.ok && result.success !== false) {
        await loadData();
        setActiveTab(UserManagementTab.MANAGE_REGIONS);
        showNotification('Successfully updated region');
        setEditingRegion(null);
      } else {
        throw new Error(result.message || 'Failed to update region');
      }
    } catch (error: any) {
      showNotification(`Failed to update region: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteRegion = async (regionId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/regions/${regionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      const result = await response.json();
      
      if (response.ok && result.success !== false) {
        await loadData();
        showNotification('Region deleted successfully');
      } else {
        throw new Error(result.message || 'Failed to delete region');
      }
    } catch (error: any) {
      showNotification(`Failed to delete region: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditRegion = (region: Region) => {
    setEditingRegion(region);
    setActiveTab(UserManagementTab.CREATE_REGION);
  };

  // Drone management functions
  const handleCreateDrone = async (droneData: any) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/drones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(droneData)
      });

      const result = await response.json();
      
      if (response.ok && result.success !== false) {
        await loadData();
        setActiveTab(UserManagementTab.MANAGE_DRONES);
        showNotification('Successfully created new drone');
      } else {
        throw new Error(result.message || 'Failed to create drone');
      }
    } catch (error: any) {
      showNotification(`Failed to create drone: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-gray-200">
      <div className="bg-gradient-to-b from-gray-900/80 to-black/80 shadow-2xl rounded-lg backdrop-blur-sm overflow-hidden border border-gray-800">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-800 bg-gradient-to-r from-blue-900/10 to-indigo-900/10">
          <div className="flex flex-col">
            <h2 className="text-2xl font-light tracking-wider text-blue-300 flex items-center gap-3">
              <Users className="h-6 w-6 text-blue-400" />
              USER MANAGEMENT SYSTEM
            </h2>
            <div className="text-xs text-gray-400 mt-2 flex items-center gap-2">
              <Clock className="h-3 w-3" />
              Last updated: {formatDate(lastUpdated.toISOString())}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm bg-gradient-to-r from-blue-900/20 to-indigo-900/20 px-3 py-1 rounded-md border border-blue-500/30">
              <span className="text-gray-400">Regions:</span> <span className="text-blue-300 font-light">{regions.length}</span>
            </div>
            <div className="text-sm bg-gradient-to-r from-blue-900/20 to-indigo-900/20 px-3 py-1 rounded-md border border-blue-500/30">
              <span className="text-gray-400">Users:</span> <span className="text-blue-300 font-light">{users.length}</span>
            </div>
            <div className="text-sm bg-gradient-to-r from-blue-900/20 to-indigo-900/20 px-3 py-1 rounded-md border border-blue-500/30">
              <span className="text-gray-400">Drones:</span> <span className="text-blue-300 font-light">{drones.length}</span>
            </div>
            <button 
              onClick={refreshData}
              disabled={isLoading}
              className="p-2 bg-gradient-to-r from-gray-800 to-gray-900 text-gray-300 hover:text-blue-400 rounded-md transition-colors border border-gray-700 group disabled:opacity-50"
            >
              <RefreshCw className={`h-5 w-5 group-hover:text-blue-400 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Notification */}
        {notification && (
          <div className={`m-6 p-4 rounded-lg border backdrop-blur-sm ${
            notification.type === 'success' 
              ? 'bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border-blue-500/30 text-blue-300' 
              : 'bg-gradient-to-r from-rose-500/10 to-red-500/10 border-rose-500/30 text-rose-300'
          } flex items-center gap-3`}>
            {notification.type === 'success' 
              ? <CheckCircle className="h-5 w-5" /> 
              : <XCircle className="h-5 w-5" />}
            <p className="tracking-wider font-light">{notification.message}</p>
          </div>
        )}

        {/* Tabs */}
        <UserManagementTabs 
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          editingUser={editingUser}
          editingRegion={editingRegion}
        />
        
        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <div className="relative">
              <div className="animate-ping absolute inset-0 rounded-full h-12 w-12 bg-blue-400 opacity-10"></div>
              <div className="animate-spin relative rounded-full h-12 w-12 border-2 border-gray-600 border-t-blue-500"></div>
            </div>
          </div>
        )}

        {/* Tab Content */}
        {!isLoading && (
          <>
            {activeTab === UserManagementTab.MANAGE_REGIONS && (
              <RegionManagement
                regions={regions}
                users={users}
                drones={drones}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onEditRegion={handleEditRegion}
                onDeleteRegion={handleDeleteRegion}
                setActiveTab={setActiveTab}
              />
            )}

            {activeTab === UserManagementTab.REGIONAL_COMMANDERS && (
              <RegionalCommandersList
                users={users.filter(u => u.role === UserRole.REGIONAL_HQ)}
                regions={regions}
                drones={drones}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                showInactive={showInactive}
                setShowInactive={setShowInactive}
                onEditUser={handleEditUser}
                onDeleteUser={handleDeleteUser}
                setActiveTab={setActiveTab}
              />
            )}

            {activeTab === UserManagementTab.OPERATORS && (
              <OperatorsList
                users={users.filter(u => u.role === UserRole.OPERATOR)}
                regions={regions}
                drones={drones}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                showInactive={showInactive}
                setShowInactive={setShowInactive}
                onEditUser={handleEditUser}
                onDeleteUser={handleDeleteUser}
                setActiveTab={setActiveTab}
              />
            )}

            {activeTab === UserManagementTab.CREATE_USER && (
              <CreateUserForm
                editingUser={editingUser}
                regions={regions}
                onCreateUser={handleCreateUser}
                onUpdateUser={handleUpdateUser}
                onCancel={() => {
                  setEditingUser(null);
                  setActiveTab(UserManagementTab.REGIONAL_COMMANDERS);
                }}
                isLoading={isLoading}
              />
            )}

            {activeTab === UserManagementTab.MANAGE_DRONES && (
              <DroneManagement
                drones={drones}
                users={users}
                regions={regions}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                setActiveTab={setActiveTab}
              />
            )}

            {activeTab === UserManagementTab.CREATE_DRONE && (
              <CreateDroneForm
                regions={regions}
                users={users}
                onCreateDrone={handleCreateDrone}
                onCancel={() => setActiveTab(UserManagementTab.MANAGE_DRONES)}
                isLoading={isLoading}
              />
            )}

            {activeTab === UserManagementTab.CREATE_REGION && (
              <CreateRegionForm
                editingRegion={editingRegion}
                users={users}
                onCreateRegion={handleCreateRegion}
                onUpdateRegion={handleUpdateRegion}
                onCancel={() => {
                  setEditingRegion(null);
                  setActiveTab(UserManagementTab.MANAGE_REGIONS);
                }}
                isLoading={isLoading}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default UserManagement;
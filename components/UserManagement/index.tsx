// components/UserManagement/index.tsx - Updated with Region Management
'use client';

import React, { useState, useEffect } from 'react';
import { Users, Clock, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { UserRole } from '../../types/auth';
import UserManagementTabs from './UserManagementTabs';
import RegionalCommandersList from './RegionalCommandersList';
import OperatorsList from './OperatorsList';
import CreateUserForm from './CreateUserForm';
import DroneManagement from './DroneManagement';
import CreateDroneForm from './CreateDroneForm';
import RegionManagement from './RegionManagement';
import CreateRegionForm from './CreateRegionForm';
import { User, Region, Drone, UserManagementTab, Notification } from './types';
import { MOCK_USERS, MOCK_REGIONS, MOCK_DRONES } from './mockData';

const UserManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<UserManagementTab>(UserManagementTab.MANAGE_REGIONS);
  const [users, setUsers] = useState<User[]>(MOCK_USERS);
  const [regions, setRegions] = useState<Region[]>(MOCK_REGIONS);
  const [drones, setDrones] = useState<Drone[]>(MOCK_DRONES);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showInactive, setShowInactive] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingRegion, setEditingRegion] = useState<Region | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Load initial data
  useEffect(() => {
    setIsLoading(true);
    setTimeout(() => {
      setUsers(MOCK_USERS);
      setRegions(MOCK_REGIONS);
      setDrones(MOCK_DRONES);
      setLastUpdated(new Date());
      setIsLoading(false);
    }, 800);
  }, []);

  // Utility functions
  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
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

  const refreshData = () => {
    setIsLoading(true);
    setTimeout(() => {
      setLastUpdated(new Date());
      setIsLoading(false);
      showNotification('Data refreshed successfully');
    }, 1000);
  };

  // Region management functions
  const handleCreateRegion = (regionData: any) => {
    setIsLoading(true);
    setTimeout(() => {
      const newRegion: Region = {
        ...regionData,
        id: `region-${String(Math.floor(Math.random() * 900) + 100)}`,
      };

      setRegions(prev => [...prev, newRegion]);
      setActiveTab(UserManagementTab.MANAGE_REGIONS);
      showNotification('Successfully created new region');
      setLastUpdated(new Date());
      setIsLoading(false);
    }, 800);
  };

  const handleUpdateRegion = (regionData: any) => {
    if (!editingRegion) return;
    
    setIsLoading(true);
    setTimeout(() => {
      const updatedRegion: Region = {
        ...editingRegion,
        ...regionData,
      };

      setRegions(prev => prev.map(region => region.id === updatedRegion.id ? updatedRegion : region));
      setActiveTab(UserManagementTab.MANAGE_REGIONS);
      showNotification('Successfully updated region');
      setEditingRegion(null);
      setLastUpdated(new Date());
      setIsLoading(false);
    }, 800);
  };

  const handleDeleteRegion = (regionId: string) => {
    setIsLoading(true);
    setTimeout(() => {
      const regionToDelete = regions.find(r => r.id === regionId);
      
      if (regionToDelete) {
        // Delete users in this region
        const usersToDelete = users.filter(u => u.regionId === regionId);
        setUsers(prev => prev.filter(user => user.regionId !== regionId));
        
        // Unassign drones from this region (but keep the drones)
        setDrones(prev => prev.map(drone => 
          drone.regionId === regionId 
            ? { ...drone, regionId: null, operatorId: null }
            : drone
        ));
        
        // Delete the region
        setRegions(prev => prev.filter(region => region.id !== regionId));
        
        showNotification(
          `Successfully deleted region "${regionToDelete.name}" and ${usersToDelete.length} associated user(s)`
        );
      }
      
      setLastUpdated(new Date());
      setIsLoading(false);
    }, 800);
  };

  const handleEditRegion = (region: Region) => {
    setEditingRegion(region);
    setActiveTab(UserManagementTab.CREATE_REGION);
  };

  // User management functions
  const handleCreateUser = (userData: any) => {
    setIsLoading(true);
    setTimeout(() => {
      const newUser: User = {
        ...userData,
        id: `user-${String(Math.floor(Math.random() * 900) + 100)}`,
        assignedDrones: [],
        assignedOperators: userData.role === UserRole.REGIONAL_HQ ? [] : undefined,
        createdAt: new Date().toISOString(),
      };

      setUsers(prev => [...prev, newUser]);
      setActiveTab(
        newUser.role === UserRole.REGIONAL_HQ 
          ? UserManagementTab.REGIONAL_COMMANDERS 
          : UserManagementTab.OPERATORS
      );
      showNotification(`Successfully created ${newUser.role === UserRole.REGIONAL_HQ ? 'Regional Commander' : 'Field Operator'}`);
      setLastUpdated(new Date());
      setIsLoading(false);
    }, 800);
  };

  const handleUpdateUser = (userData: any) => {
    if (!editingUser) return;
    
    setIsLoading(true);
    setTimeout(() => {
      const updatedUser: User = {
        ...editingUser,
        ...userData,
      };

      setUsers(prev => prev.map(user => user.id === updatedUser.id ? updatedUser : user));
      setActiveTab(
        updatedUser.role === UserRole.REGIONAL_HQ 
          ? UserManagementTab.REGIONAL_COMMANDERS 
          : UserManagementTab.OPERATORS
      );
      showNotification(`Successfully updated ${updatedUser.role === UserRole.REGIONAL_HQ ? 'Regional Commander' : 'Field Operator'}`);
      setEditingUser(null);
      setLastUpdated(new Date());
      setIsLoading(false);
    }, 800);
  };

  const handleDeleteUser = (userId: string) => {
    setIsLoading(true);
    setTimeout(() => {
      const userToDelete = users.find(u => u.id === userId);
      if (userToDelete) {
        // Unassign drones from this user
        setDrones(prev => prev.map(drone => 
          drone.operatorId === userId 
            ? { ...drone, operatorId: null }
            : drone
        ));
        
        setUsers(prev => prev.filter(user => user.id !== userId));
        showNotification(`Successfully deleted ${userToDelete.role === UserRole.REGIONAL_HQ ? 'Regional Commander' : 'Field Operator'}`);
      }
      setLastUpdated(new Date());
      setIsLoading(false);
    }, 800);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setActiveTab(UserManagementTab.CREATE_USER);
  };

  const handleCreateDrone = (droneData: any) => {
    setIsLoading(true);
    setTimeout(() => {
      const newDrone: Drone = {
        ...droneData,
        id: `drone-${String(Math.floor(Math.random() * 900) + 100)}`,
      };

      setDrones(prev => [...prev, newDrone]);
      setActiveTab(UserManagementTab.MANAGE_DRONES);
      showNotification('Successfully created new drone');
      setLastUpdated(new Date());
      setIsLoading(false);
    }, 800);
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
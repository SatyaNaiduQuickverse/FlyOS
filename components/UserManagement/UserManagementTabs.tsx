// components/UserManagement/UserManagementTabs.tsx - Tab Navigation Component
import React from 'react';
import { Shield, Users, UserPlus, Plane as Drone, PlusCircle } from 'lucide-react';
import { UserManagementTab, UserManagementTabsProps } from './types';

const UserManagementTabs: React.FC<UserManagementTabsProps> = ({
  activeTab,
  setActiveTab,
  editingUser
}) => {
  return (
    <div className="bg-gray-900/60 backdrop-blur-sm border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex overflow-x-auto py-2 no-scrollbar">
          <button 
            onClick={() => setActiveTab(UserManagementTab.REGIONAL_COMMANDERS)}
            className={`px-4 py-3 mx-1 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2
              ${activeTab === UserManagementTab.REGIONAL_COMMANDERS 
                ? 'bg-blue-900/20 text-blue-300 border border-blue-500/40' 
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/30'}`}
          >
            <Shield className="h-4 w-4" />
            REGIONAL COMMANDERS
          </button>
          
          <button 
            onClick={() => setActiveTab(UserManagementTab.OPERATORS)}
            className={`px-4 py-3 mx-1 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2
              ${activeTab === UserManagementTab.OPERATORS 
                ? 'bg-blue-900/20 text-blue-300 border border-blue-500/40' 
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/30'}`}
          >
            <Users className="h-4 w-4" />
            FIELD OPERATORS
          </button>
          
          <button 
            onClick={() => setActiveTab(UserManagementTab.MANAGE_DRONES)}
            className={`px-4 py-3 mx-1 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2
              ${activeTab === UserManagementTab.MANAGE_DRONES 
                ? 'bg-blue-900/20 text-blue-300 border border-blue-500/40' 
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/30'}`}
          >
            <Drone className="h-4 w-4" />
            MANAGE DRONES
          </button>
          
          <button 
            onClick={() => setActiveTab(UserManagementTab.CREATE_USER)}
            className={`px-4 py-3 mx-1 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2
              ${activeTab === UserManagementTab.CREATE_USER 
                ? 'bg-blue-900/20 text-blue-300 border border-blue-500/40' 
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/30'}`}
          >
            <UserPlus className="h-4 w-4" />
            {editingUser ? 'EDIT USER' : 'CREATE USER'}
          </button>
          
          <button 
            onClick={() => setActiveTab(UserManagementTab.CREATE_DRONE)}
            className={`px-4 py-3 mx-1 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2
              ${activeTab === UserManagementTab.CREATE_DRONE 
                ? 'bg-blue-900/20 text-blue-300 border border-blue-500/40' 
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/30'}`}
          >
            <PlusCircle className="h-4 w-4" />
            CREATE DRONE
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserManagementTabs;

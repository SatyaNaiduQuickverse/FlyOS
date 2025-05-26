// components/UserManagement/OperatorsList.tsx - Field Operators List Component
import React, { useState } from 'react';
import { 
  Search, UserPlus, Users, Edit, Trash2, 
  ChevronDown, ChevronUp, Plane as Drone 
} from 'lucide-react';
import { UserListProps, UserManagementTab } from './types';

const OperatorsList: React.FC<UserListProps> = ({
  users,
  regions,
  drones,
  searchQuery,
  setSearchQuery,
  showInactive,
  setShowInactive,
  onEditUser,
  onDeleteUser,
  setActiveTab
}) => {
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // Filter users based on search and status
  const filteredUsers = users.filter(user => {
    const matchesQuery = 
      searchQuery === '' ||
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = showInactive || user.status === 'ACTIVE';
    return matchesQuery && matchesStatus;
  });

  const toggleExpandUser = (userId: string) => {
    setExpandedUser(expandedUser === userId ? null : userId);
  };

  const getStatusStyles = (status: string): string => {
    switch(status) {
      case 'ACTIVE':
        return 'bg-gradient-to-r from-emerald-500/20 to-blue-500/20 text-blue-300 border border-blue-500/30';
      case 'STANDBY':
        return 'bg-gradient-to-r from-indigo-500/20 to-blue-500/20 text-indigo-300 border border-indigo-500/30';
      case 'MAINTENANCE':
        return 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/30';
      case 'OFFLINE':
      case 'INACTIVE':
        return 'bg-gradient-to-r from-red-500/20 to-rose-500/20 text-rose-300 border border-rose-500/30';
      default:
        return 'bg-gradient-to-r from-gray-500/20 to-slate-500/20 text-gray-300 border border-gray-500/30';
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

  return (
    <div className="p-6">
      {/* Search and Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-grow">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search field operators by name, username, or email..."
            className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg pl-10 pr-4 py-3 text-white w-full border border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:ring-offset-0 transition-all backdrop-blur-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg border border-gray-700 backdrop-blur-sm">
            <input
              type="checkbox"
              id="show-inactive-operators"
              className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-800"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            <label htmlFor="show-inactive-operators" className="text-sm text-gray-300 tracking-wider">
              Show Inactive
            </label>
          </div>
          <button
            onClick={() => setActiveTab(UserManagementTab.CREATE_USER)}
            className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-blue-300 rounded-lg border border-blue-500/30 hover:from-blue-500/30 hover:to-indigo-500/30 transition-all backdrop-blur-sm"
          >
            <UserPlus className="h-4 w-4" />
            <span className="tracking-wider font-light">Add Operator</span>
          </button>
        </div>
      </div>

      {/* User Cards */}
      {filteredUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-blue-500/10 rounded-full animate-pulse"></div>
            <Users className="h-16 w-16 text-gray-500 relative" />
          </div>
          <p className="text-xl tracking-wider font-light mb-2">No field operators found</p>
          <p className="text-sm text-gray-500">Try adjusting your search or create a new operator</p>
        </div>
      ) : (
        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
          {filteredUsers.map(user => (
            <div 
              key={user.id}
              className="rounded-lg border border-gray-800 bg-gradient-to-b from-gray-900/80 to-black/80 hover:from-gray-900 hover:to-black/90 transition-all duration-300 overflow-hidden backdrop-blur-sm shadow-lg"
            >
              {/* User Header */}
              <div 
                className="p-5 cursor-pointer"
                onClick={() => toggleExpandUser(user.id)}
              >
                <div className="flex flex-wrap justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-green-500/20 to-blue-500/20 border border-green-500/30 flex items-center justify-center">
                      <Users className="h-5 w-5 text-green-400" />
                    </div>
                    <div>
                      <div className="font-medium tracking-wider text-white text-lg">{user.fullName}</div>
                      <div className="text-sm text-gray-400">@{user.username}</div>
                    </div>
                    {expandedUser === user.id ? (
                      <ChevronUp className="h-5 w-5 text-gray-400 ml-2" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400 ml-2" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`text-xs px-3 py-1.5 rounded-full border font-medium tracking-wider ${getStatusStyles(user.status)}`}>
                      {user.status}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                    <div className="text-xs text-gray-400 mb-1 tracking-wider">EMAIL</div>
                    <div className="text-sm text-white">{user.email}</div>
                  </div>
                  
                  <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                    <div className="text-xs text-gray-400 mb-1 tracking-wider">REGION</div>
                    <div className="text-sm text-blue-300">
                      {user.regionId 
                        ? regions.find(r => r.id === user.regionId)?.name || 'Unknown' 
                        : 'Unassigned'}
                    </div>
                  </div>
                  
                  <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                    <div className="text-xs text-gray-400 mb-1 tracking-wider">ASSIGNED DRONES</div>
                    <div className="text-sm text-white font-medium">
                      {user.assignedDrones?.length || 0}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Expanded Details */}
              {expandedUser === user.id && (
                <div className="px-5 pb-5 border-t border-gray-800 pt-5 bg-gradient-to-r from-green-900/5 to-blue-900/5">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                      <div className="text-xs text-gray-400 mb-1 tracking-wider">USER ID</div>
                      <div className="text-sm text-white font-mono">{user.id}</div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                      <div className="text-xs text-gray-400 mb-1 tracking-wider">CREATED</div>
                      <div className="text-sm text-white">{formatDate(user.createdAt)}</div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                      <div className="text-xs text-gray-400 mb-1 tracking-wider">FLIGHT HOURS</div>
                      <div className="text-sm text-green-400 font-medium">
                        {Math.floor(Math.random() * 500) + 50}h
                      </div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                      <div className="text-xs text-gray-400 mb-1 tracking-wider">LAST ACTIVE</div>
                      <div className="text-sm text-green-400">Online</div>
                    </div>
                  </div>

                  {/* Assigned Drones */}
                  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50 mb-6">
                    <div className="flex justify-between items-center mb-3">
                      <h5 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                        <Drone className="h-4 w-4 text-green-400" />
                        Assigned Drones
                      </h5>
                      <span className="text-xs px-2 py-1 bg-green-500/20 text-green-300 rounded-full">
                        {user.assignedDrones?.length || 0}
                      </span>
                    </div>
                    {!user.assignedDrones || user.assignedDrones.length === 0 ? (
                      <div className="text-sm text-gray-400 py-2">No drones assigned</div>
                    ) : (
                      <div className="grid gap-2">
                        {user.assignedDrones.map(droneId => {
                          const drone = drones.find(d => d.id === droneId);
                          return drone ? (
                            <div key={droneId} className="flex items-center justify-between bg-gray-700/50 rounded p-3 text-sm">
                              <div className="flex items-center gap-3">
                                <Drone className="h-4 w-4 text-blue-400" />
                                <div>
                                  <div className="font-medium text-white">{drone.id}</div>
                                  <div className="text-xs text-gray-400">{drone.model}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusStyles(drone.status)}`}>
                                  {drone.status}
                                </span>
                                <div className="text-xs text-gray-400">
                                  {drone.regionId 
                                    ? regions.find(r => r.id === drone.regionId)?.name 
                                    : 'Unassigned'}
                                </div>
                              </div>
                            </div>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>

                  {/* Performance Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50 text-center">
                      <div className="text-xs text-gray-400 mb-1 tracking-wider">MISSIONS COMPLETED</div>
                      <div className="text-lg font-medium text-green-400">{Math.floor(Math.random() * 50) + 10}</div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50 text-center">
                      <div className="text-xs text-gray-400 mb-1 tracking-wider">SUCCESS RATE</div>
                      <div className="text-lg font-medium text-blue-400">{Math.floor(Math.random() * 20) + 80}%</div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50 text-center">
                      <div className="text-xs text-gray-400 mb-1 tracking-wider">CERTIFICATION</div>
                      <div className="text-lg font-medium text-yellow-400">Level {Math.floor(Math.random() * 3) + 1}</div>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditUser(user);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-blue-300 rounded-lg border border-blue-500/30 hover:from-blue-500/30 hover:to-indigo-500/30 transition-all text-sm tracking-wider font-light"
                    >
                      <Edit className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Are you sure you want to delete ${user.fullName}?`)) {
                          onDeleteUser(user.id);
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500/20 to-rose-500/20 text-red-300 rounded-lg border border-red-500/30 hover:from-red-500/30 hover:to-rose-500/30 transition-all text-sm tracking-wider font-light"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OperatorsList;

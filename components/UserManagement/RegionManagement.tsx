// components/UserManagement/RegionManagement.tsx - Region Management Component
import React, { useState } from 'react';
import { 
  Search, PlusCircle, Globe, Edit, Trash2, 
  ChevronDown, ChevronUp, Users, Plane as Drone,
  AlertTriangle, MapPin
} from 'lucide-react';
import { RegionManagementProps, UserManagementTab, Region } from './types';

const RegionManagement: React.FC<RegionManagementProps> = ({
  regions,
  users,
  drones,
  searchQuery,
  setSearchQuery,
  onEditRegion,
  onDeleteRegion,
  setActiveTab
}) => {
  const [expandedRegion, setExpandedRegion] = useState<string | null>(null);

  // Filter regions based on search query
  const filteredRegions = regions.filter(region => 
    searchQuery === '' || 
    region.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    region.area.toLowerCase().includes(searchQuery.toLowerCase()) ||
    region.commanderName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleExpandRegion = (regionId: string) => {
    setExpandedRegion(expandedRegion === regionId ? null : regionId);
  };

  const getStatusStyles = (status: string): string => {
    switch(status) {
      case 'ACTIVE':
        return 'bg-gradient-to-r from-emerald-500/20 to-blue-500/20 text-blue-300 border border-blue-500/30';
      case 'INACTIVE':
        return 'bg-gradient-to-r from-red-500/20 to-rose-500/20 text-rose-300 border border-rose-500/30';
      default:
        return 'bg-gradient-to-r from-gray-500/20 to-slate-500/20 text-gray-300 border border-gray-500/30';
    }
  };

  const getRegionStats = (regionId: string) => {
    const regionUsers = users.filter(u => u.regionId === regionId);
    const regionDrones = drones.filter(d => d.regionId === regionId);
    const commanders = regionUsers.filter(u => u.role === 'REGIONAL_HQ');
    const operators = regionUsers.filter(u => u.role === 'OPERATOR');
    
    return {
      totalUsers: regionUsers.length,
      commanders: commanders.length,
      operators: operators.length,
      totalDrones: regionDrones.length,
      activeDrones: regionDrones.filter(d => d.status === 'ACTIVE').length
    };
  };

  const handleDeleteRegion = (region: Region) => {
    const stats = getRegionStats(region.id);
    
    if (stats.totalUsers > 0) {
      const confirmMessage = `⚠️ WARNING: Deleting region "${region.name}" will also delete ${stats.totalUsers} user(s) (${stats.commanders} commander(s) + ${stats.operators} operator(s)). 

${stats.totalDrones} drone(s) will become unassigned but remain in the system.

This action cannot be undone. Are you sure?`;
      
      if (window.confirm(confirmMessage)) {
        onDeleteRegion(region.id);
      }
    } else {
      if (window.confirm(`Are you sure you want to delete region "${region.name}"?`)) {
        onDeleteRegion(region.id);
      }
    }
  };

  return (
    <div className="p-6">
      {/* Header Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-r from-gray-800/80 to-gray-900/80 p-4 rounded-lg border border-gray-700 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 tracking-wider">TOTAL REGIONS</p>
              <p className="text-2xl font-light text-white">{regions.length}</p>
            </div>
            <Globe className="h-8 w-8 text-blue-400" />
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 p-4 rounded-lg border border-blue-500/30 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-400 tracking-wider">ACTIVE REGIONS</p>
              <p className="text-2xl font-light text-blue-300">{regions.filter(r => r.status === 'ACTIVE').length}</p>
            </div>
            <div className="text-2xl">🟢</div>
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 p-4 rounded-lg border border-indigo-500/30 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-indigo-400 tracking-wider">TOTAL COMMANDERS</p>
              <p className="text-2xl font-light text-indigo-300">
                {users.filter(u => u.role === 'REGIONAL_HQ').length}
              </p>
            </div>
            <Users className="h-6 w-6 text-indigo-400" />
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 p-4 rounded-lg border border-amber-500/30 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-amber-400 tracking-wider">TOTAL OPERATORS</p>
              <p className="text-2xl font-light text-amber-300">
                {users.filter(u => u.role === 'OPERATOR').length}
              </p>
            </div>
            <Users className="h-6 w-6 text-amber-400" />
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-grow">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search regions by name, area, or commander..."
            className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg pl-10 pr-4 py-3 text-white w-full border border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all backdrop-blur-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          onClick={() => setActiveTab(UserManagementTab.CREATE_REGION)}
          className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-blue-300 rounded-lg border border-blue-500/30 hover:from-blue-500/30 hover:to-indigo-500/30 transition-all backdrop-blur-sm"
        >
          <PlusCircle className="h-4 w-4" />
          <span className="tracking-wider font-light">Create Region</span>
        </button>
      </div>

      {/* Results Summary */}
      {searchQuery && (
        <div className="mb-4 text-sm text-gray-400">
          Showing {filteredRegions.length} of {regions.length} regions
          {searchQuery && (
            <span> matching "{searchQuery}"</span>
          )}
        </div>
      )}

      {/* Region Cards */}
      {filteredRegions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-blue-500/10 rounded-full animate-pulse"></div>
            <Globe className="h-16 w-16 text-gray-500 relative" />
          </div>
          <p className="text-xl tracking-wider font-light mb-2">
            {searchQuery ? 'No regions found matching your search' : 'No regions found'}
          </p>
          <p className="text-sm text-gray-500">
            {searchQuery ? 'Try adjusting your search terms' : 'Create a new region to get started'}
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="mt-4 px-4 py-2 bg-blue-500/20 text-blue-300 rounded-lg border border-blue-500/30 hover:bg-blue-500/30 transition-all text-sm"
            >
              Clear Search
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRegions.map(region => {
            const stats = getRegionStats(region.id);
            
            return (
              <div 
                key={region.id}
                className="rounded-lg border border-gray-800 bg-gradient-to-b from-gray-900/80 to-black/80 hover:from-gray-900 hover:to-black/90 transition-all duration-300 overflow-hidden backdrop-blur-sm shadow-lg"
              >
                {/* Region Header */}
                <div 
                  className="p-5 cursor-pointer"
                  onClick={() => toggleExpandRegion(region.id)}
                >
                  <div className="flex flex-wrap justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border border-blue-500/30 flex items-center justify-center">
                        <Globe className="h-6 w-6 text-blue-400" />
                      </div>
                      <div>
                        <div className="font-medium tracking-wider text-white text-lg">{region.name}</div>
                        <div className="text-sm text-gray-400 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {region.area}
                        </div>
                      </div>
                      {expandedRegion === region.id ? (
                        <ChevronUp className="h-5 w-5 text-gray-400 ml-2" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-400 ml-2" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`text-xs px-3 py-1.5 rounded-full border font-medium tracking-wider ${getStatusStyles(region.status)}`}>
                        {region.status}
                      </div>
                    </div>
                  </div>
                  
                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                      <div className="text-xs text-gray-400 mb-1 tracking-wider">COMMANDER</div>
                      <div className="text-sm text-blue-300">
                        {region.commanderName || 'Unassigned'}
                      </div>
                    </div>
                    
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                      <div className="text-xs text-gray-400 mb-1 tracking-wider">PERSONNEL</div>
                      <div className="text-sm text-white font-medium">
                        {stats.totalUsers} ({stats.commanders}C + {stats.operators}O)
                      </div>
                    </div>
                    
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                      <div className="text-xs text-gray-400 mb-1 tracking-wider">TOTAL DRONES</div>
                      <div className="text-sm text-white font-medium">{stats.totalDrones}</div>
                    </div>
                    
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                      <div className="text-xs text-gray-400 mb-1 tracking-wider">ACTIVE DRONES</div>
                      <div className="text-sm text-green-400 font-medium">{stats.activeDrones}</div>
                    </div>
                  </div>
                </div>
                
                {/* Expanded Details */}
                {expandedRegion === region.id && (
                  <div className="px-5 pb-5 border-t border-gray-800 pt-5 bg-gradient-to-r from-blue-900/5 to-indigo-900/5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      {/* Personnel List */}
                      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                        <div className="flex justify-between items-center mb-3">
                          <h5 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                            <Users className="h-4 w-4 text-blue-400" />
                            Personnel
                          </h5>
                          <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded-full">
                            {stats.totalUsers}
                          </span>
                        </div>
                        {stats.totalUsers === 0 ? (
                          <div className="text-sm text-gray-400 py-2">No personnel assigned</div>
                        ) : (
                          <div className="space-y-2 max-h-32 overflow-y-auto">
                            {users.filter(u => u.regionId === region.id).slice(0, 5).map(user => (
                              <div key={user.id} className="flex items-center justify-between bg-gray-700/50 rounded p-2 text-sm">
                                <div>
                                  <span className="text-white">{user.fullName}</span>
                                  <span className="text-xs text-gray-400 ml-2">@{user.username}</span>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                  user.role === 'REGIONAL_HQ' 
                                    ? 'bg-blue-500/20 text-blue-300' 
                                    : 'bg-green-500/20 text-green-300'
                                }`}>
                                  {user.role === 'REGIONAL_HQ' ? 'CMD' : 'OPR'}
                                </span>
                              </div>
                            ))}
                            {users.filter(u => u.regionId === region.id).length > 5 && (
                              <div className="text-xs text-gray-400 text-center py-1">
                                +{users.filter(u => u.regionId === region.id).length - 5} more
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Drones List */}
                      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                        <div className="flex justify-between items-center mb-3">
                          <h5 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                            <Drone className="h-4 w-4 text-blue-400" />
                            Drones
                          </h5>
                          <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded-full">
                            {stats.totalDrones}
                          </span>
                        </div>
                        {stats.totalDrones === 0 ? (
                          <div className="text-sm text-gray-400 py-2">No drones assigned</div>
                        ) : (
                          <div className="space-y-2 max-h-32 overflow-y-auto">
                            {drones.filter(d => d.regionId === region.id).slice(0, 5).map(drone => (
                              <div key={drone.id} className="flex items-center justify-between bg-gray-700/50 rounded p-2 text-sm">
                                <div>
                                  <span className="text-white">{drone.id}</span>
                                  <span className="text-xs text-gray-400 ml-2">{drone.model}</span>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded-full ${getStatusStyles(drone.status)}`}>
                                  {drone.status}
                                </span>
                              </div>
                            ))}
                            {drones.filter(d => d.regionId === region.id).length > 5 && (
                              <div className="text-xs text-gray-400 text-center py-1">
                                +{drones.filter(d => d.regionId === region.id).length - 5} more
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Warning for deletion */}
                    {stats.totalUsers > 0 && (
                      <div className="bg-gradient-to-r from-red-500/10 to-rose-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                        <div className="flex items-center gap-2 text-red-300 text-sm">
                          <AlertTriangle className="h-4 w-4" />
                          <span>Warning: Deleting this region will also delete {stats.totalUsers} assigned user(s)</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Action Buttons */}
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditRegion(region);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-blue-300 rounded-lg border border-blue-500/30 hover:from-blue-500/30 hover:to-indigo-500/30 transition-all text-sm tracking-wider font-light"
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRegion(region);
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
            );
          })}
        </div>
      )}

      {/* Summary Footer */}
      {filteredRegions.length > 0 && (
        <div className="mt-8 p-4 bg-gradient-to-r from-gray-800/50 to-gray-900/50 rounded-lg border border-gray-700 backdrop-blur-sm">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-400">
              Displaying {filteredRegions.length} of {regions.length} regions
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span className="text-gray-400">
                  {regions.filter(r => r.status === 'ACTIVE').length} Active
                </span>
              </span>
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span className="text-gray-400">
                  {regions.filter(r => r.status === 'INACTIVE').length} Inactive
                </span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegionManagement;
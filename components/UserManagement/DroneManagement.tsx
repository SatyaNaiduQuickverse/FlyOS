// components/UserManagement/DroneManagement.tsx - Complete Drone Management Component
import React from 'react';
import { Search, PlusCircle, Plane as Drone, Edit, Filter, Settings, Eye } from 'lucide-react';
import { DroneManagementProps, UserManagementTab } from './types';

const DroneManagement: React.FC<DroneManagementProps> = ({
  drones,
  users,
  regions,
  searchQuery,
  setSearchQuery,
  setActiveTab
}) => {
  // Filter drones based on search query
  const filteredDrones = drones.filter(drone => 
    searchQuery === '' || 
    drone.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    drone.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
    drone.status.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (drone.regionId && regions.find(r => r.id === drone.regionId)?.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (drone.operatorId && users.find(u => u.id === drone.operatorId)?.fullName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getStatusStyles = (status: string): string => {
    switch(status) {
      case 'ACTIVE':
        return 'bg-gradient-to-r from-emerald-500/20 to-blue-500/20 text-blue-300 border border-blue-500/30';
      case 'STANDBY':
        return 'bg-gradient-to-r from-indigo-500/20 to-blue-500/20 text-indigo-300 border border-indigo-500/30';
      case 'MAINTENANCE':
        return 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/30';
      case 'OFFLINE':
        return 'bg-gradient-to-r from-red-500/20 to-rose-500/20 text-rose-300 border border-rose-500/30';
      default:
        return 'bg-gradient-to-r from-gray-500/20 to-slate-500/20 text-gray-300 border border-gray-500/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'ACTIVE':
        return '🟢';
      case 'STANDBY':
        return '🟡';
      case 'MAINTENANCE':
        return '🔧';
      case 'OFFLINE':
        return '🔴';
      default:
        return '⚪';
    }
  };

  const getModelSpecs = (model: string) => {
    switch(model) {
      case 'FlyOS-MQ5':
        return { range: '50 km', flightTime: '8 hours', payload: '5 kg' };
      case 'FlyOS-MQ7':
        return { range: '100 km', flightTime: '12 hours', payload: '15 kg' };
      case 'FlyOS-MQ9':
        return { range: '200 km', flightTime: '24 hours', payload: '30 kg' };
      default:
        return { range: 'N/A', flightTime: 'N/A', payload: 'N/A' };
    }
  };

  const handleEditDrone = (droneId: string) => {
    // TODO: Implement edit drone functionality
    console.log('Edit drone:', droneId);
    // This would typically set editing state and switch to create form
    // setActiveTab(UserManagementTab.CREATE_DRONE);
  };

  const handleViewDrone = (droneId: string) => {
    // Navigate to drone control page
    window.location.href = `/secure/main-hq/drone-control/${droneId}`;
  };

  const handleControlDrone = (droneId: string) => {
    // Navigate to drone control page with control mode
    window.location.href = `/secure/main-hq/drone-control/${droneId}?mode=control`;
  };

  return (
    <div className="p-6">
      {/* Header Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-gradient-to-r from-gray-800/80 to-gray-900/80 p-4 rounded-lg border border-gray-700 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 tracking-wider">TOTAL FLEET</p>
              <p className="text-2xl font-light text-white">{drones.length}</p>
            </div>
            <Drone className="h-8 w-8 text-blue-400" />
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 p-4 rounded-lg border border-blue-500/30 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-400 tracking-wider">ACTIVE</p>
              <p className="text-2xl font-light text-blue-300">{drones.filter(d => d.status === 'ACTIVE').length}</p>
            </div>
            <div className="text-2xl">🟢</div>
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 p-4 rounded-lg border border-indigo-500/30 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-indigo-400 tracking-wider">STANDBY</p>
              <p className="text-2xl font-light text-indigo-300">{drones.filter(d => d.status === 'STANDBY').length}</p>
            </div>
            <div className="text-2xl">🟡</div>
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 p-4 rounded-lg border border-amber-500/30 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-amber-400 tracking-wider">MAINTENANCE</p>
              <p className="text-2xl font-light text-amber-300">{drones.filter(d => d.status === 'MAINTENANCE').length}</p>
            </div>
            <div className="text-2xl">🔧</div>
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-red-500/10 to-rose-500/10 p-4 rounded-lg border border-red-500/30 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-red-400 tracking-wider">OFFLINE</p>
              <p className="text-2xl font-light text-red-300">{drones.filter(d => d.status === 'OFFLINE').length}</p>
            </div>
            <div className="text-2xl">🔴</div>
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
            placeholder="Search drones by ID, model, status, region, or operator..."
            className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg pl-10 pr-4 py-3 text-white w-full border border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all backdrop-blur-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg border border-gray-700 backdrop-blur-sm">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              className="bg-transparent text-white border-0 focus:ring-0 text-sm p-0 min-w-0"
              onChange={(e) => setSearchQuery(e.target.value ? e.target.value : '')}
            >
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="STANDBY">Standby</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="OFFLINE">Offline</option>
            </select>
          </div>
          <button
            onClick={() => setActiveTab(UserManagementTab.CREATE_DRONE)}
            className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-blue-300 rounded-lg border border-blue-500/30 hover:from-blue-500/30 hover:to-indigo-500/30 transition-all backdrop-blur-sm"
          >
            <PlusCircle className="h-4 w-4" />
            <span className="tracking-wider font-light">Add Drone</span>
          </button>
        </div>
      </div>

      {/* Results Summary */}
      {searchQuery && (
        <div className="mb-4 text-sm text-gray-400">
          Showing {filteredDrones.length} of {drones.length} drones
          {searchQuery && (
            <span> matching "{searchQuery}"</span>
          )}
        </div>
      )}

      {/* Drone Grid */}
      {filteredDrones.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-blue-500/10 rounded-full animate-pulse"></div>
            <Drone className="h-16 w-16 text-gray-500 relative" />
          </div>
          <p className="text-xl tracking-wider font-light mb-2">
            {searchQuery ? 'No drones found matching your search' : 'No drones found'}
          </p>
          <p className="text-sm text-gray-500">
            {searchQuery ? 'Try adjusting your search terms' : 'Create a new drone to get started'}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredDrones.map(drone => {
            const assignedOperator = users.find(u => u.id === drone.operatorId);
            const assignedRegion = regions.find(r => r.id === drone.regionId);
            const specs = getModelSpecs(drone.model);
            
            return (
              <div 
                key={drone.id}
                className="rounded-lg border border-gray-800 bg-gradient-to-b from-gray-900/80 to-black/80 hover:from-gray-900 hover:to-black/90 transition-all duration-300 overflow-hidden backdrop-blur-sm group shadow-lg hover:shadow-xl"
              >
                {/* Drone Header */}
                <div className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border border-blue-500/30 flex items-center justify-center">
                        <Drone className="h-6 w-6 text-blue-400" />
                      </div>
                      <div>
                        <div className="font-medium tracking-wider text-white text-lg">{drone.id}</div>
                        <div className="text-sm text-gray-400">{drone.model}</div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-xl">{getStatusIcon(drone.status)}</span>
                      <div className={`text-xs px-2 py-1 rounded-full font-medium tracking-wider ${getStatusStyles(drone.status)}`}>
                        {drone.status}
                      </div>
                    </div>
                  </div>
                  
                  {/* Assignment Info */}
                  <div className="space-y-3 mb-4">
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                      <div className="text-xs text-gray-400 mb-1 tracking-wider">REGION</div>
                      <div className="text-sm text-white">
                        {assignedRegion ? assignedRegion.name : 'Unassigned'}
                      </div>
                      {assignedRegion && (
                        <div className="text-xs text-gray-400 mt-1">{assignedRegion.area}</div>
                      )}
                    </div>
                    
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                      <div className="text-xs text-gray-400 mb-1 tracking-wider">OPERATOR</div>
                      <div className="text-sm text-white">
                        {assignedOperator ? assignedOperator.fullName : 'Unassigned'}
                      </div>
                      {assignedOperator && (
                        <div className="text-xs text-gray-400 mt-1">@{assignedOperator.username}</div>
                      )}
                    </div>

                    {/* Specifications */}
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                      <div className="text-xs text-gray-400 mb-2 tracking-wider">SPECIFICATIONS</div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="text-center">
                          <div className="text-blue-400 font-medium">{specs.range}</div>
                          <div className="text-gray-500">Range</div>
                        </div>
                        <div className="text-center">
                          <div className="text-green-400 font-medium">{specs.flightTime}</div>
                          <div className="text-gray-500">Flight</div>
                        </div>
                        <div className="text-center">
                          <div className="text-yellow-400 font-medium">{specs.payload}</div>
                          <div className="text-gray-500">Payload</div>
                        </div>
                      </div>
                    </div>

                    {/* Live Stats */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-gray-800/50 rounded-lg p-2 border border-gray-700/50 text-center">
                        <div className="text-xs text-gray-400 mb-1">FLIGHT HOURS</div>
                        <div className="text-sm font-medium text-blue-400">{Math.floor(Math.random() * 500) + 50}h</div>
                      </div>
                      <div className="bg-gray-800/50 rounded-lg p-2 border border-gray-700/50 text-center">
                        <div className="text-xs text-gray-400 mb-1">BATTERY</div>
                        <div className={`text-sm font-medium ${drone.status === 'ACTIVE' ? 'text-green-400' : 'text-gray-400'}`}>
                          {drone.status === 'ACTIVE' ? `${Math.floor(Math.random() * 30) + 70}%` : 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleViewDrone(drone.id)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-blue-300 rounded-lg border border-blue-500/30 hover:from-blue-500/30 hover:to-indigo-500/30 transition-all text-sm tracking-wider font-light"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </button>
                      <button
                        onClick={() => handleEditDrone(drone.id)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-gray-500/20 to-slate-500/20 text-gray-300 rounded-lg border border-gray-500/30 hover:from-gray-500/30 hover:to-slate-500/30 transition-all text-sm tracking-wider font-light"
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </button>
                    </div>
                    
                    {drone.status === 'ACTIVE' && (
                      <button
                        onClick={() => handleControlDrone(drone.id)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-300 rounded-lg border border-green-500/30 hover:from-green-500/30 hover:to-emerald-500/30 transition-all text-sm tracking-wider font-light"
                      >
                        <Settings className="h-4 w-4" />
                        Take Control
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary Footer */}
      {filteredDrones.length > 0 && (
        <div className="mt-8 p-4 bg-gradient-to-r from-gray-800/50 to-gray-900/50 rounded-lg border border-gray-700 backdrop-blur-sm">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-400">
              Displaying {filteredDrones.length} of {drones.length} drones
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span className="text-gray-400">
                  {drones.filter(d => d.status === 'ACTIVE').length} Active
                </span>
              </span>
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                <span className="text-gray-400">
                  {drones.filter(d => d.status === 'MAINTENANCE').length} Maintenance
                </span>
              </span>
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span className="text-gray-400">
                  {drones.filter(d => d.status === 'OFFLINE').length} Offline
                </span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DroneManagement;

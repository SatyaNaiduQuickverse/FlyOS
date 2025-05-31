// components/HierarchyTree3D.tsx - FIXED VERSION
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { 
  Users, 
  Shield, 
  UserCheck, 
  Plane, 
  Globe, 
  X,
  RotateCcw,
  Info,
  Loader2,
  ChevronDown,
  ChevronRight,
  Building,
  Zap
} from 'lucide-react';

// Interfaces
interface HierarchyNode {
  id: string;
  type: 'MAIN_HQ' | 'REGIONAL_HQ' | 'OPERATOR' | 'REGION' | 'DRONE' | 'UNASSIGNED';
  name: string;
  username?: string;
  email?: string;
  area?: string;
  commanderName?: string;
  model?: string;
  status?: string;
  role?: string;
  children: HierarchyNode[];
  droneCount?: number;
  userCount?: number;
}

interface ApiRegion {
  id: string;
  name: string;
  area: string;
  commanderName: string | null;
  status: string;
  userCount: number;
  droneCount: number;
  users: Array<{
    id: string;
    username: string;
    fullName: string;
    role: string;
    status: string;
  }>;
  drones: Array<{
    id: string;
    model: string;
    status: string;
  }>;
}

interface ApiDrone {
  id: string;
  model: string;
  status: string;
  regionId: string | null;
  operatorId: string | null;
}

// Node colors and icons
const getNodeColor = (node: HierarchyNode): string => {
  switch (node.type) {
    case 'MAIN_HQ': return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    case 'REGIONAL_HQ': return 'bg-green-500/20 text-green-300 border-green-500/40';
    case 'OPERATOR': return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    case 'REGION': return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
    case 'DRONE':
      switch (node.status) {
        case 'ACTIVE': return 'bg-green-500/20 text-green-300 border-green-500/40';
        case 'STANDBY': return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
        case 'MAINTENANCE': return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
        case 'OFFLINE': return 'bg-red-500/20 text-red-300 border-red-500/40';
        default: return 'bg-gray-500/20 text-gray-300 border-gray-500/40';
      }
    case 'UNASSIGNED': return 'bg-gray-500/20 text-gray-300 border-gray-500/40';
    default: return 'bg-gray-500/20 text-gray-300 border-gray-500/40';
  }
};

const getNodeIcon = (type: string) => {
  switch (type) {
    case 'MAIN_HQ': return Users;
    case 'REGIONAL_HQ': return Shield;
    case 'OPERATOR': return UserCheck;
    case 'DRONE': return Plane;
    case 'REGION': return Building;
    case 'UNASSIGNED': return Users;
    default: return Users;
  }
};

// Tree Node Component
const TreeNode: React.FC<{
  node: HierarchyNode;
  level: number;
  onNodeClick: (node: HierarchyNode) => void;
  selectedNode: HierarchyNode | null;
  expandedNodes: Set<string>;
  onToggleExpand: (nodeId: string) => void;
}> = ({ node, level, onNodeClick, selectedNode, expandedNodes, onToggleExpand }) => {
  const isSelected = selectedNode?.id === node.id;
  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.children && node.children.length > 0;
  const indentation = level * 24;
  const IconComponent = getNodeIcon(node.type);
  
  return (
    <div className="mb-1">
      <div
        style={{ paddingLeft: `${indentation}px` }}
        className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
          isSelected 
            ? 'ring-2 ring-blue-500 ' + getNodeColor(node)
            : 'hover:bg-gray-800/50 ' + getNodeColor(node)
        }`}
        onClick={() => onNodeClick(node)}
      >
        {/* Expand/Collapse Button */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            className="text-gray-400 hover:text-white p-1"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <div className="w-6" /> // Spacer for alignment
        )}
        
        {/* Node Icon */}
        <IconComponent className="h-5 w-5" />
        
        {/* Node Content */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{node.name}</span>
            <span className="text-xs px-2 py-1 rounded bg-gray-800/50">
              {node.type}
            </span>
            {node.status && (
              <span className="text-xs px-2 py-1 rounded bg-gray-700/50">
                {node.status}
              </span>
            )}
          </div>
          
          {/* Additional Info */}
          {(node.userCount !== undefined || node.droneCount !== undefined) && (
            <div className="text-xs text-gray-400 mt-1 flex gap-3">
              {node.userCount !== undefined && (
                <span>👥 {node.userCount} users</span>
              )}
              {node.droneCount !== undefined && (
                <span>🚁 {node.droneCount} drones</span>
              )}
            </div>
          )}
        </div>
        
        {/* Connection Indicator */}
        {hasChildren && (
          <div className="text-gray-500 text-xs">
            {node.children.length} {node.children.length === 1 ? 'child' : 'children'}
          </div>
        )}
      </div>
      
      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="mt-1">
          {node.children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              onNodeClick={onNodeClick}
              selectedNode={selectedNode}
              expandedNodes={expandedNodes}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Detail Panel Component
const NodeDetailPanel: React.FC<{
  node: HierarchyNode | null;
  onClose: () => void;
}> = ({ node, onClose }) => {
  if (!node) return null;
  
  const IconComponent = getNodeIcon(node.type);
  
  return (
    <div className="absolute top-4 right-4 w-80 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg p-6 text-white z-20">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${getNodeColor(node)}`}>
            <IconComponent className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">{node.name}</h3>
            <p className="text-sm text-gray-400">{node.type}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      
      <div className="space-y-3">
        {node.username && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Username</label>
            <p className="text-sm text-blue-300">{node.username}</p>
          </div>
        )}
        
        {node.email && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Email</label>
            <p className="text-sm">{node.email}</p>
          </div>
        )}
        
        {node.area && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Area</label>
            <p className="text-sm">{node.area}</p>
          </div>
        )}
        
        {node.commanderName && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Commander</label>
            <p className="text-sm">{node.commanderName}</p>
          </div>
        )}
        
        {node.model && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Model</label>
            <p className="text-sm">{node.model}</p>
          </div>
        )}
        
        {node.status && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Status</label>
            <span className={`text-sm px-2 py-1 rounded-md ${getNodeColor(node)}`}>
              {node.status}
            </span>
          </div>
        )}
        
        {node.role && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Role</label>
            <p className="text-sm">{node.role}</p>
          </div>
        )}
        
        {node.userCount !== undefined && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Users</label>
            <p className="text-sm">{node.userCount} personnel</p>
          </div>
        )}
        
        {node.droneCount !== undefined && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Drones</label>
            <p className="text-sm">{node.droneCount} units</p>
          </div>
        )}
        
        {node.children && node.children.length > 0 && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Children</label>
            <p className="text-sm">{node.children.length} connected nodes</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Main Component
const HierarchyTree3D: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  token: string;
}> = ({ isOpen, onClose, token }) => {
  const [selectedNode, setSelectedNode] = useState<HierarchyNode | null>(null);
  const [hierarchyData, setHierarchyData] = useState<HierarchyNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['main-hq']));
  
  // Transform API data to hierarchy structure
  const transformDataToHierarchy = useCallback((regions: any[], allDrones: any[]): HierarchyNode => {
    const mainHQ: HierarchyNode = {
      id: 'main-hq',
      type: 'MAIN_HQ',
      name: 'Main Command',
      username: 'main_admin',
      email: 'main@flyos.mil',
      role: 'MAIN_HQ',
      children: []
    };

    // Process regions
    regions.forEach((region) => {
      const regionNode: HierarchyNode = {
        id: region.id,
        type: 'REGION',
        name: region.name,
        area: region.area || 'Unknown Area',
        commanderName: region.commanderName || undefined,
        status: region.status || 'ACTIVE',
        userCount: region.userCount || 0,
        droneCount: region.droneCount || 0,
        children: []
      };

      // Add users if they exist
      const users = region.users || [];
      
      // Add regional commander
      const commander = users.find && users.find((u: any) => u.role === 'REGIONAL_HQ');
      if (commander) {
        const commanderNode: HierarchyNode = {
          id: commander.id,
          type: 'REGIONAL_HQ',
          name: commander.fullName,
          username: commander.username,
          role: commander.role,
          status: commander.status,
          children: []
        };

        // Add operators under this commander
        const operators = users.filter ? users.filter((u: any) => u.role === 'OPERATOR') : [];
        operators.forEach((operator: any) => {
          const operatorNode: HierarchyNode = {
            id: operator.id,
            type: 'OPERATOR',
            name: operator.fullName,
            username: operator.username,
            role: operator.role,
            status: operator.status,
            children: []
          };

          // Add drones operated by this operator
          const operatorDrones = allDrones.filter ? allDrones.filter((d: any) => d.operatorId === operator.id) : [];
          operatorDrones.forEach((drone: any) => {
            const droneNode: HierarchyNode = {
              id: drone.id,
              type: 'DRONE',
              name: drone.id,
              model: drone.model,
              status: drone.status,
              children: []
            };
            operatorNode.children.push(droneNode);
          });

          commanderNode.children.push(operatorNode);
        });

        // Add region drones without operator
        const regionDrones = allDrones.filter ? allDrones.filter((d: any) => d.regionId === region.id && !d.operatorId) : [];
        regionDrones.forEach((drone: any) => {
          const droneNode: HierarchyNode = {
            id: drone.id,
            type: 'DRONE',
            name: drone.id,
            model: drone.model,
            status: drone.status,
            children: []
          };
          commanderNode.children.push(droneNode);
        });

        regionNode.children.push(commanderNode);
      } else {
        // No commander, add drones directly to region
        const regionDrones = allDrones.filter ? allDrones.filter((d: any) => d.regionId === region.id) : [];
        regionDrones.forEach((drone: any) => {
          const droneNode: HierarchyNode = {
            id: drone.id,
            type: 'DRONE',
            name: drone.id,
            model: drone.model,
            status: drone.status,
            children: []
          };
          regionNode.children.push(droneNode);
        });
      }

      mainHQ.children.push(regionNode);
    });

    // Add unassigned drones
    const unassignedDrones = allDrones.filter ? allDrones.filter((d: any) => !d.regionId) : [];
    if (unassignedDrones.length > 0) {
      const unassignedNode: HierarchyNode = {
        id: 'unassigned',
        type: 'UNASSIGNED',
        name: 'Unassigned Assets',
        droneCount: unassignedDrones.length,
        children: []
      };

      unassignedDrones.forEach((drone: any) => {
        const droneNode: HierarchyNode = {
          id: drone.id,
          type: 'DRONE',
          name: drone.id,
          model: drone.model,
          status: drone.status,
          children: []
        };
        unassignedNode.children.push(droneNode);
      });

      mainHQ.children.push(unassignedNode);
    }

    return mainHQ;
  }, []);

  // Fetch data from frontend API routes
  const fetchHierarchyData = useCallback(async () => {
    if (!token) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const [regionsResponse, dronesResponse] = await Promise.all([
        fetch('/api/regions', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/drones', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (!regionsResponse.ok || !dronesResponse.ok) {
        throw new Error('Failed to fetch hierarchy data');
      }

      const regionsData = await regionsResponse.json();
      const dronesData = await dronesResponse.json();

      console.log('Regions data:', regionsData);
      console.log('Drones data:', dronesData);

      // Handle different response formats
      const regions = regionsData.regions || regionsData || [];
      const drones = dronesData.drones || dronesData || [];

      const hierarchy = transformDataToHierarchy(regions, drones);
      setHierarchyData(hierarchy);
      
    } catch (err: any) {
      console.error('Error fetching hierarchy data:', err);
      setError(err.message || 'Failed to load hierarchy data');
    } finally {
      setLoading(false);
    }
  }, [token, transformDataToHierarchy]);

  useEffect(() => {
    if (isOpen && token) {
      fetchHierarchyData();
    }
  }, [isOpen, token, fetchHierarchyData]);

  const handleNodeClick = useCallback((node: HierarchyNode) => {
    setSelectedNode(node);
  }, []);
  
  const handleCloseDetail = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleToggleExpand = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    if (!hierarchyData) return;
    
    const allNodeIds = new Set<string>();
    const traverse = (node: HierarchyNode) => {
      allNodeIds.add(node.id);
      node.children?.forEach(traverse);
    };
    traverse(hierarchyData);
    
    setExpandedNodes(allNodeIds);
  }, [hierarchyData]);

  const handleCollapseAll = useCallback(() => {
    setExpandedNodes(new Set(['main-hq'])); // Keep main HQ expanded
  }, []);

  const handleRefresh = useCallback(() => {
    fetchHierarchyData();
  }, [fetchHierarchyData]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gray-900/80 backdrop-blur-sm border-b border-gray-700 p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Globe className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Command Hierarchy</h2>
              <p className="text-sm text-gray-400">Interactive tree view of the FlyOS command structure</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleExpandAll}
              className="px-3 py-1 text-sm bg-gray-800 hover:bg-gray-700 rounded transition-colors text-white"
              title="Expand All"
            >
              Expand All
            </button>
            
            <button
              onClick={handleCollapseAll}
              className="px-3 py-1 text-sm bg-gray-800 hover:bg-gray-700 rounded transition-colors text-white"
              title="Collapse All"
            >
              Collapse All
            </button>
            
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-white disabled:opacity-50"
              title="Refresh Data"
            >
              <RotateCcw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            
            <button
              onClick={onClose}
              className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Controls Legend */}
      <div className="absolute bottom-4 left-4 z-10 bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-lg p-4 text-white">
        <h4 className="font-semibold mb-2 flex items-center gap-2">
          <Info className="h-4 w-4" />
          Tree View
        </h4>
        <div className="space-y-1 text-sm text-gray-300">
          <p>• Click to select node</p>
          <p>• Use chevrons to expand/collapse</p>
          <p>• Selected node shows details</p>
        </div>
      </div>
      
      {/* Loading/Error States */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div className="bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-lg p-8 text-white">
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
              <span>Loading hierarchy data...</span>
            </div>
          </div>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div className="bg-red-900/90 backdrop-blur-sm border border-red-700 rounded-lg p-8 text-white max-w-md">
            <h3 className="font-semibold mb-2">Error Loading Data</h3>
            <p className="text-sm text-red-200 mb-4">{error}</p>
            <div className="flex gap-2">
              <button
                onClick={handleRefresh}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded transition-colors"
              >
                Retry
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Tree View */}
      {hierarchyData && !loading && !error && (
        <div className="absolute inset-0 pt-20 pb-4">
          <div className="h-full flex">
            <div className="flex-1 overflow-auto p-6">
              <TreeNode
                node={hierarchyData}
                level={0}
                onNodeClick={handleNodeClick}
                selectedNode={selectedNode}
                expandedNodes={expandedNodes}
                onToggleExpand={handleToggleExpand}
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Node Detail Panel */}
      <NodeDetailPanel node={selectedNode} onClose={handleCloseDetail} />
    </div>
  );
};

export default HierarchyTree3D;
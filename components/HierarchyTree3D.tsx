// components/HierarchyTree3D.tsx - COMPLETE FIXED VERSION
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
  
  // Transform API data to hierarchy structure - ENHANCED WITH DEBUGGING
  const transformDataToHierarchy = useCallback((users: any[], regions: any[], drones: any[]): HierarchyNode => {
    console.log('🔍 HIERARCHY TRANSFORMATION DEBUG');
    console.log('==================================');
    console.log('Raw data received:', { users: users.length, regions: regions.length, drones: drones.length });
    
    // Debug: Show sample data
    console.log('Sample user:', users[0]);
    console.log('Sample region:', regions[0]);
    console.log('Sample drone:', drones[0]);
    
    // Debug: Show user roles
    const usersByRole = users.reduce((acc: any, user: any) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {});
    console.log('Users by role:', usersByRole);
    
    // Debug: Show user-region relationships
    const usersByRegion = users.reduce((acc: any, user: any) => {
      const regionKey = user.regionId || 'no-region';
      acc[regionKey] = (acc[regionKey] || 0) + 1;
      return acc;
    }, {});
    console.log('Users by region:', usersByRegion);

    // Create Main HQ root node
    const mainHQ: HierarchyNode = {
      id: 'main-hq',
      type: 'MAIN_HQ',
      name: 'Main Command Center',
      username: 'main_admin',
      email: 'main@flyos.mil',
      role: 'MAIN_HQ',
      children: []
    };

    // Add Main HQ users first (users with MAIN_HQ role or no region)
    const mainHQUsers = users.filter((user: any) => user.role === 'MAIN_HQ');
    console.log('Main HQ users found:', mainHQUsers.length, mainHQUsers.map(u => u.username));

    // Process each region
    console.log('\n🌍 PROCESSING REGIONS:');
    regions.forEach((region: any, regionIndex: number) => {
      console.log(`\nRegion ${regionIndex + 1}: ${region.name} (${region.id})`);
      
      const regionNode: HierarchyNode = {
        id: region.id,
        type: 'REGION',
        name: region.name,
        area: region.area,
        commanderName: region.commanderName,
        status: region.status,
        children: []
      };

      // Find users in this region
      const regionUsers = users.filter((user: any) => user.regionId === region.id);
      const regionDrones = drones.filter((drone: any) => drone.regionId === region.id);
      
      console.log(`  Users in region: ${regionUsers.length}`);
      regionUsers.forEach(user => console.log(`    - ${user.fullName} (${user.role}) - ${user.username}`));
      
      console.log(`  Drones in region: ${regionDrones.length}`);
      regionDrones.forEach(drone => console.log(`    - ${drone.id} (${drone.status}) - Operator: ${drone.operatorId || 'none'}`));
      
      // Add counts to region
      regionNode.userCount = regionUsers.length;
      regionNode.droneCount = regionDrones.length;

      // Find regional commander
      const commanders = regionUsers.filter((user: any) => user.role === 'REGIONAL_HQ');
      console.log(`  Commanders found: ${commanders.length}`);
      
      if (commanders.length > 0) {
        // Use the first commander found
        const commander = commanders[0];
        console.log(`  Using commander: ${commander.fullName}`);
        
        const commanderNode: HierarchyNode = {
          id: commander.id,
          type: 'REGIONAL_HQ',
          name: commander.fullName,
          username: commander.username,
          email: commander.email,
          role: commander.role,
          status: commander.status,
          children: []
        };

        // Find operators in this region
        const operators = regionUsers.filter((user: any) => user.role === 'OPERATOR');
        console.log(`  Operators found: ${operators.length}`);
        
        operators.forEach((operator: any, opIndex: number) => {
          console.log(`    Operator ${opIndex + 1}: ${operator.fullName} (${operator.id})`);
          
          const operatorNode: HierarchyNode = {
            id: operator.id,
            type: 'OPERATOR',
            name: operator.fullName,
            username: operator.username,
            email: operator.email,
            role: operator.role,
            status: operator.status,
            children: []
          };

          // Find drones assigned to this operator
          const operatorDrones = regionDrones.filter((drone: any) => drone.operatorId === operator.id);
          console.log(`      Drones assigned to ${operator.fullName}: ${operatorDrones.length}`);
          
          operatorDrones.forEach((drone: any) => {
            console.log(`        - ${drone.id} (${drone.status})`);
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

        // Add unassigned drones in this region directly to commander
        const unassignedRegionDrones = regionDrones.filter((drone: any) => !drone.operatorId);
        console.log(`  Unassigned drones in region: ${unassignedRegionDrones.length}`);
        
        unassignedRegionDrones.forEach((drone: any) => {
          console.log(`    - ${drone.id} (unassigned)`);
          const droneNode: HierarchyNode = {
            id: `unassigned-${drone.id}`,
            type: 'DRONE',
            name: `${drone.id} (Unassigned)`,
            model: drone.model,
            status: drone.status,
            children: []
          };
          commanderNode.children.push(droneNode);
        });

        regionNode.children.push(commanderNode);
        
        // Add any additional commanders as separate nodes
        if (commanders.length > 1) {
          for (let i = 1; i < commanders.length; i++) {
            const additionalCommander = commanders[i];
            const additionalCommanderNode: HierarchyNode = {
              id: additionalCommander.id,
              type: 'REGIONAL_HQ',
              name: additionalCommander.fullName,
              username: additionalCommander.username,
              email: additionalCommander.email,
              role: additionalCommander.role,
              status: additionalCommander.status,
              children: []
            };
            regionNode.children.push(additionalCommanderNode);
          }
        }
        
      } else {
        console.log(`  No commander found - adding users and drones directly to region`);
        
        // No commander - add users directly to region
        regionUsers.forEach((user: any) => {
          console.log(`    Adding user directly: ${user.fullName} (${user.role})`);
          const userNode: HierarchyNode = {
            id: user.id,
            type: user.role === 'REGIONAL_HQ' ? 'REGIONAL_HQ' : 'OPERATOR',
            name: user.fullName,
            username: user.username,
            email: user.email,
            role: user.role,
            status: user.status,
            children: []
          };
          
          // If this is an operator, add their drones
          if (user.role === 'OPERATOR') {
            const operatorDrones = regionDrones.filter((drone: any) => drone.operatorId === user.id);
            operatorDrones.forEach((drone: any) => {
              const droneNode: HierarchyNode = {
                id: drone.id,
                type: 'DRONE',
                name: drone.id,
                model: drone.model,
                status: drone.status,
                children: []
              };
              userNode.children.push(droneNode);
            });
          }
          
          regionNode.children.push(userNode);
        });

        // Add unassigned drones to region
        const unassignedRegionDrones = regionDrones.filter((drone: any) => !drone.operatorId);
        unassignedRegionDrones.forEach((drone: any) => {
          console.log(`    Adding unassigned drone: ${drone.id}`);
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

      console.log(`  Region ${region.name} final children: ${regionNode.children.length}`);
      mainHQ.children.push(regionNode);
    });

    // Add unassigned drones (no region)
    console.log('\n🚁 PROCESSING UNASSIGNED DRONES:');
    const unassignedDrones = drones.filter((drone: any) => !drone.regionId);
    console.log(`Unassigned drones found: ${unassignedDrones.length}`);
    
    if (unassignedDrones.length > 0) {
      const unassignedNode: HierarchyNode = {
        id: 'unassigned-assets',
        type: 'UNASSIGNED',
        name: 'Unassigned Assets',
        droneCount: unassignedDrones.length,
        children: []
      };

      unassignedDrones.forEach((drone: any) => {
        console.log(`  - ${drone.id} (${drone.status})`);
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

    // Add unassigned users (no region, not MAIN_HQ)
    console.log('\n👥 PROCESSING UNASSIGNED USERS:');
    const unassignedUsers = users.filter((user: any) => !user.regionId && user.role !== 'MAIN_HQ');
    console.log(`Unassigned users found: ${unassignedUsers.length}`);
    
    if (unassignedUsers.length > 0) {
      const unassignedUsersNode: HierarchyNode = {
        id: 'unassigned-users',
        type: 'UNASSIGNED',
        name: 'Unassigned Personnel',
        userCount: unassignedUsers.length,
        children: []
      };

      unassignedUsers.forEach((user: any) => {
        console.log(`  - ${user.fullName} (${user.role})`);
        const userNode: HierarchyNode = {
          id: user.id,
          type: user.role === 'REGIONAL_HQ' ? 'REGIONAL_HQ' : 'OPERATOR',
          name: user.fullName,
          username: user.username,
          email: user.email,
          role: user.role,
          status: user.status,
          children: []
        };
        
        // Add any drones assigned to this unassigned user
        const userDrones = drones.filter((drone: any) => drone.operatorId === user.id);
        userDrones.forEach((drone: any) => {
          const droneNode: HierarchyNode = {
            id: drone.id,
            type: 'DRONE',
            name: drone.id,
            model: drone.model,
            status: drone.status,
            children: []
          };
          userNode.children.push(droneNode);
        });
        
        unassignedUsersNode.children.push(userNode);
      });

      mainHQ.children.push(unassignedUsersNode);
    }

    console.log('\n📊 FINAL HIERARCHY SUMMARY:');
    console.log(`Main HQ children: ${mainHQ.children.length}`);
    mainHQ.children.forEach((child, idx) => {
      console.log(`  ${idx + 1}. ${child.name} (${child.type}) - ${child.children?.length || 0} children`);
      if (child.children && child.children.length > 0) {
        child.children.forEach((grandchild, gidx) => {
          console.log(`     ${gidx + 1}. ${grandchild.name} (${grandchild.type}) - ${grandchild.children?.length || 0} children`);
        });
      }
    });
    
    console.log('Generated hierarchy:', mainHQ);
    return mainHQ;
  }, []);

  // Fetch data from frontend API routes - SIMPLIFIED
  const fetchHierarchyData = useCallback(async () => {
    if (!token) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('Fetching hierarchy data...');

      // Fetch all data in parallel - using the frontend API routes
      const [usersResponse, regionsResponse, dronesResponse] = await Promise.all([
        fetch('/api/users', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/regions', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/drones', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      console.log('Response status:', {
        users: usersResponse.status,
        regions: regionsResponse.status,
        drones: dronesResponse.status
      });

      if (!usersResponse.ok || !regionsResponse.ok || !dronesResponse.ok) {
        throw new Error('Failed to fetch hierarchy data - one or more endpoints failed');
      }

      const [usersData, regionsData, dronesData] = await Promise.all([
        usersResponse.json(),
        regionsResponse.json(),
        dronesResponse.json()
      ]);

      console.log('Parsed data:', {
        usersData,
        regionsData,
        dronesData
      });

      // Extract the actual arrays from the API responses
      // Based on the user management service, these should be:
      // users: { users: User[], totalCount: number, ... }
      // regions: { success: true, regions: Region[] } or Region[]
      // drones: { drones: Drone[], totalCount: number, ... }
      
      let users = [];
      let regions = [];
      let drones = [];

      // Handle users response
      if (usersData.users) {
        users = usersData.users;
      } else if (Array.isArray(usersData)) {
        users = usersData;
      } else {
        console.warn('Unexpected users data format:', usersData);
        users = [];
      }

      // Handle regions response  
      if (regionsData.regions) {
        regions = regionsData.regions;
      } else if (Array.isArray(regionsData)) {
        regions = regionsData;
      } else {
        console.warn('Unexpected regions data format:', regionsData);
        regions = [];
      }

      // Handle drones response
      if (dronesData.drones) {
        drones = dronesData.drones;
      } else if (Array.isArray(dronesData)) {
        drones = dronesData;
      } else {
        console.warn('Unexpected drones data format:', dronesData);
        drones = [];
      }

      console.log('Extracted arrays:', {
        users: users.length,
        regions: regions.length,
        drones: drones.length
      });

      // Transform the data into hierarchy
      const hierarchy = transformDataToHierarchy(users, regions, drones);
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
              onClick={() => {
                console.log('Current hierarchy data:', hierarchyData);
                console.log('Expanded nodes:', expandedNodes);
              }}
              className="p-2 bg-purple-800 hover:bg-purple-700 rounded-lg transition-colors text-white"
              title="Debug Info (Check Console)"
            >
              <Zap className="h-5 w-5" />
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
            <div className="text-xs text-red-300 mb-4">
              Check the browser console for detailed error information.
            </div>
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
              <div className="mb-4 text-sm text-gray-400 bg-gray-800/50 p-3 rounded-lg">
                <div className="font-medium mb-2">Hierarchy Status:</div>
                <div>Main HQ Children: {hierarchyData.children?.length || 0}</div>
                {hierarchyData.children?.map((child, idx) => (
                  <div key={child.id} className="ml-2">
                    {idx + 1}. {child.name} ({child.type}) - {child.children?.length || 0} children
                  </div>
                ))}
              </div>
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
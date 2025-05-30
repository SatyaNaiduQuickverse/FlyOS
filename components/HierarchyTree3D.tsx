// components/HierarchyTree3D.tsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Sphere, Line } from '@react-three/drei';
import * as THREE from 'three';
import { 
  Users, 
  Shield, 
  UserCheck, 
  Plane, 
  Globe, 
  X,
  RotateCcw,
  Info,
  Loader2
} from 'lucide-react';

// Interfaces based on your backend structure
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
  position: [number, number, number];
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
  region?: {
    id: string;
    name: string;
    area: string;
  };
  operator?: {
    id: string;
    username: string;
    fullName: string;
  };
}

// Node colors based on type and status
const getNodeColor = (node: HierarchyNode): string => {
  switch (node.type) {
    case 'MAIN_HQ':
      return '#3b82f6'; // Blue
    case 'REGIONAL_HQ':
      return '#10b981'; // Green
    case 'OPERATOR':
      return '#f59e0b'; // Amber
    case 'REGION':
      return '#8b5cf6'; // Purple
    case 'DRONE':
      switch (node.status) {
        case 'ACTIVE': return '#22c55e'; // Green
        case 'STANDBY': return '#3b82f6'; // Blue
        case 'MAINTENANCE': return '#f59e0b'; // Amber
        case 'OFFLINE': return '#ef4444'; // Red
        default: return '#6b7280'; // Gray
      }
    case 'UNASSIGNED':
      return '#6b7280'; // Gray
    default:
      return '#6b7280';
  }
};

// Get icon for node type
const getNodeIcon = (type: string) => {
  switch (type) {
    case 'MAIN_HQ': return Users;
    case 'REGIONAL_HQ': return Shield;
    case 'OPERATOR': return UserCheck;
    case 'DRONE': return Plane;
    case 'REGION': return Globe;
    case 'UNASSIGNED': return Users;
    default: return Users;
  }
};

// Node component with animations
const Node: React.FC<{
  node: HierarchyNode;
  onNodeClick: (node: HierarchyNode) => void;
  isSelected: boolean;
}> = ({ node, onNodeClick, isSelected }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  
  useFrame((state) => {
    if (meshRef.current) {
      // Gentle floating animation
      meshRef.current.position.y = node.position[1] + Math.sin(state.clock.elapsedTime + node.position[0]) * 0.1;
      
      // Rotation animation
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.2;
      
      // Scale animation on hover/selection
      const targetScale = hovered || isSelected ? 1.3 : 1;
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
    }
  });

  const handleClick = (e: any) => {
    e.stopPropagation();
    onNodeClick(node);
  };

  return (
    <group
      position={node.position}
      onClick={handleClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <Sphere ref={meshRef} args={[0.3, 32, 32]}>
        <meshStandardMaterial
          color={getNodeColor(node)}
          emissive={getNodeColor(node)}
          emissiveIntensity={hovered || isSelected ? 0.3 : 0.1}
          transparent
          opacity={0.8}
        />
      </Sphere>
      
      {/* Outer glow ring */}
      <Sphere args={[0.4, 32, 32]}>
        <meshBasicMaterial
          color={getNodeColor(node)}
          transparent
          opacity={hovered || isSelected ? 0.2 : 0.05}
          side={THREE.BackSide}
        />
      </Sphere>
      
      {/* Node label */}
      <Text
        position={[0, 0.6, 0]}
        fontSize={0.2}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {node.name}
      </Text>
      
      {/* Type label */}
      <Text
        position={[0, -0.6, 0]}
        fontSize={0.15}
        color="#888888"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.01}
        outlineColor="#000000"
      >
        {node.type}
      </Text>
    </group>
  );
};

// Connection lines between nodes
const ConnectionLine: React.FC<{
  start: [number, number, number];
  end: [number, number, number];
  opacity?: number;
}> = ({ start, end, opacity = 0.3 }) => {
  const points = [
    new THREE.Vector3(...start),
    new THREE.Vector3(...end)
  ];

  return (
    <Line
      points={points}
      color="#3b82f6"
      transparent
      opacity={opacity}
      lineWidth={2}
    />
  );
};

// Recursive function to render nodes and connections
const renderNodesAndConnections = (
  node: HierarchyNode, 
  parentPosition: [number, number, number] | null = null, 
  onNodeClick: (node: HierarchyNode) => void, 
  selectedNode: HierarchyNode | null
): JSX.Element[] => {
  const elements: JSX.Element[] = [];
  
  // Render current node
  elements.push(
    <Node
      key={node.id}
      node={node}
      onNodeClick={onNodeClick}
      isSelected={selectedNode?.id === node.id}
    />
  );
  
  // Render connection to parent
  if (parentPosition) {
    elements.push(
      <ConnectionLine
        key={`connection-${node.id}`}
        start={parentPosition}
        end={node.position}
      />
    );
  }
  
  // Render children
  if (node.children) {
    node.children.forEach(child => {
      elements.push(
        ...renderNodesAndConnections(child, node.position, onNodeClick, selectedNode)
      );
    });
  }
  
  return elements;
};

// Camera controller
const CameraController: React.FC<{ resetTrigger: number }> = ({ resetTrigger }) => {
  const { camera } = useThree();
  
  useEffect(() => {
    if (resetTrigger > 0) {
      camera.position.set(8, 6, 8);
      camera.lookAt(0, 2, 0);
    }
  }, [resetTrigger, camera]);
  
  return null;
};

// Main 3D Scene
const HierarchyScene: React.FC<{
  hierarchyData: HierarchyNode;
  onNodeClick: (node: HierarchyNode) => void;
  selectedNode: HierarchyNode | null;
  resetTrigger: number;
}> = ({ hierarchyData, onNodeClick, selectedNode, resetTrigger }) => {
  return (
    <>
      <CameraController resetTrigger={resetTrigger} />
      
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} />
      
      {/* Render all nodes and connections */}
      {renderNodesAndConnections(hierarchyData, null, onNodeClick, selectedNode)}
      
      {/* Grid floor */}
      <gridHelper args={[20, 20, '#333333', '#333333']} position={[0, -3, 0]} />
    </>
  );
};

// Detail panel for selected node
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
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: getNodeColor(node) }}
          >
            <IconComponent className="h-5 w-5 text-white" />
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
            <span
              className="text-sm px-2 py-1 rounded-md"
              style={{
                backgroundColor: getNodeColor(node) + '20',
                color: getNodeColor(node)
              }}
            >
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

// Main component
const HierarchyTree3D: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  token: string;
}> = ({ isOpen, onClose, token }) => {
  const [selectedNode, setSelectedNode] = useState<HierarchyNode | null>(null);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [hierarchyData, setHierarchyData] = useState<HierarchyNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Transform API data to hierarchy structure
  const transformDataToHierarchy = useCallback((regions: ApiRegion[], allDrones: ApiDrone[]): HierarchyNode => {
    // Create main HQ node at the top
    const mainHQ: HierarchyNode = {
      id: 'main-hq',
      type: 'MAIN_HQ',
      name: 'Main Command',
      username: 'main_admin',
      email: 'main@flyos.mil',
      role: 'MAIN_HQ',
      position: [0, 4, 0],
      children: []
    };

    // Position calculation helpers
    const regionPositions: { [key: string]: [number, number, number] } = {
      'east-region': [-4, 2, 0],
      'west-region': [4, 2, 0],
      'north-region': [0, 2, 4],
      'south-region': [0, 2, -4]
    };

    let regionIndex = 0;
    const defaultPositions = [
      [-3, 2, 0], [3, 2, 0], [0, 2, 3], [0, 2, -3], 
      [-2, 2, 2], [2, 2, 2], [-2, 2, -2], [2, 2, -2]
    ];

    // Process regions
    regions.forEach((region) => {
      const regionPos = regionPositions[region.id] || defaultPositions[regionIndex % defaultPositions.length];
      
      const regionNode: HierarchyNode = {
        id: region.id,
        type: 'REGION',
        name: region.name,
        area: region.area,
        commanderName: region.commanderName || undefined,
        status: region.status,
        userCount: region.userCount,
        droneCount: region.droneCount,
        position: regionPos,
        children: []
      };

      // Add regional commander
      const commander = region.users.find(u => u.role === 'REGIONAL_HQ');
      if (commander) {
        const commanderNode: HierarchyNode = {
          id: commander.id,
          type: 'REGIONAL_HQ',
          name: commander.fullName,
          username: commander.username,
          role: commander.role,
          status: commander.status,
          position: [regionPos[0], regionPos[1] - 1, regionPos[2]],
          children: []
        };

        // Add operators under this commander
        const operators = region.users.filter(u => u.role === 'OPERATOR');
        operators.forEach((operator, opIndex) => {
          const operatorPos: [number, number, number] = [
            regionPos[0] + (opIndex - operators.length / 2) * 1.5,
            regionPos[1] - 2.5,
            regionPos[2]
          ];

          const operatorNode: HierarchyNode = {
            id: operator.id,
            type: 'OPERATOR',
            name: operator.fullName,
            username: operator.username,
            role: operator.role,
            status: operator.status,
            position: operatorPos,
            children: []
          };

          // Add drones operated by this operator
          const operatorDrones = allDrones.filter(d => d.operatorId === operator.id);
          operatorDrones.forEach((drone, droneIndex) => {
            const dronePos: [number, number, number] = [
              operatorPos[0] + (droneIndex - operatorDrones.length / 2) * 0.8,
              operatorPos[1] - 1.5,
              operatorPos[2]
            ];

            const droneNode: HierarchyNode = {
              id: drone.id,
              type: 'DRONE',
              name: drone.id,
              model: drone.model,
              status: drone.status,
              position: dronePos,
              children: []
            };

            operatorNode.children.push(droneNode);
          });

          commanderNode.children.push(operatorNode);
        });

        // Add region drones without operator
        const regionDrones = allDrones.filter(d => d.regionId === region.id && !d.operatorId);
        regionDrones.forEach((drone, droneIndex) => {
          const dronePos: [number, number, number] = [
            regionPos[0] + (droneIndex - regionDrones.length / 2) * 1.2,
            regionPos[1] - 3,
            regionPos[2]
          ];

          const droneNode: HierarchyNode = {
            id: drone.id,
            type: 'DRONE',
            name: drone.id,
            model: drone.model,
            status: drone.status,
            position: dronePos,
            children: []
          };

          commanderNode.children.push(droneNode);
        });

        regionNode.children.push(commanderNode);
      } else {
        // No commander, add drones directly to region
        const regionDrones = allDrones.filter(d => d.regionId === region.id);
        regionDrones.forEach((drone, droneIndex) => {
          const dronePos: [number, number, number] = [
            regionPos[0] + (droneIndex - regionDrones.length / 2) * 1.2,
            regionPos[1] - 2,
            regionPos[2]
          ];

          const droneNode: HierarchyNode = {
            id: drone.id,
            type: 'DRONE',
            name: drone.id,
            model: drone.model,
            status: drone.status,
            position: dronePos,
            children: []
          };

          regionNode.children.push(droneNode);
        });
      }

      mainHQ.children.push(regionNode);
      regionIndex++;
    });

    // Add unassigned drones
    const unassignedDrones = allDrones.filter(d => !d.regionId);
    if (unassignedDrones.length > 0) {
      const unassignedNode: HierarchyNode = {
        id: 'unassigned',
        type: 'UNASSIGNED',
        name: 'Unassigned Assets',
        droneCount: unassignedDrones.length,
        position: [0, 0, 6],
        children: []
      };

      unassignedDrones.forEach((drone, index) => {
        const dronePos: [number, number, number] = [
          (index - unassignedDrones.length / 2) * 1.5,
          -1.5,
          6
        ];

        const droneNode: HierarchyNode = {
          id: drone.id,
          type: 'DRONE',
          name: drone.id,
          model: drone.model,
          status: drone.status,
          position: dronePos,
          children: []
        };

        unassignedNode.children.push(droneNode);
      });

      mainHQ.children.push(unassignedNode);
    }

    return mainHQ;
  }, []);

  // Fetch data from API
  const fetchHierarchyData = useCallback(async () => {
    if (!token) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Fetch regions and drones in parallel
      const [regionsResponse, dronesResponse] = await Promise.all([
        fetch('http://localhost:4003/api/regions', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('http://localhost:4003/api/drones', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (!regionsResponse.ok) {
        throw new Error(`Failed to fetch regions: ${regionsResponse.statusText}`);
      }
      
      if (!dronesResponse.ok) {
        throw new Error(`Failed to fetch drones: ${dronesResponse.statusText}`);
      }

      const regionsData = await regionsResponse.json();
      const dronesData = await dronesResponse.json();

      if (!regionsData.success) {
        throw new Error(regionsData.message || 'Failed to fetch regions');
      }
      
      if (!dronesData.success) {
        throw new Error(dronesData.message || 'Failed to fetch drones');
      }

      // Transform data to hierarchy
      const hierarchy = transformDataToHierarchy(regionsData.regions, dronesData.drones);
      setHierarchyData(hierarchy);
      
    } catch (err: any) {
      console.error('Error fetching hierarchy data:', err);
      setError(err.message || 'Failed to load hierarchy data');
    } finally {
      setLoading(false);
    }
  }, [token, transformDataToHierarchy]);

  // Fetch data when component opens
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
  
  const handleReset = useCallback(() => {
    setResetTrigger(prev => prev + 1);
    setSelectedNode(null);
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
              <p className="text-sm text-gray-400">Interactive 3D visualization of the FlyOS command structure</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-white disabled:opacity-50"
              title="Refresh Data"
            >
              <RotateCcw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            
            <button
              onClick={handleReset}
              className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-white"
              title="Reset View"
            >
              <RotateCcw className="h-5 w-5" />
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
          Controls
        </h4>
        <div className="space-y-1 text-sm text-gray-300">
          <p>• Mouse: Rotate view</p>
          <p>• Scroll: Zoom in/out</p>
          <p>• Click: Select node</p>
          <p>• Right-click + drag: Pan</p>
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
      
      {/* 3D Canvas */}
      {hierarchyData && !loading && !error && (
        <div className="absolute inset-0 pt-20">
          <Canvas
            camera={{ position: [8, 6, 8], fov: 75 }}
            gl={{ antialias: true, alpha: true }}
          >
            <OrbitControls
              enablePan={true}
              enableZoom={true}
              enableRotate={true}
              minDistance={3}
              maxDistance={20}
              target={[0, 2, 0]}
            />
            
            <HierarchyScene
              hierarchyData={hierarchyData}
              onNodeClick={handleNodeClick}
              selectedNode={selectedNode}
              resetTrigger={resetTrigger}
            />
          </Canvas>
        </div>
      )}
      
      {/* Node Detail Panel */}
      <NodeDetailPanel node={selectedNode} onClose={handleCloseDetail} />
    </div>
  );
};

export default HierarchyTree3D;
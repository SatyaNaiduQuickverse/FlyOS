// components/HierarchyTree3D.tsx - 3D NETWORK VISUALIZATION
'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  Building,
  Zap,
  Network,
  Eye,
  MousePointer
} from 'lucide-react';
import * as THREE from 'three';

// Interfaces
interface NetworkNode {
  id: string;
  type: 'MAIN_HQ' | 'REGIONAL_HQ' | 'COMMANDER' | 'OPERATOR' | 'DRONE';
  name: string;
  username?: string;
  email?: string;
  area?: string;
  model?: string;
  status?: string;
  role?: string;
  position: { x: number; y: number; z: number };
  connections: string[]; // IDs of connected nodes
  droneCount?: number;
  userCount?: number;
}

interface Connection {
  from: string;
  to: string;
  strength: number; // 0-1, affects line thickness and opacity
}

// Node configuration
const NODE_COLORS = {
  MAIN_HQ: 0x00ffff,      // Cyan
  REGIONAL_HQ: 0x00ff00,  // Green  
  COMMANDER: 0xffff00,    // Yellow
  OPERATOR: 0xff8800,     // Orange
  DRONE: 0xff0000         // Red
};

const NODE_SIZES = {
  MAIN_HQ: 0.8,
  REGIONAL_HQ: 0.6,
  COMMANDER: 0.5,
  OPERATOR: 0.4,
  DRONE: 0.3
};

// 3D Network Visualization Component
const Network3D: React.FC<{
  nodes: NetworkNode[];
  connections: Connection[];
  selectedNode: NetworkNode | null;
  onNodeClick: (node: NetworkNode) => void;
}> = ({ nodes, connections, selectedNode, onNodeClick }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const frameRef = useRef<number>();
  const nodeObjectsRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const lineObjectsRef = useRef<THREE.Group>();
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());

  // Initialize Three.js scene
  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 15);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Point lights for dramatic effect
    const pointLight1 = new THREE.PointLight(0x00ffff, 0.5, 20);
    pointLight1.position.set(-5, 5, 5);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xff0080, 0.5, 20);
    pointLight2.position.set(5, -5, 5);
    scene.add(pointLight2);

    // Mouse controls for camera rotation
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let cameraRotation = { x: 0, y: 0 };

    const handleMouseDown = (event: MouseEvent) => {
      isDragging = true;
      previousMousePosition = { x: event.clientX, y: event.clientY };
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!isDragging) {
        // Update mouse position for raycasting
        const rect = renderer.domElement.getBoundingClientRect();
        mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        return;
      }

      const deltaMove = {
        x: event.clientX - previousMousePosition.x,
        y: event.clientY - previousMousePosition.y
      };

      cameraRotation.y += deltaMove.x * 0.01;
      cameraRotation.x += deltaMove.y * 0.01;

      // Limit vertical rotation
      cameraRotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cameraRotation.x));

      // Update camera position
      const radius = 15;
      camera.position.x = radius * Math.sin(cameraRotation.y) * Math.cos(cameraRotation.x);
      camera.position.y = radius * Math.sin(cameraRotation.x);
      camera.position.z = radius * Math.cos(cameraRotation.y) * Math.cos(cameraRotation.x);
      camera.lookAt(0, 0, 0);

      previousMousePosition = { x: event.clientX, y: event.clientY };
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    const handleWheel = (event: WheelEvent) => {
      const scale = event.deltaY > 0 ? 1.1 : 0.9;
      camera.position.multiplyScalar(scale);
      camera.position.clampLength(5, 50);
    };

    const handleClick = (event: MouseEvent) => {
      if (isDragging) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const intersects = raycasterRef.current.intersectObjects(Array.from(nodeObjectsRef.current.values()));

      if (intersects.length > 0) {
        const clickedObject = intersects[0].object as THREE.Mesh;
        const nodeId = (clickedObject as any).userData.nodeId;
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
          onNodeClick(node);
        }
      }
    };

    renderer.domElement.addEventListener('mousedown', handleMouseDown);
    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('mouseup', handleMouseUp);
    renderer.domElement.addEventListener('wheel', handleWheel);
    renderer.domElement.addEventListener('click', handleClick);

    return () => {
      renderer.domElement.removeEventListener('mousedown', handleMouseDown);
      renderer.domElement.removeEventListener('mousemove', handleMouseMove);
      renderer.domElement.removeEventListener('mouseup', handleMouseUp);
      renderer.domElement.removeEventListener('wheel', handleWheel);
      renderer.domElement.removeEventListener('click', handleClick);
      
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Create and update nodes
  useEffect(() => {
    if (!sceneRef.current) return;

    // Clear existing nodes
    nodeObjectsRef.current.forEach(mesh => {
      sceneRef.current!.remove(mesh);
    });
    nodeObjectsRef.current.clear();

    // Create nodes
    nodes.forEach(node => {
      const geometry = new THREE.SphereGeometry(NODE_SIZES[node.type], 32, 32);
      const material = new THREE.MeshPhongMaterial({ 
        color: NODE_COLORS[node.type],
        transparent: true,
        opacity: 0.8,
        shininess: 100
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(node.position.x, node.position.y, node.position.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      
      // Store node data
      (mesh as any).userData = { nodeId: node.id };

      // Add glow effect
      const glowGeometry = new THREE.SphereGeometry(NODE_SIZES[node.type] * 1.2, 16, 16);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: NODE_COLORS[node.type],
        transparent: true,
        opacity: 0.2
      });
      const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
      mesh.add(glowMesh);

      sceneRef.current!.add(mesh);
      nodeObjectsRef.current.set(node.id, mesh);
    });
  }, [nodes]);

  // Create and update connections
  useEffect(() => {
    if (!sceneRef.current) return;

    // Remove existing lines
    if (lineObjectsRef.current) {
      sceneRef.current.remove(lineObjectsRef.current);
    }

    // Create line group
    const lineGroup = new THREE.Group();
    lineObjectsRef.current = lineGroup;

    connections.forEach(connection => {
      const fromNode = nodes.find(n => n.id === connection.from);
      const toNode = nodes.find(n => n.id === connection.to);

      if (fromNode && toNode) {
        const points = [
          new THREE.Vector3(fromNode.position.x, fromNode.position.y, fromNode.position.z),
          new THREE.Vector3(toNode.position.x, toNode.position.y, toNode.position.z)
        ];

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        
        // Color based on connection strength and node types
        const fromColor = NODE_COLORS[fromNode.type];
        const toColor = NODE_COLORS[toNode.type];
        const lineColor = new THREE.Color().lerpColors(
          new THREE.Color(fromColor),
          new THREE.Color(toColor),
          0.5
        );

        const material = new THREE.LineBasicMaterial({
          color: lineColor,
          transparent: true,
          opacity: 0.3 + (connection.strength * 0.4),
          linewidth: 1 + (connection.strength * 2)
        });

        const line = new THREE.Line(geometry, material);
        lineGroup.add(line);
      }
    });

    sceneRef.current.add(lineGroup);
  }, [nodes, connections]);

  // Update selected node highlight
  useEffect(() => {
    nodeObjectsRef.current.forEach((mesh, nodeId) => {
      const isSelected = selectedNode?.id === nodeId;
      const material = mesh.material as THREE.MeshPhongMaterial;
      
      if (isSelected) {
        material.emissive.setHex(0x444444);
        mesh.scale.setScalar(1.3);
      } else {
        material.emissive.setHex(0x000000);
        mesh.scale.setScalar(1.0);
      }
    });
  }, [selectedNode]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);

      // Rotate nodes slightly
      const time = Date.now() * 0.001;
      nodeObjectsRef.current.forEach((mesh, nodeId) => {
        mesh.rotation.y = time * 0.5;
        mesh.rotation.x = Math.sin(time) * 0.1;
      });

      // Animate line opacity
      if (lineObjectsRef.current) {
        lineObjectsRef.current.children.forEach((line, index) => {
          const material = (line as THREE.Line).material as THREE.LineBasicMaterial;
          material.opacity = 0.3 + Math.sin(time * 2 + index) * 0.2;
        });
      }

      if (rendererRef.current && cameraRef.current && sceneRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animate();

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;

      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;

      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return <div ref={mountRef} className="w-full h-full" />;
};

// Node Detail Panel Component
const NodeDetailPanel: React.FC<{
  node: NetworkNode | null;
  onClose: () => void;
}> = ({ node, onClose }) => {
  if (!node) return null;

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'MAIN_HQ': return Users;
      case 'REGIONAL_HQ': return Shield;
      case 'COMMANDER': return Shield;
      case 'OPERATOR': return UserCheck;
      case 'DRONE': return Plane;
      default: return Users;
    }
  };

  const getNodeColorClass = (type: string) => {
    switch (type) {
      case 'MAIN_HQ': return 'text-cyan-300';
      case 'REGIONAL_HQ': return 'text-green-300';
      case 'COMMANDER': return 'text-yellow-300';
      case 'OPERATOR': return 'text-orange-300';
      case 'DRONE': return 'text-red-300';
      default: return 'text-gray-300';
    }
  };

  const IconComponent = getNodeIcon(node.type);
  
  return (
    <div className="fixed top-4 right-4 w-96 z-30">
      <div className="bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6 text-white shadow-2xl">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gray-800/50 border border-gray-600/30">
              <IconComponent className={`h-6 w-6 ${getNodeColorClass(node.type)}`} />
            </div>
            <div>
              <h3 className={`text-xl font-bold ${getNodeColorClass(node.type)}`}>{node.name}</h3>
              <p className="text-sm text-gray-400">{node.type.replace('_', ' ')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/70 border border-gray-600/30 transition-all duration-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        
        <div className="space-y-4">
          {node.username && (
            <div className="p-3 rounded-xl bg-gray-800/50 border border-gray-700/30">
              <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wide">Username</label>
              <p className="text-blue-300 font-medium">{node.username}</p>
            </div>
          )}
          
          {node.email && (
            <div className="p-3 rounded-xl bg-gray-800/50 border border-gray-700/30">
              <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wide">Email</label>
              <p className="text-green-300 font-medium">{node.email}</p>
            </div>
          )}
          
          {node.area && (
            <div className="p-3 rounded-xl bg-gray-800/50 border border-gray-700/30">
              <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wide">Area</label>
              <p className="text-purple-300 font-medium">{node.area}</p>
            </div>
          )}
          
          {node.model && (
            <div className="p-3 rounded-xl bg-gray-800/50 border border-gray-700/30">
              <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wide">Model</label>
              <p className="text-green-300 font-medium">{node.model}</p>
            </div>
          )}
          
          {node.status && (
            <div className="p-3 rounded-xl bg-gray-800/50 border border-gray-700/30">
              <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wide">Status</label>
              <span className={`
                inline-block px-3 py-1 rounded-lg text-sm font-medium
                ${node.status === 'ACTIVE' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                  node.status === 'STANDBY' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                  node.status === 'MAINTENANCE' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                  node.status === 'OFFLINE' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                  'bg-gray-500/20 text-gray-300 border border-gray-500/30'}
              `}>
                {node.status}
              </span>
            </div>
          )}

          <div className="p-3 rounded-xl bg-gradient-to-r from-gray-800/50 to-gray-700/30 border border-gray-600/30">
            <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wide">Connections</label>
            <div className="text-center">
              <Network className="h-4 w-4 text-purple-400 mx-auto mb-1" />
              <p className="text-purple-300 font-bold text-lg">{node.connections.length}</p>
              <p className="text-xs text-gray-400">Connected Nodes</p>
            </div>
          </div>
        </div>
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
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [networkData, setNetworkData] = useState<{ nodes: NetworkNode[]; connections: Connection[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create mock network data
  const createMockNetworkData = useCallback(() => {
    const nodes: NetworkNode[] = [
      // Main HQ
      {
        id: 'main-hq',
        type: 'MAIN_HQ',
        name: 'Main Command Center',
        username: 'main_admin',
        email: 'main@flyos.mil',
        position: { x: 0, y: 0, z: 0 },
        connections: ['regional-hq-1', 'regional-hq-2', 'regional-hq-3'],
        userCount: 25,
        droneCount: 150
      },
      
      // Regional HQs
      {
        id: 'regional-hq-1',
        type: 'REGIONAL_HQ',
        name: 'North Regional HQ',
        area: 'Northern Operations Zone',
        position: { x: -4, y: 3, z: 2 },
        connections: ['main-hq', 'commander-1', 'commander-2']
      },
      {
        id: 'regional-hq-2',
        type: 'REGIONAL_HQ',
        name: 'South Regional HQ',
        area: 'Southern Operations Zone',
        position: { x: 4, y: -2, z: 1 },
        connections: ['main-hq', 'commander-3', 'commander-4']
      },
      {
        id: 'regional-hq-3',
        type: 'REGIONAL_HQ',
        name: 'East Regional HQ',
        area: 'Eastern Operations Zone',
        position: { x: 2, y: 4, z: -3 },
        connections: ['main-hq', 'commander-5']
      },
      
      // Commanders
      {
        id: 'commander-1',
        type: 'COMMANDER',
        name: 'Col. Sarah Mitchell',
        username: 'sarah.mitchell',
        email: 'sarah.mitchell@flyos.mil',
        position: { x: -6, y: 1, z: 4 },
        connections: ['regional-hq-1', 'operator-1', 'operator-2']
      },
      {
        id: 'commander-2',
        type: 'COMMANDER',
        name: 'Maj. Robert Chen',
        username: 'robert.chen',
        email: 'robert.chen@flyos.mil',
        position: { x: -2, y: 5, z: 0 },
        connections: ['regional-hq-1', 'operator-3']
      },
      {
        id: 'commander-3',
        type: 'COMMANDER',
        name: 'Lt. Col. Maria Santos',
        username: 'maria.santos',
        email: 'maria.santos@flyos.mil',
        position: { x: 6, y: -4, z: 3 },
        connections: ['regional-hq-2', 'operator-4', 'operator-5']
      },
      {
        id: 'commander-4',
        type: 'COMMANDER',
        name: 'Maj. James Wilson',
        username: 'james.wilson',
        email: 'james.wilson@flyos.mil',
        position: { x: 2, y: -5, z: -1 },
        connections: ['regional-hq-2', 'operator-6']
      },
      {
        id: 'commander-5',
        type: 'COMMANDER',
        name: 'Col. Lisa Park',
        username: 'lisa.park',
        email: 'lisa.park@flyos.mil',
        position: { x: 4, y: 6, z: -5 },
        connections: ['regional-hq-3', 'operator-7', 'operator-8']
      },
      
      // Operators
      {
        id: 'operator-1',
        type: 'OPERATOR',
        name: 'Lt. John Davis',
        username: 'john.davis',
        email: 'john.davis@flyos.mil',
        position: { x: -8, y: -1, z: 6 },
        connections: ['commander-1', 'drone-1', 'drone-2', 'drone-3']
      },
      {
        id: 'operator-2',
        type: 'OPERATOR',
        name: 'Capt. Emma Thompson',
        username: 'emma.thompson',
        email: 'emma.thompson@flyos.mil',
        position: { x: -4, y: 3, z: 6 },
        connections: ['commander-1', 'drone-4', 'drone-5']
      },
      {
        id: 'operator-3',
        type: 'OPERATOR',
        name: 'Lt. Michael Brown',
        username: 'michael.brown',
        email: 'michael.brown@flyos.mil',
        position: { x: -1, y: 7, z: 2 },
        connections: ['commander-2', 'drone-6', 'drone-7']
      },
      {
        id: 'operator-4',
        type: 'OPERATOR',
        name: 'Capt. Anna Rodriguez',
        username: 'anna.rodriguez',
        email: 'anna.rodriguez@flyos.mil',
        position: { x: 8, y: -6, z: 5 },
        connections: ['commander-3', 'drone-8', 'drone-9', 'drone-10']
      },
      {
        id: 'operator-5',
        type: 'OPERATOR',
        name: 'Lt. David Kim',
        username: 'david.kim',
        email: 'david.kim@flyos.mil',
        position: { x: 4, y: -2, z: 4 },
        connections: ['commander-3', 'drone-11', 'drone-12']
      },
      {
        id: 'operator-6',
        type: 'OPERATOR',
        name: 'Capt. Rachel Green',
        username: 'rachel.green',
        email: 'rachel.green@flyos.mil',
        position: { x: 0, y: -7, z: -3 },
        connections: ['commander-4', 'drone-13', 'drone-14']
      },
      {
        id: 'operator-7',
        type: 'OPERATOR',
        name: 'Lt. Alex Turner',
        username: 'alex.turner',
        email: 'alex.turner@flyos.mil',
        position: { x: 6, y: 8, z: -7 },
        connections: ['commander-5', 'drone-15', 'drone-16']
      },
      {
        id: 'operator-8',
        type: 'OPERATOR',
        name: 'Capt. Sofia Martinez',
        username: 'sofia.martinez',
        email: 'sofia.martinez@flyos.mil',
        position: { x: 2, y: 4, z: -7 },
        connections: ['commander-5', 'drone-17', 'drone-18', 'drone-19']
      }
    ];

    // Add Drones
    const droneNames = [
      'HAWK-001', 'EAGLE-002', 'FALCON-003', 'RAVEN-004', 'PHOENIX-005',
      'STORM-006', 'THUNDER-007', 'VIPER-008', 'GHOST-009', 'HUNTER-010',
      'SHADOW-011', 'BLADE-012', 'FURY-013', 'STRIKE-014', 'RECON-015',
      'SCOUT-016', 'GUARDIAN-017', 'SENTINEL-018', 'PROWLER-019'
    ];

    const droneModels = ['Predator MQ-9', 'Global Hawk', 'Reaper MQ-9', 'Predator MQ-1'];
    const droneStatuses = ['ACTIVE', 'STANDBY', 'MAINTENANCE', 'OFFLINE'];

    // Create drones with positions around their operators
    const operators = nodes.filter(n => n.type === 'OPERATOR');
    let droneIndex = 0;

    operators.forEach((operator, opIndex) => {
      const droneCount = operator.connections.filter(id => id.startsWith('drone-')).length;
      
      for (let i = 0; i < droneCount; i++) {
        const angle = (i / droneCount) * Math.PI * 2;
        const radius = 2;
        const droneId = `drone-${droneIndex + 1}`;
        
        nodes.push({
          id: droneId,
          type: 'DRONE',
          name: droneNames[droneIndex] || `DRONE-${droneIndex + 1}`,
          model: droneModels[droneIndex % droneModels.length],
          status: droneStatuses[droneIndex % droneStatuses.length],
          position: {
            x: operator.position.x + Math.cos(angle) * radius,
            y: operator.position.y + Math.sin(angle) * radius,
            z: operator.position.z + (Math.random() - 0.5) * 2
          },
          connections: [operator.id]
        });
        
        droneIndex++;
      }
    });

    // Create connections
    const connections: Connection[] = [];
    
    nodes.forEach(node => {
      node.connections.forEach(targetId => {
        // Only create connection if it doesn't already exist in reverse
        const existingConnection = connections.find(
          c => (c.from === node.id && c.to === targetId) || 
               (c.from === targetId && c.to === node.id)
        );
        
        if (!existingConnection) {
          // Calculate connection strength based on node types
          let strength = 0.5;
          if (node.type === 'MAIN_HQ' || targetId === 'main-hq') strength = 1.0;
          else if (node.type === 'REGIONAL_HQ' || nodes.find(n => n.id === targetId)?.type === 'REGIONAL_HQ') strength = 0.8;
          else if (node.type === 'COMMANDER' || nodes.find(n => n.id === targetId)?.type === 'COMMANDER') strength = 0.6;
          else if (node.type === 'OPERATOR' || nodes.find(n => n.id === targetId)?.type === 'OPERATOR') strength = 0.4;
          
          connections.push({
            from: node.id,
            to: targetId,
            strength
          });
        }
      });
    });

    return { nodes, connections };
  }, []);

  // For now, just use mock data
  const initializeMockData = useCallback(() => {
    setLoading(true);
    // Simulate loading delay
    setTimeout(() => {
      setNetworkData(createMockNetworkData());
      setLoading(false);
    }, 1000);
  }, [createMockNetworkData]);

  // Transform API data to network structure - COMMENTED FOR NOW, WILL USE LATER
  // const transformDataToNetwork = useCallback((users: any[], regions: any[], drones: any[]): { nodes: NetworkNode[]; connections: Connection[] } => {
  //   console.log('🔍 NETWORK TRANSFORMATION DEBUG');
  //   const nodes: NetworkNode[] = [];
  //   const connections: Connection[] = [];
    
  //   // Create Main HQ node
  //   nodes.push({
  //     id: 'main-hq',
  //     type: 'MAIN_HQ',
  //     name: 'Main Command Center',
  //     position: { x: 0, y: 0, z: 0 },
  //     connections: []
  //   });
    
  //   // Process regions, users, and drones into network nodes
  //   // Add positioning algorithm to spread nodes in 3D space
  //   // Calculate connections based on relationships
    
  //   return { nodes, connections };
  // }, []);

  // Fetch data from API - COMMENTED FOR NOW, WILL USE LATER  
  // const fetchNetworkData = useCallback(async () => {
  //   if (!token) {
  //     setNetworkData(createMockNetworkData());
  //     return;
  //   }
    
  //   setLoading(true);
  //   setError(null);
    
  //   try {
  //     const [usersResponse, regionsResponse, dronesResponse] = await Promise.all([
  //       fetch('/api/users', { headers: { 'Authorization': `Bearer ${token}` } }),
  //       fetch('/api/regions', { headers: { 'Authorization': `Bearer ${token}` } }),
  //       fetch('/api/drones', { headers: { 'Authorization': `Bearer ${token}` } })
  //     ]);

  //     if (!usersResponse.ok || !regionsResponse.ok || !dronesResponse.ok) {
  //       throw new Error('Failed to fetch network data');
  //     }

  //     const [usersData, regionsData, dronesData] = await Promise.all([
  //       usersResponse.json(),
  //       regionsResponse.json(),
  //       dronesResponse.json()
  //     ]);

  //     let users = usersData.users || usersData || [];
  //     let regions = regionsData.regions || regionsData || [];
  //     let drones = dronesData.drones || dronesData || [];

  //     const networkData = transformDataToNetwork(users, regions, drones);
  //     setNetworkData(networkData);
      
  //   } catch (err: any) {
  //     console.error('Error fetching network data:', err);
  //     setError(err.message || 'Failed to load network data');
  //     setNetworkData(createMockNetworkData());
  //   } finally {
  //     setLoading(false);
  //   }
  // }, [token, transformDataToNetwork, createMockNetworkData]);

  useEffect(() => {
    if (isOpen) {
      initializeMockData();
    }
  }, [isOpen, initializeMockData]);

  const handleNodeClick = useCallback((node: NetworkNode) => {
    setSelectedNode(node);
  }, []);
  
  const handleCloseDetail = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleRefresh = useCallback(() => {
    initializeMockData();
  }, [initializeMockData]);

  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Modern Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gray-900/80 backdrop-blur-xl border-b border-gray-700/50 p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl shadow-lg">
              <Network className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                3D Command Network
              </h2>
              <p className="text-sm text-gray-400">Interactive neural network visualization of command hierarchy</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-2 bg-gray-800/50 hover:bg-gray-700/70 rounded-xl transition-all duration-200 text-white disabled:opacity-50 border border-gray-600/30"
              title="Refresh Network"
            >
              <RotateCcw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            
            <button
              onClick={() => {
                console.log('Current network data:', networkData);
              }}
              className="p-2 bg-purple-800/50 hover:bg-purple-700/70 rounded-xl transition-all duration-200 text-white border border-purple-600/30"
              title="Debug Network (Check Console)"
            >
              <Zap className="h-5 w-5" />
            </button>
            
            <button
              onClick={onClose}
              className="p-2 bg-red-800/50 hover:bg-red-700/70 rounded-xl transition-all duration-200 text-white border border-red-600/30"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Network Legend */}
      <div className="absolute bottom-6 left-6 z-10 bg-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-5 text-white shadow-2xl">
        <h4 className="font-semibold mb-3 flex items-center gap-2 text-cyan-300">
          <Eye className="h-4 w-4" />
          Network Legend
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 bg-cyan-400 rounded-full shadow-lg"></div>
            <span>Main HQ</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-green-400 rounded-full shadow-lg"></div>
            <span>Regional HQ</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-yellow-400 rounded-full shadow-lg"></div>
            <span>Commander</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-orange-400 rounded-full shadow-lg"></div>
            <span>Operator</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-red-400 rounded-full shadow-lg"></div>
            <span>Drone</span>
          </div>
        </div>
      </div>

      {/* Controls Guide */}
      <div className="absolute bottom-6 right-6 z-10 bg-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-5 text-white shadow-2xl">
        <h4 className="font-semibold mb-3 flex items-center gap-2 text-purple-300">
          <MousePointer className="h-4 w-4" />
          Controls
        </h4>
        <div className="space-y-2 text-sm text-gray-300">
          <div>• Drag to rotate view</div>
          <div>• Scroll to zoom</div>
          <div>• Click nodes for details</div>
          <div>• Watch the neural network animate</div>
        </div>
      </div>

      {/* Network Statistics */}
      {networkData && (
        <div className="absolute top-20 left-6 z-10 bg-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-4 text-white shadow-2xl">
          <h4 className="font-semibold mb-3 text-green-300">Network Stats</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Total Nodes:</span>
              <span className="text-cyan-300 font-bold">{networkData.nodes.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Connections:</span>
              <span className="text-green-300 font-bold">{networkData.connections.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Regions:</span>
              <span className="text-yellow-300 font-bold">{networkData.nodes.filter(n => n.type === 'REGIONAL_HQ').length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Drones:</span>
              <span className="text-red-300 font-bold">{networkData.nodes.filter(n => n.type === 'DRONE').length}</span>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/50">
          <div className="bg-gray-900/90 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-10 text-white shadow-2xl">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <Loader2 className="h-12 w-12 animate-spin text-cyan-400" />
                <div className="absolute inset-0 h-12 w-12 border-4 border-cyan-400/20 rounded-full animate-ping"></div>
              </div>
              <div className="text-center">
                <h3 className="text-xl font-semibold mb-2">Initializing Neural Network</h3>
                <p className="text-sm text-gray-400">Building 3D command structure visualization...</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/50">
          <div className="bg-red-900/90 backdrop-blur-xl border border-red-700/50 rounded-2xl p-10 text-white max-w-md shadow-2xl">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <X className="h-8 w-8 text-red-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">Network Error</h3>
              <p className="text-sm text-red-200 mb-6">{error}</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleRefresh}
                  className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-xl transition-all duration-200 font-medium"
                >
                  Retry
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-gray-600 hover:bg-gray-700 rounded-xl transition-all duration-200 font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3D Network Visualization */}
      {networkData && !loading && !error && (
        <div className="absolute inset-0 pt-16">
          <Network3D
            nodes={networkData.nodes}
            connections={networkData.connections}
            selectedNode={selectedNode}
            onNodeClick={handleNodeClick}
          />
        </div>
      )}

      {/* Node Detail Panel */}
      <NodeDetailPanel node={selectedNode} onClose={handleCloseDetail} />
    </div>
  );
};

export default HierarchyTree3D;
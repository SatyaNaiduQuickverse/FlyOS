// components/UserManagement.tsx
import React, { useState, useEffect } from 'react';
import {
  Shield, Users, UserPlus, Plane as Drone, Search,
  PlusCircle, Edit, Trash2, CheckCircle,
  XCircle, ArrowRightCircle, ChevronDown,
  ChevronUp, Filter
} from 'lucide-react';
import { UserRole } from '../types/auth';

// User interface
interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  regionId?: string;
  profileImage?: string;
  assignedDrones?: string[];
  assignedOperators?: string[];
  createdAt: string;
  status: 'ACTIVE' | 'INACTIVE';
}

// Region interface
interface Region {
  id: string;
  name: string;
  commanderName: string;
  status: 'ACTIVE' | 'INACTIVE';
  area: string;
}

// Drone interface
interface Drone {
  id: string;
  model: string;
  status: 'ACTIVE' | 'MAINTENANCE' | 'OFFLINE' | 'STANDBY';
  regionId: string | null;
  operatorId: string | null;
}

// Notification interface
interface Notification {
  message: string;
  type: 'success' | 'error';
}

// Mock data - will be replaced with API calls
const MOCK_REGIONS: Region[] = [
  { id: 'east', name: 'Eastern Region', commanderName: 'Col. Sarah Mitchell', status: 'ACTIVE', area: 'Eastern Seaboard' },
  { id: 'west', name: 'Western Region', commanderName: 'Maj. David Chen', status: 'ACTIVE', area: 'Pacific Coast' },
  { id: 'north', name: 'Northern Region', commanderName: 'Lt. Col. James Wilson', status: 'INACTIVE', area: 'Great Lakes' },
  { id: 'south', name: 'Southern Region', commanderName: 'Col. Robert Garcia', status: 'ACTIVE', area: 'Gulf Coast' },
];

const MOCK_USERS: User[] = [
  { 
    id: 'user-001', 
    username: 'region_east', 
    fullName: 'Col. Sarah Mitchell', 
    email: 'east@flyos.mil', 
    role: UserRole.REGIONAL_HQ, 
    regionId: 'east', 
    assignedOperators: ['user-003', 'user-004'],
    assignedDrones: ['drone-001', 'drone-002'],
    createdAt: '2025-01-15T08:30:00Z',
    status: 'ACTIVE'
  },
  { 
    id: 'user-002', 
    username: 'region_west', 
    fullName: 'Maj. David Chen', 
    email: 'west@flyos.mil', 
    role: UserRole.REGIONAL_HQ, 
    regionId: 'west', 
    assignedOperators: ['user-005'],
    assignedDrones: ['drone-003', 'drone-004'],
    createdAt: '2025-01-20T10:15:00Z',
    status: 'ACTIVE'
  },
  { 
    id: 'user-003', 
    username: 'operator1', 
    fullName: 'Lt. Michael Rodriguez', 
    email: 'operator1@flyos.mil', 
    role: UserRole.OPERATOR, 
    regionId: 'east', 
    assignedDrones: ['drone-001'],
    createdAt: '2025-02-05T14:45:00Z',
    status: 'ACTIVE'
  },
  { 
    id: 'user-004', 
    username: 'operator2', 
    fullName: 'Lt. Jessica Kim', 
    email: 'operator2@flyos.mil', 
    role: UserRole.OPERATOR, 
    regionId: 'east', 
    assignedDrones: ['drone-002'],
    createdAt: '2025-02-10T09:30:00Z',
    status: 'ACTIVE'
  },
  { 
    id: 'user-005', 
    username: 'operator3', 
    fullName: 'Lt. Thomas Johnson', 
    email: 'operator3@flyos.mil', 
    role: UserRole.OPERATOR, 
    regionId: 'west', 
    assignedDrones: ['drone-003', 'drone-004'],
    createdAt: '2025-02-12T11:20:00Z',
    status: 'ACTIVE'
  },
  { 
    id: 'user-006', 
    username: 'region_south', 
    fullName: 'Col. Robert Garcia', 
    email: 'south@flyos.mil', 
    role: UserRole.REGIONAL_HQ, 
    regionId: 'south', 
    assignedOperators: ['user-007'],
    assignedDrones: ['drone-005', 'drone-008'],
    createdAt: '2025-01-25T13:40:00Z',
    status: 'ACTIVE'
  },
  { 
    id: 'user-007', 
    username: 'operator4', 
    fullName: 'Lt. Emily Davis', 
    email: 'operator4@flyos.mil', 
    role: UserRole.OPERATOR, 
    regionId: 'south', 
    assignedDrones: ['drone-005', 'drone-008'],
    createdAt: '2025-02-15T10:10:00Z',
    status: 'ACTIVE'
  },
  { 
    id: 'user-008', 
    username: 'region_north', 
    fullName: 'Lt. Col. James Wilson', 
    email: 'north@flyos.mil', 
    role: UserRole.REGIONAL_HQ, 
    regionId: 'north', 
    assignedOperators: [],
    assignedDrones: [],
    createdAt: '2025-01-30T09:15:00Z',
    status: 'INACTIVE'
  },
];

const MOCK_DRONES: Drone[] = [
  { id: 'drone-001', model: 'FlyOS-MQ5', status: 'ACTIVE', regionId: 'east', operatorId: 'user-003' },
  { id: 'drone-002', model: 'FlyOS-MQ5', status: 'ACTIVE', regionId: 'east', operatorId: 'user-004' },
  { id: 'drone-003', model: 'FlyOS-MQ7', status: 'MAINTENANCE', regionId: 'west', operatorId: 'user-005' },
  { id: 'drone-004', model: 'FlyOS-MQ7', status: 'ACTIVE', regionId: 'west', operatorId: 'user-005' },
  { id: 'drone-005', model: 'FlyOS-MQ9', status: 'ACTIVE', regionId: 'south', operatorId: 'user-007' },
  { id: 'drone-006', model: 'FlyOS-MQ9', status: 'OFFLINE', regionId: null, operatorId: null },
  { id: 'drone-007', model: 'FlyOS-MQ5', status: 'STANDBY', regionId: null, operatorId: null },
  { id: 'drone-008', model: 'FlyOS-MQ7', status: 'ACTIVE', regionId: 'south', operatorId: 'user-007' },
];

// Available UserManagement tabs
enum UserManagementTab {
  REGIONAL_COMMANDERS = 'regional-commanders',
  OPERATORS = 'operators',
  CREATE_USER = 'create-user',
  MANAGE_DRONES = 'manage-drones',
  CREATE_DRONE = 'create-drone',
}

interface FormState {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  regionId?: string;
  password?: string;
  confirmPassword?: string;
  status: 'ACTIVE' | 'INACTIVE';
}

interface DroneFormState {
  id: string;
  model: string;
  status: 'ACTIVE' | 'MAINTENANCE' | 'OFFLINE' | 'STANDBY';
  regionId: string | null;
  operatorId: string | null;
}
const UserManagement: React.FC = () => {
    const [activeTab, setActiveTab] = useState<UserManagementTab>(UserManagementTab.REGIONAL_COMMANDERS);
    const [users, setUsers] = useState<User[]>(MOCK_USERS);
    const [regions, setRegions] = useState<Region[]>(MOCK_REGIONS);
    const [drones, setDrones] = useState<Drone[]>(MOCK_DRONES);
    const [expandedUser, setExpandedUser] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [notification, setNotification] = useState<Notification | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [showInactive, setShowInactive] = useState<boolean>(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [formState, setFormState] = useState<FormState>({
      id: `user-${String(Math.floor(Math.random() * 900) + 100)}`,
      username: '',
      fullName: '',
      email: '',
      role: UserRole.REGIONAL_HQ,
      regionId: '',
      password: '',
      confirmPassword: '',
      status: 'ACTIVE',
    });
    const [droneFormState, setDroneFormState] = useState<DroneFormState>({
      id: `drone-${String(Math.floor(Math.random() * 900) + 100)}`,
      model: 'FlyOS-MQ7',
      status: 'STANDBY',
      regionId: null,
      operatorId: null,
    });
    const [showAssignModal, setShowAssignModal] = useState<boolean>(false);
    const [selectedAssignUser, setSelectedAssignUser] = useState<User | null>(null);
    const [selectedTab, setSelectedTab] = useState<'drones' | 'operators'>('drones');
  
    // Simulate loading data
    useEffect(() => {
      setIsLoading(true);
      
      // Simulate network delay
      setTimeout(() => {
        setUsers(MOCK_USERS);
        setRegions(MOCK_REGIONS);
        setDrones(MOCK_DRONES);
        setIsLoading(false);
      }, 800);
    }, []);
  
    // Reset form state when switching to create user tab
    useEffect(() => {
      if (activeTab === UserManagementTab.CREATE_USER) {
        setFormState({
          id: `user-${String(Math.floor(Math.random() * 900) + 100)}`,
          username: '',
          fullName: '',
          email: '',
          role: UserRole.REGIONAL_HQ,
          regionId: '',
          password: '',
          confirmPassword: '',
          status: 'ACTIVE',
        });
        setEditingUser(null);
      } else if (activeTab === UserManagementTab.CREATE_DRONE) {
        setDroneFormState({
          id: `drone-${String(Math.floor(Math.random() * 900) + 100)}`,
          model: 'FlyOS-MQ7',
          status: 'STANDBY',
          regionId: null,
          operatorId: null,
        });
      }
    }, [activeTab]);
  
    // Filter users based on search query, role, and active status
    const filteredUsers = users.filter(user => {
      const matchesQuery = 
        searchQuery === '' ||
        user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesRole = 
        (activeTab === UserManagementTab.REGIONAL_COMMANDERS && user.role === UserRole.REGIONAL_HQ) ||
        (activeTab === UserManagementTab.OPERATORS && user.role === UserRole.OPERATOR);
      
      const matchesStatus = showInactive || user.status === 'ACTIVE';
      
      return matchesQuery && matchesRole && matchesStatus;
    });
  
    // Notification helper
    const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
      setNotification({ message, type });
      setTimeout(() => setNotification(null), 5000);
    };
  
    const toggleExpandUser = (userId: string) => {
      if (expandedUser === userId) {
        setExpandedUser(null);
      } else {
        setExpandedUser(userId);
      }
    };
  
    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setFormState(prev => ({
        ...prev,
        [name]: value
      }));
    };
  
    const handleDroneFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setDroneFormState(prev => ({
        ...prev,
        [name]: value === "" ? null : value
      }));
    };
  
    const validateForm = (): boolean => {
      if (!formState.username || !formState.fullName || !formState.email) {
        showNotification('Please fill in all required fields', 'error');
        return false;
      }
  
      if (formState.role === UserRole.REGIONAL_HQ && !formState.regionId) {
        showNotification('Please select a region for the Regional Commander', 'error');
        return false;
      }
  
      if (!editingUser && (!formState.password || formState.password.length < 8)) {
        showNotification('Password must be at least 8 characters long', 'error');
        return false;
      }
  
      if (!editingUser && formState.password !== formState.confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return false;
      }
  
      // Check for duplicate username
      const duplicateUser = users.find(
        u => u.username === formState.username && u.id !== formState.id
      );
      if (duplicateUser) {
        showNotification('Username already exists', 'error');
        return false;
      }
  
      return true;
    };
  
    const validateDroneForm = (): boolean => {
      if (!droneFormState.model) {
        showNotification('Please select a drone model', 'error');
        return false;
      }
  
      // Check for duplicate ID
      const duplicateDrone = drones.find(d => d.id === droneFormState.id);
      if (duplicateDrone) {
        showNotification('Drone ID already exists', 'error');
        return false;
      }
  
      return true;
    };
  
    const handleCreateUser = () => {
      if (!validateForm()) return;
  
      setIsLoading(true);
  
      // Simulate API call
      setTimeout(() => {
        const newUser: User = {
          id: formState.id,
          username: formState.username,
          fullName: formState.fullName,
          email: formState.email,
          role: formState.role,
          regionId: formState.role === UserRole.REGIONAL_HQ ? formState.regionId : undefined,
          assignedDrones: [],
          assignedOperators: formState.role === UserRole.REGIONAL_HQ ? [] : undefined,
          createdAt: new Date().toISOString(),
          status: formState.status,
        };
  
        // Update region commander if creating a regional user
        if (newUser.role === UserRole.REGIONAL_HQ && newUser.regionId) {
          setRegions(prevRegions => 
            prevRegions.map(region => 
              region.id === newUser.regionId 
                ? { ...region, commanderName: newUser.fullName } 
                : region
            )
          );
        }
  
        setUsers(prev => [...prev, newUser]);
        setActiveTab(
          newUser.role === UserRole.REGIONAL_HQ 
            ? UserManagementTab.REGIONAL_COMMANDERS 
            : UserManagementTab.OPERATORS
        );
        showNotification(`Successfully created ${newUser.role === UserRole.REGIONAL_HQ ? 'Regional Commander' : 'Operator'}`);
        setIsLoading(false);
      }, 800);
    };
  
    const handleUpdateUser = () => {
      if (!validateForm() || !editingUser) return;
  
      setIsLoading(true);
  
      // Simulate API call
      setTimeout(() => {
        const updatedUser: User = {
          ...editingUser,
          username: formState.username,
          fullName: formState.fullName,
          email: formState.email,
          role: formState.role,
          regionId: formState.role === UserRole.REGIONAL_HQ ? formState.regionId : undefined,
          status: formState.status,
        };
  
        // Update region commander if updating a regional user
        if (updatedUser.role === UserRole.REGIONAL_HQ && updatedUser.regionId) {
          setRegions(prevRegions => 
            prevRegions.map(region => 
              region.id === updatedUser.regionId 
                ? { ...region, commanderName: updatedUser.fullName } 
                : region
            )
          );
        }
  
        setUsers(prev => prev.map(user => user.id === updatedUser.id ? updatedUser : user));
        setActiveTab(
          updatedUser.role === UserRole.REGIONAL_HQ 
            ? UserManagementTab.REGIONAL_COMMANDERS 
            : UserManagementTab.OPERATORS
        );
        showNotification(`Successfully updated ${updatedUser.role === UserRole.REGIONAL_HQ ? 'Regional Commander' : 'Operator'}`);
        setEditingUser(null);
        setIsLoading(false);
      }, 800);
    };
  
    const handleDeleteUser = (userId: string) => {
      setIsLoading(true);
  
      // Simulate API call
      setTimeout(() => {
        const userToDelete = users.find(u => u.id === userId);
        
        if (userToDelete) {
          // Remove user from users array
          setUsers(prev => prev.filter(user => user.id !== userId));
          
          // Update assigned operators for regional commanders
          if (userToDelete.role === UserRole.OPERATOR && userToDelete.regionId) {
            setUsers(prev => 
              prev.map(user => {
                if (user.role === UserRole.REGIONAL_HQ && user.regionId === userToDelete.regionId) {
                  return {
                    ...user,
                    assignedOperators: user.assignedOperators?.filter(id => id !== userId)
                  };
                }
                return user;
              })
            );
          }
          
          // Update assigned drones for the deleted user
          if (userToDelete.assignedDrones && userToDelete.assignedDrones.length > 0) {
            setDrones(prev => 
              prev.map(drone => {
                if (userToDelete.assignedDrones?.includes(drone.id)) {
                  return {
                    ...drone,
                    operatorId: null
                  };
                }
                return drone;
              })
            );
          }
          
          showNotification(`Successfully deleted ${userToDelete.role === UserRole.REGIONAL_HQ ? 'Regional Commander' : 'Operator'}`);
        }
        
        setIsLoading(false);
      }, 800);
    };
  
    const handleEditUser = (user: User) => {
      setEditingUser(user);
      setFormState({
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        regionId: user.regionId,
        password: '',
        confirmPassword: '',
        status: user.status,
      });
      setActiveTab(UserManagementTab.CREATE_USER);
    };
  
    const handleCreateDrone = () => {
      if (!validateDroneForm()) return;
  
      setIsLoading(true);
  
      // Simulate API call
      setTimeout(() => {
        const newDrone: Drone = {
          id: droneFormState.id,
          model: droneFormState.model,
          status: droneFormState.status,
          regionId: droneFormState.regionId,
          operatorId: droneFormState.operatorId,
        };
  
        setDrones(prev => [...prev, newDrone]);
        
        // If drone is assigned to a region, update the region's assigned drones
        if (newDrone.regionId) {
          const regionalCommander = users.find(
            u => u.role === UserRole.REGIONAL_HQ && u.regionId === newDrone.regionId
          );
          
          if (regionalCommander) {
            setUsers(prev => 
              prev.map(user => {
                if (user.id === regionalCommander.id) {
                  return {
                    ...user,
                    assignedDrones: [...(user.assignedDrones || []), newDrone.id]
                  };
                }
                return user;
              })
            );
          }
        }
        
        // If drone is assigned to an operator, update the operator's assigned drones
        if (newDrone.operatorId) {
          setUsers(prev => 
            prev.map(user => {
              if (user.id === newDrone.operatorId) {
                return {
                  ...user,
                  assignedDrones: [...(user.assignedDrones || []), newDrone.id]
                };
              }
              return user;
            })
          );
        }
        
        setActiveTab(UserManagementTab.MANAGE_DRONES);
        showNotification('Successfully created new drone');
        setIsLoading(false);
      }, 800);
    };
  
    const handleShowAssignModal = (user: User) => {
      setSelectedAssignUser(user);
      setShowAssignModal(true);
      setSelectedTab('drones');
    };
  
    const handleAssignDrone = (userId: string, droneId: string) => {
      setIsLoading(true);
  
      // Simulate API call
      setTimeout(() => {
        // Update drone assignments
        setDrones(prev =>
          prev.map(drone => {
            if (drone.id === droneId) {
              return {
                ...drone,
                operatorId: userId,
                regionId: users.find(u => u.id === userId)?.regionId || drone.regionId
              };
            }
            return drone;
          })
        );
  
        // Update user's assigned drones
        setUsers(prev =>
          prev.map(user => {
            if (user.id === userId) {
              return {
                ...user,
                assignedDrones: [...(user.assignedDrones || []), droneId]
              };
            }
            return user;
          })
        );
  
        showNotification('Successfully assigned drone');
        setIsLoading(false);
      }, 600);
    };
  
    const handleAssignOperator = (regionalId: string, operatorId: string) => {
      setIsLoading(true);
  
      // Simulate API call
      setTimeout(() => {
        const operator = users.find(u => u.id === operatorId);
        const regionalCommander = users.find(u => u.id === regionalId);
  
        if (operator && regionalCommander) {
          // Update operator's region
          setUsers(prev =>
            prev.map(user => {
              if (user.id === operatorId) {
                return {
                  ...user,
                  regionId: regionalCommander.regionId
                };
              }
              return user;
            })
          );
  
          // Add operator to regional commander's assigned operators
          setUsers(prev =>
            prev.map(user => {
              if (user.id === regionalId) {
                return {
                  ...user,
                  assignedOperators: [...(user.assignedOperators || []), operatorId]
                };
              }
              return user;
            })
          );
  
          showNotification('Successfully assigned operator');
        }
        
        setIsLoading(false);
      }, 600);
    };
  
    const handleUnassignDrone = (userId: string, droneId: string) => {
      setIsLoading(true);
  
      // Simulate API call
      setTimeout(() => {
        // Update drone assignment
        setDrones(prev =>
          prev.map(drone => {
            if (drone.id === droneId) {
              return {
                ...drone,
                operatorId: null
              };
            }
            return drone;
          })
        );
  
        // Update user's assigned drones
        setUsers(prev =>
          prev.map(user => {
            if (user.id === userId) {
              return {
                ...user,
                assignedDrones: (user.assignedDrones || []).filter(id => id !== droneId)
              };
            }
            return user;
          })
        );
  
        showNotification('Successfully unassigned drone');
        setIsLoading(false);
      }, 600);
    };
  
    const handleUnassignOperator = (regionalId: string, operatorId: string) => {
      setIsLoading(true);
  
      // Simulate API call
      setTimeout(() => {
        // Update regional commander's assigned operators
        setUsers(prev =>
          prev.map(user => {
            if (user.id === regionalId) {
              return {
                ...user,
                assignedOperators: (user.assignedOperators || []).filter(id => id !== operatorId)
              };
            }
            return user;
          })
        );
  
        // Also remove region assignment from operator
        setUsers(prev =>
          prev.map(user => {
            if (user.id === operatorId) {
              return {
                ...user,
                regionId: undefined
              };
            }
            return user;
          })
        );
  
        showNotification('Successfully unassigned operator');
        setIsLoading(false);
      }, 600);
    };
  
    const getStatusStyles = (status: string): string => {
      switch(status) {
        case 'ACTIVE':
          return 'bg-green-500/20 text-green-300 border-green-500/30';
        case 'STANDBY':
          return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
        case 'MAINTENANCE':
          return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
        case 'OFFLINE':
        case 'INACTIVE':
          return 'bg-red-500/20 text-red-300 border-red-500/30';
        default:
          return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
      }
    };
  
    const formatDate = (dateString: string): string => {
      if (!dateString) return 'N/A';
      const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
      return new Date(dateString).toLocaleDateString(undefined, options);
    };
  
    return (
      <div className="min-h-screen bg-gray-900 text-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-gray-800 shadow-lg rounded-lg overflow-hidden border border-gray-700">
            {/* Header */}
            <div className="p-6 border-b border-gray-700 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Users className="h-6 w-6 text-blue-400" />
                <h2 className="text-2xl font-light tracking-wider">USER MANAGEMENT</h2>
              </div>
            </div>
  
            {/* Notification */}
            {notification && (
              <div className={`m-6 p-4 rounded-lg border ${
                notification.type === 'success' 
                  ? 'bg-green-500/10 border-green-500/30 text-green-300' 
                  : 'bg-red-500/10 border-red-500/30 text-red-300'
              } flex items-center gap-2`}>
                {notification.type === 'success' 
                  ? <CheckCircle className="h-5 w-5" /> 
                  : <XCircle className="h-5 w-5" />}
                <p className="tracking-wider font-light">{notification.message}</p>
              </div>
            )}
  
            {/* Tabs */}
            <div className="bg-gray-800/60 border-b border-gray-700">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex overflow-x-auto py-2 no-scrollbar">
                  <button 
                    onClick={() => setActiveTab(UserManagementTab.REGIONAL_COMMANDERS)}
                    className={`px-4 py-2 mx-1 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2
                      ${activeTab === UserManagementTab.REGIONAL_COMMANDERS 
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                        : 'text-gray-400 hover:text-white hover:bg-gray-700/50'}`}
                  >
                    <Shield className="h-4 w-4" />
                    Regional Commanders
                  </button>
                  <button 
                    onClick={() => setActiveTab(UserManagementTab.OPERATORS)}
                    className={`px-4 py-2 mx-1 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2
                      ${activeTab === UserManagementTab.OPERATORS 
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                        : 'text-gray-400 hover:text-white hover:bg-gray-700/50'}`}
                  >
                    <Users className="h-4 w-4" />
                    Field Operators
                  </button>
                  <button 
                    onClick={() => setActiveTab(UserManagementTab.MANAGE_DRONES)}
                    className={`px-4 py-2 mx-1 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2
                      ${activeTab === UserManagementTab.MANAGE_DRONES 
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                        : 'text-gray-400 hover:text-white hover:bg-gray-700/50'}`}
                  >
                    <Drone className="h-4 w-4" />
                    Manage Drones
                  </button>
                  <button 
                    onClick={() => setActiveTab(UserManagementTab.CREATE_USER)}
                    className={`px-4 py-2 mx-1 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2
                      ${activeTab === UserManagementTab.CREATE_USER 
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                        : 'text-gray-400 hover:text-white hover:bg-gray-700/50'}`}
                  >
                    <UserPlus className="h-4 w-4" />
                    {editingUser ? 'Edit User' : 'Create User'}
                  </button>
                  <button 
                    onClick={() => setActiveTab(UserManagementTab.CREATE_DRONE)}
                    className={`px-4 py-2 mx-1 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2
                      ${activeTab === UserManagementTab.CREATE_DRONE 
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                        : 'text-gray-400 hover:text-white hover:bg-gray-700/50'}`}
                  >
                    <PlusCircle className="h-4 w-4" />
                    Create Drone
                  </button>
                </div>
              </div>
            </div>
  
            {/* Main content */}
            <div className="p-6">
              {/* User Lists (Regional Commanders and Operators) */}
              {(activeTab === UserManagementTab.REGIONAL_COMMANDERS || activeTab === UserManagementTab.OPERATORS) && (
                <div>
                  {/* Search and filter bar */}
                  <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="relative flex-grow">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        placeholder="Search by name, username, or email..."
                        className="bg-gray-700 rounded-lg pl-10 pr-4 py-2 text-white w-full border border-gray-600 focus:border-blue-500 focus:ring-0"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 px-3 py-2 bg-gray-700 rounded-lg border border-gray-600">
                        <input
                          type="checkbox"
                          id="show-inactive"
                          className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-800"
                          checked={showInactive}
                          onChange={(e) => setShowInactive(e.target.checked)}
                        />
                        <label htmlFor="show-inactive" className="text-sm text-gray-300">
                          Show Inactive
                        </label>
                      </div>
                      <button
                        onClick={() => setActiveTab(
                          activeTab === UserManagementTab.REGIONAL_COMMANDERS 
                            ? UserManagementTab.CREATE_USER 
                            : UserManagementTab.CREATE_USER
                        )}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 text-blue-300 rounded-lg border border-blue-500/30 hover:bg-blue-500/30 transition-colors"
                      >
                        <UserPlus className="h-4 w-4" />
                        <span>Add {activeTab === UserManagementTab.REGIONAL_COMMANDERS ? 'Commander' : 'Operator'}</span>
                      </button>
                    </div>
                  </div>
  
                  {/* User listing */}
                  {isLoading ? (
                    <div className="flex justify-center items-center h-64">
                      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                      <Users className="h-12 w-12 mb-4 text-gray-500" />
                      <p className="text-lg tracking-wider font-light">No users found</p>
                      <p className="text-sm mt-2">Try adjusting your search or create a new user</p>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                      {filteredUsers.map(user => (
                        <div 
                          key={user.id}
                          className="rounded-lg border border-gray-700 bg-gray-800/50 hover:bg-gray-800 transition-colors overflow-hidden"
                        >
                          {/* User header - always visible */}
                          <div 
                            className="p-4 cursor-pointer"
                            onClick={() => toggleExpandUser(user.id)}
                          >
                            <div className="flex flex-wrap justify-between items-center mb-3">
                              <div className="flex items-center gap-2">
                                <div className="font-medium tracking-wider text-white">{user.fullName}</div>
                                {expandedUser === user.id ? (
                                  <ChevronUp className="h-4 w-4 text-gray-400" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-gray-400" />
                                )}
                              </div>
                              <div className={`text-xs px-2 py-1 rounded-full border ${getStatusStyles(user.status)}`}>
                                {user.status}
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2">
                              <div className="text-sm">
                                <div className="text-gray-400">Username</div>
                                <div>{user.username}</div>
                              </div>
                              
                              <div className="text-sm">
                                <div className="text-gray-400">Email</div>
                                <div>{user.email}</div>
                              </div>
                              
                              <div className="text-sm">
                                <div className="text-gray-400">Role</div>
                                <div>{user.role === UserRole.REGIONAL_HQ ? 'Regional Commander' : 'Field Operator'}</div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Expanded user details */}
                          {expandedUser === user.id && (
                            <div className="px-4 pb-4 border-t border-gray-700 pt-4 bg-gray-700/30">
                              <div className="grid grid-cols-1 gap-4">
                                {/* Additional details */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                  <div className="text-sm">
                                    <div className="text-gray-400">ID</div>
                                    <div>{user.id}</div>
                                  </div>
                                  <div className="text-sm">
                                    <div className="text-gray-400">Created</div>
                                    <div>{formatDate(user.createdAt)}</div>
                                  </div>
                                  <div className="text-sm">
                                    <div className="text-gray-400">Region</div>
                                    <div>
                                      {user.regionId 
                                        ? regions.find(r => r.id === user.regionId)?.name || 'Unknown' 
                                        : 'Unassigned'}
                                    </div>
                                  </div>
                                  <div className="text-sm">
                                    <div className="text-gray-400">
                                      {user.role === UserRole.REGIONAL_HQ ? 'Operators' : 'Drones'}
                                    </div>
                                    <div>
                                      {user.role === UserRole.REGIONAL_HQ 
                                        ? (user.assignedOperators?.length || 0)
                                        : (user.assignedDrones?.length || 0)}
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Assigned items section */}
                                <div className="mt-4">
                                <h4 className="text-sm font-medium mb-3 text-gray-300">
                                  {user.role === UserRole.REGIONAL_HQ 
                                    ? 'Assigned Operators & Drones' 
                                    : 'Assigned Drones'}
                                </h4>
                                
                                {/* Regional HQ shows both operators and drones */}
                                {user.role === UserRole.REGIONAL_HQ && (
                                  <div className="space-y-4">
                                    <div className="bg-gray-800 rounded-lg border border-gray-700 p-3">
                                      <div className="flex justify-between items-center mb-2">
                                        <h5 className="text-sm font-medium text-gray-300">Operators</h5>
                                        <button
                                          onClick={() => handleShowAssignModal(user)}
                                          className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded border border-blue-500/30 hover:bg-blue-500/30 transition-colors flex items-center gap-1"
                                        >
                                          <UserPlus className="h-3 w-3" />
                                          Assign
                                        </button>
                                      </div>
                                      {!user.assignedOperators || user.assignedOperators.length === 0 ? (
                                        <div className="text-sm text-gray-400 py-2">No operators assigned</div>
                                      ) : (
                                        <div className="space-y-2">
                                          {user.assignedOperators.map(operatorId => {
                                            const operator = users.find(u => u.id === operatorId);
                                            return operator ? (
                                              <div key={operatorId} className="flex justify-between items-center bg-gray-700/50 rounded p-2 text-sm">
                                                <div className="flex items-center gap-2">
                                                  <Users className="h-4 w-4 text-blue-400" />
                                                  <span>{operator.fullName}</span>
                                                </div>
                                                <button
                                                  onClick={() => handleUnassignOperator(user.id, operatorId)}
                                                  className="text-red-300 hover:text-red-400 transition-colors"
                                                >
                                                  <XCircle className="h-4 w-4" />
                                                </button>
                                              </div>
                                            ) : null;
                                          })}
                                        </div>
                                      )}
                                    </div>
                                    
                                    <div className="bg-gray-800 rounded-lg border border-gray-700 p-3">
                                      <div className="flex justify-between items-center mb-2">
                                        <h5 className="text-sm font-medium text-gray-300">Drones</h5>
                                        <button
                                          onClick={() => handleShowAssignModal(user)}
                                          className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded border border-blue-500/30 hover:bg-blue-500/30 transition-colors flex items-center gap-1"
                                        >
                                          <Drone className="h-3 w-3" />
                                          Assign
                                        </button>
                                      </div>
                                      
                                      {!user.assignedDrones || user.assignedDrones.length === 0 ? (
                                        <div className="text-sm text-gray-400 py-2">No drones assigned</div>
                                      ) : (
                                        <div className="space-y-2">
                                          {user.assignedDrones.map(droneId => {
                                            const drone = drones.find(d => d.id === droneId);
                                            return drone ? (
                                              <div key={droneId} className="flex justify-between items-center bg-gray-700/50 rounded p-2 text-sm">
                                                <div className="flex items-center gap-2">
                                                  <Drone className="h-4 w-4 text-blue-400" />
                                                  <span>{drone.id}</span>
                                                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${getStatusStyles(drone.status)}`}>
                                                    {drone.status}
                                                  </span>
                                                </div>
                                                <button
                                                  onClick={() => handleUnassignDrone(user.id, droneId)}
                                                  className="text-red-300 hover:text-red-400 transition-colors"
                                                >
                                                  <XCircle className="h-4 w-4" />
                                                </button>
                                              </div>
                                            ) : null;
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Operators only show drones */}
                                {user.role === UserRole.OPERATOR && (
                                  <div className="bg-gray-800 rounded-lg border border-gray-700 p-3">
                                    <div className="flex justify-between items-center mb-2">
                                      <h5 className="text-sm font-medium text-gray-300">Drones</h5>
                                      <button
                                        onClick={() => handleShowAssignModal(user)}
                                        className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded border border-blue-500/30 hover:bg-blue-500/30 transition-colors flex items-center gap-1"
                                      >
                                        <Drone className="h-3 w-3" />
                                        Assign
                                      </button>
                                    </div>
                                    
                                    {!user.assignedDrones || user.assignedDrones.length === 0 ? (
                                      <div className="text-sm text-gray-400 py-2">No drones assigned</div>
                                    ) : (
                                      <div className="space-y-2">
                                        {user.assignedDrones.map(droneId => {
                                          const drone = drones.find(d => d.id === droneId);
                                          return drone ? (
                                            <div key={droneId} className="flex justify-between items-center bg-gray-700/50 rounded p-2 text-sm">
                                              <div className="flex items-center gap-2">
                                                <Drone className="h-4 w-4 text-blue-400" />
                                                <span>{drone.id}</span>
                                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${getStatusStyles(drone.status)}`}>
                                                  {drone.status}
                                                </span>
                                              </div>
                                              <button
                                                onClick={() => handleUnassignDrone(user.id, droneId)}
                                                className="text-red-300 hover:text-red-400 transition-colors"
                                              >
                                                <XCircle className="h-4 w-4" />
                                              </button>
                                            </div>
                                          ) : null;
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              
                              {/* Action buttons */}
                              <div className="flex justify-end gap-2 mt-4">
                                <button
                                  onClick={() => handleEditUser(user)}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/20 text-blue-300 rounded-lg border border-blue-500/30 hover:bg-blue-500/30 transition-colors text-sm"
                                >
                                  <Edit className="h-4 w-4" />
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(user.id)}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 text-red-300 rounded-lg border border-red-500/30 hover:bg-red-500/30 transition-colors text-sm"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Create User Form */}
            {activeTab === UserManagementTab.CREATE_USER && (
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <h3 className="text-xl font-light tracking-wider mb-6 flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-blue-400" />
                  {editingUser ? 'Edit User' : 'Create New User'}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Username*</label>
                    <input
                      type="text"
                      name="username"
                      value={formState.username}
                      onChange={handleFormChange}
                      className="bg-gray-700 rounded-lg px-4 py-2 text-white w-full border border-gray-600 focus:border-blue-500 focus:ring-0"
                      placeholder="Enter username"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Full Name*</label>
                    <input
                      type="text"
                      name="fullName"
                      value={formState.fullName}
                      onChange={handleFormChange}
                      className="bg-gray-700 rounded-lg px-4 py-2 text-white w-full border border-gray-600 focus:border-blue-500 focus:ring-0"
                      placeholder="Enter full name"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Email*</label>
                    <input
                      type="email"
                      name="email"
                      value={formState.email}
                      onChange={handleFormChange}
                      className="bg-gray-700 rounded-lg px-4 py-2 text-white w-full border border-gray-600 focus:border-blue-500 focus:ring-0"
                      placeholder="Enter email address"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Role*</label>
                    <select
                      name="role"
                      value={formState.role}
                      onChange={handleFormChange}
                      className="bg-gray-700 rounded-lg px-4 py-2 text-white w-full border border-gray-600 focus:border-blue-500 focus:ring-0"
                      required
                    >
                      <option value={UserRole.REGIONAL_HQ}>Regional Commander</option>
                      <option value={UserRole.OPERATOR}>Field Operator</option>
                    </select>
                  </div>
                  
                  {formState.role === UserRole.REGIONAL_HQ && (
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Region*</label>
                      <select
                        name="regionId"
                        value={formState.regionId || ''}
                        onChange={handleFormChange}
                        className="bg-gray-700 rounded-lg px-4 py-2 text-white w-full border border-gray-600 focus:border-blue-500 focus:ring-0"
                        required
                      >
                        <option value="" disabled>Select a region</option>
                        {regions.map(region => (
                          <option key={region.id} value={region.id}>{region.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Status</label>
                    <select
                      name="status"
                      value={formState.status}
                      onChange={handleFormChange}
                      className="bg-gray-700 rounded-lg px-4 py-2 text-white w-full border border-gray-600 focus:border-blue-500 focus:ring-0"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </div>
                  
                  {!editingUser && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Password*</label>
                        <input
                          type="password"
                          name="password"
                          value={formState.password}
                          onChange={handleFormChange}
                          className="bg-gray-700 rounded-lg px-4 py-2 text-white w-full border border-gray-600 focus:border-blue-500 focus:ring-0"
                          placeholder="Enter password"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Confirm Password*</label>
                        <input
                          type="password"
                          name="confirmPassword"
                          value={formState.confirmPassword}
                          onChange={handleFormChange}
                          className="bg-gray-700 rounded-lg px-4 py-2 text-white w-full border border-gray-600 focus:border-blue-500 focus:ring-0"
                          placeholder="Confirm password"
                          required
                        />
                      </div>
                    </>
                  )}
                </div>
                
                <div className="flex justify-end gap-3 mt-8">
                  <button
                    onClick={() => setActiveTab(
                      formState.role === UserRole.REGIONAL_HQ 
                        ? UserManagementTab.REGIONAL_COMMANDERS 
                        : UserManagementTab.OPERATORS
                    )}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={editingUser ? handleUpdateUser : handleCreateUser}
                    disabled={isLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )}
                    {editingUser ? 'Update User' : 'Create User'}
                  </button>
                </div>
              </div>
            )}
            
            {/* Create Drone Form */}
            {activeTab === UserManagementTab.CREATE_DRONE && (
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <h3 className="text-xl font-light tracking-wider mb-6 flex items-center gap-2">
                  <Drone className="h-5 w-5 text-blue-400" />
                  Create New Drone
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Drone ID*</label>
                    <input
                      type="text"
                      name="id"
                      value={droneFormState.id}
                      onChange={handleDroneFormChange}
                      className="bg-gray-700 rounded-lg px-4 py-2 text-white w-full border border-gray-600 focus:border-blue-500 focus:ring-0"
                      placeholder="Enter drone ID"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Model*</label>
                    <select
                      name="model"
                      value={droneFormState.model}
                      onChange={handleDroneFormChange}
                      className="bg-gray-700 rounded-lg px-4 py-2 text-white w-full border border-gray-600 focus:border-blue-500 focus:ring-0"
                      required
                    >
                      <option value="FlyOS-MQ5">FlyOS-MQ5</option>
                      <option value="FlyOS-MQ7">FlyOS-MQ7</option>
                      <option value="FlyOS-MQ9">FlyOS-MQ9</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Status</label>
                    <select
                      name="status"
                      value={droneFormState.status}
                      onChange={handleDroneFormChange}
                      className="bg-gray-700 rounded-lg px-4 py-2 text-white w-full border border-gray-600 focus:border-blue-500 focus:ring-0"
                    >
                      <option value="STANDBY">Standby</option>
                      <option value="ACTIVE">Active</option>
                      <option value="MAINTENANCE">Maintenance</option>
                      <option value="OFFLINE">Offline</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Region</label>
                    <select
                      name="regionId"
                      value={droneFormState.regionId || ""}
                      onChange={handleDroneFormChange}
                      className="bg-gray-700 rounded-lg px-4 py-2 text-white w-full border border-gray-600 focus:border-blue-500 focus:ring-0"
                    >
                      <option value="">Unassigned</option>
                      {regions.filter(r => r.status === 'ACTIVE').map(region => (
                        <option key={region.id} value={region.id}>{region.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Operator</label>
                    <select
                      name="operatorId"
                      value={droneFormState.operatorId || ""}
                      onChange={handleDroneFormChange}
                      className="bg-gray-700 rounded-lg px-4 py-2 text-white w-full border border-gray-600 focus:border-blue-500 focus:ring-0"
                    >
                      <option value="">Unassigned</option>
                      {users
                        .filter(u => u.role === UserRole.OPERATOR && u.status === 'ACTIVE')
                        .map(operator => (
                          <option key={operator.id} value={operator.id}>{operator.fullName}</option>
                        ))
                      }
                    </select>
                  </div>
                </div>
                
                <div className="flex justify-end gap-3 mt-8">
                  <button
                    onClick={() => setActiveTab(UserManagementTab.MANAGE_DRONES)}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateDrone}
                    disabled={isLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    ) : (
                      <Drone className="h-4 w-4" />
                    )}
                    Create Drone
                  </button>
                </div>
              </div>
            )}
            
            {/* Manage Drones */}
            {activeTab === UserManagementTab.MANAGE_DRONES && (
              <div>
                {/* Search and filter bar */}
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                  <div className="relative flex-grow">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      placeholder="Search drones..."
                      className="bg-gray-700 rounded-lg pl-10 pr-4 py-2 text-white w-full border border-gray-600 focus:border-blue-500 focus:ring-0"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 px-3 py-2 bg-gray-700 rounded-lg border border-gray-600">
                      <Filter className="h-4 w-4 text-gray-400" />
                      <select
                        className="bg-gray-700 text-white border-0 focus:ring-0 text-sm p-0"
                        onChange={(e) => setSearchQuery(e.target.value ? `${e.target.value}` : '')}
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
                      className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 text-blue-300 rounded-lg border border-blue-500/30 hover:bg-blue-500/30 transition-colors"
                    >
                      <PlusCircle className="h-4 w-4" />
                      <span>Add Drone</span>
                    </button>
                  </div>
                </div>
                
                {/* Drone listing */}
                {isLoading ? (
                  <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                  </div>
                ) : drones.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                    <Drone className="h-12 w-12 mb-4 text-gray-500" />
                    <p className="text-lg tracking-wider font-light">No drones found</p>
                    <p className="text-sm mt-2">Create a new drone to get started</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {drones
                      .filter(drone => 
                        searchQuery === '' || 
                        drone.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        drone.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        drone.status.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map(drone => (
                        <div 
                          key={drone.id}
                          className="rounded-lg border border-gray-700 bg-gray-800/50 hover:bg-gray-800 transition-colors overflow-hidden p-4"
                        >
                          <div className="flex justify-between items-center mb-3">
                            <div className="font-medium tracking-wider text-white">{drone.id}</div>
                            <div className={`text-xs px-2 py-1 rounded-full border ${getStatusStyles(drone.status)}`}>
                              {drone.status}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 mb-4">
                            <div className="text-sm">
                              <div className="text-gray-400">Model</div>
                              <div>{drone.model}</div>
                            </div>
                            <div className="text-sm">
                              <div className="text-gray-400">Region</div>
                              <div>
                                {drone.regionId 
                                  ? regions.find(r => r.id === drone.regionId)?.name || 'Unknown' 
                                  : 'Unassigned'}
                              </div>
                            </div>
                            <div className="text-sm">
                              <div className="text-gray-400">Operator</div>
                              <div>
                                {drone.operatorId 
                                  ? users.find(u => u.id === drone.operatorId)?.fullName || 'Unknown' 
                                  : 'Unassigned'}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex justify-end gap-2 mt-4">
                            <button
                              onClick={() => {
                                setDroneFormState({
                                  id: drone.id,
                                  model: drone.model,
                                  status: drone.status,
                                  regionId: drone.regionId,
                                  operatorId: drone.operatorId,
                                });
                                setActiveTab(UserManagementTab.CREATE_DRONE);
                              }}
                              className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/20 text-blue-300 rounded-lg border border-blue-500/30 hover:bg-blue-500/30 transition-colors text-sm"
                            >
                              <Edit className="h-4 w-4" />
                              Edit
                            </button>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Assignment Modal */}
      {showAssignModal && selectedAssignUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm z-50">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 max-w-2xl w-full mx-4">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-light tracking-wider">
                Assign to {selectedAssignUser.fullName}
              </h3>
              <button 
                onClick={() => setShowAssignModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            
            {/* Tabs for regional commanders */}
            {selectedAssignUser.role === UserRole.REGIONAL_HQ && (
              <div className="flex border-b border-gray-700 mb-4">
                <button
                  onClick={() => setSelectedTab('operators')}
                  className={`px-4 py-2 text-sm font-medium ${
                    selectedTab === 'operators' 
                      ? 'text-blue-300 border-b-2 border-blue-400' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Operators
                </button>
                <button
                  onClick={() => setSelectedTab('drones')}
                  className={`px-4 py-2 text-sm font-medium ${
                    selectedTab === 'drones' 
                      ? 'text-blue-300 border-b-2 border-blue-400' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Drones
                </button>
              </div>
            )}
            
            {/* Operator assignment for regional commanders */}
            {selectedAssignUser.role === UserRole.REGIONAL_HQ && selectedTab === 'operators' && (
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                <div className="text-sm text-gray-400 mb-4">
                  Select operators to assign to this regional commander:
                </div>
                
                {users
                  .filter(user => 
                    user.role === UserRole.OPERATOR && 
                    user.status === 'ACTIVE' && 
                    !selectedAssignUser.assignedOperators?.includes(user.id)
                  )
                  .length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                      No available operators to assign
                    </div>
                  ) : (
                    users
                      .filter(user => 
                        user.role === UserRole.OPERATOR && 
                        user.status === 'ACTIVE' && 
                        !selectedAssignUser.assignedOperators?.includes(user.id)
                      )
                      .map(operator => (
                        <div 
                          key={operator.id}
                          className="flex justify-between items-center p-3 rounded-lg bg-gray-700/50 border border-gray-700"
                        >
                          <div className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-blue-400" />
                            <div>
                              <div className="font-medium">{operator.fullName}</div>
                              <div className="text-sm text-gray-400">{operator.username}</div>
                            </div>
                          </div> 
                          <button
                            onClick={() => {
                              handleAssignOperator(selectedAssignUser.id, operator.id);
                              setShowAssignModal(false);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/20 text-blue-300 rounded-lg border border-blue-500/30 hover:bg-blue-500/30 transition-colors text-sm"
                          >
                            <ArrowRightCircle className="h-4 w-4" />
                            Assign
                          </button>
                        </div>
                      ))
                  )}
              </div>
            )}
            
            {/* Drone assignment for both user types */}
            {(selectedTab === 'drones' || selectedAssignUser.role === UserRole.OPERATOR) && (
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                <div className="text-sm text-gray-400 mb-4">
                  Select drones to assign to {selectedAssignUser.role === UserRole.REGIONAL_HQ ? 'this region' : 'this operator'}:
                </div>
                
                {drones
                  .filter(drone => {
                    if (selectedAssignUser.role === UserRole.REGIONAL_HQ) {
                      // For regional HQ, show unassigned drones or drones from other regions
                      return drone.regionId !== selectedAssignUser.regionId && drone.status !== 'OFFLINE';
                    } else {
                      // For operators, only show drones from their region that aren't assigned to them
                      return drone.regionId === selectedAssignUser.regionId && 
                             drone.operatorId !== selectedAssignUser.id && 
                             drone.status !== 'OFFLINE';
                    }
                  })
                  .length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                      No available drones to assign
                    </div>
                  ) : (
                    drones
                      .filter(drone => {
                        if (selectedAssignUser.role === UserRole.REGIONAL_HQ) {
                          // For regional HQ, show unassigned drones or drones from other regions
                          return drone.regionId !== selectedAssignUser.regionId && drone.status !== 'OFFLINE';
                        } else {
                          // For operators, only show drones from their region that aren't assigned to them
                          return drone.regionId === selectedAssignUser.regionId && 
                                drone.operatorId !== selectedAssignUser.id && 
                                drone.status !== 'OFFLINE';
                        }
                      })
                      .map(drone => (
                        <div 
                          key={drone.id}
                          className="flex justify-between items-center p-3 rounded-lg bg-gray-700/50 border border-gray-700"
                        >
                          <div className="flex items-center gap-2">
                            <Drone className="h-5 w-5 text-blue-400" />
                            <div>
                              <div className="font-medium">{drone.id}</div>
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-gray-400">{drone.model}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${getStatusStyles(drone.status)}`}>
                                  {drone.status}
                                </span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              handleAssignDrone(selectedAssignUser.id, drone.id);
                              setShowAssignModal(false);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/20 text-blue-300 rounded-lg border border-blue-500/30 hover:bg-blue-500/30 transition-colors text-sm"
                          >
                            <ArrowRightCircle className="h-4 w-4" />
                            Assign
                          </button>
                        </div>
                      ))
                  )}
              </div>
            )}
            
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
                              

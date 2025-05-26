// components/UserManagement.tsx - PART 1 (Interfaces & Setup)
import React, { useState, useEffect } from 'react';
import {
  Shield, Users, UserPlus, Plane as Drone, Search,
  PlusCircle, Edit, Trash2, CheckCircle,
  XCircle, ArrowRightCircle, ChevronDown,
  ChevronUp, Filter, Database, Clock,
  AlertTriangle, RefreshCw
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

// components/UserManagement.tsx - PART 2 (Main Component & State Management)

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
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
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
      setLastUpdated(new Date());
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

  // Validation functions
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

  const refreshData = () => {
    setIsLoading(true);
    setTimeout(() => {
      setLastUpdated(new Date());
      setIsLoading(false);
      showNotification('Data refreshed successfully');
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-black text-gray-200">
      {/* Main Container */}
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
              <span className="text-gray-400">Total Users:</span> <span className="text-blue-300 font-light">{users.length}</span>
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

        {/* Enhanced Tabs */}
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
        
        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <div className="relative">
              <div className="animate-ping absolute inset-0 rounded-full h-12 w-12 bg-blue-400 opacity-10"></div>
              <div className="animate-spin relative rounded-full h-12 w-12 border-2 border-gray-600 border-t-blue-500"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// components/UserManagement.tsx - PART 3 (CRUD Operations & User Lists)

  // CRUD Operations
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
      showNotification(`Successfully created ${newUser.role === UserRole.REGIONAL_HQ ? 'Regional Commander' : 'Field Operator'}`);
      setLastUpdated(new Date());
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
      showNotification(`Successfully updated ${updatedUser.role === UserRole.REGIONAL_HQ ? 'Regional Commander' : 'Field Operator'}`);
      setEditingUser(null);
      setLastUpdated(new Date());
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
        
        showNotification(`Successfully deleted ${userToDelete.role === UserRole.REGIONAL_HQ ? 'Regional Commander' : 'Field Operator'}`);
      }
      
      setLastUpdated(new Date());
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

  // Continue with the render method for User Lists
  const renderUserLists = () => {
    return (
      <div className="p-6">
        {/* Enhanced Search and Filter Bar */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by name, username, or email..."
              className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg pl-10 pr-4 py-3 text-white w-full border border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:ring-offset-0 transition-all backdrop-blur-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg border border-gray-700 backdrop-blur-sm">
              <input
                type="checkbox"
                id="show-inactive"
                className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-800"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              <label htmlFor="show-inactive" className="text-sm text-gray-300 tracking-wider">
                Show Inactive
              </label>
            </div>
            <button
              onClick={() => setActiveTab(UserManagementTab.CREATE_USER)}
              className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-blue-300 rounded-lg border border-blue-500/30 hover:from-blue-500/30 hover:to-indigo-500/30 transition-all backdrop-blur-sm"
            >
              <UserPlus className="h-4 w-4" />
              <span className="tracking-wider font-light">
                Add {activeTab === UserManagementTab.REGIONAL_COMMANDERS ? 'Commander' : 'Operator'}
              </span>
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
            <p className="text-xl tracking-wider font-light mb-2">No users found</p>
            <p className="text-sm text-gray-500">Try adjusting your search or create a new user</p>
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
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border border-blue-500/30 flex items-center justify-center">
                        {user.role === UserRole.REGIONAL_HQ ? (
                          <Shield className="h-5 w-5 text-blue-400" />
                        ) : (
                          <Users className="h-5 w-5 text-blue-400" />
                        )}
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
                      <div className="text-xs text-gray-400 mb-1 tracking-wider">ROLE</div>
                      <div className="text-sm text-blue-300">{user.role === UserRole.REGIONAL_HQ ? 'Regional Commander' : 'Field Operator'}</div>
                    </div>
                    
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                      <div className="text-xs text-gray-400 mb-1 tracking-wider">REGION</div>
                      <div className="text-sm text-white">
                        {user.regionId 
                          ? regions.find(r => r.id === user.regionId)?.name || 'Unknown' 
                          : 'Unassigned'}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Expanded Details */}
                {expandedUser === user.id && (
                  <div className="px-5 pb-5 border-t border-gray-800 pt-5 bg-gradient-to-r from-blue-900/5 to-indigo-900/5">
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
                        <div className="text-xs text-gray-400 mb-1 tracking-wider">
                          {user.role === UserRole.REGIONAL_HQ ? 'OPERATORS' : 'DRONES'}
                        </div>
                        <div className="text-sm text-blue-300 font-medium">
                          {user.role === UserRole.REGIONAL_HQ 
                            ? (user.assignedOperators?.length || 0)
                            : (user.assignedDrones?.length || 0)}
                        </div>
                      </div>
                      <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                        <div className="text-xs text-gray-400 mb-1 tracking-wider">LAST ACTIVE</div>
                        <div className="text-sm text-green-400">Online</div>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditUser(user);
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
                            handleDeleteUser(user.id);
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

// components/UserManagement.tsx - PART 4 (Forms & Main Render)

  // Create User Form
  const renderCreateUserForm = () => {
    return (
      <div className="p-6">
        <div className="bg-gradient-to-b from-gray-900/80 to-black/80 rounded-lg border border-gray-800 p-6 backdrop-blur-sm">
          <h3 className="text-xl font-light tracking-wider mb-6 flex items-center gap-3 text-blue-300">
            <UserPlus className="h-6 w-6 text-blue-400" />
            {editingUser ? 'Edit User Account' : 'Create New User Account'}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-400 tracking-wider">USERNAME*</label>
              <input
                type="text"
                name="username"
                value={formState.username}
                onChange={handleFormChange}
                className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg px-4 py-3 text-white w-full border border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all backdrop-blur-sm"
                placeholder="Enter username"
                required
              />
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-400 tracking-wider">FULL NAME*</label>
              <input
                type="text"
                name="fullName"
                value={formState.fullName}
                onChange={handleFormChange}
                className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg px-4 py-3 text-white w-full border border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all backdrop-blur-sm"
                placeholder="Enter full name"
                required
              />
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-400 tracking-wider">EMAIL ADDRESS*</label>
              <input
                type="email"
                name="email"
                value={formState.email}
                onChange={handleFormChange}
                className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg px-4 py-3 text-white w-full border border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all backdrop-blur-sm"
                placeholder="Enter email address"
                required
              />
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-400 tracking-wider">ROLE*</label>
              <select
                name="role"
                value={formState.role}
                onChange={handleFormChange}
                className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg px-4 py-3 text-white w-full border border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all backdrop-blur-sm"
                required
              >
                <option value={UserRole.REGIONAL_HQ}>Regional Commander</option>
                <option value={UserRole.OPERATOR}>Field Operator</option>
              </select>
            </div>
            
            {formState.role === UserRole.REGIONAL_HQ && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-400 tracking-wider">ASSIGNED REGION*</label>
                <select
                  name="regionId"
                  value={formState.regionId || ''}
                  onChange={handleFormChange}
                  className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg px-4 py-3 text-white w-full border border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all backdrop-blur-sm"
                  required
                >
                  <option value="" disabled>Select a region</option>
                  {regions.map(region => (
                    <option key={region.id} value={region.id}>{region.name}</option>
                  ))}
                </select>
              </div>
            )}
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-400 tracking-wider">STATUS</label>
              <select
                name="status"
                value={formState.status}
                onChange={handleFormChange}
                className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg px-4 py-3 text-white w-full border border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all backdrop-blur-sm"
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
            
            {!editingUser && (
              <>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-400 tracking-wider">PASSWORD*</label>
                  <input
                    type="password"
                    name="password"
                    value={formState.password}
                    onChange={handleFormChange}
                    className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg px-4 py-3 text-white w-full border border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all backdrop-blur-sm"
                    placeholder="Enter password (min 8 characters)"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-400 tracking-wider">CONFIRM PASSWORD*</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formState.confirmPassword}
                    onChange={handleFormChange}
                    className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg px-4 py-3 text-white w-full border border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all backdrop-blur-sm"
                    placeholder="Confirm password"
                    required
                  />
                </div>
              </>
            )}
          </div>
          
          <div className="flex justify-end gap-4 mt-8 pt-4 border-t border-gray-800">
            <button
              onClick={() => setActiveTab(
                formState.role === UserRole.REGIONAL_HQ 
                  ? UserManagementTab.REGIONAL_COMMANDERS 
                  : UserManagementTab.OPERATORS
              )}
              className="px-6 py-3 bg-gradient-to-r from-gray-700 to-gray-800 text-white rounded-lg border border-gray-600 hover:from-gray-600 hover:to-gray-700 transition-all tracking-wider font-light"
            >
              Cancel
            </button>
            <button
              onClick={editingUser ? handleUpdateUser : handleCreateUser}
              disabled={isLoading}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed tracking-wider font-light"
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
      </div>
    );
  };

  // Drone Management (simplified for space)
  const renderDroneManagement = () => {
    const filteredDrones = drones.filter(drone => 
      searchQuery === '' || 
      drone.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      drone.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      drone.status.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <div className="p-6">
        {/* Search Bar */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search drones..."
              className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg pl-10 pr-4 py-3 text-white w-full border border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all backdrop-blur-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            onClick={() => setActiveTab(UserManagementTab.CREATE_DRONE)}
            className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-blue-300 rounded-lg border border-blue-500/30 hover:from-blue-500/30 hover:to-indigo-500/30 transition-all backdrop-blur-sm"
          >
            <PlusCircle className="h-4 w-4" />
            <span className="tracking-wider font-light">Add Drone</span>
          </button>
        </div>

        {/* Drone Grid */}
        {filteredDrones.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-blue-500/10 rounded-full animate-pulse"></div>
              <Drone className="h-16 w-16 text-gray-500 relative" />
            </div>
            <p className="text-xl tracking-wider font-light mb-2">No drones found</p>
            <p className="text-sm text-gray-500">Create a new drone to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDrones.map(drone => (
              <div 
                key={drone.id}
                className="rounded-lg border border-gray-800 bg-gradient-to-b from-gray-900/80 to-black/80 hover:from-gray-900 hover:to-black/90 transition-all duration-300 overflow-hidden backdrop-blur-sm p-5"
              >
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border border-blue-500/30 flex items-center justify-center">
                      <Drone className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="font-medium tracking-wider text-white">{drone.id}</div>
                  </div>
                  <div className={`text-xs px-3 py-1.5 rounded-full border font-medium tracking-wider ${getStatusStyles(drone.status)}`}>
                    {drone.status}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                    <div className="text-xs text-gray-400 mb-1 tracking-wider">MODEL</div>
                    <div className="text-sm text-white">{drone.model}</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                    <div className="text-xs text-gray-400 mb-1 tracking-wider">REGION</div>
                    <div className="text-sm text-white">
                      {drone.regionId 
                        ? regions.find(r => r.id === drone.regionId)?.name || 'Unknown' 
                        : 'Unassigned'}
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <button
                    className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-blue-300 rounded-lg border border-blue-500/30 hover:from-blue-500/30 hover:to-indigo-500/30 transition-all text-sm tracking-wider font-light"
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Main Render
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
              <span className="text-gray-400">Total Users:</span> <span className="text-blue-300 font-light">{users.length}</span>
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

        {/* Enhanced Tabs */}
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
            {/* User Lists (Regional Commanders and Operators) */}
            {(activeTab === UserManagementTab.REGIONAL_COMMANDERS || activeTab === UserManagementTab.OPERATORS) && 
              renderUserLists()
            }
            
            {/* Create User Form */}
            {activeTab === UserManagementTab.CREATE_USER && renderCreateUserForm()}
            
            {/* Manage Drones */}
            {activeTab === UserManagementTab.MANAGE_DRONES && renderDroneManagement()}
            
            {/* Create Drone Form (simplified) */}
            {activeTab === UserManagementTab.CREATE_DRONE && (
              <div className="p-6">
                <div className="bg-gradient-to-b from-gray-900/80 to-black/80 rounded-lg border border-gray-800 p-6 backdrop-blur-sm">
                  <h3 className="text-xl font-light tracking-wider mb-6 flex items-center gap-3 text-blue-300">
                    <Drone className="h-6 w-6 text-blue-400" />
                    Create New Drone
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-400 tracking-wider">DRONE ID*</label>
                      <input
                        type="text"
                        name="id"
                        value={droneFormState.id}
                        onChange={handleDroneFormChange}
                        className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg px-4 py-3 text-white w-full border border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all backdrop-blur-sm"
                        placeholder="Enter drone ID"
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-400 tracking-wider">MODEL*</label>
                      <select
                        name="model"
                        value={droneFormState.model}
                        onChange={handleDroneFormChange}
                        className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg px-4 py-3 text-white w-full border border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all backdrop-blur-sm"
                        required
                      >
                        <option value="FlyOS-MQ5">FlyOS-MQ5</option>
                        <option value="FlyOS-MQ7">FlyOS-MQ7</option>
                        <option value="FlyOS-MQ9">FlyOS-MQ9</option>
                      </select>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-400 tracking-wider">STATUS</label>
                      <select
                        name="status"
                        value={droneFormState.status}
                        onChange={handleDroneFormChange}
                        className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg px-4 py-3 text-white w-full border border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all backdrop-blur-sm"
                      >
                        <option value="STANDBY">Standby</option>
                        <option value="ACTIVE">Active</option>
                        <option value="MAINTENANCE">Maintenance</option>
                        <option value="OFFLINE">Offline</option>
                      </select>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-400 tracking-wider">REGION</label>
                      <select
                        name="regionId"
                        value={droneFormState.regionId || ""}
                        onChange={handleDroneFormChange}
                        className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg px-4 py-3 text-white w-full border border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all backdrop-blur-sm"
                      >
                        <option value="">Unassigned</option>
                        {regions.filter(r => r.status === 'ACTIVE').map(region => (
                          <option key={region.id} value={region.id}>{region.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-4 mt-8 pt-4 border-t border-gray-800">
                    <button
                      onClick={() => setActiveTab(UserManagementTab.MANAGE_DRONES)}
                      className="px-6 py-3 bg-gradient-to-r from-gray-700 to-gray-800 text-white rounded-lg border border-gray-600 hover:from-gray-600 hover:to-gray-700 transition-all tracking-wider font-light"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={isLoading}
                      className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed tracking-wider font-light"
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
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default UserManagement;
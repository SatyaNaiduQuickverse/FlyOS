// components/UserManagement/types.ts - Updated with Region Management Types
import { UserRole } from '../../types/auth';

export interface User {
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

export interface Region {
  id: string;
  name: string;
  commanderName?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  area: string;
}

export interface Drone {
  id: string;
  model: string;
  status: 'ACTIVE' | 'MAINTENANCE' | 'OFFLINE' | 'STANDBY';
  regionId: string | null;
  operatorId: string | null;
}

export interface Notification {
  message: string;
  type: 'success' | 'error';
}

export enum UserManagementTab {
  REGIONAL_COMMANDERS = 'regional-commanders',
  OPERATORS = 'operators',
  CREATE_USER = 'create-user',
  MANAGE_DRONES = 'manage-drones',
  CREATE_DRONE = 'create-drone',
  MANAGE_REGIONS = 'manage-regions',
  CREATE_REGION = 'create-region',
}

export interface FormState {
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

export interface DroneFormState {
  id: string;
  model: string;
  status: 'ACTIVE' | 'MAINTENANCE' | 'OFFLINE' | 'STANDBY';
  regionId: string | null;
  operatorId: string | null;
}

export interface RegionFormState {
  id: string;
  name: string;
  area: string;
  commanderName: string;
  status: 'ACTIVE' | 'INACTIVE';
}

// Props interfaces for components
export interface UserListProps {
  users: User[];
  regions: Region[];
  drones: Drone[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  showInactive: boolean;
  setShowInactive: (show: boolean) => void;
  onEditUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
  setActiveTab: (tab: UserManagementTab) => void;
}

export interface CreateUserFormProps {
  editingUser: User | null;
  regions: Region[];
  onCreateUser: (userData: any) => void;
  onUpdateUser: (userData: any) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export interface DroneManagementProps {
  drones: Drone[];
  users: User[];
  regions: Region[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  setActiveTab: (tab: UserManagementTab) => void;
}

export interface CreateDroneFormProps {
  regions: Region[];
  users: User[];
  onCreateDrone: (droneData: any) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export interface RegionManagementProps {
  regions: Region[];
  users: User[];
  drones: Drone[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onEditRegion: (region: Region) => void;
  onDeleteRegion: (regionId: string) => void;
  setActiveTab: (tab: UserManagementTab) => void;
}

export interface CreateRegionFormProps {
  editingRegion: Region | null;
  users: User[];
  onCreateRegion: (regionData: any) => void;
  onUpdateRegion: (regionData: any) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export interface UserManagementTabsProps {
  activeTab: UserManagementTab;
  setActiveTab: (tab: UserManagementTab) => void;
  editingUser: User | null;
  editingRegion: Region | null;
}
// components/UserManagement/mockData.ts - Mock Data for Development
import { UserRole } from '../../types/auth';
import { User, Region, Drone } from './types';

export const MOCK_REGIONS: Region[] = [
  { 
    id: 'east', 
    name: 'Eastern Region', 
    commanderName: 'Col. Sarah Mitchell', 
    status: 'ACTIVE', 
    area: 'Eastern Seaboard' 
  },
  { 
    id: 'west', 
    name: 'Western Region', 
    commanderName: 'Maj. David Chen', 
    status: 'ACTIVE', 
    area: 'Pacific Coast' 
  },
  { 
    id: 'north', 
    name: 'Northern Region', 
    commanderName: 'Lt. Col. James Wilson', 
    status: 'INACTIVE', 
    area: 'Great Lakes' 
  },
  { 
    id: 'south', 
    name: 'Southern Region', 
    commanderName: 'Col. Robert Garcia', 
    status: 'ACTIVE', 
    area: 'Gulf Coast' 
  },
];

export const MOCK_USERS: User[] = [
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

export const MOCK_DRONES: Drone[] = [
  { 
    id: 'drone-001', 
    model: 'FlyOS-MQ5', 
    status: 'ACTIVE', 
    regionId: 'east', 
    operatorId: 'user-003' 
  },
  { 
    id: 'drone-002', 
    model: 'FlyOS-MQ5', 
    status: 'ACTIVE', 
    regionId: 'east', 
    operatorId: 'user-004' 
  },
  { 
    id: 'drone-003', 
    model: 'FlyOS-MQ7', 
    status: 'MAINTENANCE', 
    regionId: 'west', 
    operatorId: 'user-005' 
  },
  { 
    id: 'drone-004', 
    model: 'FlyOS-MQ7', 
    status: 'ACTIVE', 
    regionId: 'west', 
    operatorId: 'user-005' 
  },
  { 
    id: 'drone-005', 
    model: 'FlyOS-MQ9', 
    status: 'ACTIVE', 
    regionId: 'south', 
    operatorId: 'user-007' 
  },
  { 
    id: 'drone-006', 
    model: 'FlyOS-MQ9', 
    status: 'OFFLINE', 
    regionId: null, 
    operatorId: null 
  },
  { 
    id: 'drone-007', 
    model: 'FlyOS-MQ5', 
    status: 'STANDBY', 
    regionId: null, 
    operatorId: null 
  },
  { 
    id: 'drone-008', 
    model: 'FlyOS-MQ7', 
    status: 'ACTIVE', 
    regionId: 'south', 
    operatorId: 'user-007' 
  },
];

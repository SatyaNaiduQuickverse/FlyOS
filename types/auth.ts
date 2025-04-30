// types/auth.ts

/**
 * Enum representing the different user roles in the drone control system
 */
export enum UserRole {
  MAIN_HQ = 'MAIN_HQ',           // Central command with full access
  REGIONAL_HQ = 'REGIONAL_HQ',    // Regional command with limited access
  OPERATOR = 'OPERATOR'          // Field operator with minimal access
}

/**
 * Interface for user data structure
 */
export interface User {
  id: string;
  username: string;
  role: UserRole;
  // For Regional HQ users, specify which region they have access to
  regionId?: string;
  // Additional user metadata
  fullName: string;
  email: string;
  profileImage?: string;
}

/**
 * Type for token payload when creating JWT
 */
export interface TokenPayload {
  id: string;
  username: string;
  role: UserRole;
  regionId?: string;
}

/**
 * Permission structure - defines what each role can do
 */
export const PERMISSIONS = {
  [UserRole.MAIN_HQ]: {
    canAccessMainHQ: true,
    canAccessRegionalHQ: true,
    canAccessOperatorDashboard: true,
    canAddRemoveDrones: true,
    canAssignDronesToRegions: true,
    canViewAllRegions: true,
    canTakeControlOfAnyDrone: true,
  },
  [UserRole.REGIONAL_HQ]: {
    canAccessMainHQ: false,
    canAccessRegionalHQ: true,
    canAccessOperatorDashboard: true,
    canAddRemoveDrones: false,
    canAssignDronesToRegions: false,
    canViewAllRegions: false,
    canTakeControlOfRegionalDrones: true,
  },
  [UserRole.OPERATOR]: {
    canAccessMainHQ: false,
    canAccessRegionalHQ: false,
    canAccessOperatorDashboard: true,
    canAddRemoveDrones: false,
    canAssignDronesToRegions: false,
    canViewAllRegions: false,
    canOperateAssignedDrones: true,
  },
};

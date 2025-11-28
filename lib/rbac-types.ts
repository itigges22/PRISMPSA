/**
 * Shared RBAC Types
 * 
 * This file contains shared types used across the RBAC system
 * to avoid circular dependencies between rbac.ts and permissions.ts
 */

import { Database } from './supabase';

// Database types
export type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
export type Role = Database['public']['Tables']['roles']['Row'];
export type UserRole = Database['public']['Tables']['user_roles']['Row'];
export type Department = Database['public']['Tables']['departments']['Row'];

// Extended user profile with roles
export interface UserWithRoles extends UserProfile {
  user_roles: Array<
    UserRole & {
      roles: Role & {
        departments: Department | null;
      };
    }
  >;
}

// Permission context for context-aware checks
export interface PermissionContext {
  userId?: string;
  departmentId?: string;
  accountId?: string;
  projectId?: string;
  taskId?: string;
  deliverableId?: string;
}


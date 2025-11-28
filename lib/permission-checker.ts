/**
 * Permission Checker - Hybrid RBAC Approach
 *
 * This module implements a hybrid permission checking system:
 * 1. Base Permissions: User must have the permission in their role
 * 2. Context Awareness: Check if user is assigned to the resource
 * 3. Override Permissions: Allow access regardless of assignment
 *
 * Example: User wants to edit Project X
 * - Check: Does user have EDIT_PROJECT permission? (base)
 * - Check: Is user assigned to Project X? (context)
 * - OR Check: Does user have EDIT_ALL_PROJECTS? (override)
 *
 * IMPORTANT: Server-side code (API routes) MUST pass an authenticated SupabaseClient
 * to ensure proper RLS context. Client-side code can omit the parameter.
 */

import { createClientSupabase } from './supabase';
import { UserWithRoles, PermissionContext } from './rbac-types';
import { Permission } from './permissions';
import { logger, permissionCheck } from './debug-logger';
import type { SupabaseClient } from '@supabase/supabase-js';

// Cache for permission checks (expires after 5 minutes)
interface CacheEntry {
  result: boolean;
  timestamp: number;
}

const permissionCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Clear expired cache entries
 */
function clearExpiredCache() {
  const now = Date.now();
  for (const [key, entry] of permissionCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      permissionCache.delete(key);
    }
  }
}

/**
 * Generate cache key for permission check
 */
function getCacheKey(userId: string, permission: Permission, context?: PermissionContext): string {
  const contextStr = context ? JSON.stringify(context) : '';
  return `${userId}:${permission}:${contextStr}`;
}

/**
 * Check if user is superadmin (bypasses all permission checks)
 */
export function isSuperadmin(userProfile: UserWithRoles | null): boolean {
  if (!userProfile) return false;
  
  // Check is_superadmin flag
  if (userProfile.is_superadmin) return true;
  
  // Check if user has Superadmin role
  if (!userProfile.user_roles || !Array.isArray(userProfile.user_roles)) return false;
  
  return userProfile.user_roles.some(ur => {
    const roleName = ur.roles?.name?.toLowerCase();
    return roleName === 'superadmin' || ur.roles?.is_system_role === true && roleName === 'superadmin';
  });
}

/**
 * Check if user is assigned to a specific project (via project assignment, task assignment, or direct project fields)
 * @param userId - User ID to check
 * @param projectId - Project ID to check
 * @param supabaseClient - Optional authenticated Supabase client (REQUIRED for server-side, optional for client-side)
 */
export async function isAssignedToProject(userId: string, projectId: string, supabaseClient?: SupabaseClient): Promise<boolean> {
  const supabase = supabaseClient || createClientSupabase();
  if (!supabase) return false;

  // First check the project itself - if user is creator or assigned user, they have access
  const { data: project, error: projectFetchError } = await supabase
    .from('projects')
    .select('created_by, assigned_user_id')
    .eq('id', projectId)
    .single();

  if (project) {
    // User is the creator of the project
    if (project.created_by === userId) {
      return true;
    }
    // User is the assigned user on the project
    if (project.assigned_user_id === userId) {
      return true;
    }
  }

  if (projectFetchError && projectFetchError.code !== 'PGRST116') {
    logger.error('Error fetching project for assignment check', { userId, projectId }, projectFetchError);
  }

  // Check project assignments table
  const { data: projectAssignment, error: projectError } = await supabase
    .from('project_assignments')
    .select('id')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .is('removed_at', null)
    .single();

  if (projectAssignment) {
    return true;
  }

  if (projectError && projectError.code !== 'PGRST116') { // PGRST116 = no rows
    logger.error('Error checking project assignment', { userId, projectId }, projectError);
  }

  // Check task assignments (if user is assigned to any task in this project, they have access)
  const { data: taskAssignment, error: taskError } = await supabase
    .from('tasks')
    .select('id')
    .eq('assigned_to', userId)
    .eq('project_id', projectId)
    .limit(1);

  if (taskError && taskError.code !== 'PGRST116') {
    logger.error('Error checking task assignment for project access', { userId, projectId }, taskError);
  }

  return (taskAssignment?.length || 0) > 0;
}

/**
 * Check if user manages a department (has role in that department)
 * @param userProfile - User profile with roles
 * @param departmentId - Department ID to check
 * @param supabaseClient - Optional authenticated Supabase client (not used in this function but kept for consistency)
 */
export async function managesDepartment(userProfile: UserWithRoles | null, departmentId: string, supabaseClient?: SupabaseClient): Promise<boolean> {
  if (!userProfile?.user_roles) return false;

  return userProfile.user_roles.some(ur => ur.roles?.department_id === departmentId);
}

/**
 * Get all projects in an account
 * @param accountId - Account ID
 * @param supabaseClient - Optional authenticated Supabase client
 */
async function getAccountProjects(accountId: string, supabaseClient?: SupabaseClient): Promise<string[]> {
  const supabase = supabaseClient || createClientSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('projects')
    .select('id')
    .eq('account_id', accountId);

  if (error) {
    logger.error('Error fetching account projects', { accountId }, error);
    return [];
  }

  return data?.map((p: { id: string }) => p.id) || [];
}

/**
 * Check if user has access to an account (assigned to any project in that account OR assigned to any task in projects)
 * @param userId - User ID to check
 * @param accountId - Account ID to check
 * @param supabaseClient - Optional authenticated Supabase client (REQUIRED for server-side, optional for client-side)
 */
export async function hasAccountAccess(userId: string, accountId: string, supabaseClient?: SupabaseClient): Promise<boolean> {
  const supabase = supabaseClient || createClientSupabase();
  if (!supabase) return false;

  // Check if user is a member of the account
  const { data: memberData, error: memberError } = await supabase
    .from('account_members')
    .select('id')
    .eq('user_id', userId)
    .eq('account_id', accountId)
    .limit(1);

  if (memberData && memberData.length > 0) {
    return true;
  }

  // Check if user is the account manager
  const { data: accountData, error: accountError } = await supabase
    .from('accounts')
    .select('id')
    .eq('id', accountId)
    .eq('account_manager_id', userId)
    .limit(1);

  if (accountData && accountData.length > 0) {
    return true;
  }

  const projectIds = await getAccountProjects(accountId, supabase);

  if (projectIds.length === 0) return false;

  // Check project assignments
  const { data: projectAssignments, error: projectError } = await supabase
    .from('project_assignments')
    .select('id')
    .eq('user_id', userId)
    .in('project_id', projectIds)
    .is('removed_at', null)
    .limit(1);

  if (projectAssignments && projectAssignments.length > 0) {
    return true;
  }

  // Check task assignments (if user is assigned to a task, they get access to the project and account)
  const { data: taskAssignments, error: taskError } = await supabase
    .from('tasks')
    .select('id')
    .eq('assigned_to', userId)
    .in('project_id', projectIds)
    .limit(1);

  if (taskError) {
    logger.error('Error checking task assignments for account access', { userId, accountId }, taskError);
  }

  return (taskAssignments?.length || 0) > 0;
}

/**
 * Check if user has a base permission in any of their roles
 * @param userProfile - User profile with roles
 * @param permission - Permission to check
 * @param supabaseClient - Optional authenticated Supabase client
 */
async function hasBasePermission(userProfile: UserWithRoles | null, permission: Permission, supabaseClient?: SupabaseClient): Promise<boolean> {
  if (!userProfile?.user_roles || userProfile.user_roles.length === 0) {
    logger.debug('No user roles found', { userId: userProfile?.id, permission });
    return false;
  }

  // First, check permissions from already-loaded roles in userProfile
  // This is more efficient and ensures we're checking the actual permissions
  for (const userRole of userProfile.user_roles) {
    const role = userRole.roles;
    if (!role) continue;
    
    // Check if permissions are already loaded in the role object
    if (role.permissions) {
      const permissions = role.permissions as Record<string, boolean> || {};
      if (permissions[permission] === true) {
        logger.debug('Permission found in loaded role', { 
          userId: userProfile.id, 
          permission, 
          roleName: role.name 
        });
        return true;
      }
    }
  }

  // If permissions weren't loaded, fetch from database as fallback
  const roleIds = userProfile.user_roles.map(ur => ur.role_id).filter(Boolean);
  if (roleIds.length === 0) {
    logger.debug('No valid role IDs found', { userId: userProfile.id, permission });
    return false;
  }

  const supabase = supabaseClient || createClientSupabase();
  if (!supabase) {
    logger.error('Supabase client not available', { userId: userProfile.id, permission });
    return false;
  }

  const { data: roles, error } = await supabase
    .from('roles')
    .select('permissions')
    .in('id', roleIds);

  if (error) {
    logger.error('Error fetching role permissions', { userId: userProfile.id }, error);
    return false;
  }

  // Check if any role has the permission
  const hasPermission = roles?.some((role: { permissions: Record<string, boolean> | null }) => {
    const permissions = role.permissions as Record<string, boolean> || {};
    return permissions[permission] === true;
  }) || false;

  logger.debug('Permission check result from database', { 
    userId: userProfile.id, 
    permission, 
    hasPermission,
    roleCount: roles?.length || 0
  });

  return hasPermission;
}

/**
 * Main permission checker with hybrid approach
 *
 * @param userProfile - User profile with roles
 * @param permission - Permission to check
 * @param context - Optional context (project, account, department, etc.)
 * @param supabaseClient - Optional authenticated Supabase client (REQUIRED for server-side API routes, optional for client-side)
 * @returns Promise<boolean> - True if user has permission
 *
 * IMPORTANT: Server-side code (API routes) MUST pass the authenticated SupabaseClient as the 4th parameter.
 * Without it, RLS policies will see the request as unauthenticated and deny access to data,
 * causing permission checks to fail incorrectly.
 */
export async function checkPermissionHybrid(
  userProfile: UserWithRoles | null,
  permission: Permission,
  context?: PermissionContext,
  supabaseClient?: SupabaseClient
): Promise<boolean> {
  const startTime = Date.now();

  try {
    // 1. Null check
    if (!userProfile) {
      logger.debug('No user profile provided', { permission });
      return false;
    }

    // 2. Superadmin bypass
    if (isSuperadmin(userProfile)) {
      permissionCheck(permission, userProfile.id, true, { reason: 'superadmin', duration: Date.now() - startTime });
      return true;
    }

    // 3. Check cache
    clearExpiredCache();
    const cacheKey = getCacheKey(userProfile.id, permission, context);
    const cached = permissionCache.get(cacheKey);
    if (cached) {
      permissionCheck(permission, userProfile.id, cached.result, { cached: true, duration: Date.now() - startTime });
      return cached.result;
    }

    // 4. Check base permission
    // EXCEPTION: For VIEW_PROJECTS or VIEW_ACCOUNTS with account context, allow account-level access even without base permission
    // (Users can view projects/accounts they have access to, even if they don't have general VIEW_PROJECTS/VIEW_ACCOUNTS permission)
    const isViewProjectsWithAccount = permission === Permission.VIEW_PROJECTS && context?.accountId;
    const isViewAccountsWithAccount = permission === Permission.VIEW_ACCOUNTS && context?.accountId;

    let hasBase = await hasBasePermission(userProfile, permission, supabaseClient);

    // If checking VIEW_PROJECTS or VIEW_ACCOUNTS with account context and no base permission, check account access instead
    if (!hasBase && (isViewProjectsWithAccount || isViewAccountsWithAccount) && context.accountId) {
      const accountAccess = await hasAccountAccess(userProfile.id, context.accountId, supabaseClient);
      if (accountAccess) {
        // User has account access, treat as having base permission for this check
        hasBase = true;
      }
    }
    
    if (!hasBase) {
      // No base permission = no access
      const duration = Date.now() - startTime;
      permissionCache.set(cacheKey, { result: false, timestamp: Date.now() });
      permissionCheck(permission, userProfile.id, false, { reason: 'no_base_permission', duration });
      return false;
    }

    // 5. If no context provided, base permission is sufficient
    if (!context || Object.keys(context).length === 0) {
      const duration = Date.now() - startTime;
      permissionCache.set(cacheKey, { result: true, timestamp: Date.now() });
      permissionCheck(permission, userProfile.id, true, { reason: 'base_permission', duration });
      return true;
    }

    // 6. Context-aware checks
    let hasAccess = false;

    // Check for override permissions first (they bypass context checks)
    const overridePermissions: Record<Permission, Permission[]> = {
      [Permission.VIEW_PROJECTS]: [Permission.VIEW_ALL_PROJECTS],
      [Permission.EDIT_PROJECT]: [Permission.EDIT_ALL_PROJECTS],
      [Permission.DELETE_PROJECT]: [Permission.DELETE_ALL_PROJECTS],
      [Permission.VIEW_DEPARTMENTS]: [Permission.VIEW_ALL_DEPARTMENTS],
      [Permission.EDIT_DEPARTMENT]: [Permission.VIEW_ALL_DEPARTMENTS], // VIEW_ALL_DEPARTMENTS allows editing any department
      [Permission.DELETE_DEPARTMENT]: [Permission.VIEW_ALL_DEPARTMENTS], // VIEW_ALL_DEPARTMENTS allows deleting any department
      [Permission.VIEW_ACCOUNTS]: [Permission.VIEW_ALL_ACCOUNTS],
      [Permission.EDIT_ACCOUNT]: [Permission.VIEW_ALL_ACCOUNTS], // VIEW_ALL_ACCOUNTS allows editing any account
      [Permission.DELETE_ACCOUNT]: [Permission.VIEW_ALL_ACCOUNTS], // VIEW_ALL_ACCOUNTS allows deleting any account
      [Permission.VIEW_ANALYTICS]: [Permission.VIEW_ALL_ANALYTICS],
    } as any;

    const overrides = overridePermissions[permission] || [];
    for (const override of overrides) {
      if (await hasBasePermission(userProfile, override, supabaseClient)) {
        hasAccess = true;
        break;
      }
    }

    // If override permission granted access, we're done
    if (hasAccess) {
      const duration = Date.now() - startTime;
      permissionCache.set(cacheKey, { result: true, timestamp: Date.now() });
      permissionCheck(permission, userProfile.id, true, { reason: 'override_permission', duration });
      return true;
    }

    // 7. Check context-specific access
    // For account-level permissions (EDIT_ACCOUNT, DELETE_ACCOUNT), base permission means you can edit/delete ANY account
    // For department-level permissions (EDIT_DEPARTMENT, DELETE_DEPARTMENT), base permission means you can edit/delete ANY department
    // Context.accountId/departmentId is only used for filtering VIEW_ACCOUNTS/VIEW_DEPARTMENTS when user doesn't have override
    const isAccountEditPermission = permission === Permission.EDIT_ACCOUNT || permission === Permission.DELETE_ACCOUNT;
    const isDepartmentEditPermission = permission === Permission.EDIT_DEPARTMENT || permission === Permission.DELETE_DEPARTMENT;
    
    if (isAccountEditPermission && context?.accountId) {
      // If user has base EDIT_ACCOUNT or DELETE_ACCOUNT permission, they can edit/delete any account
      // No need to check account access - base permission is sufficient
      hasAccess = true;
    } else if (isDepartmentEditPermission && context?.departmentId) {
      // If user has base EDIT_DEPARTMENT or DELETE_DEPARTMENT permission, they can edit/delete any department
      // No need to check department assignment - base permission is sufficient
      hasAccess = true;
    } else if (context.projectId) {
      // For workflow permissions (EXECUTE_WORKFLOWS, SKIP_WORKFLOW_NODES), base permission is sufficient
      // These are actions that can be performed on any workflow, regardless of project assignment
      const isWorkflowPermission = permission === Permission.EXECUTE_WORKFLOWS || permission === Permission.SKIP_WORKFLOW_NODES;

      if (isWorkflowPermission) {
        // Workflow permissions only require base permission, not project assignment
        hasAccess = true;
      } else {
        // Check if user is assigned to this project
        // If they're assigned, they can view it (base permission already checked above)
        hasAccess = await isAssignedToProject(userProfile.id, context.projectId, supabaseClient);

        // If not directly assigned to this project, check if they have account-level access
        // Users with account access can view projects in that account
        if (!hasAccess && context.accountId) {
          const accountAccess = await hasAccountAccess(userProfile.id, context.accountId, supabaseClient);
          if (accountAccess) {
            // Double-check this project is in the account they have access to
            const supabase = supabaseClient || createClientSupabase();
            if (supabase) {
              const { data: project } = await supabase
                .from('projects')
                .select('account_id')
                .eq('id', context.projectId)
                .single();
              if (project && project.account_id === context.accountId) {
                hasAccess = true;
              }
            }
          }
        }
      }
    }

    if (context.accountId && !context.projectId && !isAccountEditPermission) {
      // Check if user has access to any project in this account
      // Only applies to VIEW_ACCOUNTS and other non-edit permissions
      hasAccess = await hasAccountAccess(userProfile.id, context.accountId, supabaseClient);
    }

    if (context.departmentId && !isDepartmentEditPermission) {
      // Check if user has a role in this department
      // Only applies to VIEW_DEPARTMENTS and other non-edit permissions
      // If user has VIEW_ALL_DEPARTMENTS override, this check is bypassed above
      hasAccess = await managesDepartment(userProfile, context.departmentId, supabaseClient);
    }

    // 8. Cache and return result
    const duration = Date.now() - startTime;
    permissionCache.set(cacheKey, { result: hasAccess, timestamp: Date.now() });
    permissionCheck(permission, userProfile.id, hasAccess, { 
      reason: hasAccess ? 'context_match' : 'no_context_match',
      context,
      duration 
    });

    return hasAccess;

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Exception in checkPermissionHybrid', {
      permission,
      userId: userProfile?.id,
      context,
      duration
    }, error as Error);
    return false;
  }
}

/**
 * Check multiple permissions at once (returns true if user has ANY of them)
 */
export async function checkAnyPermission(
  userProfile: UserWithRoles | null,
  permissions: Permission[],
  context?: PermissionContext,
  supabaseClient?: SupabaseClient
): Promise<boolean> {
  for (const permission of permissions) {
    if (await checkPermissionHybrid(userProfile, permission, context, supabaseClient)) {
      return true;
    }
  }
  return false;
}

/**
 * Check multiple permissions at once (returns true only if user has ALL of them)
 */
export async function checkAllPermissions(
  userProfile: UserWithRoles | null,
  permissions: Permission[],
  context?: PermissionContext,
  supabaseClient?: SupabaseClient
): Promise<boolean> {
  for (const permission of permissions) {
    if (!(await checkPermissionHybrid(userProfile, permission, context, supabaseClient))) {
      return false;
    }
  }
  return true;
}

/**
 * Get all permissions a user has (useful for UI rendering)
 * @param userProfile - User profile with roles
 * @param supabaseClient - Optional authenticated Supabase client
 */
export async function getUserPermissions(userProfile: UserWithRoles | null, supabaseClient?: SupabaseClient): Promise<Permission[]> {
  if (!userProfile) return [];

  // Superadmin has all permissions
  if (isSuperadmin(userProfile)) {
    return Object.values(Permission);
  }

  if (!userProfile.user_roles || userProfile.user_roles.length === 0) {
    return [];
  }

  const roleIds = userProfile.user_roles.map(ur => ur.role_id).filter(Boolean);
  if (roleIds.length === 0) return [];

  const supabase = supabaseClient || createClientSupabase();
  if (!supabase) return [];

  const { data: roles, error } = await supabase
    .from('roles')
    .select('permissions')
    .in('id', roleIds);

  if (error || !roles) return [];

  const permissionsSet = new Set<Permission>();
  
  roles.forEach((role: { permissions: Record<string, boolean> | null }) => {
    const permissions = role.permissions as Record<string, boolean> || {};
    Object.entries(permissions).forEach(([perm, enabled]: [string, boolean]) => {
      if (enabled && Object.values(Permission).includes(perm as Permission)) {
        permissionsSet.add(perm as Permission);
      }
    });
  });

  return Array.from(permissionsSet);
}

/**
 * Clear the permission cache (useful after role changes)
 */
export function clearPermissionCache(userId?: string) {
  if (userId) {
    // Clear cache for specific user
    for (const key of permissionCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        permissionCache.delete(key);
      }
    }
  } else {
    // Clear entire cache
    permissionCache.clear();
  }
}

// Export hasPermission as an alias for checkPermissionHybrid for backward compatibility
export const hasPermission = checkPermissionHybrid;

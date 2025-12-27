/**
 * Permission Checker - Hybrid RBAC Approach
 *
 * This module implements a hybrid permission checking system:
 * 1. Base Permissions: User must have the permission in their role
 * 2. Context Awareness: Check if user is assigned to the resource
 * 3. Override Permissions: Allow access regardless of assignment
 *
 * Example: User wants to edit Project X
 * - Check: Does user have MANAGE_PROJECTS permission? (base)
 * - Check: Is user assigned to Project X? (context)
 * - OR Check: Does user have MANAGE_ALL_PROJECTS? (override)
 *
 * IMPORTANT: Server-side code (API routes) MUST pass an authenticated SupabaseClient
 * to ensure proper RLS context. Client-side code can omit the parameter.
 */

import { createClientSupabase } from './supabase';
import { UserWithRoles, PermissionContext } from './rbac-types';
import { Permission } from './permissions';
import { logger, permissionCheck } from './debug-logger';


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
  if ((userProfile as any).is_superadmin) return true;
  
  // Check if user has Superadmin role
  if (!userProfile.user_roles || !Array.isArray(userProfile.user_roles)) return false;
  
  return userProfile.user_roles.some((ur: any) => {
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
export async function isAssignedToProject(userId: string, projectId: string, supabaseClient?: any): Promise<boolean> {
  const supabase = supabaseClient || createClientSupabase() as any;
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
export async function managesDepartment(userProfile: UserWithRoles | null, departmentId: string, _supabaseClient?: any): Promise<boolean> {
  if (!userProfile?.user_roles) return false;

  return userProfile.user_roles.some((ur: any) => ur.roles?.department_id === departmentId);
}

/**
 * Get all projects in an account
 * @param accountId - Account ID
 * @param supabaseClient - Optional authenticated Supabase client
 */
async function getAccountProjects(accountId: string, supabaseClient?: any): Promise<string[]> {
  const supabase = supabaseClient || createClientSupabase() as any;
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
export async function hasAccountAccess(userId: string, accountId: string, supabaseClient?: any): Promise<boolean> {
  const supabase = supabaseClient || createClientSupabase() as any;
  if (!supabase) return false;

  // Check if user is a member of the account
  const { data: memberData, error: _memberError } = await supabase
    .from('account_members')
    .select('id')
    .eq('user_id', userId)
    .eq('account_id', accountId)
    .limit(1);

  if (memberData && memberData.length > 0) {
    return true;
  }

  // Check if user is the account manager
  const { data: accountData, error: _accountError } = await supabase
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
  const { data: projectAssignments, error: _projectError } = await supabase
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
 * Check if user is assigned to a workflow instance's current node
 * @param userProfile - User profile with roles
 * @param workflowInstanceId - Workflow instance ID to check
 * @param supabaseClient - Optional authenticated Supabase client
 */
export async function isAssignedToWorkflowNode(
  userProfile: UserWithRoles | null,
  workflowInstanceId: string,
  supabaseClient?: any
): Promise<boolean> {
  if (!userProfile) return false;

  const supabase = supabaseClient || createClientSupabase() as any;
  if (!supabase) return false;

  // Get the workflow instance and current node
  const { data: instance, error: instanceError } = await supabase
    .from('workflow_instances')
    .select(`
      current_node_id,
      workflow_nodes!workflow_instances_current_node_id_fkey(
        id,
        node_type,
        entity_id
      )
    `)
    .eq('id', workflowInstanceId)
    .single();

  if (instanceError || !instance || !instance.workflow_nodes) {
    logger.error('Error fetching workflow instance for node assignment check', { workflowInstanceId }, instanceError);
    return false;
  }

  const currentNode = instance.workflow_nodes as {
    id: string;
    node_type: string;
    entity_id: string | null;
  };

  // Check if user is directly assigned to this specific workflow node
  const { data: nodeAssignment, error: _assignmentError } = await supabase
    .from('workflow_active_steps')
    .select('id')
    .eq('workflow_instance_id', workflowInstanceId)
    .eq('node_id', currentNode.id)
    .eq('assigned_user_id', (userProfile as any).id)
    .eq('status', 'active')
    .limit(1);

  if (nodeAssignment && nodeAssignment.length > 0) {
    return true;
  }

  // Check based on node type
  if (currentNode.node_type === 'department' && currentNode.entity_id) {
    // Check if user belongs to this department
    return await managesDepartment(userProfile, currentNode.entity_id, supabase);
  }

  if (currentNode.node_type === 'role' && currentNode.entity_id) {
    // Check if user has this role
    if (!userProfile.user_roles) return false;
    return userProfile.user_roles.some((ur: any) => ur.role_id === currentNode.entity_id);
  }

  // For other node types (start, end, form, approval, conditional, sync),
  // assignment is handled via workflow_active_steps table
  return false;
}

/**
 * Check if user has a base permission in any of their roles (OR logic)
 * Returns TRUE if ANY role has the permission set to TRUE
 * Returns FALSE only if NO roles have the permission set to TRUE
 *
 * @param userProfile - User profile with roles
 * @param permission - Permission to check
 * @param supabaseClient - Optional authenticated Supabase client
 */
async function hasBasePermission(userProfile: UserWithRoles | null, permission: Permission, supabaseClient?: any): Promise<boolean> {
  if (!userProfile?.user_roles || userProfile.user_roles.length === 0) {
    logger.debug('No user roles found', { userId: (userProfile as any)?.id, permission });
    return false;
  }

  // IMPORTANT: Use OR logic across ALL roles
  // If ANY role has permission=true, the user has that permission
  // A permission=false in one role should NOT override permission=true in another role

  let foundPermissionTrue = false;

  // First, check permissions from already-loaded roles in userProfile
  // This is more efficient and ensures we're checking the actual permissions
  for (const userRole of userProfile.user_roles) {
    const role = userRole.roles;
    if (!role) continue;

    // Check if permissions are already loaded in the role object
    if (role.permissions) {
      const permissions = role.permissions as Record<string, boolean> || {};
      // Only check if permission is explicitly true - ignore false and undefined
      if (permissions[permission] === true) {
        logger.debug('Permission found in loaded role (OR logic)', {
          userId: (userProfile as any).id,
          permission,
          roleName: role.name
        });
        foundPermissionTrue = true;
        break; // Found true in at least one role, no need to check more
      }
    }
  }

  if (foundPermissionTrue) {
    return true;
  }

  // If permissions weren't loaded in any role, fetch from database as fallback
  const roleIds = userProfile.user_roles.map((ur: any) => ur.role_id).filter(Boolean);
  if (roleIds.length === 0) {
    logger.debug('No valid role IDs found', { userId: (userProfile as any).id, permission });
    return false;
  }

  const supabase = supabaseClient || createClientSupabase() as any;
  if (!supabase) {
    logger.error('Supabase client not available', { userId: (userProfile as any).id, permission });
    return false;
  }

  const { data: roles, error } = await supabase
    .from('roles')
    .select('id, name, permissions')
    .in('id', roleIds);

  if (error) {
    logger.error('Error fetching role permissions', { userId: (userProfile as any).id }, error);
    return false;
  }

  // Check if ANY role has the permission set to true (OR logic)
  const hasPermission = roles?.some((role: { id: string; name: string; permissions: Record<string, boolean> | null }) => {
    const permissions = role.permissions as Record<string, boolean> || {};
    const permValue = permissions[permission];
    if (permValue === true) {
      logger.debug('Permission found in database role (OR logic)', {
        userId: (userProfile as any).id,
        permission,
        roleName: role.name,
        roleId: role.id
      });
      return true;
    }
    return false;
  }) || false;

  logger.debug('Permission check result from database', {
    userId: (userProfile as any).id,
    permission,
    hasPermission,
    roleCount: roles?.length || 0,
    roleNames: roles?.map((r: { name: string }) => r.name).join(', ')
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
  supabaseClient?: any
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
      permissionCheck(permission, (userProfile as any).id, true, { reason: 'superadmin', duration: Date.now() - startTime });
      return true;
    }

    // 3. Check cache
    clearExpiredCache();
    const cacheKey = getCacheKey((userProfile as any).id, permission, context);
    const cached = permissionCache.get(cacheKey);
    if (cached) {
      permissionCheck(permission, (userProfile as any).id, cached.result, { cached: true, duration: Date.now() - startTime });
      return cached.result;
    }

    // 4. Define override permissions map (used for both base check fallback and context bypass)
    const overridePermissions: Partial<Record<Permission, Permission[]>> = {
      // Projects
      [Permission.VIEW_PROJECTS]: [Permission.VIEW_ALL_PROJECTS],
      [Permission.MANAGE_PROJECTS]: [Permission.MANAGE_ALL_PROJECTS],

      // Departments
      [Permission.VIEW_DEPARTMENTS]: [Permission.VIEW_ALL_DEPARTMENTS],
      [Permission.MANAGE_DEPARTMENTS]: [Permission.VIEW_ALL_DEPARTMENTS],

      // Accounts
      [Permission.VIEW_ACCOUNTS]: [Permission.VIEW_ALL_ACCOUNTS],
      [Permission.MANAGE_ACCOUNTS]: [Permission.VIEW_ALL_ACCOUNTS],

      // Updates
      [Permission.VIEW_UPDATES]: [Permission.VIEW_ALL_UPDATES],
      [Permission.MANAGE_UPDATES]: [Permission.VIEW_ALL_UPDATES],

      // Time Tracking
      [Permission.VIEW_TIME_ENTRIES]: [Permission.VIEW_ALL_TIME_ENTRIES],
      [Permission.EDIT_TIME_ENTRIES]: [Permission.VIEW_ALL_TIME_ENTRIES],
      [Permission.MANAGE_TIME]: [Permission.VIEW_ALL_TIME_ENTRIES],

      // Workflows
      [Permission.MANAGE_WORKFLOWS]: [Permission.MANAGE_ALL_WORKFLOWS],
      [Permission.EXECUTE_WORKFLOWS]: [Permission.EXECUTE_ANY_WORKFLOW, Permission.MANAGE_ALL_WORKFLOWS],

      // Analytics (three-tier hierarchy: dept → account → org)
      [Permission.VIEW_ALL_DEPARTMENT_ANALYTICS]: [Permission.VIEW_ALL_ACCOUNT_ANALYTICS, Permission.VIEW_ALL_ANALYTICS],
      [Permission.VIEW_ALL_ACCOUNT_ANALYTICS]: [Permission.VIEW_ALL_ANALYTICS],

      // Capacity
      [Permission.VIEW_TEAM_CAPACITY]: [Permission.VIEW_ALL_CAPACITY],
    } as Record<string, unknown>;

    // 5. Check base permission OR override permission
    const hasBase = await hasBasePermission(userProfile, permission, supabaseClient);

    // If no base permission, check for override permissions (e.g., VIEW_ALL_PROJECTS implies VIEW_PROJECTS)
    let hasOverride = false;
    if (!hasBase) {
      const overrides = overridePermissions[permission] || [];
      for (const override of overrides) {
        if (await hasBasePermission(userProfile, override, supabaseClient)) {
          hasOverride = true;
          break;
        }
      }
    }

    // If neither base nor override permission, deny access
    if (!hasBase && !hasOverride) {
      const duration = Date.now() - startTime;
      permissionCache.set(cacheKey, { result: false, timestamp: Date.now() });
      permissionCheck(permission, (userProfile as any).id, false, { reason: 'no_base_permission', duration });
      return false;
    }

    // 6. If override permission, grant access (overrides bypass context checks)
    if (hasOverride) {
      const duration = Date.now() - startTime;
      permissionCache.set(cacheKey, { result: true, timestamp: Date.now() });
      permissionCheck(permission, (userProfile as any).id, true, { reason: 'override_permission', duration });
      return true;
    }

    // 7. If no context provided, base permission is sufficient
    if (!context || Object.keys(context).length === 0) {
      const duration = Date.now() - startTime;
      permissionCache.set(cacheKey, { result: true, timestamp: Date.now() });
      permissionCheck(permission, (userProfile as any).id, true, { reason: 'base_permission', duration });
      return true;
    }

    // 8. Context-aware checks (only reached if user has base permission but no override)
    let hasAccess = false;

    // 9. Check context-specific access (standardized - all permissions require context validation)
    if (context.workflowInstanceId) {
      // Workflow context: Check if user is assigned to current workflow node
      // EXECUTE_WORKFLOWS requires node assignment unless user has override permission
      hasAccess = await isAssignedToWorkflowNode(userProfile, context.workflowInstanceId, supabaseClient);
    } else if (context.projectId) {
      // Project context: Check if user is assigned to this project
      hasAccess = await isAssignedToProject((userProfile as any).id, context.projectId, supabaseClient);

      // If not directly assigned to this project, check if they have account-level access
      // Users with account access can view projects in that account
      if (!hasAccess && context.accountId) {
        const accountAccess = await hasAccountAccess((userProfile as any).id, context.accountId, supabaseClient);
        if (accountAccess) {
          // Double-check this project is in the account they have access to
          const supabase = supabaseClient || createClientSupabase() as any;
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
    } else if (context.accountId) {
      // Account context: Check if user is account manager or member
      hasAccess = await hasAccountAccess((userProfile as any).id, context.accountId, supabaseClient);
    } else if (context.departmentId) {
      // Department context: Check if user has a role in this department
      hasAccess = await managesDepartment(userProfile, context.departmentId, supabaseClient);
    }

    // 8. Cache and return result
    const duration = Date.now() - startTime;
    permissionCache.set(cacheKey, { result: hasAccess, timestamp: Date.now() });
    permissionCheck(permission, (userProfile as any).id, hasAccess, { 
      reason: hasAccess ? 'context_match' : 'no_context_match',
      context,
      duration 
    });

    return hasAccess;

  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    logger.error('Exception in checkPermissionHybrid', {
      permission,
      userId: (userProfile as any)?.id,
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
  supabaseClient?: any
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
  supabaseClient?: any
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
export async function getUserPermissions(userProfile: UserWithRoles | null, supabaseClient?: any): Promise<Permission[]> {
  if (!userProfile) return [];

  // Superadmin has all permissions
  if (isSuperadmin(userProfile)) {
    return Object.values(Permission);
  }

  if (!userProfile.user_roles || userProfile.user_roles.length === 0) {
    return [];
  }

  const roleIds = userProfile.user_roles.map((ur: any) => ur.role_id).filter(Boolean);
  if (roleIds.length === 0) return [];

  const supabase = supabaseClient || createClientSupabase() as any;
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

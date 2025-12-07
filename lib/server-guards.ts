/**
 * Server-Side Guards for API Routes
 * 
 * These guards provide consistent permission checking and error handling
 * for API routes. They throw standard errors that can be caught and
 * converted to appropriate HTTP responses.
 * 
 * Usage in API routes:
 * ```typescript
 * import { requirePermission, requireAuthentication } from '@/lib/server-guards';
 * 
 * export async function POST(request: Request) {
 *   const user = await requireAuthentication();
 *   await requirePermission(user, Permission.CREATE_PROJECT, { accountId });
 *   // ... rest of handler
 * }
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createApiSupabaseClient } from './supabase-server';
import { UserWithRoles } from './rbac';
import { Permission, PermissionContext } from './permissions';
import { checkPermissionHybrid, isSuperadmin } from './permission-checker';
import { logger } from './debug-logger';

// ================================================================================
// CUSTOM ERROR TYPES
// ================================================================================

export class AuthenticationError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class PermissionError extends Error {
  permission?: Permission;
  context?: PermissionContext;
  
  constructor(message: string = 'Insufficient permissions', permission?: Permission, context?: PermissionContext) {
    super(message);
    this.name = 'PermissionError';
    this.permission = permission;
    this.context = context;
  }
}

export class ForbiddenError extends Error {
  constructor(message: string = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

// ================================================================================
// AUTHENTICATION GUARDS
// ================================================================================

/**
 * Require that the user is authenticated
 * Throws AuthenticationError if not authenticated
 * @param request - Optional NextRequest for API routes
 * @returns UserWithRoles profile
 */
export async function requireAuthentication(request?: NextRequest): Promise<UserWithRoles> {
  try {
    let supabase;
    
    // Try to use cookies() from next/headers first (works in Server Components and sometimes Route Handlers)
    // If that fails or if we have a request, fall back to parsing from request
    if (request) {
      // API route - parse cookies from request (cookies() doesn't work in Route Handlers)
      const apiClient = createApiSupabaseClient(request);
      if (!apiClient) {
        throw new AuthenticationError('Supabase not configured');
      }
      supabase = apiClient;
      const cookieHeader = request.headers.get('cookie') || '';
      const allCookies = request.cookies.getAll();
      logger.debug('Using API Supabase client', { 
        hasCookies: allCookies.length > 0,
        cookieCount: allCookies.length,
        cookieNames: allCookies.map((c: { name: string }) => c.name),
        cookieHeaderLength: cookieHeader.length,
        cookieHeaderPreview: cookieHeader.substring(0, 300),
        hasSupabaseCookies: cookieHeader.includes('sb-') || allCookies.some((c: { name: string }) => c.name.startsWith('sb-'))
      });
    } else {
      // Server component - use next/headers cookies
      try {
        supabase = await createServerSupabaseClient();
        logger.debug('Using server component Supabase client');
      } catch (error) {
        // If cookies() fails, it means we're in a Route Handler without request
        logger.error('Failed to create server Supabase client, might be in Route Handler', {}, error as Error);
        throw new AuthenticationError('Authentication failed - Route Handlers must pass request parameter');
      }
    }
    
    if (!supabase) {
      throw new AuthenticationError('Supabase not configured');
    }
    
    // Get current user and session
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    logger.debug('Auth check', {
      hasUser: !!user,
      userId: user?.id,
      hasSession: !!session,
      userError: userError?.message,
      sessionError: sessionError?.message,
      hasAccessToken: !!session?.access_token
    });
    
    if (userError || !user) {
      const cookieHeader = request?.headers.get('cookie') || '';
      const cookieNames = request ? request.cookies.getAll().map((c: { name: string }) => c.name) : [];
      logger.error('Authentication required but no user found', { 
        hasError: !!userError,
        errorMessage: userError?.message,
        errorCode: userError?.status,
        hasRequest: !!request,
        cookieCount: request ? request.cookies.getAll().length : 0,
        cookieNames: cookieNames,
        hasAuthCookie: cookieHeader.includes('sb-') || cookieNames.some((n: string) => n.startsWith('sb-')),
        cookieHeaderPreview: cookieHeader.substring(0, 200),
        sessionError: sessionError?.message
      }, userError || new Error('No user returned from getUser()'));
      throw new AuthenticationError('You must be logged in to access this resource');
    }

    // Fetch user profile with roles - specify foreign keys explicitly to avoid ambiguity
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select(`
        *,
        user_roles!user_roles_user_id_fkey(
          id,
          role_id,
          assigned_at,
          assigned_by,
          roles!user_roles_role_id_fkey(
            *,
            departments!roles_department_id_fkey(*)
          )
        )
      `)
      .eq('id', user.id)
      .single();

    if (profileError) {
      logger.error('Error fetching user profile', { 
        userId: user.id,
        errorMessage: profileError.message,
        errorCode: profileError.code,
        errorDetails: profileError.details,
        errorHint: profileError.hint
      }, profileError);
      throw new AuthenticationError(`User profile not found: ${profileError.message}`);
    }
    
    if (!userProfile) {
      logger.error('User profile not found (null result)', { userId: user.id });
      throw new AuthenticationError('User profile not found');
    }
    
    logger.debug('User profile fetched successfully', { userId: user.id, hasRoles: !!userProfile.user_roles });

    return userProfile as unknown as UserWithRoles;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    logger.error('Exception in requireAuthentication', {}, error as Error);
    throw new AuthenticationError('Authentication failed');
  }
}

/**
 * Optionally get authenticated user (doesn't throw if not authenticated)
 * @returns UserWithRoles profile or null
 */
export async function getAuthenticatedUser(): Promise<UserWithRoles | null> {
  try {
    return await requireAuthentication();
  } catch (error) {
    return null;
  }
}

// ================================================================================
// PERMISSION GUARDS
// ================================================================================

/**
 * Require that the user has a specific permission
 * Throws PermissionError if user doesn't have permission
 * @param userProfile - User profile with roles
 * @param permission - Required permission
 * @param context - Optional context (project, account, department)
 */
export async function requirePermission(
  userProfile: UserWithRoles,
  permission: Permission,
  context?: PermissionContext
): Promise<void> {
  try {
    const hasPermission = await checkPermissionHybrid(userProfile, permission, context);
    
    if (!hasPermission) {
      logger.warn('Permission denied', {
        userId: userProfile.id,
        permission,
        context
      });
      
      throw new PermissionError(
        `You don't have permission to perform this action`,
        permission,
        context
      );
    }
  } catch (error) {
    if (error instanceof PermissionError) {
      throw error;
    }
    logger.error('Exception in requirePermission', { permission, context }, error as Error);
    throw new PermissionError('Permission check failed', permission, context);
  }
}

/**
 * Require that the user has ANY of the specified permissions
 * @param userProfile - User profile with roles
 * @param permissions - Array of permissions (user needs at least one)
 * @param context - Optional context
 */
export async function requireAnyPermission(
  userProfile: UserWithRoles,
  permissions: Permission[],
  context?: PermissionContext
): Promise<void> {
  for (const permission of permissions) {
    try {
      await requirePermission(userProfile, permission, context);
      return; // Success - user has at least one permission
    } catch (error) {
      // Continue checking other permissions
    }
  }
  
  // None of the permissions matched
  logger.warn('None of required permissions granted', {
    userId: userProfile.id,
    permissions,
    context
  });
  
  throw new PermissionError(
    `You don't have any of the required permissions`,
    permissions[0], // Just use first permission for error tracking
    context
  );
}

/**
 * Require that the user has ALL of the specified permissions
 * @param userProfile - User profile with roles
 * @param permissions - Array of permissions (user needs all of them)
 * @param context - Optional context
 */
export async function requireAllPermissions(
  userProfile: UserWithRoles,
  permissions: Permission[],
  context?: PermissionContext
): Promise<void> {
  for (const permission of permissions) {
    await requirePermission(userProfile, permission, context);
  }
}

// ================================================================================
// ROLE GUARDS
// ================================================================================

/**
 * Require that the user is a superadmin
 * Throws ForbiddenError if not superadmin
 * @param userProfile - User profile with roles
 */
export async function requireSuperadmin(userProfile: UserWithRoles): Promise<void> {
  if (!isSuperadmin(userProfile)) {
    logger.warn('Superadmin access required but user is not superadmin', {
      userId: userProfile.id
    });
    throw new ForbiddenError('Superadmin access required');
  }
}

/**
 * Require that the user is NOT unassigned
 * Throws ForbiddenError if user has no roles or only Unassigned role
 * @param userProfile - User profile with roles
 */
export async function requireAssignedRole(userProfile: UserWithRoles): Promise<void> {
  if (!userProfile.user_roles || userProfile.user_roles.length === 0) {
    throw new ForbiddenError('You must be assigned a role to access this resource');
  }
  
  // Check if user has only Unassigned role
  if (userProfile.user_roles.length === 1) {
    const role = userProfile.user_roles[0].roles;
    if (role.is_system_role && role.name.toLowerCase() === 'unassigned') {
      throw new ForbiddenError('You must be assigned a role to access this resource');
    }
  }
}

// ================================================================================
// RESOURCE OWNERSHIP GUARDS
// ================================================================================

/**
 * Require that the user owns a resource or has permission to access it
 * @param userProfile - User profile with roles
 * @param resourceOwnerId - ID of the user who owns the resource
 * @param overridePermission - Optional permission that grants access regardless of ownership
 */
export async function requireOwnershipOrPermission(
  userProfile: UserWithRoles,
  resourceOwnerId: string,
  overridePermission?: Permission
): Promise<void> {
  // Check ownership
  if (userProfile.id === resourceOwnerId) {
    return;
  }
  
  // Check override permission if provided
  if (overridePermission) {
    await requirePermission(userProfile, overridePermission);
    return;
  }
  
  // Neither ownership nor permission
  throw new ForbiddenError('You can only access your own resources');
}

// ================================================================================
// ERROR RESPONSE HELPERS
// ================================================================================

/**
 * Convert guard errors to Next.js responses
 * Use this in catch blocks of API routes
 * @param error - The error thrown
 * @returns NextResponse with appropriate status code and message
 */
export function handleGuardError(error: any): NextResponse {
  if (error instanceof AuthenticationError) {
    return NextResponse.json(
      { error: error.message, code: 'UNAUTHENTICATED' },
      { status: 401 }
    );
  }
  
  if (error instanceof PermissionError) {
    return NextResponse.json(
      { 
        error: error.message, 
        code: 'PERMISSION_DENIED',
        permission: error.permission,
        context: error.context
      },
      { status: 403 }
    );
  }
  
  if (error instanceof ForbiddenError) {
    return NextResponse.json(
      { error: error.message, code: 'FORBIDDEN' },
      { status: 403 }
    );
  }
  
  // Generic error
  logger.error('Unhandled error in API route', {}, error as Error);
  return NextResponse.json(
    { error: 'Internal server error', code: 'INTERNAL_ERROR' },
    { status: 500 }
  );
}

/**
 * Wrap an API handler with automatic error handling
 * @param handler - The API route handler
 * @returns Wrapped handler with error handling
 * 
 * Usage:
 * ```typescript
 * export const POST = withErrorHandling(async (request: Request) => {
 *   const user = await requireAuthentication();
 *   // ... rest of handler
 *   return NextResponse.json({ success: true });
 * });
 * ```
 */
export function withErrorHandling(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    try {
      return await handler(request, context);
    } catch (error) {
      return handleGuardError(error);
    }
  };
}

// ================================================================================
// COMBINED GUARDS (CONVENIENCE)
// ================================================================================

/**
 * All-in-one: Require authentication + permission
 * @param permission - Required permission
 * @param context - Optional context
 * @param request - Optional NextRequest for API routes
 * @returns UserWithRoles profile
 */
export async function requireAuthAndPermission(
  permission: Permission,
  context?: PermissionContext,
  request?: NextRequest
): Promise<UserWithRoles> {
  const user = await requireAuthentication(request);
  await requirePermission(user, permission, context);
  return user;
}

/**
 * All-in-one: Require authentication + any permission
 * @param permissions - Array of permissions (need at least one)
 * @param context - Optional context
 * @param request - Optional NextRequest for API routes
 * @returns UserWithRoles profile
 */
export async function requireAuthAndAnyPermission(
  permissions: Permission[],
  context?: PermissionContext,
  request?: NextRequest
): Promise<UserWithRoles> {
  const user = await requireAuthentication(request);
  await requireAnyPermission(user, permissions, context);
  return user;
}

/**
 * All-in-one: Require authentication + superadmin
 * @returns UserWithRoles profile
 */
export async function requireAuthAndSuperadmin(): Promise<UserWithRoles> {
  const user = await requireAuthentication();
  await requireSuperadmin(user);
  return user;
}


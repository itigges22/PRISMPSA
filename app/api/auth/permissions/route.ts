import { NextResponse } from 'next/server';
import { Permission } from '@/lib/permissions';
import { checkPermissionHybrid, isSuperadmin } from '@/lib/permission-checker';
import { getAuthenticatedUser } from '@/lib/server-guards';
import { logger } from '@/lib/debug-logger';

export async function GET() {
  try {
    // Get authenticated user (doesn't throw if not authenticated)
    const userProfile = await getAuthenticatedUser();
    
    if (!userProfile) {
      return NextResponse.json({ 
        can_manage_roles: false,
        can_view_roles: false,
        is_admin: false
      });
    }

    // Check actual permissions using permission checker
    const canViewRoles = await checkPermissionHybrid(userProfile, Permission.VIEW_ROLES);
    const canManageRoles = await checkPermissionHybrid(userProfile, Permission.CREATE_ROLE) ||
                           await checkPermissionHybrid(userProfile, Permission.EDIT_ROLE) ||
                           await checkPermissionHybrid(userProfile, Permission.DELETE_ROLE);

    const roleNames = userProfile.user_roles?.map((ur: any) => ur.roles?.name).filter(Boolean) || [];
    const isAdmin = isSuperadmin(userProfile);

    return NextResponse.json({
      can_manage_roles: canManageRoles,
      can_view_roles: canViewRoles,
      is_admin: isAdmin,
      roles: roleNames
    });
  } catch (error) {
    logger.error('Error checking permissions', { action: 'getPermissions' }, error as Error);
    return NextResponse.json({ 
      can_manage_roles: false,
      can_view_roles: false,
      is_admin: false,
      error: 'Failed to check permissions'
    }, { status: 500 });
  }
}


/**
 * API Route: RBAC Diagnostics
 * Provides diagnostic information about roles, permissions, and user assignments
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getUserProfileFromRequest } from '@/lib/supabase-server';
import { hasPermission, isSuperadmin } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database connection not available' },
        { status: 500 }
      );
    }

    const userProfile = await getUserProfileFromRequest(supabase);
    if (!userProfile) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user has permission to view RBAC diagnostics
    const canManageUsers = await hasPermission(userProfile, Permission.MANAGE_USERS);
    if (!canManageUsers && !isSuperadmin(userProfile)) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions to access RBAC diagnostics' },
        { status: 403 }
      );
    }

    // Fetch all users with their roles
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select(`
        id,
        name,
        email,
        is_superadmin,
        user_roles!user_roles_user_id_fkey (
          id,
          role_id,
          roles (
            id,
            name,
            department_id,
            permissions,
            departments (
              id,
              name
            )
          )
        )
      `)
      .order('name');

    if (usersError) {
      console.error('Error fetching users for diagnostics:', usersError);
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      );
    }

    // Fetch all roles with user counts
    const { data: roles, error: rolesError } = await supabase
      .from('roles')
      .select(`
        id,
        name,
        permissions,
        department_id,
        departments!roles_department_id_fkey (
          name
        )
      `)
      .order('name');

    if (rolesError) {
      console.error('Error fetching roles for diagnostics:', rolesError);
      return NextResponse.json(
        { error: 'Failed to fetch roles' },
        { status: 500 }
      );
    }

    // Count users per role
    const rolesWithCounts = await Promise.all(
      (roles || []).map(async (role: any) => {
        const { count } = await supabase
          .from('user_roles')
          .select('*', { count: 'exact', head: true })
          .eq('role_id', role.id);

        return {
          id: role.id,
          name: role.name,
          department_name: role.departments?.name || 'Unknown',
          permissions: role.permissions || {},
          user_count: count || 0,
        };
      })
    );

    return NextResponse.json({
      success: true,
      users: users || [],
      roles: rolesWithCounts,
    });
  } catch (error: any) {
    console.error('Error in GET /api/admin/rbac-diagnostics:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

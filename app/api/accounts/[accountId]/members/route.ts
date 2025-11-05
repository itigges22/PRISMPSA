import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { requireAuthentication, requirePermission, PermissionError } from '@/lib/server-guards';
import { Permission } from '@/lib/permissions';

/**
 * GET /api/accounts/[accountId]/members
 * Get all members assigned to an account
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const { accountId } = await params;
    console.log(`[GET /api/accounts/${accountId}/members] Starting request`);
    
    // Require VIEW_ACCOUNTS or VIEW_ALL_ACCOUNTS permission
    // Check VIEW_ALL_ACCOUNTS first (without context), then VIEW_ACCOUNTS (with context)
    try {
      const user = await requireAuthentication(request);
      
      // First check VIEW_ALL_ACCOUNTS (override permission, no context needed)
      let hasAccess = false;
      try {
        await requirePermission(user, Permission.VIEW_ALL_ACCOUNTS);
        hasAccess = true;
        console.log(`[GET /api/accounts/${accountId}/members] User has VIEW_ALL_ACCOUNTS permission`);
      } catch (error) {
        // User doesn't have VIEW_ALL_ACCOUNTS, check VIEW_ACCOUNTS with context
        try {
          await requirePermission(user, Permission.VIEW_ACCOUNTS, { accountId });
          hasAccess = true;
          console.log(`[GET /api/accounts/${accountId}/members] User has VIEW_ACCOUNTS permission for account ${accountId}`);
        } catch (contextError) {
          // User doesn't have either permission
          hasAccess = false;
        }
      }
      
      if (!hasAccess) {
        throw new PermissionError('You don\'t have permission to view account members');
      }
      
      console.log(`[GET /api/accounts/${accountId}/members] Authentication successful`);
    } catch (authError: any) {
      console.error('[GET /api/accounts/[accountId]/members] Authentication/permission error:', {
        error: authError.message,
        name: authError.name,
        status: authError.status,
        stack: authError.stack
      });
      // Return proper JSON error response
      const status = authError.status || (authError.name === 'AuthenticationError' ? 401 : 403);
      const errorResponse = { 
        error: authError.message || 'Authentication failed',
        details: authError.message || 'No details available',
        status: status
      };
      console.log(`[GET /api/accounts/${accountId}/members] Returning error response:`, errorResponse);
      return NextResponse.json(errorResponse, { status });
    }
    
    const supabase = await createServerSupabase();
    if (!supabase) {
      console.error('Supabase client not available');
      return NextResponse.json({ 
        error: 'Supabase client not available',
        details: 'Database connection failed'
      }, { status: 500 });
    }
    
    // Get account members with user details and roles
    // First try to get members, but handle gracefully if table doesn't exist
    const { data: members, error } = await supabase
      .from('account_members')
      .select(`
        id,
        user_id,
        account_id,
        created_at,
        user_profiles!account_members_user_id_fkey(
          id,
          name,
          email,
          image,
          user_roles!user_roles_user_id_fkey(
            id,
            roles!user_roles_role_id_fkey(
              id,
              name,
              department_id,
              departments!roles_department_id_fkey(
                id,
                name
              )
            )
          )
        )
      `)
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('[GET /api/accounts/[accountId]/members] Error fetching account members:', {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      // If table doesn't exist (PGRST116 or 42P01), return empty array instead of error
      if (error.code === 'PGRST116' || error.code === '42P01' || error.message?.includes('does not exist')) {
        console.log('[GET /api/accounts/[accountId]/members] account_members table does not exist, returning empty array');
        return NextResponse.json({ members: [] });
      }
      const errorResponse = { 
        error: 'Failed to fetch account members', 
        details: error.message || 'Unknown database error',
        code: error.code || 'UNKNOWN_ERROR'
      };
      console.log(`[GET /api/accounts/${accountId}/members] Returning database error response:`, errorResponse);
      return NextResponse.json(errorResponse, { status: 500 });
    }
    
    // Transform the data to include user roles
    const formattedMembers = (members || []).map((member: any) => {
      const userProfile = member.user_profiles;
      const userRoles = userProfile?.user_roles || [];
      
      return {
        id: member.id,
        user_id: member.user_id,
        account_id: member.account_id,
        created_at: member.created_at,
        user: userProfile ? {
          id: userProfile.id,
          name: userProfile.name,
          email: userProfile.email,
          image: userProfile.image,
          roles: userRoles.map((ur: any) => {
            const role = ur.roles;
            const department = role?.departments;
            return {
              id: role?.id,
              name: role?.name,
              department: department ? {
                id: department.id,
                name: department.name
              } : null
            };
          }).filter((r: any) => r.id) // Filter out any invalid roles
        } : null
      };
    });
    
    console.log(`[GET /api/accounts/${accountId}/members] Successfully returning ${formattedMembers.length} members`);
    return NextResponse.json({ members: formattedMembers });
  } catch (error: any) {
    console.error('[GET /api/accounts/[accountId]/members] Unexpected error:', {
      error: error.message,
      name: error.name,
      status: error.status,
      stack: error.stack
    });
    // Ensure we always return proper JSON
    const errorResponse = { 
      error: error.message || 'Internal server error',
      details: error.message || 'An unexpected error occurred',
      status: error.status || 500
    };
    console.log('[GET /api/accounts/[accountId]/members] Returning unexpected error response:', errorResponse);
    return NextResponse.json(errorResponse, { status: error.status || 500 });
  }
}

/**
 * POST /api/accounts/[accountId]/members
 * Assign a user to an account
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const { accountId } = await params;
    const body = await request.json();
    const { userId } = body;
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
    // Require permission to assign users to accounts (use ASSIGN_USERS_TO_ROLES as similar permission)
    await requireAuthAndPermission(Permission.ASSIGN_USERS_TO_ROLES, {}, request);
    
    const supabase = await createServerSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase client not available' }, { status: 500 });
    }
    
    // Check if user is already assigned to this account
    const { data: existing } = await supabase
      .from('account_members')
      .select('id')
      .eq('account_id', accountId)
      .eq('user_id', userId)
      .single();
    
    if (existing) {
      return NextResponse.json({ error: 'User is already assigned to this account' }, { status: 400 });
    }
    
    // Add user to account
    const { data, error } = await supabase
      .from('account_members')
      .insert({
        account_id: accountId,
        user_id: userId,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error assigning user to account:', error);
      
      // Provide more detailed error messages
      let errorMessage = 'Failed to assign user to account';
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        errorMessage = 'The account_members table does not exist. Please create it in your database.';
      } else if (error.code === '23505') {
        errorMessage = 'User is already assigned to this account';
      } else if (error.message) {
        errorMessage = `Failed to assign user: ${error.message}`;
      }
      
      return NextResponse.json({ 
        error: errorMessage,
        details: error.message,
        code: error.code
      }, { status: 500 });
    }
    
    return NextResponse.json({ member: data, message: 'User assigned to account successfully' });
  } catch (error: any) {
    console.error('Error in POST /api/accounts/[accountId]/members:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}



import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { requireAuthAndPermission } from '@/lib/server-guards';
import { Permission } from '@/lib/permissions';

/**
 * GET /api/accounts/members
 * Get all accounts with their assigned members
 */
export async function GET(request: NextRequest) {
  try {
    // Require VIEW_ALL_ACCOUNTS permission
    await requireAuthAndPermission(Permission.VIEW_ALL_ACCOUNTS, {}, request);
    
    const supabase = await createServerSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase client not available' }, { status: 500 });
    }
    
    // Get all accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('id, name, description, status, account_manager_id')
      .order('name');
    
    if (accountsError) {
      console.error('Error fetching accounts:', accountsError);
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
    }
    
    // Get all account members with user details
    const { data: allMembers, error: membersError } = await supabase
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
      .order('created_at', { ascending: false });
    
    // Group members by account
    const accountsWithMembers = (accounts || []).map((account: any) => {
      // Handle case where account_members table doesn't exist
      if (membersError) {
        console.error('Error fetching account members:', membersError);
        // If table doesn't exist, return empty members array
        if (membersError.code === 'PGRST116' || membersError.code === '42P01' || membersError.message?.includes('does not exist')) {
          console.log('account_members table does not exist, returning empty members');
          return {
            ...account,
            members: [],
            member_count: 0
          };
        }
      }
      
      const members = (allMembers || []).filter((m: any) => m.account_id === account.id);
      
      const formattedMembers = members.map((member: any) => {
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
      
      return {
        ...account,
        members: formattedMembers,
        member_count: formattedMembers.length
      };
    });
    
    return NextResponse.json({ accounts: accountsWithMembers });
  } catch (error: any) {
    console.error('Error in GET /api/accounts/members:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


import { NextResponse, NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { requireAuthAndPermission, handleGuardError } from '@/lib/server-guards';
import { Permission } from '@/lib/permissions';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roleId: string }> }
) {
  try {
    const { roleId } = await params;
    
    // Check authentication and permission
    const userProfile = await requireAuthAndPermission(Permission.ASSIGN_USERS_TO_ROLES, {}, request);
    
    const supabase = await createServerSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    // Parse request body
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // PRIVILEGE ESCALATION PROTECTION: Prevent users from assigning roles to themselves
    if (userId === userProfile.id) {
      return NextResponse.json({ 
        error: 'You cannot assign roles to yourself. Please contact an administrator.' 
      }, { status: 403 });
    }

    // Check if role exists
    const { data: role, error: roleError } = await supabase
      .from('roles')
      .select('id, name')
      .eq('id', roleId)
      .single();

    if (roleError || !role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    // Check if user exists
    const { data: targetUser, error: userError } = await supabase
      .from('user_profiles')
      .select('id, name')
      .eq('id', userId)
      .single();

    if (userError || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if assignment already exists
    const { data: existingAssignment } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role_id', roleId)
      .single();

    if (existingAssignment) {
      return NextResponse.json({ error: 'User already has this role' }, { status: 400 });
    }

    // Get user's current roles for logging
    const { data: currentRoles, error: currentRolesError } = await supabase
      .from('user_roles')
      .select(`
        role_id,
        roles!inner(name)
      `)
      .eq('user_id', userId);

    if (currentRolesError) {
      console.error('Error fetching current roles:', currentRolesError);
      return NextResponse.json({ error: 'Failed to check current roles' }, { status: 500 });
    }

    // Check if user is only in "No Assigned Role" (needs special handling due to P0001 constraint)
    const noAssignedRole = currentRoles?.find((cr: any) => cr.roles.name === 'No Assigned Role');
    const hasOtherRoles = currentRoles?.some((cr: any) => cr.roles.name !== 'No Assigned Role');
    
    if (noAssignedRole && !hasOtherRoles) {
      console.log(`🔄 User is only in "No Assigned Role", will replace with new role`);
      // Don't remove yet - we'll replace the assignment after adding the new role
    } else if (noAssignedRole && hasOtherRoles) {
      console.log(`🔄 User has "No Assigned Role" + other roles, removing from "No Assigned Role"`);
      
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role_id', noAssignedRole.role_id);

      if (deleteError) {
        console.error('Error removing user from "No Assigned Role":', deleteError);
        return NextResponse.json({ error: 'Failed to remove user from "No Assigned Role"' }, { status: 500 });
      }

      console.log('✅ User removed from "No Assigned Role"');
    } else {
      console.log('ℹ️ User is not in "No Assigned Role", keeping existing roles');
    }

    // Create the new assignment
    const { error: insertError } = await supabase
      .from('user_roles')
      .insert({
        user_id: userId,
        role_id: roleId,
        assigned_by: userProfile.id,
        assigned_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('Error assigning user to role:', insertError);
      return NextResponse.json({ error: 'Failed to assign user to role' }, { status: 500 });
    }

    // If user was only in "No Assigned Role", remove it now (after adding new role)
    if (noAssignedRole && !hasOtherRoles) {
      console.log(`🔄 Now removing user from "No Assigned Role" (user now has new role)`);
      
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role_id', noAssignedRole.role_id);

      if (deleteError) {
        console.error('Error removing user from "No Assigned Role" after assignment:', deleteError);
        // Don't fail the request - user is already assigned to new role
        console.log('⚠️ User assigned to new role but failed to remove from "No Assigned Role"');
      } else {
        console.log('✅ User removed from "No Assigned Role" after assignment');
      }
    }

    console.log(`✅ User ${targetUser.name} assigned to ${role.name} (removed from ${currentRoles?.length || 0} previous roles)`);

    return NextResponse.json({ 
      success: true,
      message: `${targetUser.name} assigned to ${role.name}`
    });
  } catch (error) {
    return handleGuardError(error);
  }
}


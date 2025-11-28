import { NextResponse, NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { requireAuthAndPermission, handleGuardError } from '@/lib/server-guards';
import { Permission } from '@/lib/permissions';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roleId: string; userId: string }> }
) {
  try {
    const { roleId, userId } = await params;
    
    // Check authentication and permission
    const userProfile = await requireAuthAndPermission(Permission.ASSIGN_USERS_TO_ROLES, {}, request);
    
    const supabase = await createServerSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    // PRIVILEGE ESCALATION PROTECTION: Prevent users from removing their own roles
    // (This is allowed but logged for audit purposes)
    const isSelfRemoval = userId === userProfile.id;
    if (isSelfRemoval) {
      // Log self-removal attempt for audit
      console.warn('User attempted to remove their own role', {
        userId: userProfile.id,
        roleId,
        timestamp: new Date().toISOString()
      });
      // Allow self-removal but ensure they have at least one other role
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

    // Check if assignment exists
    const { data: existingAssignment } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role_id', roleId)
      .single();

    if (!existingAssignment) {
      return NextResponse.json({ error: 'User does not have this role' }, { status: 400 });
    }

    // Check if user has any other roles BEFORE attempting removal
    const { data: otherRoles, error: otherRolesError } = await supabase
      .from('user_roles')
      .select('role_id, roles!user_roles_role_id_fkey(name)')
      .eq('user_id', userId)
      .neq('role_id', roleId); // Exclude the role being removed

    if (otherRolesError) {
      console.error('Error checking other roles:', otherRolesError);
      return NextResponse.json({ error: 'Failed to check other roles' }, { status: 500 });
    }

    // If user has no other roles, assign to "No Assigned Role" first
    if (!otherRoles || otherRoles.length === 0) {
      console.log(`🔄 User has no other roles, assigning to "No Assigned Role" first`);
      
      // Get the fallback role
      const { data: fallbackRole, error: fallbackError } = await supabase
        .from('roles')
        .select('id, name')
        .eq('name', 'No Assigned Role')
        .single();

      if (fallbackError || !fallbackRole) {
        console.error('Fallback role not found:', fallbackError);
        return NextResponse.json({ 
          error: 'Fallback role not found. Cannot remove user from their last role.' 
        }, { status: 500 });
      }

      // Assign user to fallback role first
      const { error: assignError } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role_id: fallbackRole.id,
          assigned_by: userProfile.id,
          assigned_at: new Date().toISOString()
        });

      if (assignError) {
        console.error('Error assigning user to fallback role:', assignError);
        return NextResponse.json({ 
          error: 'Failed to assign user to fallback role before removal' 
        }, { status: 500 });
      }

      console.log(`✅ User ${targetUser.name} assigned to ${fallbackRole.name} before removal`);
    } else {
      console.log(`ℹ️ User ${targetUser.name} has ${otherRoles.length} other roles, proceeding with removal`);
    }

    // Now remove the assignment (user now has at least one other role or fallback role)
    const { error: deleteError } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role_id', roleId);

    if (deleteError) {
      console.error('Error removing user from role:', deleteError);
      return NextResponse.json({ error: 'Failed to remove user from role' }, { status: 500 });
    }

    console.log(`✅ User ${targetUser.name} successfully removed from ${role.name}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleGuardError(error);
  }
}


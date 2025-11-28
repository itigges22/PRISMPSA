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

    // Remove user from the specific role
    const { error: deleteError } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role_id', roleId);

    if (deleteError) {
      console.error('Error removing user from role:', deleteError);
      return NextResponse.json({ error: 'Failed to remove user from role' }, { status: 500 });
    }

    // Get the fallback role
    const { data: fallbackRole, error: fallbackError } = await supabase
      .from('roles')
      .select('id, name')
      .eq('name', 'No Assigned Role')
      .single();

    if (fallbackError || !fallbackRole) {
      console.error('Fallback role not found:', fallbackError);
      return NextResponse.json({ 
        error: 'Fallback role not found. User removed from role but not reassigned.' 
      }, { status: 500 });
    }

    // Assign user to fallback role
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
        error: 'User removed from role but failed to assign to fallback role' 
      }, { status: 500 });
    }

    console.log(`✅ User ${targetUser.name} removed from ${role.name} and assigned to ${fallbackRole.name}`);

    return NextResponse.json({ 
      success: true,
      message: `${targetUser.name} removed from ${role.name} and assigned to ${fallbackRole.name}`
    });
  } catch (error) {
    return handleGuardError(error);
  }
}

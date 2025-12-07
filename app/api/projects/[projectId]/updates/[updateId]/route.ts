import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';

/**
 * PUT /api/projects/[projectId]/updates/[updateId]
 * Update a project update
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; updateId: string }> }
) {
  try {
    const { projectId, updateId } = await params;
    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select(`
        *,
        user_roles!user_roles_user_id_fkey (
          roles (
            id,
            name,
            permissions,
            department_id
          )
        )
      `)
      .eq('id', user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Check EDIT_UPDATE permission
    const canEditUpdate = await hasPermission(userProfile, Permission.EDIT_UPDATE, undefined, supabase);
    if (!canEditUpdate) {
      return NextResponse.json({ error: 'Insufficient permissions to edit updates' }, { status: 403 });
    }

    const body = await request.json();
    const { content } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Update content cannot be empty' }, { status: 400 });
    }

    // Update the update
    const { data: update, error } = await supabase
      .from('project_updates')
      .update({
        content: content.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', updateId)
      .eq('project_id', projectId)
      .select(`
        *,
        user_profiles:user_profiles(id, name, email, image)
      `)
      .single();

    if (error) {
      console.error('Error updating update:', error);
      return NextResponse.json({ error: 'Failed to update update' }, { status: 500 });
    }

    return NextResponse.json({ success: true, update });
  } catch (error) {
    console.error('Error in PUT /api/projects/[projectId]/updates/[updateId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[projectId]/updates/[updateId]
 * Delete a project update
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; updateId: string }> }
) {
  try {
    const { projectId, updateId } = await params;
    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select(`
        *,
        user_roles!user_roles_user_id_fkey (
          roles (
            id,
            name,
            permissions,
            department_id
          )
        )
      `)
      .eq('id', user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Check DELETE_UPDATE permission
    const canDeleteUpdate = await hasPermission(userProfile, Permission.DELETE_UPDATE, undefined, supabase);
    if (!canDeleteUpdate) {
      return NextResponse.json({ error: 'Insufficient permissions to delete updates' }, { status: 403 });
    }

    // Delete update
    const { error } = await supabase
      .from('project_updates')
      .delete()
      .eq('id', updateId)
      .eq('project_id', projectId);

    if (error) {
      console.error('Error deleting update:', error);
      return NextResponse.json({ error: 'Failed to delete update' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/projects/[projectId]/updates/[updateId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

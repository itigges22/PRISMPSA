import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';

/**
 * PUT /api/projects/[projectId]
 * Update a project (used by Kanban, Gantt, Table views)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const supabase = await createServerSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile with roles
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

    // Get the project to check permissions
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, account_id, assigned_user_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check EDIT_PROJECT permission with project context
    const canEditProject = await hasPermission(userProfile, Permission.EDIT_PROJECT, {
      projectId,
      accountId: project.account_id
    });

    if (!canEditProject) {
      return NextResponse.json({ error: 'Insufficient permissions to edit project' }, { status: 403 });
    }

    const body = await request.json();

    // If moving on Kanban (changing status) and user is not assigned to project,
    // check MOVE_ALL_KANBAN_ITEMS permission
    if (body.status !== undefined && project.assigned_user_id !== user.id) {
      const canMoveAllKanbanItems = await hasPermission(userProfile, Permission.MOVE_ALL_KANBAN_ITEMS);
      if (!canMoveAllKanbanItems) {
        return NextResponse.json({
          error: 'You can only move projects assigned to you. You need MOVE_ALL_KANBAN_ITEMS permission to move other projects.'
        }, { status: 403 });
      }
    }

    // Build update object with only provided fields
    const updates: any = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.status !== undefined) updates.status = body.status;
    if (body.start_date !== undefined) updates.start_date = body.start_date;
    if (body.end_date !== undefined) updates.end_date = body.end_date;
    if (body.budget !== undefined) updates.budget = body.budget;
    if (body.assigned_user_id !== undefined) updates.assigned_user_id = body.assigned_user_id;

    // Update the project
    const { data: updatedProject, error: updateError } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', projectId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating project:', updateError);
      return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
    }

    return NextResponse.json({ success: true, project: updatedProject });
  } catch (error) {
    console.error('Error in PUT /api/projects/[projectId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[projectId]
 * Delete a project
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const supabase = await createServerSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile with roles
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

    // Get the project to check permissions
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, account_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check DELETE_PROJECT permission with project context
    const canDeleteProject = await hasPermission(userProfile, Permission.DELETE_PROJECT, {
      projectId,
      accountId: project.account_id
    });

    if (!canDeleteProject) {
      return NextResponse.json({ error: 'Insufficient permissions to delete project' }, { status: 403 });
    }

    // Delete the project
    const { error: deleteError } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (deleteError) {
      console.error('Error deleting project:', deleteError);
      return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/projects/[projectId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

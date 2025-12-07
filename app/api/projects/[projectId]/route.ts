import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { hasPermission, isSuperadmin } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';

/**
 * GET /api/projects/[projectId]
 * Get a single project's details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const supabase = createApiSupabaseClient(request);
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

    // Get the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if user can view this project
    // Superadmins can view all projects
    if (!isSuperadmin(userProfile)) {
      // Check VIEW_PROJECTS permission
      const canView = await hasPermission(userProfile, Permission.VIEW_PROJECTS, {
        projectId,
        accountId: project.account_id
      }, supabase);

      if (!canView) {
        // Also check if user is assigned to the project
        const { data: assignment } = await supabase
          .from('project_assignments')
          .select('id')
          .eq('user_id', user.id)
          .eq('project_id', projectId)
          .is('removed_at', null)
          .single();

        if (!assignment && project.created_by !== user.id && project.assigned_user_id !== user.id) {
          return NextResponse.json({ error: 'Insufficient permissions to view project' }, { status: 403 });
        }
      }
    }

    return NextResponse.json({ success: true, project });
  } catch (error) {
    console.error('Error in GET /api/projects/[projectId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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
    const supabase = createApiSupabaseClient(request);
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
    }, supabase);

    if (!canEditProject) {
      return NextResponse.json({ error: 'Insufficient permissions to edit project' }, { status: 403 });
    }

    const body = await request.json();

    // NOTE: MOVE_ALL_KANBAN_ITEMS permission is deprecated (workflows replace project kanban)
    // Status changes are now controlled by EDIT_PROJECT permission which was already checked above

    // Build update object with only provided fields
    const updates: any = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.status !== undefined) updates.status = body.status;
    if (body.start_date !== undefined) updates.start_date = body.start_date;
    if (body.end_date !== undefined) updates.end_date = body.end_date;
    if (body.budget !== undefined) updates.budget = body.budget;
    if (body.assigned_user_id !== undefined) updates.assigned_user_id = body.assigned_user_id;
    if (body.notes !== undefined) updates.notes = body.notes;

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

    // Add user as project collaborator if they made a meaningful update (notes, description)
    if (body.notes !== undefined || body.description !== undefined) {
      const { data: existingAssignment } = await supabase
        .from('project_assignments')
        .select('id, removed_at')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .single();

      if (!existingAssignment) {
        // Insert new assignment
        await supabase.from('project_assignments').insert({
          project_id: projectId,
          user_id: user.id,
          role_in_project: 'collaborator',
          assigned_by: user.id
        });
      } else if (existingAssignment.removed_at) {
        // Reactivate removed assignment
        await supabase
          .from('project_assignments')
          .update({ removed_at: null, role_in_project: 'collaborator' })
          .eq('id', existingAssignment.id);
      }
    }

    return NextResponse.json({ success: true, project: updatedProject });
  } catch (error) {
    console.error('Error in PUT /api/projects/[projectId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/projects/[projectId]
 * Partial update for a project (e.g., notes)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  // PATCH uses the same logic as PUT for partial updates
  return PUT(request, { params });
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
    const supabase = createApiSupabaseClient(request);
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
    }, supabase);

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

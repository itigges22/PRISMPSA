import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';

/**
 * PUT /api/projects/[projectId]/issues/[issueId]
 * Update an issue (content or status)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; issueId: string }> }
) {
  try {
    const { projectId, issueId } = await params;
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
      .eq('id', (user as any).id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Check MANAGE_ISSUES permission (consolidated from EDIT_ISSUE)
    const canManageIssues = await hasPermission(userProfile, Permission.MANAGE_ISSUES, undefined, supabase);
    if (!canManageIssues) {
      return NextResponse.json({ error: 'Insufficient permissions to edit issues' }, { status: 403 });
    }

    const body = await request.json();
    const { content, status } = body;

    // Build update object
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };

    if (content !== undefined) {
      if (!content.trim()) {
        return NextResponse.json({ error: 'Issue content cannot be empty' }, { status: 400 });
      }
      updates.content = content.trim();
    }

    if (status !== undefined) {
      if (!['open', 'in_progress', 'resolved'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      updates.status = status;

      // Handle resolved metadata
      if (status === 'resolved') {
        updates.resolved_at = new Date().toISOString();
        updates.resolved_by = (user as any).id;
      } else {
        updates.resolved_at = null;
        updates.resolved_by = null;
      }
    }

    // Update issue
    const { data: issue, error } = await supabase
      .from('project_issues')
      .update(updates)
      .eq('id', issueId)
      .eq('project_id', projectId)
      .select(`
        *,
        user_profiles:created_by(id, name, email, image),
        resolver_profiles:resolved_by(id, name, email, image)
      `)
      .single();

    if (error) {
      console.error('Error updating issue:', error);
      return NextResponse.json({ error: 'Failed to update issue' }, { status: 500 });
    }

    // Add user as project collaborator if not already assigned
    const { data: existingAssignment } = await supabase
      .from('project_assignments')
      .select('id, removed_at')
      .eq('project_id', projectId)
      .eq('user_id', (user as any).id)
      .single();

    if (!existingAssignment) {
      // Insert new assignment
      await supabase.from('project_assignments').insert({
        project_id: projectId,
        user_id: (user as any).id,
        role_in_project: 'collaborator',
        assigned_by: (user as any).id,
        source_type: 'manual'
      });
    } else if (existingAssignment.removed_at) {
      // Reactivate removed assignment
      await supabase
        .from('project_assignments')
        .update({ removed_at: null, role_in_project: 'collaborator', source_type: 'manual' })
        .eq('id', existingAssignment.id);
    }

    return NextResponse.json({ success: true, issue });
  } catch (error: unknown) {
    console.error('Error in PUT /api/projects/[projectId]/issues/[issueId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[projectId]/issues/[issueId]
 * Delete an issue
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; issueId: string }> }
) {
  try {
    const { projectId, issueId } = await params;
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
      .eq('id', (user as any).id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Check MANAGE_ISSUES permission (consolidated from DELETE_ISSUE)
    const canManageIssues = await hasPermission(userProfile, Permission.MANAGE_ISSUES, undefined, supabase);
    if (!canManageIssues) {
      return NextResponse.json({ error: 'Insufficient permissions to delete issues' }, { status: 403 });
    }

    // Delete issue
    const { error } = await supabase
      .from('project_issues')
      .delete()
      .eq('id', issueId)
      .eq('project_id', projectId);

    if (error) {
      console.error('Error deleting issue:', error);
      return NextResponse.json({ error: 'Failed to delete issue' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error in DELETE /api/projects/[projectId]/issues/[issueId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

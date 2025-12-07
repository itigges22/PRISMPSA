import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';

/**
 * GET /api/projects/[projectId]/issues
 * Get all issues for a project
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

    // Check VIEW_ISSUES permission
    const canViewIssues = await hasPermission(userProfile, Permission.VIEW_ISSUES, undefined, supabase);
    if (!canViewIssues) {
      return NextResponse.json({ error: 'Insufficient permissions to view issues' }, { status: 403 });
    }

    // Get issues with workflow history info
    // Use explicit foreign key hint to resolve relationship ambiguity
    const { data: issues, error } = await supabase
      .from('project_issues')
      .select(`
        *,
        user_profiles:created_by(id, name, email, image),
        resolver_profiles:resolved_by(id, name, email, image),
        workflow_history:workflow_history!project_issues_workflow_history_id_fkey(
          id,
          from_node_id,
          approval_decision,
          workflow_nodes:workflow_nodes!workflow_history_from_node_id_fkey(
            id,
            label,
            node_type
          ),
          workflow_instances:workflow_instances(
            id,
            workflow_templates(
              id,
              name
            )
          )
        )
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching issues:', error);
      return NextResponse.json({ error: 'Failed to fetch issues' }, { status: 500 });
    }

    return NextResponse.json({ issues: issues || [] });
  } catch (error) {
    console.error('Error in GET /api/projects/[projectId]/issues:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/projects/[projectId]/issues
 * Create a new issue for a project
 */
export async function POST(
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

    // Check CREATE_ISSUE permission
    const canCreateIssue = await hasPermission(userProfile, Permission.CREATE_ISSUE, undefined, supabase);
    if (!canCreateIssue) {
      return NextResponse.json({ error: 'Insufficient permissions to create issues' }, { status: 403 });
    }

    // Check if project is completed (read-only mode)
    const { data: project } = await supabase
      .from('projects')
      .select('status')
      .eq('id', projectId)
      .single();

    if (project?.status === 'complete') {
      return NextResponse.json({
        error: 'Cannot add issues to a completed project. The project is in read-only mode.'
      }, { status: 400 });
    }

    const body = await request.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Issue content is required' }, { status: 400 });
    }

    // Create issue
    const { data: issue, error } = await supabase
      .from('project_issues')
      .insert({
        project_id: projectId,
        content: content.trim(),
        created_by: user.id,
        status: 'open'
      })
      .select(`
        *,
        user_profiles:created_by(id, name, email, image)
      `)
      .single();

    if (error) {
      console.error('Error creating issue:', error);
      return NextResponse.json({ error: 'Failed to create issue' }, { status: 500 });
    }

    // Add user as project collaborator if not already assigned
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

    return NextResponse.json({ success: true, issue }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/projects/[projectId]/issues:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

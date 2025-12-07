import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';

/**
 * GET /api/projects/[projectId]/updates
 * Get all updates for a project
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

    // Check VIEW_PROJECTS permission (updates are part of viewing a project)
    const { data: project } = await supabase
      .from('projects')
      .select('account_id')
      .eq('id', projectId)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // IMPORTANT: Pass the authenticated Supabase client to ensure proper RLS context
    const canViewProjects = await hasPermission(userProfile, Permission.VIEW_PROJECTS, {
      projectId,
      accountId: project.account_id
    }, supabase);

    if (!canViewProjects) {
      return NextResponse.json({ error: 'Insufficient permissions to view project updates' }, { status: 403 });
    }

    // Get updates with workflow history info
    // Use explicit foreign key hint to resolve relationship ambiguity
    const { data: updates, error } = await supabase
      .from('project_updates')
      .select(`
        *,
        user_profiles:user_profiles(id, name, email, image),
        workflow_history:workflow_history!project_updates_workflow_history_id_fkey(
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
      console.error('Error fetching updates:', error);
      return NextResponse.json({ error: 'Failed to fetch updates' }, { status: 500 });
    }

    return NextResponse.json({ updates: updates || [] });
  } catch (error) {
    console.error('Error in GET /api/projects/[projectId]/updates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/projects/[projectId]/updates
 * Create a new update for a project
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

    // Check CREATE_UPDATE permission
    const canCreateUpdate = await hasPermission(userProfile, Permission.CREATE_UPDATE, undefined, supabase);
    if (!canCreateUpdate) {
      return NextResponse.json({ error: 'Insufficient permissions to create updates' }, { status: 403 });
    }

    // Check if project is completed (read-only mode)
    const { data: project } = await supabase
      .from('projects')
      .select('status')
      .eq('id', projectId)
      .single();

    if (project?.status === 'complete') {
      return NextResponse.json({
        error: 'Cannot add updates to a completed project. The project is in read-only mode.'
      }, { status: 400 });
    }

    const body = await request.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Update content is required' }, { status: 400 });
    }

    // Create update
    const { data: update, error } = await supabase
      .from('project_updates')
      .insert({
        project_id: projectId,
        content: content.trim(),
        created_by: user.id
      })
      .select(`
        *,
        user_profiles:user_profiles(id, name, email, image)
      `)
      .single();

    if (error) {
      console.error('Error creating update:', error);
      return NextResponse.json({ error: 'Failed to create update' }, { status: 500 });
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

    return NextResponse.json({ success: true, update }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/projects/[projectId]/updates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

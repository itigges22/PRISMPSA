import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
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
    const supabase = await createServerSupabase();
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

    const canViewProjects = await hasPermission(userProfile, Permission.VIEW_PROJECTS, {
      projectId,
      accountId: project.account_id
    });

    if (!canViewProjects) {
      return NextResponse.json({ error: 'Insufficient permissions to view project updates' }, { status: 403 });
    }

    // Get updates
    const { data: updates, error } = await supabase
      .from('project_updates')
      .select(`
        *,
        user_profiles:user_profiles(id, name, email, image)
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
    const supabase = await createServerSupabase();
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
    const canCreateUpdate = await hasPermission(userProfile, Permission.CREATE_UPDATE);
    if (!canCreateUpdate) {
      return NextResponse.json({ error: 'Insufficient permissions to create updates' }, { status: 403 });
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

    return NextResponse.json({ success: true, update }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/projects/[projectId]/updates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

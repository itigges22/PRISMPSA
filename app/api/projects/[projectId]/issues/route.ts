import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
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

    // Check VIEW_ISSUES permission
    const canViewIssues = await hasPermission(userProfile, Permission.VIEW_ISSUES);
    if (!canViewIssues) {
      return NextResponse.json({ error: 'Insufficient permissions to view issues' }, { status: 403 });
    }

    // Get issues
    const { data: issues, error } = await supabase
      .from('project_issues')
      .select(`
        *,
        user_profiles:created_by(id, name, email, image),
        resolver_profiles:resolved_by(id, name, email, image)
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

    // Check CREATE_ISSUE permission
    const canCreateIssue = await hasPermission(userProfile, Permission.CREATE_ISSUE);
    if (!canCreateIssue) {
      return NextResponse.json({ error: 'Insufficient permissions to create issues' }, { status: 403 });
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

    return NextResponse.json({ success: true, issue }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/projects/[projectId]/issues:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

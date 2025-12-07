import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';
import { getWorkflowTemplates, getAllWorkflowTemplates, createWorkflowTemplate } from '@/lib/workflow-service';
import { validateRequestBody, createWorkflowTemplateSchema } from '@/lib/validation-schemas';

// GET /api/admin/workflows/templates - List all workflow templates
export async function GET(request: NextRequest) {
  try {
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
          role_id,
          roles (
            id,
            name,
            permissions,
            department_id,
            is_system_role
          )
        )
      `)
      .eq('id', user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Check VIEW_WORKFLOWS permission (pass supabase client for server context)
    const canView = await hasPermission(userProfile, Permission.VIEW_WORKFLOWS, undefined, supabase);
    if (!canView) {
      return NextResponse.json({ error: 'Insufficient permissions to view workflows' }, { status: 403 });
    }

    // Check if inactive templates should be included (for admin workflow editor)
    const includeInactive = request.nextUrl.searchParams.get('include_inactive') === 'true';

    // Get templates - include inactive if requested
    const templates = includeInactive
      ? await getAllWorkflowTemplates()
      : await getWorkflowTemplates();

    return NextResponse.json({ success: true, templates }, { status: 200 });
  } catch (error) {
    console.error('Error in GET /api/admin/workflows/templates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/workflows/templates - Create new workflow template
export async function POST(request: NextRequest) {
  try {
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
          role_id,
          roles (
            id,
            name,
            permissions,
            department_id,
            is_system_role
          )
        )
      `)
      .eq('id', user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Check MANAGE_WORKFLOWS permission (pass supabase client for server context)
    const canManage = await hasPermission(userProfile, Permission.MANAGE_WORKFLOWS, undefined, supabase);
    if (!canManage) {
      return NextResponse.json({ error: 'Insufficient permissions to manage workflows' }, { status: 403 });
    }

    // Validate request body
    const body = await request.json();
    const validation = validateRequestBody(createWorkflowTemplateSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Create template
    const template = await createWorkflowTemplate(
      validation.data.name,
      validation.data.description || null,
      user.id
    );

    return NextResponse.json({ success: true, template }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/admin/workflows/templates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

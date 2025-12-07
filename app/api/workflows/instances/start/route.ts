import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';
import { startWorkflowInstance } from '@/lib/workflow-service';
import { validateRequestBody, startWorkflowInstanceSchema } from '@/lib/validation-schemas';
import { isAssignedToProjectServer } from '@/lib/access-control-server';

// POST /api/workflows/instances/start - Start a workflow instance
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

    // Check EXECUTE_WORKFLOWS permission
    const canExecute = await hasPermission(userProfile, Permission.EXECUTE_WORKFLOWS, undefined, supabase);
    if (!canExecute) {
      return NextResponse.json({ error: 'Insufficient permissions to execute workflows' }, { status: 403 });
    }

    // Validate request body
    const body = await request.json();
    const validation = validateRequestBody(startWorkflowInstanceSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Verify user has access to the project if project_id is provided
    if (validation.data.project_id) {
      const hasAccess = await isAssignedToProjectServer(supabase, user.id, validation.data.project_id);
      if (!hasAccess) {
        return NextResponse.json({
          error: 'You do not have access to this project'
        }, { status: 403 });
      }
    }

    // Start workflow instance
    const instance = await startWorkflowInstance({
      workflowTemplateId: validation.data.workflow_template_id,
      projectId: validation.data.project_id || null,
      taskId: validation.data.task_id || null,
      startNodeId: validation.data.start_node_id
    });

    return NextResponse.json({ success: true, instance }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/workflows/instances/start:', error);

    // Return the actual error message for workflow validation errors
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const isValidationError = errorMessage.includes('not active') ||
      errorMessage.includes('no nodes') ||
      errorMessage.includes('not found') ||
      errorMessage.includes('Invalid start node');

    return NextResponse.json({
      error: errorMessage,
      success: false
    }, { status: isValidationError ? 400 : 500 });
  }
}

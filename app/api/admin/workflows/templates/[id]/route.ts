import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';
import {
  getWorkflowTemplateById,
  updateWorkflowTemplate,
  deleteWorkflowTemplate
} from '@/lib/workflow-service';
import { validateRequestBody, updateWorkflowTemplateSchema } from '@/lib/validation-schemas';
import { checkDemoModeForDestructiveAction } from '@/lib/api-demo-guard';

// Type definitions
// GET /api/admin/workflows/templates/[id] - Get workflow template with nodes and connections
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
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
      .eq('id', (user as any).id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Check VIEW_WORKFLOWS permission (pass supabase client for server context)
    const canView = await hasPermission(userProfile, Permission.MANAGE_WORKFLOWS, undefined, supabase);
    if (!canView) {
      return NextResponse.json({ error: 'Insufficient permissions to view workflows' }, { status: 403 });
    }

    // Get template with nodes and connections
    const template = await getWorkflowTemplateById(id);

    if (!template) {
      return NextResponse.json({ error: 'Workflow template not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, template }, { status: 200 });
  } catch (error: unknown) {
console.error('Error in GET /api/admin/workflows/templates/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/admin/workflows/templates/[id] - Update workflow template
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
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
      .eq('id', (user as any).id)
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
    const validation = validateRequestBody(updateWorkflowTemplateSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // If activating the workflow, validate that all roles have users assigned
    if (validation.data.is_active === true) {
      // Get workflow nodes
      const { data: nodes } = await supabase
        .from('workflow_nodes')
        .select('id, node_type, entity_id, label')
        .eq('workflow_template_id', id);

      if (nodes && nodes.length > 0) {
        // Get role IDs from role and approval nodes
        const roleIds = nodes
          .filter((n: any) => (n.node_type === 'role' || n.node_type === 'approval') && n.entity_id)
          .map((n: any) => n.entity_id);

        if (roleIds.length > 0) {
          // Get roles with user counts
          const { data: roles } = await supabase
            .from('roles')
            .select(`
              id,
              name,
              user_roles(count)
            `)
            .in('id', roleIds);

          // Check for roles with no users
          const emptyRoles = (roles || []).filter((r: any) => {
            const count = r.user_roles?.[0]?.count || 0;
            return count === 0;
          });

          if (emptyRoles.length > 0) {
            const nodeLabels = nodes
              .filter((n: any) => emptyRoles.some((r: any) => r.id === n.entity_id))
              .map((n: any) => `"${n.label}"`)
              .join(', ');

            const roleNames = emptyRoles.map((r: any) => `"${r.name}"`).join(', ');

            return NextResponse.json({
              error: `Cannot activate workflow: ${emptyRoles.length === 1 ? 'Role' : 'Roles'} ${roleNames} ${emptyRoles.length === 1 ? 'has' : 'have'} no users assigned. Affected nodes: ${nodeLabels}. Please assign users to these roles first.`
            }, { status: 400 });
          }
        }
      } else {
        // No nodes - cannot activate
        return NextResponse.json({
          error: 'Cannot activate workflow: No nodes configured. Please add at least a Start and End node.'
        }, { status: 400 });
      }
    }

    // Update template
    const updates = {
      ...validation.data,
      description: validation.data.description === null ? undefined : validation.data.description
    };
    const template = await updateWorkflowTemplate(id, updates);

    if (!template) {
      return NextResponse.json({ error: 'Workflow template not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, template }, { status: 200 });
  } catch (error: unknown) {
console.error('Error in PATCH /api/admin/workflows/templates/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/workflows/templates/[id] - Permanently delete workflow template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Block in demo mode
    const blocked = checkDemoModeForDestructiveAction('delete_workflow');
    if (blocked) return blocked;

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
      .eq('id', (user as any).id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Check MANAGE_WORKFLOWS permission (pass supabase client for server context)
    const canManage = await hasPermission(userProfile, Permission.MANAGE_WORKFLOWS, undefined, supabase);
    if (!canManage) {
      return NextResponse.json({ error: 'Insufficient permissions to manage workflows' }, { status: 403 });
    }

    // Permanently delete template and all associated nodes/connections
    // NOTE: In-progress workflows will continue to work - they have their own snapshots
    await deleteWorkflowTemplate(id);

    return NextResponse.json({
      success: true,
      message: 'Workflow template deleted successfully. Existing projects will continue using their workflow snapshots.'
    }, { status: 200 });
  } catch (error: unknown) {
console.error('Error in DELETE /api/admin/workflows/templates/[id]:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

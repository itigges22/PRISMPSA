import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { getUserPendingApprovals } from '@/lib/workflow-execution-service';

export async function GET(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is superadmin
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('is_superadmin')
      .eq('id', user.id)
      .single();

    const isSuperadmin = userProfile?.is_superadmin === true;

    let approvals: any[] = [];

    if (isSuperadmin) {
      // Superadmins see ALL pending approvals across all users
      // Query workflow_active_steps to support parallel workflows
      // IMPORTANT: Use left join for workflow_nodes so deleted templates don't break the query
      // Query without workflow_nodes FK join - use snapshot data instead
      // The FK workflow_active_steps_node_id_fkey may not exist if node was deleted after workflow started
      // Use explicit FK names to avoid "multiple relationships" errors
      const { data: activeSteps, error } = await supabase
        .from('workflow_active_steps')
        .select(`
          id,
          workflow_instance_id,
          node_id,
          status,
          activated_at,
          assigned_user_id,
          workflow_instances:workflow_active_steps_workflow_instance_id_fkey!inner(
            id,
            status,
            project_id,
            workflow_template_id,
            current_node_id,
            started_snapshot,
            projects:workflow_instances_project_id_fkey!inner(
              id,
              name,
              description,
              status,
              priority,
              account_id,
              accounts(id, name)
            )
          ),
          assigned_user:user_profiles!workflow_active_steps_assigned_user_id_fkey(
            id,
            name,
            email
          )
        `)
        .eq('status', 'active');

      if (error) {
        console.error('[my-approvals] Error querying active steps:', error);
      }

      if (!error && activeSteps) {
        // Filter to only approval/form nodes in active workflow instances
        const filteredSteps = activeSteps.filter((step: any) => {
          const instance = step.workflow_instances;
          if (!instance) return false;
          if (instance.status !== 'active') return false;

          // Get node data from snapshot (we removed the FK join because it may not exist)
          const node = instance.started_snapshot?.nodes?.find((n: any) => n.id === step.node_id);

          if (!node) {
            console.warn('[my-approvals] Node not found in snapshot:', { stepId: step.id, nodeId: step.node_id });
            return false;
          }
          return ['approval', 'form'].includes(node.node_type);
        });

        // Transform to match expected format
        approvals = filteredSteps.map((step: any) => {
          // Get node data from snapshot
          const nodeData = step.workflow_instances.started_snapshot?.nodes?.find((n: any) => n.id === step.node_id);

          return {
            ...step.workflow_instances,
            workflow_nodes: nodeData,
            projects: step.workflow_instances.projects,
            active_step_id: step.id,
            current_node_id: step.node_id,
            assigned_user: step.assigned_user || null
          };
        });
      }
    } else {
      // Regular users see only their pending approvals based on role
      approvals = await getUserPendingApprovals(supabase, user.id);
    }

    return NextResponse.json({
      success: true,
      approvals,
    });
  } catch (error) {
    console.error('Error in GET /api/workflows/my-approvals:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

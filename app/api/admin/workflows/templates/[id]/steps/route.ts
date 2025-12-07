import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';

// Node types that are allowed to have multiple outgoing edges
const BRANCHING_NODE_TYPES = ['approval', 'conditional'];

// PUT /api/admin/workflows/templates/[id]/steps - Save all nodes and edges for a workflow
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: templateId } = await params;

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

    // Check MANAGE_WORKFLOWS permission
    const canManage = await hasPermission(userProfile, Permission.MANAGE_WORKFLOWS, undefined, supabase);
    if (!canManage) {
      return NextResponse.json({ error: 'Insufficient permissions to manage workflows' }, { status: 403 });
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const { nodes, edges } = body;

    // Debug logging
    console.log('[Workflow Save] Starting save for template:', templateId);
    console.log('[Workflow Save] Received nodes:', nodes?.length || 0);
    console.log('[Workflow Save] Received edges:', edges?.length || 0);

    if (!nodes || !Array.isArray(nodes)) {
      return NextResponse.json({ error: 'Invalid nodes data - must be an array' }, { status: 400 });
    }

    // Validate node IDs are valid UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const node of nodes) {
      if (!node.id || !uuidRegex.test(node.id)) {
        console.error('[Workflow Save] Invalid node ID format:', node.id);
        return NextResponse.json({
          error: `Invalid node ID format: "${node.id}"`,
          details: 'Node IDs must be valid UUIDs. Please try deleting and re-creating the workflow nodes.'
        }, { status: 400 });
      }
    }

    // Server-side validation: Check for sync nodes (parallel workflows disabled)
    const syncNodes = nodes.filter((n: any) => n.data?.type === 'sync');
    if (syncNodes.length > 0) {
      return NextResponse.json({
        error: 'Sync nodes are not allowed. Parallel workflows have been disabled.',
        details: `Found ${syncNodes.length} sync node(s). Please remove them and use a single pathway.`
      }, { status: 400 });
    }

    // Server-side validation: Check for parallel paths (non-branching nodes with multiple outgoing edges)
    if (edges && Array.isArray(edges)) {
      const edgesBySource = new Map<string, any[]>();
      edges.forEach((edge: any) => {
        const existing = edgesBySource.get(edge.source) || [];
        existing.push(edge);
        edgesBySource.set(edge.source, existing);
      });

      for (const node of nodes) {
        const nodeType = node.data?.type;
        if (nodeType === 'end') continue; // End nodes have no outgoing edges
        if (BRANCHING_NODE_TYPES.includes(nodeType)) continue; // These can branch

        const outgoingEdges = edgesBySource.get(node.id) || [];
        if (outgoingEdges.length > 1) {
          return NextResponse.json({
            error: `Parallel workflows are not allowed. Node "${node.data?.label || node.id}" has ${outgoingEdges.length} outgoing connections.`,
            details: 'Each node (except Approval and Conditional) can only have ONE outgoing connection.'
          }, { status: 400 });
        }
      }
    }

    // Verify the template exists
    console.log('[Workflow Save] Verifying template exists:', templateId);
    const { data: template, error: templateError } = await supabase
      .from('workflow_templates')
      .select('id')
      .eq('id', templateId)
      .single();

    if (templateError || !template) {
      console.error('[Workflow Save] Template not found:', templateError);
      return NextResponse.json({ error: 'Workflow template not found' }, { status: 404 });
    }
    console.log('[Workflow Save] Template verified');

    // Delete existing nodes and connections for this template
    // Connections will be cascade deleted due to foreign key constraint
    console.log('[Workflow Save] Deleting existing nodes...');
    const { error: deleteError } = await supabase
      .from('workflow_nodes')
      .delete()
      .eq('workflow_template_id', templateId);

    if (deleteError) {
      console.error('[Workflow Save] Error deleting existing nodes:', deleteError);
      return NextResponse.json({
        error: 'Failed to clear existing workflow nodes',
        details: deleteError.message
      }, { status: 500 });
    }
    console.log('[Workflow Save] Existing nodes deleted successfully');

    // Insert new nodes
    const nodeInserts = nodes.map((node: any, index: number) => ({
      id: node.id,
      workflow_template_id: templateId,
      node_type: node.data.type,
      label: node.data.label,
      position_x: node.position.x,
      position_y: node.position.y,
      step_order: index,
      entity_id: node.data.config?.roleId || node.data.config?.approverRoleId || null,
      form_template_id: node.data.config?.formTemplateId || null,
      settings: {
        department_id: node.data.config?.departmentId,
        required_approvals: node.data.config?.requiredApprovals,
        allow_feedback: node.data.config?.allowFeedback,
        allow_send_back: node.data.config?.allowSendBack,
        allow_attachments: node.data.config?.allowAttachments,
        formFields: node.data.config?.formFields,
        formName: node.data.config?.formName,
        formDescription: node.data.config?.formDescription,
        isDraftForm: node.data.config?.isDraftForm,
        condition_type: node.data.config?.conditionType,
        conditions: node.data.config?.conditions,
        sourceFormFieldId: node.data.config?.sourceFormFieldId,
      },
    }));

    console.log('[Workflow Save] Inserting', nodeInserts.length, 'nodes...');
    console.log('[Workflow Save] First node sample:', JSON.stringify(nodeInserts[0], null, 2));

    const { error: nodesError } = await supabase
      .from('workflow_nodes')
      .insert(nodeInserts);

    if (nodesError) {
      console.error('[Workflow Save] Error inserting nodes:', nodesError);
      console.error('[Workflow Save] Node insert data:', JSON.stringify(nodeInserts, null, 2));
      return NextResponse.json({
        error: 'Failed to save workflow nodes',
        details: nodesError.message
      }, { status: 500 });
    }
    console.log('[Workflow Save] Nodes inserted successfully');

    // Insert new connections/edges
    if (edges && Array.isArray(edges) && edges.length > 0) {
      const connectionInserts = edges.map((edge: any) => ({
        workflow_template_id: templateId,
        from_node_id: edge.source,
        to_node_id: edge.target,
        condition: edge.data || edge.sourceHandle ? {
          label: edge.data?.label,
          conditionValue: edge.data?.conditionValue,
          conditionType: edge.data?.conditionType,
          decision: edge.data?.decision,
          // Critical fields for form-based conditional routing
          sourceFormFieldId: edge.data?.sourceFormFieldId,
          value: edge.data?.value,
          value2: edge.data?.value2,
          // Store sourceHandle for conditional branch edges
          sourceHandle: edge.sourceHandle,
        } : null,
      }));

      console.log('[Workflow Save] Inserting', connectionInserts.length, 'connections...');
      console.log('[Workflow Save] First connection sample:', JSON.stringify(connectionInserts[0], null, 2));

      const { error: connectionsError } = await supabase
        .from('workflow_connections')
        .insert(connectionInserts);

      if (connectionsError) {
        console.error('[Workflow Save] Error inserting connections:', connectionsError);
        console.error('[Workflow Save] Connection insert data:', JSON.stringify(connectionInserts, null, 2));
        return NextResponse.json({
          error: 'Failed to save workflow connections',
          details: connectionsError.message
        }, { status: 500 });
      }
      console.log('[Workflow Save] Connections inserted successfully');
    }

    // Auto-deactivate workflow if it has no nodes (or only has nodes but no valid start/end)
    let isActive: boolean | undefined;
    if (nodes.length === 0) {
      console.log('[Workflow Save] No nodes - auto-deactivating workflow');
      const { error: deactivateError } = await supabase
        .from('workflow_templates')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', templateId);

      if (deactivateError) {
        console.error('[Workflow Save] Error auto-deactivating workflow:', deactivateError);
      } else {
        isActive = false;
      }
    }

    return NextResponse.json({
      success: true,
      message: nodes.length === 0
        ? 'Workflow saved (deactivated - no nodes)'
        : 'Workflow saved successfully',
      nodeCount: nodes.length,
      edgeCount: edges?.length || 0,
      is_active: isActive, // Include if it was auto-deactivated
    }, { status: 200 });
  } catch (error) {
    console.error('Error in PUT /api/admin/workflows/templates/[id]/steps:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

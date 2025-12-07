/**
 * Workflow Execution Service
 * Handles starting, progressing, and managing workflow instances
 *
 * IMPORTANT: All functions now accept a Supabase client as a parameter
 * to maintain authentication context from API routes
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface WorkflowNode {
  id: string;
  workflow_template_id: string;
  node_type: 'start' | 'department' | 'role' | 'approval' | 'form' | 'conditional' | 'sync' | 'end';
  entity_id: string | null;
  label: string;
  settings: any;
  form_template_id: string | null;
}

export interface WorkflowActiveStep {
  id: string;
  workflow_instance_id: string;
  node_id: string;
  branch_id: string;
  status: 'active' | 'completed' | 'waiting';
  assigned_user_id: string | null;
  activated_at: string;
  completed_at: string | null;
  created_at: string;
  aggregate_decision?: 'all_approved' | 'any_rejected' | 'no_approvals' | null;
}

export interface WorkflowConnection {
  id: string;
  from_node_id: string;
  to_node_id: string;
  condition: any;
}

export interface WorkflowInstance {
  id: string;
  workflow_template_id: string;
  project_id: string | null;
  task_id: string | null;
  current_node_id: string | null;
  status: 'active' | 'completed' | 'cancelled';
  started_at: string;
  completed_at: string | null;
  // Snapshot of the workflow at the time the instance was created
  // This ensures changes to the template don't affect in-progress workflows
  started_snapshot?: {
    nodes: any[];
    connections: any[];
    template_name?: string;
    captured_at?: string;
  } | null;
  // Snapshot saved when workflow completes
  completed_snapshot?: {
    nodes: any[];
    connections: any[];
  } | null;
}

/**
 * Capture a snapshot of the workflow template's nodes and connections
 * Used to preserve the workflow state when a workflow completes
 * Now also includes workflow history with user assignments per node
 */
async function captureWorkflowSnapshot(
  supabase: SupabaseClient,
  workflowTemplateId: string,
  workflowInstanceId: string
): Promise<{ nodes: any[]; connections: any[]; history?: any[]; nodeAssignments?: Record<string, { userId: string; userName: string }> } | null> {
  try {
    // Get all nodes for this workflow template
    const { data: nodes, error: nodesError } = await supabase
      .from('workflow_nodes')
      .select('*')
      .eq('workflow_template_id', workflowTemplateId);

    if (nodesError || !nodes) {
      console.error('Error capturing workflow nodes snapshot:', nodesError);
      return null;
    }

    // Get all connections for this workflow template
    const { data: connections, error: connectionsError } = await supabase
      .from('workflow_connections')
      .select('*')
      .eq('workflow_template_id', workflowTemplateId);

    if (connectionsError) {
      console.error('Error capturing workflow connections snapshot:', connectionsError);
      return null;
    }

    // Get workflow history for this instance to capture user assignments
    const { data: history, error: historyError } = await supabase
      .from('workflow_history')
      .select('*')
      .eq('workflow_instance_id', workflowInstanceId)
      .order('handed_off_at', { ascending: true });

    if (historyError) {
      console.error('Error capturing workflow history snapshot:', historyError);
      // Continue without history - not a critical failure
    }

    // Build node assignments map from history
    const nodeAssignments: Record<string, { userId: string; userName: string }> = {};

    if (history && history.length > 0) {
      // Get unique user IDs from history
      const userIds = new Set<string>();
      history.forEach((h: any) => {
        if (h.handed_off_by) userIds.add(h.handed_off_by);
        if (h.handed_off_to) userIds.add(h.handed_off_to);
      });

      // Fetch user names
      const { data: users } = await supabase
        .from('user_profiles')
        .select('id, name')
        .in('id', Array.from(userIds));

      const userMap = new Map((users || []).map((u: any) => [u.id, u.name]));

      // Map each node to the user who handled it (handed_off_by for the to_node_id)
      history.forEach((h: any) => {
        if (h.to_node_id && h.handed_off_by) {
          nodeAssignments[h.to_node_id] = {
            userId: h.handed_off_by,
            userName: userMap.get(h.handed_off_by) || 'Unknown User'
          };
        }
      });
    }

    return {
      nodes,
      connections: connections || [],
      history: history || [],
      nodeAssignments
    };
  } catch (error) {
    console.error('Error capturing workflow snapshot:', error);
    return null;
  }
}

/**
 * Start a new workflow instance for a project
 */
export async function startWorkflowForProject(
  supabase: SupabaseClient,
  projectId: string,
  workflowTemplateId: string,
  startedBy: string
): Promise<{ success: boolean; workflowInstanceId?: string; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Database connection failed' };
  }

  try {
    // Validate workflowTemplateId
    if (!workflowTemplateId || workflowTemplateId === '' || workflowTemplateId === 'undefined') {
      console.error('Invalid workflow template ID:', workflowTemplateId);
      return { success: false, error: 'Invalid workflow template ID' };
    }

    // Check if workflow template exists and is active
    const { data: template, error: templateError } = await supabase
      .from('workflow_templates')
      .select('id, name, is_active')
      .eq('id', workflowTemplateId)
      .single();

    if (templateError || !template) {
      console.error('Workflow template not found:', workflowTemplateId);
      return { success: false, error: 'Workflow template not found' };
    }

    if (!template.is_active) {
      console.error('Workflow template is not active:', workflowTemplateId);
      return {
        success: false,
        error: `Workflow "${template.name}" is not active. Please activate it in the workflow editor before using.`
      };
    }

    // Get workflow nodes and find the start node
    const { data: nodes, error: nodesError } = await supabase
      .from('workflow_nodes')
      .select('*')
      .eq('workflow_template_id', workflowTemplateId)
      .order('position_y');

    console.log('Workflow nodes query result:', {
      templateId: workflowTemplateId,
      nodesCount: nodes?.length || 0,
      error: nodesError?.message || null
    });

    if (nodesError) {
      console.error('Error loading workflow nodes:', nodesError);
      return { success: false, error: `Failed to load workflow nodes: ${nodesError.message}` };
    }

    if (!nodes || nodes.length === 0) {
      console.error('No workflow nodes found for template:', workflowTemplateId);
      return {
        success: false,
        error: `Workflow "${template.name}" has no nodes configured. Please add at least Start and End nodes in the workflow editor.`
      };
    }

    // Find start node or first node
    const startNode = nodes.find((n: any) => n.node_type === 'start') || nodes[0];

    // Get connections to find next node after start
    const { data: connections } = await supabase
      .from('workflow_connections')
      .select('*')
      .eq('workflow_template_id', workflowTemplateId);

    const nextNode = findNextNode(startNode.id, connections, nodes);

    // Create workflow snapshot - this preserves the workflow state at the time the project starts
    // Any future changes to the workflow template will NOT affect this project
    const startedSnapshot = {
      nodes: nodes,
      connections: connections || [],
      template_name: template.name,
      captured_at: new Date().toISOString()
    };

    // Create workflow instance with snapshot
    const { data: instance, error: instanceError } = await supabase
      .from('workflow_instances')
      .insert({
        workflow_template_id: workflowTemplateId,
        project_id: projectId,
        current_node_id: nextNode?.id || startNode.id,
        status: 'active',
        started_snapshot: startedSnapshot, // Store snapshot for independent execution
      })
      .select()
      .single();

    if (instanceError || !instance) {
      return { success: false, error: 'Failed to create workflow instance' };
    }

    // Update project with workflow instance
    const { error: projectUpdateError } = await supabase
      .from('projects')
      .update({ workflow_instance_id: instance.id })
      .eq('id', projectId);

    if (projectUpdateError) {
      console.error('Failed to link workflow to project:', projectUpdateError);
      // Don't fail the whole operation - workflow instance was created successfully
      // The link can be established via workflow_instances.project_id
    } else {
      console.log('Successfully linked workflow instance to project:', {
        projectId,
        workflowInstanceId: instance.id
      });
    }

    // Create initial workflow history entry
    await supabase.from('workflow_history').insert({
      workflow_instance_id: instance.id,
      from_node_id: startNode.id,
      to_node_id: nextNode?.id || startNode.id,
      handed_off_by: startedBy,
      notes: 'Workflow started',
      branch_id: 'main'
    });

    // Create initial active step for parallel workflow tracking
    if (nextNode) {
      await supabase.from('workflow_active_steps').insert({
        workflow_instance_id: instance.id,
        node_id: nextNode.id,
        branch_id: 'main',
        status: 'active',
        assigned_user_id: null // Will be assigned based on node type
      });
    }

    // Assign project to appropriate user based on node type
    if (nextNode) {
      await assignProjectToNode(supabase, projectId, nextNode, startedBy);
    }

    return { success: true, workflowInstanceId: instance.id };
  } catch (error) {
    console.error('Error starting workflow:', error);
    return { success: false, error: 'Internal server error' };
  }
}

/**
 * Check if a user has a specific role
 */
async function userHasRole(supabase: SupabaseClient, userId: string, roleId: string): Promise<boolean> {
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('role_id')
    .eq('user_id', userId)
    .eq('role_id', roleId);

  return (userRoles?.length || 0) > 0;
}

/**
 * Check if a user is assigned to a project via project_assignments
 * NOTE: created_by and assigned_user_id on the project do NOT grant workflow progression rights
 * Only explicit project_assignments (created by workflow progression) count
 */
async function isUserAssignedToProject(supabase: SupabaseClient, userId: string, projectId: string): Promise<boolean> {
  // Only check project_assignments table - this is populated by workflow progression
  const { data: assignments } = await supabase
    .from('project_assignments')
    .select('id')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .is('removed_at', null);

  return (assignments?.length || 0) > 0;
}

/**
 * Check if user is superadmin (bypasses role checks)
 */
async function isUserSuperadmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data: user } = await supabase
    .from('users')
    .select('is_superadmin')
    .eq('id', userId)
    .single();

  if (user?.is_superadmin) return true;

  // Also check if user has a Superadmin role
  const { data: superadminRole } = await supabase
    .from('roles')
    .select('id')
    .ilike('name', 'superadmin')
    .single();

  if (superadminRole) {
    return await userHasRole(supabase, userId, superadminRole.id);
  }

  return false;
}

/**
 * Progress workflow to next step
 */
export async function progressWorkflow(
  supabase: SupabaseClient,
  workflowInstanceId: string,
  currentUserId: string,
  decision?: 'approved' | 'rejected',
  feedback?: string,
  formResponseId?: string,
  assignedUserId?: string,
  inlineFormData?: Record<string, any>
): Promise<{ success: boolean; nextNode?: any; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Database connection failed' };
  }

  try {
    // Get current workflow instance (including snapshot)
    const { data: instance, error: instanceError } = await supabase
      .from('workflow_instances')
      .select('*, started_snapshot, workflow_templates(*)')
      .eq('id', workflowInstanceId)
      .single();

    if (instanceError || !instance) {
      return { success: false, error: 'Workflow instance not found' };
    }

    // Use snapshot data if available (for workflow independence from template changes)
    // Fall back to querying live tables for backwards compatibility with older instances
    let nodes: any[];
    let connections: any[];

    if (instance.started_snapshot?.nodes && instance.started_snapshot?.connections) {
      // Use the snapshot - this ensures template changes don't affect in-progress workflows
      nodes = instance.started_snapshot.nodes;
      connections = instance.started_snapshot.connections;
      console.log('[Workflow] Using snapshot data for instance:', workflowInstanceId);
    } else {
      // Fallback for older instances without snapshot - query live tables
      console.log('[Workflow] No snapshot found, querying live tables for instance:', workflowInstanceId);
      const { data: liveNodes } = await supabase
        .from('workflow_nodes')
        .select('*')
        .eq('workflow_template_id', instance.workflow_template_id);

      const { data: liveConnections } = await supabase
        .from('workflow_connections')
        .select('*')
        .eq('workflow_template_id', instance.workflow_template_id);

      nodes = liveNodes || [];
      connections = liveConnections || [];
    }

    const currentNode = nodes?.find((n: any) => n.id === instance.current_node_id);
    if (!currentNode) {
      return { success: false, error: 'Current node not found in workflow' };
    }

    // AUTHORIZATION: Check if user can progress this workflow step
    // Superadmins bypass all checks
    const isSuperadmin = await isUserSuperadmin(supabase, currentUserId);

    if (!isSuperadmin) {
      // 1. PROJECT ASSIGNMENT CHECK: User must be assigned to the project
      if (instance.project_id) {
        const isAssigned = await isUserAssignedToProject(supabase, currentUserId, instance.project_id);
        if (!isAssigned) {
          return {
            success: false,
            error: 'You must be assigned to this project to advance the workflow'
          };
        }
      }

      // 2. ENTITY VALIDATION: Check based on node type
      if (currentNode.entity_id) {
        if (currentNode.node_type === 'role' || currentNode.node_type === 'approval') {
          // For role and approval nodes, entity_id is a role_id
          const hasRequiredRole = await userHasRole(supabase, currentUserId, currentNode.entity_id);

          if (!hasRequiredRole) {
            // Get the role name for a better error message
            const { data: requiredRole } = await supabase
              .from('roles')
              .select('name')
              .eq('id', currentNode.entity_id)
              .single();

            const roleName = requiredRole?.name || 'the required role';
            return {
              success: false,
              error: `Only users with the "${roleName}" role can advance this workflow step`
            };
          }
        } else if (currentNode.node_type === 'department') {
          // For department nodes, entity_id is a department_id
          // Check if user has any role in this department
          const { data: userDeptRoles } = await supabase
            .from('user_roles')
            .select('roles!inner(department_id)')
            .eq('user_id', currentUserId)
            .eq('roles.department_id', currentNode.entity_id);

          if (!userDeptRoles || userDeptRoles.length === 0) {
            // Get department name for error message
            const { data: dept } = await supabase
              .from('departments')
              .select('name')
              .eq('id', currentNode.entity_id)
              .single();

            const deptName = dept?.name || 'the required department';
            return {
              success: false,
              error: `Only users in the "${deptName}" department can advance this workflow step`
            };
          }
        }
        // For form, conditional, start, end nodes - no entity validation needed
      }
    }

    // Determine next node based on node type and decision
    let nextNode;
    if (currentNode.node_type === 'conditional') {
      // Legacy support for existing workflows with conditional nodes
      nextNode = findConditionalNextNode(currentNode, decision, connections, nodes);
    } else if (currentNode.node_type === 'approval' && decision) {
      // Approval nodes can have multiple outgoing paths based on decision
      nextNode = findDecisionBasedNextNode(currentNode, decision, connections, nodes);
    } else {
      nextNode = findNextNode(currentNode.id, connections, nodes);
    }

    // If approval node, record the approval
    if (currentNode.node_type === 'approval' && decision) {
      await supabase.from('workflow_approvals').insert({
        workflow_instance_id: workflowInstanceId,
        node_id: currentNode.id,
        approver_user_id: currentUserId,
        decision,
        feedback,
      });
    }

    // Update workflow instance
    let isComplete = !nextNode || nextNode.node_type === 'end';
    await supabase
      .from('workflow_instances')
      .update({
        current_node_id: nextNode?.id || null,
        status: isComplete ? 'completed' : 'active',
        completed_at: isComplete ? new Date().toISOString() : null,
      })
      .eq('id', workflowInstanceId);

    // AUTO-ADVANCE: If we landed on a conditional node, immediately route through it
    // This makes conditional nodes invisible to users - they just see the destination
    if (nextNode?.node_type === 'conditional' && decision) {
      const conditionalNode = nextNode; // Save reference to conditional node
      const finalNode = findConditionalNextNode(conditionalNode, decision, connections, nodes);

      if (finalNode) {
        // Update to final destination, skipping the conditional
        isComplete = finalNode.node_type === 'end';
        await supabase
          .from('workflow_instances')
          .update({
            current_node_id: finalNode.id,
            status: isComplete ? 'completed' : 'active',
            completed_at: isComplete ? new Date().toISOString() : null,
          })
          .eq('id', workflowInstanceId);

        // Add history entry for conditional auto-advance
        await supabase.from('workflow_history').insert({
          workflow_instance_id: workflowInstanceId,
          from_node_id: conditionalNode.id,
          to_node_id: finalNode.id,
          handed_off_by: currentUserId,
          notes: `Auto-routed based on decision: ${decision}`,
        });

        // Update nextNode for subsequent processing (assignments, completion)
        nextNode = finalNode;
      }
    }

    // Add current user to project_contributors (they participated in this workflow step)
    if (instance.project_id) {
      await supabase
        .from('project_contributors')
        .upsert({
          project_id: instance.project_id,
          user_id: currentUserId,
          contribution_type: 'workflow',
          last_contributed_at: new Date().toISOString(),
        }, { onConflict: 'project_id,user_id' });
    }

    // Create workflow history entry
    // If inline form data is provided (from workflow builder forms), store it in the notes field as JSON
    const notesContent = inlineFormData
      ? JSON.stringify({ type: 'inline_form', data: inlineFormData })
      : null;

    const { data: historyEntry } = await supabase.from('workflow_history').insert({
      workflow_instance_id: workflowInstanceId,
      from_node_id: currentNode.id,
      to_node_id: nextNode?.id || null,
      handed_off_by: currentUserId,
      approval_decision: decision,
      approval_feedback: feedback,
      form_response_id: formResponseId,
      notes: notesContent,
    }).select('id').single();

    const workflowHistoryId = historyEntry?.id || null;

    // AUTO-CREATE PROJECT ISSUE ON REJECTION
    // When a workflow step is rejected, automatically create a project issue
    // to track the rejection reason and ensure it's visible in the project's Issues tab
    if (decision === 'rejected' && instance.project_id) {
      const issueContent = `**Workflow Rejected**: ${currentNode.label}\n\n` +
        `Workflow: ${instance.workflow_templates?.name || 'Unknown'}\n` +
        `Reason: ${feedback || 'No reason provided'}`;

      await supabase.from('project_issues').insert({
        project_id: instance.project_id,
        content: issueContent,
        status: 'open',
        created_by: currentUserId,
        workflow_history_id: workflowHistoryId,
      });
    }

    // AUTO-CREATE PROJECT UPDATE ON ALL PROGRESSIONS
    // Document every workflow step transition in the project's Updates tab
    // This provides a visible timeline of project progress
    if (instance.project_id) {
      let updateContent = '';

      if (decision === 'approved') {
        updateContent = `**Approved**: ${currentNode.label} → ${nextNode?.label || 'Complete'}` +
          (feedback ? `\nNotes: ${feedback}` : '');
      } else if (decision === 'rejected') {
        updateContent = `**Rejected**: ${currentNode.label}\n` +
          `Reason: ${feedback || 'No reason provided'}`;
      } else {
        updateContent = `**Progressed**: ${currentNode.label} → ${nextNode?.label || 'Complete'}`;
      }

      // NOTE: Form data is NOT included in project updates.
      // It is stored in workflow_history.notes and displayed in the dedicated
      // "Workflow Form Data" section on the project page.

      await supabase.from('project_updates').insert({
        project_id: instance.project_id,
        content: updateContent,
        created_by: currentUserId,
        workflow_history_id: workflowHistoryId,
      });
    }

    // Handle workflow completion or progression
    if (isComplete && instance.project_id) {
      // Workflow reached end - mark project as completed
      await completeProject(supabase, instance.project_id);
    } else if (nextNode && instance.project_id) {
      // Assign to next node's user (use assignedUserId if provided, otherwise assign to all users in role)
      await assignProjectToNode(supabase, instance.project_id, nextNode, currentUserId, assignedUserId);
    }

    return { success: true, nextNode };
  } catch (error) {
    console.error('Error progressing workflow:', error);
    return { success: false, error: 'Internal server error' };
  }
}

/**
 * Find next node in workflow
 */
function findNextNode(
  currentNodeId: string,
  connections: any[] | null,
  nodes: any[] | null
): any | null {
  if (!connections || !nodes) return null;

  const connection = connections.find((c) => c.from_node_id === currentNodeId);
  if (!connection) return null;

  return nodes.find((n) => n.id === connection.to_node_id);
}

/**
 * Find next node for conditional routing (legacy support)
 */
function findConditionalNextNode(
  conditionalNode: any,
  decision: string | undefined,
  connections: any[] | null,
  nodes: any[] | null
): any | null {
  if (!connections || !nodes || !decision) {
    return findNextNode(conditionalNode.id, connections, nodes);
  }

  // Find connection that matches the decision
  // Check both condition.decision AND condition.conditionValue for compatibility
  // (database stores conditionValue, but some code may use decision)
  const matchingConnection = connections.find(
    (c) =>
      c.from_node_id === conditionalNode.id &&
      (c.condition?.decision === decision || c.condition?.conditionValue === decision)
  );

  if (!matchingConnection) {
    // Fall back to default path
    return findNextNode(conditionalNode.id, connections, nodes);
  }

  return nodes.find((n) => n.id === matchingConnection.to_node_id);
}

/**
 * Find next node for approval nodes with decision-based routing
 * This is the new pattern where approval nodes directly have multiple outgoing edges
 */
function findDecisionBasedNextNode(
  approvalNode: any,
  decision: string,
  connections: any[] | null,
  nodes: any[] | null
): any | null {
  if (!connections || !nodes) {
    return null;
  }

  // Find connection from this approval node with matching decision
  // Check both condition.decision and condition.conditionValue for compatibility
  const matchingConnection = connections.find(
    (c) =>
      c.from_node_id === approvalNode.id &&
      (c.condition?.decision === decision || c.condition?.conditionValue === decision)
  );

  if (matchingConnection) {
    return nodes.find((n) => n.id === matchingConnection.to_node_id) || null;
  }

  // Fall back to default path (connection without decision label)
  const defaultConnection = connections.find(
    (c) =>
      c.from_node_id === approvalNode.id &&
      !c.condition?.decision &&
      !c.condition?.conditionValue
  );

  if (defaultConnection) {
    return nodes.find((n) => n.id === defaultConnection.to_node_id) || null;
  }

  // If no matching or default path, just follow the first connection
  return findNextNode(approvalNode.id, connections, nodes);
}

/**
 * Evaluate a single form condition against submitted form data
 * Returns true if the condition is satisfied
 */
function evaluateFormCondition(
  condition: {
    sourceFormFieldId?: string;
    conditionType?: string;
    value?: string;
    value2?: string;
  },
  formData: Record<string, any>
): boolean {
  if (!condition.sourceFormFieldId || !condition.conditionType) {
    return false;
  }

  const fieldValue = formData[condition.sourceFormFieldId];
  const conditionValue = condition.value;
  const conditionValue2 = condition.value2;

  // Handle null/undefined field values
  const fieldStr = fieldValue !== null && fieldValue !== undefined ? String(fieldValue) : '';
  const conditionStr = conditionValue !== null && conditionValue !== undefined ? String(conditionValue) : '';

  switch (condition.conditionType) {
    // Text/String conditions
    case 'equals':
      return fieldStr.toLowerCase() === conditionStr.toLowerCase();

    case 'contains':
      return fieldStr.toLowerCase().includes(conditionStr.toLowerCase());

    case 'starts_with':
      return fieldStr.toLowerCase().startsWith(conditionStr.toLowerCase());

    case 'ends_with':
      return fieldStr.toLowerCase().endsWith(conditionStr.toLowerCase());

    case 'is_empty':
      return fieldValue === undefined || fieldValue === null || fieldValue === '' ||
             (Array.isArray(fieldValue) && fieldValue.length === 0);

    case 'is_not_empty':
      return fieldValue !== undefined && fieldValue !== null && fieldValue !== '' &&
             !(Array.isArray(fieldValue) && fieldValue.length === 0);

    // Number conditions
    case 'greater_than':
      return Number(fieldValue) > Number(conditionValue);

    case 'less_than':
      return Number(fieldValue) < Number(conditionValue);

    case 'greater_or_equal':
      return Number(fieldValue) >= Number(conditionValue);

    case 'less_or_equal':
      return Number(fieldValue) <= Number(conditionValue);

    case 'between':
      const numVal = Number(fieldValue);
      return numVal >= Number(conditionValue) && numVal <= Number(conditionValue2);

    // Date conditions
    case 'before':
      return new Date(fieldValue) < new Date(conditionValue!);

    case 'after':
      return new Date(fieldValue) > new Date(conditionValue!);

    // Checkbox conditions
    case 'is_checked':
      return fieldValue === true || fieldValue === 'true' || fieldValue === 'yes';

    case 'is_not_checked':
      return fieldValue === false || fieldValue === 'false' || fieldValue === 'no' || !fieldValue;

    default:
      console.warn(`[evaluateFormCondition] Unknown condition type: ${condition.conditionType}`);
      return false;
  }
}

/**
 * Find next node for conditional routing based on form data evaluation
 * Evaluates conditions defined in the connection's condition object
 */
function findConditionalNextNodeWithFormData(
  conditionalNode: any,
  formData: Record<string, any>,
  connections: any[] | null,
  nodes: any[] | null
): any | null {
  if (!connections || !nodes) {
    return null;
  }

  // Get all outgoing connections from this conditional node
  const outgoingConnections = connections.filter(c => c.from_node_id === conditionalNode.id);

  console.log('[findConditionalNextNodeWithFormData] Evaluating conditional routing:', {
    conditionalNodeId: conditionalNode.id,
    conditionalNodeLabel: conditionalNode.label,
    formDataKeys: Object.keys(formData),
    formDataValues: formData, // Log actual values for debugging
    outgoingConnectionCount: outgoingConnections.length,
    connectionConditions: outgoingConnections.map(c => ({
      toNodeId: c.to_node_id,
      hasCondition: !!c.condition,
      conditionType: c.condition?.conditionType,
      sourceFormFieldId: c.condition?.sourceFormFieldId,
      value: c.condition?.value
    }))
  });

  // Try each connection's condition
  for (const connection of outgoingConnections) {
    const condition = connection.condition;

    // Skip if no condition defined
    if (!condition) continue;

    // Check if this is a form-based condition (has sourceFormFieldId)
    if (condition.sourceFormFieldId && condition.conditionType) {
      const matches = evaluateFormCondition(condition, formData);
      console.log('[findConditionalNextNodeWithFormData] Condition evaluation:', {
        fieldId: condition.sourceFormFieldId,
        conditionType: condition.conditionType,
        expectedValue: condition.value,
        actualValue: formData[condition.sourceFormFieldId],
        matches
      });

      if (matches) {
        const targetNode = nodes.find(n => n.id === connection.to_node_id);
        console.log('[findConditionalNextNodeWithFormData] Found matching condition path:', targetNode?.label);
        return targetNode || null;
      }
    }
  }

  // No form-based condition matched - look for default path
  // Default path is a connection without form condition (no sourceFormFieldId)
  const defaultConnection = outgoingConnections.find(c =>
    !c.condition ||
    (!c.condition.sourceFormFieldId && !c.condition.decision && !c.condition.conditionValue)
  );

  if (defaultConnection) {
    const defaultNode = nodes.find(n => n.id === defaultConnection.to_node_id);
    console.log('[findConditionalNextNodeWithFormData] Using default path:', defaultNode?.label);
    return defaultNode || null;
  }

  // Last resort - use first connection
  if (outgoingConnections.length > 0) {
    const fallbackNode = nodes.find(n => n.id === outgoingConnections[0].to_node_id);
    console.log('[findConditionalNextNodeWithFormData] Using fallback (first connection):', fallbackNode?.label);
    return fallbackNode || null;
  }

  return null;
}

/**
 * Assign project to user(s) based on workflow node
 * Also handles removing previous assignments (except project creator)
 */
async function assignProjectToNode(
  supabase: SupabaseClient,
  projectId: string,
  node: any,
  assignedBy: string,
  specificUserId?: string
): Promise<void> {
  if (!supabase) return;

  try {
    // Get project creator to preserve their access
    const { data: project } = await supabase
      .from('projects')
      .select('account_id, created_by')
      .eq('id', projectId)
      .single();

    const creatorId = project?.created_by;

    // Mark all current assignments as removed (except for the project creator)
    // This ensures previous workflow step users lose active access
    await supabase
      .from('project_assignments')
      .update({ removed_at: new Date().toISOString() })
      .eq('project_id', projectId)
      .is('removed_at', null)
      .neq('user_id', creatorId || '00000000-0000-0000-0000-000000000000');

    // Get users for the role/entity
    let userIds: string[] = [];

    // If a specific user was assigned, use only that user
    if (specificUserId) {
      userIds = [specificUserId];
    } else if (node.entity_id) {
      // Otherwise, get all users with this role
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role_id', node.entity_id);

      userIds = userRoles?.map((ur: any) => ur.user_id) || [];
    }

    // Create project assignments for each user (including re-adding creator if needed)
    if (userIds.length > 0) {
      // Also ensure creator keeps active assignment
      if (creatorId && !userIds.includes(creatorId)) {
        userIds.push(creatorId);
      }

      for (const userId of userIds) {
        // Try to update existing removed assignment first, otherwise insert new
        const { data: existing } = await supabase
          .from('project_assignments')
          .select('id')
          .eq('project_id', projectId)
          .eq('user_id', userId)
          .single();

        if (existing) {
          // Reactivate existing assignment
          await supabase
            .from('project_assignments')
            .update({
              removed_at: null,
              role_in_project: userId === creatorId ? 'creator' : node.node_type,
              assigned_by: assignedBy
            })
            .eq('id', existing.id);
        } else {
          // Insert new assignment
          await supabase.from('project_assignments').insert({
            project_id: projectId,
            user_id: userId,
            role_in_project: userId === creatorId ? 'creator' : node.node_type,
            assigned_by: assignedBy,
          });
        }

        // Add to project_contributors for time tracking history
        await supabase
          .from('project_contributors')
          .upsert({
            project_id: projectId,
            user_id: userId,
            contribution_type: 'workflow',
            last_contributed_at: new Date().toISOString(),
          }, { onConflict: 'project_id,user_id' });
      }

      // Grant account access if needed
      if (project) {
        const accountMembers = userIds.map((userId) => ({
          user_id: userId,
          account_id: project.account_id,
        }));

        // Insert account members (ignore duplicates)
        await supabase
          .from('account_members')
          .upsert(accountMembers, { onConflict: 'user_id,account_id', ignoreDuplicates: true });
      }
    }
  } catch (error) {
    console.error('Error assigning project to node:', error);
  }
}

/**
 * Assign project to multiple parallel nodes at once
 * This is used when a workflow forks into parallel branches with different user assignments
 * We remove old assignments ONCE, then add all new assignments together
 */
async function assignProjectToParallelNodes(
  supabase: SupabaseClient,
  projectId: string,
  assignments: Array<{ node: any; userId: string | null }>,
  assignedBy: string
): Promise<void> {
  if (!supabase || assignments.length === 0) return;

  try {
    // Get project creator to preserve their access
    const { data: project } = await supabase
      .from('projects')
      .select('account_id, created_by')
      .eq('id', projectId)
      .single();

    const creatorId = project?.created_by;

    // Mark all current assignments as removed ONCE (except for the project creator)
    await supabase
      .from('project_assignments')
      .update({ removed_at: new Date().toISOString() })
      .eq('project_id', projectId)
      .is('removed_at', null)
      .neq('user_id', creatorId || '00000000-0000-0000-0000-000000000000');

    // Collect all users to assign from all parallel branches
    const allUserIds = new Set<string>();

    // For each assignment, add the specific user or all users in the role
    for (const assignment of assignments) {
      if (assignment.userId) {
        // Specific user assigned
        allUserIds.add(assignment.userId);
      } else if (assignment.node.entity_id) {
        // Get all users with this role
        const { data: userRoles } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role_id', assignment.node.entity_id);

        userRoles?.forEach((ur: any) => allUserIds.add(ur.user_id));
      }
    }

    // Always include the creator
    if (creatorId) {
      allUserIds.add(creatorId);
    }

    // Create/update project assignments for each user
    for (const userId of allUserIds) {
      const roleInProject = userId === creatorId ? 'creator' : 'workflow';

      // Try to update existing removed assignment first, otherwise insert new
      const { data: existing } = await supabase
        .from('project_assignments')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .single();

      if (existing) {
        // Reactivate existing assignment
        await supabase
          .from('project_assignments')
          .update({
            removed_at: null,
            role_in_project: roleInProject,
            assigned_by: assignedBy
          })
          .eq('id', existing.id);
      } else {
        // Insert new assignment
        await supabase.from('project_assignments').insert({
          project_id: projectId,
          user_id: userId,
          role_in_project: roleInProject,
          assigned_by: assignedBy,
        });
      }

      // Add to project_contributors for time tracking history
      await supabase
        .from('project_contributors')
        .upsert({
          project_id: projectId,
          user_id: userId,
          contribution_type: 'workflow',
          last_contributed_at: new Date().toISOString(),
        }, { onConflict: 'project_id,user_id' });
    }

    // Grant account access if needed
    if (project) {
      const accountMembers = Array.from(allUserIds).map((userId) => ({
        user_id: userId,
        account_id: project.account_id,
      }));

      // Insert account members (ignore duplicates)
      await supabase
        .from('account_members')
        .upsert(accountMembers, { onConflict: 'user_id,account_id', ignoreDuplicates: true });
    }

    console.log('Assigned project to parallel nodes:', {
      projectId,
      userCount: allUserIds.size,
      nodeCount: assignments.length
    });
  } catch (error) {
    console.error('Error assigning project to parallel nodes:', error);
  }
}

/**
 * Mark project as completed - removes from all active dashboards
 */
async function completeProject(
  supabase: SupabaseClient,
  projectId: string
): Promise<void> {
  if (!supabase) return;

  try {
    // Update project status and completion timestamp
    await supabase
      .from('projects')
      .update({
        status: 'complete',
        completed_at: new Date().toISOString()
      })
      .eq('id', projectId);

    // Mark all project assignments as removed
    // Everyone loses active access when project is complete
    await supabase
      .from('project_assignments')
      .update({ removed_at: new Date().toISOString() })
      .eq('project_id', projectId)
      .is('removed_at', null);

    // Auto-resolve all open issues for this project
    // When a project is complete, any open issues are automatically resolved
    const { data: resolvedIssues } = await supabase
      .from('project_issues')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString()
      })
      .eq('project_id', projectId)
      .eq('status', 'open')
      .select('id');

    const resolvedCount = resolvedIssues?.length || 0;
    console.log('Project completed:', {
      projectId,
      resolvedIssuesCount: resolvedCount
    });
  } catch (error) {
    console.error('Error completing project:', error);
  }
}

/**
 * Get user's pending workflow tasks (approvals and forms)
 * Note: Function name kept as "getUserPendingApprovals" for backwards compatibility,
 * but now returns both approval nodes AND form nodes
 *
 * IMPORTANT: This now queries workflow_active_steps to support parallel workflows
 * where multiple approval/form nodes can be active simultaneously
 */
export async function getUserPendingApprovals(supabase: SupabaseClient, userId: string): Promise<any[]> {
  if (!supabase) return [];

  try {
    // Get user's roles
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role_id')
      .eq('user_id', userId);

    const roleIds = userRoles?.map((ur) => ur.role_id) || [];
    // Note: Don't return early if roleIds is empty - user may still have direct assignments via assigned_user_id

    // Query workflow_active_steps to get ALL active steps (supports parallel workflows)
    // NOTE: We don't join workflow_nodes because the FK may not exist after template modifications
    // We use snapshot data from workflow_instances.started_snapshot instead
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
        )
      `)
      .eq('status', 'active');

    if (error) {
      console.error('Error querying active workflow steps:', error);
      return [];
    }

    // Pre-fetch workflow_node_assignments for this user
    // This allows us to check if user is assigned to specific nodes in any workflow instance
    const { data: nodeAssignments } = await supabase
      .from('workflow_node_assignments')
      .select('workflow_instance_id, node_id')
      .eq('user_id', userId);

    // Create a set of "instanceId:nodeId" keys for quick lookup
    const assignedNodeKeys = new Set<string>(
      (nodeAssignments || []).map((na: any) => `${na.workflow_instance_id}:${na.node_id}`)
    );

    // Filter to only approval/form nodes where the user is assigned or has the required role
    const filteredSteps = (activeSteps || []).filter((step: any) => {
      const instance = step.workflow_instances;
      if (!instance) return false;

      // Only include active workflow instances
      if (instance.status !== 'active') return false;

      // Get node data from snapshot (we don't join workflow_nodes because FK may not exist)
      const node = instance.started_snapshot?.nodes?.find((n: any) => n.id === step.node_id);

      if (!node) {
        console.warn('Could not find node data for active step:', {
          stepId: step.id,
          nodeId: step.node_id,
          hasSnapshot: !!instance.started_snapshot
        });
        return false;
      }

      // Check if node is approval or form type
      if (!['approval', 'form'].includes(node.node_type)) return false;

      // CHECK 1: User is specifically assigned to this step (e.g., sync leader, manual assignment)
      if (step.assigned_user_id === userId) {
        console.log('Pending approval matched via assigned_user_id:', { stepId: step.id, nodeLabel: node.label });
        return true;
      }

      // CHECK 2: User is assigned via workflow_node_assignments table
      const nodeKey = `${step.workflow_instance_id}:${step.node_id}`;
      if (assignedNodeKeys.has(nodeKey)) {
        console.log('Pending approval matched via workflow_node_assignments:', { stepId: step.id, nodeLabel: node.label });
        return true;
      }

      // CHECK 3: User has the required role for this node
      if (node.entity_id && roleIds.includes(node.entity_id)) {
        console.log('Pending approval matched via role:', { stepId: step.id, nodeLabel: node.label, entityId: node.entity_id });
        return true;
      }

      // No match - user is not assigned and doesn't have the role
      return false;
    });

    // Transform to match expected format (for backwards compatibility)
    const result = filteredSteps.map((step: any) => {
      // Get node data from snapshot (always use snapshot since we don't join workflow_nodes)
      const nodeData = step.workflow_instances.started_snapshot?.nodes?.find((n: any) => n.id === step.node_id);

      return {
        ...step.workflow_instances,
        workflow_nodes: nodeData,
        projects: step.workflow_instances.projects,
        active_step_id: step.id,
        current_node_id: step.node_id, // Override with this specific step's node
        assigned_user_id: step.assigned_user_id // Include for debugging
      };
    });

    console.log('Pending approvals query (parallel-aware):', {
      userId,
      roleIds,
      totalActiveSteps: activeSteps?.length || 0,
      nodeAssignmentCount: nodeAssignments?.length || 0,
      filteredCount: result.length
    });

    return result;
  } catch (error) {
    console.error('Error fetching pending workflow tasks:', error);
    return [];
  }
}

/**
 * Get user's active projects (where they're working, not approving)
 * @param supabase - Authenticated Supabase client
 * @param userId - User ID to get projects for
 */
export async function getUserActiveProjects(supabase: SupabaseClient, userId: string): Promise<any[]> {
  if (!supabase) return [];

  try {
    const { data: projects } = await supabase
      .from('project_assignments')
      .select(`
        *,
        projects(*),
        workflow_instances:projects(workflow_instance_id, workflow_instances(*))
      `)
      .eq('user_id', userId)
      .is('removed_at', null);

    // Filter out completed projects - they should only appear in "Finished Projects" section
    const activeProjects = (projects || []).filter((p: any) =>
      p.projects && p.projects.status !== 'complete'
    );

    return activeProjects;
  } catch (error) {
    console.error('Error fetching active projects:', error);
    return [];
  }
}

// ==========================================
// PARALLEL WORKFLOW EXECUTION SUPPORT
// ==========================================

/**
 * Get all active steps for a workflow instance
 */
export async function getActiveSteps(
  supabase: SupabaseClient,
  workflowInstanceId: string
): Promise<WorkflowActiveStep[]> {
  if (!supabase) return [];

  const { data: steps, error } = await supabase
    .from('workflow_active_steps')
    .select('*')
    .eq('workflow_instance_id', workflowInstanceId)
    .eq('status', 'active')
    .order('activated_at', { ascending: true });

  if (error) {
    console.error('Error fetching active steps:', error);
    return [];
  }

  return steps || [];
}

/**
 * Get all active steps (including waiting) for a workflow instance
 */
export async function getAllActiveAndWaitingSteps(
  supabase: SupabaseClient,
  workflowInstanceId: string
): Promise<WorkflowActiveStep[]> {
  if (!supabase) return [];

  const { data: steps, error } = await supabase
    .from('workflow_active_steps')
    .select('*')
    .eq('workflow_instance_id', workflowInstanceId)
    .in('status', ['active', 'waiting'])
    .order('activated_at', { ascending: true });

  if (error) {
    console.error('Error fetching active/waiting steps:', error);
    return [];
  }

  return steps || [];
}

/**
 * Cancel all parallel sibling branches and waiting sync nodes
 * Called when a parallel branch rejects and routes back past the fork point
 * This ensures the workflow can cleanly restart from the rejection target (e.g., Form Node)
 *
 * Now includes flow ID tracking to:
 * 1. Only cancel steps from the same parallel flow iteration
 * 2. Also cancel orphaned steps that progressed past the sync (e.g., Videographer)
 */
async function cancelParallelSiblingsAndSyncNodes(
  supabase: SupabaseClient,
  workflowInstanceId: string,
  currentBranchId: string,
  currentStepId?: string
): Promise<{ cancelledCount: number }> {
  if (!supabase || !currentBranchId) {
    return { cancelledCount: 0 };
  }

  // Use the new helper functions for proper branch identification
  const forkPointBranch = extractForkPointBranch(currentBranchId);
  const currentFlowId = extractFlowId(currentBranchId);

  // If we can't identify a fork point or this is already at the base level, nothing to cancel
  if (forkPointBranch === currentBranchId) {
    return { cancelledCount: 0 };
  }

  // Find all sibling active/waiting steps to cancel
  // This includes: other parallel branches, waiting sync nodes, and orphaned post-sync steps
  const { data: stepsToCancel, error: fetchError } = await supabase
    .from('workflow_active_steps')
    .select('id, branch_id, status, node_id')
    .eq('workflow_instance_id', workflowInstanceId)
    .in('status', ['active', 'waiting']);

  if (fetchError || !stepsToCancel) {
    console.error('Error fetching steps to cancel:', fetchError);
    return { cancelledCount: 0 };
  }

  // Filter to sibling branches (same fork point) and same flow iteration
  // Also include orphaned steps that progressed past the sync
  const siblingSteps = stepsToCancel.filter((step: any) => {
    // Skip the current step (it will be marked completed normally)
    if (currentStepId && step.id === currentStepId) return false;

    // Include ALL waiting steps from the same flow (at sync nodes)
    if (step.status === 'waiting') {
      // If we have a flow ID, only cancel same-flow waiting steps
      if (currentFlowId) {
        const stepFlowId = extractFlowId(step.branch_id);
        return stepFlowId === currentFlowId;
      }
      // No flow ID - cancel all waiting steps (backwards compatibility)
      return true;
    }

    // For active steps, check if they're siblings from the same flow
    if (step.branch_id) {
      const stepFlowId = extractFlowId(step.branch_id);
      const stepForkPoint = extractForkPointBranch(step.branch_id);

      // If we have flow IDs, only cancel same-flow steps
      if (currentFlowId && stepFlowId && stepFlowId !== currentFlowId) {
        return false;
      }

      // Include sibling parallel branches (same fork point)
      if (stepForkPoint === forkPointBranch) return true;

      // Include steps on the fork point branch itself (orphaned post-sync steps)
      // This catches cases where the sync released and created a step at Videographer
      if (step.branch_id === forkPointBranch) return true;
    }

    return false;
  });

  if (siblingSteps.length === 0) {
    return { cancelledCount: 0 };
  }

  const stepIds = siblingSteps.map((s: any) => s.id);

  // Cancel all sibling steps
  const { error: updateError } = await supabase
    .from('workflow_active_steps')
    .update({
      status: 'cancelled',
      completed_at: new Date().toISOString()
    })
    .in('id', stepIds);

  if (updateError) {
    console.error('Error cancelling sibling steps:', updateError);
    return { cancelledCount: 0 };
  }

  console.log('Cancelled parallel siblings and sync waiters:', {
    workflowInstanceId,
    currentBranchId,
    forkPointBranch,
    currentFlowId,
    cancelledSteps: siblingSteps.map((s: any) => ({ id: s.id, branch: s.branch_id, status: s.status }))
  });

  // Phase 2: Cancel any downstream orphaned steps
  // These are steps that were created after the sync node completed
  // but are now orphaned because we're going back before the sync
  const cancelledNodeIds = siblingSteps.map((s: any) => s.node_id);

  // Get workflow connections to find downstream nodes
  const { data: instance } = await supabase
    .from('workflow_instances')
    .select('workflow_template_id')
    .eq('id', workflowInstanceId)
    .single();

  if (instance?.workflow_template_id) {
    const { data: connections } = await supabase
      .from('workflow_connections')
      .select('from_node_id, to_node_id')
      .eq('workflow_template_id', instance.workflow_template_id);

    if (connections && connections.length > 0) {
      // Find all downstream node IDs from cancelled nodes
      const downstreamNodeIds = new Set<string>();
      // Create local reference for closure to avoid TypeScript null check issues
      const safeConnections = connections;

      function findDownstream(nodeId: string, visited: Set<string> = new Set()) {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);

        const outgoing = safeConnections.filter((c: any) => c.from_node_id === nodeId);
        for (const conn of outgoing) {
          downstreamNodeIds.add(conn.to_node_id);
          findDownstream(conn.to_node_id, visited);
        }
      }

      // Find downstream from each cancelled node
      cancelledNodeIds.forEach((nodeId: string) => findDownstream(nodeId));

      if (downstreamNodeIds.size > 0) {
        // Cancel any active/waiting steps at downstream nodes (same flow)
        const { data: downstreamSteps } = await supabase
          .from('workflow_active_steps')
          .select('id, branch_id, node_id')
          .eq('workflow_instance_id', workflowInstanceId)
          .in('status', ['active', 'waiting'])
          .in('node_id', Array.from(downstreamNodeIds));

        const orphanedDownstreamSteps = (downstreamSteps || []).filter((step: any) => {
          // Skip steps we already cancelled
          if (stepIds.includes(step.id)) return false;
          // If we have a flow ID, only cancel same-flow steps
          if (currentFlowId) {
            const stepFlowId = extractFlowId(step.branch_id);
            return stepFlowId === currentFlowId || stepFlowId === null;
          }
          return true;
        });

        if (orphanedDownstreamSteps.length > 0) {
          const downstreamStepIds = orphanedDownstreamSteps.map((s: any) => s.id);

          await supabase
            .from('workflow_active_steps')
            .update({
              status: 'cancelled',
              completed_at: new Date().toISOString()
            })
            .in('id', downstreamStepIds);

          console.log('Cancelled downstream orphaned steps:', {
            count: downstreamStepIds.length,
            steps: orphanedDownstreamSteps.map((s: any) => ({ id: s.id, nodeId: s.node_id }))
          });

          return { cancelledCount: siblingSteps.length + downstreamStepIds.length };
        }
      }
    }
  }

  return { cancelledCount: siblingSteps.length };
}

/**
 * Find ALL next nodes from a given node (for fork detection)
 * Returns array of nodes connected by outgoing edges
 */
function findNextNodes(
  currentNodeId: string,
  connections: any[] | null,
  nodes: any[] | null
): any[] {
  if (!connections || !nodes) return [];

  const outgoingConnections = connections.filter((c) => c.from_node_id === currentNodeId);
  return outgoingConnections
    .map((c) => nodes.find((n) => n.id === c.to_node_id))
    .filter(Boolean);
}

/**
 * Check if a node is a fork point (multiple outgoing connections without decision conditions)
 */
function isForkPoint(nodeId: string, connections: any[] | null): boolean {
  if (!connections) return false;

  // Get all outgoing connections
  const outgoing = connections.filter((c) => c.from_node_id === nodeId);

  // A fork point has multiple outgoing connections that are NOT decision-based
  // Decision-based edges have condition.decision or condition.conditionValue set
  const nonDecisionOutgoing = outgoing.filter(
    (c) => !c.condition?.decision && !c.condition?.conditionValue
  );

  return nonDecisionOutgoing.length > 1;
}

/**
 * Generate a flow ID for tracking parallel iterations
 * Each time the workflow forks into parallel branches, a new flow ID is generated
 * This allows us to distinguish between different "generations" of parallel execution
 */
function generateFlowId(): string {
  return Date.now().toString(36);
}

/**
 * Extract flow ID from a branch ID
 * Handles both old format (main-0-timestamp) and new format (main-0_flowid)
 */
function extractFlowId(branchId: string): string | null {
  if (!branchId) return null;

  // New format: main-0_flowid -> extract flowid after underscore
  const underscoreMatch = branchId.match(/_([a-z0-9]+)$/);
  if (underscoreMatch) return underscoreMatch[1];

  // Old format: main-0-timestamp -> last segment might be timestamp
  // Timestamps are 6+ alphanumeric characters that aren't purely numeric
  const parts = branchId.split('-');
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1];
    if (/^[a-z0-9]{6,}$/.test(lastPart) && !/^\d+$/.test(lastPart)) {
      return lastPart;
    }
  }

  return null;
}

/**
 * Extract the fork point branch ID from a nested branch ID
 * This handles both old format (main-0-timestamp) and new format (main-0_timestamp)
 *
 * Examples:
 * - "main-0_abc123" -> "main"
 * - "main-1-xyz789" -> "main" (old format)
 * - "main-0_abc-1_def" -> "main" (nested forks)
 * - "main" -> "main"
 */
function extractForkPointBranch(branchId: string): string {
  if (!branchId || branchId === 'main') return 'main';

  // Remove timestamp suffixes (after underscore) for new format
  let cleaned = branchId.replace(/_[a-z0-9]+/g, '');

  // Now extract the parent before the fork indices
  const parts = cleaned.split('-');

  // Keep removing trailing segments that are:
  // 1. Purely numeric (branch indices like "0", "1")
  // 2. Look like old-format timestamps (6+ alphanumeric)
  while (parts.length > 1) {
    const lastPart = parts[parts.length - 1];
    // Remove if it's a number (branch index)
    if (/^\d+$/.test(lastPart)) {
      parts.pop();
      continue;
    }
    // Remove if it looks like an old timestamp (6+ alphanumeric chars)
    if (/^[a-z0-9]{6,}$/.test(lastPart)) {
      parts.pop();
      continue;
    }
    // Otherwise stop - this is part of the actual branch name
    break;
  }

  return parts.join('-') || 'main';
}

/**
 * Generate a unique branch ID for forked paths
 * Uses underscore to separate the flow ID so hyphen-based parent extraction works correctly
 *
 * Format: {parentBranch}-{index}_{flowId}
 * Example: main-0_abc123, main-1_abc123
 */
function generateBranchId(parentBranchId: string, index: number, flowId?: string): string {
  const fid = flowId || generateFlowId();
  return `${parentBranchId}-${index}_${fid}`;
}

/**
 * Find the sync node downstream from a given node in a parallel branch
 * Used to determine if rejection should route through sync instead of directly back
 */
function findDownstreamSyncNode(
  currentNodeId: string,
  connections: any[] | null,
  nodes: any[] | null
): any | null {
  if (!connections || !nodes) return null;

  const visited = new Set<string>();
  const queue = [currentNodeId];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    // Find all outgoing connections from this node
    const outgoing = connections.filter(c => c.from_node_id === nodeId);

    for (const conn of outgoing) {
      const targetNode = nodes.find(n => n.id === conn.to_node_id);
      if (!targetNode) continue;

      // Found sync node!
      if (targetNode.node_type === 'sync') {
        return targetNode;
      }

      // Continue searching (don't go past end nodes)
      if (targetNode.node_type !== 'end') {
        queue.push(targetNode.id);
      }
    }
  }

  return null;
}

/**
 * Check if a sync node has an 'any_rejected' outgoing edge
 * This indicates the workflow is designed to handle rejections through sync aggregation
 */
function syncHasRejectionPath(
  syncNodeId: string,
  connections: any[] | null
): boolean {
  if (!connections) return false;

  // Look for outgoing connections from sync with rejection conditions
  const outgoingFromSync = connections.filter(c => c.from_node_id === syncNodeId);

  return outgoingFromSync.some(conn => {
    const condition = conn.condition;
    if (!condition) return false;

    // Check for any_rejected decision (sync aggregate decision)
    return condition.decision === 'any_rejected' ||
           condition.conditionValue === 'any_rejected';
  });
}

/**
 * Check if any sibling branches have progressed past their first step
 * This helps determine if immediate cancellation would lose significant work
 *
 * Returns:
 * - siblingsWithProgress: branches that have completed at least one step
 * - siblingsAtStart: branches still at their first step (can be safely cancelled)
 */
async function checkSiblingProgress(
  supabase: SupabaseClient,
  workflowInstanceId: string,
  currentBranchId: string,
  currentActiveStepId: string | undefined
): Promise<{
  siblingsWithProgress: Array<{ branchId: string; completedSteps: number }>;
  siblingsAtStart: string[];
  totalSiblings: number;
}> {
  const safeConnections: any[] = [];

  // Extract flow ID from current branch
  const flowId = extractFlowId(currentBranchId);
  const forkPoint = extractForkPointBranch(currentBranchId);

  // Find all active/waiting steps from the same fork (same parent branch, same flow ID)
  const { data: siblingSteps } = await supabase
    .from('workflow_active_steps')
    .select('id, branch_id, node_id, status')
    .eq('workflow_instance_id', workflowInstanceId)
    .neq('id', currentActiveStepId || '')
    .in('status', ['active', 'waiting']);

  // Filter to only sibling branches (same parent, same flow ID)
  const siblings = (siblingSteps || []).filter(step => {
    if (!step.branch_id) return false;
    const stepForkPoint = extractForkPointBranch(step.branch_id);
    const stepFlowId = extractFlowId(step.branch_id);
    return stepForkPoint === forkPoint && stepFlowId === flowId;
  });

  // Get completed steps count per branch
  const { data: completedSteps } = await supabase
    .from('workflow_active_steps')
    .select('branch_id')
    .eq('workflow_instance_id', workflowInstanceId)
    .eq('status', 'completed');

  // Count completed steps per sibling branch
  const completedByBranch: Record<string, number> = {};
  for (const step of completedSteps || []) {
    if (!step.branch_id) continue;
    const stepForkPoint = extractForkPointBranch(step.branch_id);
    const stepFlowId = extractFlowId(step.branch_id);
    if (stepForkPoint === forkPoint && stepFlowId === flowId) {
      completedByBranch[step.branch_id] = (completedByBranch[step.branch_id] || 0) + 1;
    }
  }

  const siblingsWithProgress: Array<{ branchId: string; completedSteps: number }> = [];
  const siblingsAtStart: string[] = [];
  const seenBranches = new Set<string>();

  for (const step of siblings) {
    if (seenBranches.has(step.branch_id)) continue;
    seenBranches.add(step.branch_id);

    const completed = completedByBranch[step.branch_id] || 0;
    if (completed > 0) {
      siblingsWithProgress.push({ branchId: step.branch_id, completedSteps: completed });
    } else {
      siblingsAtStart.push(step.branch_id);
    }
  }

  return {
    siblingsWithProgress,
    siblingsAtStart,
    totalSiblings: seenBranches.size
  };
}

/**
 * Check if all branches have reached completion (End nodes or waiting at Sync)
 */
export async function isWorkflowComplete(
  supabase: SupabaseClient,
  workflowInstanceId: string
): Promise<boolean> {
  if (!supabase) return false;

  // Check if there are any active or waiting steps
  const { data: activeSteps, error } = await supabase
    .from('workflow_active_steps')
    .select('id')
    .eq('workflow_instance_id', workflowInstanceId)
    .in('status', ['active', 'waiting']);

  if (error) {
    console.error('Error checking workflow completion:', error);
    return false;
  }

  // Workflow is complete if there are no active or waiting steps
  return (activeSteps?.length || 0) === 0;
}

/**
 * Get count of incoming connections to a sync node
 */
function getSyncNodeExpectedBranches(
  syncNodeId: string,
  connections: any[] | null
): number {
  if (!connections) return 0;
  return connections.filter((c) => c.to_node_id === syncNodeId).length;
}

/**
 * Handle arrival at a sync node
 * Returns whether the sync should release (all branches arrived)
 * Also aggregates approval decisions from parallel branches
 *
 * Now includes flow ID tracking to ensure only steps from the SAME parallel
 * iteration are counted. This prevents issues where stale waiting steps
 * from previous rejection cycles interfere with the current flow.
 *
 * Uses database locking to prevent race conditions when multiple branches
 * complete simultaneously.
 */
async function handleSyncNode(
  supabase: SupabaseClient,
  workflowInstanceId: string,
  syncNodeId: string,
  completingBranchId: string,
  connections: any[] | null
): Promise<{
  allArrived: boolean;
  canProgress: boolean;
  aggregateDecision: 'all_approved' | 'any_rejected' | 'no_approvals';
  branchDecisions: Array<{ nodeId: string; decision: string }>;
  lockAcquired: boolean;
}> {
  // Try to acquire a lock for this sync operation
  // This prevents race conditions when multiple branches complete simultaneously
  const { data: lockAcquired } = await supabase
    .rpc('acquire_sync_lock', {
      p_workflow_instance_id: workflowInstanceId,
      p_sync_node_id: syncNodeId,
      p_locked_by: `branch-${completingBranchId}`
    });

  if (!lockAcquired) {
    // Another process is handling this sync, return early
    // The branch will still be marked as waiting in the main flow
    console.log('Sync lock not acquired - another branch is handling sync:', {
      syncNodeId,
      completingBranchId
    });
    return {
      allArrived: false,
      canProgress: false,
      aggregateDecision: 'no_approvals',
      branchDecisions: [],
      lockAcquired: false
    };
  }

  console.log('Sync lock acquired:', { syncNodeId, completingBranchId });

  // Get expected number of incoming branches
  const expectedBranches = getSyncNodeExpectedBranches(syncNodeId, connections);

  // Extract flow ID from the completing branch to filter same-generation steps
  const currentFlowId = extractFlowId(completingBranchId);

  // Get all steps waiting at this sync node
  const { data: waitingSteps } = await supabase
    .from('workflow_active_steps')
    .select('*')
    .eq('workflow_instance_id', workflowInstanceId)
    .eq('node_id', syncNodeId)
    .eq('status', 'waiting');

  // Filter to only same-flow waiting steps if we have a flow ID
  // This ensures we only count steps from the current parallel iteration,
  // not stale steps from previous rejection cycles
  const sameFlowWaiting = currentFlowId
    ? (waitingSteps || []).filter((s: any) => extractFlowId(s.branch_id) === currentFlowId)
    : waitingSteps || [];

  // Current branch will become waiting, so total waiting will be sameFlowWaiting + 1
  const totalWaiting = sameFlowWaiting.length + 1;

  const allArrived = totalWaiting >= expectedBranches;

  // Aggregate approval decisions from parallel branches
  // Find the node IDs that connect TO this sync node (the parallel branches)
  const incomingNodeIds = connections
    ? connections.filter(c => c.to_node_id === syncNodeId).map(c => c.from_node_id)
    : [];

  // Query workflow_approvals for decisions from these nodes in this workflow instance
  let branchDecisions: Array<{ nodeId: string; decision: string }> = [];
  let aggregateDecision: 'all_approved' | 'any_rejected' | 'no_approvals' = 'no_approvals';

  if (incomingNodeIds.length > 0 && allArrived) {
    const { data: approvals } = await supabase
      .from('workflow_approvals')
      .select('node_id, decision, created_at')
      .eq('workflow_instance_id', workflowInstanceId)
      .in('node_id', incomingNodeIds)
      .order('created_at', { ascending: false });

    if (approvals && approvals.length > 0) {
      // Get the most recent decision for each node (in case of re-approvals after rejection loops)
      const latestDecisionByNode = new Map<string, string>();
      for (const approval of approvals) {
        if (!latestDecisionByNode.has(approval.node_id)) {
          latestDecisionByNode.set(approval.node_id, approval.decision);
        }
      }

      branchDecisions = Array.from(latestDecisionByNode.entries()).map(([nodeId, decision]) => ({
        nodeId,
        decision
      }));

      // Determine aggregate decision
      const hasRejection = branchDecisions.some(d => d.decision === 'rejected');
      const allApproved = branchDecisions.length > 0 && branchDecisions.every(d => d.decision === 'approved');

      if (hasRejection) {
        aggregateDecision = 'any_rejected';
      } else if (allApproved) {
        aggregateDecision = 'all_approved';
      }
    }
  }

  console.log('Sync node check:', {
    syncNodeId,
    expectedBranches,
    currentFlowId,
    sameFlowWaiting: sameFlowWaiting.length,
    allWaiting: waitingSteps?.length || 0,
    willBeWaiting: totalWaiting,
    allArrived,
    aggregateDecision,
    branchDecisions,
    lockAcquired: true
  });

  // If all branches arrived, we'll release the lock after sync completion in the caller
  // If not all arrived, release the lock now so other branches can check
  if (!allArrived) {
    await supabase.rpc('release_sync_lock', {
      p_workflow_instance_id: workflowInstanceId,
      p_sync_node_id: syncNodeId
    });
  }

  return { allArrived, canProgress: allArrived, aggregateDecision, branchDecisions, lockAcquired: true };
}

/**
 * Progress a specific workflow step (for parallel workflow support)
 * This is the main entry point for advancing parallel workflows
 */
export async function progressWorkflowStep(
  supabase: SupabaseClient,
  workflowInstanceId: string,
  activeStepId: string | null, // Can be null for backward compatibility
  currentUserId: string,
  decision?: 'approved' | 'rejected',
  feedback?: string,
  formResponseId?: string,
  assignedUserId?: string,
  inlineFormData?: Record<string, any>,
  assignedUsersPerNode?: Record<string, string> // NEW: map of nodeId -> userId for parallel branches
): Promise<{ success: boolean; nextNode?: any; newActiveSteps?: WorkflowActiveStep[]; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Database connection failed' };
  }

  try {
    // Get workflow instance with snapshot
    const { data: instance, error: instanceError } = await supabase
      .from('workflow_instances')
      .select('*, started_snapshot, workflow_templates(*)')
      .eq('id', workflowInstanceId)
      .single();

    if (instanceError || !instance) {
      return { success: false, error: 'Workflow instance not found' };
    }

    // Get nodes and connections - prefer snapshot over live tables
    // This ensures deleted/modified templates don't break in-progress workflows
    let nodes: any[] = [];
    let connections: any[] = [];

    if (instance.started_snapshot?.nodes && instance.started_snapshot?.connections) {
      // Use snapshot data (protects against template deletion/modification)
      nodes = instance.started_snapshot.nodes;
      connections = instance.started_snapshot.connections;
      console.log('[progressWorkflowStep] Using snapshot data');
    } else {
      // Fallback to live tables for older instances without snapshot
      console.log('[progressWorkflowStep] Falling back to live table queries');
      const { data: liveNodes } = await supabase
        .from('workflow_nodes')
        .select('*')
        .eq('workflow_template_id', instance.workflow_template_id);

      const { data: liveConnections } = await supabase
        .from('workflow_connections')
        .select('*')
        .eq('workflow_template_id', instance.workflow_template_id);

      nodes = liveNodes || [];
      connections = liveConnections || [];
    }

    // Determine current node based on whether we're using parallel or legacy mode
    let currentNode: any;
    let currentBranchId = 'main';
    let activeStep: WorkflowActiveStep | null = null;

    if (activeStepId) {
      // Parallel mode: Get specific active step
      const { data: step } = await supabase
        .from('workflow_active_steps')
        .select('*')
        .eq('id', activeStepId)
        .single();

      if (!step) {
        return { success: false, error: 'Active step not found' };
      }

      activeStep = step;
      currentBranchId = step.branch_id;
      currentNode = nodes?.find((n: any) => n.id === step.node_id);
    } else {
      // Legacy mode: Use current_node_id
      if (instance.current_node_id) {
        currentNode = nodes?.find((n: any) => n.id === instance.current_node_id);

        // Also try to find the active step for this node (needed to mark it as completed)
        const { data: legacyStep } = await supabase
          .from('workflow_active_steps')
          .select('*')
          .eq('workflow_instance_id', workflowInstanceId)
          .eq('node_id', instance.current_node_id)
          .eq('status', 'active')
          .single();

        if (legacyStep) {
          activeStep = legacyStep;
          currentBranchId = legacyStep.branch_id || 'main';
        }
      } else {
        // Workflow hasn't started yet - current_node_id is null
        // Find the start node and use it as the current node
        currentNode = nodes?.find((n: any) => n.node_type === 'start');
      }
    }

    if (!currentNode) {
      return { success: false, error: 'Current node not found' };
    }

    // AUTHORIZATION: Check if user can progress this workflow step
    const isSuperadmin = await isUserSuperadmin(supabase, currentUserId);

    if (!isSuperadmin) {
      // 0. CHECK FOR EXPLICIT NODE ASSIGNMENT (bypasses entity check)
      // This allows pre-assigned users to progress the workflow even without the required role
      let hasNodeAssignment = false;

      // Check if user is assigned to the active step (e.g., sync leader)
      if (activeStep?.assigned_user_id === currentUserId) {
        hasNodeAssignment = true;
      }

      // Also check workflow_node_assignments table
      if (!hasNodeAssignment && currentNode) {
        const { data: nodeAssignment } = await supabase
          .from('workflow_node_assignments')
          .select('id')
          .eq('workflow_instance_id', workflowInstanceId)
          .eq('node_id', currentNode.id)
          .eq('user_id', currentUserId)
          .single();

        if (nodeAssignment) {
          hasNodeAssignment = true;
        }
      }

      // 1. PROJECT ASSIGNMENT CHECK
      if (instance.project_id) {
        const isAssigned = await isUserAssignedToProject(supabase, currentUserId, instance.project_id);
        if (!isAssigned) {
          return {
            success: false,
            error: 'You must be assigned to this project to advance the workflow'
          };
        }
      }

      // 2. ENTITY VALIDATION (skip if user has explicit node assignment)
      if (!hasNodeAssignment && currentNode.entity_id) {
        if (currentNode.node_type === 'role' || currentNode.node_type === 'approval') {
          const hasRequiredRole = await userHasRole(supabase, currentUserId, currentNode.entity_id);
          if (!hasRequiredRole) {
            const { data: requiredRole } = await supabase
              .from('roles')
              .select('name')
              .eq('id', currentNode.entity_id)
              .single();
            const roleName = requiredRole?.name || 'the required role';
            return {
              success: false,
              error: `Only users with the "${roleName}" role can advance this workflow step`
            };
          }
        } else if (currentNode.node_type === 'department') {
          const { data: userDeptRoles } = await supabase
            .from('user_roles')
            .select('roles!inner(department_id)')
            .eq('user_id', currentUserId)
            .eq('roles.department_id', currentNode.entity_id);

          if (!userDeptRoles || userDeptRoles.length === 0) {
            const { data: dept } = await supabase
              .from('departments')
              .select('name')
              .eq('id', currentNode.entity_id)
              .single();
            const deptName = dept?.name || 'the required department';
            return {
              success: false,
              error: `Only users in the "${deptName}" department can advance this workflow step`
            };
          }
        }
      }
    }

    // Determine next nodes based on node type and decision
    let nextNodes: any[] = [];

    if (currentNode.node_type === 'conditional') {
      // Legacy conditional node support
      const nextNode = findConditionalNextNode(currentNode, decision, connections, nodes);
      if (nextNode) nextNodes = [nextNode];
    } else if (currentNode.node_type === 'approval' && decision) {
      // Approval node with decision-based routing
      const nextNode = findDecisionBasedNextNode(currentNode, decision, connections, nodes);
      if (nextNode) nextNodes = [nextNode];
    } else if (currentNode.node_type === 'sync') {
      // Sync node - route based on aggregate decision from parallel branches
      // The active step stores the aggregate_decision from handleSyncNode
      const aggregateDecision = activeStep?.aggregate_decision as 'all_approved' | 'any_rejected' | 'no_approvals' | null;

      console.log('Sync node routing:', {
        syncNodeId: currentNode.id,
        aggregateDecision,
        activeStepId: activeStep?.id
      });

      // Find outgoing connections from sync node
      const outgoingFromSync = (connections || []).filter((c: any) => c.from_node_id === currentNode.id);

      if (aggregateDecision === 'any_rejected') {
        // Look for a rejection edge (condition contains 'rejected' or 'any_rejected')
        const rejectionEdge = outgoingFromSync.find((c: any) => {
          const condition = c.condition;
          if (!condition) return false;
          const condVal = condition.conditionValue || condition.decision;
          return condVal === 'rejected' || condVal === 'any_rejected';
        });

        if (rejectionEdge) {
          const targetNode = (nodes || []).find((n: any) => n.id === rejectionEdge.to_node_id);
          if (targetNode) nextNodes = [targetNode];
          console.log('Sync routing to rejection path:', targetNode?.label);
        } else {
          // No explicit rejection edge - use default edge if available
          const defaultEdge = outgoingFromSync.find((c: any) => !c.condition);
          if (defaultEdge) {
            const targetNode = (nodes || []).find((n: any) => n.id === defaultEdge.to_node_id);
            if (targetNode) nextNodes = [targetNode];
            console.log('Sync routing to default path (no rejection edge):', targetNode?.label);
          }
        }
      } else {
        // all_approved or no_approvals - route to approved/default path
        const approvedEdge = outgoingFromSync.find((c: any) => {
          const condition = c.condition;
          if (!condition) return false;
          const condVal = condition.conditionValue || condition.decision;
          return condVal === 'approved' || condVal === 'all_approved';
        });

        if (approvedEdge) {
          const targetNode = (nodes || []).find((n: any) => n.id === approvedEdge.to_node_id);
          if (targetNode) nextNodes = [targetNode];
          console.log('Sync routing to approved path:', targetNode?.label);
        } else {
          // No explicit approved edge - use default edge
          const defaultEdge = outgoingFromSync.find((c: any) => !c.condition);
          if (defaultEdge) {
            const targetNode = (nodes || []).find((n: any) => n.id === defaultEdge.to_node_id);
            if (targetNode) nextNodes = [targetNode];
            console.log('Sync routing to default path:', targetNode?.label);
          }
        }
      }
    } else {
      // Check if this is a fork point
      nextNodes = findNextNodes(currentNode.id, connections, nodes);
    }

    // AUTO-ROUTE THROUGH CONDITIONAL NODES
    // If the next node is a conditional and we have form data, auto-evaluate and route
    // This allows forms to directly branch based on their responses without user interaction
    if (nextNodes.length > 0) {
      // Build accumulated form data from various sources
      let accumulatedFormData: Record<string, any> = {};

      // Add inline form data if provided (highest priority - most recent submission)
      if (inlineFormData && Object.keys(inlineFormData).length > 0) {
        // For inline forms, the actual responses are nested under 'responses' key
        // Extract them to the top level for conditional evaluation
        if (inlineFormData.responses && typeof inlineFormData.responses === 'object') {
          accumulatedFormData = { ...accumulatedFormData, ...inlineFormData.responses };
          console.log('[progressWorkflowStep] Extracted inline form responses for conditional routing:', Object.keys(inlineFormData.responses));
        } else {
          // Fallback: spread as-is (for non-nested form data)
          accumulatedFormData = { ...accumulatedFormData, ...inlineFormData };
        }
        console.log('[progressWorkflowStep] Using inline form data for conditional routing');
      }

      // If we have a form response ID, fetch that form's data
      if (formResponseId) {
        const { data: formResponse } = await supabase
          .from('form_responses')
          .select('response_data')
          .eq('id', formResponseId)
          .single();

        if (formResponse?.response_data) {
          accumulatedFormData = { ...accumulatedFormData, ...formResponse.response_data };
          console.log('[progressWorkflowStep] Added form response data for conditional routing');
        }
      }

      // If still no form data, try to get the most recent form response from workflow history
      if (Object.keys(accumulatedFormData).length === 0) {
        const { data: recentFormHistory } = await supabase
          .from('workflow_history')
          .select(`
            form_response_id,
            form_responses(response_data)
          `)
          .eq('workflow_instance_id', workflowInstanceId)
          .not('form_response_id', 'is', null)
          .order('handed_off_at', { ascending: false })
          .limit(1)
          .single();

        // form_responses from join can be an array or object depending on the relationship
        const formResponsesData = recentFormHistory?.form_responses;
        const formResponseData = Array.isArray(formResponsesData)
          ? formResponsesData[0]?.response_data
          : (formResponsesData as unknown as { response_data?: unknown } | null)?.response_data;
        if (formResponseData && typeof formResponseData === 'object') {
          accumulatedFormData = { ...formResponseData as Record<string, unknown> };
          console.log('[progressWorkflowStep] Fetched recent form data from history for conditional routing');
        }
      }

      // Now auto-route through any conditional nodes
      for (let i = 0; i < nextNodes.length; i++) {
        let nextNode = nextNodes[i];
        let routingIterations = 0;
        const maxIterations = 10; // Prevent infinite loops

        while (nextNode && nextNode.node_type === 'conditional' && routingIterations < maxIterations) {
          routingIterations++;
          console.log(`[progressWorkflowStep] Auto-routing through conditional node: ${nextNode.label} (iteration ${routingIterations})`);

          // Try form-based routing first
          const conditionalNextNode = findConditionalNextNodeWithFormData(
            nextNode,
            accumulatedFormData,
            connections,
            nodes
          );

          if (conditionalNextNode) {
            // Log the routing for history
            console.log(`[progressWorkflowStep] Conditional routed to: ${conditionalNextNode.label}`);
            nextNode = conditionalNextNode;
          } else {
            // Fallback to legacy decision-based routing if no form match
            const legacyNext = findConditionalNextNode(nextNode, decision, connections, nodes);
            if (legacyNext) {
              nextNode = legacyNext;
            } else {
              // No route found - break the loop
              console.warn(`[progressWorkflowStep] No route found from conditional node: ${nextNode.label}`);
              break;
            }
          }
        }

        // Update the next node in the array
        nextNodes[i] = nextNode;
      }
    }

    // CRITICAL: Validate rejection routing - prevent silent completion
    // If rejection was requested but no rejection path exists, fail gracefully
    if (decision === 'rejected' && nextNodes.length === 0) {
      console.error('Rejection routing failed - no rejection target found', {
        workflowInstanceId,
        currentNodeId: currentNode.id,
        currentNodeLabel: currentNode.label,
        nodeType: currentNode.node_type
      });
      return {
        success: false,
        error: `Rejection routing failed: No rejection path configured for "${currentNode.label}". Please add a rejection edge in the workflow editor.`
      };
    }

    // Validate rejection doesn't create an immediate cycle (routing to self)
    if (decision === 'rejected' && nextNodes.length > 0) {
      const rejectionTarget = nextNodes[0];
      if (rejectionTarget.id === currentNode.id) {
        console.error('Rejection routing creates immediate cycle', {
          workflowInstanceId,
          currentNodeId: currentNode.id,
          currentNodeLabel: currentNode.label,
          targetNodeId: rejectionTarget.id,
          targetNodeLabel: rejectionTarget.label
        });
        return {
          success: false,
          error: `Rejection routing failed: "${currentNode.label}" cannot reject to itself. Please configure a different rejection target.`
        };
      }

      // Check for short cycles (rejection target leads directly back to current node)
      const targetOutgoing = (connections || []).filter((c: any) => c.from_node_id === rejectionTarget.id);
      const leadsBackToCurrent = targetOutgoing.some((c: any) => c.to_node_id === currentNode.id);
      if (leadsBackToCurrent && rejectionTarget.node_type !== 'form') {
        // Forms are allowed to lead back to approvals (that's the revision loop)
        // But approval -> approval cycles without a form in between are problematic
        console.warn('Rejection routing may create a short cycle', {
          workflowInstanceId,
          currentNodeLabel: currentNode.label,
          targetNodeLabel: rejectionTarget.label,
          targetNodeType: rejectionTarget.node_type
        });
        // This is a warning, not a hard failure - some short cycles are intentional
      }
    }

    // Record approval if applicable
    if (currentNode.node_type === 'approval' && decision) {
      await supabase.from('workflow_approvals').insert({
        workflow_instance_id: workflowInstanceId,
        node_id: currentNode.id,
        approver_user_id: currentUserId,
        decision,
        feedback,
      });
    }

    // Mark current active step as completed
    if (activeStep) {
      await supabase
        .from('workflow_active_steps')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', activeStep.id);
    }

    // Handle parallel branch rejection - SMART LOGIC
    // Decides whether to:
    // 1. Route directly back and cancel siblings (old behavior - for simple parallel approvals)
    // 2. Route to sync and let sync aggregate decisions (new behavior - preserves in-progress work)
    let rejectionRoutingBack = false;
    let rejectionRoutingToSync = false;
    let targetBranchAfterRejection = currentBranchId;

    if (decision === 'rejected' && currentBranchId && currentBranchId.includes('-')) {
      // We're on a parallel branch (e.g., "main-0" or "main-1") and rejecting
      const rejectionTarget = nextNodes[0];

      // Check if rejection routes to a non-sync, non-end node (i.e., routing back)
      // Form nodes and other node types before the fork point indicate we're going back
      if (rejectionTarget &&
          rejectionTarget.node_type !== 'sync' &&
          rejectionTarget.node_type !== 'end') {

        // SMART REJECTION: Check if we should route through sync instead
        // This preserves work in progress on other branches
        const downstreamSync = findDownstreamSyncNode(currentNode.id, connections, nodes);
        const syncHasRejectionRoute = downstreamSync ? syncHasRejectionPath(downstreamSync.id, connections) : false;
        const siblingProgress = await checkSiblingProgress(
          supabase,
          workflowInstanceId,
          currentBranchId,
          activeStep?.id
        );

        const hasSiblingsWithWork = siblingProgress.siblingsWithProgress.length > 0;

        console.log('Parallel rejection analysis:', {
          downstreamSync: downstreamSync?.label || 'none',
          syncHasRejectionRoute,
          siblingsWithProgress: siblingProgress.siblingsWithProgress.length,
          siblingsAtStart: siblingProgress.siblingsAtStart.length
        });

        // DECISION: Route through sync if:
        // 1. Sync has an 'any_rejected' path configured, OR
        // 2. Any sibling has progressed past their first step (has work to preserve)
        if (downstreamSync && (syncHasRejectionRoute || hasSiblingsWithWork)) {
          // Route to sync instead of directly back
          // This lets sync aggregate decisions and handle the rejection path
          rejectionRoutingToSync = true;

          // Replace the rejection target with the sync node
          nextNodes.length = 0;
          nextNodes.push(downstreamSync);

          console.log('Smart rejection: Routing to sync node for aggregation');

          // Create project update explaining the routing
          if (instance.project_id) {
            const progressInfo = hasSiblingsWithWork
              ? ` (${siblingProgress.siblingsWithProgress.length} parallel branch(es) have work in progress)`
              : '';
            const updateContent = `**Workflow Decision**: "${currentNode.label}" rejected - routing to sync point for final decision.${progressInfo}`;

            await supabase.from('project_updates').insert({
              project_id: instance.project_id,
              content: updateContent,
              update_type: 'workflow',
            });
          }
        } else {
          // Original behavior: Cancel siblings and route directly back
          // This is used when:
          // - No sync node with rejection path exists, AND
          // - No siblings have progressed (no work to lose)
          rejectionRoutingBack = true;

          // Cancel all sibling branches and waiting sync nodes
          const { cancelledCount } = await cancelParallelSiblingsAndSyncNodes(
            supabase,
            workflowInstanceId,
            currentBranchId,
            activeStep?.id
          );

          console.log('Traditional rejection: Cancelled', cancelledCount, 'sibling steps');

          // Extract the fork point branch using our helper function
          targetBranchAfterRejection = extractForkPointBranch(currentBranchId);

          // Create project update about the rejection resetting the parallel flow
          if (instance.project_id && cancelledCount > 0) {
            const updateContent = `**Workflow Reset**: "${currentNode.label}" rejected - returning to "${rejectionTarget.label}" for revision. All parallel approval branches have been reset.`;

            await supabase.from('project_updates').insert({
              project_id: instance.project_id,
              content: updateContent,
              update_type: 'workflow',
            });
          }
        }
      }
    }

    // Process each next node
    const newActiveSteps: WorkflowActiveStep[] = [];
    let anyEndReached = false;
    // Not a new parallel fork if we're routing back OR routing a rejection to sync
    let isParallel = nextNodes.length > 1 && !rejectionRoutingBack && !rejectionRoutingToSync;

    // Generate a flow ID for this parallel iteration (if forking)
    // This allows us to track and cancel steps from the same parallel "generation"
    const flowId = isParallel ? generateFlowId() : null;

    // Collect all user assignments for parallel branches
    // We'll apply them all at once to avoid removing assignments between branches
    const parallelAssignments: Array<{ node: any; userId: string | null }> = [];

    for (let i = 0; i < nextNodes.length; i++) {
      let nextNode = nextNodes[i];
      // When rejection routes back past fork, use the parent branch (e.g., 'main')
      // When rejection routes to sync, keep the current branch ID for proper tracking
      // Otherwise use normal branching logic
      const baseBranchId = rejectionRoutingBack ? targetBranchAfterRejection : currentBranchId;
      // Pass the flow ID to generateBranchId for proper tracking
      const newBranchId = isParallel ? generateBranchId(baseBranchId, i, flowId!) : baseBranchId;

      // Handle sync nodes
      if (nextNode.node_type === 'sync') {
        const syncResult = await handleSyncNode(
          supabase,
          workflowInstanceId,
          nextNode.id,
          newBranchId,
          connections
        );

        // If lock was not acquired, another branch is handling the sync
        // Just create a waiting step and continue
        if (!syncResult.lockAcquired) {
          const { data: waitingStep } = await supabase
            .from('workflow_active_steps')
            .insert({
              workflow_instance_id: workflowInstanceId,
              node_id: nextNode.id,
              branch_id: newBranchId,
              status: 'waiting',
              assigned_user_id: null
            })
            .select()
            .single();

          if (waitingStep) newActiveSteps.push(waitingStep);
          continue;
        }

        if (syncResult.allArrived) {
          // All branches arrived - determine sync leader
          // The sync leader is the user with the highest role hierarchy level
          // They will be responsible for ASSIGNING someone to the next step
          // The sync node becomes an ACTIVE task for them

          // Get all waiting steps at this sync to find the users who completed them
          const { data: waitingStepsAtSync } = await supabase
            .from('workflow_active_steps')
            .select('assigned_user_id')
            .eq('workflow_instance_id', workflowInstanceId)
            .eq('node_id', nextNode.id)
            .eq('status', 'waiting');

          // Collect unique user IDs (including current user completing the last branch)
          const syncUserIds = new Set<string>();
          if (assignedUserId) syncUserIds.add(assignedUserId);
          if (currentUserId) syncUserIds.add(currentUserId); // The user triggering this completion
          (waitingStepsAtSync || []).forEach((s: any) => {
            if (s.assigned_user_id) syncUserIds.add(s.assigned_user_id);
          });

          // Find the sync leader (highest role hierarchy_level)
          let syncLeaderId: string | null = null;
          if (syncUserIds.size > 0) {
            const userIdsArray = Array.from(syncUserIds);

            // Get users' roles with hierarchy levels
            const { data: userRolesData } = await supabase
              .from('user_roles')
              .select(`
                user_id,
                roles:role_id (
                  id,
                  hierarchy_level
                )
              `)
              .in('user_id', userIdsArray);

            // Find max hierarchy level per user
            const userMaxLevels: { userId: string; maxLevel: number }[] = [];
            for (const uid of userIdsArray) {
              const userRoles = (userRolesData || []).filter((ur: any) => ur.user_id === uid);
              const maxLevel = userRoles.reduce((max: number, ur: any) => {
                const level = ur.roles?.hierarchy_level ?? 0;
                return level > max ? level : max;
              }, 0);
              userMaxLevels.push({ userId: uid, maxLevel });
            }

            // Sort by hierarchy level descending
            userMaxLevels.sort((a, b) => b.maxLevel - a.maxLevel);

            // Pick highest, or random among ties
            const highestLevel = userMaxLevels[0]?.maxLevel ?? 0;
            const topUsers = userMaxLevels.filter(u => u.maxLevel === highestLevel);

            if (topUsers.length === 1) {
              syncLeaderId = topUsers[0].userId;
            } else if (topUsers.length > 1) {
              // Random pick among ties
              const randomIndex = Math.floor(Math.random() * topUsers.length);
              syncLeaderId = topUsers[randomIndex].userId;
            }

            console.log('Sync leader selection:', {
              syncNodeId: nextNode.id,
              candidates: userMaxLevels,
              selectedLeader: syncLeaderId,
              wasRandom: topUsers.length > 1
            });
          }

          // Mark all waiting steps as completed
          await supabase
            .from('workflow_active_steps')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString()
            })
            .eq('workflow_instance_id', workflowInstanceId)
            .eq('node_id', nextNode.id)
            .eq('status', 'waiting');

          // DON'T auto-progress past the sync node!
          // Instead, create an ACTIVE step AT the sync node for the sync leader
          // The sync leader must assign someone to the next step before the workflow progresses
          // Store the aggregate decision so routing can use it when sync is completed
          const { data: syncActiveStep } = await supabase
            .from('workflow_active_steps')
            .insert({
              workflow_instance_id: workflowInstanceId,
              node_id: nextNode.id, // Stay at the sync node
              branch_id: 'main',
              status: 'active', // Active, waiting for sync leader to assign next step
              assigned_user_id: syncLeaderId || currentUserId || null,
              aggregate_decision: syncResult.aggregateDecision // Store aggregate for routing
            })
            .select()
            .single();

          console.log('Created sync active step with aggregate decision:', {
            syncNodeId: nextNode.id,
            syncLeaderId,
            aggregateDecision: syncResult.aggregateDecision,
            branchDecisions: syncResult.branchDecisions
          });

          if (syncActiveStep) newActiveSteps.push(syncActiveStep);

          // Update workflow instance current_node_id to the sync node
          await supabase
            .from('workflow_instances')
            .update({ current_node_id: nextNode.id })
            .eq('id', workflowInstanceId);

          // Release the sync lock now that sync is complete
          await supabase.rpc('release_sync_lock', {
            p_workflow_instance_id: workflowInstanceId,
            p_sync_node_id: nextNode.id
          });
        } else {
          // Not all branches arrived - mark this branch as waiting
          const { data: waitingStep } = await supabase
            .from('workflow_active_steps')
            .insert({
              workflow_instance_id: workflowInstanceId,
              node_id: nextNode.id,
              branch_id: newBranchId,
              status: 'waiting',
              assigned_user_id: null
            })
            .select()
            .single();

          if (waitingStep) newActiveSteps.push(waitingStep);
        }
        continue;
      }

      // Handle end nodes
      if (nextNode.node_type === 'end') {
        anyEndReached = true;
        // Mark this branch as completed (no new active step needed)
        continue;
      }

      // For regular nodes, create new active step
      // Use per-node assignment if available (for parallel branches), otherwise fall back to single assignedUserId
      const nodeAssignedUserId = assignedUsersPerNode?.[nextNode.id] || assignedUserId || null;

      // CRITICAL: Validate that role/department nodes have users available
      // This prevents creating orphaned steps that no one can act on
      if ((nextNode.node_type === 'role' || nextNode.node_type === 'approval') && nextNode.entity_id && !nodeAssignedUserId) {
        // Check if there are any users with this role
        const { data: roleUsers } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role_id', nextNode.entity_id)
          .limit(1);

        if (!roleUsers || roleUsers.length === 0) {
          // Get role name for better error message
          const { data: roleInfo } = await supabase
            .from('roles')
            .select('name')
            .eq('id', nextNode.entity_id)
            .single();

          const roleName = roleInfo?.name || 'the required role';
          console.error('No users available for role:', { nodeId: nextNode.id, roleName, entityId: nextNode.entity_id });

          return {
            success: false,
            error: `Cannot proceed to "${nextNode.label}": No users have the "${roleName}" role. Please assign at least one user to this role.`
          };
        }
      } else if (nextNode.node_type === 'department' && nextNode.entity_id && !nodeAssignedUserId) {
        // Check if there are any users in this department
        const { data: deptUsers } = await supabase
          .from('user_roles')
          .select('user_id, roles!inner(department_id)')
          .eq('roles.department_id', nextNode.entity_id)
          .limit(1);

        if (!deptUsers || deptUsers.length === 0) {
          // Get department name for better error message
          const { data: deptInfo } = await supabase
            .from('departments')
            .select('name')
            .eq('id', nextNode.entity_id)
            .single();

          const deptName = deptInfo?.name || 'the required department';
          console.error('No users available for department:', { nodeId: nextNode.id, deptName, entityId: nextNode.entity_id });

          return {
            success: false,
            error: `Cannot proceed to "${nextNode.label}": No users are assigned to the "${deptName}" department. Please assign at least one user to a role in this department.`
          };
        }
      }

      let newStep: any = null;
      let stepCreationError: any = null;

      // First, try to insert a new active step
      const { data: insertedStep, error: insertError } = await supabase
        .from('workflow_active_steps')
        .insert({
          workflow_instance_id: workflowInstanceId,
          node_id: nextNode.id,
          branch_id: newBranchId,
          status: 'active',
          assigned_user_id: nodeAssignedUserId
        })
        .select()
        .single();

      if (insertError) {
        // Check if this is a unique constraint violation (error code 23505)
        // This happens when routing back to a node that was previously visited
        // (e.g., rejection routing back to a form node)
        if (insertError.code === '23505') {
          console.log('Unique constraint hit - reactivating existing step:', {
            workflowInstanceId,
            nodeId: nextNode.id,
            branchId: newBranchId
          });

          // Try to reactivate the existing step by updating it to 'active'
          const { data: reactivatedStep, error: updateError } = await supabase
            .from('workflow_active_steps')
            .update({
              status: 'active',
              activated_at: new Date().toISOString(),
              completed_at: null,
              assigned_user_id: nodeAssignedUserId
            })
            .eq('workflow_instance_id', workflowInstanceId)
            .eq('node_id', nextNode.id)
            .eq('branch_id', newBranchId)
            .select()
            .single();

          if (updateError) {
            console.error('Failed to reactivate existing step:', {
              error: updateError,
              workflowInstanceId,
              nodeId: nextNode.id,
              branchId: newBranchId
            });
            stepCreationError = updateError;
          } else {
            newStep = reactivatedStep;
            console.log('Reactivated existing step:', {
              stepId: reactivatedStep?.id,
              nodeId: nextNode.id,
              nodeLabel: nextNode.label,
              branchId: newBranchId
            });
          }
        } else {
          // Different error - log and track it
          console.error('Failed to create active step:', {
            error: insertError,
            errorCode: insertError.code,
            workflowInstanceId,
            nodeId: nextNode.id,
            nodeLabel: nextNode.label,
            branchId: newBranchId
          });
          stepCreationError = insertError;
        }
      } else {
        newStep = insertedStep;
        console.log('Created new active step:', {
          stepId: insertedStep?.id,
          nodeId: nextNode.id,
          nodeLabel: nextNode.label,
          branchId: newBranchId,
          status: 'active'
        });
      }

      // CRITICAL: If we couldn't create or reactivate a step, fail the operation
      if (!newStep && stepCreationError) {
        return {
          success: false,
          error: `Failed to create workflow step for "${nextNode.label}": ${stepCreationError.message || 'Unknown error'}`
        };
      }

      if (newStep) {
        newActiveSteps.push(newStep);
      }

      // Collect assignment for batch processing
      if (instance.project_id) {
        parallelAssignments.push({ node: nextNode, userId: nodeAssignedUserId });
      }
    }

    // Apply all parallel assignments at once (to avoid each call removing the previous)
    if (instance.project_id && parallelAssignments.length > 0) {
      await assignProjectToParallelNodes(
        supabase,
        instance.project_id,
        parallelAssignments,
        currentUserId
      );
    }

    // Update workflow_history with branch_id
    const notesContent = inlineFormData
      ? JSON.stringify({ type: 'inline_form', data: inlineFormData })
      : null;

    const { data: historyEntry } = await supabase.from('workflow_history').insert({
      workflow_instance_id: workflowInstanceId,
      from_node_id: currentNode.id,
      to_node_id: nextNodes.length > 0 ? nextNodes[0]?.id : null,
      handed_off_by: currentUserId,
      approval_decision: decision,
      approval_feedback: feedback,
      form_response_id: formResponseId,
      notes: notesContent,
      branch_id: currentBranchId
    }).select('id').single();

    const workflowHistoryId = historyEntry?.id || null;

    // Create project issue on rejection
    if (decision === 'rejected' && instance.project_id) {
      const issueContent = `**Workflow Rejected**: ${currentNode.label}\n\n` +
        `Workflow: ${instance.workflow_templates?.name || 'Unknown'}\n` +
        `Reason: ${feedback || 'No reason provided'}`;

      await supabase.from('project_issues').insert({
        project_id: instance.project_id,
        content: issueContent,
        status: 'open',
        created_by: currentUserId,
        workflow_history_id: workflowHistoryId,
      });
    }

    // Create project update
    if (instance.project_id) {
      let updateContent = '';
      // For parallel paths, show all next node labels
      const allNextLabels = nextNodes
        .map((n: any) => n?.label)
        .filter(Boolean)
        .join(' & ');

      if (decision === 'approved') {
        updateContent = `**Approved**: ${currentNode.label} → ${allNextLabels || 'Complete'}` +
          (feedback ? `\nNotes: ${feedback}` : '');
      } else if (decision === 'rejected') {
        updateContent = `**Rejected**: ${currentNode.label}\n` +
          `Reason: ${feedback || 'No reason provided'}`;
      } else {
        updateContent = `**Progressed**: ${currentNode.label} → ${allNextLabels || 'Complete'}`;
      }

      // NOTE: Form data is NOT included in project updates.
      // It is stored in workflow_history.notes and displayed in the dedicated
      // "Workflow Form Data" section on the project page.

      await supabase.from('project_updates').insert({
        project_id: instance.project_id,
        content: updateContent,
        created_by: currentUserId,
        workflow_history_id: workflowHistoryId,
      });
    }

    // Check if workflow is complete
    // IMPORTANT: If we just created new active steps, the workflow is NOT complete
    // This prevents race conditions where the DB query in isWorkflowComplete might not
    // see the newly inserted steps yet, or where insert errors cause silent failures
    const workflowComplete = newActiveSteps.length === 0 && await isWorkflowComplete(supabase, workflowInstanceId);

    console.log('Workflow completion check:', {
      workflowInstanceId,
      newActiveStepsCount: newActiveSteps.length,
      newActiveStepNodes: newActiveSteps.map(s => s.node_id),
      workflowComplete,
      decision
    });

    // CRITICAL SAFETY CHECK: Rejection should NEVER complete the workflow
    // If we're here with decision='rejected' and workflowComplete=true, something went wrong
    if (workflowComplete && decision === 'rejected') {
      console.error('CRITICAL: Workflow would complete after rejection - preventing this and returning error', {
        workflowInstanceId,
        currentNodeLabel: currentNode.label,
        nextNodesCount: nextNodes.length,
        newActiveStepsCount: newActiveSteps.length
      });
      return {
        success: false,
        error: `Rejection failed: Could not route "${currentNode.label}" to next step. The workflow cannot be completed on rejection - please check the workflow configuration.`
      };
    }

    // Capture snapshot if workflow is completing
    let completedSnapshot = null;
    if (workflowComplete) {
      completedSnapshot = await captureWorkflowSnapshot(supabase, instance.workflow_template_id, workflowInstanceId);
    }

    // Update workflow instance
    const primaryNextNode = nextNodes.length > 0 ? nextNodes[0] : null;
    await supabase
      .from('workflow_instances')
      .update({
        current_node_id: workflowComplete ? null : (primaryNextNode?.id || instance.current_node_id),
        status: workflowComplete ? 'completed' : 'active',
        completed_at: workflowComplete ? new Date().toISOString() : null,
        has_parallel_paths: isParallel || instance.has_parallel_paths,
        ...(completedSnapshot && { completed_snapshot: completedSnapshot })
      })
      .eq('id', workflowInstanceId);

    // Handle workflow completion
    if (workflowComplete && instance.project_id) {
      await completeProject(supabase, instance.project_id);
    }

    // Add contributors
    if (instance.project_id) {
      await supabase
        .from('project_contributors')
        .upsert({
          project_id: instance.project_id,
          user_id: currentUserId,
          contribution_type: 'workflow',
          last_contributed_at: new Date().toISOString(),
        }, { onConflict: 'project_id,user_id' });
    }

    return {
      success: true,
      nextNode: primaryNextNode,
      newActiveSteps
    };
  } catch (error) {
    console.error('Error progressing workflow step:', error);
    return { success: false, error: 'Internal server error' };
  }
}

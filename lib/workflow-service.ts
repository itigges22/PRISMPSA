/**
 * WORKFLOW SERVICE
 * Service layer for workflow operations (Phase 1 Feature 1 & 4)
 * Handles workflow template management, workflow execution, and history tracking
 *
 * IMPORTANT: Functions are being migrated to accept Supabase client as parameter
 * to maintain proper authentication context from API routes
 */

import { createServerSupabase } from './supabase-server';
import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from './debug-logger';

// Helper to get supabase client with null check
async function getSupabase() {
  const supabase = await createServerSupabase();
  if (!supabase) {
    throw new Error('Unable to connect to the database');
  }
  return supabase;
}

// =====================================================
// TYPES & INTERFACES
// =====================================================

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkflowNode {
  id: string;
  workflow_template_id: string;
  node_type: 'department' | 'role' | 'client' | 'conditional';
  entity_id: string | null;
  position_x: number;
  position_y: number;
  label: string;
  requires_form: boolean;
  form_template_id: string | null;
  settings: Record<string, any>;
  created_at: string;
}

export interface WorkflowConnection {
  id: string;
  workflow_template_id: string;
  from_node_id: string;
  to_node_id: string;
  condition: Record<string, any> | null;
  created_at: string;
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
}

export interface WorkflowHistory {
  id: string;
  workflow_instance_id: string;
  from_node_id: string | null;
  to_node_id: string;
  handed_off_by: string | null;
  handed_off_to: string | null;
  handed_off_at: string;
  out_of_order: boolean;
  form_response_id: string | null;
  notes: string | null;
  project_update_id: string | null;
  project_issue_id: string | null;
}

export interface WorkflowTemplateWithDetails extends WorkflowTemplate {
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
}

// =====================================================
// WORKFLOW TEMPLATE MANAGEMENT
// =====================================================

/**
 * Get all active workflow templates
 */
export async function getWorkflowTemplates(): Promise<WorkflowTemplate[]> {
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from('workflow_templates')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) {
    logger.error('Error fetching workflow templates', { action: 'getWorkflowTemplates' }, error);
    throw error;
  }

  return data || [];
}

/**
 * Get all workflow templates (including inactive) - for admin views
 * Excludes workflows marked as [DELETED] (soft-deleted due to FK constraints)
 */
export async function getAllWorkflowTemplates(): Promise<WorkflowTemplate[]> {
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from('workflow_templates')
    .select('*')
    .not('name', 'like', '[DELETED]%') // Exclude soft-deleted workflows
    .order('is_active', { ascending: false }) // Active first
    .order('name');

  if (error) {
    logger.error('Error fetching all workflow templates', { action: 'getAllWorkflowTemplates' }, error);
    throw error;
  }

  return data || [];
}

/**
 * Get workflow template by ID with nodes and connections
 */
export async function getWorkflowTemplateById(templateId: string): Promise<WorkflowTemplateWithDetails | null> {
  const supabase = await getSupabase();

  // Fetch template
  const { data: template, error: templateError } = await supabase
    .from('workflow_templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (templateError) {
    logger.error('Error fetching workflow template', { action: 'getWorkflowTemplateById', templateId }, templateError);
    throw templateError;
  }

  if (!template) return null;

  // Fetch nodes
  const { data: nodes, error: nodesError } = await supabase
    .from('workflow_nodes')
    .select('*')
    .eq('workflow_template_id', templateId)
    .order('created_at');

  if (nodesError) {
    logger.error('Error fetching workflow nodes', { action: 'getWorkflowTemplateById', templateId }, nodesError);
    throw nodesError;
  }

  // Fetch connections
  const { data: connections, error: connectionsError } = await supabase
    .from('workflow_connections')
    .select('*')
    .eq('workflow_template_id', templateId)
    .order('created_at');

  if (connectionsError) {
    logger.error('Error fetching workflow connections', { action: 'getWorkflowTemplateById', templateId }, connectionsError);
    throw connectionsError;
  }

  return {
    ...template,
    nodes: nodes || [],
    connections: connections || [],
  };
}

/**
 * Create workflow template
 */
export async function createWorkflowTemplate(
  name: string,
  description: string | null,
  createdBy: string
): Promise<WorkflowTemplate> {
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from('workflow_templates')
    .insert({
      name,
      description,
      created_by: createdBy,
      is_active: false, // New workflows start as inactive until configured
    })
    .select()
    .single();

  if (error) {
    logger.error('Error creating workflow template', { action: 'createWorkflowTemplate', name }, error);
    throw error;
  }

  logger.info('Workflow template created', { templateId: data.id, name });
  return data;
}

/**
 * Update workflow template
 */
export async function updateWorkflowTemplate(
  templateId: string,
  updates: { name?: string; description?: string; is_active?: boolean }
): Promise<WorkflowTemplate> {
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from('workflow_templates')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', templateId)
    .select()
    .single();

  if (error) {
    logger.error('Error updating workflow template', { action: 'updateWorkflowTemplate', templateId }, error);
    throw error;
  }

  logger.info('Workflow template updated', { templateId });
  return data;
}

/**
 * Delete workflow template (permanently deletes the template and all associated nodes/connections)
 *
 * NOTE: Workflow instances have their own snapshot of the workflow, so deleting a template
 * does NOT affect any in-progress or completed workflows. They will continue to use their
 * snapshot data. Only NEW projects will be unable to use this workflow.
 */
export async function deleteWorkflowTemplate(templateId: string): Promise<void> {
  const supabase = await getSupabase();

  // Get template name for logging
  const { data: template } = await supabase
    .from('workflow_templates')
    .select('name')
    .eq('id', templateId)
    .single();

  const templateName = template?.name || templateId;

  // Check if there are any workflow instances using this template
  const { data: instances } = await supabase
    .from('workflow_instances')
    .select('id, status')
    .eq('workflow_template_id', templateId);

  if (instances && instances.length > 0) {
    // There are instances - we need to ensure they have snapshots before proceeding
    // For instances without snapshots, we need to capture one now
    for (const instance of instances) {
      // Check if instance has a snapshot
      const { data: instanceData } = await supabase
        .from('workflow_instances')
        .select('started_snapshot')
        .eq('id', instance.id)
        .single();

      if (!instanceData?.started_snapshot) {
        // Capture snapshot now before deleting template
        const { data: nodes } = await supabase
          .from('workflow_nodes')
          .select('*')
          .eq('workflow_template_id', templateId);

        const { data: connections } = await supabase
          .from('workflow_connections')
          .select('*')
          .eq('workflow_template_id', templateId);

        const snapshot = {
          nodes: nodes || [],
          connections: connections || [],
          template_name: templateName,
          captured_at: new Date().toISOString(),
          captured_reason: 'template_deleted'
        };

        await supabase
          .from('workflow_instances')
          .update({ started_snapshot: snapshot })
          .eq('id', instance.id);

        logger.info('Captured snapshot for instance before template deletion', {
          instanceId: instance.id,
          templateId
        });
      }
    }
  }

  // Delete connections first (they reference nodes)
  const { error: connectionsError } = await supabase
    .from('workflow_connections')
    .delete()
    .eq('workflow_template_id', templateId);

  if (connectionsError) {
    logger.error('Error deleting workflow connections', { action: 'deleteWorkflowTemplate', templateId }, connectionsError);
    throw connectionsError;
  }

  // Delete nodes
  const { error: nodesError } = await supabase
    .from('workflow_nodes')
    .delete()
    .eq('workflow_template_id', templateId);

  if (nodesError) {
    logger.error('Error deleting workflow nodes', { action: 'deleteWorkflowTemplate', templateId }, nodesError);
    throw nodesError;
  }

  // Now try to delete the template
  // If there's a foreign key constraint, we'll get an error
  const { error } = await supabase
    .from('workflow_templates')
    .delete()
    .eq('id', templateId);

  if (error) {
    // Check if this is a foreign key constraint error
    if (error.code === '23503') {
      // Foreign key violation - instances still reference this template
      // This means the DB has a strict FK constraint
      // We need to deactivate instead of delete
      logger.warn('Cannot delete template due to FK constraint, deactivating instead', {
        action: 'deleteWorkflowTemplate',
        templateId
      });

      const { error: deactivateError } = await supabase
        .from('workflow_templates')
        .update({
          is_active: false,
          name: `[DELETED] ${templateName}`,
          description: `This workflow was deleted on ${new Date().toISOString()}. Existing projects continue to use their workflow snapshots.`
        })
        .eq('id', templateId);

      if (deactivateError) {
        logger.error('Error deactivating workflow template', { action: 'deleteWorkflowTemplate', templateId }, deactivateError);
        throw deactivateError;
      }

      logger.info('Workflow template marked as deleted (deactivated due to FK constraint)', { templateId, templateName });
      return;
    }

    logger.error('Error deleting workflow template', { action: 'deleteWorkflowTemplate', templateId }, error);
    throw error;
  }

  logger.info('Workflow template permanently deleted', { templateId, templateName });
}

// =====================================================
// WORKFLOW NODE MANAGEMENT
// =====================================================

/**
 * Create workflow node
 */
export async function createWorkflowNode(
  templateId: string,
  nodeData: {
    node_type: 'department' | 'role' | 'client' | 'conditional';
    entity_id?: string | null;
    position_x: number;
    position_y: number;
    label: string;
    requires_form?: boolean;
    form_template_id?: string | null;
    settings?: Record<string, any>;
  }
): Promise<WorkflowNode> {
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from('workflow_nodes')
    .insert({
      workflow_template_id: templateId,
      ...nodeData,
    })
    .select()
    .single();

  if (error) {
    logger.error('Error creating workflow node', { action: 'createWorkflowNode', templateId }, error);
    throw error;
  }

  logger.info('Workflow node created', { nodeId: data.id, templateId });
  return data;
}

/**
 * Update workflow node
 */
export async function updateWorkflowNode(
  nodeId: string,
  updates: Partial<Omit<WorkflowNode, 'id' | 'workflow_template_id' | 'created_at'>>
): Promise<WorkflowNode> {
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from('workflow_nodes')
    .update(updates)
    .eq('id', nodeId)
    .select()
    .single();

  if (error) {
    logger.error('Error updating workflow node', { action: 'updateWorkflowNode', nodeId }, error);
    throw error;
  }

  logger.info('Workflow node updated', { nodeId });
  return data;
}

/**
 * Delete workflow node
 */
export async function deleteWorkflowNode(nodeId: string): Promise<void> {
  const supabase = await getSupabase();

  const { error } = await supabase
    .from('workflow_nodes')
    .delete()
    .eq('id', nodeId);

  if (error) {
    logger.error('Error deleting workflow node', { action: 'deleteWorkflowNode', nodeId }, error);
    throw error;
  }

  logger.info('Workflow node deleted', { nodeId });
}

// =====================================================
// WORKFLOW CONNECTION MANAGEMENT
// =====================================================

/**
 * Create workflow connection
 */
export async function createWorkflowConnection(
  templateId: string,
  fromNodeId: string,
  toNodeId: string,
  condition?: Record<string, any> | null
): Promise<WorkflowConnection> {
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from('workflow_connections')
    .insert({
      workflow_template_id: templateId,
      from_node_id: fromNodeId,
      to_node_id: toNodeId,
      condition: condition || null,
    })
    .select()
    .single();

  if (error) {
    logger.error('Error creating workflow connection', { action: 'createWorkflowConnection', templateId }, error);
    throw error;
  }

  logger.info('Workflow connection created', { connectionId: data.id, templateId });
  return data;
}

/**
 * Delete workflow connection
 */
export async function deleteWorkflowConnection(connectionId: string): Promise<void> {
  const supabase = await getSupabase();

  const { error } = await supabase
    .from('workflow_connections')
    .delete()
    .eq('id', connectionId);

  if (error) {
    logger.error('Error deleting workflow connection', { action: 'deleteWorkflowConnection', connectionId }, error);
    throw error;
  }

  logger.info('Workflow connection deleted', { connectionId });
}

// =====================================================
// WORKFLOW INSTANCE MANAGEMENT
// =====================================================

/**
 * Start workflow instance on a project or task
 */
export async function startWorkflowInstance(params: {
  workflowTemplateId: string;
  projectId?: string | null;
  taskId?: string | null;
  startNodeId: string;
}): Promise<WorkflowInstance> {
  const { workflowTemplateId, projectId, taskId, startNodeId } = params;
  const supabase = await getSupabase();

  // Validate that exactly one of projectId or taskId is provided
  if ((projectId && taskId) || (!projectId && !taskId)) {
    throw new Error('Must provide either projectId or taskId, but not both');
  }

  // Validate that the workflow template exists, is active, and has nodes
  const { data: template, error: templateError } = await supabase
    .from('workflow_templates')
    .select('id, name, is_active')
    .eq('id', workflowTemplateId)
    .single();

  if (templateError || !template) {
    logger.error('Workflow template not found', { action: 'startWorkflowInstance', workflowTemplateId }, templateError);
    throw new Error('Workflow template not found');
  }

  if (!template.is_active) {
    logger.error('Workflow template is not active', { action: 'startWorkflowInstance', workflowTemplateId });
    throw new Error(`Workflow "${template.name}" is not active. Please activate it in the workflow editor before using.`);
  }

  // Check if the workflow has nodes
  const { count: nodeCount, error: nodeCountError } = await supabase
    .from('workflow_nodes')
    .select('id', { count: 'exact', head: true })
    .eq('workflow_template_id', workflowTemplateId);

  if (nodeCountError) {
    logger.error('Error checking workflow nodes', { action: 'startWorkflowInstance', workflowTemplateId }, nodeCountError);
    throw new Error('Failed to validate workflow configuration');
  }

  if (!nodeCount || nodeCount === 0) {
    logger.error('Workflow has no nodes', { action: 'startWorkflowInstance', workflowTemplateId });
    throw new Error(`Workflow "${template.name}" has no nodes configured. Please add at least Start and End nodes in the workflow editor.`);
  }

  // Validate the start node exists
  const { data: startNode, error: startNodeError } = await supabase
    .from('workflow_nodes')
    .select('id')
    .eq('id', startNodeId)
    .eq('workflow_template_id', workflowTemplateId)
    .single();

  if (startNodeError || !startNode) {
    logger.error('Start node not found in workflow', { action: 'startWorkflowInstance', workflowTemplateId, startNodeId }, startNodeError);
    throw new Error('Invalid start node for this workflow');
  }

  const { data, error } = await supabase
    .from('workflow_instances')
    .insert({
      workflow_template_id: workflowTemplateId,
      project_id: projectId || null,
      task_id: taskId || null,
      current_node_id: startNodeId,
      status: 'active',
    })
    .select()
    .single();

  if (error) {
    logger.error('Error starting workflow instance', { action: 'startWorkflowInstance', workflowTemplateId }, error);
    throw error;
  }

  logger.info('Workflow instance started', {
    instanceId: data.id,
    workflowTemplateId,
    projectId,
    taskId
  });

  return data;
}

/**
 * Get workflow instance by ID
 */
export async function getWorkflowInstance(instanceId: string): Promise<WorkflowInstance | null> {
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from('workflow_instances')
    .select('*')
    .eq('id', instanceId)
    .single();

  if (error) {
    logger.error('Error fetching workflow instance', { action: 'getWorkflowInstance', instanceId }, error);
    throw error;
  }

  return data;
}

/**
 * Get workflow instance for a project or task
 */
export async function getWorkflowInstanceForEntity(
  projectId?: string,
  taskId?: string
): Promise<WorkflowInstance | null> {
  const supabase = await getSupabase();

  let query = supabase
    .from('workflow_instances')
    .select('*')
    .eq('status', 'active');

  if (projectId) {
    query = query.eq('project_id', projectId);
  } else if (taskId) {
    query = query.eq('task_id', taskId);
  } else {
    throw new Error('Must provide either projectId or taskId');
  }

  const { data, error } = await query.single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    logger.error('Error fetching workflow instance', { action: 'getWorkflowInstanceForEntity', projectId, taskId }, error);
    throw error;
  }

  return data || null;
}

/**
 * Get next available nodes in workflow
 * Uses snapshot data if available, falls back to live tables for backwards compatibility
 */
export async function getNextAvailableNodes(instanceId: string): Promise<WorkflowNode[]> {
  const supabase = await getSupabase();

  // Get workflow instance including snapshot
  const { data: instance, error: instanceError } = await supabase
    .from('workflow_instances')
    .select('current_node_id, workflow_template_id, started_snapshot')
    .eq('id', instanceId)
    .single();

  if (instanceError || !instance?.current_node_id) {
    logger.error('Error fetching workflow instance for next nodes', { action: 'getNextAvailableNodes', instanceId }, instanceError ? new Error(instanceError.message) : undefined);
    throw instanceError || new Error('No current node found');
  }

  // Use snapshot data if available (for workflow independence from template changes)
  let connections: any[];
  let allNodes: any[];

  if (instance.started_snapshot?.nodes && instance.started_snapshot?.connections) {
    // Use the snapshot - this ensures template changes don't affect in-progress workflows
    connections = instance.started_snapshot.connections.filter(
      (c: any) => c.from_node_id === instance.current_node_id
    );
    allNodes = instance.started_snapshot.nodes;
    logger.info('Using snapshot data for getNextAvailableNodes', { instanceId });
  } else {
    // Fallback for older instances without snapshot - query live tables
    logger.info('No snapshot found, querying live tables', { instanceId });

    const { data: liveConnections, error: connectionsError } = await supabase
      .from('workflow_connections')
      .select('to_node_id')
      .eq('from_node_id', instance.current_node_id);

    if (connectionsError) {
      logger.error('Error fetching workflow connections', { action: 'getNextAvailableNodes', instanceId }, new Error(connectionsError.message));
      throw connectionsError;
    }

    if (!liveConnections || liveConnections.length === 0) {
      return []; // No next nodes (end of workflow)
    }

    const nodeIds = liveConnections.map(c => c.to_node_id);

    const { data: liveNodes, error: nodesError } = await supabase
      .from('workflow_nodes')
      .select('*')
      .in('id', nodeIds);

    if (nodesError) {
      logger.error('Error fetching workflow nodes', { action: 'getNextAvailableNodes', instanceId }, nodesError);
      throw nodesError;
    }

    return liveNodes || [];
  }

  // Using snapshot data - filter nodes based on connections
  if (!connections || connections.length === 0) {
    return []; // No next nodes (end of workflow)
  }

  const nodeIds = connections.map((c: any) => c.to_node_id);
  const nextNodes = allNodes.filter((n: any) => nodeIds.includes(n.id));

  return nextNodes;
}

/**
 * Hand off workflow to next node
 */
export async function handoffWorkflow(
  supabase: SupabaseClient,
  params: {
    instanceId: string;
    toNodeId: string;
    handedOffBy: string;
    handedOffTo?: string | null;
    formResponseId?: string | null;
    notes?: string | null;
    outOfOrder?: boolean;
  }
): Promise<WorkflowHistory> {
  if (!supabase) {
    throw new Error('Supabase client is required');
  }

  const { instanceId, toNodeId, handedOffBy, handedOffTo, formResponseId, notes, outOfOrder = false } = params;

  // Get current node
  const { data: instance, error: instanceError } = await supabase
    .from('workflow_instances')
    .select('current_node_id')
    .eq('id', instanceId)
    .single();

  if (instanceError) {
    logger.error('Error fetching workflow instance for handoff', { action: 'handoffWorkflow', instanceId }, instanceError);
    throw instanceError;
  }

  const fromNodeId = instance.current_node_id;

  // Create history entry
  const { data: history, error: historyError } = await supabase
    .from('workflow_history')
    .insert({
      workflow_instance_id: instanceId,
      from_node_id: fromNodeId,
      to_node_id: toNodeId,
      handed_off_by: handedOffBy,
      handed_off_to: handedOffTo || null,
      out_of_order: outOfOrder,
      form_response_id: formResponseId || null,
      notes: notes || null,
    })
    .select()
    .single();

  if (historyError) {
    logger.error('Error creating workflow history', { action: 'handoffWorkflow', instanceId }, historyError);
    throw historyError;
  }

  // Update workflow instance current node
  const { error: updateError } = await supabase
    .from('workflow_instances')
    .update({ current_node_id: toNodeId })
    .eq('id', instanceId);

  if (updateError) {
    logger.error('Error updating workflow instance', { action: 'handoffWorkflow', instanceId }, updateError);
    throw updateError;
  }

  logger.info('Workflow handed off', {
    instanceId,
    fromNodeId,
    toNodeId,
    handedOffBy,
    outOfOrder
  });

  return history;
}

/**
 * Complete workflow instance
 */
export async function completeWorkflow(instanceId: string): Promise<void> {
  const supabase = await getSupabase();

  const { error } = await supabase
    .from('workflow_instances')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', instanceId);

  if (error) {
    logger.error('Error completing workflow instance', { action: 'completeWorkflow', instanceId }, error);
    throw error;
  }

  logger.info('Workflow completed', { instanceId });
}

/**
 * Cancel workflow instance
 */
export async function cancelWorkflow(instanceId: string): Promise<void> {
  const supabase = await getSupabase();

  const { error } = await supabase
    .from('workflow_instances')
    .update({ status: 'cancelled' })
    .eq('id', instanceId);

  if (error) {
    logger.error('Error cancelling workflow instance', { action: 'cancelWorkflow', instanceId }, error);
    throw error;
  }

  logger.info('Workflow cancelled', { instanceId });
}

/**
 * Get workflow history for an instance
 */
export async function getWorkflowHistory(instanceId: string): Promise<WorkflowHistory[]> {
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from('workflow_history')
    .select('*')
    .eq('workflow_instance_id', instanceId)
    .order('handed_off_at', { ascending: false });

  if (error) {
    logger.error('Error fetching workflow history', { action: 'getWorkflowHistory', instanceId }, error);
    throw error;
  }

  return data || [];
}

// Export aliases for API route compatibility
export const getWorkflowInstanceById = getWorkflowInstance;

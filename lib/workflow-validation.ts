/**
 * Workflow Validation Module
 * Validates workflow templates before saving to prevent invalid configurations
 *
 * IMPORTANT: This version enforces SINGLE-PATHWAY workflows.
 * - No parallel execution
 * - Approval nodes can have approve/reject paths (reject can loop back)
 * - Conditional nodes route to ONE path based on conditions (not parallel)
 * - Sync nodes are deprecated/not allowed
 */

import type { Node, Edge } from '@xyflow/react';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type: 'error';
  code: string;
  message: string;
  nodeId?: string;
  nodeLabel?: string;
}

export interface ValidationWarning {
  type: 'warning';
  code: string;
  message: string;
  nodeId?: string;
  nodeLabel?: string;
}

export interface RoleWithUserCount {
  id: string;
  name: string;
  department_id: string;
  user_count: number;
}

// Node types that are allowed to have multiple outgoing edges (for branching, not parallel execution)
const BRANCHING_NODE_TYPES = ['approval', 'conditional'];

export interface ValidateWorkflowOptions {
  roles?: RoleWithUserCount[];
}

/**
 * Validate a workflow template
 * @param nodes - React Flow nodes
 * @param edges - React Flow edges
 * @param options - Optional validation options (includes roles for user count validation)
 * @returns ValidationResult with errors and warnings
 */
export function validateWorkflow(
  nodes: Node[],
  edges: Edge[],
  options?: ValidateWorkflowOptions
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Basic checks
  if (nodes.length === 0) {
    errors.push({
      type: 'error',
      code: 'NO_NODES',
      message: 'Workflow must have at least one node'
    });
    return { valid: false, errors, warnings };
  }

  // Check for start node
  const startNodes = nodes.filter(n => n.data?.type === 'start');
  if (startNodes.length === 0) {
    errors.push({
      type: 'error',
      code: 'NO_START',
      message: 'Workflow must have a Start node'
    });
  } else if (startNodes.length > 1) {
    errors.push({
      type: 'error',
      code: 'MULTIPLE_STARTS',
      message: 'Workflow can only have one Start node'
    });
  }

  // Check for end node
  const endNodes = nodes.filter(n => n.data?.type === 'end');
  if (endNodes.length === 0) {
    warnings.push({
      type: 'warning',
      code: 'NO_END',
      message: 'Workflow has no End node. The workflow may not terminate properly.'
    });
  }

  // Check for deprecated sync nodes (parallel workflows are disabled)
  const syncErrors = validateNoSyncNodes(nodes);
  errors.push(...syncErrors);

  // Check for orphaned nodes (nodes with no incoming or outgoing edges, except start/end)
  const orphanedNodes = findOrphanedNodes(nodes, edges);
  for (const node of orphanedNodes) {
    warnings.push({
      type: 'warning',
      code: 'ORPHANED_NODE',
      message: `Node "${node.data?.label || 'Unknown'}" is not connected to the workflow`,
      nodeId: node.id,
      nodeLabel: node.data?.label as string
    });
  }

  // Enforce single pathway - nodes should only have ONE outgoing edge
  // (except approval/conditional which can branch)
  const singlePathErrors = validateSinglePathway(nodes, edges);
  errors.push(...singlePathErrors);

  // Check for cycles (allowing rejection loops)
  const cycleErrors = detectCycles(nodes, edges);
  errors.push(...cycleErrors);

  // Check approval nodes have required edges
  const approvalErrors = validateApprovalNodes(nodes, edges);
  errors.push(...approvalErrors);

  // Check conditional nodes have proper paths
  const conditionalWarnings = validateConditionalNodes(nodes, edges);
  warnings.push(...conditionalWarnings);

  // Check for roles with no users assigned (if roles data provided)
  if (options?.roles) {
    const roleErrors = validateRoleAssignments(nodes, options.roles);
    errors.push(...roleErrors);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate that sync nodes are not used (parallel workflows disabled)
 */
function validateNoSyncNodes(nodes: Node[]): ValidationError[] {
  const errors: ValidationError[] = [];

  const syncNodes = nodes.filter(n => n.data?.type === 'sync');

  for (const node of syncNodes) {
    errors.push({
      type: 'error',
      code: 'SYNC_NOT_ALLOWED',
      message: `Sync node "${node.data?.label || 'node'}" is not allowed. Parallel workflows have been disabled. Please remove sync nodes and use a single pathway.`,
      nodeId: node.id,
      nodeLabel: node.data?.label as string
    });
  }

  return errors;
}

/**
 * Validate single pathway - most nodes can only have one outgoing edge
 * Exceptions:
 * - approval: can have approved/rejected paths
 * - conditional: can have multiple condition-based paths (only ONE is taken at runtime)
 */
function validateSinglePathway(nodes: Node[], edges: Edge[]): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const node of nodes) {
    const nodeType = node.data?.type as string;

    // Skip nodes that can have multiple outgoing edges
    if (BRANCHING_NODE_TYPES.includes(nodeType)) {
      continue;
    }

    // Skip end nodes (they have no outgoing edges)
    if (nodeType === 'end') {
      continue;
    }

    const outgoingEdges = edges.filter(e => e.source === node.id);

    // Non-branching nodes should have at most ONE outgoing edge
    if (outgoingEdges.length > 1) {
      errors.push({
        type: 'error',
        code: 'PARALLEL_NOT_ALLOWED',
        message: `Node "${node.data?.label || 'node'}" has ${outgoingEdges.length} outgoing connections. Only ONE is allowed. Parallel workflows are disabled.`,
        nodeId: node.id,
        nodeLabel: node.data?.label as string
      });
    }
  }

  return errors;
}

/**
 * Validate conditional nodes have proper configuration
 */
function validateConditionalNodes(nodes: Node[], edges: Edge[]): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  const conditionalNodes = nodes.filter(n => n.data?.type === 'conditional');

  for (const node of conditionalNodes) {
    const outgoingEdges = edges.filter(e => e.source === node.id);

    if (outgoingEdges.length === 0) {
      warnings.push({
        type: 'warning',
        code: 'CONDITIONAL_NO_OUTPUT',
        message: `Conditional node "${node.data?.label || 'node'}" has no outgoing connections. The workflow cannot continue.`,
        nodeId: node.id,
        nodeLabel: node.data?.label as string
      });
      continue;
    }

    // Check if there's a default path (edge without condition)
    const hasDefaultPath = outgoingEdges.some(e => {
      const data = e.data as { conditionValue?: string; decision?: string } | undefined;
      return !data?.conditionValue && !data?.decision;
    });

    const conditionalEdges = outgoingEdges.filter(e => {
      const data = e.data as { conditionValue?: string; decision?: string } | undefined;
      return data?.conditionValue || data?.decision;
    });

    if (conditionalEdges.length === 0) {
      warnings.push({
        type: 'warning',
        code: 'CONDITIONAL_NO_CONDITIONS',
        message: `Conditional node "${node.data?.label || 'node'}" has no condition-based edges. All paths will be treated as default.`,
        nodeId: node.id,
        nodeLabel: node.data?.label as string
      });
    } else if (!hasDefaultPath && conditionalEdges.length < 2) {
      warnings.push({
        type: 'warning',
        code: 'CONDITIONAL_MISSING_DEFAULT',
        message: `Conditional node "${node.data?.label || 'node'}" may not handle all cases. Consider adding a default path or additional conditions.`,
        nodeId: node.id,
        nodeLabel: node.data?.label as string
      });
    }
  }

  return warnings;
}

/**
 * Find orphaned nodes (not connected to workflow)
 */
function findOrphanedNodes(nodes: Node[], edges: Edge[]): Node[] {
  const connectedNodeIds = new Set<string>();

  // Add all nodes that have edges
  edges.forEach(edge => {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  });

  // Find nodes not in connected set (except start with no incoming is ok)
  return nodes.filter(node => {
    // Start nodes are allowed to have no incoming edges
    if (node.data?.type === 'start') {
      return !edges.some(e => e.source === node.id);
    }
    // End nodes are allowed to have no outgoing edges
    if (node.data?.type === 'end') {
      return !edges.some(e => e.target === node.id);
    }
    // Other nodes must have at least one connection
    return !connectedNodeIds.has(node.id);
  });
}

/**
 * Detect cycles in the workflow
 * Allows intentional rejection loops (edges marked with decision === 'rejected')
 */
function detectCycles(nodes: Node[], edges: Edge[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cyclePath: string[] = [];

  function hasCycle(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    cyclePath.push(nodeId);

    const outgoing = edges.filter(e => e.source === nodeId);
    for (const edge of outgoing) {
      // Skip edges that are explicitly marked as rejection loops (intentional back-edges)
      const edgeData = edge.data as any;
      if (edgeData?.decision === 'rejected' || edgeData?.conditionValue === 'rejected') {
        continue; // Rejection loops are allowed
      }

      if (!visited.has(edge.target)) {
        if (hasCycle(edge.target)) return true;
      } else if (recursionStack.has(edge.target)) {
        // Found a cycle that's not a rejection loop
        const cycleStartIndex = cyclePath.indexOf(edge.target);
        const cycleNodes = cyclePath.slice(cycleStartIndex);
        const cycleLabels = cycleNodes.map(id => {
          const node = nodes.find(n => n.id === id);
          return node?.data?.label || id;
        });

        errors.push({
          type: 'error',
          code: 'CYCLE_DETECTED',
          message: `Workflow contains a cycle: ${cycleLabels.join(' → ')} → ${cycleLabels[0]}. Cycles are only allowed via rejection paths.`,
          nodeId: edge.target
        });
        return true;
      }
    }

    cyclePath.pop();
    recursionStack.delete(nodeId);
    return false;
  }

  // Start cycle detection from each unvisited node
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      hasCycle(node.id);
    }
  }

  return errors;
}

/**
 * Validate approval nodes have proper routing edges
 */
function validateApprovalNodes(nodes: Node[], edges: Edge[]): ValidationError[] {
  const errors: ValidationError[] = [];

  const approvalNodes = nodes.filter(n => n.data?.type === 'approval');

  for (const node of approvalNodes) {
    const outgoingEdges = edges.filter(e => e.source === node.id);

    // Check for at least one edge
    if (outgoingEdges.length === 0) {
      errors.push({
        type: 'error',
        code: 'APPROVAL_NO_EDGES',
        message: `Approval node "${node.data?.label || 'node'}" has no outgoing connections`,
        nodeId: node.id,
        nodeLabel: node.data?.label as string
      });
      continue;
    }

    // Check if there are both approved and rejected paths
    const hasApprovedPath = outgoingEdges.some(e => {
      const data = e.data as any;
      return data?.decision === 'approved' || data?.conditionValue === 'approved';
    });

    // Only warn if no approved path and multiple edges exist
    if (!hasApprovedPath && outgoingEdges.length === 1) {
      // Single edge without condition is the default path (treated as approved)
      // This is ok for simple workflows
    } else if (!hasApprovedPath && outgoingEdges.length > 1) {
      errors.push({
        type: 'error',
        code: 'APPROVAL_NO_APPROVED_PATH',
        message: `Approval node "${node.data?.label || 'node'}" has no "Approved" path configured`,
        nodeId: node.id,
        nodeLabel: node.data?.label as string
      });
    }
  }

  return errors;
}

/**
 * Validate that roles used in workflow nodes have users assigned
 * This catches issues like "No users have the 'Director of Graphics' role"
 * before they become runtime errors during project execution
 */
function validateRoleAssignments(nodes: Node[], roles: RoleWithUserCount[]): ValidationError[] {
  const errors: ValidationError[] = [];

  // Create a map for quick role lookup
  const roleMap = new Map(roles.map(r => [r.id, r]));

  for (const node of nodes) {
    const nodeType = node.data?.type as string;
    const config = node.data?.config as any;

    // Check role nodes
    if (nodeType === 'role' && config?.roleId) {
      const role = roleMap.get(config.roleId);
      if (role && role.user_count === 0) {
        errors.push({
          type: 'error',
          code: 'ROLE_NO_USERS',
          message: `Cannot proceed to "${node.data?.label || 'Role'}": No users have the "${role.name}" role. Please assign at least one user to this role.`,
          nodeId: node.id,
          nodeLabel: node.data?.label as string
        });
      }
    }

    // Check approval nodes (they use approverRoleId)
    if (nodeType === 'approval' && config?.approverRoleId) {
      const role = roleMap.get(config.approverRoleId);
      if (role && role.user_count === 0) {
        errors.push({
          type: 'error',
          code: 'APPROVAL_ROLE_NO_USERS',
          message: `Cannot proceed to "${node.data?.label || 'Approval'}": No users have the "${role.name}" role to perform approvals. Please assign at least one user to this role.`,
          nodeId: node.id,
          nodeLabel: node.data?.label as string
        });
      }
    }
  }

  return errors;
}

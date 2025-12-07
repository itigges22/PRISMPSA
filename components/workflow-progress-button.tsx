'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowRight, CheckCircle2, XCircle, Send, Loader2, FileText, AlertTriangle, RefreshCw, Clock, User } from 'lucide-react';
import { toast } from 'sonner';
import { createClientSupabase } from '@/lib/supabase';
import { useAuth } from '@/lib/hooks/useAuth';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';

interface WorkflowProgressButtonProps {
  projectId: string;
  workflowInstanceId: string | null;
  activeStepId?: string | null; // For parallel workflow support - specific step to progress
  externalDialogOpen?: boolean; // Allow external control of dialog state
  onDialogOpenChange?: (open: boolean) => void; // Callback when dialog state changes
  onProgress?: () => void;
}

interface WorkflowInstance {
  id: string;
  workflow_template_id: string;
  current_node_id: string | null;
  project_id: string | null;
  status: string;
  workflow_nodes?: {
    id: string;
    node_type: 'start' | 'department' | 'role' | 'approval' | 'form' | 'conditional' | 'sync' | 'end';
    label: string;
    settings: any;
    entity_id: string | null;
  };
  workflow_templates?: {
    id: string;
    name: string;
  };
  started_snapshot?: {
    nodes?: any[];
    connections?: any[];
    template_name?: string;
  } | null;
}

interface NextNodePreview {
  id: string;
  label: string;
  node_type: string;
  entity_id: string | null;
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface FormField {
  id: string;
  type: 'text' | 'number' | 'date' | 'dropdown' | 'multiselect' | 'file' | 'textarea' | 'email' | 'checkbox' | 'url';
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  defaultValue?: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
  conditional?: {
    show_if: string;
    equals: any;
  };
}

interface FormTemplate {
  id: string;
  name: string;
  description: string | null;
  fields: FormField[];
}

// Helper function to render simple markdown (bold text) as React elements
function renderMarkdownContent(content: string): React.ReactNode {
  if (!content) return null;

  // Handle edge cases like *text** or **text* by normalizing first
  let normalizedContent = content
    .replace(/^\*([^*]+)\*\*$/gm, '**$1**') // Fix *text** -> **text**
    .replace(/^\*\*([^*]+)\*$/gm, '**$1**'); // Fix **text* -> **text**

  // Split by **text** pattern and render bold parts
  const parts = normalizedContent.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      // Remove the ** markers and render as bold
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return <span key={index}>{part}</span>;
  });
}

export function WorkflowProgressButton({
  projectId,
  workflowInstanceId,
  activeStepId: externalActiveStepId,
  externalDialogOpen,
  onDialogOpenChange,
  onProgress,
}: WorkflowProgressButtonProps) {
  const router = useRouter();
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [internalDialogOpen, setInternalDialogOpen] = useState(false);

  // Track which workflow instance ID we've loaded data for
  // This prevents re-loading when focus changes (e.g., date picker) trigger re-renders
  // Using the instance ID instead of a boolean ensures we only reload when the actual instance changes
  const loadedWorkflowInstanceRef = useRef<string | null>(null);

  // Support both internal and external dialog control
  const dialogOpen = externalDialogOpen !== undefined ? externalDialogOpen : internalDialogOpen;
  const setDialogOpen = (open: boolean) => {
    // When explicitly closing the dialog, reset the loaded ref so we reload next time
    if (!open) {
      loadedWorkflowInstanceRef.current = null;
    }
    setInternalDialogOpen(open);
    onDialogOpenChange?.(open);
  };

  // Track the active step ID (either from prop or loaded from API)
  const [currentActiveStepId, setCurrentActiveStepId] = useState<string | null>(null);
  const [workflowInstance, setWorkflowInstance] = useState<WorkflowInstance | null>(null);
  const [nextNode, setNextNode] = useState<NextNodePreview | null>(null);
  const [decision, setDecision] = useState<'approved' | 'rejected' | undefined>();
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  // Parallel workflow user assignment - for when form node forks to multiple approval nodes
  const [nextNodes, setNextNodes] = useState<NextNodePreview[]>([]);
  const [usersPerNode, setUsersPerNode] = useState<Record<string, User[]>>({});
  const [selectedUserPerNode, setSelectedUserPerNode] = useState<Record<string, string>>({});

  // Stale data detection - track when workflow was last loaded vs current state
  const [isStaleData, setIsStaleData] = useState(false);
  const [lastKnownUpdatedAt, setLastKnownUpdatedAt] = useState<string | null>(null);

  // Permission state
  const [canExecuteWorkflows, setCanExecuteWorkflows] = useState<boolean | null>(null);
  const [checkingPermissions, setCheckingPermissions] = useState(true);
  const [hasRequiredRole, setHasRequiredRole] = useState<boolean>(false); // Default false - only show after check passes
  const [requiredRoleName, setRequiredRoleName] = useState<string | null>(null);
  const [isAssignedToProject, setIsAssignedToProject] = useState<boolean>(false); // Default false - only show after check passes
  const [checkingAccessPermissions, setCheckingAccessPermissions] = useState(true); // Track access permission loading

  // Pipeline state - when user is assigned to a future step that hasn't been reached
  const [isPipelineProject, setIsPipelineProject] = useState(false);
  const [assignedFutureStepName, setAssignedFutureStepName] = useState<string | null>(null);
  const [currentStepName, setCurrentStepName] = useState<string | null>(null);

  // Parallel approvers state - show other users approving in parallel
  const [parallelApprovers, setParallelApprovers] = useState<Array<{
    id: string;
    userName: string;
    nodeName: string;
    completed: boolean;
    decision: string | null;
  }>>([]);
  const [isParallelApproval, setIsParallelApproval] = useState(false);

  // Form state
  const [formTemplate, setFormTemplate] = useState<FormTemplate | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});

  // Auto-save key for localStorage - unique per workflow instance + step
  const getFormSaveKey = useCallback(() => {
    const stepId = externalActiveStepId || currentActiveStepId || 'default';
    return `workflow-form-draft-${workflowInstanceId}-${stepId}`;
  }, [workflowInstanceId, externalActiveStepId, currentActiveStepId]);

  // Auto-save form data to localStorage whenever it changes
  useEffect(() => {
    if (!workflowInstanceId || !dialogOpen || Object.keys(formData).length === 0) return;

    const saveKey = getFormSaveKey();
    try {
      localStorage.setItem(saveKey, JSON.stringify({
        formData,
        decision,
        feedback,
        selectedUserId,
        selectedUserPerNode,
        savedAt: new Date().toISOString(),
      }));
    } catch (e) {
      console.warn('Failed to auto-save form data:', e);
    }
  }, [formData, decision, feedback, selectedUserId, selectedUserPerNode, workflowInstanceId, dialogOpen, getFormSaveKey]);

  // Load saved form data from localStorage when dialog opens
  const loadSavedFormData = useCallback(() => {
    const saveKey = getFormSaveKey();
    try {
      const saved = localStorage.getItem(saveKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Only restore if saved within last 24 hours
        const savedAt = new Date(parsed.savedAt);
        const hoursSinceSave = (Date.now() - savedAt.getTime()) / (1000 * 60 * 60);
        if (hoursSinceSave < 24) {
          return parsed;
        } else {
          // Clear stale data
          localStorage.removeItem(saveKey);
        }
      }
    } catch (e) {
      console.warn('Failed to load saved form data:', e);
    }
    return null;
  }, [getFormSaveKey]);

  // Clear saved form data (call after successful submission)
  const clearSavedFormData = useCallback(() => {
    const saveKey = getFormSaveKey();
    try {
      localStorage.removeItem(saveKey);
    } catch (e) {
      console.warn('Failed to clear saved form data:', e);
    }
  }, [getFormSaveKey]);

  // Parallel workflow state
  const [branchId, setBranchId] = useState<string | null>(null);
  const [existingFormData, setExistingFormData] = useState<{ data: Record<string, any>; fields?: any[]; formName?: string } | null>(null);
  const [isSuperadmin, setIsSuperadmin] = useState(false);

  // Project issues state - show open issues to inform decision-making
  const [projectIssues, setProjectIssues] = useState<Array<{
    id: string;
    content: string;
    status: string;
    created_at: string;
  }>>([]);
  const [loadingIssues, setLoadingIssues] = useState(false);

  // Check permission when component mounts or user changes
  useEffect(() => {
    async function checkPermissions() {
      if (!userProfile) {
        setCanExecuteWorkflows(false);
        setCheckingPermissions(false);
        return;
      }

      try {
        const canExecute = await hasPermission(userProfile, Permission.EXECUTE_WORKFLOWS, { projectId });
        setCanExecuteWorkflows(canExecute);
      } catch (error) {
        console.error('Error checking workflow permissions:', error);
        setCanExecuteWorkflows(false);
      } finally {
        setCheckingPermissions(false);
      }
    }

    checkPermissions();
  }, [userProfile, projectId]);

  // Check role access AND project assignment when component mounts or workflow instance changes
  useEffect(() => {
    async function checkAccessPermissions() {
      setCheckingAccessPermissions(true);

      if (!workflowInstanceId || !userProfile) {
        // No workflow instance - don't show button at all (handled by render)
        setHasRequiredRole(false);
        setIsAssignedToProject(false);
        setCheckingAccessPermissions(false);
        return;
      }

      try {
        const supabase = createClientSupabase();
        if (!supabase) return;

        // Get workflow instance with snapshot (don't rely on FK join which fails when template is deleted)
        const { data: instance, error } = await supabase
          .from('workflow_instances')
          .select(`
            *,
            started_snapshot
          `)
          .eq('id', workflowInstanceId)
          .single();

        if (error || !instance) {
          console.error('Error loading workflow instance for access check:', {
            error,
            errorCode: error?.code,
            errorMessage: error?.message,
            errorDetails: error?.details,
            workflowInstanceId,
            instanceData: instance
          });
          return;
        }

        // Get current node from snapshot (preferred) or live table (fallback)
        const snapshotNodes = instance.started_snapshot?.nodes || [];
        const hasSnapshot = snapshotNodes.length > 0;

        let currentNodeFromSnapshot = null;
        if (hasSnapshot && instance.current_node_id) {
          currentNodeFromSnapshot = snapshotNodes.find((n: any) => n.id === instance.current_node_id);
        }

        // Attach the node info to instance for later use
        const instanceWithNode = {
          ...instance,
          workflow_nodes: currentNodeFromSnapshot
        };

        // Check if user is superadmin (bypasses all checks)
        const userIsSuperadmin = userProfile.is_superadmin ||
          userProfile.user_roles?.some((ur: any) => ur.roles?.name?.toLowerCase() === 'superadmin');

        setIsSuperadmin(userIsSuperadmin);

        if (userIsSuperadmin) {
          setHasRequiredRole(true);
          setIsAssignedToProject(true);
          return;
        }

        // Get the node_id to check for node assignments
        // ALWAYS check for active steps first - this handles cases where:
        // 1. externalActiveStepId is provided
        // 2. current_node_id is null (template was modified/deleted)
        // 3. workflow is using snapshot-based execution
        let nodeIdToCheck: string | null = instance.current_node_id;
        let hasNodeAssignment = false;
        let isAssignedToActiveStep = false;

        if (externalActiveStepId) {
          // Get the node_id and assigned_user_id from the provided active step
          const { data: activeStep } = await supabase
            .from('workflow_active_steps')
            .select('node_id, assigned_user_id')
            .eq('id', externalActiveStepId)
            .single();

          if (activeStep) {
            nodeIdToCheck = activeStep.node_id;
            // Check if user is directly assigned to this active step (e.g., sync leader)
            if (activeStep.assigned_user_id === userProfile.id) {
              isAssignedToActiveStep = true;
            }
          }
        } else if (!nodeIdToCheck) {
          // No current_node_id - try to find from active steps
          const { data: activeSteps } = await supabase
            .from('workflow_active_steps')
            .select('node_id, assigned_user_id')
            .eq('workflow_instance_id', workflowInstanceId)
            .eq('status', 'active')
            .order('activated_at', { ascending: false })
            .limit(1);

          if (activeSteps && activeSteps.length > 0) {
            nodeIdToCheck = activeSteps[0].node_id;
            if (activeSteps[0].assigned_user_id === userProfile.id) {
              isAssignedToActiveStep = true;
            }
          }
        }

        // Update the node in instanceWithNode using snapshot if available
        if (nodeIdToCheck && hasSnapshot) {
          const nodeFromSnapshot = snapshotNodes.find((n: any) => n.id === nodeIdToCheck);
          if (nodeFromSnapshot) {
            instanceWithNode.workflow_nodes = nodeFromSnapshot;
          }
        }

        // If user is assigned to the active step (like sync leader), grant access
        if (isAssignedToActiveStep) {
          hasNodeAssignment = true;
          setHasRequiredRole(true);
          setRequiredRoleName(null);
        }

        // Check if user is explicitly assigned to this workflow node via workflow_node_assignments
        // This bypasses the entity requirement check
        if (!hasNodeAssignment && nodeIdToCheck) {
          const { data: nodeAssignment } = await supabase
            .from('workflow_node_assignments')
            .select('id')
            .eq('workflow_instance_id', workflowInstanceId)
            .eq('node_id', nodeIdToCheck)
            .eq('user_id', userProfile.id)
            .single();

          if (nodeAssignment) {
            // User is explicitly assigned to this node - allow them to progress it
            hasNodeAssignment = true;
            setHasRequiredRole(true);
            setRequiredRoleName(null);
            // Still need to check project assignment below
          }
        }

        // 1. CHECK PROJECT ASSIGNMENT (via project_assignments table only)
        // NOTE: created_by and assigned_user_id on the project do NOT grant workflow progression rights
        if (instance.project_id) {
          const { data: assignments } = await supabase
            .from('project_assignments')
            .select('id')
            .eq('user_id', userProfile.id)
            .eq('project_id', instance.project_id)
            .is('removed_at', null);

          setIsAssignedToProject((assignments?.length || 0) > 0);
        } else {
          setIsAssignedToProject(true); // No project restriction
        }

        // If user has explicit node assignment, skip entity check (already allowed)
        if (hasNodeAssignment) {
          return;
        }

        // 2. CHECK ENTITY REQUIREMENT based on node type
        const currentNode = instanceWithNode.workflow_nodes;

        // If the node has no entity_id, anyone assigned can progress
        if (!currentNode?.entity_id) {
          setHasRequiredRole(true);
          setRequiredRoleName(null);
          return;
        }

        // Handle different node types
        if (currentNode.node_type === 'role' || currentNode.node_type === 'approval') {
          // For role and approval nodes, entity_id is a role_id
          const userRoleIds = userProfile.user_roles?.map((ur: any) => ur.role_id) || [];
          const hasRole = userRoleIds.includes(currentNode.entity_id);
          setHasRequiredRole(hasRole);

          // Get the role name for display if user doesn't have it
          if (!hasRole) {
            const { data: roleData } = await supabase
              .from('roles')
              .select('name')
              .eq('id', currentNode.entity_id)
              .single();

            setRequiredRoleName(roleData?.name || null);
          } else {
            setRequiredRoleName(null);
          }
        } else if (currentNode.node_type === 'department') {
          // For department nodes, entity_id is a department_id
          // Check if user has any role in this department
          const userDeptIds = userProfile.user_roles
            ?.map((ur: any) => ur.roles?.department_id)
            .filter(Boolean) || [];
          const hasAccess = userDeptIds.includes(currentNode.entity_id);
          setHasRequiredRole(hasAccess);

          // Get department name for display if user doesn't have access
          if (!hasAccess) {
            const { data: deptData } = await supabase
              .from('departments')
              .select('name')
              .eq('id', currentNode.entity_id)
              .single();

            setRequiredRoleName(deptData?.name ? `${deptData.name} department` : null);
          } else {
            setRequiredRoleName(null);
          }
        } else {
          // For form, conditional, start, end nodes - no entity validation needed
          setHasRequiredRole(true);
          setRequiredRoleName(null);
        }

        // PIPELINE DETECTION: If user doesn't have role for current step,
        // check if they're assigned to a FUTURE step in this workflow
        if (!hasNodeAssignment) {
          const userRoleIds = userProfile.user_roles?.map((ur: any) => ur.role_id) || [];
          const hasRole = currentNode?.entity_id ? userRoleIds.includes(currentNode.entity_id) : true;

          if (!hasRole) {
            // User can't act on current step - check if they're assigned to a future node
            // Query just the node_id (don't join with workflow_nodes which may fail if template deleted)
            const { data: futureAssignments } = await supabase
              .from('workflow_node_assignments')
              .select('node_id')
              .eq('workflow_instance_id', workflowInstanceId)
              .eq('user_id', userProfile.id)
              .neq('node_id', nodeIdToCheck || '');

            if (futureAssignments && futureAssignments.length > 0) {
              // User is assigned to a future step - get label from snapshot
              const futureNodeId = futureAssignments[0].node_id;
              const futureNode = hasSnapshot
                ? snapshotNodes.find((n: any) => n.id === futureNodeId)
                : null;

              setIsPipelineProject(true);
              setAssignedFutureStepName(futureNode?.label || 'a future step');
              setCurrentStepName(currentNode?.label || 'the current step');
            } else {
              setIsPipelineProject(false);
              setAssignedFutureStepName(null);
              setCurrentStepName(null);
            }
          }
        }
      } catch (error) {
        console.error('Error checking access permissions:', error);
        // On error, default to hiding the button for safety
        setHasRequiredRole(false);
        setIsAssignedToProject(false);
      } finally {
        setCheckingAccessPermissions(false);
      }
    }

    checkAccessPermissions();
  }, [workflowInstanceId, userProfile, externalActiveStepId]);

  useEffect(() => {
    if (workflowInstanceId && dialogOpen) {
      // Build a unique key for this dialog session: instanceId + activeStepId
      // This ensures we reload if either changes, but not on focus changes
      const sessionKey = `${workflowInstanceId}-${externalActiveStepId || 'default'}`;

      // Only load data if we haven't already loaded for this specific session
      if (loadedWorkflowInstanceRef.current !== sessionKey) {
        loadedWorkflowInstanceRef.current = sessionKey;
        loadWorkflowData();
      }
    }
    // Note: We intentionally do NOT reset the ref when dialogOpen becomes false
    // This prevents the issue where date picker/select focus changes briefly toggle dialogOpen
    // The ref will naturally reset when a different workflowInstanceId is loaded
  }, [workflowInstanceId, dialogOpen, externalActiveStepId]);

  const loadWorkflowData = async () => {
    try {
      setLoading(true);
      const supabase = createClientSupabase();
      if (!supabase) return;

      // First, get the workflow instance (including snapshot)
      const { data: instance, error: instanceError } = await supabase
        .from('workflow_instances')
        .select(`
          *,
          started_snapshot,
          workflow_templates(*)
        `)
        .eq('id', workflowInstanceId)
        .single();

      if (instanceError || !instance) {
        console.error('Error loading workflow instance:', instanceError);
        return;
      }

      // Extract snapshot data for use throughout the function
      // This ensures we use the workflow configuration from when the project started
      const snapshotNodes = instance.started_snapshot?.nodes || [];
      const snapshotConnections = instance.started_snapshot?.connections || [];
      const hasSnapshot = snapshotNodes.length > 0 && snapshotConnections.length > 0;

      console.log('[WorkflowProgressButton] Snapshot status:', {
        hasSnapshot,
        snapshotNodesCount: snapshotNodes.length,
        snapshotConnectionsCount: snapshotConnections.length
      });

      // Check for stale data - if workflow was updated since we last loaded
      const currentUpdatedAt = instance.updated_at;
      if (lastKnownUpdatedAt && currentUpdatedAt && lastKnownUpdatedAt !== currentUpdatedAt) {
        // Workflow was updated by someone else
        setIsStaleData(true);
      } else {
        setIsStaleData(false);
      }
      setLastKnownUpdatedAt(currentUpdatedAt);

      // Determine which node to load:
      // 1. If externalActiveStepId is provided, use that step's node
      // 2. Otherwise, ALWAYS check for active steps in workflow_active_steps table
      //    (this is critical when current_node_id is null or template was deleted)
      // 3. Fall back to current_node_id for legacy workflows
      let nodeIdToLoad = instance.current_node_id;
      let activeStepIdToUse: string | null = externalActiveStepId || null;

      if (externalActiveStepId) {
        // Get the node_id and branch_id from the provided active step
        const { data: activeStep } = await supabase
          .from('workflow_active_steps')
          .select('node_id, branch_id')
          .eq('id', externalActiveStepId)
          .single();

        if (activeStep) {
          nodeIdToLoad = activeStep.node_id;
          setBranchId(activeStep.branch_id);
        }
      } else {
        // ALWAYS check for active steps - this handles:
        // 1. Parallel workflows (has_parallel_paths = true)
        // 2. Workflows where current_node_id is null
        // 3. Workflows where the template was modified/deleted (snapshot-based)
        const { data: activeSteps } = await supabase
          .from('workflow_active_steps')
          .select('id, node_id, branch_id')
          .eq('workflow_instance_id', workflowInstanceId)
          .eq('status', 'active')
          .order('activated_at', { ascending: false })
          .limit(1);

        if (activeSteps && activeSteps.length > 0) {
          nodeIdToLoad = activeSteps[0].node_id;
          activeStepIdToUse = activeSteps[0].id;
          setBranchId(activeSteps[0].branch_id);
          console.log('[WorkflowProgressButton] Using active step:', {
            nodeId: nodeIdToLoad,
            stepId: activeStepIdToUse,
            branchId: activeSteps[0].branch_id
          });
        } else if (instance.current_node_id) {
          // Fallback to current_node_id if no active steps found
          setBranchId(null);
        } else {
          // No active steps and no current_node_id - workflow may be stuck
          console.warn('[WorkflowProgressButton] No active step or current_node_id found');
          setBranchId(null);
        }
      }

      setCurrentActiveStepId(activeStepIdToUse);

      // Now get the node data - prefer snapshot over live tables
      // This ensures deleted/modified templates don't break in-progress workflows
      let currentNodeData = null;
      if (nodeIdToLoad) {
        if (hasSnapshot) {
          // Use snapshot data (protects against template deletion/modification)
          currentNodeData = snapshotNodes.find((n: any) => n.id === nodeIdToLoad) || null;
          console.log('[WorkflowProgressButton] Using snapshot for current node:', currentNodeData?.label);
        } else {
          // Fallback to live table for older instances without snapshot
          console.log('[WorkflowProgressButton] No snapshot, querying live table for node');
          const { data: nodeData } = await supabase
            .from('workflow_nodes')
            .select('*')
            .eq('id', nodeIdToLoad)
            .single();
          currentNodeData = nodeData;
        }
      }

      // Construct the instance with node data in the expected format
      const instanceWithNode = {
        ...instance,
        workflow_nodes: currentNodeData,
      };

      setWorkflowInstance(instanceWithNode);

      // Check if form was already submitted - handles both form nodes and approval nodes
      setExistingFormData(null); // Reset first
      let foundExistingFormData = false; // Track if we found form data (for blocking editable form)
      let previousFormResponses: Record<string, any> | null = null; // For pre-filling form after rejection

      const isApprovalNode = currentNodeData?.node_type === 'approval';
      const isFormNode = currentNodeData?.node_type === 'form';

      if (nodeIdToLoad) {
        let formHistoryEntry: any = null;

        // Look for any form submission in the workflow history
        // This handles: approval nodes, and any node following a form node
        const { data: recentHistory } = await supabase
          .from('workflow_history')
          .select(`
            form_response_id,
            notes,
            from_node_id,
            to_node_id,
            workflow_nodes!workflow_history_from_node_id_fkey(node_type, label)
          `)
          .eq('workflow_instance_id', workflowInstanceId)
          .order('handed_off_at', { ascending: false })
          .limit(10);

        // Show form data on approval nodes that received the form (directly or via parallel paths)
        // For parallel workflows, the form may have been submitted to a different parallel branch
        // but we still want to show it on all approval nodes that follow the form
        if (isApprovalNode) {
          // First, try to find a form submission directly TO this node
          formHistoryEntry = recentHistory?.find((entry: any) =>
            entry.to_node_id === nodeIdToLoad &&
            (entry.form_response_id || (entry.notes && entry.notes.includes('inline_form')))
          );

          // If not found, look for form submissions FROM a form node
          // This handles parallel approval nodes that all follow the same form
          if (!formHistoryEntry) {
            formHistoryEntry = recentHistory?.find((entry: any) =>
              entry.workflow_nodes?.node_type === 'form' &&
              (entry.form_response_id || (entry.notes && entry.notes.includes('inline_form')))
            );
          }
        }

        // Special case: Form node after rejection - look for previous submission FROM this form node
        // This allows the user to see and edit their previous form data after a rejection
        if (!formHistoryEntry && isFormNode) {
          formHistoryEntry = recentHistory?.find((entry: any) =>
            entry.from_node_id === nodeIdToLoad &&
            (entry.form_response_id || (entry.notes && entry.notes.includes('inline_form')))
          );
        }

        // Load form data from history entry if found
        // For form nodes: pre-fill editable form (revision after rejection)
        // For non-form nodes: show as read-only
        if (formHistoryEntry) {
          // Check for linked form response
          if (formHistoryEntry.form_response_id) {
            const { data: formResponse } = await supabase
              .from('form_responses')
              .select(`
                response_data,
                form_template:form_templates(fields, name)
              `)
              .eq('id', formHistoryEntry.form_response_id)
              .single();

            if (formResponse) {
              if (isFormNode) {
                // Form node - store for pre-filling editable form
                previousFormResponses = formResponse.response_data;
              } else {
                // Non-form node - show as read-only
                setExistingFormData({
                  data: formResponse.response_data,
                  fields: (formResponse.form_template as any)?.fields,
                  formName: (formResponse.form_template as any)?.name
                });
                foundExistingFormData = true;
              }
            }
          }
          // Check for inline form data in notes
          else if (formHistoryEntry.notes) {
            try {
              const notesData = JSON.parse(formHistoryEntry.notes);
              if (notesData.type === 'inline_form' && notesData.data) {
                if (isFormNode) {
                  // Form node - store for pre-filling editable form
                  previousFormResponses = notesData.data.responses || {};
                } else {
                  // Non-form node - show as read-only
                  setExistingFormData({
                    data: notesData.data.responses || {},
                    fields: notesData.data.fields,
                    formName: notesData.data.formName
                  });
                  foundExistingFormData = true;
                }
              }
            } catch {
              // Notes is not JSON, ignore
            }
          }
        }
      }

      // Check for form data - either from form_template_id or inline in settings
      // Use the node data we already loaded
      // IMPORTANT: If form data was already submitted at a previous step, DON'T show editable form
      // This handles: approval nodes, and any other node type following a form node
      // EXCEPTION: Form nodes should show editable form even if there's previous data (revision case)
      let formLoaded = false;

      // Skip form template loading if:
      // 1. This is an approval node (should only show approve/reject buttons)
      // 2. OR form data was already submitted AND this is NOT a form node (show read-only instead)
      // Form nodes should always show editable form (pre-filled if revising)
      if (isApprovalNode || (foundExistingFormData && !isFormNode)) {
        setFormTemplate(null);
        setFormData({});
        formLoaded = false; // No editable form - show read-only data instead
      }
      // First, check if there's an inline form in the node settings (workflow builder stores forms here)
      else if (currentNodeData?.settings?.formFields && currentNodeData.settings.formFields.length > 0) {
        // Build a form template from the inline settings
        const inlineTemplate: FormTemplate = {
          id: `inline-${currentNodeData.id}`,
          name: currentNodeData.settings.formName || currentNodeData.label || 'Form',
          description: currentNodeData.settings.formDescription || null,
          fields: currentNodeData.settings.formFields.map((field: any) => ({
            id: field.id,
            type: field.type === 'select' ? 'dropdown' : field.type, // Map 'select' to 'dropdown'
            label: field.label,
            required: field.required || false,
            placeholder: field.placeholder || '',
            options: field.options || [],
            defaultValue: field.defaultValue,
            validation: field.validation,
            conditional: field.conditional,
          })),
        };

        setFormTemplate(inlineTemplate);
        formLoaded = true;

        // Initialize form data with default values
        const initialData: Record<string, any> = {};
        for (const field of inlineTemplate.fields) {
          if (field.defaultValue !== undefined) {
            initialData[field.id] = field.defaultValue;
          } else if (field.type === 'checkbox') {
            initialData[field.id] = false;
          } else if (field.type === 'multiselect') {
            initialData[field.id] = [];
          } else {
            initialData[field.id] = '';
          }
        }

        // If we have previous form responses (revision after rejection), pre-fill the form
        if (previousFormResponses) {
          setFormData({ ...initialData, ...previousFormResponses });
        } else {
          // Check for auto-saved draft data
          const savedDraft = loadSavedFormData();
          if (savedDraft?.formData && Object.keys(savedDraft.formData).length > 0) {
            setFormData({ ...initialData, ...savedDraft.formData });
            if (savedDraft.decision) setDecision(savedDraft.decision);
            if (savedDraft.feedback) setFeedback(savedDraft.feedback);
            if (savedDraft.selectedUserId) setSelectedUserId(savedDraft.selectedUserId);
            if (savedDraft.selectedUserPerNode) setSelectedUserPerNode(savedDraft.selectedUserPerNode);
          } else {
            setFormData(initialData);
          }
        }
      }
      // If no inline form, check for a linked form template
      else if (currentNodeData?.form_template_id) {
        const { data: template, error: templateError } = await supabase
          .from('form_templates')
          .select('*')
          .eq('id', currentNodeData.form_template_id)
          .single();

        if (template && !templateError) {
          setFormTemplate(template);
          formLoaded = true;

          // Initialize form data with default values
          const initialData: Record<string, any> = {};
          for (const field of (template.fields as FormField[]) || []) {
            if (field.defaultValue !== undefined) {
              initialData[field.id] = field.defaultValue;
            } else if (field.type === 'checkbox') {
              initialData[field.id] = false;
            } else if (field.type === 'multiselect') {
              initialData[field.id] = [];
            } else {
              initialData[field.id] = '';
            }
          }

          // If we have previous form responses (revision after rejection), pre-fill the form
          if (previousFormResponses) {
            setFormData({ ...initialData, ...previousFormResponses });
          } else {
            // Check for auto-saved draft data
            const savedDraft = loadSavedFormData();
            if (savedDraft?.formData && Object.keys(savedDraft.formData).length > 0) {
              setFormData({ ...initialData, ...savedDraft.formData });
              if (savedDraft.decision) setDecision(savedDraft.decision);
              if (savedDraft.feedback) setFeedback(savedDraft.feedback);
              if (savedDraft.selectedUserId) setSelectedUserId(savedDraft.selectedUserId);
              if (savedDraft.selectedUserPerNode) setSelectedUserPerNode(savedDraft.selectedUserPerNode);
            } else {
              setFormData(initialData);
            }
          }
        }
      }

      // Clear form state if no form found
      if (!formLoaded) {
        setFormTemplate(null);
        setFormData({});
      }

      // Get next node(s) preview - handle both single and parallel branches
      // Use snapshot data for connections and nodes to ensure template changes don't break workflows
      const nodeIdForConnections = nodeIdToLoad || instance.current_node_id;
      if (nodeIdForConnections) {
        // Get connections - prefer snapshot over live tables
        let connections: any[] = [];
        if (hasSnapshot) {
          // Use snapshot connections
          connections = snapshotConnections.filter(
            (c: any) => c.from_node_id === nodeIdForConnections
          );
          console.log('[WorkflowProgressButton] Using snapshot connections:', connections.length);
        } else {
          // Fallback to live table
          const { data: liveConnections } = await supabase
            .from('workflow_connections')
            .select('to_node_id, condition')
            .eq('workflow_template_id', instance.workflow_template_id)
            .eq('from_node_id', nodeIdForConnections);
          connections = liveConnections || [];
        }

        if (connections.length > 0) {
          // Filter out decision-based connections (those are for approval routing, not parallel branches)
          const parallelConnections = connections.filter(
            (c: any) => !c.condition?.decision && !c.condition?.conditionValue
          );

          // Get all next node IDs
          const nextNodeIds = parallelConnections.map((c: any) => c.to_node_id);

          // Get all next nodes - prefer snapshot over live tables
          let allNextNodes: any[] = [];
          if (hasSnapshot) {
            // Use snapshot nodes
            allNextNodes = snapshotNodes.filter((n: any) => nextNodeIds.includes(n.id));
            console.log('[WorkflowProgressButton] Using snapshot for next nodes:', allNextNodes.map((n: any) => n.label));
          } else {
            // Fallback to live table
            const { data: liveNextNodes } = await supabase
              .from('workflow_nodes')
              .select('*')
              .in('id', nextNodeIds);
            allNextNodes = liveNextNodes || [];
          }

          if (allNextNodes.length > 0) {
            // Set legacy single node for backward compatibility
            setNextNode(allNextNodes[0]);
            // Set all next nodes for parallel support
            setNextNodes(allNextNodes);

            // For parallel branches, fetch users for EACH next node
            if (allNextNodes.length > 1) {
              const usersMap: Record<string, User[]> = {};

              for (const node of allNextNodes) {
                if (node.entity_id) {
                  const { data: userRoles } = await supabase
                    .from('user_roles')
                    .select(`
                      user_id,
                      users!user_roles_user_id_fkey(id, name, email)
                    `)
                    .eq('role_id', node.entity_id);

                  if (userRoles) {
                    const users = userRoles
                      .map((ur: any) => ur.users)
                      .filter((u: any) => u !== null);
                    usersMap[node.id] = users;
                  }
                }
              }

              setUsersPerNode(usersMap);
              setSelectedUserPerNode({}); // Reset selections
            } else {
              // Single next node - use legacy availableUsers
              const singleNode = allNextNodes[0];
              if (singleNode.entity_id) {
                const { data: userRoles } = await supabase
                  .from('user_roles')
                  .select(`
                    user_id,
                    users!user_roles_user_id_fkey(id, name, email)
                  `)
                  .eq('role_id', singleNode.entity_id);

                if (userRoles) {
                  const users = userRoles
                    .map((ur: any) => ur.users)
                    .filter((u: any) => u !== null);
                  setAvailableUsers(users);
                }
              }
            }
          }
        }
      }

      // Load open project issues to help inform decision-making
      setLoadingIssues(true);
      try {
        const { data: issues } = await supabase
          .from('project_issues')
          .select('id, content, status, created_at')
          .eq('project_id', projectId)
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(5);

        setProjectIssues(issues || []);
      } catch (issuesError) {
        console.error('Error loading project issues:', issuesError);
        setProjectIssues([]);
      } finally {
        setLoadingIssues(false);
      }

      // Load parallel approvers (other users approving in parallel branches)
      // This helps users know who else is reviewing the same project
      try {
        const currentStepBranchId = branchId || 'main';

        // Only check for parallel if we're at an approval node with a branch
        if (currentNodeData?.node_type === 'approval' && currentStepBranchId !== 'main') {
          // Extract the parent branch prefix (e.g., "main-0" from "main-0_1234567890")
          // Parallel branches share the same parent pattern
          const branchParts = currentStepBranchId.split('_');
          const branchPrefix = branchParts[0]; // e.g., "main-0" or "main-1"
          const flowId = branchParts[1]; // e.g., "1234567890"

          if (branchPrefix && flowId) {
            // Get the base branch (remove the index) - e.g., "main" from "main-0"
            const baseBranchMatch = branchPrefix.match(/^(.+)-\d+$/);
            const baseBranch = baseBranchMatch ? baseBranchMatch[1] : branchPrefix;

            // Find other active steps from the same parallel fork (same base branch and flow ID)
            const { data: siblingSteps } = await supabase
              .from('workflow_active_steps')
              .select(`
                id,
                node_id,
                branch_id,
                status,
                assigned_user_id,
                workflow_nodes!inner(id, label, node_type)
              `)
              .eq('workflow_instance_id', workflowInstanceId)
              .neq('id', activeStepIdToUse || '')
              .in('status', ['active', 'completed', 'waiting']);

            // Filter to only parallel siblings (same base branch, same flow ID, different index)
            const parallelSiblings = (siblingSteps || []).filter((step: any) => {
              const stepBranchParts = step.branch_id.split('_');
              const stepPrefix = stepBranchParts[0];
              const stepFlowId = stepBranchParts[1];

              // Check if from same parallel fork
              if (stepFlowId !== flowId) return false;

              // Check if same base branch but different index
              const stepBaseBranchMatch = stepPrefix.match(/^(.+)-\d+$/);
              const stepBaseBranch = stepBaseBranchMatch ? stepBaseBranchMatch[1] : stepPrefix;

              return stepBaseBranch === baseBranch && stepPrefix !== branchPrefix;
            });

            if (parallelSiblings.length > 0) {
              setIsParallelApproval(true);

              // Get user info and approval status for each sibling
              const approverList = await Promise.all(
                parallelSiblings.map(async (step: any) => {
                  // Get user info if assigned
                  let userName = 'Unassigned';
                  if (step.assigned_user_id) {
                    const { data: userData } = await supabase
                      .from('users')
                      .select('name')
                      .eq('id', step.assigned_user_id)
                      .single();
                    userName = userData?.name || 'Unknown User';
                  }

                  // Check for approval decision
                  const { data: approval } = await supabase
                    .from('workflow_approvals')
                    .select('decision')
                    .eq('workflow_instance_id', workflowInstanceId)
                    .eq('node_id', step.node_id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                  return {
                    id: step.id,
                    userName,
                    nodeName: (step.workflow_nodes as any)?.label || 'Unknown',
                    completed: step.status === 'completed',
                    decision: approval?.decision || null,
                  };
                })
              );

              setParallelApprovers(approverList);
            } else {
              setIsParallelApproval(false);
              setParallelApprovers([]);
            }
          }
        } else {
          setIsParallelApproval(false);
          setParallelApprovers([]);
        }
      } catch (parallelError) {
        console.error('Error loading parallel approvers:', parallelError);
        setIsParallelApproval(false);
        setParallelApprovers([]);
      }
    } catch (error) {
      console.error('Error loading workflow data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper to check if a field should be visible based on conditional logic
  const isFieldVisible = (field: FormField): boolean => {
    if (!field.conditional) return true;
    const conditionalFieldValue = formData[field.conditional.show_if];
    return conditionalFieldValue === field.conditional.equals;
  };

  // Validate form data
  const validateFormData = (): string | null => {
    if (!formTemplate) return null;

    for (const field of formTemplate.fields) {
      // Skip hidden fields
      if (!isFieldVisible(field)) continue;

      const value = formData[field.id];

      // Check required fields
      if (field.required) {
        if (value === undefined || value === null || value === '' ||
            (Array.isArray(value) && value.length === 0)) {
          return `${field.label} is required`;
        }
      }

      // Type-specific validation
      if (value !== undefined && value !== null && value !== '') {
        switch (field.type) {
          case 'email':
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(String(value))) {
              return `${field.label} must be a valid email address`;
            }
            break;
          case 'number':
            if (isNaN(Number(value))) {
              return `${field.label} must be a number`;
            }
            if (field.validation?.min !== undefined && Number(value) < field.validation.min) {
              return `${field.label} must be at least ${field.validation.min}`;
            }
            if (field.validation?.max !== undefined && Number(value) > field.validation.max) {
              return `${field.label} must be at most ${field.validation.max}`;
            }
            break;
        }
      }
    }

    return null;
  };

  const handleProgressWorkflow = async () => {
    if (!workflowInstanceId) return;

    const currentNode = workflowInstance?.workflow_nodes;
    // Allow progressing when currentNode is null - this means workflow hasn't started yet
    // The backend will handle moving from start node to first real node

    // For approval nodes, decision is required
    if (currentNode?.node_type === 'approval' && !decision) {
      toast.error('Please select an approval decision');
      return;
    }

    // For form nodes, validate the form data
    if (formTemplate) {
      const validationError = validateFormData();
      if (validationError) {
        toast.error(validationError);
        return;
      }
    }

    // User assignment validation - handle both single and parallel branches
    // SYNC NODES: Always require user assignment (the whole point is to assign the next step)
    if (nextNodes.length > 1 && Object.keys(usersPerNode).length > 0) {
      // Parallel branches - validate all assignments
      const nodesRequiringAssignment = nextNodes.filter((node) =>
        usersPerNode[node.id] && usersPerNode[node.id].length > 0
      );

      for (const node of nodesRequiringAssignment) {
        if (!selectedUserPerNode[node.id]) {
          toast.error(`Please select a user for "${node.label}"`);
          return;
        }
      }
    } else if (availableUsers.length > 0 && !selectedUserId) {
      // Single branch - legacy validation
      toast.error('Please select a user to assign this project to');
      return;
    } else if (isSyncNode && !selectedUserId && availableUsers.length === 0) {
      // Sync node with no available users - this shouldn't happen, but handle gracefully
      toast.error('No users available to assign for the next step');
      return;
    }

    try {
      setSubmitting(true);

      let formResponseId: string | undefined;
      let inlineFormData: Record<string, any> | undefined;

      // If there's a form, handle it
      if (formTemplate) {
        // Check if this is an inline form (stored in node settings) or a linked form template
        const isInlineForm = formTemplate.id.startsWith('inline-');

        if (isInlineForm) {
          // For inline forms, pass the form data directly to the workflow progress endpoint
          inlineFormData = {
            formName: formTemplate.name,
            formDescription: formTemplate.description,
            fields: formTemplate.fields,
            responses: formData,
          };
        } else {
          // For linked form templates, submit to the form_responses table
          const formResponse = await fetch('/api/workflows/forms/responses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              formTemplateId: formTemplate.id,
              responseData: formData,
            }),
          });

          const formResult = await formResponse.json();

          if (!formResponse.ok || formResult.error) {
            throw new Error(formResult.error || 'Failed to submit form');
          }

          formResponseId = formResult.id;
        }
      }

      // Build assignments object for parallel branches
      const assignedUsersPerNode = nextNodes.length > 1 && Object.keys(selectedUserPerNode).length > 0
        ? selectedUserPerNode
        : undefined;

      const response = await fetch('/api/workflows/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowInstanceId,
          activeStepId: currentActiveStepId, // Include for parallel workflow support
          decision,
          feedback,
          assignedUserId: selectedUserId || undefined,
          assignedUsersPerNode, // NEW: map of nodeId -> userId for parallel branches
          formResponseId,
          formData: inlineFormData, // Include inline form data if present
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to progress workflow');
      }

      toast.success('Project sent to next step successfully');

      // Clear the auto-saved draft since submission was successful
      clearSavedFormData();

      setDialogOpen(false);
      setDecision(undefined);
      setFeedback('');
      setFormData({});
      setFormTemplate(null);
      setSelectedUserId('');
      setCurrentActiveStepId(null);

      // Reset workflow state to hide button immediately
      setWorkflowInstance(null);
      setNextNode(null);
      setNextNodes([]);
      setAvailableUsers([]);
      setUsersPerNode({});
      setSelectedUserPerNode({});

      // Call parent callback to trigger refresh
      onProgress?.();

      // Refresh server data
      router.refresh();
    } catch (error: any) {
      console.error('Error progressing workflow:', error);
      toast.error(error.message || 'Failed to progress workflow');
    } finally {
      setSubmitting(false);
    }
  };

  // Don't show button if no workflow instance
  if (!workflowInstanceId) {
    return null;
  }

  // Don't show button while checking permissions (either EXECUTE_WORKFLOWS or role/assignment)
  if (checkingPermissions || checkingAccessPermissions) {
    return (
      <Button disabled className="gap-2" size="lg">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading...
      </Button>
    );
  }

  // Don't show button if user doesn't have permission
  if (!canExecuteWorkflows) {
    return null;
  }

  // Don't show button if user is not assigned to the project
  if (!isAssignedToProject) {
    return null;
  }

  // Don't show button if user doesn't have the required role for this workflow step
  // BUT if they're assigned to a future step, show an explanation instead
  if (!hasRequiredRole) {
    if (isPipelineProject && assignedFutureStepName) {
      // User is assigned to a future step - show explanation
      return (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
          <Clock className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <div className="text-blue-800">
            <span className="font-medium">In the pipeline:</span>{' '}
            You&apos;re assigned to &quot;{assignedFutureStepName}&quot; which hasn&apos;t been reached yet.
            <span className="text-blue-600"> Current step: {currentStepName}</span>
          </div>
        </div>
      );
    }
    return null;
  }

  const currentNode = workflowInstance?.workflow_nodes;
  const isApprovalNode = currentNode?.node_type === 'approval';
  const isFormNode = currentNode?.node_type === 'form';
  const isSyncNode = currentNode?.node_type === 'sync';
  // formTemplate is loaded from either inline settings or linked form_template_id
  const hasFormTemplate = formTemplate !== null;

  return (
    <>
      <Button
        onClick={() => setDialogOpen(true)}
        className="gap-2"
        size="lg"
      >
        <Send className="w-4 h-4" />
        Send to Next Step
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="max-w-2xl max-h-[90vh] flex flex-col"
          onInteractOutside={(e) => {
            // Prevent dialog from closing when interacting with portaled elements
            // like date pickers, select dropdowns, etc.
            e.preventDefault();
          }}
        >
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <ArrowRight className="w-5 h-5" />
              Progress Workflow
            </DialogTitle>
            <DialogDescription>
              {isApprovalNode
                ? 'Review and approve or reject this project'
                : isFormNode
                ? 'Complete the required form before progressing'
                : isSyncNode
                ? 'Assign someone to the next workflow step'
                : 'Send this project to the next workflow step'}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-4 py-4 overflow-y-auto flex-1 min-h-0">
              {/* Stale Data Warning */}
              {isStaleData && (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-800">
                        This workflow was updated by another user
                      </p>
                      <p className="text-xs text-amber-700 mt-1">
                        Please refresh to see the latest state before making changes.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setLastKnownUpdatedAt(null);
                        setIsStaleData(false);
                        loadWorkflowData();
                        router.refresh();
                      }}
                      className="flex-shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100"
                    >
                      <RefreshCw className="w-4 h-4 mr-1" />
                      Refresh
                    </Button>
                  </div>
                </div>
              )}

              {/* Open Issues Alert */}
              {!loadingIssues && projectIssues.length > 0 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-800">
                        Open Issues ({projectIssues.length})
                      </p>
                      <p className="text-xs text-red-700 mt-1 mb-2">
                        The following issues are currently open for this project. Consider these when making your decision.
                      </p>
                      <ul className="space-y-1">
                        {projectIssues.map((issue) => (
                          <li key={issue.id} className="text-xs text-red-700 flex items-start gap-1">
                            <span className="text-red-400 mt-0.5">•</span>
                            <span className="line-clamp-2">{renderMarkdownContent(issue.content)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Current Step */}
              <div className={`p-4 border rounded-lg ${isSyncNode ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
                <Label className={`text-sm font-medium ${isSyncNode ? 'text-amber-900' : 'text-blue-900'}`}>Current Step</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={isSyncNode ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}>
                    {currentNode?.node_type}
                  </Badge>
                  <span className="font-medium">{currentNode?.label}</span>
                  {branchId && branchId !== 'main' && (
                    <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                      {branchId}
                    </Badge>
                  )}
                </div>
                {isSyncNode && (
                  <p className={`text-xs mt-2 ${isSyncNode ? 'text-amber-700' : 'text-blue-700'}`}>
                    All parallel branches have merged. Please assign someone to continue the workflow.
                  </p>
                )}
                {(workflowInstance?.started_snapshot?.template_name || workflowInstance?.workflow_templates?.name) && (
                  <p className={`text-xs mt-1 ${isSyncNode ? 'text-amber-700' : 'text-blue-700'}`}>
                    Workflow: {workflowInstance.started_snapshot?.template_name || workflowInstance.workflow_templates?.name?.replace(/^\[DELETED\]\s*/, '')}
                  </p>
                )}
              </div>

              {/* Parallel Approvers Info - shows other users approving in parallel */}
              {isParallelApproval && parallelApprovers.length > 0 && (
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <Label className="text-sm font-medium text-purple-900">Other Approvers (Parallel)</Label>
                  <div className="mt-2 space-y-2">
                    {parallelApprovers.map((approver) => (
                      <div key={approver.id} className="flex items-center gap-2">
                        <User className="w-4 h-4 text-purple-600" />
                        <span className="text-sm text-purple-800">{approver.userName}</span>
                        <span className="text-xs text-purple-600">({approver.nodeName})</span>
                        <Badge
                          variant={approver.completed ? 'default' : 'outline'}
                          className={
                            approver.completed
                              ? approver.decision === 'approved'
                                ? 'bg-green-100 text-green-800 border-green-300'
                                : approver.decision === 'rejected'
                                ? 'bg-red-100 text-red-800 border-red-300'
                                : 'bg-gray-100 text-gray-800'
                              : 'border-purple-300 text-purple-700'
                          }
                        >
                          {approver.completed
                            ? approver.decision
                              ? approver.decision.charAt(0).toUpperCase() + approver.decision.slice(1)
                              : 'Completed'
                            : 'Pending'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-purple-700 mt-2">
                    All parallel approvers must complete before the workflow continues to the sync point.
                  </p>
                </div>
              )}

              {/* Next Step Preview - handles both single and parallel branches */}
              {nextNodes.length > 1 ? (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <Label className="text-sm font-medium text-green-900">Next Steps (Parallel)</Label>
                  <div className="space-y-2 mt-2">
                    {nextNodes.map((node, index) => (
                      <div key={node.id} className="flex items-center gap-2">
                        <ArrowRight className="w-4 h-4 text-green-600" />
                        <Badge className="bg-green-100 text-green-800">
                          {node.node_type}
                        </Badge>
                        <span className="font-medium">{node.label}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-green-700 mt-2">
                    These steps will run in parallel
                  </p>
                </div>
              ) : nextNode && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <Label className="text-sm font-medium text-green-900">Next Step</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <ArrowRight className="w-4 h-4 text-green-600" />
                    <Badge className="bg-green-100 text-green-800">
                      {nextNode.node_type}
                    </Badge>
                    <span className="font-medium">{nextNode.label}</span>
                  </div>
                </div>
              )}

              {/* User Assignment Selection - parallel branches */}
              {nextNodes.length > 1 && Object.keys(usersPerNode).length > 0 && (
                <div className="space-y-4">
                  <Label className="text-sm font-medium">Assign Users to Each Step *</Label>
                  <p className="text-xs text-gray-500 -mt-2">
                    Select a user for each parallel workflow branch
                  </p>
                  {nextNodes.map((node) => {
                    const nodeUsers = usersPerNode[node.id] || [];
                    if (nodeUsers.length === 0) return null;

                    return (
                      <div key={node.id} className="space-y-2 p-3 bg-gray-50 rounded-lg border">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-purple-100 text-purple-800 text-xs">
                            {node.node_type}
                          </Badge>
                          <span className="font-medium text-sm">{node.label}</span>
                        </div>
                        <Select
                          value={selectedUserPerNode[node.id] || ''}
                          onValueChange={(value) =>
                            setSelectedUserPerNode((prev) => ({ ...prev, [node.id]: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={`Select ${node.label} assignee`} />
                          </SelectTrigger>
                          <SelectContent>
                            {nodeUsers.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* User Assignment Selection - single branch (legacy) */}
              {nextNodes.length <= 1 && availableUsers.length > 0 && (
                <div className={`space-y-2 ${isSyncNode ? 'p-4 bg-amber-50 border border-amber-200 rounded-lg' : ''}`}>
                  <Label htmlFor="assign-user" className={isSyncNode ? 'text-amber-900 font-semibold' : ''}>
                    {isSyncNode ? 'Assign Next Step To *' : 'Assign To *'}
                  </Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger className={isSyncNode ? 'border-amber-300' : ''}>
                      <SelectValue placeholder={isSyncNode ? 'Select who will handle the next step' : 'Select a user to assign'} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {nextNode?.label} - {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className={`text-xs ${isSyncNode ? 'text-amber-700' : 'text-gray-500'}`}>
                    {isSyncNode
                      ? 'As the sync leader, you must assign someone to continue the workflow'
                      : 'Select the user who will handle this project at the next step'}
                  </p>
                </div>
              )}

              {/* Approval Decision (for approval nodes) */}
              {isApprovalNode && (
                <div className="space-y-3">
                  <Label>Decision *</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={decision === 'approved' ? 'default' : 'outline'}
                      onClick={() => setDecision('approved')}
                      className="flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Approve
                    </Button>
                    <Button
                      type="button"
                      variant={decision === 'rejected' ? 'destructive' : 'outline'}
                      onClick={() => setDecision('rejected')}
                      className="flex items-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </Button>
                  </div>
                </div>
              )}

              {/* Feedback/Notes */}
              {(isApprovalNode || currentNode?.settings?.allow_feedback) && (
                <div className="space-y-2">
                  <Label htmlFor="feedback">
                    {isApprovalNode ? 'Feedback (Optional)' : 'Notes (Optional)'}
                  </Label>
                  <Textarea
                    id="feedback"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder={
                      isApprovalNode
                        ? 'Provide feedback or comments...'
                        : 'Add any notes about the handoff...'
                    }
                    rows={4}
                  />
                </div>
              )}

              {/* Existing Form Data (already submitted - show read-only) */}
              {existingFormData && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <FileText className="w-5 h-5 text-green-600" />
                    <div className="flex-1">
                      <h4 className="font-medium text-green-900">Form Already Submitted</h4>
                      <p className="text-xs text-green-700">This form was completed in a previous step</p>
                    </div>
                    <Badge className="bg-green-100 text-green-800">Completed</Badge>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                    {existingFormData.fields?.map((field: any) => {
                      const value = existingFormData.data[field.id];
                      if (value === undefined || value === null || value === '') return null;

                      return (
                        <div key={field.id} className="flex flex-col">
                          <span className="text-xs text-gray-500 font-medium">{field.label}</span>
                          <span className="text-sm text-gray-900">
                            {Array.isArray(value) ? value.join(', ') :
                             typeof value === 'boolean' ? (value ? 'Yes' : 'No') :
                             String(value)}
                          </span>
                        </div>
                      );
                    }) || Object.entries(existingFormData.data).map(([key, value]) => (
                      <div key={key} className="flex flex-col">
                        <span className="text-xs text-gray-500 font-medium">{key}</span>
                        <span className="text-sm text-gray-900">
                          {Array.isArray(value) ? value.join(', ') :
                           typeof value === 'boolean' ? (value ? 'Yes' : 'No') :
                           String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Form Fields (for nodes with form templates) - only show if no existing submission */}
              {formTemplate && !existingFormData && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <FileText className="w-5 h-5 text-purple-600" />
                    <div>
                      <h4 className="font-medium text-purple-900">{formTemplate.name}</h4>
                      {formTemplate.description && (
                        <p className="text-xs text-purple-700">{formTemplate.description}</p>
                      )}
                    </div>
                  </div>

                  {formTemplate.fields.map((field) => {
                    // Check conditional visibility
                    if (!isFieldVisible(field)) return null;

                    return (
                      <div key={field.id} className="space-y-2">
                        <Label htmlFor={`form-${field.id}`}>
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </Label>

                        {/* Text Input */}
                        {field.type === 'text' && (
                          <Input
                            id={`form-${field.id}`}
                            type="text"
                            placeholder={field.placeholder}
                            value={formData[field.id] || ''}
                            onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                          />
                        )}

                        {/* Email Input */}
                        {field.type === 'email' && (
                          <Input
                            id={`form-${field.id}`}
                            type="email"
                            placeholder={field.placeholder || 'email@example.com'}
                            value={formData[field.id] || ''}
                            onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                          />
                        )}

                        {/* URL Input */}
                        {field.type === 'url' && (
                          <Input
                            id={`form-${field.id}`}
                            type="url"
                            placeholder={field.placeholder || 'https://example.com'}
                            value={formData[field.id] || ''}
                            onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                          />
                        )}

                        {/* Number Input */}
                        {field.type === 'number' && (
                          <Input
                            id={`form-${field.id}`}
                            type="number"
                            placeholder={field.placeholder}
                            min={field.validation?.min}
                            max={field.validation?.max}
                            value={formData[field.id] || ''}
                            onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                          />
                        )}

                        {/* Date Input */}
                        {field.type === 'date' && (
                          <Input
                            id={`form-${field.id}`}
                            type="date"
                            value={formData[field.id] || ''}
                            onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                          />
                        )}

                        {/* Textarea */}
                        {field.type === 'textarea' && (
                          <Textarea
                            id={`form-${field.id}`}
                            placeholder={field.placeholder}
                            value={formData[field.id] || ''}
                            onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                            rows={4}
                          />
                        )}

                        {/* Dropdown Select */}
                        {field.type === 'dropdown' && field.options && (
                          <Select
                            value={formData[field.id] || ''}
                            onValueChange={(value) => setFormData({ ...formData, [field.id]: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={field.placeholder || 'Select an option'} />
                            </SelectTrigger>
                            <SelectContent>
                              {field.options.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}

                        {/* Checkbox */}
                        {field.type === 'checkbox' && (
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`form-${field.id}`}
                              checked={formData[field.id] || false}
                              onCheckedChange={(checked) => setFormData({ ...formData, [field.id]: checked })}
                            />
                            <label
                              htmlFor={`form-${field.id}`}
                              className="text-sm text-gray-600 cursor-pointer"
                            >
                              {field.placeholder || 'Yes'}
                            </label>
                          </div>
                        )}

                        {/* Multiselect (as multiple checkboxes) */}
                        {field.type === 'multiselect' && field.options && (
                          <div className="space-y-2">
                            {field.options.map((option) => (
                              <div key={option} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`form-${field.id}-${option}`}
                                  checked={(formData[field.id] || []).includes(option)}
                                  onCheckedChange={(checked) => {
                                    const currentValues = formData[field.id] || [];
                                    const newValues = checked
                                      ? [...currentValues, option]
                                      : currentValues.filter((v: string) => v !== option);
                                    setFormData({ ...formData, [field.id]: newValues });
                                  }}
                                />
                                <label
                                  htmlFor={`form-${field.id}-${option}`}
                                  className="text-sm text-gray-600 cursor-pointer"
                                >
                                  {option}
                                </label>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* File Input (placeholder - requires backend file handling) */}
                        {field.type === 'file' && (
                          <div className="p-4 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-center">
                            <p className="text-sm text-gray-500">
                              File upload coming soon
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Show message if form node but form template not found */}
              {isFormNode && !formTemplate && !loading && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    This step requires a form, but no form template has been configured for this workflow node.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-shrink-0 border-t pt-4 mt-4">
            {/* Auto-save indicator */}
            {formTemplate && Object.keys(formData).length > 0 && (
              <div className="flex-1 text-xs text-gray-500 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                Draft auto-saved
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleProgressWorkflow}
              disabled={submitting || loading || (isApprovalNode && !decision) || (isSyncNode && availableUsers.length > 0 && !selectedUserId)}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isSyncNode ? 'Assigning...' : 'Sending...'}
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  {isApprovalNode
                    ? `${decision === 'approved' ? 'Approve' : 'Reject'} & Send`
                    : isSyncNode
                    ? 'Assign & Continue'
                    : 'Send to Next Step'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

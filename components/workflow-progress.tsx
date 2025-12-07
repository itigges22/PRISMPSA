'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { createClientSupabase } from '@/lib/supabase';
import {
  Play,
  GitBranch,
  Users,
  UserCheck,
  FileText,
  Flag,
  Building2,
  ChevronRight,
  CheckCircle2,
  Clock,
  Loader2,
  CircleDot
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkflowProgressProps {
  workflowInstanceId: string | null;
  onStepClick?: (stepId: string, nodeId: string) => void;
}

interface WorkflowNode {
  id: string;
  label: string;
  node_type: string;
  entity_id: string | null;
  settings: Record<string, unknown>;
}

interface WorkflowConnection {
  id: string;
  from_node_id: string;
  to_node_id: string;
  condition: {
    label?: string;
    decision?: string;
    source_handle?: string;
  } | null;
}

interface ActiveStep {
  id: string;
  node_id: string;
  branch_id: string;
  status: 'active' | 'completed' | 'waiting';
  assigned_user_id: string | null;
  assigned_user?: {
    name: string;
  };
}

interface WorkflowInstance {
  id: string;
  workflow_template_id: string;
  current_node_id: string | null;
  status: string;
  has_parallel_paths: boolean;
  workflow_templates?: {
    name: string;
  };
  started_snapshot?: {
    nodes: WorkflowNode[];
    connections: WorkflowConnection[];
    template_name?: string;
  } | null;
}

interface CurrentStepInfo {
  node: WorkflowNode;
  activeStep: ActiveStep | null;
  assignedUserName?: string;
}

interface NextStepInfo {
  node: WorkflowNode;
  conditionLabel: string | null;
}

// Node types that should be skipped in visualization (they're just routing logic)
const HIDDEN_NODE_TYPES = ['sync', 'conditional'];

// Node type styling configuration
const nodeConfig: Record<string, {
  gradient: string;
  iconBg: string;
  icon: React.ElementType;
  iconColor: string;
  label: string;
}> = {
  start: {
    gradient: 'from-emerald-500 to-green-600',
    iconBg: 'bg-white/20',
    icon: Play,
    iconColor: 'text-white',
    label: 'Start'
  },
  department: {
    gradient: 'from-blue-500 to-indigo-600',
    iconBg: 'bg-white/20',
    icon: GitBranch,
    iconColor: 'text-white',
    label: 'Department'
  },
  role: {
    gradient: 'from-violet-500 to-purple-600',
    iconBg: 'bg-white/20',
    icon: Users,
    iconColor: 'text-white',
    label: 'Role Assignment'
  },
  approval: {
    gradient: 'from-amber-500 to-orange-600',
    iconBg: 'bg-white/20',
    icon: UserCheck,
    iconColor: 'text-white',
    label: 'Approval'
  },
  form: {
    gradient: 'from-cyan-500 to-teal-600',
    iconBg: 'bg-white/20',
    icon: FileText,
    iconColor: 'text-white',
    label: 'Form'
  },
  end: {
    gradient: 'from-slate-500 to-gray-600',
    iconBg: 'bg-white/20',
    icon: Flag,
    iconColor: 'text-white',
    label: 'Complete'
  },
  client: {
    gradient: 'from-orange-500 to-red-500',
    iconBg: 'bg-white/20',
    icon: Building2,
    iconColor: 'text-white',
    label: 'Client'
  },
};

function StepCard({
  node,
  status,
  assignedUserName,
  conditionLabel,
  onClick,
  isClickable = false,
}: {
  node: WorkflowNode;
  status: 'active' | 'completed' | 'waiting' | 'next';
  assignedUserName?: string;
  conditionLabel?: string | null;
  onClick?: () => void;
  isClickable?: boolean;
}) {
  const config = nodeConfig[node.node_type] || nodeConfig.role;
  const Icon = config.icon;

  const isActive = status === 'active';
  const isCompleted = status === 'completed';
  const isWaiting = status === 'waiting';
  const isNext = status === 'next';

  return (
    <div className="flex flex-col items-center">
      {/* Condition label above card */}
      {conditionLabel && (
        <div className="mb-2 px-3 py-1 rounded-full bg-gray-100 border border-gray-200">
          <span className="text-xs font-medium text-gray-600">{conditionLabel}</span>
        </div>
      )}

      {/* Main card */}
      <div
        onClick={isClickable ? onClick : undefined}
        className={cn(
          'relative flex flex-col items-center p-4 rounded-xl transition-all duration-200 min-w-[160px]',
          isNext ? 'bg-gray-50 border-2 border-dashed border-gray-300' : `bg-gradient-to-br ${config.gradient} shadow-lg`,
          isActive && 'ring-4 ring-blue-300 ring-offset-2',
          isWaiting && 'ring-4 ring-amber-300 ring-offset-2',
          isClickable && 'cursor-pointer hover:scale-105 hover:shadow-xl'
        )}
      >
        {/* Status indicator */}
        {isActive && (
          <div className="absolute -top-1.5 -right-1.5 flex items-center justify-center">
            <span className="relative flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500 border-2 border-white"></span>
            </span>
          </div>
        )}
        {isCompleted && (
          <div className="absolute -top-1.5 -right-1.5">
            <CheckCircle2 className="w-5 h-5 text-green-500 bg-white rounded-full" />
          </div>
        )}
        {isWaiting && (
          <div className="absolute -top-1.5 -right-1.5">
            <Clock className="w-5 h-5 text-amber-500 bg-white rounded-full" />
          </div>
        )}

        {/* Icon */}
        <div className={cn(
          'flex items-center justify-center w-12 h-12 rounded-full mb-3',
          isNext ? 'bg-gray-200' : config.iconBg
        )}>
          <Icon className={cn('w-6 h-6', isNext ? 'text-gray-500' : config.iconColor)} />
        </div>

        {/* Label */}
        <p className={cn(
          'font-semibold text-sm text-center leading-tight mb-1',
          isNext ? 'text-gray-700' : 'text-white'
        )}>
          {node.label}
        </p>

        {/* Type badge */}
        <span className={cn(
          'text-xs px-2 py-0.5 rounded-full',
          isNext ? 'bg-gray-200 text-gray-600' : 'bg-white/20 text-white/90'
        )}>
          {config.label}
        </span>

        {/* Assigned user */}
        {assignedUserName && (
          <div className={cn(
            'mt-2 text-xs flex items-center gap-1',
            isNext ? 'text-gray-500' : 'text-white/80'
          )}>
            <CircleDot className="w-3 h-3" />
            {assignedUserName}
          </div>
        )}
      </div>
    </div>
  );
}

export function WorkflowProgress({ workflowInstanceId, onStepClick }: WorkflowProgressProps) {
  const [loading, setLoading] = useState(true);
  const [workflowInstance, setWorkflowInstance] = useState<WorkflowInstance | null>(null);
  const [currentSteps, setCurrentSteps] = useState<CurrentStepInfo[]>([]);
  const [nextSteps, setNextSteps] = useState<NextStepInfo[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    if (workflowInstanceId) {
      loadWorkflowProgress();
    } else {
      setLoading(false);
    }
  }, [workflowInstanceId]);

  /**
   * Recursively find the actual actionable nodes, skipping sync/conditional nodes
   */
  const findActionableNextNodes = (
    startNodeId: string,
    connections: WorkflowConnection[],
    nodeMap: Map<string, WorkflowNode>,
    inheritedLabel: string | null,
    visited: Set<string> = new Set()
  ): NextStepInfo[] => {
    // Prevent infinite loops
    if (visited.has(startNodeId)) return [];
    visited.add(startNodeId);

    const results: NextStepInfo[] = [];

    // Find all outgoing connections from this node
    const outgoing = connections.filter((c: WorkflowConnection) => c.from_node_id === startNodeId);

    for (const conn of outgoing) {
      const nextNode = nodeMap.get(conn.to_node_id);
      if (!nextNode) continue;

      // Build condition label
      let conditionLabel = inheritedLabel;
      const condition = conn.condition;
      if (condition) {
        if (condition.label) {
          conditionLabel = condition.label;
        } else if (condition.decision) {
          const decisionMap: Record<string, string> = {
            'approved': 'If Approved',
            'approve': 'If Approved',
            'rejected': 'If Rejected',
            'reject': 'If Rejected',
            'needs_changes': 'If Needs Changes',
            'needs-changes': 'If Needs Changes',
            'default': 'Continue',
          };
          conditionLabel = decisionMap[condition.decision.toLowerCase()] || condition.decision;
        } else if (condition.source_handle) {
          conditionLabel = condition.source_handle;
        }
      }

      // If this is a hidden node type (sync/conditional), follow through to its children
      if (HIDDEN_NODE_TYPES.includes(nextNode.node_type)) {
        const childResults = findActionableNextNodes(
          nextNode.id,
          connections,
          nodeMap,
          conditionLabel,
          visited
        );
        results.push(...childResults);
      } else {
        // This is an actionable node - add it
        results.push({
          node: nextNode,
          conditionLabel,
        });
      }
    }

    return results;
  };

  const loadWorkflowProgress = async () => {
    try {
      setLoading(true);
      const supabase = createClientSupabase();
      if (!supabase) return;

      // Get workflow instance with snapshot
      const { data: instance, error: instanceError } = await supabase
        .from('workflow_instances')
        .select(`
          *,
          started_snapshot,
          workflow_templates(name)
        `)
        .eq('id', workflowInstanceId)
        .single();

      if (instanceError || !instance) {
        console.error('Error loading workflow instance:', instanceError);
        return;
      }

      setWorkflowInstance(instance);
      setIsCompleted(instance.status === 'completed');

      let allNodes: WorkflowNode[] = [];
      let connections: WorkflowConnection[] = [];

      // Use snapshot if available (this ensures deleted templates don't break projects)
      if (instance.started_snapshot?.nodes && instance.started_snapshot?.connections) {
        console.log('[WorkflowProgress] Using snapshot data');
        allNodes = instance.started_snapshot.nodes;
        connections = instance.started_snapshot.connections;
      } else {
        // Fallback to live tables for older instances without snapshot
        console.log('[WorkflowProgress] Falling back to live table queries');

        const { data: liveNodes, error: nodesError } = await supabase
          .from('workflow_nodes')
          .select('*')
          .eq('workflow_template_id', instance.workflow_template_id);

        if (nodesError || !liveNodes) {
          console.error('Error loading workflow nodes:', nodesError);
          return;
        }
        allNodes = liveNodes;

        const { data: liveConnections, error: connectionsError } = await supabase
          .from('workflow_connections')
          .select('*')
          .eq('workflow_template_id', instance.workflow_template_id);

        if (connectionsError) {
          console.error('Error loading connections:', connectionsError);
          return;
        }
        connections = liveConnections || [];
      }

      if (!allNodes || allNodes.length === 0) {
        console.error('No workflow nodes found');
        return;
      }

      // Build node map for quick lookup
      const nodeMap = new Map<string, WorkflowNode>();
      allNodes.forEach((node: WorkflowNode) => nodeMap.set(node.id, node));

      // If workflow is completed, show the end node
      if (instance.status === 'completed') {
        const endNode = allNodes.find((n: WorkflowNode) => n.node_type === 'end');
        if (endNode) {
          setCurrentSteps([{ node: endNode, activeStep: null }]);
          setNextSteps([]);
        }
        setLoading(false);
        return;
      }

      // Get active steps (parallel workflow support)
      const { data: activeSteps, error: stepsError } = await supabase
        .from('workflow_active_steps')
        .select(`
          *,
          assigned_user:user_profiles!workflow_active_steps_assigned_user_id_fkey(name)
        `)
        .eq('workflow_instance_id', workflowInstanceId)
        .in('status', ['active', 'waiting']);

      if (stepsError) {
        console.error('Error loading active steps:', stepsError);
      }

      // Determine current steps
      const currentStepInfos: CurrentStepInfo[] = [];

      if (activeSteps && activeSteps.length > 0) {
        activeSteps.forEach((step: ActiveStep & { assigned_user?: { name: string } }) => {
          const node = nodeMap.get(step.node_id);
          if (node) {
            currentStepInfos.push({
              node,
              activeStep: step as ActiveStep,
              assignedUserName: step.assigned_user?.name,
            });
          }
        });
      } else if (instance.current_node_id) {
        const node = nodeMap.get(instance.current_node_id);
        if (node) {
          currentStepInfos.push({ node, activeStep: null });
        }
      }

      setCurrentSteps(currentStepInfos);

      // Find all actionable next steps (skipping sync/conditional nodes)
      const nextStepInfos: NextStepInfo[] = [];
      const seenNextNodes = new Set<string>();

      currentStepInfos.forEach(currentStep => {
        const actionableSteps = findActionableNextNodes(
          currentStep.node.id,
          connections || [],
          nodeMap,
          null
        );

        actionableSteps.forEach(step => {
          // Avoid duplicates
          if (!seenNextNodes.has(step.node.id)) {
            seenNextNodes.add(step.node.id);
            nextStepInfos.push(step);
          }
        });
      });

      setNextSteps(nextStepInfos);

    } catch (error) {
      console.error('Error loading workflow progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStepClick = (currentStep: CurrentStepInfo) => {
    if (currentStep.activeStep && onStepClick) {
      onStepClick(currentStep.activeStep.id, currentStep.node.id);
    }
  };

  if (!workflowInstanceId) {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Workflow Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!workflowInstance || currentSteps.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Workflow Progress</CardTitle>
          <div className="flex items-center gap-2">
            {(workflowInstance.started_snapshot?.template_name || workflowInstance.workflow_templates?.name) && (
              <Badge variant="outline" className="text-xs font-normal">
                {workflowInstance.started_snapshot?.template_name || workflowInstance.workflow_templates?.name?.replace(/^\[DELETED\]\s*/, '')}
              </Badge>
            )}
            <Badge
              variant={isCompleted ? 'secondary' : 'default'}
              className={cn(
                'text-xs',
                isCompleted && 'bg-green-100 text-green-700 border-green-200'
              )}
            >
              {isCompleted ? 'Completed' : 'In Progress'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Main progress visualization - centered */}
        <div className="flex flex-col items-center justify-center py-4">
          <div className="flex items-center justify-center gap-6 flex-wrap">
            {/* Current Step(s) */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {isCompleted ? 'Completed' : 'Current Step'}
              </span>
              <div className="flex items-center gap-4">
                {currentSteps.map((step) => (
                  <StepCard
                    key={step.node.id}
                    node={step.node}
                    status={
                      isCompleted
                        ? 'completed'
                        : step.activeStep?.status === 'waiting'
                          ? 'waiting'
                          : 'active'
                    }
                    assignedUserName={step.assignedUserName}
                    onClick={() => handleStepClick(step)}
                    isClickable={!!step.activeStep && !!onStepClick}
                  />
                ))}
              </div>
            </div>

            {/* Arrow */}
            {nextSteps.length > 0 && !isCompleted && (
              <div className="flex items-center justify-center px-2">
                <div className="flex items-center gap-1 text-gray-400">
                  <div className="w-8 h-0.5 bg-gray-300" />
                  <ChevronRight className="w-6 h-6" />
                </div>
              </div>
            )}

            {/* Next Step(s) */}
            {nextSteps.length > 0 && !isCompleted && (
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {nextSteps.length > 1 ? 'Possible Next' : 'Next Step'}
                </span>
                <div className="flex items-start gap-4">
                  {nextSteps.map((step, index) => (
                    <StepCard
                      key={`${step.node.id}-${index}`}
                      node={step.node}
                      status="next"
                      conditionLabel={step.conditionLabel}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Compact legend */}
        <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
            </span>
            <span>Active</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>Waiting</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            <span>Done</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-3 border-2 border-dashed border-gray-300 rounded" />
            <span>Next</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

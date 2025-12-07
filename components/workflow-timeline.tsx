'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import { createClientSupabase } from '@/lib/supabase';

interface WorkflowTimelineProps {
  workflowInstanceId: string | null;
}

interface WorkflowNode {
  id: string;
  label: string;
  node_type: string;
  position_x: number;
  position_y: number;
}

interface WorkflowConnection {
  from_node_id: string;
  to_node_id: string;
}

interface WorkflowInstance {
  id: string;
  workflow_template_id: string;
  current_node_id: string | null;
  status: string;
  workflow_templates?: {
    name: string;
  };
  started_snapshot?: {
    nodes?: any[];
    connections?: any[];
    template_name?: string;
  } | null;
}

export function WorkflowTimeline({ workflowInstanceId }: WorkflowTimelineProps) {
  const [loading, setLoading] = useState(true);
  const [workflowInstance, setWorkflowInstance] = useState<WorkflowInstance | null>(null);
  const [orderedNodes, setOrderedNodes] = useState<WorkflowNode[]>([]);
  const [currentNodeIndex, setCurrentNodeIndex] = useState<number>(-1);

  useEffect(() => {
    if (workflowInstanceId) {
      loadWorkflowTimeline();
    } else {
      setLoading(false);
    }
  }, [workflowInstanceId]);

  const loadWorkflowTimeline = async () => {
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
        console.error('Error loading workflow instance:', {
          error: instanceError,
          errorCode: instanceError?.code,
          errorMessage: instanceError?.message,
          errorDetails: instanceError?.details,
          workflowInstanceId,
          instanceData: instance
        });
        return;
      }

      setWorkflowInstance(instance);

      // Get nodes and connections - prefer snapshot over live tables
      // This ensures deleted/modified templates don't break in-progress workflows
      let nodes: any[] = [];
      let connections: any[] = [];

      if (instance.started_snapshot?.nodes && instance.started_snapshot?.connections) {
        // Use snapshot data (protects against template deletion/modification)
        nodes = instance.started_snapshot.nodes;
        connections = instance.started_snapshot.connections;
        console.log('[WorkflowTimeline] Using snapshot data');
      } else {
        // Fallback to live tables for older instances without snapshot
        console.log('[WorkflowTimeline] No snapshot, querying live tables');
        const { data: liveNodes, error: nodesError } = await supabase
          .from('workflow_nodes')
          .select('*')
          .eq('workflow_template_id', instance.workflow_template_id)
          .order('position_y');

        if (nodesError || !liveNodes) {
          console.error('Error loading workflow nodes:', nodesError);
          return;
        }

        const { data: liveConnections, error: connectionsError } = await supabase
          .from('workflow_connections')
          .select('*')
          .eq('workflow_template_id', instance.workflow_template_id);

        if (connectionsError) {
          console.error('Error loading connections:', connectionsError);
          return;
        }

        nodes = liveNodes;
        connections = liveConnections || [];
      }

      // Build ordered node list by following connections from start node
      const ordered = buildOrderedNodeList(nodes, connections);
      setOrderedNodes(ordered);

      // Find current node index
      const currentIndex = ordered.findIndex(n => n.id === instance.current_node_id);
      setCurrentNodeIndex(currentIndex);

    } catch (error) {
      console.error('Error loading workflow timeline:', error);
    } finally {
      setLoading(false);
    }
  };

  const buildOrderedNodeList = (nodes: WorkflowNode[], connections: WorkflowConnection[]): WorkflowNode[] => {
    // Find start node
    const startNode = nodes.find(n => n.node_type === 'start');
    if (!startNode) {
      // Fallback: sort by position_y, excluding conditional nodes
      return nodes
        .filter(n => n.node_type !== 'conditional')
        .sort((a, b) => a.position_y - b.position_y);
    }

    const ordered: WorkflowNode[] = [startNode];
    const visited = new Set<string>([startNode.id]);

    let currentNode = startNode;
    let maxIterations = nodes.length * 2; // Allow extra iterations for skipping conditionals
    let iterations = 0;

    while (iterations < maxIterations) {
      iterations++;

      // Find next node from connections
      const connection = connections.find(c => c.from_node_id === currentNode.id);
      if (!connection) break;

      const nextNode = nodes.find(n => n.id === connection.to_node_id);
      if (!nextNode || visited.has(nextNode.id)) break;

      visited.add(nextNode.id);

      // Skip conditional nodes - they're just routing logic, not visible steps
      if (nextNode.node_type === 'conditional') {
        // Follow through to the next node without adding conditional to the list
        currentNode = nextNode;
        continue;
      }

      ordered.push(nextNode);
      currentNode = nextNode;

      // Stop at end node
      if (nextNode.node_type === 'end') break;
    }

    return ordered;
  };

  const getNodeTypeColor = (nodeType: string) => {
    switch (nodeType) {
      case 'start': return 'bg-green-100 text-green-800 border-green-300';
      case 'approval': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'role': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'department': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'form': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'end': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  if (!workflowInstanceId) {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Workflow Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!workflowInstance || orderedNodes.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Workflow Progress</span>
          {(workflowInstance.started_snapshot?.template_name || workflowInstance.workflow_templates?.name) && (
            <Badge variant="outline" className="font-normal">
              {workflowInstance.started_snapshot?.template_name || workflowInstance.workflow_templates?.name?.replace(/^\[DELETED\]\s*/, '')}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Timeline */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-4">
            {orderedNodes.map((node, index) => {
              const isPast = index < currentNodeIndex;
              const isCurrent = index === currentNodeIndex;
              const isFuture = index > currentNodeIndex;

              return (
                <div key={node.id} className="flex items-center gap-2 flex-shrink-0">
                  {/* Node */}
                  <div className="flex flex-col items-center gap-2 min-w-[120px]">
                    {/* Icon */}
                    <div className={`
                      flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all
                      ${isPast ? 'bg-green-500 border-green-500' : ''}
                      ${isCurrent ? 'bg-blue-500 border-blue-500 ring-4 ring-blue-200' : ''}
                      ${isFuture ? 'bg-gray-200 border-gray-300' : ''}
                    `}>
                      {isPast ? (
                        <CheckCircle2 className="w-6 h-6 text-white" />
                      ) : isCurrent ? (
                        <Circle className="w-6 h-6 text-white fill-current" />
                      ) : (
                        <Circle className="w-6 h-6 text-gray-400" />
                      )}
                    </div>

                    {/* Label */}
                    <div className="text-center">
                      <p className={`text-sm font-medium ${isCurrent ? 'text-blue-600' : isPast ? 'text-green-600' : 'text-gray-500'}`}>
                        {node.label}
                      </p>
                      <Badge
                        variant="outline"
                        className={`text-xs mt-1 ${getNodeTypeColor(node.node_type)}`}
                      >
                        {node.node_type}
                      </Badge>
                    </div>
                  </div>

                  {/* Arrow (not after last node) */}
                  {index < orderedNodes.length - 1 && (
                    <ArrowRight
                      className={`w-6 h-6 flex-shrink-0 ${
                        isPast ? 'text-green-500' : 'text-gray-300'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Status indicator */}
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Status:</span>
                <Badge variant={workflowInstance.status === 'active' ? 'default' : 'secondary'}>
                  {workflowInstance.status}
                </Badge>
              </div>
              <div className="text-gray-600">
                Step {currentNodeIndex + 1} of {orderedNodes.length}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

'use client';

import { useState, useCallback, useRef, DragEvent } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  ReactFlowProvider,
  NodeTypes,
  MarkerType,
  Panel,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { WorkflowNode, WorkflowNodeData, WorkflowNodeType } from './workflow-node';
import { NodeSidebar } from './node-sidebar';
import { NodeConfigDialog } from './node-config-dialog';
import { LabeledEdge, LabeledEdgeData } from './labeled-edge';
import { EdgeConfigDialog } from './edge-config-dialog';
import { WorkflowTutorialDialog } from './workflow-tutorial-dialog';
import { Button } from '@/components/ui/button';
import { Save, Trash2, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

interface Department {
  id: string;
  name: string;
}

interface Role {
  id: string;
  name: string;
  department_id: string;
}

interface WorkflowCanvasProps {
  templateId: string;
  initialNodes?: Node<WorkflowNodeData>[];
  initialEdges?: Edge[];
  departments: Department[];
  roles: Role[];
  onSave?: (nodes: Node<WorkflowNodeData>[], edges: Edge[]) => Promise<void>;
}

const nodeTypes: NodeTypes = {
  workflowNode: WorkflowNode,
};

const edgeTypes = {
  labeled: LabeledEdge,
};

const defaultEdgeOptions = {
  type: 'smoothstep',
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 20,
    height: 20,
  },
  style: {
    strokeWidth: 2,
    stroke: '#64748b',
  },
};

function WorkflowCanvasInner({
  templateId,
  initialNodes = [],
  initialEdges = [],
  departments,
  roles,
  onSave,
}: WorkflowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { screenToFlowPosition } = useReactFlow();
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedNodeForConfig, setSelectedNodeForConfig] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [edgeConfigDialogOpen, setEdgeConfigDialogOpen] = useState(false);
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);
  const [tutorialDialogOpen, setTutorialDialogOpen] = useState(false);

  const onConnect = useCallback(
    (params: Connection) => {
      // Check if source node is conditional
      const sourceNode = nodes.find((n) => n.id === params.source);
      if (sourceNode?.data.type === 'conditional') {
        // Open edge config dialog for conditional nodes
        setPendingConnection(params);
        setEdgeConfigDialogOpen(true);
      } else {
        // Add edge normally
        setEdges((eds) => addEdge(params, eds));
      }
    },
    [nodes, setEdges]
  );

  const handleEdgeConfigSave = useCallback(
    (data: LabeledEdgeData) => {
      if (!pendingConnection) return;

      const newEdge: Edge = {
        id: `edge-${pendingConnection.source}-${pendingConnection.target}-${Date.now()}`,
        source: pendingConnection.source!,
        target: pendingConnection.target!,
        sourceHandle: pendingConnection.sourceHandle,
        targetHandle: pendingConnection.targetHandle,
        type: 'labeled',
        data,
      };

      setEdges((eds) => addEdge(newEdge, eds));
      setPendingConnection(null);
      setEdgeConfigDialogOpen(false);
    },
    [pendingConnection, setEdges]
  );

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      if (!reactFlowWrapper.current) return;

      const type = event.dataTransfer.getData('application/reactflow') as WorkflowNodeType;

      if (!type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNodeId = `${type}-${Date.now()}`;
      const newNode: Node<WorkflowNodeData> = {
        id: newNodeId,
        type: 'workflowNode',
        position,
        data: {
          label: type.charAt(0).toUpperCase() + type.slice(1),
          type,
        },
      };

      setNodes((nds) => nds.concat(newNode));

      // Open config dialog for nodes that need configuration
      if (['department', 'role', 'approval'].includes(type)) {
        setSelectedNodeForConfig(newNodeId);
        setConfigDialogOpen(true);
      }
    },
    [screenToFlowPosition, setNodes]
  );

  const onNodeDoubleClick = useCallback((_event: React.MouseEvent, node: Node) => {
    if (node.data.type !== 'start' && node.data.type !== 'end') {
      setSelectedNodeForConfig(node.id);
      setConfigDialogOpen(true);
    }
  }, []);

  const handleConfigSave = useCallback(
    (data: WorkflowNodeData) => {
      if (!selectedNodeForConfig) return;

      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === selectedNodeForConfig) {
            return {
              ...node,
              data,
            };
          }
          return node;
        })
      );
    },
    [selectedNodeForConfig, setNodes]
  );

  const handleSave = async () => {
    if (!onSave) {
      toast.error('Save function not provided');
      return;
    }

    // Validate workflow
    if (nodes.length === 0) {
      toast.error('Workflow is empty. Add at least one node.');
      return;
    }

    const hasStart = nodes.some((n) => n.data.type === 'start');
    const hasEnd = nodes.some((n) => n.data.type === 'end');

    if (!hasStart) {
      toast.error('Workflow must have a Start node');
      return;
    }

    if (!hasEnd) {
      toast.error('Workflow must have an End node');
      return;
    }

    // Check for unconfigured nodes with detailed validation
    const unconfiguredNodes: { node: any; reason: string }[] = [];

    nodes.forEach((node) => {
      if (node.data.type === 'department' && !node.data.config?.departmentId) {
        unconfiguredNodes.push({ node, reason: 'Department not selected' });
      } else if (node.data.type === 'role' && !node.data.config?.roleId) {
        unconfiguredNodes.push({ node, reason: 'Role not selected' });
      } else if (node.data.type === 'approval' && !node.data.config?.approverRoleId) {
        unconfiguredNodes.push({ node, reason: 'Approver role not selected' });
      } else if (node.data.type === 'form') {
        if (!node.data.config?.formName || !node.data.config?.formName.trim()) {
          unconfiguredNodes.push({ node, reason: 'Form name is required' });
        } else if (!node.data.config?.formFields || node.data.config.formFields.length === 0) {
          unconfiguredNodes.push({ node, reason: 'At least one form field is required' });
        }
      } else if (node.data.type === 'conditional' && !node.data.config?.conditionType) {
        unconfiguredNodes.push({ node, reason: 'Condition type not selected' });
      }
    });

    if (unconfiguredNodes.length > 0) {
      const errorMessages = unconfiguredNodes.map(
        (item) => `"${item.node.data.label}": ${item.reason}`
      );
      toast.error(
        `Please configure all nodes before saving:\n${errorMessages.join('\n')}`,
        { duration: 6000 }
      );
      return;
    }

    // Validate that a path from Start to End exists
    // This allows revision loops (rejection → back to previous step) while ensuring
    // the workflow can complete through the "approved" path
    const hasPathToEnd = (): boolean => {
      const startNode = nodes.find((n) => n.data.type === 'start');
      const endNode = nodes.find((n) => n.data.type === 'end');
      if (!startNode || !endNode) return false;

      const visited = new Set<string>();
      const queue = [startNode.id];

      while (queue.length > 0) {
        const currentId = queue.shift()!;
        if (currentId === endNode.id) return true; // Found path to end
        if (visited.has(currentId)) continue;
        visited.add(currentId);

        const currentNode = nodes.find((n) => n.id === currentId);
        const outgoingEdges = edges.filter((e) => e.source === currentId);

        for (const edge of outgoingEdges) {
          // For conditional nodes, follow all paths for validation
          // Rejection loops are valid as long as an approval path to End exists
          if (currentNode?.data.type === 'conditional') {
            const edgeData = edge.data as any;
            // Follow approved path OR any path without a decision label (default path)
            // Skip rejected/needs_changes paths as they create valid revision loops
            if (edgeData?.decision === 'approved' || edgeData?.decision === undefined || edgeData?.decision === null) {
              queue.push(edge.target);
            }
          } else {
            // For non-conditional nodes, follow all outgoing edges
            queue.push(edge.target);
          }
        }
      }

      return false; // No path to end found
    };

    if (!hasPathToEnd()) {
      toast.error('Workflow must have a valid path from Start to End through approval steps. Check your connections.');
      return;
    }

    // Check for orphaned nodes (nodes with no connections)
    const connectedNodes = new Set<string>();
    edges.forEach((edge) => {
      connectedNodes.add(edge.source);
      connectedNodes.add(edge.target);
    });

    const orphanedNodes = nodes.filter(
      (node) => !connectedNodes.has(node.id) && node.data.type !== 'start' && node.data.type !== 'end'
    );

    if (orphanedNodes.length > 0) {
      toast.error(`${orphanedNodes.length} node(s) are not connected to the workflow. All nodes must be connected.`);
      return;
    }

    setSaving(true);
    try {
      await onSave(nodes, edges);
      toast.success('Workflow saved successfully!');
    } catch (error) {
      console.error('Error saving workflow:', error);
      toast.error('Failed to save workflow');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = useCallback(() => {
    if (confirm('Are you sure you want to clear the entire workflow?')) {
      setNodes([]);
      setEdges([]);
      toast.success('Workflow cleared');
    }
  }, [setNodes, setEdges]);

  const handleDeleteSelected = useCallback(() => {
    setNodes((nds) => nds.filter((node) => !node.selected));
    setEdges((eds) => eds.filter((edge) => !edge.selected));
  }, [setNodes, setEdges]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeForConfig);

  return (
    <div className="h-full w-full flex">
      <NodeSidebar />
      <div className="flex-1 relative" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeDoubleClick={onNodeDoubleClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          attributionPosition="bottom-left"
        >
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
          <Controls />

          <Panel position="top-right" className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save className="w-4 h-4 mr-1" />
              {saving ? 'Saving...' : 'Save Workflow'}
            </Button>
            <Button onClick={handleDeleteSelected} size="sm" variant="outline">
              <Trash2 className="w-4 h-4 mr-1" />
              Delete Selected
            </Button>
            <Button onClick={handleClear} size="sm" variant="outline">
              <Trash2 className="w-4 h-4 mr-1" />
              Clear All
            </Button>
            <Button onClick={() => setTutorialDialogOpen(true)} size="sm" variant="outline">
              <BookOpen className="w-4 h-4 mr-1" />
              Tutorial
            </Button>
          </Panel>
        </ReactFlow>

        <NodeConfigDialog
          open={configDialogOpen}
          onOpenChange={setConfigDialogOpen}
          nodeData={selectedNode?.data || null}
          onSave={handleConfigSave}
          departments={departments}
          roles={roles}
        />

        <EdgeConfigDialog
          open={edgeConfigDialogOpen}
          onOpenChange={setEdgeConfigDialogOpen}
          sourceNodeType={
            pendingConnection?.source
              ? nodes.find((n) => n.id === pendingConnection.source)?.data.type || 'conditional'
              : 'conditional'
          }
          conditionType={
            pendingConnection?.source
              ? nodes.find((n) => n.id === pendingConnection.source)?.data.config?.conditionType
              : 'approval_decision'
          }
          onSave={handleEdgeConfigSave}
        />

        <WorkflowTutorialDialog
          open={tutorialDialogOpen}
          onOpenChange={setTutorialDialogOpen}
        />
      </div>
    </div>
  );
}

export function WorkflowCanvas(props: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

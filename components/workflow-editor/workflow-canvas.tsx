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
  useUpdateNodeInternals,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { v4 as uuidv4 } from 'uuid';
import { WorkflowNode, WorkflowNodeData, WorkflowNodeType } from './workflow-node';
import { NodeSidebar } from './node-sidebar';
import { NodeConfigDialog } from './node-config-dialog';
import { LabeledEdge, LabeledEdgeData } from './labeled-edge';
import { EdgeConfigDialog } from './edge-config-dialog';
import { WorkflowTutorialDialog } from './workflow-tutorial-dialog';
import { Button } from '@/components/ui/button';
import { Save, Trash2, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { validateWorkflow } from '@/lib/workflow-validation';

interface Department {
  id: string;
  name: string;
}

interface Role {
  id: string;
  name: string;
  department_id: string;
  user_count?: number;
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
  type: 'labeled', // Use custom labeled edge for curved bezier style and hover effects on ALL edges
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
  const updateNodeInternals = useUpdateNodeInternals();
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedNodeForConfig, setSelectedNodeForConfig] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [edgeConfigDialogOpen, setEdgeConfigDialogOpen] = useState(false);
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);
  const [tutorialDialogOpen, setTutorialDialogOpen] = useState(false);

  const onConnect = useCallback(
    (params: Connection) => {
      const sourceNode = nodes.find((n) => n.id === params.source);
      const targetNode = nodes.find((n) => n.id === params.target);

      // CASE 1: Connecting FROM a conditional node
      // The sourceHandle identifies which branch - auto-set the label based on handle
      if (sourceNode?.data.type === 'conditional') {
        const handleId = params.sourceHandle;

        // Find the condition from config - this contains the actual evaluation parameters
        let label = handleId || 'Unknown';
        let edgeData: Record<string, any> = {
          label,
          conditionValue: handleId,
          conditionType: 'form_value',
          decision: handleId,
        };

        if (sourceNode.data.config?.conditions) {
          const condition = sourceNode.data.config.conditions.find(
            (c: any) => c.value === handleId || c.id === handleId
          );
          if (condition) {
            label = condition.label || handleId || 'Unknown';
            // Include full condition data for form evaluation
            edgeData = {
              label,
              conditionValue: condition.value,
              conditionType: condition.conditionType, // 'equals', 'contains', etc.
              decision: handleId,
              // Critical: These fields are needed for form-based conditional routing
              sourceFormFieldId: sourceNode.data.config.sourceFormFieldId,
              value: condition.value,
              value2: condition.value2,
            };
          }
        }

        const newEdge: Edge = {
          id: uuidv4(),
          source: params.source!,
          target: params.target!,
          sourceHandle: params.sourceHandle,
          targetHandle: params.targetHandle,
          type: 'labeled',
          data: edgeData,
        };
        setEdges((eds) => addEdge(newEdge, eds));
        return;
      }

      // CASE 2: Connecting FROM an approval node TO a conditional node
      // No dialog needed - the conditional will handle the branching
      if (sourceNode?.data.type === 'approval' && targetNode?.data.type === 'conditional') {
        const newEdge: Edge = {
          id: uuidv4(),
          source: params.source!,
          target: params.target!,
          sourceHandle: params.sourceHandle,
          targetHandle: params.targetHandle,
          type: 'labeled',
          data: {}, // No decision label - flows into conditional for routing
        };
        setEdges((eds) => addEdge(newEdge, eds));
        return;
      }

      // CASE 3: Connecting FROM an approval node to any other node type
      // Show dialog to select approved/rejected path
      if (sourceNode?.data.type === 'approval') {
        setPendingConnection(params);
        setEdgeConfigDialogOpen(true);
        return;
      }

      // NOTE: Sync nodes are deprecated (parallel workflows disabled)
      // Legacy sync nodes will be blocked by validation

      // CASE 4: All other connections - no dialog, just connect with curved style
      const newEdge: Edge = {
        id: uuidv4(),
        source: params.source!,
        target: params.target!,
        sourceHandle: params.sourceHandle,
        targetHandle: params.targetHandle,
        type: 'labeled', // Use labeled edge for curved bezier style and hover effects
        data: {}, // No label data for non-conditional edges
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [nodes, setEdges]
  );

  const handleEdgeConfigSave = useCallback(
    (data: LabeledEdgeData) => {
      if (!pendingConnection) return;

      const newEdge: Edge = {
        id: uuidv4(),
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

      // Generate a proper UUID for the node (required by database)
      const newNodeId = uuidv4();
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
    (data: WorkflowNodeData, clearOutgoingEdges?: boolean) => {
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

      // Clear outgoing edges if condition type changed (for conditional nodes)
      if (clearOutgoingEdges) {
        setEdges((eds) => eds.filter((edge) => edge.source !== selectedNodeForConfig));
      }

      // CRITICAL: Force React Flow to recalculate handle bounds after config change.
      // This is necessary because when conditional node branches are added dynamically
      // (via the config dialog), React Flow doesn't automatically register the new handles.
      // Without this, newly created conditional node handles won't be draggable.
      // Use setTimeout to ensure the DOM has updated before recalculating.
      setTimeout(() => {
        updateNodeInternals(selectedNodeForConfig);
      }, 50);
    },
    [selectedNodeForConfig, setNodes, setEdges, updateNodeInternals]
  );

  const handleSave = async () => {
    if (!onSave) {
      toast.error('Save function not provided');
      return;
    }

    // Debug logging
    console.log('[Workflow Canvas] Initiating save...');
    console.log('[Workflow Canvas] Nodes to save:', nodes.length);
    console.log('[Workflow Canvas] Node IDs:', nodes.map(n => ({ id: n.id, type: n.data.type, label: n.data.label })));
    console.log('[Workflow Canvas] Edges to save:', edges.length);
    console.log('[Workflow Canvas] Edge connections:', edges.map(e => ({ id: e.id, source: e.source, target: e.target })));

    // Run comprehensive workflow validation
    // Note: Role user count validation is NOT done here - workflows can be saved
    // even if roles don't have users yet. The validation happens when ACTIVATING.
    const validation = validateWorkflow(nodes, edges);

    // Show errors first (blocking)
    if (!validation.valid) {
      const errorMessages = validation.errors.map((e) => {
        const nodeInfo = e.nodeLabel ? ` ("${e.nodeLabel}")` : '';
        return `${e.message}${nodeInfo}`;
      });
      toast.error(
        `Cannot save workflow:\n${errorMessages.join('\n')}`,
        { duration: 8000 }
      );
      return;
    }

    // Show warnings (non-blocking, but inform user)
    if (validation.warnings.length > 0) {
      const warningMessages = validation.warnings.map((w) => {
        const nodeInfo = w.nodeLabel ? ` ("${w.nodeLabel}")` : '';
        return `${w.message}${nodeInfo}`;
      });
      toast.warning(
        `Workflow has warnings:\n${warningMessages.join('\n')}`,
        { duration: 6000 }
      );
    }

    // Check for unconfigured nodes with detailed validation
    // (This is separate from structural validation - checks node-specific config)
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
          nodeId={selectedNodeForConfig || undefined}
          allNodes={nodes}
          allEdges={edges}
          onSave={handleConfigSave}
          departments={departments}
          roles={roles}
        />

        <EdgeConfigDialog
          open={edgeConfigDialogOpen}
          onOpenChange={setEdgeConfigDialogOpen}
          sourceNodeType={
            pendingConnection?.source
              ? nodes.find((n) => n.id === pendingConnection.source)?.data.type || 'approval'
              : 'approval'
          }
          conditionType="approval_decision"
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

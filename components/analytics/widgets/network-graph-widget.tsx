'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import useSWR from 'swr';
import {
  ReactFlow,
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  ReactFlowProvider,
  MarkerType,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { WidgetBase, StatCard, WidgetEmptyState } from './widget-base';
import { NetworkNode } from '../network/network-node';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, FolderKanban, Building2, GitBranch, RefreshCw, Maximize2 } from 'lucide-react';

interface NetworkNodeData {
  id: string;
  type: 'user' | 'project' | 'account' | 'department';
  label: string;
  data: {
    hoursLogged?: number;
    utilization?: number;
    status?: string;
    projectCount?: number;
    userCount?: number;
    serviceTier?: string;
    role?: string;
    email?: string;
  };
  size: number;
}

interface NetworkEdgeData {
  id: string;
  source: string;
  target: string;
  type: 'assignment' | 'belongs_to' | 'member_of';
  data: {
    weight: number;
    hoursContributed?: number;
    label?: string;
  };
}

interface NetworkData {
  nodes: NetworkNodeData[];
  edges: NetworkEdgeData[];
  metadata: {
    totalUsers: number;
    totalProjects: number;
    totalAccounts: number;
    totalEdges: number;
  };
}

const nodeTypes = {
  networkNode: NetworkNode,
};

const fetcher = (url: string) => fetch(url).then(res => res.json());

// Force-directed layout algorithm
function calculateLayout(
  networkNodes: NetworkNodeData[],
  networkEdges: NetworkEdgeData[],
  width: number,
  height: number
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Group nodes by type for layered layout
  const userNodes = networkNodes.filter(n => n.type === 'user');
  const projectNodes = networkNodes.filter(n => n.type === 'project');
  const accountNodes = networkNodes.filter(n => n.type === 'account');

  // Position accounts at top
  const accountSpacing = width / (accountNodes.length + 1);
  accountNodes.forEach((node, index) => {
    nodes.push({
      id: node.id,
      type: 'networkNode',
      position: { x: accountSpacing * (index + 1) - 75, y: 50 },
      data: {
        label: node.label,
        type: node.type,
        ...node.data,
      },
    });
  });

  // Position projects in middle
  const projectSpacing = width / (projectNodes.length + 1);
  projectNodes.forEach((node, index) => {
    nodes.push({
      id: node.id,
      type: 'networkNode',
      position: { x: projectSpacing * (index + 1) - 60, y: height / 2 - 50 },
      data: {
        label: node.label,
        type: node.type,
        ...node.data,
      },
    });
  });

  // Position users at bottom
  const userSpacing = width / (userNodes.length + 1);
  userNodes.forEach((node, index) => {
    nodes.push({
      id: node.id,
      type: 'networkNode',
      position: { x: userSpacing * (index + 1) - 50, y: height - 150 },
      data: {
        label: node.label,
        type: node.type,
        ...node.data,
      },
    });
  });

  // Create edges
  networkEdges.forEach(edge => {
    const strokeWidth = Math.max(1, Math.min(4, edge.data.weight));
    const isAssignment = edge.type === 'assignment';

    edges.push({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'default',
      animated: isAssignment,
      style: {
        strokeWidth,
        stroke: isAssignment ? '#3b82f6' : '#f59e0b',
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: isAssignment ? '#3b82f6' : '#f59e0b',
      },
      label: edge.data.hoursContributed ? `${edge.data.hoursContributed}h` : undefined,
      labelStyle: { fontSize: 10, fill: '#666' },
    });
  });

  return { nodes, edges };
}

function NetworkGraphContent() {
  const [layout, setLayout] = useState<'hierarchical' | 'force'>('hierarchical');
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const { data, error, isLoading, mutate } = useSWR<{ success: boolean; data: NetworkData }>(
    '/api/analytics/network',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  );

  const networkData = data?.data;

  // Calculate and set layout when data changes
  useEffect(() => {
    if (!networkData || networkData.nodes.length === 0) return;

    const { nodes: layoutNodes, edges: layoutEdges } = calculateLayout(
      networkData.nodes,
      networkData.edges,
      1200,
      600
    );

    setNodes(layoutNodes);
    setEdges(layoutEdges);
  }, [networkData, setNodes, setEdges]);

  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  if (!networkData && !isLoading && !error) {
    return (
      <WidgetEmptyState
        title="No network data"
        description="Assign users to projects to see the network graph"
        icon={<GitBranch className="h-8 w-8" />}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      {networkData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Users"
            value={networkData.metadata.totalUsers}
            icon={<Users className="h-4 w-4" />}
          />
          <StatCard
            label="Projects"
            value={networkData.metadata.totalProjects}
            icon={<FolderKanban className="h-4 w-4" />}
          />
          <StatCard
            label="Accounts"
            value={networkData.metadata.totalAccounts}
            icon={<Building2 className="h-4 w-4" />}
          />
          <StatCard
            label="Connections"
            value={networkData.metadata.totalEdges}
            icon={<GitBranch className="h-4 w-4" />}
          />
        </div>
      )}

      {/* Graph Container */}
      <div className="bg-muted/30 rounded-lg overflow-hidden" style={{ height: '500px' }}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Loading network graph...
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.3}
            maxZoom={2}
            attributionPosition="bottom-left"
          >
            <Background color="#e2e8f0" gap={20} />
            <Controls position="bottom-right" />
            <MiniMap
              position="top-right"
              nodeColor={(node) => {
                const type = (node.data as any)?.type;
                switch (type) {
                  case 'user':
                    return '#3b82f6';
                  case 'project':
                    return '#22c55e';
                  case 'account':
                    return '#f59e0b';
                  default:
                    return '#94a3b8';
                }
              }}
              maskColor="rgba(0, 0, 0, 0.1)"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}
            />

            {/* Legend Panel */}
            <Panel position="top-left" className="bg-background/90 p-3 rounded-lg shadow-md">
              <div className="text-xs space-y-2">
                <div className="font-medium mb-2">Legend</div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span>Users</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span>Projects</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500" />
                  <span>Accounts</span>
                </div>
                <div className="border-t pt-2 mt-2">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5 bg-blue-500" />
                    <span>Assigned to</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5 bg-orange-500" />
                    <span>Belongs to</span>
                  </div>
                </div>
              </div>
            </Panel>
          </ReactFlow>
        )}
      </div>

      {/* Selected Node Details */}
      {selectedNode && (
        <div className="bg-muted/30 rounded-lg p-4">
          <h4 className="text-sm font-medium mb-2">Selected: {(selectedNode.data as any)?.label}</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Type:</span>{' '}
              <span className="capitalize">{(selectedNode.data as any)?.type}</span>
            </div>
            {(selectedNode.data as any)?.hoursLogged !== undefined && (
              <div>
                <span className="text-muted-foreground">Hours Logged:</span>{' '}
                <span>{(selectedNode.data as any)?.hoursLogged}h</span>
              </div>
            )}
            {(selectedNode.data as any)?.status && (
              <div>
                <span className="text-muted-foreground">Status:</span>{' '}
                <span className="capitalize">{(selectedNode.data as any)?.status?.replace('_', ' ')}</span>
              </div>
            )}
            {(selectedNode.data as any)?.projectCount !== undefined && (
              <div>
                <span className="text-muted-foreground">Projects:</span>{' '}
                <span>{(selectedNode.data as any)?.projectCount}</span>
              </div>
            )}
            {(selectedNode.data as any)?.role && (
              <div>
                <span className="text-muted-foreground">Role:</span>{' '}
                <span>{(selectedNode.data as any)?.role}</span>
              </div>
            )}
            {(selectedNode.data as any)?.serviceTier && (
              <div>
                <span className="text-muted-foreground">Service Tier:</span>{' '}
                <span className="capitalize">{(selectedNode.data as any)?.serviceTier}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function NetworkGraphWidget() {
  return (
    <WidgetBase
      title="Organization Network"
      description="Interactive visualization of users, projects, and accounts"
      showDateRange={false}
      fullWidth
      minHeight="700px"
    >
      <ReactFlowProvider>
        <NetworkGraphContent />
      </ReactFlowProvider>
    </WidgetBase>
  );
}

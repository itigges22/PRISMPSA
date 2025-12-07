'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  type Node,
  type Edge,
  addEdge,
  type Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  type ReactFlowInstance,
  type NodeTypes,
  type EdgeTypes,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { RoleHierarchyNode } from '@/lib/role-management-service';
import { OrganizationStructure } from '@/lib/organization-service';
import { OrgChartNode } from './org-chart-node';
import { OrgChartEdge } from './org-chart-edge';
import { RoleDetailPanel } from './role-detail-panel';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { logger, componentRender, componentError, orgChartAction } from '@/lib/debug-logger';

interface OrgChartCanvasProps {
  data: OrganizationStructure | null;
  viewType: 'hierarchy' | 'department';
  onUserAssign?: (userId: string, roleId: string) => void;
  onRoleUpdate?: (roleId: string) => void;
  searchQuery?: string;
  selectedDepartment?: string;
  isReadOnly?: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

// Move nodeTypes and edgeTypes outside component to prevent recreation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: any = {
  roleNode: OrgChartNode,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const edgeTypes: any = {
  roleEdge: OrgChartEdge,
};

export function OrgChartCanvas({
  data,
  viewType,
  onUserAssign,
  onRoleUpdate,
  searchQuery = '',
  selectedDepartment,
  isReadOnly = false,
  isFullscreen = false,
  onToggleFullscreen,
}: OrgChartCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  // Create improved manual layout for proper hierarchy visualization
  const createImprovedLayout = useCallback((hierarchy: RoleHierarchyNode[]): { nodes: Node[]; edges: Edge[] } => {
    try {
      // Add null check for hierarchy
      if (!hierarchy || !Array.isArray(hierarchy)) {
        console.warn('createImprovedLayout: hierarchy is not a valid array', { hierarchy });
        return { nodes: [], edges: [] };
      }

      orgChartAction('layout_calculation_start', undefined, { 
        action: 'createImprovedLayout',
        hierarchyLength: hierarchy.length
      });

      const nodes: Node[] = [];
      const edges: Edge[] = [];
      const nodePositions = new Map<string, { x: number; y: number }>();
      const levelWidths = new Map<number, number>();
      const levelHeights = new Map<number, number>();

      // Calculate positions for each level
      const calculatePositions = (role: RoleHierarchyNode, level: number = 0, parentX?: number): void => {
        const nodeId = `role-${role.id}`;
        
        // Filter by search query
        if (searchQuery && !role.name.toLowerCase().includes(searchQuery.toLowerCase())) {
          return;
        }

        // Filter by department
        if (selectedDepartment && role.department_id !== selectedDepartment) {
          return;
        }

        // Calculate position
        const levelWidth = levelWidths.get(level) ?? 0;
        const levelHeight = levelHeights.get(level) ?? 0;
        
        // Center children under their parent
        let x = parentX ?? 0;
        if (level > 0) {
          x = parentX ?? 0;
        } else {
          x = levelWidth * 300; // Horizontal spacing between root nodes
        }
        
        const y = level * 200; // Vertical spacing between levels
        
        // Update level dimensions
        levelWidths.set(level, levelWidth + 1);
        levelHeights.set(level, Math.max(levelHeight, y));

        const node: Node = {
          id: nodeId,
        type: 'roleNode',
        position: { x, y },
        data: {
          role,
          isSelected: selectedNode?.id === nodeId,
          onSelect: () => setSelectedNode(node),
          onUserAssign: onUserAssign,
          onRoleUpdate: onRoleUpdate,
          isReadOnly,
        },
      };

      nodes.push(node);
      nodePositions.set(nodeId, { x, y });

      // Process children
      if (role.children.length > 0) {
        const childrenPerRow = Math.ceil(Math.sqrt(role.children.length));
        const childSpacing = 280; // Horizontal spacing between children
        const startX = x - ((role.children.length - 1) * childSpacing) / 2;
        
        role.children.forEach((child, index) => {
          const childX = startX + (index % childrenPerRow) * childSpacing;
          calculatePositions(child, level + 1, childX);
        });
      }
    };

    // Sort hierarchy by hierarchy level (highest first)
    const sortedHierarchy = [...hierarchy].sort((a, b) => a.hierarchy_level - b.hierarchy_level);
    
    sortedHierarchy.forEach(role => {
      calculatePositions(role);
    });

    // Create edges
    const createEdges = (role: RoleHierarchyNode, parentId?: string): void => {
      const nodeId = `role-${role.id}`;
      
      // Filter by search query
      if (searchQuery && !role.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return;
      }

      // Filter by department
      if (selectedDepartment && role.department_id !== selectedDepartment) {
        return;
      }

      if (parentId) {
        edges.push({
          id: `edge-${parentId}-${nodeId}`,
          source: parentId,
          target: nodeId,
          type: 'roleEdge',
          data: { relationship: 'reports_to' },
        });
      }

      role.children.forEach(child => {
        createEdges(child, nodeId);
      });
    };

    sortedHierarchy.forEach(role => {
      createEdges(role);
    });

      orgChartAction('layout_calculation_complete', undefined, { 
        action: 'createImprovedLayout',
        nodeCount: nodes.length,
        edgeCount: edges.length
      });

      return { nodes, edges };
    } catch (error) {
      componentError('OrgChartCanvas', error as Error, { 
        action: 'createImprovedLayout',
        function: 'createImprovedLayout'
      });
      logger.error('Error in layout calculation', { 
        action: 'createImprovedLayout' 
      }, error as Error);
      return { nodes: [], edges: [] };
    }
  }, [searchQuery, selectedDepartment, onUserAssign, onRoleUpdate, isReadOnly]);

  // Convert hierarchy data to ReactFlow nodes and edges
  const convertHierarchyToNodes = useCallback((hierarchy: RoleHierarchyNode[]): { nodes: Node[]; edges: Edge[] } => {
    // For now, return empty arrays - we'll use the async ELK layout instead
    return { nodes: [], edges: [] };
  }, []);

  // Convert department data to ReactFlow nodes and edges
  const convertDepartmentToNodes = useCallback((orgData: OrganizationStructure): { nodes: Node[]; edges: Edge[] } => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    let nodeId = 0;

    orgData.departments.forEach((department, deptIndex) => {
      // Filter by search query and selected department
      if (searchQuery && !department.name.toLowerCase().includes(searchQuery.toLowerCase())) return;
      if (selectedDepartment && department.id !== selectedDepartment) return;

      // Department node
      const deptNodeId = `dept-${nodeId++}`;
      const deptNode: Node = {
        id: deptNodeId,
        type: 'roleNode',
        position: { x: deptIndex * 400, y: 0 },
        data: {
          type: 'department',
          name: department.name,
          description: department.description,
          userCount: department.roles.reduce((sum, role) => sum + role.user_count, 0),
          isSelected: selectedNode?.id === deptNodeId,
          onSelect: () => { setSelectedNode(deptNode); },
        },
      };
      nodes.push(deptNode);

      // Role nodes for this department
      department.roles.forEach((role, roleIndex) => {
        // Filter by search query
        if (searchQuery && !role.name.toLowerCase().includes(searchQuery.toLowerCase())) return;

        const roleNodeId = `role-${nodeId++}`;
        const roleNode: Node = {
          id: roleNodeId,
          type: 'roleNode',
          position: { 
            x: deptIndex * 400 + (roleIndex % 3) * 120, 
            y: 150 + Math.floor(roleIndex / 3) * 120 
          },
          data: {
            role: {
              id: role.id,
              name: role.name,
              department_id: role.department_id,
              department_name: department.name,
              hierarchy_level: role.hierarchy_level,
              is_system_role: role.is_system_role,
              user_count: role.user_count,
              permissions: role.permissions,
              children: [],
            },
            isSelected: selectedNode?.id === roleNodeId,
            onSelect: () => { setSelectedNode(roleNode); },
            onUserAssign: onUserAssign,
            onRoleUpdate: onRoleUpdate,
            isReadOnly,
          },
        };
        nodes.push(roleNode);

        // Add edge from department to role
        edges.push({
          id: `edge-${deptNodeId}-${roleNodeId}`,
          source: deptNodeId,
          target: roleNodeId,
          type: 'roleEdge',
          data: {
            relationship: 'contains',
          },
        });
      });
    });

    return { nodes, edges };
  }, [searchQuery, selectedDepartment, onUserAssign, onRoleUpdate, isReadOnly, selectedNode]);

  // Update nodes and edges when data changes
  useEffect(() => {
    if (!data) return;

    let newNodes: Node[] = [];
    let newEdges: Edge[] = [];

    if (viewType === 'hierarchy') {
      const result = createImprovedLayout(data.hierarchy);
      newNodes = result.nodes;
      newEdges = result.edges;
    } else {
      const result = convertDepartmentToNodes(data);
      newNodes = result.nodes;
      newEdges = result.edges;
    }

    setNodes(newNodes);
    setEdges(newEdges);
  }, [data, viewType, searchQuery, selectedDepartment, createImprovedLayout, convertDepartmentToNodes]);

  // Handle node selection
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    try {
      console.log('Node clicked:', node);
      setSelectedNode(node);
    } catch (error) {
      console.error('Error handling node click:', error);
    }
  }, []);

  // Handle node drag (for user assignment)
  const onNodeDrag = useCallback((event: React.MouseEvent, node: Node, nodes: Node[]) => {
    if (isReadOnly) return;
    
    // Check if this is a user being dragged to a role
    if (node.data.type === 'user' && node.dragging) {
      // Find the target role node
      const targetNode = nodes.find(n => 
        n.type === 'roleNode' && 
        n.id !== node.id &&
        Math.abs(n.position.x - node.position.x) < 100 &&
        Math.abs(n.position.y - node.position.y) < 100
      );

      if (targetNode && onUserAssign && typeof node.data.userId === 'string') {
        const roleId = (targetNode.data as any)?.role?.id;
        if (typeof roleId === 'string') {
          onUserAssign(node.data.userId, roleId);
        }
      }
    }
  }, [isReadOnly, onUserAssign]);

  // Handle connection creation (for role hierarchy)
  const onConnect: OnConnect = useCallback((params: Connection) => {
    if (isReadOnly) return;
    
    const newEdge = {
      ...params,
      type: 'roleEdge',
      data: {
        relationship: 'reports_to',
      },
    };
    
    setEdges((eds) => addEdge(newEdge, eds));
  }, [isReadOnly]);

  // Auto-layout nodes (only on initial load)
  const onLayout = useCallback(() => {
    if (!reactFlowInstance || !data) return;

    const { fitView } = reactFlowInstance;
    // Only fit view on initial load, not on every node click
    fitView({ padding: 0.1, duration: 300 });
  }, [reactFlowInstance, data]);

  // Layout effect - only run once when nodes are first loaded
  const [hasInitialLayout, setHasInitialLayout] = useState(false);
  useEffect(() => {
    if (nodes.length > 0 && !hasInitialLayout) {
      setTimeout(() => {
        onLayout();
        setHasInitialLayout(true);
      }, 100);
    }
  }, [nodes, onLayout, hasInitialLayout]);

  // Clear selection when clicking on empty space
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-96 bg-muted/20 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading organization chart...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-[600px] w-full relative overflow-hidden bg-gray-50 dark:bg-gray-800 rounded-lg ${isFullscreen ? 'fixed inset-0 z-50 bg-background h-screen' : ''}`}>
      {/* Fullscreen Controls */}
      {onToggleFullscreen && (
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <button
            onClick={onToggleFullscreen}
            className="p-2 bg-background border rounded-md shadow-sm hover:bg-muted transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            )}
          </button>
        </div>
      )}
      
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDrag={onNodeDrag}
        onPaneClick={onPaneClick}
        onInit={setReactFlowInstance}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        attributionPosition="bottom-left"
        className="bg-background h-full w-full"
        nodesDraggable={!isReadOnly}
        nodesConnectable={!isReadOnly}
        elementsSelectable={!isReadOnly}
        panOnDrag={true}
        panOnScroll={true}
        zoomOnScroll={true}
        zoomOnPinch={true}
        selectNodesOnDrag={false}
        multiSelectionKeyCode={null}
        deleteKeyCode={null}
        minZoom={0.1}
        maxZoom={3}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        preventScrolling={false}
        style={{ width: '100%', height: '100%' }}
      >
        <Background />
        <Controls 
          showInteractive={!isReadOnly}
          showZoom={true}
          showFitView={true}
          position="bottom-left"
          className="!bottom-2 !left-2"
        />
        <MiniMap
          nodeColor={(node) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = node.data as any;
            if (data?.type === 'department') return '#3b82f6';
            if (data?.role?.is_system_role) return '#ef4444';
            return '#6b7280';
          }}
          nodeStrokeWidth={3}
          zoomable
          pannable
          position="bottom-right"
          className="!bg-background/80 !bottom-2 !right-2"
          style={{ width: 200, height: 150 }}
        />
      </ReactFlow>

      {/* Role Detail Panel */}
      {selectedNode && (
        <RoleDetailPanel
          node={selectedNode}
          onClose={() => { setSelectedNode(null); }}
          onUserAssign={onUserAssign}
          onRoleUpdate={onRoleUpdate}
          isReadOnly={isReadOnly}
        />
      )}
    </div>
  );
}

// Wrapper component with ReactFlowProvider and Error Boundary
export function OrgChartCanvasWrapper(props: OrgChartCanvasProps) {
  return (
    <ErrorBoundary component="OrgChartCanvas">
      <ReactFlowProvider>
        <OrgChartCanvas {...props} />
      </ReactFlowProvider>
    </ErrorBoundary>
  );
}

'use client';

import { useState, useMemo } from 'react';
import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath, useNodes } from '@xyflow/react';

export interface LabeledEdgeData {
  label?: string;
  conditionValue?: string;
  conditionType?: 'approval_decision' | 'sync_aggregate_decision' | 'form_value' | 'custom';
  decision?: string;
  [key: string]: unknown;
}

// Color scheme for different decision types
const getEdgeColors = (decision?: string) => {
  switch (decision) {
    case 'approved':
    case 'all_approved': // Sync node aggregate decision
      return {
        stroke: '#10B981', // Green
        strokeHover: '#059669',
        labelBg: 'bg-green-50',
        labelBorder: 'border-green-300',
        labelText: 'text-green-700',
      };
    case 'rejected':
    case 'any_rejected': // Sync node aggregate decision
      return {
        stroke: '#EF4444', // Red
        strokeHover: '#DC2626',
        labelBg: 'bg-red-50',
        labelBorder: 'border-red-300',
        labelText: 'text-red-700',
      };
    default:
      return {
        stroke: '#64748b', // Default gray
        strokeHover: '#475569',
        labelBg: 'bg-white',
        labelBorder: 'border-gray-300',
        labelText: 'text-gray-700',
      };
  }
};

export function LabeledEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected,
}: EdgeProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Cast data to our expected type
  const edgeData = data as LabeledEdgeData | undefined;
  const decision = edgeData?.decision ?? edgeData?.conditionValue;
  const colors = getEdgeColors(decision);

  // Get all nodes to check for obstacles
  const nodes = useNodes();

  // Calculate adjusted control points to avoid nodes
  const adjustedPath = useMemo(() => {
    // Start with standard bezier path
    const [standardPath, standardLabelX, standardLabelY] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      curvature: 0.25,
    });

    // Calculate the midpoint of the edge
    const midX = (sourceX + targetX) / 2;
    const midY = (sourceY + targetY) / 2;

    // Check if any nodes are near the path midpoint (obstacle detection)
    const REPULSION_DISTANCE = 120; // Distance at which nodes start repelling
    const REPULSION_STRENGTH = 80; // How much to push the curve away

    let offsetX = 0;
    let offsetY = 0;

    for (const node of nodes) {
      // Skip source and target nodes
      if (!node.measured?.width || !node.measured?.height) continue;

      const nodeWidth = node.measured.width;
      const nodeHeight = node.measured.height;
      const nodeCenterX = node.position.x + nodeWidth / 2;
      const nodeCenterY = node.position.y + nodeHeight / 2;

      // Calculate distance from edge midpoint to node center
      const dx = midX - nodeCenterX;
      const dy = midY - nodeCenterY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // If node is close enough, calculate repulsion
      if (distance < REPULSION_DISTANCE && distance > 0) {
        // Repulsion force decreases with distance
        const force = (REPULSION_DISTANCE - distance) / REPULSION_DISTANCE;
        // Normalize direction and apply force
        offsetX += (dx / distance) * force * REPULSION_STRENGTH;
        offsetY += (dy / distance) * force * REPULSION_STRENGTH;
      }
    }

    // If there's significant offset, create a custom curved path
    if (Math.abs(offsetX) > 5 || Math.abs(offsetY) > 5) {
      // Create bezier with adjusted control points
      const controlX = midX + offsetX;
      const controlY = midY + offsetY;

      // Generate custom SVG path with quadratic bezier through the offset point
      const customPath = `M ${sourceX} ${sourceY} Q ${controlX} ${controlY} ${targetX} ${targetY}`;

      return {
        path: customPath,
        labelX: controlX,
        labelY: controlY,
      };
    }

    return {
      path: standardPath,
      labelX: standardLabelX,
      labelY: standardLabelY,
    };
  }, [sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, nodes]);

  const edgePath = adjustedPath.path;
  const labelX = adjustedPath.labelX;
  const labelY = adjustedPath.labelY;

  const label = edgeData?.label ?? edgeData?.conditionValue;

  // Dynamic stroke width based on hover/selected state
  const strokeWidth = isHovered || selected ? 3 : 2;
  const strokeColor = isHovered || selected ? colors.strokeHover : colors.stroke;

  return (
    <>
      {/* Invisible wider path for easier hover detection */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={20}
        stroke="transparent"
        onMouseEnter={() => { setIsHovered(true); }}
        onMouseLeave={() => { setIsHovered(false); }}
        style={{ cursor: 'pointer' }}
      />

      {/* Glow effect on hover */}
      {(isHovered || selected) && (
        <BaseEdge
          path={edgePath}
          style={{
            ...style,
            stroke: strokeColor,
            strokeWidth: 6,
            opacity: 0.3,
          }}
        />
      )}

      {/* Main edge path */}
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: strokeColor,
          strokeWidth,
          transition: 'stroke 0.2s, stroke-width 0.2s',
        }}
      />

      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 11,
              fontWeight: 600,
              pointerEvents: 'all',
            }}
            className={`nodrag nopan px-2 py-1 rounded border shadow-sm transition-all ${colors.labelBg} ${colors.labelBorder} ${colors.labelText} ${isHovered || selected ? 'ring-2 ring-offset-1 ring-blue-400 scale-105' : ''}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {decision === 'approved' && <span className="mr-1">&#10003;</span>}
            {decision === 'rejected' && <span className="mr-1">&#10007;</span>}
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

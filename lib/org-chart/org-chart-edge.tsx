'use client';

import { memo } from 'react';
import { EdgeProps, getBezierPath, EdgeLabelRenderer, BaseEdge } from 'reactflow';
import { ArrowRight, Users } from 'lucide-react';

interface OrgChartEdgeData {
  relationship?: 'reports_to' | 'contains' | 'assigned_to';
}

function OrgChartEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  markerEnd,
}: EdgeProps<OrgChartEdgeData>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const getEdgeColor = () => {
    switch (data?.relationship) {
      case 'reports_to':
        return '#6b7280'; // Gray for reporting relationships
      case 'contains':
        return '#3b82f6'; // Blue for department contains role
      case 'assigned_to':
        return '#10b981'; // Green for user assignments
      default:
        return '#6b7280';
    }
  };

  const getEdgeStyle = () => {
    return {
      ...style,
      stroke: getEdgeColor(),
      strokeWidth: 2,
    };
  };

  const getLabelIcon = () => {
    switch (data?.relationship) {
      case 'reports_to':
        return <ArrowRight className="h-3 w-3" />;
      case 'contains':
        return <Users className="h-3 w-3" />;
      case 'assigned_to':
        return <Users className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getLabelText = () => {
    switch (data?.relationship) {
      case 'reports_to':
        return 'Reports to';
      case 'contains':
        return 'Contains';
      case 'assigned_to':
        return 'Assigned to';
      default:
        return '';
    }
  };

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={getEdgeStyle()} markerEnd={markerEnd} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            background: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 500,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            border: `1px solid ${getEdgeColor()}`,
            color: getEdgeColor(),
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          <div className="flex items-center gap-1">
            {getLabelIcon()}
            <span>{getLabelText()}</span>
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const OrgChartEdge = memo(OrgChartEdgeComponent);

'use client';

import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import {
  GitBranch,
  Users,
  UserCheck,
  Play,
  Flag,
  FileText,
  GitMerge,
  Combine,
  CheckCircle2,
  Clock,
  Circle,
  Building2,
  LucideIcon,
} from 'lucide-react';

export type VisualizationNodeType = 'start' | 'department' | 'role' | 'approval' | 'form' | 'conditional' | 'sync' | 'end' | 'client';

export interface VisualizationNodeData {
  label: string;
  type: VisualizationNodeType;
  executionStatus: 'completed' | 'active' | 'waiting' | 'pending';
  activeStepId?: string;
  branchId?: string;
  assignedUserName?: string;
  isWorkflowCompleted?: boolean;
  config?: {
    departmentName?: string;
    roleName?: string;
    approverRoleName?: string;
  };
  [key: string]: unknown;
}

const nodeStyles: Record<VisualizationNodeType, { bg: string; border: string; icon: LucideIcon }> = {
  start: {
    bg: 'bg-green-50',
    border: 'border-green-500',
    icon: Play,
  },
  department: {
    bg: 'bg-blue-50',
    border: 'border-blue-500',
    icon: GitBranch,
  },
  role: {
    bg: 'bg-purple-50',
    border: 'border-purple-500',
    icon: Users,
  },
  approval: {
    bg: 'bg-amber-50',
    border: 'border-amber-500',
    icon: UserCheck,
  },
  form: {
    bg: 'bg-cyan-50',
    border: 'border-cyan-500',
    icon: FileText,
  },
  conditional: {
    bg: 'bg-pink-50',
    border: 'border-pink-500',
    icon: GitMerge,
  },
  sync: {
    bg: 'bg-indigo-50',
    border: 'border-indigo-500',
    icon: Combine,
  },
  end: {
    bg: 'bg-gray-50',
    border: 'border-gray-500',
    icon: Flag,
  },
  client: {
    bg: 'bg-orange-50',
    border: 'border-orange-500',
    icon: Building2,
  },
};

const statusStyles = {
  completed: {
    overlay: 'ring-2 ring-green-500 ring-offset-2',
    opacity: 'opacity-90',
    badge: 'bg-green-500',
    icon: CheckCircle2,
  },
  active: {
    overlay: 'ring-2 ring-blue-500 ring-offset-2 animate-pulse',
    opacity: '',
    badge: 'bg-blue-500',
    icon: Circle,
  },
  waiting: {
    overlay: 'ring-2 ring-amber-500 ring-offset-2',
    opacity: '',
    badge: 'bg-amber-500',
    icon: Clock,
  },
  pending: {
    overlay: '',
    opacity: 'opacity-50',
    badge: 'bg-gray-400',
    icon: Circle,
  },
};

export const WorkflowVisualizationNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as VisualizationNodeData;
  const style = nodeStyles[nodeData.type] || nodeStyles.role;
  const statusStyle = statusStyles[nodeData.executionStatus];
  const Icon = style.icon;
  const StatusIcon = statusStyle.icon;

  return (
    <div
      className={`
        px-3 py-2 rounded-lg border-2 shadow-sm min-w-[140px] relative
        ${style.bg} ${style.border}
        ${statusStyle.overlay}
        ${statusStyle.opacity}
        ${selected ? 'ring-2 ring-offset-2 ring-blue-600' : ''}
        transition-all duration-200
        ${nodeData.executionStatus === 'active' ? 'cursor-pointer hover:shadow-md' : ''}
      `}
    >
      {/* Input Handle - LEFT side for horizontal flow (except for start) */}
      {nodeData.type !== 'start' && (
        <Handle
          type="target"
          position={Position.Left}
          className="w-2 h-2 !bg-gray-400 border border-white"
          isConnectable={false}
        />
      )}

      {/* Status Badge */}
      <div className={`absolute -top-2 -right-2 w-5 h-5 rounded-full ${statusStyle.badge} flex items-center justify-center`}>
        <StatusIcon className="w-3 h-3 text-white" />
      </div>

      {/* Node Content */}
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-xs truncate">{nodeData.label}</div>
          {nodeData.type !== 'start' && nodeData.type !== 'end' && (
            <div className="text-[10px] text-gray-500 capitalize">{nodeData.type}</div>
          )}
          {/* Show assigned user for completed workflows */}
          {nodeData.isWorkflowCompleted && nodeData.assignedUserName && (
            <div className="text-[9px] text-green-700 font-medium truncate mt-0.5">
              {nodeData.assignedUserName}
            </div>
          )}
        </div>
      </div>

      {/* Branch indicator for parallel workflows */}
      {nodeData.branchId && nodeData.branchId !== 'main' && (
        <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[8px] rounded-sm border border-indigo-300">
          {nodeData.branchId.split('-').slice(0, 2).join('-')}
        </div>
      )}

      {/* Sync node waiting indicator */}
      {nodeData.type === 'sync' && nodeData.executionStatus === 'waiting' && (
        <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 px-2 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-medium rounded-sm border border-amber-300 whitespace-nowrap">
          Waiting for branches...
        </div>
      )}

      {/* Sync node merge indicator */}
      {nodeData.type === 'sync' && !nodeData.branchId && nodeData.executionStatus === 'pending' && (
        <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[9px] font-medium rounded-sm border border-indigo-300 whitespace-nowrap">
          Merge Point
        </div>
      )}

      {/* Output Handle - RIGHT side for horizontal flow (except for end) */}
      {nodeData.type !== 'end' && (
        <Handle
          type="source"
          position={Position.Right}
          className="w-2 h-2 !bg-gray-400 border border-white"
          isConnectable={false}
        />
      )}
    </div>
  );
});

WorkflowVisualizationNode.displayName = 'WorkflowVisualizationNode';

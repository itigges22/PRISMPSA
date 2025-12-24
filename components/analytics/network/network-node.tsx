'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { User, FolderKanban, Building2 } from 'lucide-react';

interface NetworkNodeData {
  label: string;
  type: 'user' | 'project' | 'account';
  hoursLogged?: number;
  status?: string;
  projectCount?: number;
  serviceTier?: string;
  email?: string;
  role?: string;
}

const statusColors: Record<string, string> = {
  planning: '#94a3b8',
  in_progress: '#3b82f6',
  review: '#f59e0b',
  complete: '#22c55e',
  on_hold: '#ef4444',
  active: '#22c55e',
  inactive: '#94a3b8',
};

const typeStyles: Record<string, { bg: string; border: string; icon: React.ComponentType<{ className?: string }> }> = {
  user: {
    bg: 'bg-blue-50 dark:bg-blue-950',
    border: 'border-blue-400 dark:border-blue-600',
    icon: User,
  },
  project: {
    bg: 'bg-green-50 dark:bg-green-950',
    border: 'border-green-400 dark:border-green-600',
    icon: FolderKanban,
  },
  account: {
    bg: 'bg-orange-50 dark:bg-orange-950',
    border: 'border-orange-400 dark:border-orange-600',
    icon: Building2,
  },
};

function NetworkNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as NetworkNodeData;
  const style = typeStyles[nodeData.type] || typeStyles.user;
  const Icon = style.icon;
  const statusColor = nodeData.status ? statusColors[nodeData.status] || '#94a3b8' : undefined;

  return (
    <>
      {/* Input handle for incoming connections */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-slate-400 !w-2 !h-2"
      />

      <div
        className={`
          px-3 py-2 rounded-lg border-2 shadow-md
          transition-all duration-200
          ${style.bg} ${style.border}
          ${selected ? 'ring-2 ring-primary ring-offset-2' : ''}
          hover:shadow-lg cursor-pointer
        `}
      >
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-full ${style.bg}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium leading-tight">
              {nodeData.label}
            </span>
            {nodeData.type === 'user' && nodeData.hoursLogged !== undefined && (
              <span className="text-xs text-muted-foreground">
                {nodeData.hoursLogged}h logged
              </span>
            )}
            {nodeData.type === 'user' && nodeData.role && (
              <span className="text-xs text-muted-foreground">
                {nodeData.role}
              </span>
            )}
            {nodeData.type === 'project' && nodeData.status && (
              <div className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: statusColor }}
                />
                <span className="text-xs text-muted-foreground capitalize">
                  {nodeData.status.replace('_', ' ')}
                </span>
              </div>
            )}
            {nodeData.type === 'account' && nodeData.projectCount !== undefined && (
              <span className="text-xs text-muted-foreground">
                {nodeData.projectCount} project{nodeData.projectCount !== 1 ? 's' : ''}
              </span>
            )}
            {nodeData.type === 'account' && nodeData.serviceTier && (
              <span className="text-xs text-muted-foreground capitalize">
                {nodeData.serviceTier}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Output handle for outgoing connections */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-slate-400 !w-2 !h-2"
      />
    </>
  );
}

export const NetworkNode = memo(NetworkNodeComponent);

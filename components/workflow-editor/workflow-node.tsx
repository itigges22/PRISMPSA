'use client';

import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Users, UserCheck, Play, Flag, FileText, GitMerge, Combine, Building2, LucideIcon } from 'lucide-react';

// Note: 'department' and 'sync' kept for backwards compatibility with existing workflows
export type WorkflowNodeType = 'start' | 'department' | 'role' | 'approval' | 'form' | 'conditional' | 'sync' | 'end' | 'client';

export interface WorkflowNodeData {
  label: string;
  type: WorkflowNodeType;
  config?: {
    // Department config (legacy - no longer used for new workflows)
    departmentId?: string;
    departmentName?: string;
    // Role config
    roleId?: string;
    roleName?: string;
    approverRoleId?: string;
    approverRoleName?: string;
    requiredApprovals?: number;
    // Form node config
    formTemplateId?: string;
    formTemplateName?: string;
    allowAttachments?: boolean;
    // Inline form config (stored directly in node, not in form_templates)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    formFields?: any[];
    formName?: string;
    formDescription?: string;
    isDraftForm?: boolean;
    // Conditional node config
    conditionType?: 'approval_decision' | 'form_value' | 'custom';
    conditions?: Array<{
      label: string;
      value: string;
      color?: string;
    }>;
    // Form-value conditional: reference to source form
    sourceFormFieldId?: string;
    sourceFormNodeId?: string;
    // Approval feedback
    allowFeedback?: boolean;
    allowSendBack?: boolean;
  };
  [key: string]: unknown;
}

const nodeStyles: Record<WorkflowNodeType, { bg: string; border: string; icon: LucideIcon; description: string }> = {
  start: {
    bg: 'bg-green-50',
    border: 'border-green-500',
    icon: Play,
    description: 'Entry point: Where every workflow begins. Only one per workflow.',
  },
  department: {
    // Legacy - kept for backwards compatibility
    bg: 'bg-gray-100',
    border: 'border-gray-400',
    icon: Users,
    description: 'Legacy department node. Use Role nodes instead.',
  },
  role: {
    bg: 'bg-purple-50',
    border: 'border-purple-500',
    icon: Users,
    description: 'Assign to specific role (e.g., Video Editor, Designer). Department is auto-assigned.',
  },
  approval: {
    bg: 'bg-amber-50',
    border: 'border-amber-500',
    icon: UserCheck,
    description: 'Approval gate: Requires Approve/Reject/Needs Changes decision before proceeding.',
  },
  form: {
    bg: 'bg-cyan-50',
    border: 'border-cyan-500',
    icon: FileText,
    description: 'Collect structured data via form. User fills out fields before continuing.',
  },
  conditional: {
    bg: 'bg-pink-50',
    border: 'border-pink-500',
    icon: GitMerge,
    description: 'Smart routing: Takes ONE path based on conditions. Only one path is executed.',
  },
  sync: {
    // Legacy - kept for backwards compatibility (parallel workflows disabled)
    bg: 'bg-gray-100',
    border: 'border-gray-400',
    icon: Combine,
    description: 'Legacy sync node. Parallel workflows are disabled.',
  },
  end: {
    bg: 'bg-gray-50',
    border: 'border-gray-500',
    icon: Flag,
    description: 'Completion point: Marks workflow as done. Every workflow needs at least one.',
  },
  client: {
    bg: 'bg-orange-50',
    border: 'border-orange-500',
    icon: Building2,
    description: 'Client approval: Requires external client approval before proceeding.',
  },
};

export const WorkflowNode = memo(({ data, selected }: NodeProps) => {
  // Cast data to our expected type
  const nodeData = data as WorkflowNodeData;
  const style = nodeStyles[nodeData.type];
  const Icon = style.icon;

  return (
    <div
      className={`
        px-4 py-3 rounded-lg border-2 shadow-md min-w-[180px] relative
        ${style.bg} ${style.border}
        ${selected ? 'ring-2 ring-offset-2 ring-blue-500' : ''}
        transition-all duration-200 hover:shadow-lg
      `}
    >
      {/* Input Handle (except for start) */}
      {nodeData.type !== 'start' && (
        <Handle
          type="target"
          position={Position.Top}
          className="w-3 h-3 !bg-gray-400 border-2 border-white"
          isConnectable={true}
          style={{ zIndex: 20 }}
        />
      )}

        {/* Node Content - ensure it doesn't block handle interactions */}
        <div className="flex items-center gap-2 relative" style={{ zIndex: 1 }}>
          <Icon className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">{nodeData.label}</div>
            {nodeData.config?.departmentName && (
              <div className="text-xs text-gray-600 truncate">{nodeData.config.departmentName}</div>
            )}
            {nodeData.config?.roleName && (
              <div className="text-xs text-gray-600 truncate">{nodeData.config.roleName}</div>
            )}
            {nodeData.config?.approverRoleName && (
              <div className="text-xs text-gray-600 truncate">
                Approver: {nodeData.config.approverRoleName}
              </div>
            )}
            {nodeData.config?.formTemplateName && (
              <div className="text-xs text-gray-600 truncate">Form: {nodeData.config.formTemplateName}</div>
            )}
            {nodeData.config?.conditionType && (
              <div className="text-xs text-gray-600 truncate">
                {nodeData.config.conditionType === 'approval_decision' && 'Routes by approval'}
                {nodeData.config.conditionType === 'form_value' && 'Routes by form value'}
                {nodeData.config.conditionType === 'custom' && 'Custom routing'}
              </div>
            )}
          </div>
        </div>

      {/* Output Handle (except for end) */}
      {nodeData.type !== 'end' && nodeData.type !== 'conditional' && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="w-3 h-3 !bg-gray-400 border-2 border-white"
          isConnectable={true}
          style={{ zIndex: 20 }}
        />
      )}

      {/* Conditional nodes get dynamic output handles based on configured branches */}
      {nodeData.type === 'conditional' && nodeData.config?.conditions && nodeData.config.conditions.length > 0 ? (
        // Show custom branches with labeled handles
        // IMPORTANT: Handles must be direct children - no wrapper divs!
        // Using larger handles (w-4 h-4) for better drag detection
        nodeData.config.conditions.map((condition: { id?: string; value?: string; label: string; color?: string }, index: number) => {
          const total = nodeData.config!.conditions!.length;
          const leftPercent = total === 1 ? 50 : (index + 1) * (100 / (total + 1));
          const handleId = condition.id || condition.value || `condition-${index}`;
          return (
            <Handle
              key={handleId}
              type="source"
              position={Position.Bottom}
              id={handleId}
              className="!w-4 !h-4 border-2 border-white rounded-full"
              isConnectable={true}
              style={{
                left: `${leftPercent}%`,
                transform: 'translateX(-50%)',
                bottom: '-8px',
                backgroundColor: condition.color || '#3B82F6',
                zIndex: 100,
                cursor: 'crosshair',
                pointerEvents: 'all',
              }}
              title={`${condition.label} - Drag to connect`}
            />
          );
        })
      ) : nodeData.type === 'conditional' ? (
        // No branches configured yet - show default source handle so connections can still be made
        <Handle
          type="source"
          position={Position.Bottom}
          id="default"
          className="!w-4 !h-4 !bg-pink-400 border-2 border-white rounded-full"
          isConnectable={true}
          style={{ zIndex: 100, cursor: 'crosshair', bottom: '-8px', pointerEvents: 'all' }}
          title="Configure branches first, then connect"
        />
      ) : null}

      {/* Branch labels rendered separately (below handles) */}
      {nodeData.type === 'conditional' && nodeData.config?.conditions && nodeData.config.conditions.length > 0 && (
        <div className="absolute bottom-[-28px] left-0 right-0 pointer-events-none">
          {nodeData.config.conditions.map((condition: { id?: string; value?: string; label: string; color?: string }, index: number) => {
            const total = nodeData.config!.conditions!.length;
            const leftPercent = total === 1 ? 50 : (index + 1) * (100 / (total + 1));
            return (
              <span
                key={`label-${condition.id || condition.value || index}`}
                className="absolute text-[8px] font-semibold whitespace-nowrap overflow-hidden max-w-[60px] text-ellipsis"
                style={{
                  left: `${leftPercent}%`,
                  transform: 'translateX(-50%)',
                  color: condition.color || '#3B82F6'
                }}
                title={condition.label}
              >
                {condition.label.length > 10 ? condition.label.substring(0, 10) + '...' : condition.label}
              </span>
            );
          })}
        </div>
      )}

      {/* "Configure branches" hint for unconfigured conditional nodes */}
      {nodeData.type === 'conditional' && (!nodeData.config?.conditions || nodeData.config.conditions.length === 0) && (
        <div className="absolute bottom-[-20px] left-1/2 transform -translate-x-1/2 pointer-events-none">
          <span className="text-[9px] text-gray-400 whitespace-nowrap">Configure branches</span>
        </div>
      )}
    </div>
  );
});

WorkflowNode.displayName = 'WorkflowNode';

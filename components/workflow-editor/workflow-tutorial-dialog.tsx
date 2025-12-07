'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Users, UserCheck, Play, Flag, FileText, GitMerge } from 'lucide-react';

interface WorkflowTutorialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const nodeTypes = [
  {
    name: 'Start',
    icon: Play,
    description: 'Entry point: Where every workflow begins. Only one per workflow.',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-500',
  },
  {
    name: 'Role',
    icon: Users,
    description: 'Assign to specific role (e.g., Video Editor, Designer). Requires selecting a team member.',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-500',
  },
  {
    name: 'Approval',
    icon: UserCheck,
    description: 'Approval gate: Requires Approve/Reject/Needs Changes decision before proceeding.',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-500',
  },
  {
    name: 'Form',
    icon: FileText,
    description: 'Collect structured data via form. User fills out fields before continuing.',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-500',
  },
  {
    name: 'Conditional',
    icon: GitMerge,
    description: 'Smart routing: Takes ONE path based on conditions (form responses, approval decisions). Only one path is executed.',
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-500',
  },
  {
    name: 'End',
    icon: Flag,
    description: 'Completion point: Marks workflow as done. Every workflow needs at least one.',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-500',
  },
];

export function WorkflowTutorialDialog({ open, onOpenChange }: WorkflowTutorialDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Workflow Builder Tutorial</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Node Types Section */}
          <div>
            <h3 className="font-semibold text-sm text-gray-800 mb-3">Available Workflow Nodes</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {nodeTypes.map((nodeType) => {
                const Icon = nodeType.icon;
                return (
                  <div
                    key={nodeType.name}
                    className={`p-3 rounded-lg border-2 ${nodeType.bgColor} ${nodeType.borderColor}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-4 h-4" />
                      <span className="font-medium text-sm">{nodeType.name}</span>
                    </div>
                    <p className="text-xs text-gray-700">{nodeType.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Getting Started */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-sm text-blue-900 mb-3">Getting Started</h3>
            <ol className="text-sm text-blue-800 space-y-2">
              <li>1. Drag a <strong>Start</strong> node onto the canvas</li>
              <li>2. Add <strong>Role</strong> or <strong>Approval</strong> nodes for workflow steps</li>
              <li>3. Connect nodes by dragging from one node&apos;s handle to another</li>
              <li>4. Double-click each node to configure it (select roles, departments, etc.)</li>
              <li>5. Add an <strong>End</strong> node to mark workflow completion</li>
              <li>6. Click <strong>Save Workflow</strong> when done</li>
            </ol>
          </div>

          {/* Common Patterns */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <h3 className="font-semibold text-sm text-amber-900 mb-3">Common Workflow Patterns</h3>
            <ul className="text-sm text-amber-800 space-y-2">
              <li>
                <strong>Review Loop:</strong> Role → Approval → Conditional
                <br />
                <span className="text-xs">(If rejected, route back to Role for revisions)</span>
              </li>
              <li>
                <strong>Sequential Steps:</strong> Role → Role → Role → End
                <br />
                <span className="text-xs">(Linear progression through multiple team members)</span>
              </li>
              <li>
                <strong>Quality Gate:</strong> Role → Approval → End
                <br />
                <span className="text-xs">(Simple approval before completion)</span>
              </li>
            </ul>
          </div>

          {/* Best Practices */}
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="font-semibold text-sm text-green-900 mb-3">Best Practices</h3>
            <ul className="text-sm text-green-800 space-y-2">
              <li>✓ Every workflow needs both Start and End nodes</li>
              <li>✓ All nodes must be connected to the workflow</li>
              <li>✓ Configure each node after adding it (double-click to configure)</li>
              <li>✓ Use Conditional nodes after Approval for smart routing</li>
              <li>✗ Avoid circular loops - they create infinite cycles</li>
              <li>✗ Don&apos;t leave nodes unconfigured - the system will prevent saving</li>
            </ul>
          </div>

          {/* Example Workflow */}
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <h3 className="font-semibold text-sm text-purple-900 mb-3">Example: Video Production Workflow</h3>
            <div className="text-sm text-purple-800 space-y-2">
              <p className="font-medium">Typical video project workflow:</p>
              <ol className="ml-4 space-y-1">
                <li>1. <strong>Start</strong></li>
                <li>2. <strong>Pre-Production</strong> (Role: Creative Director)</li>
                <li>3. <strong>Budget Approval</strong> (Approval: Project Manager)</li>
                <li>4. <strong>Production</strong> (Role: Video Producer)</li>
                <li>5. <strong>Post-Production</strong> (Role: Video Editor)</li>
                <li>6. <strong>Creative Review</strong> (Approval: Creative Director)</li>
                <li>7. <strong>Revision Decision</strong> (Conditional: if approved → delivery, if changes → back to post)</li>
                <li>8. <strong>Final Delivery</strong> (Role: Project Manager)</li>
                <li>9. <strong>End</strong></li>
              </ol>
            </div>
          </div>

          {/* Keyboard Shortcuts */}
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h3 className="font-semibold text-sm text-gray-900 mb-3">Keyboard Shortcuts & Tips</h3>
            <ul className="text-sm text-gray-700 space-y-1">
              <li><strong>Double-click node:</strong> Open configuration dialog</li>
              <li><strong>Click + drag:</strong> Move nodes around the canvas</li>
              <li><strong>Click node:</strong> Select it (then click Delete Selected to remove)</li>
              <li><strong>Drag from handle:</strong> Create connections between nodes</li>
              <li><strong>Hover on ? icon:</strong> See node description</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

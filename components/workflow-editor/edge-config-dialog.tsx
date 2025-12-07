'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LabeledEdgeData } from './labeled-edge';

interface EdgeConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceNodeType: string;
  conditionType?: 'approval_decision' | 'sync_aggregate_decision' | 'form_value' | 'custom';
  initialData?: LabeledEdgeData;
  onSave: (data: LabeledEdgeData) => void;
}

export function EdgeConfigDialog({
  open,
  onOpenChange,
  sourceNodeType,
  conditionType,
  initialData,
  onSave,
}: EdgeConfigDialogProps) {
  const [label, setLabel] = useState('');
  const [conditionValue, setConditionValue] = useState('');

  useEffect(() => {
    if (initialData) {
      setLabel(initialData.label ?? '');
      setConditionValue(initialData.conditionValue ?? '');
    } else {
      setLabel('');
      setConditionValue('');
    }
  }, [initialData, open]);

  const handleSave = () => {
    const data: LabeledEdgeData = {
      label: label || conditionValue,
      conditionValue,
      conditionType,
      // Also store decision for workflow execution service compatibility
      decision: (conditionType === 'approval_decision' || conditionType === 'sync_aggregate_decision')
        ? conditionValue
        : undefined,
    };
    onSave(data);
    onOpenChange(false);
  };

  const getConditionOptions = () => {
    if (conditionType === 'approval_decision') {
      return [
        { value: 'approved', label: 'Approved' },
        { value: 'rejected', label: 'Rejected' },
      ];
    }
    if (conditionType === 'sync_aggregate_decision') {
      return [
        { value: 'all_approved', label: 'All Approved' },
        { value: 'any_rejected', label: 'Any Rejected' },
      ];
    }
    return [];
  };

  const conditionOptions = getConditionOptions();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Configure Decision Path</DialogTitle>
          <DialogDescription>
            {sourceNodeType === 'sync'
              ? 'Define when this path should be taken from the sync node. Sync nodes can route based on the aggregate decision from parallel branches (all approved or any rejected).'
              : 'Define when this path should be taken from the approval node. Approval nodes can route to different paths based on the decision (approved or rejected).'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {(conditionType === 'approval_decision' || conditionType === 'sync_aggregate_decision') && conditionOptions.length > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="condition-value">Condition *</Label>
              <Select value={conditionValue} onValueChange={setConditionValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Select condition" />
                </SelectTrigger>
                <SelectContent>
                  {conditionOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                {conditionType === 'sync_aggregate_decision'
                  ? `This path will be taken when the parallel branch aggregate decision is "${conditionValue === 'all_approved' ? 'All Approved' : conditionValue === 'any_rejected' ? 'Any Rejected' : conditionValue}"`
                  : `This path will be taken when the approval decision is "${conditionValue}"`}
              </p>
            </div>
          ) : conditionType === 'form_value' ? (
            <div className="space-y-2">
              <Label htmlFor="condition-value">Condition Expression *</Label>
              <Input
                id="condition-value"
                value={conditionValue}
                onChange={(e) => { setConditionValue(e.target.value); }}
                placeholder="e.g., priority == 'High'"
              />
              <p className="text-xs text-gray-500">
                Enter a condition expression based on form field values
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="condition-value">Custom Condition *</Label>
              <Input
                id="condition-value"
                value={conditionValue}
                onChange={(e) => setConditionValue(e.target.value)}
                placeholder="Enter condition description"
              />
              <p className="text-xs text-gray-500">
                Describe when this path should be taken
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="label">Label (optional)</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => { setLabel(e.target.value); }}
              placeholder={conditionValue || 'Enter label for connection'}
            />
            <p className="text-xs text-gray-500">
              Custom label to display on the connection. If empty, the condition value will be used.
            </p>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-800">
              <strong>Important:</strong> The workflow engine will evaluate this condition at runtime to determine which path to follow.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setLabel('');
              setConditionValue('');
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!conditionValue}>
            Save Path
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

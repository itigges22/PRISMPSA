'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { RoleWithUsers } from './role-hierarchy-dnd';

interface ReportingRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: RoleWithUsers | null;
  allRoles: RoleWithUsers[];
  onSave: (roleId: string, reportingRoleId: string | null) => void;
}

export function ReportingRoleDialog({
  open,
  onOpenChange,
  role,
  allRoles,
  onSave
}: ReportingRoleDialogProps) {
  const [selectedReportingRoleId, setSelectedReportingRoleId] = useState<string>('none');

  useEffect(() => {
    if (role) {
      console.log('🔄 ReportingRoleDialog: Role changed:', {
        roleId: role.id,
        roleName: role.name,
        reportingRoleId: role.reporting_role_id,
        reportingRoleName: role.reporting_role?.name
      });
      setSelectedReportingRoleId(role.reporting_role_id || 'none');
    }
  }, [role]);

  const handleSave = async () => {
    if (!role) return;

    const reportingRoleId = selectedReportingRoleId === 'none' ? null : selectedReportingRoleId;
    
    try {
      await onSave(role.id, reportingRoleId);
      onOpenChange(false);
      toast.success(`Updated reporting relationship for ${role.name}`);
    } catch (error) {
      console.error('Error updating reporting role:', error);
      toast.error('Failed to update reporting relationship');
    }
  };

  // Filter out the current role and roles that would create circular references
  const availableRoles = allRoles.filter(r => {
    if (r.id === role?.id) return false; // Can't report to self
    
    // Check for circular reference: if current role reports to this role,
    // then this role can't report to current role
    if (role?.reporting_role_id === r.id) return false;
    
    return true;
  });

  console.log('🔄 ReportingRoleDialog: Available roles:', availableRoles.map(r => r.name));
  console.log('🔄 ReportingRoleDialog: Selected reporting role ID:', selectedReportingRoleId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set Reporting Role</DialogTitle>
          <DialogDescription>
            Choose which role <strong>{role?.name}</strong> should report to.
            This will determine the hierarchy level automatically.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Reports to:</label>
            <Select value={selectedReportingRoleId} onValueChange={setSelectedReportingRoleId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a role..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No reporting role (Top level)</SelectItem>
                {availableRoles
                  .filter((r) => r && r.id && r.id !== '')
                  .map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name} (Level {r.hierarchy_level})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          
          {selectedReportingRoleId && selectedReportingRoleId !== 'none' && (
            <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
              <strong>Result:</strong> {role?.name} will be at hierarchy level{' '}
              {(allRoles.find(r => r.id === selectedReportingRoleId)?.hierarchy_level || 0) - 1}
            </div>
          )}
          
          {selectedReportingRoleId === 'none' && (
            <div className="text-sm text-gray-600 bg-green-50 p-3 rounded-lg">
              <strong>Result:</strong> {role?.name} will be at the top level of the hierarchy
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

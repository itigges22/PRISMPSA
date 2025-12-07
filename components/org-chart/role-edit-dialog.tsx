'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Edit, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { PermissionEditor } from './permission-editor';
import { Permission, getAllPermissions } from '@/lib/permissions';
import { roleManagementService, UpdateRoleData, RoleWithDetails } from '@/lib/role-management-service';
import { organizationService } from '@/lib/organization-service';

interface Department {
  id: string;
  name: string;
}


interface RoleEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: RoleWithDetails | null;
  onSuccess: () => void;
  departments?: Department[];
  children?: React.ReactNode;
  isEditMode?: boolean; // NEW: Indicates if parent is in Edit Mode
  onLocalUpdate?: (roleId: string, updates: Partial<RoleWithDetails>) => void; // NEW: For local updates in Edit Mode
}

export function RoleEditDialog({ 
  open,
  onOpenChange,
  role,
  onSuccess,
  departments: externalDepartments,
  children,
  isEditMode = false,
  onLocalUpdate
}: RoleEditDialogProps) {
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>(externalDepartments ?? []);
  const [formData, setFormData] = useState({
    name: role?.name || '',
    description: role?.description || '',
  });
  const [permissions, setPermissions] = useState<Record<Permission, boolean>>(() => {
    const initialPermissions = {} as Record<Permission, boolean>;
    getAllPermissions().forEach(permission => {
      // Add null check for role.permissions
      initialPermissions[permission] = (role?.permissions?.[permission]) || false;
    });
    return initialPermissions;
  });

  // Load departments when provided externally
  useEffect(() => {
    if (externalDepartments) {
      setDepartments(externalDepartments);
    }
  }, [externalDepartments]);


  // Reset form when role changes
  useEffect(() => {
    if (role) {
      setFormData({
        name: role.name,
        description: role.description || '',
      });
      const newPermissions = {} as Record<Permission, boolean>;
      getAllPermissions().forEach(permission => {
        newPermissions[permission] = role.permissions?.[permission] || false;
      });
      setPermissions(newPermissions);
    }
  }, [role]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!role) {
      console.error('❌ No role selected for editing');
      return;
    }

    console.log('🔄 Submitting role edit:', { roleId: role.id, formData, permissions });

    const updateData: Partial<RoleWithDetails> = {
      name: formData.name,
      description: formData.description || undefined,
      permissions,
    };

    // If in Edit Mode, just queue the changes locally
    if (isEditMode && onLocalUpdate) {
      console.log('🎯 Edit Mode: Queueing role edit locally', { roleId: role.id, updateData });
      onLocalUpdate(role.id, updateData);
      toast.success('Changes queued. Click "Save Changes" to apply.', {
        description: `"${role.name}" will be updated when you save.`
      });
      onOpenChange(false);
      return;
    }

    // Otherwise, save immediately to the database
    setLoading(true);
    try {
      console.log('💾 Saving role to database:', { roleId: role.id, updateData });
      const updatedRole = await roleManagementService.updateRole(role.id, updateData as UpdateRoleData);
      
      if (updatedRole) {
        console.log('✅ Role updated successfully:', updatedRole);
        toast.success('Role updated successfully!');
        onSuccess();
        onOpenChange(false);
      } else {
        console.error('❌ Failed to update role - no data returned');
        toast.error('Failed to update role. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error updating role:', error);
      toast.error(`An error occurred while updating the role: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePermissionsChange = (newPermissions: Record<Permission, boolean>) => {
    setPermissions(newPermissions);
  };

  const handleSavePermissions = async (newPermissions: Record<Permission, boolean>) => {
    setPermissions(newPermissions);
    return true; // For edit dialog, we just update local state
  };

  if (!role) {
    return null;
  }


  const isSystemRole = role.is_system_role || false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Edit Role
            {isSystemRole && (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            )}
          </DialogTitle>
          <DialogDescription>
            {isSystemRole 
              ? 'This is a system role. Some properties cannot be modified.'
              : 'Update role details, permissions, and reporting structure.'
            }
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Role Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => { handleInputChange('name', e.target.value); }}
                placeholder="Enter role name"
                required
                disabled={isSystemRole}
              />
              {isSystemRole && (
                <p className="text-xs text-muted-foreground">
                  System role names cannot be changed
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={role.department?.name || 'Unknown Department'}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Department cannot be changed after role creation
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => { handleInputChange('description', e.target.value); }}
              placeholder="Enter role description"
              rows={3}
            />
          </div>


          <div className="space-y-4">
            <Label className="text-base font-medium">Permissions</Label>
            <PermissionEditor
              roleId={role.id}
              roleName={formData.name}
              currentPermissions={permissions}
              onPermissionsChange={handlePermissionsChange}
              onSave={handleSavePermissions}
              isSystemRole={isSystemRole}
              disabled={loading || isSystemRole}
              hideSaveButton={true}
            />
          </div>

          {isSystemRole && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex items-center gap-2 text-blue-800">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">System Role</span>
              </div>
              <p className="text-sm text-blue-700 mt-1">
                This is a system role with full permissions. System roles cannot be modified or deleted.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => { onOpenChange(false); }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !formData.name || isSystemRole}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Role'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

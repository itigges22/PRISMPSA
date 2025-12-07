'use client';
import { toast } from 'sonner';

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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { PermissionEditor } from './permission-editor';
import { Permission, getAllPermissions } from '@/lib/permissions';
import { CreateRoleData } from '@/lib/role-management-service';
import { validateRole } from '@/lib/validation';
import { logger, componentRender, componentError } from '@/lib/debug-logger';

interface Department {
  id: string;
  name: string;
}

interface RoleCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  departments?: Department[];
  children?: React.ReactNode;
}

export function RoleCreationDialog({ 
  open,
  onOpenChange,
  onSuccess,
  departments: externalDepartments,
  children
}: RoleCreationDialogProps) {
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    department_id: '',
  });
  const [permissions, setPermissions] = useState<Record<Permission, boolean>>(() => {
    const initialPermissions = {} as Record<Permission, boolean>;
    getAllPermissions().forEach(permission => {
      initialPermissions[permission] = false;
    });
    return initialPermissions;
  });

  // Load departments when dialog opens
  useEffect(() => {
    if (externalDepartments) {
      setDepartments(externalDepartments);
    }
  }, [externalDepartments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      componentRender('RoleCreationDialog', { action: 'handleSubmit' });

      const roleData: CreateRoleData = {
        name: formData.name,
        description: formData.description || undefined,
        department_id: formData.department_id,
        permissions,
      };

      // Validate the role data
      const validation = validateRole(roleData);
      if (!validation.isValid) {
        logger.error('Role validation failed', { 
          action: 'handleSubmit',
          errors: validation.errors,
          warnings: validation.warnings
        });
        toast.error(`Validation failed: ${validation.errors.join(', ')}`);
        setLoading(false);
        return;
      }

      logger.info('Creating role', { 
        action: 'handleSubmit',
        name: roleData.name,
        departmentId: roleData.department_id
      });

      const response = await fetch('/api/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(roleData),
      });

      if (response.ok) {
        const { role } = await response.json();
        logger.info('Role created successfully', { 
          action: 'handleSubmit',
          roleId: role.id,
          name: role.name
        });
        onSuccess();
        onOpenChange(false);
        resetForm();
      } else {
        const errorData = await response.json();
        componentError('RoleCreationDialog', new Error(errorData.error), { 
          action: 'handleSubmit',
          status: response.status
        });
        logger.error('Role creation failed', { 
          action: 'handleSubmit',
          status: response.status,
          error: errorData.error
        });
        toast.error(`Failed to create role: ${errorData.error || 'Please try again.'}`);
      }
    } catch (error) {
      componentError('RoleCreationDialog', error as Error, { 
        action: 'handleSubmit'
      });
      logger.error('Exception in role creation', { 
        action: 'handleSubmit' 
      }, error as Error);
      toast.error('An error occurred while creating the role.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      department_id: '',
    });
    const resetPermissions = {} as Record<Permission, boolean>;
    getAllPermissions().forEach(permission => {
      resetPermissions[permission] = false;
    });
    setPermissions(resetPermissions);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePermissionsChange = (newPermissions: Record<Permission, boolean>) => {
    setPermissions(newPermissions);
  };

  const handleSavePermissions = async (newPermissions: Record<Permission, boolean>) => {
    setPermissions(newPermissions);
    return true; // For creation dialog, we just update local state
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Role</DialogTitle>
          <DialogDescription>
            Create a new role with specific permissions.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Role Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter role name"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="department">Department *</Label>
              <Select
                value={formData.department_id}
                onValueChange={(value) => handleInputChange('department_id', value)}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments
                    .filter((dept) => dept && dept.id && dept.id !== '')
                    .map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Enter role description"
              rows={3}
            />
          </div>

          <div className="space-y-4">
            <Label className="text-base font-medium">Permissions</Label>
            <PermissionEditor
              roleId=""
              roleName={formData.name || 'New Role'}
              currentPermissions={permissions}
              onPermissionsChange={handlePermissionsChange}
              onSave={handleSavePermissions}
              disabled={loading}
              hideSaveButton={true}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !formData.name || !formData.department_id}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Role'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusIcon, EditIcon } from 'lucide-react';
import { createClientSupabase } from '@/lib/supabase';

interface Role {
  id: string;
  name: string;
  description: string | null;
  department_id: string;
  permissions: any;
  created_at: string;
  updated_at: string;
}

interface DepartmentRoleDialogProps {
  children?: React.ReactNode;
  onRoleCreated?: (role: Role) => void;
  onRoleUpdated?: (role: Role) => void;
  departmentId: string;
  existingRole?: Role | null;
  mode?: 'create' | 'edit';
}

export default function DepartmentRoleDialog({ 
  children, 
  onRoleCreated,
  onRoleUpdated,
  departmentId,
  existingRole = null,
  mode = 'create'
}: DepartmentRoleDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    permissions: {
      canViewProjects: true,
      canCreateProjects: false,
      canEditProjects: false,
      canDeleteProjects: false,
      canAssignTasks: false,
      canViewAnalytics: false,
      canManageTeam: false,
    }
  });

  // Reset form when dialog opens or mode changes
  useEffect(() => {
    if (open) {
      if (mode === 'edit' && existingRole) {
        const existingPermissions = existingRole.permissions || {};
        setFormData({
          name: existingRole.name,
          permissions: {
            canViewProjects: existingPermissions.canViewProjects ?? true,
            canCreateProjects: existingPermissions.canCreateProjects ?? false,
            canEditProjects: existingPermissions.canEditProjects ?? false,
            canDeleteProjects: existingPermissions.canDeleteProjects ?? false,
            canAssignTasks: existingPermissions.canAssignTasks ?? false,
            canViewAnalytics: existingPermissions.canViewAnalytics ?? false,
            canManageTeam: existingPermissions.canManageTeam ?? false,
          }
        });
      } else {
        setFormData({
          name: '',
          permissions: {
            canViewProjects: true,
            canCreateProjects: false,
            canEditProjects: false,
            canDeleteProjects: false,
            canAssignTasks: false,
            canViewAnalytics: false,
            canManageTeam: false,
          }
        });
      }
    }
  }, [open, mode, existingRole]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClientSupabase();
      if (!supabase) {
        throw new Error('Failed to create Supabase client');
      }

      // Check current user and their permissions
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log('Current user:', user?.id, userError);
      
      if (userError) {
        console.error('Error getting user:', userError);
        toast.error('Authentication error. Please log in again.');
        return;
      }

      if (mode === 'create') {
        const insertData = {
          name: formData.name,
          department_id: departmentId,
          permissions: formData.permissions,
        };
        
        console.log('Creating role with data:', insertData);
        
        const { data, error } = await supabase
          .from('roles')
          .insert(insertData)
          .select()
          .single();

        if (error) {
          console.error('Error creating role:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
            fullError: error
          });
          toast.error(`Failed to create role: ${error.message || 'Unknown error'}`);
          return;
        }

        onRoleCreated?.(data);
      } else if (mode === 'edit' && existingRole) {
        const updateData = {
          name: formData.name,
          permissions: formData.permissions,
        };
        
        console.log('Updating role with data:', updateData);
        console.log('Role ID:', existingRole.id);
        
        const { data, error } = await supabase
          .from('roles')
          .update(updateData)
          .eq('id', existingRole.id)
          .select()
          .single();

        if (error) {
          console.error('Error updating role:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
            fullError: error
          });
          toast.error(`Failed to update role: ${error.message || 'Unknown error'}`);
          return;
        }

        onRoleUpdated?.(data);
      }

      setOpen(false);
    } catch (error) {
      console.error('Error in handleSubmit:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      toast.error(`An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    if (field.startsWith('permissions.')) {
      const permissionKey = field.replace('permissions.', '');
      setFormData(prev => ({
        ...prev,
        permissions: {
          ...prev.permissions,
          [permissionKey]: value
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button>
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Role
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Create New Role' : 'Edit Role'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create' 
              ? 'Add a new role to this department with specific permissions.'
              : 'Update the role details and permissions.'
            }
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
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

          </div>

          <div className="space-y-4">
            <Label className="text-base font-medium">Permissions</Label>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="canViewProjects"
                  checked={formData.permissions.canViewProjects}
                  onChange={(e) => handleInputChange('permissions.canViewProjects', e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="canViewProjects" className="text-sm font-normal">
                  View Projects
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="canCreateProjects"
                  checked={formData.permissions.canCreateProjects}
                  onChange={(e) => handleInputChange('permissions.canCreateProjects', e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="canCreateProjects" className="text-sm font-normal">
                  Create Projects
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="canEditProjects"
                  checked={formData.permissions.canEditProjects}
                  onChange={(e) => handleInputChange('permissions.canEditProjects', e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="canEditProjects" className="text-sm font-normal">
                  Edit Projects
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="canDeleteProjects"
                  checked={formData.permissions.canDeleteProjects}
                  onChange={(e) => handleInputChange('permissions.canDeleteProjects', e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="canDeleteProjects" className="text-sm font-normal">
                  Delete Projects
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="canAssignTasks"
                  checked={formData.permissions.canAssignTasks}
                  onChange={(e) => handleInputChange('permissions.canAssignTasks', e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="canAssignTasks" className="text-sm font-normal">
                  Assign Tasks
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="canViewAnalytics"
                  checked={formData.permissions.canViewAnalytics}
                  onChange={(e) => handleInputChange('permissions.canViewAnalytics', e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="canViewAnalytics" className="text-sm font-normal">
                  View Analytics
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="canManageTeam"
                  checked={formData.permissions.canManageTeam}
                  onChange={(e) => handleInputChange('permissions.canManageTeam', e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="canManageTeam" className="text-sm font-normal">
                  Manage Team
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.name}>
              {loading 
                ? (mode === 'create' ? 'Creating...' : 'Updating...') 
                : (mode === 'create' ? 'Create Role' : 'Update Role')
              }
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

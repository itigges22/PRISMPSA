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
import { PlusIcon } from 'lucide-react';
import { createClientSupabase } from '@/lib/supabase';
import { useAuth } from '@/lib/hooks/useAuth';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';

interface DepartmentCreateDialogProps {
  children?: React.ReactNode;
  onDepartmentCreated?: (department: any) => void;
}

export default function DepartmentCreateDialog({ 
  children, 
  onDepartmentCreated
}: DepartmentCreateDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { userProfile } = useAuth();
  const [canCreateDepartment, setCanCreateDepartment] = useState(false);

  // Check permissions
  useEffect(() => {
    if (!userProfile) return;
    
    async function checkPermissions() {
      const canCreate = await hasPermission(userProfile, Permission.CREATE_DEPARTMENT);
      setCanCreateDepartment(canCreate);
    }
    
    checkPermissions();
  }, [userProfile]);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canCreateDepartment) {
      alert('You do not have permission to create departments.');
      return;
    }
    
    setLoading(true);

    try {
      const supabase = createClientSupabase();
      if (!supabase) {
        throw new Error('Failed to create Supabase client');
      }

      const { data, error } = await supabase
        .from('departments')
        .insert({
          name: formData.name,
          description: formData.description || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating department:', error);
        alert('Failed to create department. Please try again.');
        return;
      }

      onDepartmentCreated?.(data);
      setOpen(false);
      setFormData({ name: '', description: '' });
    } catch (error) {
      console.error('Error creating department:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button>
            <PlusIcon className="h-4 w-4 mr-2" />
            Create Department
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Department</DialogTitle>
          <DialogDescription>
            Add a new department to your organization. This will create a new department that can be managed separately.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Department Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Enter department name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Enter department description"
              rows={3}
            />
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
              {loading ? 'Creating...' : 'Create Department'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
'use client';

import { useState, useEffect } from 'react';
import { addDays } from 'date-fns';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlusIcon } from 'lucide-react';
import { createClientSupabase } from '@/lib/supabase';
import { useAuth } from '@/lib/hooks/useAuth';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';

interface ProjectCreationDialogProps {
  children?: React.ReactNode;
  onProjectCreated?: (project: any) => void;
  departmentId?: string;
  accountId?: string;
  initialStartDate?: Date;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface Account {
  id: string;
  name: string;
}

export default function ProjectCreationDialog({ 
  children, 
  onProjectCreated,
  departmentId,
  accountId: propAccountId,
  initialStartDate,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange
}: ProjectCreationDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const { userProfile } = useAuth();
  const [canCreateProject, setCanCreateProject] = useState(false);

  // Check permissions
  useEffect(() => {
    if (!userProfile || !propAccountId) return;
    
    async function checkPermissions() {
      const canCreate = await hasPermission(userProfile, Permission.CREATE_PROJECT, { accountId: propAccountId });
      setCanCreateProject(canCreate);
    }
    
    checkPermissions();
  }, [userProfile, propAccountId]);

  // Form state - initialize with props if provided
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    accountId: propAccountId || '',
    startDate: initialStartDate 
      ? initialStartDate.toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    endDate: initialStartDate
      ? addDays(initialStartDate, 30).toISOString().split('T')[0]
      : addDays(new Date(), 30).toISOString().split('T')[0],
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    status: 'planning' as 'planning' | 'in_progress' | 'review' | 'complete' | 'on_hold',
    estimatedHours: '',
  });

  // Update form data when props change
  useEffect(() => {
    if (propAccountId) {
      setFormData(prev => ({ ...prev, accountId: propAccountId }));
    }
  }, [propAccountId]);

  useEffect(() => {
    if (initialStartDate) {
      setFormData(prev => ({
        ...prev,
        startDate: initialStartDate.toISOString().split('T')[0],
        endDate: addDays(initialStartDate, 30).toISOString().split('T')[0],
      }));
    }
  }, [initialStartDate]);

  // Load accounts when dialog opens
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const supabase = createClientSupabase();
        if (!supabase) return;

        const { data, error } = await supabase
          .from('accounts')
          .select('id, name')
          .order('name');

        if (error) {
          console.error('Error loading accounts:', error);
        } else {
          setAccounts(data || []);
        }
      } catch (error) {
        console.error('Error loading accounts:', error);
      }
    };

    if (open) {
      loadAccounts();
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.accountId) {
      alert('Please select an account for this project.');
      return;
    }

    if (!formData.estimatedHours || parseInt(formData.estimatedHours) <= 0) {
      alert('Please enter estimated hours for this project.');
      return;
    }

    // Check permission for the selected account
    if (userProfile && formData.accountId) {
      const canCreate = await hasPermission(userProfile, Permission.CREATE_PROJECT, { accountId: formData.accountId });
      if (!canCreate) {
        alert('You do not have permission to create projects for this account.');
        return;
      }
    }
    
    setLoading(true);

    try {
      const supabase = createClientSupabase();
      if (!supabase) {
        throw new Error('Failed to create Supabase client');
      }

      // Get current user
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('You must be logged in to create a project.');
        setLoading(false);
        return;
      }

      // Create the project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: formData.name,
          description: formData.description || null,
          account_id: formData.accountId,
          status: formData.status,
          priority: formData.priority,
          start_date: formData.startDate,
          end_date: formData.endDate,
          estimated_hours: formData.estimatedHours ? parseInt(formData.estimatedHours) : null,
          actual_hours: 0,
          created_by: session.user.id,
        })
        .select()
        .single();

      if (projectError) {
        console.error('Error creating project:', projectError);
        alert('Failed to create project. Please try again.');
        return;
      }

      // Department membership is now automatically derived from user assignments
      // No manual department linking needed

      onProjectCreated?.(project);
      setOpen(false);
      setFormData({
        name: '',
        description: '',
        accountId: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: addDays(new Date(), 30).toISOString().split('T')[0],
        priority: 'medium',
        status: 'planning',
        estimatedHours: '',
      });
    } catch (error) {
      console.error('Error creating project:', error);
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
            Add Project
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Add a new project to your organization. This will create a project that can be assigned to departments and team members.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter project name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => handleInputChange('priority', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
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
              placeholder="Enter project description"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="account">Account *</Label>
            <Select
              value={formData.accountId}
              onValueChange={(value) => handleInputChange('accountId', value)}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an account" />
              </SelectTrigger>
              <SelectContent>
                {accounts
                  .filter((account) => account && account.id && account.id !== '')
                  .map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date *</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => handleInputChange('startDate', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date *</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => handleInputChange('endDate', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleInputChange('status', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="complete">Complete</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="estimatedHours">Estimated Hours *</Label>
              <Input
                id="estimatedHours"
                type="number"
                value={formData.estimatedHours}
                onChange={(e) => handleInputChange('estimatedHours', e.target.value)}
                placeholder="Enter estimated hours"
                min="1"
                required
              />
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
            <Button type="submit" disabled={loading || !formData.name || !formData.accountId}>
              {loading ? 'Creating...' : 'Create Project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Task } from '@/lib/task-service-db';
import { useAuth } from '@/lib/hooks/useAuth';
import { createClientSupabase } from '@/lib/supabase';


interface TaskCreateEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  task?: Task | null; // If provided, edit mode; otherwise, create mode
  onTaskSaved: () => void;
}

export default function TaskCreateEditDialog({
  open,
  onOpenChange,
  projectId,
  task,
  onTaskSaved,
}: TaskCreateEditDialogProps) {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<Array<{ id: string; name: string; roles: string[] }>>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [project, setProject] = useState<{ start_date: string | null; end_date: string | null } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'backlog' as 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'blocked',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    start_date: '',
    due_date: '',
    estimated_hours: '',
    assigned_to: 'unassigned', // Use 'unassigned' instead of empty string to avoid Select component error
  });

  const isEditMode = !!task;

  // Task permissions are now inherited from project access - if user can view the project page, they can manage tasks
  // Load only users who are members of the account or assigned to the project
  const loadUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      const supabase = createClientSupabase() as any;

      if (!supabase) {
        console.error('Failed to create Supabase client');
        setUsers([]);
        return;
      }

      // First, get the project to find its account_id
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('id, account_id')
        .eq('id', projectId)
        .single();

      if (projectError || !projectData) {
        console.error('Error loading project:', projectError);
        setUsers([]);
        return;
      }

      const uniqueUsersMap = new Map<string, { id: string; name: string; roles: string[] }>();

      // 1. Get users who are members of the account
      if (projectData.account_id) {
        const { data: accountMembers, error: accountError } = await supabase
          .from('account_members')
          .select(`
            user_id,
            user_profiles!account_members_user_id_fkey (
              id,
              name,
              email
            )
          `)
          .eq('account_id', projectData.account_id);

        if (accountError) {
          console.error('Error loading account members:', accountError);
        }

        if (accountMembers) {
          for (const member of accountMembers) {
            const userProfile = member.user_profiles as Record<string, unknown> | undefined;
            if (userProfile && (userProfile as any).id) {
              const userId = (userProfile as any).id as string;
              if (!uniqueUsersMap.has(userId)) {
                uniqueUsersMap.set(userId, {
                  id: userId,
                  name: ((userProfile as any).name as string | undefined) || 'Unknown',
                  roles: []
                });
              }
            }
          }
        }
      }

      // 2. Get users assigned to this project
      const { data: projectMembers, error: assignmentError } = await supabase
        .from('project_assignments')
        .select(`
          user_id,
          user_profiles!project_assignments_user_id_fkey (
            id,
            name,
            email
          )
        `)
        .eq('project_id', projectId)
        .is('removed_at', null);

      if (assignmentError) {
        console.error('Error loading project assignments:', assignmentError);
      }

      if (projectMembers) {
        for (const member of projectMembers) {
          const userProfile = member.user_profiles as Record<string, unknown> | undefined;
          if (userProfile && (userProfile as any).id) {
            const userId = (userProfile as any).id as string;
            if (!uniqueUsersMap.has(userId)) {
              uniqueUsersMap.set(userId, {
                id: userId,
                name: ((userProfile as any).name as string | undefined) || 'Unknown',
                roles: []
              });
            }
          }
        }
      }

      // 3. Get roles for all users we found
      const userIds = Array.from(uniqueUsersMap.keys());
      if (userIds.length > 0) {
        const { data: userRolesData, error: rolesError } = await supabase
          .from('user_roles')
          .select(`
            user_id,
            roles!user_roles_role_id_fkey (
              id,
              name
            )
          `)
          .in('user_id', userIds);

        if (!rolesError && userRolesData) {
          for (const ur of userRolesData) {
            const userId = ur.user_id as string;
            const role = ur.roles as Record<string, unknown> | undefined;
            const roleName = (role?.name as string | undefined) || 'No Role';

            const existingUser = uniqueUsersMap.get(userId);
            if (existingUser && !existingUser.roles.includes(roleName)) {
              existingUser.roles.push(roleName);
            }
          }
        }
      }

      // Set default role for users without any
      uniqueUsersMap.forEach((user) => {
        if (user.roles.length === 0) {
          user.roles = ['Team Member'];
        }
      });

      const usersWithRoles = Array.from(uniqueUsersMap.values());
      console.log(`Task assignment: ${usersWithRoles.length} account/project members available`);
      setUsers(usersWithRoles);
    } catch (error: unknown) {
      console.error('Error loading users:', error);
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, [projectId]);

  const loadProject = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      if (!response.ok) throw new Error('Failed to load project');
      const data = await response.json();
      setProject({
        start_date: data.project?.start_date || null,
        end_date: data.project?.end_date || null,
      });
    } catch (error: unknown) {
      console.error('Error loading project:', error);
      setProject(null);
    }
  }, [projectId]);

  useEffect(() => {
    if (open && userProfile) {
      loadUsers();
      loadProject();
    }
  }, [open, userProfile, projectId, loadUsers, loadProject]);

  // Populate form when task changes (edit mode)
  useEffect(() => {
    if (task) {
      setFormData({
        name: task.name || '',
        description: task.description || '',
        status: task.status,
        priority: task.priority,
        start_date: task.start_date ? new Date(task.start_date).toISOString().split('T')[0] : '',
        due_date: task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '',
        estimated_hours: task.estimated_hours?.toString() || '',
        assigned_to: task.assigned_to || 'unassigned',
      });
    } else {
      // Reset form for create mode
      setFormData({
        name: '',
        description: '',
        status: 'backlog',
        priority: 'medium',
        start_date: '',
        due_date: '',
        estimated_hours: '',
        assigned_to: 'unassigned',
      });
    }
  }, [task, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Task name is required');
      return;
    }

    if (!(userProfile as any)?.id) {
      toast.error('You must be logged in to create/edit tasks');
      return;
    }

    // Validate date constraints
    if (formData.start_date && formData.due_date) {
      const startDate = new Date(formData.start_date);
      const dueDate = new Date(formData.due_date);

      if (startDate > dueDate) {
        toast.error('Start date cannot be after due date');
        return;
      }
    }

    // Validate task dates are within project dates
    if (project) {
      if (formData.start_date && project.start_date) {
        const taskStart = new Date(formData.start_date);
        const projectStart = new Date(project.start_date);

        if (taskStart < projectStart) {
          const formattedProjectStart = new Date(project.start_date).toLocaleDateString();
          toast.error(`Task start date cannot be before project start date (${formattedProjectStart})`);
          return;
        }
      }

      if (formData.due_date && project.end_date) {
        const taskDue = new Date(formData.due_date);
        const projectEnd = new Date(project.end_date);

        if (taskDue > projectEnd) {
          const formattedProjectEnd = new Date(project.end_date).toLocaleDateString();
          toast.error(`Task due date cannot be after project end date (${formattedProjectEnd})`);
          return;
        }
      }
    }

    // Task permissions are now inherited from project access
    // The API will validate project access before allowing task operations
    setLoading(true);

    try {
      if (isEditMode && task) {
        // Update existing task via API
        const updateData = {
          name: formData.name,
          description: formData.description || null,
          status: formData.status,
          priority: formData.priority,
          start_date: formData.start_date || null,
          due_date: formData.due_date || null,
          estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
          assigned_to: formData.assigned_to && formData.assigned_to !== 'unassigned' ? formData.assigned_to : null,
        };

        const response = await fetch(`/api/tasks/${task.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData)
        });

        const result = await response.json();

        if (response.ok && result.success) {
          onTaskSaved();
          onOpenChange(false);
        } else {
          toast.error(result.error || 'Failed to update task');
        }
      } else {
        // Create new task via API
        const createData = {
          name: formData.name,
          description: formData.description || null,
          project_id: projectId,
          status: formData.status,
          priority: formData.priority,
          start_date: formData.start_date || null,
          due_date: formData.due_date || null,
          estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
          assigned_to: formData.assigned_to && formData.assigned_to !== 'unassigned' ? formData.assigned_to : null,
        };

        const response = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createData)
        });

        const result = await response.json();

        if (response.ok && result.success) {
          console.log('Task created successfully:', result.task);
          onTaskSaved();
          onOpenChange(false);
        } else {
          console.error('Task creation returned null');
          toast.error('Failed to create task. Please check the console for details.');
        }
      }
    } catch (error: unknown) {
      const err = error as Record<string, unknown> | undefined;
      console.error('Error saving task:', {
        error,
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        code: err?.code
      });
      toast.error(`An error occurred while saving the task: ${String(err?.message) || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Task' : 'Create New Task'}</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Update task information' : 'Add a new task to this project'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Task Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Task Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter task name"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter task description"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: string) => setFormData(prev => ({ ...prev, status: value as 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'blocked' }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="backlog">Backlog</SelectItem>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value: string) => setFormData(prev => ({ ...prev, priority: value as 'low' | 'medium' | 'high' | 'urgent' }))}
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

          <div className="grid grid-cols-2 gap-4">
            {/* Start Date */}
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
              />
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
              />
            </div>
          </div>

          {/* Estimated Hours */}
          <div className="space-y-2">
            <Label htmlFor="estimated_hours">Estimated Hours</Label>
            <Input
              id="estimated_hours"
              type="number"
              min="0"
              step="0.5"
              value={formData.estimated_hours}
              onChange={(e) => setFormData(prev => ({ ...prev, estimated_hours: e.target.value }))}
              placeholder="0"
            />
          </div>

          {/* Assigned To - Task assignment permissions are inherited from project access */}
          <div className="space-y-2">
            <Label htmlFor="assigned_to">Assign To</Label>
              <Select
                value={formData.assigned_to}
                onValueChange={(value) => setFormData(prev => ({ ...prev, assigned_to: value }))}
                disabled={loadingUsers}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingUsers ? "Loading users..." : "Select a user (optional)"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users && users.length > 0 && users
                    .filter((user:any) => user && (user as any).id && typeof (user as any).id === 'string' && (user as any).id.trim() !== '')
                    .map((user:any) => (
                      <SelectItem key={(user as any).id} value={(user as any).id}>
                        {user.roles.join(', ')} - {(user as any).name || 'Unknown'}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            <p className="text-xs text-muted-foreground">
              Assigned users will get access to this project and its account
            </p>
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
            <Button type="submit" disabled={loading || !formData.name.trim()}>
              {loading ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Task' : 'Create Task')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


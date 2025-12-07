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
import { toast } from 'sonner';
import { accountService } from '@/lib/account-service';
import { createClientSupabase } from '@/lib/supabase';
import { useAuth } from '@/lib/hooks/useAuth';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';

interface TaskCreationDialogProps {
  children?: React.ReactNode;
  onTaskCreated?: (task: any, assignedUser?: any) => void;
  accountId?: string;
  account?: any; // Full account object with contact and manager info
  userProfile?: any;
  initialStartDate?: Date;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  editMode?: boolean;
  existingProject?: any;
  // statusOptions prop removed - status is managed by workflows
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string | null;
}

export default function TaskCreationDialog({
  children,
  onTaskCreated,
  accountId,
  account,
  userProfile,
  initialStartDate,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  editMode = false,
  existingProject
}: TaskCreationDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const auth = useAuth();
  const effectiveUserProfile = userProfile || auth.userProfile;
  const [canCreateProject, setCanCreateProject] = useState(false);
  const [canEditProject, setCanEditProject] = useState(false);
  
  // Use controlled open state if provided, otherwise use internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;

  // Check permissions
  useEffect(() => {
    if (!effectiveUserProfile || !accountId) return;
    
    async function checkPermissions() {
      if (editMode && existingProject) {
        // Edit mode - check EDIT_PROJECT permission
        const canEdit = await hasPermission(effectiveUserProfile, Permission.EDIT_PROJECT, { projectId: existingProject.id, accountId });
        setCanEditProject(canEdit);
      } else {
        // Create mode - check CREATE_PROJECT permission
        const canCreate = await hasPermission(effectiveUserProfile, Permission.CREATE_PROJECT, { accountId });
        setCanCreateProject(canCreate);
      }
    }
    
    checkPermissions();
  }, [effectiveUserProfile, accountId, editMode, existingProject]);

  // Form state - Status is managed by workflows, not included in form
  const [formData, setFormData] = useState({
    name: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent' | 'idea',
    start_date: initialStartDate ? initialStartDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    end_date: initialStartDate ? addDays(initialStartDate, 7).toISOString().split('T')[0] : addDays(new Date(), 7).toISOString().split('T')[0],
    estimated_hours: '',
    workflowTemplateId: '',
  });

  // Multi-select states - removed stakeholders (workflow handles assignment)
  // Department selection removed - departments are now derived from user assignments

  // Data states
  const [users, setUsers] = useState<any[]>([]);
  const [userRoles, setUserRoles] = useState<Map<string, string[]>>(new Map()); // userId -> role names
  const [userRoleIds, setUserRoleIds] = useState<Map<string, string>>(new Map()); // userId -> primary role ID
  const [workflows, setWorkflows] = useState<WorkflowTemplate[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Update dates when initialStartDate prop changes
  useEffect(() => {
    if (initialStartDate) {
      setFormData(prev => ({
        ...prev,
        start_date: initialStartDate.toISOString().split('T')[0],
        end_date: addDays(initialStartDate, 7).toISOString().split('T')[0],
      }));
    }
  }, [initialStartDate]);

  // Load data when dialog opens
  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, accountId, account]);

  // Populate form data when in edit mode - Status is managed by workflows, not included
  useEffect(() => {
    if (open && editMode && existingProject) {
      console.log('=== EDIT MODE: Populating form with existing project ===');
      console.log('Full existing project data:', existingProject);

      setFormData({
        name: existingProject.name || '',
        priority: existingProject.priority || 'medium',
        start_date: existingProject.start_date ? new Date(existingProject.start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        end_date: existingProject.end_date ? new Date(existingProject.end_date).toISOString().split('T')[0] : addDays(new Date(), 7).toISOString().split('T')[0],
        estimated_hours: existingProject.estimated_hours ? String(existingProject.estimated_hours) : '',
        workflowTemplateId: existingProject.workflow_template_id || '',
      });

      // Assignment and stakeholders removed - workflow handles assignment

      console.log('=== END EDIT MODE POPULATION ===');
    }
  }, [open, editMode, existingProject]);

  const loadData = async () => {
    setLoadingData(true);
    try {
      const supabase = createClientSupabase();
      
      // Load all users
      const allUsersData = await accountService.getAllUsers();
      console.log('Loaded all users:', allUsersData);

      // Departments no longer needed - derived from user assignments

      // Load user roles for all users
      const { data: userRolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          role_id,
          roles:role_id (
            id,
            name,
            departments:department_id (
              name
            )
          )
        `);

      if (rolesError) {
        console.error('Error loading user roles:', rolesError);
        setUsers(allUsersData || []);
      } else {
        console.log('Loaded user roles data:', userRolesData);
        // Create a map of userId -> array of role names
        const rolesMap = new Map<string, string[]>();
        const roleIdsMap = new Map<string, string>();
        userRolesData?.forEach((ur: any) => {
          const userId = ur.user_id;
          const roleId = ur.role_id;
          const roleName = ur.roles?.name || 'Team Member';
          const deptName = ur.roles?.departments?.name;

          // Format: "Role Name (Department)" or just "Role Name" if no department
          const displayRole = deptName ? `${roleName} (${deptName})` : roleName;

          if (!rolesMap.has(userId)) {
            rolesMap.set(userId, []);
          }
          rolesMap.get(userId)?.push(displayRole);

          // Store the first (primary) role ID for each user
          if (!roleIdsMap.has(userId)) {
            roleIdsMap.set(userId, roleId);
          }
        });
        setUserRoles(rolesMap);
        setUserRoleIds(roleIdsMap);

        // Filter users to only include those with at least one role
        const usersWithRoles = (allUsersData || []).filter((user: any) => rolesMap.has(user.id));
        console.log(`Filtered users: ${usersWithRoles.length} users with roles out of ${allUsersData?.length || 0} total users`);
        setUsers(usersWithRoles);
      }

      // Load workflows
      const { data: workflowsData, error: workflowsError } = await supabase
        .from('workflow_templates')
        .select('id, name, description')
        .eq('is_active', true)
        .order('name');

      if (workflowsError) {
        console.error('Error loading workflows:', workflowsError);
      } else {
        setWorkflows(workflowsData || []);
      }

      // Stakeholder auto-selection removed - workflow handles assignment

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('=== FORM SUBMIT STARTED ===');
    console.log('Form data:', formData);
    console.log('Edit mode:', editMode);
    console.log('Existing project ID:', existingProject?.id);
    
    // Check permissions
    if (editMode && existingProject) {
      if (!canEditProject) {
        toast.error('You do not have permission to edit this project.');
        return;
      }
    } else {
      if (!canCreateProject) {
        toast.error('You do not have permission to create projects for this account.');
        return;
      }
    }
    
    // Validation
    if (!formData.name.trim()) {
      toast.error('Project name is required');
      return;
    }
    // assigned_user_id is auto-set to session.user.id for new projects
    // Department validation removed - departments are now derived from user assignments

    // Date validation
    if (formData.start_date && formData.end_date) {
      const startDate = new Date(formData.start_date);
      const endDate = new Date(formData.end_date);

      if (startDate > endDate) {
        toast.error('Start date cannot be after end date');
        return;
      }
    }

    // Estimated hours validation - required for new projects
    if (!editMode && (!formData.estimated_hours || parseInt(formData.estimated_hours) <= 0)) {
      toast.error('Please enter estimated hours for this project.');
      return;
    }

    setLoading(true);

    try {
      const supabase = createClientSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('You must be logged in to create or edit a project.');
        return;
      }

      let project: any;

      if (editMode && existingProject) {
        // UPDATE MODE - Status is managed by workflows, not editable here
        const { data: updatedProject, error: projectError } = await supabase
          .from('projects')
          .update({
            name: formData.name,
            // Status is managed by workflows - don't update it here
            priority: formData.priority,
            start_date: formData.start_date,
            end_date: formData.end_date,
            estimated_hours: formData.estimated_hours ? parseInt(formData.estimated_hours) : null,
            updated_at: new Date().toISOString(),
            // assigned_user_id not updated here - workflow handles assignment changes
          })
          .eq('id', existingProject.id)
          .select()
          .single();

        if (projectError) {
          console.error('Error updating project:', projectError);
          toast.error('Failed to update project: ' + projectError.message);
          return;
        }

        project = updatedProject;

        // Assignment and stakeholder handling removed - workflow manages these through handoffs
      } else {
        // CREATE MODE - New projects always start as 'planning', workflow manages status
        const { data: newProject, error: projectError} = await supabase
          .from('projects')
          .insert({
            name: formData.name,
            account_id: accountId,
            status: 'planning', // Always start as planning - workflow manages status changes
            priority: formData.priority,
            start_date: formData.start_date,
            end_date: formData.end_date,
            assigned_user_id: session.user.id, // Auto-assign to creator - workflow will update as needed
            created_by: session.user.id,
            actual_hours: 0,
            estimated_hours: formData.estimated_hours ? parseInt(formData.estimated_hours) : null,
          })
          .select()
          .single();

        if (projectError) {
          console.error('Error creating project:', projectError);
          toast.error('Failed to create project: ' + projectError.message);
          return;
        }

        project = newProject;

        // Assignment and stakeholder handling removed - creator auto-assigned, workflow manages the rest

        // Start workflow if one was selected
        console.log('[WORKFLOW] Checking if workflow should be started...');
        console.log('[WORKFLOW] formData.workflowTemplateId:', formData.workflowTemplateId);
        console.log('[WORKFLOW] project:', project);

        if (formData.workflowTemplateId && project) {
          console.log('[WORKFLOW] Starting workflow for project:', project.id);
          console.log('[WORKFLOW] Workflow template ID:', formData.workflowTemplateId);

          try {
            const workflowResponse = await fetch('/api/workflows/start', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                projectId: project.id,
                workflowTemplateId: formData.workflowTemplateId,
              }),
            });

            console.log('[WORKFLOW] Response status:', workflowResponse.status);
            console.log('[WORKFLOW] Response OK:', workflowResponse.ok);

            const workflowData = await workflowResponse.json();
            console.log('[WORKFLOW] Response data:', workflowData);

            if (!workflowResponse.ok) {
              console.error('[WORKFLOW] Failed to start workflow:', workflowData);
              toast.error(`Project created, but workflow failed to start: ${workflowData.error || 'Unknown error'}`);
            } else {
              console.log('[WORKFLOW] Workflow started successfully!');
            }
          } catch (error) {
            console.error('[WORKFLOW] Error starting workflow:', error);
            toast.error(`Project created, but workflow failed to start: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        } else {
          console.log('[WORKFLOW] Skipping workflow start - no workflow selected or project missing');
        }
      }

      // Success!
      console.log('[SUCCESS] Project operation completed successfully');

      // Close dialog and notify parent
      setOpen(false);
      if (!editMode) {
        resetForm();
      }
      onTaskCreated?.(project);

    } catch (error) {
      console.error('Error with project:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      priority: 'medium',
      start_date: new Date().toISOString().split('T')[0],
      end_date: addDays(new Date(), 7).toISOString().split('T')[0],
      estimated_hours: '',
      workflowTemplateId: '',
    });
    // Assignment and stakeholder selection removed - workflow handles these
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!editMode && children && (
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editMode ? 'Edit Project' : 'Create New Project'}</DialogTitle>
          <DialogDescription>
            {editMode 
              ? 'Update project information. All fields are required.'
              : `Add a new project to ${account?.name || 'this account'}. All fields are required.`
            }
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Project Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Enter project name"
              required
            />
          </div>

          {/* Assignment removed - project auto-assigns to creator, workflow manages handoffs */}

          {/* Priority */}
          <div className="space-y-2">
            <Label htmlFor="priority">
              Priority <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.priority}
              onValueChange={(value) => handleInputChange('priority', value)}
              required
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="idea">Idea</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Project status is managed by workflows
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Start Date */}
            <div className="space-y-2">
              <Label htmlFor="start_date">
                Start Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => handleInputChange('start_date', e.target.value)}
                required
              />
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label htmlFor="end_date">
                End Date / Deadline <span className="text-destructive">*</span>
              </Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => handleInputChange('end_date', e.target.value)}
                required
              />
            </div>
          </div>

          {/* Estimated Hours */}
          <div className="space-y-2">
            <Label htmlFor="estimated_hours">
              Estimated Hours {!editMode && <span className="text-red-500">*</span>}
            </Label>
            <Input
              id="estimated_hours"
              type="number"
              value={formData.estimated_hours}
              onChange={(e) => handleInputChange('estimated_hours', e.target.value)}
              placeholder="Enter total estimated hours"
              min="0"
              step="0.5"
              required={!editMode}
            />
            <p className="text-xs text-muted-foreground">
              Total hours estimated for this project
            </p>
          </div>

          {/* Workflow (Optional) */}
          {!editMode && (
            <div className="space-y-2">
              <Label htmlFor="workflow">Workflow (Optional)</Label>
              <Select
                value={formData.workflowTemplateId}
                onValueChange={(value) => handleInputChange('workflowTemplateId', value === 'none' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a workflow" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Workflow</SelectItem>
                  {workflows.map((workflow) => (
                    <SelectItem key={workflow.id} value={workflow.id}>
                      {workflow.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.workflowTemplateId && formData.workflowTemplateId !== 'none' && workflows.find(w => w.id === formData.workflowTemplateId)?.description && (
                <p className="text-xs text-gray-500">
                  {workflows.find(w => w.id === formData.workflowTemplateId)?.description}
                </p>
              )}
            </div>
          )}

          {/* Department (Multi-select) */}
          {/* Department selection removed - departments are now derived from user assignments */}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !formData.name}
            >
              {loading ? (editMode ? 'Updating...' : 'Creating...') : (editMode ? 'Update Project' : 'Create Project')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

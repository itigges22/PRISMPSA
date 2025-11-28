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
import { PlusIcon, X } from 'lucide-react';
import { accountService } from '@/lib/account-service';
import { createClientSupabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/hooks/useAuth';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';

interface TaskCreationDialogProps {
  children?: React.ReactNode;
  onTaskCreated?: (task: any, assignedUser?: any) => void;
  accountId?: string;
  account?: any; // Full account object with contact and manager info
  defaultStatus?: string;
  userProfile?: any;
  statusOptions?: Array<{ value: string; label: string; color: string; originalValue?: string }>;
  initialStartDate?: Date;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  editMode?: boolean;
  existingProject?: any;
}

export default function TaskCreationDialog({ 
  children, 
  onTaskCreated,
  accountId,
  account,
  defaultStatus = 'planning',
  userProfile,
  statusOptions,
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

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    assigned_user_id: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent' | 'idea',
    status: defaultStatus,
    start_date: initialStartDate ? initialStartDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    end_date: initialStartDate ? addDays(initialStartDate, 7).toISOString().split('T')[0] : addDays(new Date(), 7).toISOString().split('T')[0],
    estimated_hours: '',
  });

  // Multi-select states
  const [selectedStakeholders, setSelectedStakeholders] = useState<string[]>([]);
  // Department selection removed - departments are now derived from user assignments

  // Data states
  const [users, setUsers] = useState<any[]>([]);
  const [userRoles, setUserRoles] = useState<Map<string, string[]>>(new Map()); // userId -> role names
  const [userRoleIds, setUserRoleIds] = useState<Map<string, string>>(new Map()); // userId -> primary role ID
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

  // Populate form data when in edit mode
  useEffect(() => {
    if (open && editMode && existingProject) {
      console.log('=== EDIT MODE: Populating form with existing project ===');
      console.log('Full existing project data:', existingProject);
      console.log('Existing stakeholders:', existingProject.stakeholders);
      console.log('Stakeholders is array?', Array.isArray(existingProject.stakeholders));
      console.log('Stakeholders length:', existingProject.stakeholders?.length);
      
      setFormData({
        name: existingProject.name || '',
        assigned_user_id: existingProject.assigned_user_id || '',
        priority: existingProject.priority || 'medium',
        status: existingProject.status || defaultStatus,
        start_date: existingProject.start_date ? new Date(existingProject.start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        end_date: existingProject.end_date ? new Date(existingProject.end_date).toISOString().split('T')[0] : addDays(new Date(), 7).toISOString().split('T')[0],
        estimated_hours: existingProject.estimated_hours ? String(existingProject.estimated_hours) : '',
      });

      // Set stakeholders
      if (existingProject.stakeholders && Array.isArray(existingProject.stakeholders)) {
        console.log('Setting stakeholders from existing project:', existingProject.stakeholders);
        const stakeholderIds = existingProject.stakeholders.map((s: any) => {
          console.log('Mapping stakeholder:', s, 'user_id:', s.user_id);
          return s.user_id;
        });
        console.log('Extracted stakeholder IDs:', stakeholderIds);
        setSelectedStakeholders(stakeholderIds);
        console.log('selectedStakeholders state should now be:', stakeholderIds);
      } else {
        console.log('No stakeholders found in existing project - setting to empty array');
        console.log('existingProject.stakeholders value:', existingProject.stakeholders);
        setSelectedStakeholders([]);
      }

      // Departments removed - no longer manually assigned

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

      // Auto-select stakeholders ONLY in create mode (not edit mode)
      // In edit mode, stakeholders are set by the separate useEffect
      if (!editMode) {
        const autoStakeholders: string[] = [];
        if (account?.account_manager_id) {
          autoStakeholders.push(account.account_manager_id);
        }
        setSelectedStakeholders(autoStakeholders);
      }

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
    console.log('Selected stakeholders at submit:', selectedStakeholders);
    console.log('Selected stakeholders length:', selectedStakeholders.length);
    console.log('Edit mode:', editMode);
    console.log('Existing project ID:', existingProject?.id);
    
    // Check permissions
    if (editMode && existingProject) {
      if (!canEditProject) {
        alert('You do not have permission to edit this project.');
        return;
      }
    } else {
      if (!canCreateProject) {
        alert('You do not have permission to create projects for this account.');
        return;
      }
    }
    
    // Validation
    if (!formData.name.trim()) {
      alert('Project name is required');
      return;
    }
    if (!formData.assigned_user_id) {
      alert('Please assign the project to someone');
      return;
    }
    // Department validation removed - departments are now derived from user assignments

    // Date validation
    if (formData.start_date && formData.end_date) {
      const startDate = new Date(formData.start_date);
      const endDate = new Date(formData.end_date);

      if (startDate > endDate) {
        alert('Start date cannot be after end date');
        return;
      }
    }

    setLoading(true);

    try {
      const supabase = createClientSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        alert('You must be logged in to create or edit a project.');
        return;
      }

      let project: any;

      if (editMode && existingProject) {
        // UPDATE MODE
        const { data: updatedProject, error: projectError } = await supabase
          .from('projects')
          .update({
            name: formData.name,
            status: statusOptions?.find(s => s.value === formData.status)?.originalValue || formData.status,
            priority: formData.priority,
            start_date: formData.start_date,
            end_date: formData.end_date,
            assigned_user_id: formData.assigned_user_id === 'none' ? null : formData.assigned_user_id,
            estimated_hours: formData.estimated_hours ? parseInt(formData.estimated_hours) : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingProject.id)
          .select()
          .single();

        if (projectError) {
          console.error('Error updating project:', projectError);
          alert('Failed to update project: ' + projectError.message);
          return;
        }

        project = updatedProject;

        // Create/update project assignment for the assigned user
        if (formData.assigned_user_id && formData.assigned_user_id !== 'none') {
          // Check if assignment already exists
          const { data: existingAssignment } = await supabase
            .from('project_assignments')
            .select('id')
            .eq('project_id', project.id)
            .eq('user_id', formData.assigned_user_id)
            .is('removed_at', null)
            .single();

          if (!existingAssignment) {
            // Create new assignment with user's role
            const roleId = userRoleIds.get(formData.assigned_user_id);
            const roleName = userRoles.get(formData.assigned_user_id)?.[0]?.split(' (')[0] || 'Team Member';

            await supabase
              .from('project_assignments')
              .insert({
                project_id: project.id,
                user_id: formData.assigned_user_id,
                role_in_project: roleName,
                assigned_by: session.user.id,
                assigned_at: new Date().toISOString(),
              });
          }
        }

        // Update stakeholders - delete old, insert new
        console.log('[UPDATE MODE] Starting stakeholder update for project:', project.id);
        console.log('[UPDATE MODE] Selected stakeholders:', selectedStakeholders);
        console.log('[UPDATE MODE] Account manager ID:', account?.account_manager_id);
        console.log('[UPDATE MODE] Current user (session):', session.user.id, session.user.email);
        
        // FIRST: Check what stakeholders exist BEFORE delete
        const { data: beforeData } = await supabase
          .from('project_stakeholders')
          .select('*')
          .eq('project_id', project.id);
        console.log('[VERIFY] BEFORE DELETE: Stakeholders in database:', beforeData);
        
        // Delete existing stakeholders
        console.log('[DELETE] Attempting to DELETE stakeholders...');
        const { data: deleteData, error: deleteError } = await supabase
          .from('project_stakeholders')
          .delete()
          .eq('project_id', project.id)
          .select();
        
        if (deleteError) {
          console.error('[ERROR] DELETE ERROR:', deleteError);
          alert(`Failed to delete old stakeholders: ${deleteError.message}\n\nDetails: ${JSON.stringify(deleteError, null, 2)}`);
          throw new Error(`Failed to delete stakeholders: ${deleteError.message}`);
        } else {
          console.log('[SUCCESS] DELETE SUCCESS: Deleted', deleteData?.length || 0, 'stakeholders');
          console.log('[SUCCESS] Deleted rows:', deleteData);
        }
        
        // VERIFY deletion worked
        const { data: afterDeleteData } = await supabase
          .from('project_stakeholders')
          .select('*')
          .eq('project_id', project.id);
        console.log('[VERIFY] AFTER DELETE: Stakeholders remaining:', afterDeleteData);

        if (selectedStakeholders.length > 0) {
          console.log('[INSERT] Creating stakeholder links for', selectedStakeholders.length, 'users');
          const stakeholderLinks = selectedStakeholders.map(userId => {
            let role = 'team_member';
            if (userId === account?.account_manager_id) {
              role = 'account_manager';
              console.log('[INSERT]   User', userId, 'is account manager');
            } else {
              const userRolesList = userRoles.get(userId);
              if (userRolesList && userRolesList.length > 0) {
                role = userRolesList[0].split(' (')[0].toLowerCase().replace(/\s+/g, '_');
                console.log('[INSERT]   User', userId, 'has role:', role, '(from', userRolesList[0] + ')');
              } else {
                console.log('[INSERT]   User', userId, 'has no specific role, using team_member');
              }
            }
            
            const link = {
              project_id: project.id,
              user_id: userId,
              role: role,
              added_by: session.user.id,
              added_at: new Date().toISOString(),
            };
            console.log('[INSERT]   Created stakeholder link:', link);
            return link;
          });

          console.log('[INSERT] Attempting to INSERT', stakeholderLinks.length, 'stakeholder links');
          console.log('[INSERT] Links to insert:', stakeholderLinks);
          const { data: insertData, error: stakeError } = await supabase
            .from('project_stakeholders')
            .insert(stakeholderLinks)
            .select();

          if (stakeError) {
            console.error('[ERROR] INSERT ERROR:', stakeError);
            alert(`Failed to insert new stakeholders: ${stakeError.message}\n\nDetails: ${JSON.stringify(stakeError, null, 2)}\n\nAttempted to insert: ${JSON.stringify(stakeholderLinks, null, 2)}`);
            throw new Error(`Failed to insert stakeholders: ${stakeError.message}`);
          } else {
            console.log('[SUCCESS] INSERT SUCCESS: Inserted', insertData?.length, 'stakeholders');
            console.log('[SUCCESS] Inserted rows:', insertData);
            
            // VERIFY: Read back the stakeholders to confirm they were written
            const { data: verifyData, error: verifyError } = await supabase
              .from('project_stakeholders')
              .select('*')
              .eq('project_id', project.id);
            
            console.log('[VERIFY] FINAL VERIFICATION: Stakeholders in database after insert:', verifyData);
            console.log('[VERIFY] FINAL COUNT:', verifyData?.length);
            if (verifyError) {
              console.error('[ERROR] VERIFICATION ERROR:', verifyError);
            }
            
            if (verifyData?.length !== selectedStakeholders.length) {
              alert(`WARNING: Expected ${selectedStakeholders.length} stakeholders but found ${verifyData?.length} in database!\n\nThis may indicate an RLS or permission issue.`);
            }
          }
        } else {
          console.log('[SKIP] No stakeholders selected, skipping insert');
        }
      } else {
        // CREATE MODE
        const { data: newProject, error: projectError} = await supabase
          .from('projects')
          .insert({
            name: formData.name,
            account_id: accountId,
            status: statusOptions?.find(s => s.value === formData.status)?.originalValue || formData.status,
            priority: formData.priority,
            start_date: formData.start_date,
            end_date: formData.end_date,
            assigned_user_id: formData.assigned_user_id === 'none' ? null : formData.assigned_user_id,
            created_by: session.user.id,
            actual_hours: 0,
            estimated_hours: formData.estimated_hours ? parseInt(formData.estimated_hours) : null,
          })
          .select()
          .single();

        if (projectError) {
          console.error('Error creating project:', projectError);
          alert('Failed to create project: ' + projectError.message);
          return;
        }

        project = newProject;

        // Create project assignment for the assigned user
        if (formData.assigned_user_id && formData.assigned_user_id !== 'none') {
          const roleId = userRoleIds.get(formData.assigned_user_id);
          const roleName = userRoles.get(formData.assigned_user_id)?.[0]?.split(' (')[0] || 'Team Member';

          await supabase
            .from('project_assignments')
            .insert({
              project_id: project.id,
              user_id: formData.assigned_user_id,
              role_in_project: roleName,
              assigned_by: session.user.id,
              assigned_at: new Date().toISOString(),
            });
        }

        // Add stakeholders
        console.log('CREATE MODE: Adding stakeholders for project:', project.id);
        console.log('Selected stakeholders:', selectedStakeholders);
        
        if (selectedStakeholders.length > 0) {
          const stakeholderLinks = selectedStakeholders.map(userId => {
            let role = 'team_member';
            if (userId === account?.account_manager_id) {
              role = 'account_manager';
            } else {
              const userRolesList = userRoles.get(userId);
              if (userRolesList && userRolesList.length > 0) {
                role = userRolesList[0].split(' (')[0].toLowerCase().replace(/\s+/g, '_');
              }
            }
            
            return {
              project_id: project.id,
              user_id: userId,
              role: role,
              added_by: session.user.id,
              added_at: new Date().toISOString(),
            };
          });

          const { data: insertData, error: stakeError } = await supabase
            .from('project_stakeholders')
            .insert(stakeholderLinks)
            .select();

          if (stakeError) {
            console.error('Error adding stakeholders (CREATE):', stakeError);
            throw new Error(`Failed to add stakeholders: ${stakeError.message}`);
          } else {
            console.log('Successfully added stakeholders (CREATE):', insertData);
          }
        }
      }

      // Success!
      console.log('[SUCCESS] Project operation completed successfully');
      
      // In edit mode, we need to poll the database to ensure data is synced before reloading
      if (editMode) {
        console.log('[POLLING] Edit mode: Verifying data is fully synced before reload...');
        
        // Poll the database to ensure stakeholders are visible
        let attempts = 0;
        let dataVerified = false;
        while (attempts < 10 && !dataVerified) {
          await new Promise(resolve => setTimeout(resolve, 300));
          
          const { data: checkStakeholders } = await supabase
            .from('project_stakeholders')
            .select('id')
            .eq('project_id', project.id);

          // Department checking removed - departments now derived from assignments

          console.log(`[POLLING] Attempt ${attempts + 1}: Stakeholders=${checkStakeholders?.length || 0}`);

          if (checkStakeholders?.length === selectedStakeholders.length) {
            console.log('[SUCCESS] Data verified in database!');
            dataVerified = true;
          }
          attempts++;
        }
        
        if (!dataVerified) {
          console.warn('[WARNING] Could not verify all data after 10 attempts, reloading anyway');
        }
        
        // Close dialog
        setOpen(false);
        
        // Trigger reload
        console.log('[RELOAD] Triggering parent reload');
        onTaskCreated?.(project);
      } else {
        // Create mode - close and reset immediately
        setOpen(false);
        resetForm();
        console.log('[CREATE MODE] Calling callback');
        onTaskCreated?.(project);
      }

    } catch (error) {
      console.error('Error with project:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      assigned_user_id: '',
      priority: 'medium',
      status: defaultStatus,
      start_date: new Date().toISOString().split('T')[0],
      end_date: addDays(new Date(), 7).toISOString().split('T')[0],
      estimated_hours: '',
    });
    setSelectedStakeholders([]);
    // Department selection removed
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleStakeholder = (userId: string) => {
    console.log('Toggling stakeholder:', userId);
    console.log('Current selectedStakeholders:', selectedStakeholders);
    setSelectedStakeholders(prev => {
      const newStakeholders = prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId];
      console.log('Updated selectedStakeholders after toggle:', newStakeholders);
      return newStakeholders;
    });
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

          {/* Assigned To */}
          <div className="space-y-2">
            <Label htmlFor="assigned_user">
              Assigned To <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.assigned_user_id}
              onValueChange={(value) => handleInputChange('assigned_user_id', value)}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select person to assign" />
              </SelectTrigger>
              <SelectContent>
                {users
                  .filter((user) => user.id && user.id !== '')
                  .map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Stakeholders (Multi-select Dropdown) */}
          <div className="space-y-2">
            <Label htmlFor="stakeholders">
              Stakeholders <span className="text-destructive">*</span>
            </Label>
            <p className="text-sm text-muted-foreground">
              Select team members involved in this project
            </p>
            <Select
              value="__placeholder__"
              onValueChange={(value) => {
                console.log('Stakeholder selected:', value);
                console.log('Current selectedStakeholders:', selectedStakeholders);
                if (value && value !== "__placeholder__" && !selectedStakeholders.includes(value)) {
                  setSelectedStakeholders(prev => {
                    const newStakeholders = [...prev, value];
                    console.log('Updated selectedStakeholders:', newStakeholders);
                    return newStakeholders;
                  });
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Add stakeholders..." />
              </SelectTrigger>
              <SelectContent>
                {users
                  .filter(user => user.id && user.id !== '' && !selectedStakeholders.includes(user.id))
                  .map((user) => {
                    const roles = userRoles.get(user.id) || [];
                    const isAccountManager = user.id === account?.account_manager_id;

                    let displayText = user.name;
                    if (isAccountManager) {
                      displayText += ' (Account Manager)';
                    } else if (roles.length > 0) {
                      displayText += ` (${roles.join(', ')})`;
                    }

                    return (
                      <SelectItem key={user.id} value={user.id}>
                        {displayText}
                      </SelectItem>
                    );
                  })}
              </SelectContent>
            </Select>
            {selectedStakeholders.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedStakeholders.map(userId => {
                  const user = users.find(u => u.id === userId);
                  const roles = userRoles.get(userId) || [];
                  const isAccountManager = userId === account?.account_manager_id;
                  
                  return user ? (
                    <Badge key={userId} variant="secondary" className="flex items-center gap-1">
                      {user.name}
                      {isAccountManager && <span className="text-xs">(AM)</span>}
                      {roles.length > 0 && !isAccountManager && (
                        <span className="text-xs">({roles[0].split(' (')[0]})</span>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleStakeholder(userId)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ) : null;
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
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
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status">
                Status <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleInputChange('status', value)}
                required
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions && statusOptions.length > 0 ? (
                    statusOptions
                      .filter((option) => option.value && option.value !== '')
                      .map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))
                  ) : (
                    <>
                      <SelectItem value="planning">Planning</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="review">Review</SelectItem>
                      <SelectItem value="complete">Complete</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
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
              Estimated Hours
            </Label>
            <Input
              id="estimated_hours"
              type="number"
              value={formData.estimated_hours}
              onChange={(e) => handleInputChange('estimated_hours', e.target.value)}
              placeholder="Enter total estimated hours"
              min="0"
              step="0.5"
            />
            <p className="text-xs text-muted-foreground">
              Total hours estimated for this project
            </p>
          </div>

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
              disabled={loading || !formData.name || !formData.assigned_user_id}
            >
              {loading ? (editMode ? 'Updating...' : 'Creating...') : (editMode ? 'Update Project' : 'Create Project')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

'use client';

// Account overview component - updated to fix module resolution
import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  PlusIcon,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  Users,
  BarChart3,
  Trash2,
  ExternalLink,
  Move,
  SortAsc,
  SortDesc,
  Edit
} from 'lucide-react';
import { AccountWithProjects, AccountMetrics, UrgentItem, ProjectWithDetails, accountService } from '@/lib/account-service';
import { createClientSupabase } from '@/lib/supabase';

import TaskCreationDialog from '@/components/task-creation-dialog';
import { format, formatDistance } from 'date-fns';
import { accountKanbanConfigService, KanbanColumn } from '@/lib/account-kanban-config';
import { UserWithRoles, hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';
import { getMilestones, createMilestone, type Milestone } from '@/lib/milestone-service';
import { MilestoneDialog } from '@/components/milestone-dialog';
import { projectIssuesService, type ProjectIssue } from '@/lib/project-issues-service';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AccountEditDialog } from '@/components/account-edit-dialog';
import CapacityDashboard from '@/components/capacity-dashboard';

interface AccountOverviewProps {
  account: AccountWithProjects;
  metrics: AccountMetrics;
  urgentItems: UrgentItem[];
  userProfile: UserWithRoles;
  hasFullAccess?: boolean; // If false, user has read-only access (project stakeholder only)
}

// Default kanban columns - will be overridden by account-specific config
const DEFAULT_KANBAN_COLUMNS: KanbanColumn[] = [
  { id: 'planned', name: 'Planned', color: '#6B7280', order: 1 },
  { id: 'in-progress', name: 'In Progress', color: '#3B82F6', order: 2 },
  { id: 'review', name: 'Review', color: '#F59E0B', order: 3 },
  { id: 'complete', name: 'Complete', color: '#10B981', order: 4 },
];

export function AccountOverview({ account, metrics, urgentItems, userProfile }: AccountOverviewProps) {
  // Account overview component
  // NOTE: Kanban/Gantt for projects is deprecated (workflows replace it), only table view remains
  // Memoize account ID to avoid complex expressions in deps
  const accountId = useMemo(() => (account as any).id, [account]);

  const [projects, setProjects] = useState(account.projects);
  const [kanbanColumns, setKanbanColumns] = useState<KanbanColumn[]>(DEFAULT_KANBAN_COLUMNS);
  const [accountMembers, setAccountMembers] = useState<Array<{
    id: string;
    user_id: string;
    account_id: string;
    created_at: string;
    user: {
      id: string;
      name: string;
      email: string;
      image: string | null;
      roles: Array<{
        id: string;
        name: string;
        department: {
          id: string;
          name: string;
        } | null;
      }>;
    } | null;
  }>>([]);
  const [customColumnAssignments, setCustomColumnAssignments] = useState<Record<string, string>>({});
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);
  const [milestoneDialogInitialDate] = useState<Date | undefined>(undefined);
  const [projectDialogStartDate] = useState<Date | undefined>(undefined);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  
  // Move Project Dialog State
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [projectToMove, setProjectToMove] = useState<ProjectWithDetails | null>(null);
  
  // Filter and Sort State
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'priority' | 'deadline'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Active Issues State
  const [activeIssues, setActiveIssues] = useState<(ProjectIssue & { project?: { id: string; name: string } })[]>([]);
  const [loadingActiveIssues, setLoadingActiveIssues] = useState(true);

  // Finished Projects State
  const [finishedProjects, setFinishedProjects] = useState<ProjectWithDetails[]>([]);
  const [loadingFinishedProjects, setLoadingFinishedProjects] = useState(true);

  // Delete Confirmation Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null);

  // Permission states
  // NOTE: Table view is just the project list (no separate permission needed)
  // Kanban/Gantt for projects is deprecated (workflows replace it)
  // View permissions are derived from project permissions
  const [canCreateProject, setCanCreateProject] = useState(false);
  const [canDeleteProject, setCanDeleteProject] = useState(false);
  const [canEditAccount, setCanEditAccount] = useState(false);

  // NOTE: Kanban/Gantt for projects is deprecated (workflows replace it), only table view remains

  // Load account members
  const loadAccountMembers = useCallback(async () => {
      try {
        const response = await fetch(`/api/accounts/${accountId}/members`);
        
        // Get response text first to check if it's valid JSON
        const responseText = await response.text();
        let data: Record<string, unknown>;
        
        try {
          data = JSON.parse(responseText);
        } catch {
          console.error('Failed to parse API response:', {
            status: response.status,
            statusText: response.statusText,
            responseText: responseText.substring(0, 200)
          });
          // Set empty array if response is not valid JSON
          setAccountMembers([]);
          return;
        }
        
        if (!response.ok) {
          // Log the error details from the response - include full data object
          console.error('Failed to load account members:', {
            status: response.status,
            statusText: response.statusText,
            fullResponseData: data, // Log the entire response object
            error: data?.error || 'Unknown error',
            details: data?.details || data?.message || 'No details provided',
            code: data?.code || 'No error code',
            url: `/api/accounts/${accountId}/members`
          });
          // Set empty array if error - don't crash the page
          setAccountMembers([]);
          return;
        }
        
        // Success - set the members
        setAccountMembers((data.members as typeof accountMembers) || []);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        console.error('Error loading account members:', {
          error: errorMessage,
          stack: errorStack
        });
        // Set empty array on error - don't crash the page
        setAccountMembers([]);
      }
    }, [accountId]);

  useEffect(() => {
    loadAccountMembers();
  }, [loadAccountMembers]);

  // Fetch remaining hours for all projects
  const fetchRemainingHours = useCallback(async () => {
      if (!projects || projects.length === 0) return;

      try {
        const supabase = createClientSupabase() as any;
        if (!supabase) return;

        const projectIds = projects.map((p: any) => p.id);
        const { data: tasksData } = await supabase
          .from('tasks')
          .select('project_id, remaining_hours, estimated_hours')
          .in('project_id', projectIds);

        if (tasksData) {
          // Calculate remaining hours and task sum per project
          const projectRemainingHours: Record<string, number> = {};
          const projectTaskSum: Record<string, number> = {};
          tasksData.forEach((task: any) => {
            const projectId = task.project_id as string;
            if (!projectRemainingHours[projectId]) {
              projectRemainingHours[projectId] = 0;
            }
            if (!projectTaskSum[projectId]) {
              projectTaskSum[projectId] = 0;
            }
            projectRemainingHours[projectId] += (task.remaining_hours as number ?? task.estimated_hours as number ?? 0);
            projectTaskSum[projectId] += (task.estimated_hours as number ?? 0);
          });

          // Update projects with remaining hours and task sum
          setProjects(prevProjects =>
            prevProjects.map((project: any) => ({
              ...project,
              remaining_hours: projectRemainingHours[project.id] ?? null,
              task_hours_sum: projectTaskSum[project.id] ?? 0
            }))
          );
        }
      } catch (error: unknown) {
        console.error('Error fetching remaining hours:', error);
      }
    }, [projects]);

  useEffect(() => {
    fetchRemainingHours();
  }, [fetchRemainingHours, projects]);

  // Check permissions
  // NOTE: Table view is just the project list (no separate permission needed)
  // Kanban/Gantt views for projects are deprecated (workflows replace them)
  const checkPermissions = useCallback(async () => {
    if (!userProfile) return;
      const manage = await hasPermission(userProfile, Permission.MANAGE_PROJECTS, { accountId });
      const editAccount = await hasPermission(userProfile, Permission.MANAGE_ACCOUNTS, { accountId });

      setCanCreateProject(manage);
      setCanDeleteProject(manage);
      setCanEditAccount(editAccount);
    }, [userProfile, accountId]);

  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  // Load milestones from database
  const loadMilestones = useCallback(async () => {
      try {
        console.log('AccountOverview: Loading milestones...');
        const fetchedMilestones = await getMilestones();
        console.log('AccountOverview: Fetched milestones:', fetchedMilestones);
        setMilestones(fetchedMilestones);
      } catch (error: unknown) {
        console.error('Failed to load milestones:', error);
      }
    }, []);

  useEffect(() => {
    loadMilestones();
  }, [loadMilestones]);

  // Load active issues for this account
  const loadActiveIssues = useCallback(async () => {
      setLoadingActiveIssues(true);
      try {
        const issues = await projectIssuesService.getAccountActiveIssues(accountId);
        setActiveIssues(issues);
      } catch (error: unknown) {
        console.error('Failed to load active issues:', error);
      } finally {
        setLoadingActiveIssues(false);
      }
    }, [accountId]);

  useEffect(() => {
    loadActiveIssues();
  }, [loadActiveIssues]);

  // Load finished projects for this account
  const loadFinishedProjects = useCallback(async () => {
      setLoadingFinishedProjects(true);
      try {
        const supabase = createClientSupabase() as any;
        if (!supabase) return;

        const { data, error } = await supabase
          .from('projects')
          .select(`
            *,
            account:accounts(id, name)
          `)
          .eq('account_id', accountId)
          .eq('status', 'complete')
          .order('updated_at', { ascending: false });

        if (error) {
          console.error('Failed to load finished projects:', error);
          return;
        }

        // Map to ProjectWithDetails format
        const finished = (data || []).map((p: any) => ({
          ...p,
          departments: [],
          daysUntilDeadline: null
        } as unknown as ProjectWithDetails));

        setFinishedProjects(finished);
      } catch (error: unknown) {
        console.error('Failed to load finished projects:', error);
      } finally {
        setLoadingFinishedProjects(false);
      }
    }, [accountId]);

  useEffect(() => {
    loadFinishedProjects();
  }, [loadFinishedProjects]);

  // Handle issue status update
  const handleUpdateIssueStatus = async (issueId: string, projectId: string, newStatus: 'open' | 'in_progress' | 'resolved') => {
    // Optimistic update for immediate feedback
    const previousIssues = [...activeIssues];
    setActiveIssues(prev => prev.map((issue: any) =>
      issue.id === issueId ? { ...issue, status: newStatus } : issue
    ));

    try {
      // Use API route for proper permission checking
      const response = await fetch(`/api/projects/${projectId}/issues/${issueId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      const result = await response.json();

      if (response.ok) {
        // Reload active issues (will automatically filter out resolved ones)
        const issues = await projectIssuesService.getAccountActiveIssues(accountId);
        setActiveIssues(issues);
        toast.success(`Issue ${newStatus === 'resolved' ? 'resolved' : 'status updated'}`);
      } else {
        // Revert on error
        setActiveIssues(previousIssues);
        toast.error(result.error || 'Failed to update issue status');
      }
    } catch (error: unknown) {
      // Revert on error
      setActiveIssues(previousIssues);
      console.error('Error updating issue status:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update issue status. Please try again.';
      toast.error(errorMessage);
    }
  };

  // Load account-specific kanban configuration
  const loadKanbanConfig = useCallback(async () => {
      try {
        const config = await accountKanbanConfigService.getOrCreateAccountKanbanConfig(accountId);
        setKanbanColumns(config.columns.sort((a, b) => a.order - b.order));
      } catch (error: unknown) {
        console.error('Error loading kanban config:', error);
        setKanbanColumns(DEFAULT_KANBAN_COLUMNS);
      }
    }, [accountId]);

  useEffect(() => {
    loadKanbanConfig();
  }, [loadKanbanConfig]);

  // Load custom column assignments from localStorage
  const loadCustomAssignments = useCallback(() => {
      try {
        const stored = localStorage.getItem(`kanban-custom-assignments-${accountId}`);
        if (stored) {
          const assignments = JSON.parse(stored);
          console.log('Loaded custom column assignments from localStorage:', assignments);
          setCustomColumnAssignments(assignments);
        }
      } catch (error: unknown) {
        console.error('Error loading custom column assignments:', error);
      }
    }, [accountId]);

  useEffect(() => {
    loadCustomAssignments();
  }, [loadCustomAssignments]);

  // Save custom column assignments to localStorage whenever they change
  useEffect(() => {
    if (Object.keys(customColumnAssignments).length > 0) {
      try {
        localStorage.setItem(`kanban-custom-assignments-${accountId}`, JSON.stringify(customColumnAssignments));
        console.log('Saved custom column assignments to localStorage:', customColumnAssignments);
      } catch (error: unknown) {
        console.error('Error saving custom column assignments:', error);
      }
    }
  }, [customColumnAssignments, accountId]);

  const handleTaskCreated = (newProject: Record<string, unknown>, assignedUser?: any) => {
    if (newProject) {
      // Add the new project to local state immediately (optimistic update)
      // Don't use router.refresh() - it can cause CSS MIME type issues in Next.js dev mode
      const projectWithDetails = {
        ...newProject,
        departments: [],
        assigned_users: assignedUser ? [assignedUser as { id: string; name: string; image: string }] : [],
        status_info: { id: newProject.status || 'planning', name: 'Planning', color: '#6B7280' },
        workflow_step: null,
      } as unknown as ProjectWithDetails;
      setProjects(prev => [projectWithDetails, ...prev]);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return { backgroundColor: '#fee2e2', color: '#dc2626', borderColor: '#fca5a5' }
      case 'high':
        return { backgroundColor: '#fed7aa', color: '#ea580c', borderColor: '#fdba74' }
      case 'medium':
        return { backgroundColor: '#fef3c7', color: '#d97706', borderColor: '#fbbf24' }
      case 'low':
        return { backgroundColor: '#d1fae5', color: '#059669', borderColor: '#6ee7b7' }
      default:
        return { backgroundColor: '#f3f4f6', color: '#374151', borderColor: '#d1d5db' }
    }
  }

  const handleDeleteProject = (projectId: string) => {
    console.log('handleDeleteProject called with ID:', projectId);
    // Look in both active and finished projects
    const project = projects.find((p: any) => p.id === projectId) || finishedProjects.find((p: any) => p.id === projectId);
    console.log('Found project:', project);
    if (project) {
      console.log('Setting project to delete:', { id: project.id, name: project.name });
      setProjectToDelete({ id: project.id, name: project.name });
      setDeleteDialogOpen(true);
      console.log('Dialog should now be open');
    } else {
      console.error('Project not found for ID:', projectId);
    }
  };

  const handleMoveProjectToStatus = async (projectId: string, newStatus: string) => {
    try {
      // Find the column that corresponds to this status
      const targetColumn = kanbanColumns.find((col: any) => 
        accountKanbanConfigService.getStatusForKanbanColumn(col.id, kanbanColumns) === newStatus
      );
      
      if (!targetColumn) {
        console.error('Could not find column for status:', newStatus);
        return;
      }

      // Check if this is a custom column (like "Approved") that should be visual-only
      const isCustomColumn = !['planned', 'in-progress', 'review', 'complete'].includes(targetColumn.id);
      const isApprovedColumn = targetColumn.name.toLowerCase().includes('approved') || 
                              targetColumn.name.toLowerCase().includes('approval');

      if (isCustomColumn && isApprovedColumn) {
        // For "Approved" columns, only update the custom column assignment (visual only)
        console.log('Moving to custom Approved column - visual only, no database update');
        
        setCustomColumnAssignments(prev => ({
          ...prev,
          [projectId]: targetColumn.id
        }));
        
        console.log('Custom column assignment updated for Approved column:', targetColumn.id);
      } else {
        // For standard columns, update the database status
        console.log('Moving to standard column - updating database status');

        const supabase = createClientSupabase() as any;
        if (!supabase) return;

        const { error } = await (supabase as any)
          .from('projects')
          .update({ status: newStatus })
          .eq('id', projectId);

        if (error) {
          console.error('Error updating project status:', error);
          return;
        }

        // Update the local state
        setProjects(prevProjects => 
          prevProjects.map((project: any) => 
            project.id === projectId 
              ? { ...project, status: newStatus }
              : project
          )
        );
      }

      // Update custom column assignment for all moves to maintain visual state
      setCustomColumnAssignments(prev => ({
        ...prev,
        [projectId]: targetColumn.id
      }));

      // Close the dialog
      setMoveDialogOpen(false);
      setProjectToMove(null);
    } catch (error: unknown) {
      console.error('Error moving project:', error);
    }
  };

  // Filter and sort projects (exclude completed - they show in Finished Projects section)
  const filteredAndSortedProjects = projects
    .filter((project: any) => {
      // Exclude completed projects - they go to the Finished Projects section
      if (project.status === 'complete') return false;
      if (statusFilter !== 'all' && project.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && project.priority !== priorityFilter) return false;
      return true;
    })
    .sort((a, b) => {
      let aValue: string | number, bValue: string | number;

      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'priority':
          const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
          aValue = priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
          bValue = priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
          break;
        case 'deadline':
          aValue = a.end_date ? new Date(a.end_date).getTime() : 0;
          bValue = b.end_date ? new Date(b.end_date).getTime() : 0;
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    })
    .map((project: any) => ({
      ...project,
      daysUntilDeadline: project.end_date 
        ? Math.ceil((new Date(project.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        : null
    }));

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;
    
    console.log('Confirming delete for project:', projectToDelete.name);

    try {
      console.log('Attempting to delete project...');
      const success = await accountService.deleteProject(projectToDelete.id);
      console.log('Delete result:', success);
      
      if (success) {
        // Remove from active projects
        setProjects(prev => {
          const filtered = prev.filter((p: any) => p.id !== projectToDelete.id);
          console.log('Updated projects list:', filtered.length, 'projects remaining');
          return filtered;
        });
        // Also remove from finished projects
        setFinishedProjects(prev => {
          const filtered = prev.filter((p: any) => p.id !== projectToDelete.id);
          console.log('Updated finished projects list:', filtered.length, 'projects remaining');
          return filtered;
        });
        console.log('Project deleted successfully');
      } else {
        console.error('Failed to delete project - service returned false');
        toast.error('Failed to delete project. Please try again.');
      }
    } catch (error: unknown) {
      console.error('Error deleting project:', error);
      toast.error('Error deleting project. Please try again.');
    } finally {
      // Close dialog and reset state
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    }
  };

  // Convert projects to Gantt features

  // NOTE: Gantt chart handlers removed as Gantt view is deprecated

  // Handle project creation
  const handleProjectCreated = (newProject: any) => {
    if (newProject) {
      // Add the new project to local state immediately (optimistic update)
      const projectWithDetails = {
        ...newProject,
        departments: [],
        assigned_users: [],
        status_info: { id: (newProject.status as string) || 'planning', name: 'Planning', color: '#6B7280' },
        workflow_step: null,
      } as unknown as ProjectWithDetails;
      setProjects(prev => [projectWithDetails, ...prev]);
    }
    setProjectDialogOpen(false);
  };

  const handleMilestoneSubmit = async (data: {
    name: string;
    description: string;
    date: Date;
    color: string;
  }) => {
    try {
      console.log('AccountOverview: Creating milestone with data:', data);
      const newMilestone = await createMilestone({
        name: data.name,
        description: data.description,
        date: data.date,
        color: data.color,
      });
      console.log('AccountOverview: Created milestone:', newMilestone);
      const updatedMilestones = [...milestones, newMilestone].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      console.log('AccountOverview: Updated milestones array:', updatedMilestones);
      setMilestones(updatedMilestones);
    } catch (error: unknown) {
      console.error('Failed to create milestone:', error);
      throw error; // Re-throw to let the dialog handle the error
    }
  };

  // Helper function to map project status to kanban column
  const getKanbanColumn = (status: string) => {
    return accountKanbanConfigService.getKanbanColumnForStatus(status, kanbanColumns);
  };

  // Convert projects to Kanban format
  const kanbanData = projects.map((project: any) => {
    // Check if this project has a custom column assignment
    const customColumn = customColumnAssignments[project.id];
    const columnId = customColumn || getKanbanColumn(project.status);
    
    console.log('Mapping project to kanban:', {
      projectId: project.id,
      projectStatus: project.status,
      customColumn,
      mappedColumnId: columnId,
      availableColumns: kanbanColumns.map((c: any) => c.id)
    });
    
    return {
      id: project.id,
      name: project.name,
      column: columnId,
      description: project.description,
      startAt: project.start_date ? new Date(project.start_date) : new Date(),
      endAt: project.end_date ? new Date(project.end_date) : new Date(),
      owner: project.assigned_users?.[0] || null,
      priority: project.priority,
      tags: [],
    };
  });

  console.log('Kanban data:', kanbanData);
  console.log('Kanban columns:', kanbanColumns);
  console.log('Projects status mapping:', projects.map((p: any) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    mappedColumn: getKanbanColumn(p.status)
  })));

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getHealthScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header - Responsive */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="px-4 sm:px-6 py-6 sm:py-8">
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <h1 className="text-4xl font-bold text-foreground">{(account as any).name}</h1>
                  <Badge variant={(account as any).status === 'active' ? 'default' : 'secondary'} className="text-xs whitespace-nowrap w-fit">
                    {(account as any).status}
                  </Badge>
                </div>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  {(account as any).description || 'No description provided'}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {canEditAccount && (
                  <AccountEditDialog
                    account={account}
                    userProfile={userProfile}
                    onAccountUpdated={() => {
                      // Account will be refreshed via page reload in the dialog
                    }}
                  >
                    <Button variant="outline" size="sm" className="flex items-center gap-2">
                      <Edit className="h-4 w-4" />
                      <span className="hidden sm:inline">Edit Account</span>
                    </Button>
                  </AccountEditDialog>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6 sm:space-y-8">
        {/* 1. Projects Card */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
              <div className="flex-1 min-w-0">
                <CardTitle className="text-lg sm:text-xl">Projects</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage and track your account projects
                </p>
              </div>
              <div className="space-y-4">
                {/* New Project Button */}
                <div className="flex items-center justify-end">
                  {canCreateProject && (
                    <TaskCreationDialog
                      onTaskCreated={handleTaskCreated}
                      accountId={(account as any).id}
                      account={account as unknown as Record<string, unknown>}
                      userProfile={userProfile}
                      initialStartDate={projectDialogStartDate}
                    >
                      <Button className="flex items-center gap-2" size="sm">
                        <PlusIcon className="h-4 w-4" />
                        <span className="hidden sm:inline">New Project</span>
                        <span className="sm:hidden">New</span>
                      </Button>
                    </TaskCreationDialog>
                  )}
                </div>

                {/* Filter and Sort Controls */}
                <div className="flex flex-wrap gap-2">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="planning">Planning</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="review">Review</SelectItem>
                        <SelectItem value="on_hold">On Hold</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                      <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="Priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Priority</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={sortBy} onValueChange={(value: 'name' | 'status' | 'priority' | 'deadline') => setSortBy(value)}>
                      <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="status">Status</SelectItem>
                        <SelectItem value="priority">Priority</SelectItem>
                        <SelectItem value="deadline">Deadline</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                      className="px-3"
                    >
                      {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
                    </Button>
                  </div>
              </div>
              </div>
          </CardHeader>
          <CardContent>
            {/* Projects Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Project</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Workflow Step</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Priority</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Account</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Est Hours</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Deadline</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedProjects.map((project:any) => (
                    <tr key={project.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-gray-900">{project.name}</p>
                          {project.description && (
                            <p className="text-sm text-gray-600 line-clamp-2">
                              {project.description}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {project.workflow_step ? (
                          <Badge className="text-xs whitespace-nowrap border bg-blue-100 text-blue-800 border-blue-300">
                            {project.workflow_step}
                          </Badge>
                        ) : (
                          <span className="text-sm text-gray-400">No workflow</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          className="text-xs whitespace-nowrap border"
                          style={getPriorityColor(project.priority)}
                        >
                          {project.priority}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600">{(account as any).name}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4 text-blue-500" />
                          <span className="text-sm font-semibold text-blue-600">
                            {project.estimated_hours ? `${project.estimated_hours}h` : '-'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {project.end_date ? (
                          <div>
                            <p className="text-sm text-gray-900">
                              {format(new Date(project.end_date), 'MMM dd, yyyy')}
                            </p>
                            {(() => {
                              const endDate = new Date(project.end_date);
                              const now = new Date();
                              const daysUntilDeadline = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                              return (
                                <p className={`text-xs ${
                                  daysUntilDeadline < 0
                                    ? 'text-red-600'
                                    : daysUntilDeadline <= 7
                                      ? 'text-yellow-600'
                                      : 'text-gray-600'
                                }`}>
                                  {daysUntilDeadline < 0
                                    ? `${Math.abs(daysUntilDeadline)} days overdue`
                                    : `${daysUntilDeadline} days left`
                                  }
                                </p>
                              );
                            })()}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">No deadline</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="h-8 w-8 p-0"
                          >
                            <Link href={`/projects/${project.id}`}>
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                          {canDeleteProject && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteProject(project.id)}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* 2. Active Issues & Roadblocks Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Active Issues & Roadblocks
            </CardTitle>
            <CardDescription>
              All open and in-progress issues across account projects
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingActiveIssues ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
                <p className="text-sm text-muted-foreground mt-2">Loading issues...</p>
              </div>
            ) : activeIssues.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">No active issues. Everything is running smoothly!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeIssues.map((issue:any) => (
                  <div
                    key={issue.id}
                    className={`p-4 border rounded-lg ${
                      issue.status === 'in_progress'
                        ? 'bg-yellow-50 border-yellow-200'
                        : 'bg-orange-50 border-orange-200'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="space-y-2">
                        {/* Project Badge */}
                        {issue.project && (
                          <Badge variant="secondary" className="text-xs whitespace-nowrap w-fit">
                            {issue.project.name}
                          </Badge>
                        )}

                        {/* Issue Content */}
                        <p className="text-sm text-gray-900 break-words">
                          {issue.content}
                        </p>
                      </div>

                      {/* Issue Metadata and Status Selector */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            <span className="truncate">{issue.user_profiles?.name || 'Unknown'}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistance(new Date(issue.created_at), new Date(), { addSuffix: true })}
                          </span>
                        </div>

                        {/* Status Selector */}
                        <div className="flex-shrink-0">
                          <Select
                            value={issue.status}
                            onValueChange={(value) => handleUpdateIssueStatus(issue.id, issue.project_id, value as 'open' | 'in_progress' | 'resolved')}
                          >
                            <SelectTrigger className="w-[130px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">
                                <span className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                                  Open
                                </span>
                              </SelectItem>
                              <SelectItem value="in_progress">
                                <span className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                                  In Progress
                                </span>
                              </SelectItem>
                              <SelectItem value="resolved">
                                <span className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                  Resolved
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3. Urgent Items Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Urgent Items
            </CardTitle>
            <CardDescription>
              Items requiring immediate attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            {urgentItems.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">No urgent items</p>
              </div>
            ) : (
              <div className="space-y-4">
                {urgentItems.map((item:any, index:any) => (
                  <div key={index} className="flex items-center p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full ${item.priority === 'high' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 4. Key Metrics Card - Health Scores */}
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
              {/* Health Score */}
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${getHealthScoreBg(metrics.healthScore)}`}>
                    <span className={`text-lg font-bold ${getHealthScoreColor(metrics.healthScore)}`}>
                      {metrics.healthScore}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Health Score</p>
                  <p className="text-xs text-muted-foreground">Overall Health</p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  <BarChart3 className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Projects</p>
                  <p className="text-2xl font-bold text-foreground">{metrics.activeProjects}</p>
                  <p className="text-xs text-muted-foreground">of {metrics.totalProjects} total</p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Completed Projects</p>
                  <p className="text-2xl font-bold text-green-600">{metrics.completedProjects}</p>
                  <p className="text-xs text-muted-foreground">Successfully finished</p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  <Calendar className="w-8 h-8 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Upcoming Deadlines</p>
                  <p className="text-2xl font-bold text-foreground">{metrics.upcomingDeadlines}</p>
                  <p className="text-xs text-muted-foreground">Due within 7 days</p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  <AlertTriangle className="w-8 h-8 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Overdue Projects</p>
                  <p className="text-2xl font-bold text-red-600">{metrics.overdueProjects}</p>
                  <p className="text-xs text-muted-foreground">Require attention</p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  <Clock className="w-8 h-8 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pending Approvals</p>
                  <p className="text-2xl font-bold text-foreground">{metrics.pendingApprovals}</p>
                  <p className="text-xs text-muted-foreground">Awaiting review</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 5. Account Capacity Trends */}
        <CapacityDashboard
          userProfile={userProfile}
          mode="account"
          accountId={(account as any).id}
        />

        {/* 6. Finished Projects Card */}
        {finishedProjects.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Finished Projects
              </CardTitle>
              <CardDescription>
                {finishedProjects.length} completed {finishedProjects.length === 1 ? 'project' : 'projects'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingFinishedProjects ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400" />
                </div>
              ) : (
                <div className="space-y-3">
                  {finishedProjects.map((project:any) => (
                    <div
                      key={project.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/projects/${project.id}`}
                          className="text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline"
                        >
                          {project.name}
                        </Link>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          {project.completed_at && (
                            <span className="flex items-center gap-1">
                              <CheckCircle className="h-3 w-3 text-green-500" />
                              Completed {format(new Date(project.completed_at), 'MMM d, yyyy')}
                            </span>
                          )}
                          {(project.actual_hours ?? 0) > 0 && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {project.actual_hours}h logged
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Badge className="bg-green-100 text-green-800 text-xs">
                          Complete
                        </Badge>
                        <Link href={`/projects/${project.id}`}>
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </Link>
                        {canDeleteProject && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteProject(project.id)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 7. Account Information Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Account Details Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pb-6 border-b">
              <div>
                <p className="text-sm text-muted-foreground">Primary Contact</p>
                <p className="text-sm font-medium">{(account as any).primary_contact_name || 'Not specified'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="text-sm font-medium">{(account as any).primary_contact_email || 'No email'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="text-sm font-medium">{format(new Date((account as any).created_at), 'MMM dd, yyyy')}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Team Size</p>
                <p className="text-sm font-medium">{accountMembers.length} member{accountMembers.length !== 1 ? 's' : ''}</p>
              </div>
            </div>

            {/* Account Members Section */}
            {accountMembers.length > 0 && (
              <div className="pt-6">
                <p className="text-sm font-medium mb-4">Team Members</p>
                <div className="flex flex-wrap gap-4">
                  {accountMembers.map((member:any) => (
                    member.user && (
                      <div key={member.id} className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={member.user.image || undefined} />
                          <AvatarFallback className="text-xs">
                            {member.user.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{member.user.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {member.user.roles && member.user.roles.length > 0
                              ? member.user.roles.map((r: any) => r.name).join(', ')
                              : 'No role assigned'}
                          </p>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Milestone Creation Dialog */}
      <MilestoneDialog
        open={milestoneDialogOpen}
        onOpenChange={setMilestoneDialogOpen}
        onCreateMilestone={handleMilestoneSubmit}
        initialDate={milestoneDialogInitialDate}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete Project?
            </DialogTitle>
          </DialogHeader>
          {projectToDelete && (
            <div className="space-y-3 pt-2">
              <p className="text-sm text-muted-foreground">
                You are about to delete <span className="font-semibold text-gray-900">&quot;{projectToDelete.name}&quot;</span>.
              </p>
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-800">
                  ⚠️ <strong>Warning:</strong> This action cannot be undone. All project data, including updates, issues, and history will be permanently removed.
                </p>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteProject}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project Creation Dialog - No trigger button, opened via Gantt chart clicks */}
      <TaskCreationDialog
        open={projectDialogOpen}
        onOpenChange={setProjectDialogOpen}
        onTaskCreated={handleProjectCreated}
        accountId={(account as any).id}
        account={account as unknown as Record<string, unknown>}
        userProfile={userProfile}
        initialStartDate={projectDialogStartDate}
      >
        {null}
      </TaskCreationDialog>

      {/* Move Project Dialog */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Move className="h-5 w-5" />
              Move Project
            </DialogTitle>
          </DialogHeader>
          {projectToMove && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Move <strong>{projectToMove.name}</strong> to a different status:
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {kanbanColumns.map((column:any) => {
                    const columnStatus = accountKanbanConfigService.getStatusForKanbanColumn(column.id, kanbanColumns);
                    
                    // Check if this is the current column by looking at custom assignments or status mapping
                    const currentCustomColumn = customColumnAssignments[projectToMove.id];
                    const currentMappedColumn = getKanbanColumn(projectToMove.status);
                    const isCurrentColumn = currentCustomColumn === column.id || 
                                          (currentCustomColumn === undefined && currentMappedColumn === column.id);
                    
                    return (
                      <Button
                        key={column.id}
                        variant="outline"
                        onClick={() => handleMoveProjectToStatus(projectToMove.id, columnStatus)}
                        className="justify-start h-auto p-3"
                        disabled={isCurrentColumn}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="h-2 w-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: column.color }}
                          />
                          <div className="text-left">
                            <div className="font-medium">{column.name}</div>
                            {isCurrentColumn && (
                              <div className="text-xs text-muted-foreground">Current status</div>
                            )}
                          </div>
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMoveDialogOpen(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

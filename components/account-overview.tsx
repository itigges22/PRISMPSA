'use client';

// Account overview component - updated to fix module resolution
import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  PlusIcon, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Users, 
  TrendingUp,
  BarChart3,
  Grid3X3,
  List,
  GanttChart,
  Settings,
  Trash2,
  MoreVertical,
  ZoomIn,
  ZoomOut,
  CalendarDays,
  CalendarRange,
  ExternalLink,
  Move,
  SortAsc,
  SortDesc,
  Edit
} from 'lucide-react';
import { AccountWithProjects, AccountMetrics, UrgentItem, ProjectWithDetails, accountService } from '@/lib/account-service';
import { UserProfile } from '@/lib/supabase';
import { createClientSupabase } from '@/lib/supabase';
import TaskCreationDialog from '@/components/task-creation-dialog';
import { KanbanConfigDialog } from '@/components/kanban-config-dialog';
import { KanbanProvider, KanbanBoard, KanbanCard, KanbanCards, KanbanHeader } from '@/components/ui/shadcn-io/kanban';
import { 
  GanttProvider, 
  GanttSidebar, 
  GanttSidebarGroup,
  GanttSidebarItem, 
  GanttTimeline, 
  GanttHeader, 
  GanttFeatureList, 
  GanttFeatureListGroup,
  GanttFeatureItem,
  GanttToday,
  GanttMarker,
  GanttCreateMarkerTrigger,
  type GanttFeature,
  type GanttStatus,
  type GanttMarkerProps
} from '@/components/ui/shadcn-io/gantt/index';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, formatDistance, addDays, isSameDay } from 'date-fns';
import { accountKanbanConfigService, KanbanColumn } from '@/lib/account-kanban-config';
import { isSuperadmin, UserWithRoles, hasPermission, canViewProject } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';
import { checkPermissionHybrid } from '@/lib/permission-checker';
import { getMilestones, createMilestone, deleteMilestone, type Milestone } from '@/lib/milestone-service';
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

export function AccountOverview({ account, metrics, urgentItems, userProfile, hasFullAccess = true }: AccountOverviewProps) {
  // Account overview component
  // NOTE: Kanban/Gantt for projects is deprecated (workflows replace it), only table view remains
  const [viewMode, setViewMode] = useState<'table'>('table');
  const [projects, setProjects] = useState(account.projects);
  const [projectsLoading, setProjectsLoading] = useState(false);
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
  const [loadingKanbanConfig, setLoadingKanbanConfig] = useState(true);
  const [customColumnAssignments, setCustomColumnAssignments] = useState<Record<string, string>>({});
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [ganttZoom, setGanttZoom] = useState(200);
  const [ganttRange, setGanttRange] = useState<'daily' | 'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);
  const [milestoneDialogInitialDate, setMilestoneDialogInitialDate] = useState<Date | undefined>(undefined);
  const [projectDialogStartDate, setProjectDialogStartDate] = useState<Date | undefined>(undefined);
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
  // NOTE: Kanban/Gantt for projects is deprecated (workflows replace it), but visual display still works
  // View permissions are now derived from project permissions
  const [canCreateProject, setCanCreateProject] = useState(false);
  const [canEditProject, setCanEditProject] = useState(false);
  const [canDeleteProject, setCanDeleteProject] = useState(false);
  const [canViewProjects, setCanViewProjects] = useState(false);
  const [canViewTable, setCanViewTable] = useState(false);
  const [canEditTable, setCanEditTable] = useState(false);
  const [canEditAccount, setCanEditAccount] = useState(false);

  // Derived view permissions (kanban/gantt views inherit from project view)
  const canViewKanban = canViewProjects;
  const canViewGantt = canViewProjects;
  const canEditKanban = canEditProject;
  const canEditGantt = canEditProject;
  const canMoveAllKanbanItems = canEditProject;

  // Load account members
  useEffect(() => {
    const loadAccountMembers = async () => {
      try {
        const response = await fetch(`/api/accounts/${account.id}/members`);
        
        // Get response text first to check if it's valid JSON
        const responseText = await response.text();
        let data: any;
        
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
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
            url: `/api/accounts/${account.id}/members`
          });
          // Set empty array if error - don't crash the page
          setAccountMembers([]);
          return;
        }
        
        // Success - set the members
        setAccountMembers(data.members || []);
      } catch (error: any) {
        console.error('Error loading account members:', {
          error: error.message || error,
          stack: error.stack
        });
        // Set empty array on error - don't crash the page
        setAccountMembers([]);
      }
    };
    
    loadAccountMembers();
  }, [account.id]);

  // Fetch remaining hours for all projects
  useEffect(() => {
    const fetchRemainingHours = async () => {
      if (!projects || projects.length === 0) return;
      
      setProjectsLoading(true);
      try {
        const supabase = createClientSupabase();
        if (!supabase) return;

        const projectIds = projects.map(p => p.id);
        const { data: tasksData } = await supabase
          .from('tasks')
          .select('project_id, remaining_hours, estimated_hours')
          .in('project_id', projectIds);

        if (tasksData) {
          // Calculate remaining hours and task sum per project
          const projectRemainingHours: Record<string, number> = {};
          const projectTaskSum: Record<string, number> = {};
          tasksData.forEach((task: any) => {
            if (!projectRemainingHours[task.project_id]) {
              projectRemainingHours[task.project_id] = 0;
            }
            if (!projectTaskSum[task.project_id]) {
              projectTaskSum[task.project_id] = 0;
            }
            projectRemainingHours[task.project_id] += (task.remaining_hours ?? task.estimated_hours ?? 0);
            projectTaskSum[task.project_id] += (task.estimated_hours ?? 0);
          });

          // Update projects with remaining hours and task sum
          setProjects(prevProjects =>
            prevProjects.map(project => ({
              ...project,
              remaining_hours: projectRemainingHours[project.id] ?? null,
              task_hours_sum: projectTaskSum[project.id] ?? 0
            }))
          );
        }
      } catch (error) {
        console.error('Error fetching remaining hours:', error);
      } finally {
        setProjectsLoading(false);
      }
    };

    fetchRemainingHours();
  }, [account.id]); // Re-fetch when account changes

  // Check permissions
  // NOTE: Kanban/Gantt permissions are deprecated - view permissions now derive from project permissions
  useEffect(() => {
    if (!userProfile) return;

    async function checkPermissions() {
      const create = await hasPermission(userProfile, Permission.CREATE_PROJECT, { accountId: account.id });
      const edit = await hasPermission(userProfile, Permission.EDIT_PROJECT, { accountId: account.id });
      const del = await hasPermission(userProfile, Permission.DELETE_PROJECT, { accountId: account.id });
      const viewProjects = await hasPermission(userProfile, Permission.VIEW_PROJECTS, { accountId: account.id });
      const viewTable = await hasPermission(userProfile, Permission.VIEW_TABLE);
      const editTable = await hasPermission(userProfile, Permission.EDIT_TABLE);
      const editAccount = await hasPermission(userProfile, Permission.EDIT_ACCOUNT, { accountId: account.id });

      setCanCreateProject(create);
      setCanEditProject(edit);
      setCanDeleteProject(del);
      setCanViewProjects(viewProjects);
      setCanViewTable(viewTable);
      setCanEditTable(editTable);
      setCanEditAccount(editAccount);

      // NOTE: Kanban/Gantt views for projects are deprecated (workflows replace them)
      // Only table view is now available - no view mode switching needed
    }

    checkPermissions();
  }, [userProfile, account.id, viewMode]);

  // Load milestones from database
  useEffect(() => {
    const loadMilestones = async () => {
      try {
        console.log('AccountOverview: Loading milestones...');
        const fetchedMilestones = await getMilestones();
        console.log('AccountOverview: Fetched milestones:', fetchedMilestones);
        setMilestones(fetchedMilestones);
      } catch (error) {
        console.error('Failed to load milestones:', error);
      }
    };

    loadMilestones();
  }, []);

  // Load active issues for this account
  useEffect(() => {
    const loadActiveIssues = async () => {
      setLoadingActiveIssues(true);
      try {
        const issues = await projectIssuesService.getAccountActiveIssues(account.id);
        setActiveIssues(issues);
      } catch (error) {
        console.error('Failed to load active issues:', error);
      } finally {
        setLoadingActiveIssues(false);
      }
    };

    loadActiveIssues();
  }, [account.id]);

  // Load finished projects for this account
  useEffect(() => {
    const loadFinishedProjects = async () => {
      setLoadingFinishedProjects(true);
      try {
        const supabase = createClientSupabase();
        if (!supabase) return;

        const { data, error } = await supabase
          .from('projects')
          .select(`
            *,
            account:accounts(id, name)
          `)
          .eq('account_id', account.id)
          .eq('status', 'complete')
          .order('completed_at', { ascending: false });

        if (error) {
          console.error('Failed to load finished projects:', error);
          return;
        }

        // Map to ProjectWithDetails format
        const finished = (data || []).map((p: any) => ({
          ...p,
          departments: [],
          daysUntilDeadline: null
        }));

        setFinishedProjects(finished);
      } catch (error) {
        console.error('Failed to load finished projects:', error);
      } finally {
        setLoadingFinishedProjects(false);
      }
    };

    loadFinishedProjects();
  }, [account.id]);

  // Handle issue status update
  const handleUpdateIssueStatus = async (issueId: string, projectId: string, newStatus: 'open' | 'in_progress' | 'resolved') => {
    // Optimistic update for immediate feedback
    const previousIssues = [...activeIssues];
    setActiveIssues(prev => prev.map(issue =>
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
        const issues = await projectIssuesService.getAccountActiveIssues(account.id);
        setActiveIssues(issues);
        toast.success(`Issue ${newStatus === 'resolved' ? 'resolved' : 'status updated'}`);
      } else {
        // Revert on error
        setActiveIssues(previousIssues);
        toast.error(result.error || 'Failed to update issue status');
      }
    } catch (error: any) {
      // Revert on error
      setActiveIssues(previousIssues);
      console.error('Error updating issue status:', error);
      toast.error(error.message || 'Failed to update issue status. Please try again.');
    }
  };

  // Load account-specific kanban configuration
  useEffect(() => {
    const loadKanbanConfig = async () => {
      try {
        const config = await accountKanbanConfigService.getOrCreateAccountKanbanConfig(account.id);
        setKanbanColumns(config.columns.sort((a, b) => a.order - b.order));
      } catch (error) {
        console.error('Error loading kanban config:', error);
        setKanbanColumns(DEFAULT_KANBAN_COLUMNS);
      } finally {
        setLoadingKanbanConfig(false);
      }
    };

    loadKanbanConfig();
  }, [account.id]);

  // Load custom column assignments from localStorage
  useEffect(() => {
    const loadCustomAssignments = () => {
      try {
        const stored = localStorage.getItem(`kanban-custom-assignments-${account.id}`);
        if (stored) {
          const assignments = JSON.parse(stored);
          console.log('Loaded custom column assignments from localStorage:', assignments);
          setCustomColumnAssignments(assignments);
        }
      } catch (error) {
        console.error('Error loading custom column assignments:', error);
      }
    };

    loadCustomAssignments();
  }, [account.id]);

  // Save custom column assignments to localStorage whenever they change
  useEffect(() => {
    if (Object.keys(customColumnAssignments).length > 0) {
      try {
        localStorage.setItem(`kanban-custom-assignments-${account.id}`, JSON.stringify(customColumnAssignments));
        console.log('Saved custom column assignments to localStorage:', customColumnAssignments);
      } catch (error) {
        console.error('Error saving custom column assignments:', error);
      }
    }
  }, [customColumnAssignments, account.id]);

  const handleKanbanColumnsUpdated = (newColumns: KanbanColumn[]) => {
    setKanbanColumns(newColumns.sort((a, b) => a.order - b.order));
  };

  const handleTaskCreated = (newProject: any, assignedUser?: any) => {
    if (newProject) {
      // Add the new project to local state immediately (optimistic update)
      // Don't use router.refresh() - it can cause CSS MIME type issues in Next.js dev mode
      const projectWithDetails: ProjectWithDetails = {
        ...newProject,
        departments: [],
        assigned_users: assignedUser ? [assignedUser] : [],
        status_info: { id: newProject.status || 'planning', name: 'Planning', color: '#6B7280' },
        workflow_step: null,
      };
      setProjects(prev => [projectWithDetails, ...prev]);
    }
  };

  // Helper functions to get status info
  const getStatusName = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'planning': 'Planning',
      'in_progress': 'In Progress',
      'review': 'Review',
      'complete': 'Complete',
      'on_hold': 'On Hold'
    };
    return statusMap[status] || 'Planning';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planning':
        return { backgroundColor: '#dbeafe', color: '#1e40af', borderColor: '#93c5fd' }
      case 'in_progress':
        return { backgroundColor: '#fef3c7', color: '#d97706', borderColor: '#fbbf24' }
      case 'review':
        return { backgroundColor: '#e9d5ff', color: '#7c3aed', borderColor: '#c4b5fd' }
      case 'complete':
        return { backgroundColor: '#d1fae5', color: '#059669', borderColor: '#6ee7b7' }
      case 'on_hold':
        return { backgroundColor: '#fee2e2', color: '#dc2626', borderColor: '#fca5a5' }
      default:
        return { backgroundColor: '#f3f4f6', color: '#374151', borderColor: '#d1d5db' }
    }
  }

  const getStatusColorString = (status: string) => {
    switch (status) {
      case 'planning':
        return '#3B82F6'
      case 'in_progress':
        return '#F59E0B'
      case 'review':
        return '#7c3aed'
      case 'complete':
        return '#059669'
      case 'on_hold':
        return '#dc2626'
      default:
        return '#6B7280'
    }
  }

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

  // Helper function to check if user can modify a specific project
  const canUserModifyProject = (project: ProjectWithDetails) => {
    // Full access users can modify any project
    if (hasFullAccess) return true;
    
    // Read-only users can only modify projects they're assigned to or are stakeholders on
    const isAssignedUser = project.assigned_user_id === userProfile.id;
    const isStakeholder = project.stakeholders?.some((s: any) => s.user_id === userProfile.id);
    
    return isAssignedUser || isStakeholder;
  };

  // Cache for project view permissions
  const [canViewProjectCache, setCanViewProjectCache] = useState<Record<string, boolean>>({});
  
  // Create stable project IDs string for dependency tracking
  const projectIdsString = useMemo(() => {
    return projects.map(p => p.id).sort().join(',');
  }, [projects]);
  
  // Pre-check view permissions for all projects
  useEffect(() => {
    if (!userProfile || projects.length === 0) {
      // Clear cache if no user or projects
      setCanViewProjectCache({});
      return;
    }
    
    const checkAllProjectPermissions = async () => {
      try {
        const permissions: Record<string, boolean> = {};
        
        console.log(`[Kanban] Checking permissions for ${projects.length} projects for user ${userProfile.id} in account ${account.id}`);
        
        // Check each project individually - user can view project page if:
        // 1. They have VIEW_ALL_PROJECTS permission, OR
        // 2. They are assigned to the project (via project_assignments, created_by, assigned_user_id, or tasks), OR
        // 3. They have account-level access AND are assigned to at least one project in the account
        
        for (const project of projects) {
          try {
            // Check project-specific access with account context
            // This allows account-level access to grant project access
            const canView = await checkPermissionHybrid(userProfile, Permission.VIEW_PROJECTS, { 
              projectId: project.id,
              accountId: account.id 
            });
            permissions[project.id] = canView;
            console.log(`[Kanban] ✓ Project "${project.name}" (${project.id.substring(0, 8)}...): canView=${canView}`);
          } catch (error) {
            console.error(`[Kanban] ✗ Error checking permission for project ${project.id}:`, error);
            // Default to false on error (won't show links for inaccessible projects)
            permissions[project.id] = false;
          }
        }
        
        console.log('[Kanban] ✅ Permission cache updated:', Object.keys(permissions).length, 'projects checked');
        console.log('[Kanban] Permission results:', permissions);
        setCanViewProjectCache(permissions);
      } catch (error) {
        console.error('[Kanban] ❌ Error checking project permissions:', error);
      }
    };
    
    checkAllProjectPermissions();
  }, [userProfile?.id, projectIdsString, account.id]);
  
  // Helper function to check if user can view a specific project
  const canUserViewProject = (project: ProjectWithDetails): boolean => {
    const cached = canViewProjectCache[project.id];
    if (cached === undefined) {
      // Not checked yet - return false to hide links (safer)
      return false;
    }
    return cached;
  };

  const handleDataChange = async (newKanbanData: any[]) => {
    try {
      console.log('Kanban data change triggered:', newKanbanData);
      console.log('Current projects:', projects);
      
      // Compare against the actual project status (from projects state) not kanbanData
      // because kanbanData might have already been updated by the drag library
      const changedItems = newKanbanData.filter((newItem) => {
        const project = projects.find(p => p.id === newItem.id);
        if (!project) return false;
        
        // Get the current kanban column for this project's status
        // First check if there's a custom assignment for this project
        const customAssignment = customColumnAssignments[project.id];
        const currentColumn = customAssignment || accountKanbanConfigService.getKanbanColumnForStatus(project.status, kanbanColumns);
        const hasChanged = currentColumn !== newItem.column;
        
        console.log('Checking project:', {
          id: newItem.id,
          name: newItem.name,
          projectStatus: project.status,
          customAssignment,
          currentColumn,
          newColumn: newItem.column,
          hasChanged
        });
        
        return hasChanged;
      });
      
      if (changedItems.length === 0) {
        console.log('No items changed columns');
        return;
      }
      
      console.log('Items that changed columns:', changedItems);
      
      // Process each changed item
      for (const movedItem of changedItems) {
        // Find the corresponding project
        const project = projects.find(p => p.id === movedItem.id);
        if (!project) {
          console.error('Project not found for moved item:', movedItem.id);
          continue;
        }
        
        // Check if user can modify this project
        if (!canUserModifyProject(project)) {
          console.warn('User does not have permission to modify this project');
          toast.error('You do not have permission to modify this project. You can only modify projects you are assigned to or are a stakeholder on.');
          continue;
        }
        
        // Check if this is a custom column (like "Approved") that should be visual-only
        const isCustomColumn = !['planned', 'in-progress', 'review', 'complete'].includes(movedItem.column);
        const customColumn = kanbanColumns.find(col => col.id === movedItem.column);
        const isApprovedColumn = customColumn?.name.toLowerCase().includes('approved') || customColumn?.name.toLowerCase().includes('approval');
        
        console.log('Drag and drop column detection:', {
          movedItemColumn: movedItem.column,
          isCustomColumn,
          customColumn: customColumn ? { id: customColumn.id, name: customColumn.name } : null,
          isApprovedColumn,
          availableColumns: kanbanColumns.map(col => ({ id: col.id, name: col.name }))
        });
        
        if (isCustomColumn && isApprovedColumn) {
          // For "Approved" columns, only store the visual assignment without changing database status
          console.log('Moving to custom Approved column - visual only, no database update');
          
          setCustomColumnAssignments(prev => ({
            ...prev,
            [movedItem.id]: movedItem.column
          }));
          
          console.log('Custom column assignment stored for Approved column:', movedItem.column);
        } else {
          // For standard columns, update the database status
          console.log('User can modify project, updating status in database');

          // Map the kanban column back to project status
          const newStatus = accountKanbanConfigService.getStatusForKanbanColumn(movedItem.column, kanbanColumns);
            console.log('Updating project status:', {
            projectId: movedItem.id,
            projectName: movedItem.name,
            oldStatus: project.status,
            newColumn: movedItem.column,
            newStatus: newStatus
          });

          // Update the project via API
          const response = await fetch(`/api/projects/${movedItem.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: newStatus as 'planning' | 'in_progress' | 'review' | 'complete' | 'on_hold'
            })
          });

          const result = await response.json();

          if (!response.ok) {
            console.error('Failed to update project status:', result.error);
            toast.error(result.error || 'Failed to update project status. Please try again.');
            return;
          }

          const updatedProject = result.project;

          if (updatedProject) {
            // Update local state with the new status
            setProjects(prevProjects =>
              prevProjects.map(p =>
                p.id === movedItem.id
                  ? { ...p, status: newStatus }
                  : p
              )
            );

            // Store the custom column assignment to maintain visual position
            setCustomColumnAssignments(prev => ({
              ...prev,
              [movedItem.id]: movedItem.column
            }));

            console.log('Project status updated successfully:', movedItem.name);
            console.log('Custom column assignment stored:', movedItem.column);
          } else {
            console.error('Failed to update project status');
            toast.error('Failed to update project status. Please try again.');
          }
        }
      }
      
    } catch (error) {
      console.error('Error in handleDataChange:', error);
      toast.error('Error updating project. Please try again.');
    }
  };

  const handleDeleteProject = (projectId: string) => {
    console.log('handleDeleteProject called with ID:', projectId);
    // Look in both active and finished projects
    const project = projects.find(p => p.id === projectId) || finishedProjects.find(p => p.id === projectId);
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

  const handleMoveProject = (project: ProjectWithDetails) => {
    setProjectToMove(project);
    setMoveDialogOpen(true);
  };

  const handleMoveProjectToStatus = async (projectId: string, newStatus: string) => {
    try {
      // Find the column that corresponds to this status
      const targetColumn = kanbanColumns.find(col => 
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
        
        const supabase = createClientSupabase();
        if (!supabase) return;

        const { error } = await supabase
          .from('projects')
          .update({ status: newStatus })
          .eq('id', projectId);

        if (error) {
          console.error('Error updating project status:', error);
          return;
        }

        // Update the local state
        setProjects(prevProjects => 
          prevProjects.map(project => 
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
    } catch (error) {
      console.error('Error moving project:', error);
    }
  };

  // Filter and sort projects (exclude completed - they show in Finished Projects section)
  const filteredAndSortedProjects = projects
    .filter(project => {
      // Exclude completed projects - they go to the Finished Projects section
      if (project.status === 'complete') return false;
      if (statusFilter !== 'all' && project.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && project.priority !== priorityFilter) return false;
      return true;
    })
    .sort((a, b) => {
      let aValue: any, bValue: any;
      
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
    .map(project => ({
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
          const filtered = prev.filter(p => p.id !== projectToDelete.id);
          console.log('Updated projects list:', filtered.length, 'projects remaining');
          return filtered;
        });
        // Also remove from finished projects
        setFinishedProjects(prev => {
          const filtered = prev.filter(p => p.id !== projectToDelete.id);
          console.log('Updated finished projects list:', filtered.length, 'projects remaining');
          return filtered;
        });
        console.log('Project deleted successfully');
      } else {
        console.error('Failed to delete project - service returned false');
        toast.error('Failed to delete project. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Error deleting project. Please try again.');
    } finally {
      // Close dialog and reset state
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    }
  };

  const handleProjectSelect = (projectId: string) => {
    setSelectedProject(selectedProject === projectId ? null : projectId);
  };

  const handleSidebarToggle = () => {
    setSidebarExpanded(!sidebarExpanded);
  };

  // Convert projects to Gantt features
  const convertProjectToGanttFeature = (project: ProjectWithDetails): GanttFeature => {
    // Parse dates - Supabase returns ISO strings
    const startDate = project.start_date ? new Date(project.start_date) : new Date();
    const endDate = project.end_date ? new Date(project.end_date) : addDays(startDate, 7);
    
    console.log('Converting project to Gantt feature:', {
      projectId: project.id,
      projectName: project.name,
      startDate_iso: project.start_date,
      endDate_iso: project.end_date,
      startDate_parsed: startDate.toISOString(),
      endDate_parsed: endDate.toISOString(),
      status: project.status
    });
    
    return {
      id: project.id,
      name: project.name || 'Unnamed Project',
      startAt: startDate,
      endAt: endDate,
      status: {
        id: project.status || 'planning',
        name: project.status_info?.name || getStatusName(project.status),
        color: project.status_info?.color || getStatusColorString(project.status)
      },
      lane: project.id  // Use project ID as lane to ensure each project gets its own row
    };
  };

  // Handle project date updates from Gantt chart
  const handleProjectMove = async (projectId: string, startAt: Date, endAt: Date | null) => {
    try {
      console.log('Moving project:', { projectId, startAt, endAt });
      
      // Find the project to check permissions
      const project = projects.find(p => p.id === projectId);
      if (!project) {
        console.error('Project not found:', projectId);
        return;
      }
      
      // Check if user can modify this project
      if (!canUserModifyProject(project)) {
        console.warn('User does not have permission to modify this project');
        toast.error('You do not have permission to modify this project. You can only modify projects you are assigned to or are a stakeholder on.');
        return;
      }
      
      // Update the project in the database
      const updatedProject = await accountService.updateProject(projectId, {
        start_date: startAt.toISOString(),
        end_date: endAt ? endAt.toISOString() : null,
      });

      if (updatedProject) {
        // Update local state
        setProjects(prevProjects => 
          prevProjects.map(project => 
            project.id === projectId 
              ? { 
                  ...project, 
                  start_date: startAt.toISOString(),
                  end_date: endAt ? endAt.toISOString() : null
                }
              : project
          )
        );
        console.log('Project dates updated successfully');
      } else {
        console.error('Failed to update project dates');
      }
    } catch (error) {
      console.error('Error updating project dates:', error);
    }
  };

  // Handle clicking on Gantt chart timeline to create project
  const handleAddProject = (date: Date) => {
    console.log('Gantt chart clicked at date for project creation:', date);
    setProjectDialogStartDate(date);
    setProjectDialogOpen(true);
  };

  // Handle project creation
  const handleProjectCreated = (newProject: any) => {
    if (newProject) {
      // Add the new project to local state immediately (optimistic update)
      const projectWithDetails: ProjectWithDetails = {
        ...newProject,
        departments: [],
        assigned_users: [],
        status_info: { id: newProject.status || 'planning', name: 'Planning', color: '#6B7280' },
        workflow_step: null,
      };
      setProjects(prev => [projectWithDetails, ...prev]);
    }
    setProjectDialogOpen(false);
  };

  // Filter projects for Gantt chart - exclude completed, read-only users only see their assigned projects
  const activeProjectsOnly = projects.filter(p => p.status !== 'complete');
  const filteredProjectsForGantt = hasFullAccess
    ? activeProjectsOnly
    : activeProjectsOnly.filter(canUserModifyProject);
  
  const ganttFeatures: GanttFeature[] = filteredProjectsForGantt.map(convertProjectToGanttFeature);
  
  // Function to scroll Gantt chart to today's marker using the same logic as scrollToFeature
  const scrollToToday = useCallback(() => {
    setTimeout(() => {
      // Access the Gantt context's scrollToFeature function if available
      // For now, we'll create a dummy feature at today's date and scroll to it
      const todayFeature: GanttFeature = {
        id: 'today-marker',
        name: 'Today',
        startAt: new Date(),
        endAt: new Date(),
        status: { id: 'today', name: 'Today', color: '#10B981' },
        lane: 'today'
      };
      
      // Trigger a custom event that the Gantt component can listen to
      const event = new CustomEvent('scrollToToday', { detail: todayFeature });
      window.dispatchEvent(event);
    }, 100);
  }, []);

  // NOTE: Gantt view is deprecated - these scroll effects are no longer needed
  // but keeping the variables to avoid breaking other code that references them

  const handleZoomIn = () => {
    setGanttZoom(prev => Math.min(prev + 50, 500));
  };

  const handleZoomOut = () => {
    setGanttZoom(prev => Math.max(prev - 50, 100));
  };

  const handleRangeChange = (range: 'daily' | 'monthly' | 'quarterly' | 'yearly') => {
    setGanttRange(range);
  };

  const handleCreateMilestone = (date: Date) => {
    setMilestoneDialogInitialDate(date);
    setMilestoneDialogOpen(true);
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
    } catch (error) {
      console.error('Failed to create milestone:', error);
      throw error; // Re-throw to let the dialog handle the error
    }
  };

  const handleRemoveMilestone = async (id: string) => {
    try {
      await deleteMilestone(id);
      setMilestones((prev) => prev.filter((m) => m.id !== id));
    } catch (error) {
      console.error('Failed to delete milestone:', error);
      toast.error('Failed to delete milestone. Please try again.');
    }
  };


  // Helper function to map project status to kanban column
  const getKanbanColumn = (status: string) => {
    return accountKanbanConfigService.getKanbanColumnForStatus(status, kanbanColumns);
  };

  // Convert projects to Kanban format
  const kanbanData = projects.map(project => {
    // Check if this project has a custom column assignment
    const customColumn = customColumnAssignments[project.id];
    const columnId = customColumn || getKanbanColumn(project.status);
    
    console.log('Mapping project to kanban:', {
      projectId: project.id,
      projectStatus: project.status,
      customColumn,
      mappedColumnId: columnId,
      availableColumns: kanbanColumns.map(c => c.id)
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
  console.log('Projects status mapping:', projects.map(p => ({
    id: p.id,
    name: p.name,
    status: p.status,
    mappedColumn: getKanbanColumn(p.status)
  })));

  // Convert projects to Gantt format
  const ganttData = projects.map(project => ({
    id: project.id,
    name: project.name,
    startAt: project.start_date ? new Date(project.start_date) : new Date(),
    endAt: project.end_date ? new Date(project.end_date) : new Date(),
    status: {
      id: project.status_info?.id || project.status,
      name: project.status_info?.name || getStatusName(project.status),
      color: project.status_info?.color || getStatusColorString(project.status),
    },
    lane: project.departments?.[0]?.name || 'General',
  }));

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
                  <h1 className="text-4xl font-bold text-foreground">{account.name}</h1>
                  <Badge variant={account.status === 'active' ? 'default' : 'secondary'} className="text-xs whitespace-nowrap w-fit">
                    {account.status}
                  </Badge>
                </div>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  {account.description || 'No description provided'}
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
                      accountId={account.id}
                      account={account}
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
                  {filteredAndSortedProjects.map((project) => (
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
                        <span className="text-sm text-gray-600">{account.name}</span>
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
                {activeIssues.map((issue) => (
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
                {urgentItems.map((item, index) => (
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
          accountId={account.id}
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
                  {finishedProjects.map((project) => (
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
                <p className="text-sm font-medium">{account.primary_contact_name || 'Not specified'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="text-sm font-medium">{account.primary_contact_email || 'No email'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="text-sm font-medium">{format(new Date(account.created_at), 'MMM dd, yyyy')}</p>
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
                  {accountMembers.map((member) => (
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
                              ? member.user.roles.map(r => r.name).join(', ')
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
                You are about to delete <span className="font-semibold text-gray-900">"{projectToDelete.name}"</span>.
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
        accountId={account.id}
        account={account}
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
                  {kanbanColumns.map((column) => {
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

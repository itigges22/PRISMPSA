'use client';

// Account overview component - updated to fix module resolution
import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
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
  const [viewMode, setViewMode] = useState<'kanban' | 'gantt' | 'table'>('kanban');
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

  // Delete Confirmation Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null);

  // Permission states
  const [canCreateProject, setCanCreateProject] = useState(false);
  const [canEditProject, setCanEditProject] = useState(false);
  const [canDeleteProject, setCanDeleteProject] = useState(false);
  const [canViewKanban, setCanViewKanban] = useState(false);
  const [canViewGantt, setCanViewGantt] = useState(false);
  const [canViewTable, setCanViewTable] = useState(false);
  const [canEditTable, setCanEditTable] = useState(false);
  const [canEditKanban, setCanEditKanban] = useState(false);
  const [canEditGantt, setCanEditGantt] = useState(false);
  const [canMoveAllKanbanItems, setCanMoveAllKanbanItems] = useState(false);
  const [canEditAccount, setCanEditAccount] = useState(false);

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
  useEffect(() => {
    if (!userProfile) return;
    
    async function checkPermissions() {
      const create = await hasPermission(userProfile, Permission.CREATE_PROJECT, { accountId: account.id });
      const edit = await hasPermission(userProfile, Permission.EDIT_PROJECT, { accountId: account.id });
      const del = await hasPermission(userProfile, Permission.DELETE_PROJECT, { accountId: account.id });
      const viewKanban = await hasPermission(userProfile, Permission.VIEW_KANBAN);
      const viewGantt = await hasPermission(userProfile, Permission.VIEW_GANTT);
      const viewTable = await hasPermission(userProfile, Permission.VIEW_TABLE);
      const editTable = await hasPermission(userProfile, Permission.EDIT_TABLE);
      const editKanban = await hasPermission(userProfile, Permission.EDIT_KANBAN_LAYOUT);
      const moveAllKanban = await hasPermission(userProfile, Permission.MOVE_ALL_KANBAN_ITEMS);
      const editGantt = await hasPermission(userProfile, Permission.EDIT_GANTT);
      const editAccount = await hasPermission(userProfile, Permission.EDIT_ACCOUNT, { accountId: account.id });
      
      setCanCreateProject(create);
      setCanEditProject(edit);
      setCanDeleteProject(del);
      setCanViewKanban(viewKanban);
      setCanViewGantt(viewGantt);
      setCanViewTable(viewTable);
      setCanEditTable(editTable);
      setCanEditKanban(editKanban);
      setCanMoveAllKanbanItems(moveAllKanban);
      setCanEditGantt(editGantt);
      setCanEditAccount(editAccount);
      
      // If user doesn't have permission for current view mode, switch to an allowed view
      if (viewMode === 'kanban' && !viewKanban) {
        // Try table if available, otherwise gantt
        if (viewTable) {
          setViewMode('table');
        } else if (viewGantt) {
          setViewMode('gantt');
        }
      }
      if (viewMode === 'gantt' && !viewGantt) {
        // Try table if available, otherwise kanban
        if (viewTable) {
          setViewMode('table');
        } else if (viewKanban) {
          setViewMode('kanban');
        }
      }
      if (viewMode === 'table' && !viewTable) {
        // Try kanban or gantt if available
        if (viewKanban) {
          setViewMode('kanban');
        } else if (viewGantt) {
          setViewMode('gantt');
        }
      }
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

  // Handle issue status update
  const handleUpdateIssueStatus = async (issueId: string, newStatus: 'open' | 'in_progress' | 'resolved') => {
    try {
      await projectIssuesService.updateIssueStatus(issueId, newStatus);
      
      // Reload active issues (will automatically filter out resolved ones)
      const issues = await projectIssuesService.getAccountActiveIssues(account.id);
      setActiveIssues(issues);
    } catch (error) {
      console.error('Error updating issue status:', error);
      alert('Failed to update issue status. Please try again.');
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
    // Reload the page to fetch complete project data including departments and stakeholders
    // This ensures all data is fresh and accurate from the database
    window.location.reload();
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
          alert('You do not have permission to modify this project. You can only modify projects you are assigned to or are a stakeholder on.');
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
            alert(result.error || 'Failed to update project status. Please try again.');
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
            alert('Failed to update project status. Please try again.');
          }
        }
      }
      
    } catch (error) {
      console.error('Error in handleDataChange:', error);
      alert('Error updating project. Please try again.');
    }
  };

  const handleDeleteProject = (projectId: string) => {
    console.log('handleDeleteProject called with ID:', projectId);
    const project = projects.find(p => p.id === projectId);
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

  // Filter and sort projects
  const filteredAndSortedProjects = projects
    .filter(project => {
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
        setProjects(prev => {
          const filtered = prev.filter(p => p.id !== projectToDelete.id);
          console.log('Updated projects list:', filtered.length, 'projects remaining');
          return filtered;
        });
        console.log('Project deleted successfully');
      } else {
        console.error('Failed to delete project - service returned false');
        alert('Failed to delete project. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Error deleting project. Please try again.');
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
        alert('You do not have permission to modify this project. You can only modify projects you are assigned to or are a stakeholder on.');
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
    console.log('New project created:', newProject);
    // Refresh projects list
    setProjects(prevProjects => [...prevProjects, newProject]);
    setProjectDialogOpen(false);
  };

  // Filter projects for Gantt chart - read-only users only see their assigned projects
  const filteredProjectsForGantt = hasFullAccess 
    ? projects 
    : projects.filter(canUserModifyProject);
  
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

  // Scroll to today when view mode changes or on initial load
  useEffect(() => {
    if (viewMode === 'gantt' && ganttFeatures.length > 0) {
      scrollToToday();
    }
  }, [viewMode, ganttFeatures.length, scrollToToday]);

  // Scroll to today whenever zoom or range changes
  useEffect(() => {
    if (viewMode === 'gantt' && ganttFeatures.length > 0) {
      scrollToToday();
    }
  }, [ganttZoom, ganttRange, viewMode, ganttFeatures.length, scrollToToday]);

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
      alert('Failed to delete milestone. Please try again.');
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
                {!hasFullAccess && (
                  <Badge variant="secondary" className="text-xs px-3 py-1">
                    Read-Only Access
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6 sm:space-y-8">
        {/* Account Info & Health Score */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Account Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Primary Contact</label>
                  <p className="text-sm">{account.primary_contact_name || 'Not specified'}</p>
                  <p className="text-sm text-muted-foreground">{account.primary_contact_email || 'No email'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Created</label>
                  <p className="text-sm">{format(new Date(account.created_at), 'MMM dd, yyyy')}</p>
                </div>
              </div>
              
              {/* Account Members Section */}
              {accountMembers.length > 0 && (
                <div className="mt-6 pt-4 border-t">
                  <label className="text-sm font-medium text-muted-foreground mb-3 block">Account Members</label>
                  <div className="space-y-3">
                    {accountMembers.map((member) => (
                      member.user && (
                        <div key={member.id} className="flex items-center justify-between p-3 bg-muted/30 rounded border">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarImage src={member.user.image || undefined} />
                              <AvatarFallback>
                                {member.user.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{member.user.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{member.user.email}</p>
                              {/* Show user roles */}
                              {member.user.roles && member.user.roles.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {member.user.roles.map((role) => (
                                    <Badge 
                                      key={role.id} 
                                      variant="secondary" 
                                      className="text-xs"
                                    >
                                      {role.name}
                                      {role.department && (
                                        <span className="text-muted-foreground ml-1">
                                          ({role.department.name})
                                        </span>
                                      )}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Health Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full ${getHealthScoreBg(metrics.healthScore)} mb-4`}>
                  <span className={`text-2xl font-bold ${getHealthScoreColor(metrics.healthScore)}`}>
                    {metrics.healthScore}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">Overall Health</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Key Metrics Card */}
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                  <Calendar className="w-8 h-8 text-green-600" />
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

        {/* Account Capacity Trends */}
        <CapacityDashboard
          userProfile={userProfile}
          mode="account"
          accountId={account.id}
        />

        {/* Active Issues & Roadblocks Card - Account Wide */}
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
                            onValueChange={(value) => handleUpdateIssueStatus(issue.id, value as 'open' | 'in_progress' | 'resolved')}
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

        {/* Urgent Items Card - Moved Above Projects */}
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

        {/* Main Content Area - Projects Only */}
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
                {/* View Mode Buttons and New Project Button */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {canViewKanban && (
                    <Button
                      variant={viewMode === 'kanban' ? 'default' : 'outline'}
                      onClick={() => setViewMode('kanban')}
                      className="flex items-center gap-2"
                      size="sm"
                    >
                      <Grid3X3 className="h-4 w-4" />
                      <span className="hidden sm:inline">Kanban</span>
                    </Button>
                    )}
                    {canViewGantt && (
                    <Button
                      variant={viewMode === 'gantt' ? 'default' : 'outline'}
                      onClick={() => setViewMode('gantt')}
                      className="flex items-center gap-2"
                      size="sm"
                    >
                      <GanttChart className="h-4 w-4" />
                      <span className="hidden sm:inline">Gantt</span>
                    </Button>
                    )}
                    {canViewTable && (
                    <Button
                      variant={viewMode === 'table' ? 'default' : 'outline'}
                      onClick={() => setViewMode('table')}
                      className="flex items-center gap-2"
                      size="sm"
                    >
                      <List className="h-4 w-4" />
                      <span className="hidden sm:inline">Table</span>
                    </Button>
                    )}
                  </div>
                  
                  {canCreateProject && (
                    <TaskCreationDialog 
                      onTaskCreated={handleTaskCreated}
                      accountId={account.id}
                      account={account}
                      userProfile={userProfile}
                      statusOptions={kanbanColumns.map((col, index) => ({
                        value: `${accountKanbanConfigService.getStatusForKanbanColumn(col.id, kanbanColumns)}_${index}`,
                        label: col.name,
                        color: col.color,
                        originalValue: accountKanbanConfigService.getStatusForKanbanColumn(col.id, kanbanColumns)
                      }))}
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
                
                {/* Filter and Sort Controls - Only show for table view */}
                {viewMode === 'table' && (
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
                        <SelectItem value="complete">Complete</SelectItem>
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
                )}
              </div>
              </div>
          </CardHeader>
          <CardContent>
            {viewMode === 'kanban' && canViewKanban && (
              <div className="space-y-4">
                {/* Configure Button - Only visible on Kanban tab if user has EDIT_KANBAN_LAYOUT permission */}
                {canEditKanban && (
                  <div className="flex justify-end">
                    <KanbanConfigDialog
                      accountId={account.id}
                      currentColumns={kanbanColumns}
                      onColumnsUpdated={handleKanbanColumnsUpdated}
                    >
                      <Button variant="outline" className="flex items-center gap-2" size="sm">
                        <Settings className="h-4 w-4" />
                        <span className="hidden sm:inline">Configure</span>
                      </Button>
                    </KanbanConfigDialog>
                  </div>
                )}
                
                <div className="h-[500px] sm:h-[600px] lg:h-[700px] overflow-hidden">
                  {loadingKanbanConfig ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-muted-foreground">Loading Kanban board...</div>
                    </div>
                  ) : (
                    <>
                      {/* Desktop Kanban View */}
                      <div className="hidden lg:block h-full overflow-x-auto">
                        <KanbanProvider
                          columns={kanbanColumns}
                          data={kanbanData}
                          onDataChange={canEditKanban ? handleDataChange : undefined}
                          className="h-full overflow-x-auto"
                        >
                          {(column) => (
                            <KanbanBoard id={column.id} key={column.id} className="min-w-[320px]">
                              <KanbanHeader className="p-4">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="h-2 w-2 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: column.color }}
                                  />
                                  <span className="font-medium text-base truncate">{column.name}</span>
                                  <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                                    {kanbanData.filter(item => item.column === column.id).length}
                                  </span>
                                </div>
                              </KanbanHeader>
                              <KanbanCards id={column.id} className="p-3 space-y-2">
                                {(item: any) => {
                                  const project = projects.find(p => p.id === item.id);
                                  // If user can move all items, only check edit permission
                                  // Otherwise, check if user is assigned to the project
                                  const isAssignedToProject = project ? canUserModifyProject(project) : false;
                                  const canMoveThisItem = canMoveAllKanbanItems || isAssignedToProject;
                                  const isDisabled = !canEditKanban || !canMoveThisItem;
                                  // Check if user can view this project page
                                  const canViewProject = project ? canUserViewProject(project) : false;
                                  // Check if we've checked permissions yet (to avoid graying out before check completes)
                                  const hasCheckedPermissions = project ? (canViewProjectCache[project.id] !== undefined) : false;
                                  
                                  // Only gray out if permissions have been checked AND user cannot view the project page
                                  // Cards are visible in Kanban (since user has account access), but grayed out if they can't view project page
                                  const shouldGrayOut = hasCheckedPermissions && !canViewProject;
                                  
                                  return (
                                  <KanbanCard
                                    column={column.id}
                                    id={item.id}
                                    key={item.id}
                                    name={item.name}
                                    className={`p-4 touch-manipulation select-none ${
                                      shouldGrayOut ? 'opacity-50 grayscale' : ''
                                    }`}
                                    disabled={isDisabled}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex flex-col gap-2 flex-1 min-w-0">
                                        <p className="m-0 font-medium text-base line-clamp-2">
                                          {item.name}
                                        </p>
                                        {item.description && (
                                          <p className="m-0 text-xs text-muted-foreground line-clamp-2">
                                            {item.description}
                                          </p>
                                        )}
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span
                                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                              item.priority === 'high'
                                                ? 'bg-red-100 text-red-800'
                                                : item.priority === 'medium'
                                                ? 'bg-yellow-100 text-yellow-800'
                                                : 'bg-green-100 text-green-800'
                                            }`}
                                          >
                                            {item.priority}
                                          </span>
                                        </div>
                                      </div>
                                      {item.owner && (
                                        <Avatar className="h-8 w-8 shrink-0">
                                          <AvatarImage src={item.owner.image} />
                                          <AvatarFallback className="text-xs">
                                            {item.owner.name?.slice(0, 2)}
                                          </AvatarFallback>
                                        </Avatar>
                                      )}
                                    </div>
                                    <p className="m-0 text-muted-foreground text-xs mt-2">
                                      {format(item.startAt, 'MMM dd')} - {format(item.endAt, 'MMM dd, yyyy')}
                                    </p>
                                    {/* Estimated & Remaining Hours */}
                                    {project && (project.estimated_hours || project.remaining_hours) && (
                                      <div className="flex items-center gap-3 mt-2 text-xs">
                                        {project.estimated_hours && (
                                          <div className="flex items-center gap-1 text-gray-600">
                                            <Clock className="w-3 h-3" />
                                            <span>{project.estimated_hours}h est</span>
                                          </div>
                                        )}
                                        {project.remaining_hours !== null && project.remaining_hours !== undefined && (
                                          <div className="flex items-center gap-1 text-blue-600 font-semibold">
                                            <Clock className="w-3 h-3" />
                                            <span>{project.remaining_hours.toFixed(1)}h left</span>
                                            {project.estimated_hours && (
                                              <span className="text-gray-500 font-normal">
                                                ({Math.round((1 - project.remaining_hours / project.estimated_hours) * 100)}%)
                                              </span>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    <div 
                                      className="flex items-center justify-between mt-2"
                                      onMouseDown={(e) => e.stopPropagation()}
                                      onTouchStart={(e) => e.stopPropagation()}
                                    >
                                      <div className="flex items-center gap-1">
                                        {canViewProject && (
                                          <Link href={`/projects/${item.id}`} passHref>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-6 w-6 p-0"
                                              title="View project details"
                                              onMouseDown={(e) => e.stopPropagation()}
                                              onTouchStart={(e) => e.stopPropagation()}
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <ExternalLink className="h-3 w-3" />
                                            </Button>
                                          </Link>
                                        )}
                                        {(() => {
                                          const project = projects.find(p => p.id === item.id);
                                          return project && canUserModifyProject(project) && (
                                            <>
                                              {canEditProject && (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  handleMoveProject(project);
                                                }}
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onTouchStart={(e) => e.stopPropagation()}
                                                className="text-green-600 hover:text-green-700 hover:bg-green-50 h-6 w-6 p-0"
                                                title="Move project"
                                              >
                                                <Move className="h-3 w-3" />
                                              </Button>
                                              )}
                                              {canDeleteProject && (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  handleDeleteProject(item.id);
                                                }}
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onTouchStart={(e) => e.stopPropagation()}
                                                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-6 w-6 p-0"
                                                title="Delete project"
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </Button>
                                              )}
                                            </>
                                          );
                                        })()}
                                      </div>
                                    </div>
                                  </KanbanCard>
                                  );
                                }}
                              </KanbanCards>
                            </KanbanBoard>
                          )}
                        </KanbanProvider>
                      </div>

                      {/* Mobile Kanban View - Vertical Stack */}
                      <div className="lg:hidden h-full overflow-y-auto">
                        <div className="space-y-4 p-4">
                          {kanbanColumns.map((column) => {
                            const columnItems = kanbanData.filter(item => item.column === column.id);
                            return (
                              <div key={column.id} className="bg-gray-50 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <div
                                    className="h-2 w-2 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: column.color }}
                                  />
                                  <span className="font-medium text-sm">{column.name}</span>
                                  <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                                    {columnItems.length}
                                  </span>
                                </div>
                                <div className="space-y-2">
                                  {columnItems.map((item: any) => {
                                    const project = projects.find(p => p.id === item.id);
                                    const isDisabled = project ? !canUserModifyProject(project) : false;
                                    const canViewProject = project ? canUserViewProject(project) : false;
                                    // Check if we've checked permissions yet (to avoid graying out before check completes)
                                    const hasCheckedPermissions = project ? (canViewProjectCache[project.id] !== undefined) : false;
                                    
                                    // Only gray out if permissions have been checked AND user cannot view the project page
                                    // Cards are visible in Kanban (since user has account access), but grayed out if they can't view project page
                                    const shouldGrayOut = hasCheckedPermissions && !canViewProject;
                                    
                                    return (
                                      <div
                                        key={item.id}
                                        className={`bg-white rounded-lg p-3 border ${
                                          shouldGrayOut ? 'opacity-50 grayscale' : ''
                                        }`}
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex flex-col gap-2 flex-1 min-w-0">
                                            <p className="m-0 font-medium text-sm line-clamp-2">
                                              {item.name}
                                            </p>
                                            {item.description && (
                                              <p className="m-0 text-xs text-muted-foreground line-clamp-2">
                                                {item.description}
                                              </p>
                                            )}
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span
                                                className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                                  item.priority === 'high'
                                                    ? 'bg-red-100 text-red-800'
                                                    : item.priority === 'medium'
                                                    ? 'bg-yellow-100 text-yellow-800'
                                                    : 'bg-green-100 text-green-800'
                                                }`}
                                              >
                                                {item.priority}
                                              </span>
                                            </div>
                                          </div>
                                          {item.owner && (
                                            <Avatar className="h-6 w-6 shrink-0">
                                              <AvatarImage src={item.owner.image} />
                                              <AvatarFallback className="text-xs">
                                                {item.owner.name?.slice(0, 2)}
                                              </AvatarFallback>
                                            </Avatar>
                                          )}
                                        </div>
                                        <p className="m-0 text-muted-foreground text-xs mt-2">
                                          {format(item.startAt, 'MMM dd')} - {format(item.endAt, 'MMM dd')}
                                        </p>
                                        <div className="flex items-center justify-between mt-2">
                                          <div className="flex items-center gap-1">
                                            {canViewProject && (
                                              <Link href={`/projects/${item.id}`} passHref>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-6 w-6 p-0"
                                                  title="View project details"
                                                >
                                                  <ExternalLink className="h-3 w-3" />
                                                </Button>
                                              </Link>
                                            )}
                                            {(() => {
                                              const project = projects.find(p => p.id === item.id);
                                              return project && canUserModifyProject(project) && canEditKanban && (
                                                <>
                                                  {canEditProject && (
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => {
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                      handleMoveProject(project);
                                                    }}
                                                    className="text-green-600 hover:text-green-700 hover:bg-green-50 h-6 w-6 p-0"
                                                    title="Move project"
                                                  >
                                                    <Move className="h-3 w-3" />
                                                  </Button>
                                                  )}
                                                  {canDeleteProject && (
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => {
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                      handleDeleteProject(item.id);
                                                    }}
                                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 h-6 w-6 p-0"
                                                    title="Delete project"
                                                  >
                                                    <Trash2 className="h-3 w-3" />
                                                  </Button>
                                                  )}
                                                </>
                                              );
                                            })()}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

                {viewMode === 'gantt' && canViewGantt && (
                  <div className="h-[500px] sm:h-[600px] lg:h-[700px] flex flex-col">
                    {/* Gantt Chart Header with Controls */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border-b bg-muted/30 flex-shrink-0">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <div>
                          <h3 className="text-lg font-semibold">Project Gantt Chart</h3>
                          <p className="text-xs text-muted-foreground">Click on timeline to add projects, hover to add milestones</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSidebarToggle}
                            className="h-8 w-8 p-0"
                            title={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
                          >
                            {sidebarExpanded ? '←' : '→'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleZoomOut}
                            className="h-8 w-8 p-0"
                          >
                            <ZoomOut className="h-4 w-4" />
                          </Button>
                          <span className="text-sm text-muted-foreground min-w-[3rem] text-center">
                            {ganttZoom}%
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleZoomIn}
                            className="h-8 w-8 p-0"
                          >
                            <ZoomIn className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant={ganttRange === 'daily' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleRangeChange('daily')}
                          className="h-8"
                        >
                          <CalendarDays className="h-4 w-4 mr-1" />
                          <span className="hidden sm:inline">Daily</span>
                        </Button>
                        <Button
                          variant={ganttRange === 'quarterly' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleRangeChange('quarterly')}
                          className="h-8"
                        >
                          <CalendarRange className="h-4 w-4 mr-1" />
                          <span className="hidden sm:inline">Quarterly</span>
                        </Button>
                        <Button
                          variant={ganttRange === 'monthly' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleRangeChange('monthly')}
                          className="h-8"
                        >
                          <Calendar className="h-4 w-4 mr-1" />
                          <span className="hidden sm:inline">Monthly</span>
                        </Button>
                      </div>
                    </div>

                    {/* Gantt Chart */}
                    <div className="flex-1" style={{ minHeight: 0 }}>
                      {ganttFeatures.length > 0 ? (
                        <GanttProvider 
                          range={ganttRange} 
                          zoom={ganttZoom} 
                          className="h-full border rounded-lg"
                          onAddItem={canEditGantt && canCreateProject ? handleAddProject : undefined}
                        >
                          <GanttSidebar className={`${sidebarExpanded ? 'min-w-[200px] sm:min-w-[250px] lg:min-w-[300px] max-w-[400px]' : 'min-w-[60px] max-w-[60px]'} transition-all duration-300`}>
                            <GanttSidebarGroup name="Projects">
                              {ganttFeatures.map((feature) => (
                                <GanttSidebarItem key={feature.id} feature={feature} />
                              ))}
                            </GanttSidebarGroup>
                          </GanttSidebar>
                          <GanttTimeline className="bg-background">
                            <GanttHeader className="bg-muted/50 border-b" />
                            <GanttFeatureList className="bg-background">
                              <GanttFeatureListGroup>
                                {ganttFeatures.map((feature) => (
                                  <GanttFeatureItem
                                    key={feature.id}
                                    {...feature}
                                    onMove={canEditGantt ? handleProjectMove : undefined}
                                  >
                                    <p className="flex-1 truncate text-xs">
                                      {feature.name}
                                    </p>
                                  </GanttFeatureItem>
                                ))}
                              </GanttFeatureListGroup>
                            </GanttFeatureList>
                            {(() => {
                              console.log('AccountOverview: Rendering milestones in Gantt chart:', milestones);
                              return milestones.map((milestone) => {
                                const milestoneColor = milestone.color || '#3b82f6';
                                console.log('AccountOverview: Rendering milestone:', { 
                                  id: milestone.id, 
                                  name: milestone.name, 
                                  date: milestone.date,
                                  parsedDate: new Date(milestone.date),
                                  color: milestoneColor 
                                });
                                
                                // Determine Tailwind class based on color
                                let colorClass = 'bg-blue-500 text-blue-900';
                                if (milestoneColor.includes('10b981')) colorClass = 'bg-green-500 text-green-900';
                                else if (milestoneColor.includes('f59e0b')) colorClass = 'bg-yellow-500 text-yellow-900';
                                else if (milestoneColor.includes('ef4444')) colorClass = 'bg-red-500 text-red-900';
                                else if (milestoneColor.includes('a855f7')) colorClass = 'bg-purple-500 text-purple-900';
                                else if (milestoneColor.includes('ec4899')) colorClass = 'bg-pink-500 text-pink-900';
                                else if (milestoneColor.includes('6366f1')) colorClass = 'bg-indigo-500 text-indigo-900';
                                else if (milestoneColor.includes('14b8a6')) colorClass = 'bg-teal-500 text-teal-900';
                                
                                return (
                                  <GanttMarker
                                    key={milestone.id}
                                    id={milestone.id}
                                    date={new Date(milestone.date)}
                                    label={milestone.name}
                                    className={`text-xs ${colorClass}`}
                                    onRemove={canEditGantt ? handleRemoveMilestone : undefined}
                                  />
                                );
                              });
                            })()}
                            <GanttToday className="bg-green-100 text-green-700 border-green-200" />
                            {canEditGantt && (
                              <GanttCreateMarkerTrigger onCreateMarker={handleCreateMilestone} />
                            )}
                          </GanttTimeline>
                        </GanttProvider>
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          <div className="text-center">
                            <GanttChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p className="text-lg font-medium mb-2">No projects to display</p>
                            <p className="text-sm">Create a project to see it in the Gantt chart</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {viewMode === 'table' && (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium text-gray-600">Project</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-600">Priority</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-600">Account</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-600">Est Hours</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-600">Remaining</th>
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
                              <Badge 
                                className="text-xs whitespace-nowrap border"
                                style={getStatusColor(project.status)}
                              >
                                {project.status.replace('_', ' ')}
                              </Badge>
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
                                {canEditTable && (canDeleteProject || (hasFullAccess && canDeleteProject)) && (
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
        statusOptions={kanbanColumns.map((col, index) => ({
          value: `${accountKanbanConfigService.getStatusForKanbanColumn(col.id, kanbanColumns)}_${index}`,
          label: col.name,
          color: col.color,
          originalValue: accountKanbanConfigService.getStatusForKanbanColumn(col.id, kanbanColumns)
        }))}
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

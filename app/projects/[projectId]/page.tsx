'use client'

import { useAuth } from '@/lib/hooks/useAuth'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RoleGuard } from '@/components/role-guard'
import { createClientSupabase } from '@/lib/supabase'
import { Database } from '@/lib/supabase'
import { ArrowLeft, Calendar, Clock, User, Building2, FolderOpen, Users, AlertCircle, FileText, AlertTriangle, Edit, Plus as PlusIcon, XCircle, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import TaskCreationDialog from '@/components/task-creation-dialog'
import TaskCreateEditDialog from '@/components/task-create-edit-dialog'
import { projectUpdatesService, ProjectUpdate } from '@/lib/project-updates-service'
import { projectIssuesService, ProjectIssue } from '@/lib/project-issues-service'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDistance } from 'date-fns'
import { accountService } from '@/lib/account-service'
import { taskServiceDB, Task } from '@/lib/task-service-db'
import { Permission } from '@/lib/permissions'
import { hasPermission } from '@/lib/rbac'
import { toast } from 'sonner'

type Project = Database['public']['Tables']['projects']['Row']
type Account = Database['public']['Tables']['accounts']['Row']
type Department = Database['public']['Tables']['departments']['Row']
type UserProfile = Database['public']['Tables']['user_profiles']['Row']

interface Stakeholder {
  id: string
  user_id: string
  role: string | null
  user_profiles: {
    id: string
    name: string
    email: string
    image: string | null
  } | null
}

interface ProjectWithDetails extends Project {
  account: Account
  departments: Department[]
  assigned_user: UserProfile | null
  stakeholders: Stakeholder[]
  updates?: string | null
  issues_roadblocks?: string | null
}

// Task item component - shows task details and progress
interface TaskItemProps {
  task: Task
  canEditTasks: boolean
  onEdit: (task: Task) => void
  onDelete: (taskId: string) => void
}

function TaskItem({
  task,
  canEditTasks,
  onEdit,
  onDelete
}: TaskItemProps) {
  // Calculate progress based on actual hours logged
  const actualHours = task.actual_hours || 0
  const estimatedHours = task.estimated_hours || 0
  const progressPercent = estimatedHours > 0 ? Math.min(100, Math.round((actualHours / estimatedHours) * 100)) : 0

  return (
    <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-gray-900">{task.name}</h4>
            <Badge className={`text-xs ${
              task.priority === 'urgent' ? 'bg-red-100 text-red-800' :
              task.priority === 'high' ? 'bg-orange-100 text-orange-800' :
              task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
              'bg-green-100 text-green-800'
            }`}>
              {task.priority}
            </Badge>
            <Badge className={`text-xs ${
              task.status === 'done' ? 'bg-green-100 text-green-800' :
              task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
              task.status === 'review' ? 'bg-purple-100 text-purple-800' :
              task.status === 'blocked' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {task.status.replace('_', ' ')}
            </Badge>
          </div>
          {task.description && (
            <p className="text-sm text-gray-600 mb-2">{task.description}</p>
          )}
          <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
            {task.created_by_user && (
              <span>Created by: {task.created_by_user.name}</span>
            )}
            {task.start_date && task.due_date && (
              <span>
                {new Date(task.start_date).toLocaleDateString()} - {new Date(task.due_date).toLocaleDateString()}
              </span>
            )}
            {task.estimated_hours && (
              <span>Est: {task.estimated_hours}h</span>
            )}
            {task.actual_hours > 0 && (
              <span>Actual: {task.actual_hours}h</span>
            )}
          </div>
          {task.estimated_hours !== null && task.estimated_hours > 0 && (
            <div className="flex flex-col gap-2 mt-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-700">
                  Time Logged
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-blue-600">
                    {actualHours.toFixed(1)}h
                  </span>
                  <span className="text-xs text-gray-500">
                    / {estimatedHours}h
                  </span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    progressPercent >= 100 ? 'bg-green-500' :
                    progressPercent >= 75 ? 'bg-blue-500' :
                    progressPercent >= 50 ? 'bg-yellow-500' :
                    'bg-gray-400'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>0h</span>
                <span className="font-medium">
                  {progressPercent}% complete
                </span>
                <span>{estimatedHours}h</span>
              </div>
            </div>
          )}
        </div>
        {canEditTasks && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(task)}
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(task.id)}
              className="text-red-600 hover:text-red-700"
            >
              <XCircle className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ProjectDetailPage() {
  const { userProfile } = useAuth()
  const params = useParams()
  const projectId = params.projectId as string
  const [project, setProject] = useState<ProjectWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [canEditProject, setCanEditProject] = useState(false)
  
  // Project Updates State
  const [projectUpdates, setProjectUpdates] = useState<ProjectUpdate[]>([])
  const [loadingUpdates, setLoadingUpdates] = useState(false)
  const [showNewUpdateForm, setShowNewUpdateForm] = useState(false)
  const [newUpdateContent, setNewUpdateContent] = useState('')
  const [submittingUpdate, setSubmittingUpdate] = useState(false)

  // Project Issues State
  const [projectIssues, setProjectIssues] = useState<ProjectIssue[]>([])
  const [loadingIssues, setLoadingIssues] = useState(false)
  const [showNewIssueForm, setShowNewIssueForm] = useState(false)
  const [newIssueContent, setNewIssueContent] = useState('')
  const [submittingIssue, setSubmittingIssue] = useState(false)

  // Task State
  const [tasks, setTasks] = useState<Task[]>([])
  const tasksRef = useRef<Task[]>([])

  // Helper to update tasks and ref atomically (prevents stale closure issues)
  const updateTasks = (updater: Task[] | ((prev: Task[]) => Task[])) => {
    setTasks(prev => {
      const newTasks = typeof updater === 'function' ? updater(prev) : updater
      tasksRef.current = newTasks
      return newTasks
    })
  }

  const [loadingTasks, setLoadingTasks] = useState(false)
  const [canViewTasks, setCanViewTasks] = useState(false)
  const [canCreateTasks, setCanCreateTasks] = useState(false)
  const [canEditTasks, setCanEditTasks] = useState(false)
  const [editTaskDialogOpen, setEditTaskDialogOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [calculatedEstimatedHours, setCalculatedEstimatedHours] = useState<number | null>(null)
  const [calculatedRemainingHours, setCalculatedRemainingHours] = useState<number | null>(null)

  // Project estimated hours state
  const [projectEstimatedHours, setProjectEstimatedHours] = useState<string>('')
  const [savingProjectHours, setSavingProjectHours] = useState(false)

  // Default status options matching the database schema
  const statusOptions = [
    { value: 'planning', label: 'Planning', color: '#6B7280', originalValue: 'planning' },
    { value: 'in_progress', label: 'In Progress', color: '#3B82F6', originalValue: 'in_progress' },
    { value: 'review', label: 'Review', color: '#F59E0B', originalValue: 'review' },
    { value: 'complete', label: 'Complete', color: '#10B981', originalValue: 'complete' },
    { value: 'on_hold', label: 'On Hold', color: '#EF4444', originalValue: 'on_hold' },
  ]

  // Check task permissions
  useEffect(() => {
    if (!userProfile) return
    
    async function checkPermissions() {
      const viewTasks = await hasPermission(userProfile, Permission.VIEW_TASKS, { projectId })
      const createTasks = await hasPermission(userProfile, Permission.CREATE_TASK, { projectId })
      const editTasks = await hasPermission(userProfile, Permission.EDIT_TASK, { projectId })
      
      setCanViewTasks(viewTasks)
      setCanCreateTasks(createTasks)
      setCanEditTasks(editTasks)
      
      // Load tasks if user can view them
      if (viewTasks) {
        loadTasks()
      }
    }
    
    checkPermissions()
  }, [userProfile, projectId])

  // Calculate estimated hours based on tasks
  const calculateEstimatedHours = (projectTasks: Task[], projectData?: ProjectWithDetails | null) => {
    if (projectTasks.length === 0) {
      // If no tasks, use project-level estimated_hours
      return projectData?.estimated_hours || project?.estimated_hours || null
    } else {
      // Sum up all task estimated_hours
      const total = projectTasks.reduce((sum, task) => {
        return sum + (task.estimated_hours || 0)
      }, 0)
      return total > 0 ? total : null
    }
  }

  // Calculate remaining hours based on tasks
  const calculateRemainingHours = (projectTasks: Task[]) => {
    if (projectTasks.length === 0) {
      return null
    }
    // Sum up all task remaining_hours
    const total = projectTasks.reduce((sum, task) => {
      return sum + (task.remaining_hours || 0)
    }, 0)
    return total
  }

  // Load tasks
  const loadTasks = async () => {
    if (!projectId) return
    
    setLoadingTasks(true)
    try {
      // Get tasks for this specific project
      const projectTasks = await taskServiceDB.getTasksByProject(projectId)
      updateTasks(projectTasks)
      
      // Calculate estimated and remaining hours based on tasks
      const calculatedHours = calculateEstimatedHours(projectTasks, project)
      const remainingHours = calculateRemainingHours(projectTasks)
      setCalculatedEstimatedHours(calculatedHours)
      setCalculatedRemainingHours(remainingHours)
    } catch (error) {
      console.error('Error loading tasks:', error)
    } finally {
      setLoadingTasks(false)
    }
  }

  useEffect(() => {
    const loadProject = async () => {
      if (!userProfile || !projectId) return

      try {
        setLoading(true)
        // ⚠️ Force create a FRESH Supabase client (not singleton) to ensure auth token is present
        const { createBrowserClient } = await import('@supabase/ssr')
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        // Verify auth session
        const { data: sessionData } = await supabase.auth.getSession()
        console.log('🔐 Auth check in loadProject:', {
          hasSession: !!sessionData.session,
          userId: sessionData.session?.user?.id,
          email: sessionData.session?.user?.email
        })

        // Fetch project with all related data
        const { data, error: queryError } = await supabase
          .from('projects')
          .select(`
            *,
            account:accounts(*)
          `)
          .eq('id', projectId)
          .single()

        if (queryError) {
          throw queryError
        }

        if (!data) {
          throw new Error('Project not found')
        }

        // Fetch assigned user details
        let assignedUser = null
        if (data.assigned_user_id) {
          const { data: userData } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', data.assigned_user_id)
            .single()
          assignedUser = userData
        }

        // Fetch stakeholders using SQL function (bypasses RLS - this is the reliable method)
        console.log('🔍 Fetching stakeholders for project via SQL function:', projectId)
        const { data: stakeholdersRawData, error: stakeholdersError } = await supabase
          .rpc('get_project_stakeholders', { project_uuid: projectId })

        console.log('📊 Stakeholders query result:', {
          dataLength: stakeholdersRawData?.length,
          error: stakeholdersError,
          errorDetails: stakeholdersError ? JSON.stringify(stakeholdersError) : null,
          data: stakeholdersRawData
        })

        // Transform SQL function output to match expected format
        const stakeholdersData = stakeholdersRawData?.map((row: any) => ({
          id: row.id,
          user_id: row.user_id,
          role: row.role,
          user_profiles: {
            id: row.user_id,
            name: row.user_name,
            email: row.user_email,
            image: row.user_image
          }
        })) || []

        // Get departments for this project via project_assignments
        const { data: assignments } = await supabase
          .from('project_assignments')
          .select(`
            user_id,
            user_roles!user_roles_user_id_fkey (
              role_id,
              roles!user_roles_role_id_fkey (
                department_id,
                departments!roles_department_id_fkey (
                  id,
                  name
                )
              )
            )
          `)
          .eq('project_id', projectId)
          .is('removed_at', null)

        const departments: any[] = []
        if (assignments) {
          assignments.forEach((assignment: any) => {
            const userRoles = assignment.user_roles || []
            userRoles.forEach((userRole: any) => {
              const role = userRole.roles
              if (role && role.departments) {
                const dept = role.departments
                const exists = departments.some((d: any) => d.id === dept.id)
                if (!exists) {
                  departments.push(dept)
                }
              }
            })
          })
        }

        // Transform the data to include all details
        const projectWithDetails: ProjectWithDetails = {
          ...data,
          departments: departments,
          assigned_user: assignedUser,
          stakeholders: stakeholdersData || []
        }

        // Debug logging
        console.log('Project loaded:', {
          id: projectWithDetails.id,
          name: projectWithDetails.name,
          description: projectWithDetails.description,
          estimated_hours: projectWithDetails.estimated_hours,
          actual_hours: projectWithDetails.actual_hours,
          stakeholders_count: projectWithDetails.stakeholders.length,
          departments_count: projectWithDetails.departments.length,
          updates: projectWithDetails.updates,
          issues_roadblocks: projectWithDetails.issues_roadblocks
        })

        setProject(projectWithDetails)

        // Check if user can edit this project
        if (userProfile?.id) {
          const canEdit = await accountService.canUserEditProject(userProfile.id, projectId)
          setCanEditProject(canEdit)
        }

        // Initialize estimated hours calculation (will be updated when tasks load)
        // If tasks haven't loaded yet, use project-level estimated_hours
        if (tasks.length === 0) {
          setCalculatedEstimatedHours(projectWithDetails.estimated_hours || null)
        }
      } catch (err) {
        console.error('Error loading project:', err)
        setError(err instanceof Error ? err.message : 'Failed to load project')
      } finally {
        setLoading(false)
      }
    }

    loadProject()
  }, [userProfile, projectId])

  // Handle task delete
  const handleDeleteTask = useCallback(async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) {
      return
    }

    try {
      const success = await taskServiceDB.deleteTask(taskId)
      if (success) {
        // Reload tasks
        await loadTasks()
      } else {
        alert('Failed to delete task')
      }
    } catch (error) {
      console.error('Error deleting task:', error)
      alert('Error deleting task')
    }
  }, [loadTasks])

  // Handle task edit
  const handleEditTask = useCallback((task: Task) => {
    setSelectedTask(task)
    setEditTaskDialogOpen(true)
  }, [])

  // Handle task updated
  const handleTaskUpdated = async () => {
    setEditTaskDialogOpen(false)
    setSelectedTask(null)
    await loadTasks()
  }

  // Save project estimated hours
  const handleSaveProjectEstimatedHours = async () => {
    if (!projectId || !projectEstimatedHours) return

    const hours = parseFloat(projectEstimatedHours)
    if (isNaN(hours) || hours <= 0) {
      toast.error('Please enter a valid number of hours')
      return
    }

    setSavingProjectHours(true)
    try {
      const supabase = createClientSupabase()
      if (!supabase) throw new Error('Failed to create Supabase client')

      // Calculate task sum
      const taskSum = tasks.reduce((sum, task) => sum + (task.estimated_hours || 0), 0)

      // Use the higher of entered hours or task sum
      const finalHours = taskSum > hours ? taskSum : hours

      const { error } = await supabase
        .from('projects')
        .update({
          estimated_hours: finalHours,
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId)

      if (error) throw error

      // Update local state
      setProject(prev => prev ? { ...prev, estimated_hours: finalHours } : null)
      setCalculatedEstimatedHours(finalHours)
      setProjectEstimatedHours('')

      if (finalHours !== hours) {
        toast.success(`Estimated hours set to ${finalHours}h (adjusted to match task sum)`)
      } else {
        toast.success(`Estimated hours set to ${finalHours}h`)
      }
    } catch (error) {
      console.error('Error saving project hours:', error)
      toast.error('Failed to save estimated hours')
    } finally {
      setSavingProjectHours(false)
    }
  }

  const handleProjectUpdated = async () => {
    setEditDialogOpen(false)
    
    console.log('[PAGE RELOAD] Project updated - reloading data (dialog has already verified data is synced)...')
    
    // The dialog has already polled and verified the data is in the database
    // So we can just fetch it immediately using the same method as initial page load
    const loadProject = async () => {
      if (!userProfile || !projectId) return

      try {
        setLoading(true)
        // Create a fresh Supabase client with auth
        const { createBrowserClient } = await import('@supabase/ssr')
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        // Fetch stakeholders using SQL function (same as initial load)
        console.log('[PAGE RELOAD] Fetching stakeholders via SQL function...')
        const { data: stakeholdersRawData, error: stakeholdersError } = await supabase
          .rpc('get_project_stakeholders', { project_uuid: projectId })

        console.log('[PAGE RELOAD] Stakeholders result:', {
          count: stakeholdersRawData?.length || 0,
          error: stakeholdersError
        })

        // Transform SQL function output
        const stakeholdersData = stakeholdersRawData?.map((row: any) => ({
          id: row.id,
          user_id: row.user_id,
          role: row.role,
          user_profiles: {
            id: row.user_id,
            name: row.user_name,
            email: row.user_email,
            image: row.user_image
          }
        })) || []

        // Fetch project with all related data
        const { data, error: queryError } = await supabase
          .from('projects')
          .select(`
            *,
            account:accounts(*)
          `)
          .eq('id', projectId)
          .single()

        if (queryError) {
          throw queryError
        }

        if (!data) {
          throw new Error('Project not found')
        }

        // Fetch assigned user details
        let assignedUser = null
        if (data.assigned_user_id) {
          const { data: userData } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', data.assigned_user_id)
            .single()
          assignedUser = userData
        }

        // Get departments for this project via project_assignments
        const { data: reloadAssignments } = await supabase
          .from('project_assignments')
          .select(`
            user_id,
            user_roles!user_roles_user_id_fkey (
              role_id,
              roles!user_roles_role_id_fkey (
                department_id,
                departments!roles_department_id_fkey (
                  id,
                  name
                )
              )
            )
          `)
          .eq('project_id', projectId)
          .is('removed_at', null)

        const reloadDepartments: any[] = []
        if (reloadAssignments) {
          reloadAssignments.forEach((assignment: any) => {
            const userRoles = assignment.user_roles || []
            userRoles.forEach((userRole: any) => {
              const role = userRole.roles
              if (role && role.departments) {
                const dept = role.departments
                const exists = reloadDepartments.some((d: any) => d.id === dept.id)
                if (!exists) {
                  reloadDepartments.push(dept)
                }
              }
            })
          })
        }

        // Transform the data to include all details
        const projectWithDetails: ProjectWithDetails = {
          ...data,
          departments: reloadDepartments,
          assigned_user: assignedUser,
          stakeholders: stakeholdersData || []
        }

        console.log('[PAGE RELOAD] Project reloaded after update:', {
          id: projectWithDetails.id,
          name: projectWithDetails.name,
          stakeholders_count: projectWithDetails.stakeholders.length,
          departments_count: projectWithDetails.departments.length,
          stakeholders: projectWithDetails.stakeholders
        })

        setProject(projectWithDetails)
      } catch (err) {
        console.error('[PAGE RELOAD] Error loading project:', err)
        setError(err instanceof Error ? err.message : 'Failed to load project')
      } finally {
        setLoading(false)
      }
    }
    
    await loadProject()
  }

  // Load project updates
  const loadProjectUpdates = async () => {
    if (!projectId) return

    setLoadingUpdates(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/updates`)
      const result = await response.json()

      if (response.ok) {
        setProjectUpdates(result.updates)
      } else {
        console.error('Error loading updates:', result.error)
      }
    } catch (error) {
      console.error('Error loading project updates:', error)
    } finally {
      setLoadingUpdates(false)
    }
  }

  // Load updates when project is loaded
  useEffect(() => {
    if (project) {
      loadProjectUpdates()
    }
  }, [project])

  // Submit new update
  const handleSubmitUpdate = async () => {
    if (!newUpdateContent.trim() || !projectId) return

    setSubmittingUpdate(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newUpdateContent.trim()
        })
      })

      const result = await response.json()

      if (response.ok) {
        // Reload updates
        await loadProjectUpdates()

        // Reset form
        setNewUpdateContent('')
        setShowNewUpdateForm(false)
      } else {
        alert(result.error || 'Failed to create update. Please try again.')
      }
    } catch (error) {
      console.error('Error creating update:', error)
      alert('Failed to create update. Please try again.')
    } finally {
      setSubmittingUpdate(false)
    }
  }

  // Load project issues
  const loadProjectIssues = async () => {
    if (!projectId) return

    setLoadingIssues(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/issues`)
      const result = await response.json()

      if (response.ok) {
        setProjectIssues(result.issues)
      } else {
        console.error('Error loading issues:', result.error)
      }
    } catch (error) {
      console.error('Error loading project issues:', error)
    } finally {
      setLoadingIssues(false)
    }
  }

  // Load issues when project is loaded
  useEffect(() => {
    if (project) {
      loadProjectIssues()
    }
  }, [project])

  // Submit new issue
  const handleSubmitIssue = async () => {
    if (!newIssueContent.trim() || !projectId) return

    setSubmittingIssue(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newIssueContent.trim()
        })
      })

      const result = await response.json()

      if (response.ok) {
        // Reload issues
        await loadProjectIssues()

        // Reset form
        setNewIssueContent('')
        setShowNewIssueForm(false)
      } else {
        alert(result.error || 'Failed to create issue. Please try again.')
      }
    } catch (error) {
      console.error('Error creating issue:', error)
      alert('Failed to create issue. Please try again.')
    } finally {
      setSubmittingIssue(false)
    }
  }

  // Update issue status
  const handleUpdateIssueStatus = async (issueId: string, newStatus: 'open' | 'in_progress' | 'resolved') => {
    try {
      const response = await fetch(`/api/projects/${projectId}/issues/${issueId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      const result = await response.json()

      if (response.ok) {
        await loadProjectIssues()
      } else {
        alert(result.error || 'Failed to update issue status. Please try again.')
      }
    } catch (error) {
      console.error('Error updating issue status:', error)
      alert('Failed to update issue status. Please try again.')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planning':
        return 'bg-yellow-100 text-yellow-800'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800'
      case 'review':
        return 'bg-purple-100 text-purple-800'
      case 'complete':
        return 'bg-green-100 text-green-800'
      case 'on_hold':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800'
      case 'high':
        return 'bg-orange-100 text-orange-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'low':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set'
    return new Date(dateString).toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading project...</p>
        </div>
      </div>
    )
  }

  if (error || !project) {
    notFound()
  }

  return (
    <RoleGuard>
      <div className="container mx-auto p-6 space-y-6">
        {/* Back Button */}
        <div className="mb-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/projects">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Projects
            </Link>
          </Button>
        </div>

        {/* Page Header */}
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
              {!canEditProject && (
                <span className="px-3 py-1 text-sm font-medium text-orange-800 bg-orange-100 rounded-full">
                  Read Only
                </span>
              )}
            </div>
            <p className="text-gray-600 mt-1">
              {canEditProject ? 'Project Details' : 'Project Details (Read Only)'}
            </p>
          </div>
        </div>

        {/* Edit Project Button - Only show if user can edit */}
        {canEditProject && (
          <div className="mb-4">
            <Button onClick={() => setEditDialogOpen(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Project
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tasks - Only show if user has VIEW_TASKS permission */}
            {canViewTasks && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FolderOpen className="w-5 h-5 text-blue-600" />
                        Tasks
                      </CardTitle>
                      <CardDescription>Manage project tasks and assignments</CardDescription>
                    </div>
                    {canCreateTasks ? (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          setSelectedTask(null)
                          setEditTaskDialogOpen(true)
                        }}
                      >
                        <PlusIcon className="w-4 h-4 mr-2" />
                        New Task
                      </Button>
                    ) : (
                      <span className="text-sm text-gray-500 italic">
                        Read-only access - cannot create tasks
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingTasks ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="text-sm text-gray-500 mt-2">Loading tasks...</p>
                    </div>
                  ) : tasks.length > 0 ? (
                    <div className="space-y-3">
                      {tasks.slice(0, 10).map((task) => (
                        <TaskItem
                          key={task.id}
                          task={task}
                          canEditTasks={canEditTasks}
                          onEdit={handleEditTask}
                          onDelete={handleDeleteTask}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No tasks yet. {canCreateTasks && 'Click "New Task" to create one.'}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Project Updates - Journal Style */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      Project Updates
                    </CardTitle>
                    <CardDescription>Track progress and milestones</CardDescription>
                  </div>
                  {canEditProject ? (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setShowNewUpdateForm(!showNewUpdateForm)}
                      disabled={submittingUpdate}
                    >
                      <PlusIcon className="w-4 h-4 mr-2" />
                      New Update
                    </Button>
                  ) : (
                    <span className="text-sm text-gray-500 italic">
                      Read-only access - cannot add updates
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* New Update Form - Only show if user can edit */}
                  {showNewUpdateForm && canEditProject && (
                    <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-1 block">
                            What's the latest update?
                          </label>
                          <Textarea
                            value={newUpdateContent}
                            onChange={(e) => setNewUpdateContent(e.target.value)}
                            placeholder="Share progress, milestones, changes, or any relevant information..."
                            rows={4}
                            className="resize-none"
                          />
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setShowNewUpdateForm(false)
                              setNewUpdateContent('')
                            }}
                            disabled={submittingUpdate}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleSubmitUpdate}
                            disabled={!newUpdateContent.trim() || submittingUpdate}
                          >
                            {submittingUpdate ? 'Posting...' : 'Post Update'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Updates List */}
                  {loadingUpdates ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="text-sm text-gray-500 mt-2">Loading updates...</p>
                    </div>
                  ) : projectUpdates.length > 0 ? (
                    <div className="space-y-4 relative">
                      {/* Timeline line */}
                      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />
                      
                      {projectUpdates.map((update, index) => (
                        <div key={update.id} className="relative flex gap-4">
                          {/* Avatar */}
                          <div className="flex-shrink-0 relative z-10">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                              <span className="text-white font-semibold text-sm">
                                {update.user_profiles?.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                              </span>
                            </div>
                          </div>

                          {/* Content */}
                          <div className="flex-1 bg-white border rounded-lg p-4 shadow-sm">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="font-medium text-gray-900">
                                  {update.user_profiles?.name || 'Unknown User'}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {formatDistance(new Date(update.created_at), new Date(), { addSuffix: true })}
                                </p>
                              </div>
                            </div>
                            <p className="text-gray-700 whitespace-pre-wrap text-sm">
                              {update.content}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No updates yet. Click "New Update" to add your first progress note.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Issues & Roadblocks - Journal Style */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-orange-600" />
                      Issues & Roadblocks
                    </CardTitle>
                    <CardDescription>Track and resolve project blockers</CardDescription>
                  </div>
                  {canEditProject ? (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setShowNewIssueForm(!showNewIssueForm)}
                      disabled={submittingIssue}
                    >
                      <PlusIcon className="w-4 h-4 mr-2" />
                      Report Issue
                    </Button>
                  ) : (
                    <span className="text-sm text-gray-500 italic">
                      Read-only access - cannot report issues
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* New Issue Form - Only show if user can edit */}
                  {showNewIssueForm && canEditProject && (
                    <div className="border-2 border-orange-200 rounded-lg p-4 bg-orange-50">
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-1 block">
                            What's blocking the project?
                          </label>
                          <Textarea
                            value={newIssueContent}
                            onChange={(e) => setNewIssueContent(e.target.value)}
                            placeholder="Describe the issue, roadblock, or challenge affecting the project..."
                            rows={4}
                            className="resize-none"
                          />
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setShowNewIssueForm(false)
                              setNewIssueContent('')
                            }}
                            disabled={submittingIssue}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleSubmitIssue}
                            disabled={!newIssueContent.trim() || submittingIssue}
                          >
                            {submittingIssue ? 'Reporting...' : 'Report Issue'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Issues List */}
                  {loadingIssues ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
                      <p className="text-sm text-gray-500 mt-2">Loading issues...</p>
                    </div>
                  ) : projectIssues.length > 0 ? (
                    <div className="space-y-4 relative">
                      {/* Timeline line */}
                      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />
                      
                      {projectIssues.map((issue) => (
                        <div key={issue.id} className="relative flex gap-4">
                          {/* Status Icon */}
                          <div className="flex-shrink-0 relative z-10">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              issue.status === 'resolved' 
                                ? 'bg-green-100' 
                                : issue.status === 'in_progress'
                                ? 'bg-yellow-100'
                                : 'bg-orange-100'
                            }`}>
                              {issue.status === 'resolved' ? (
                                <CheckCircle2 className="w-5 h-5 text-green-600" />
                              ) : (
                                <AlertTriangle className={`w-5 h-5 ${
                                  issue.status === 'in_progress' ? 'text-yellow-600' : 'text-orange-600'
                                }`} />
                              )}
                            </div>
                          </div>

                          {/* Content */}
                          <div className={`flex-1 border rounded-lg p-4 shadow-sm ${
                            issue.status === 'resolved' ? 'bg-green-50 border-green-200' : 'bg-white'
                          }`}>
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-medium text-gray-900">
                                    {issue.user_profiles?.name || 'Unknown User'}
                                  </p>
                                  <span className="text-xs text-gray-500">
                                    {formatDistance(new Date(issue.created_at), new Date(), { addSuffix: true })}
                                  </span>
                                </div>
                                <p className="text-gray-700 whitespace-pre-wrap text-sm mb-3">
                                  {issue.content}
                                </p>
                              </div>
                            </div>

                            {/* Status Selector - Only show if user can edit */}
                            {canEditProject ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-gray-500">Status:</span>
                                <Select
                                  value={issue.status}
                                  onValueChange={(value) => handleUpdateIssueStatus(issue.id, value as 'open' | 'in_progress' | 'resolved')}
                                >
                                  <SelectTrigger className="w-[150px] h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="open">Open</SelectItem>
                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="resolved">Resolved</SelectItem>
                                  </SelectContent>
                                </Select>
                                {issue.status === 'resolved' && issue.resolver_profiles && (
                                  <span className="text-xs text-green-600 ml-2">
                                    ✓ Resolved by {issue.resolver_profiles.name}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-gray-500">Status:</span>
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                  issue.status === 'resolved' 
                                    ? 'bg-green-100 text-green-800' 
                                    : issue.status === 'in_progress'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-orange-100 text-orange-800'
                                }`}>
                                  {issue.status.replace('_', ' ').toUpperCase()}
                                </span>
                                {issue.status === 'resolved' && issue.resolver_profiles && (
                                  <span className="text-xs text-green-600 ml-2">
                                    ✓ Resolved by {issue.resolver_profiles.name}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No issues reported yet. This is great!</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Metadata */}
          <div className="space-y-6">
            {/* Project Information */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Project Information</CardTitle>
                    <CardDescription>Key details and timeline</CardDescription>
                  </div>
                  {!canEditProject && (
                    <span className="px-2 py-1 text-xs font-medium text-orange-700 bg-orange-100 rounded">
                      Read Only
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-gray-500 uppercase">Status</p>
                    <Badge className={`${getStatusColor(project.status)} text-xs whitespace-nowrap`}>
                      {project.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-gray-500 uppercase">Priority</p>
                    <Badge className={`${getPriorityColor(project.priority)} text-xs whitespace-nowrap`}>
                      {project.priority.toUpperCase()}
                    </Badge>
                  </div>
                </div>
                
                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-500">Start Date</p>
                      <p className="text-sm font-semibold">{formatDate(project.start_date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-500">End Date / Deadline</p>
                      <p className="text-sm font-semibold">{formatDate(project.end_date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-500">Estimated Hours</p>
                      {(() => {
                        // Calculate task sum
                        const taskSum = tasks.reduce((sum, task) => sum + (task.estimated_hours || 0), 0)
                        const projectHours = project?.estimated_hours || 0
                        // Show the higher of project hours or task sum
                        const displayHours = taskSum > projectHours ? taskSum : projectHours

                        if (displayHours > 0) {
                          return (
                            <p className="text-sm font-semibold">
                              {displayHours.toFixed(1)}h
                              {taskSum > projectHours && projectHours > 0 && (
                                <span className="text-xs text-orange-600 ml-2">
                                  (task sum exceeds project estimate of {projectHours}h)
                                </span>
                              )}
                              {taskSum > 0 && taskSum <= projectHours && (
                                <span className="text-xs text-gray-500 ml-2">
                                  (lead time: {(projectHours - taskSum).toFixed(1)}h)
                                </span>
                              )}
                            </p>
                          )
                        } else if (canEditProject) {
                          return (
                            <div className="flex items-center gap-2 mt-1">
                              <Input
                                type="number"
                                value={projectEstimatedHours}
                                onChange={(e) => setProjectEstimatedHours(e.target.value)}
                                placeholder="Enter hours"
                                min="1"
                                className="w-24 h-7 text-sm"
                              />
                              <Button
                                size="sm"
                                onClick={handleSaveProjectEstimatedHours}
                                disabled={savingProjectHours || !projectEstimatedHours}
                                className="h-7 text-xs"
                              >
                                {savingProjectHours ? 'Saving...' : 'Save'}
                              </Button>
                            </div>
                          )
                        } else {
                          return <p className="text-sm text-gray-500 italic">Not specified</p>
                        }
                      })()}
                    </div>
                  </div>
                  {/* Progress - Calculated from task remaining hours */}
                  {(() => {
                    // Only show progress if there are tasks
                    if (tasks.length === 0) return null

                    const taskEstimatedSum = tasks.reduce((sum, task) => sum + (task.estimated_hours || 0), 0)

                    // Calculate remaining from task remaining_hours
                    // If task has remaining_hours set, use it; otherwise use estimated_hours
                    const taskRemainingSum = tasks.reduce((sum, task) => {
                      const remaining = task.remaining_hours !== null && task.remaining_hours !== undefined
                        ? task.remaining_hours
                        : (task.estimated_hours || 0)
                      return sum + remaining
                    }, 0)

                    const hoursWorked = Math.max(0, taskEstimatedSum - taskRemainingSum)
                    const remainingHours = taskRemainingSum
                    const progressPercent = taskEstimatedSum > 0 ? Math.round((hoursWorked / taskEstimatedSum) * 100) : 0

                    if (taskEstimatedSum > 0) {
                      return (
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-blue-500" />
                          <div className="flex-1">
                            <p className="text-xs font-medium text-gray-500">Progress</p>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-blue-600">
                                {remainingHours.toFixed(1)}h remaining
                              </p>
                              <span className="text-xs text-gray-500">
                                ({hoursWorked.toFixed(1)}h / {taskEstimatedSum.toFixed(1)}h worked)
                              </span>
                            </div>
                            {/* Progress bar */}
                            <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${
                                  progressPercent >= 100 ? 'bg-green-500' :
                                  progressPercent >= 75 ? 'bg-blue-500' :
                                  progressPercent >= 50 ? 'bg-yellow-500' : 'bg-gray-400'
                                }`}
                                style={{ width: `${Math.min(progressPercent, 100)}%` }}
                              />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{progressPercent}% complete</p>
                          </div>
                        </div>
                      )
                    }
                    return null
                  })()}
                </div>

                <div className="border-t pt-4 space-y-2">
                  <div>
                    <p className="text-xs font-medium text-gray-500">Created</p>
                    <p className="text-sm">{formatDate(project.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Last Updated</p>
                    <p className="text-sm">{formatDate(project.updated_at)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Team Members (Merged: Assigned To + Stakeholders) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="w-5 h-5" />
                  Team Members
                </CardTitle>
                <CardDescription>
                  {project.assigned_user || project.stakeholders.length > 0
                    ? `${1 + project.stakeholders.length} ${1 + project.stakeholders.length === 1 ? 'person' : 'people'} on this project`
                    : 'No team members assigned yet'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Assigned User (Primary) */}
                  {project.assigned_user ? (
                    <div className="flex items-center gap-3 p-3 rounded-md bg-blue-50 border border-blue-100">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-semibold text-sm">
                          {project.assigned_user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{project.assigned_user?.name || 'Unknown User'}</p>
                        <p className="text-xs text-blue-600 font-medium">Primary Owner</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-gray-400 italic py-2 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      <p>No primary owner assigned</p>
                    </div>
                  )}

                  {/* Stakeholders */}
                  {project.stakeholders.length > 0 ? (
                    <>
                      <div className="border-t pt-3">
                        <p className="text-xs font-medium text-gray-500 uppercase mb-2">Stakeholders</p>
                        <div className="space-y-2">
                          {project.stakeholders.map((stakeholder) => (
                            <div key={stakeholder.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 transition-colors">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center flex-shrink-0">
                                <span className="text-white font-semibold text-xs">
                                  {stakeholder.user_profiles?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '??'}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900">{stakeholder.user_profiles?.name || 'Unknown User'}</p>
                                {stakeholder.role && (
                                  <p className="text-xs text-gray-500 capitalize">
                                    {stakeholder.role.replace('_', ' ')}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : project.assigned_user && (
                    <p className="text-xs text-gray-500 italic text-center pt-2">No additional stakeholders</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Account & Departments (Merged) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="w-5 h-5" />
                  Account & Departments
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-2">Account</p>
                  <p className="text-base font-semibold">{project.account?.name || 'Unknown'}</p>
                </div>
                
                {project.departments.length > 0 ? (
                  <div className="border-t pt-4">
                    <p className="text-xs font-medium text-gray-500 uppercase mb-2">
                      Departments ({project.departments.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {project.departments.map((dept) => (
                        <Badge key={dept.id} variant="secondary" className="px-3 py-1">
                          {dept.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="border-t pt-4">
                    <div className="flex items-center gap-2 text-gray-400 italic text-sm">
                      <AlertCircle className="w-4 h-4" />
                      <p>No departments assigned</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Edit Project Dialog */}
        <TaskCreationDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onTaskCreated={handleProjectUpdated}
          accountId={project.account_id}
          account={project.account}
          userProfile={userProfile}
          statusOptions={statusOptions}
          editMode={true}
          existingProject={project}
        />

        {/* Task Create/Edit Dialog */}
        {project && (
          <TaskCreateEditDialog
            open={editTaskDialogOpen}
            onOpenChange={setEditTaskDialogOpen}
            projectId={project.id}
            task={selectedTask}
            onTaskSaved={handleTaskUpdated}
          />
        )}
      </div>
    </RoleGuard>
  )
}

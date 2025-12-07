'use client'

import { toast } from 'sonner';
import { useAuth } from '@/lib/hooks/useAuth'
import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RoleGuard } from '@/components/role-guard'
import { createClientSupabase } from '@/lib/supabase'
import { Database } from '@/lib/supabase'
import { FolderOpen, Calendar, Clock, User, Building2, SortAsc, SortDesc, ExternalLink, Trash2, Loader2, Plus } from 'lucide-react'
import ProjectCreationDialog from '@/components/project-creation-dialog'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import Link from 'next/link'
import { format } from 'date-fns'
import { hasPermission, canViewProject, isSuperadmin } from '@/lib/rbac'
import { Permission } from '@/lib/permissions'

type Project = Database['public']['Tables']['projects']['Row']
type Account = Database['public']['Tables']['accounts']['Row']
type Department = Database['public']['Tables']['departments']['Row']

interface ProjectWithDetails extends Project {
  account: Account
  departments: Department[]
  workflow_step?: string | null  // Current workflow step name
}


export default function ProjectsPage() {
  const { userProfile } = useAuth()
  const [projects, setProjects] = useState<ProjectWithDetails[]>([])
  const [visibleProjects, setVisibleProjects] = useState<ProjectWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Status filter removed - projects now use workflow steps instead of static status
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [departmentFilter, setDepartmentFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'name' | 'priority' | 'deadline'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [allDepartments, setAllDepartments] = useState<Department[]>([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<ProjectWithDetails | null>(null)
  const [deletingProject, setDeletingProject] = useState(false)
  const [canCreateProject, setCanCreateProject] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // Handle project creation - simple optimistic update
  const handleProjectCreated = useCallback((newProject: any) => {
    if (newProject) {
      const projectWithDetails: ProjectWithDetails = {
        ...newProject,
        account: newProject.account || { id: newProject.account_id, name: 'Loading...' },
        departments: [],
        workflow_step: null,
      }
      // Add directly to visibleProjects for immediate visibility
      setVisibleProjects(prev => [projectWithDetails, ...prev])
    }
    // Trigger background refresh after 500ms to get complete data
    setTimeout(() => {
      setRefreshKey(prev => prev + 1)
    }, 500)
  }, [])

  // Check create project permission
  useEffect(() => {
    if (!userProfile) return;
    hasPermission(userProfile, Permission.CREATE_PROJECT).then(setCanCreateProject);
  }, [userProfile]);

  useEffect(() => {
    const loadProjects = async () => {
      if (!userProfile) return

      try {
        setLoading(true)
        const supabase = createClientSupabase()
        if (!supabase) {
          throw new Error('Failed to create Supabase client')
        }

        // Get projects where user has access:
        // 1. Superadmins see all projects
        // 2. Projects they created
        // 3. Projects they're directly assigned to (assigned_user_id)
        // 4. Projects they're in via project_assignments
        // 5. Projects where they have tasks assigned

        // Check if user is superadmin (bypasses all permission checks)
        const userIsSuperadmin = isSuperadmin(userProfile)

        // Check if user has VIEW_ALL_PROJECTS permission using proper permission check
        const hasViewAllProjects = userIsSuperadmin || await hasPermission(userProfile, Permission.VIEW_ALL_PROJECTS)

        // First, get projects the user created or is directly assigned to
        let projectIds: string[] = []

        // Only need to gather project IDs if user doesn't have VIEW_ALL_PROJECTS
        if (!hasViewAllProjects) {
          // Get projects created by user or assigned to user
          const { data: directProjects } = await supabase
            .from('projects')
            .select('id')
            .or(`created_by.eq.${userProfile.id},assigned_user_id.eq.${userProfile.id}`)

          if (directProjects) {
            projectIds.push(...directProjects.map((p: { id: string }) => p.id))
          }

          // Get projects via project_assignments
          const { data: assignedProjects } = await supabase
            .from('project_assignments')
            .select('project_id')
            .eq('user_id', userProfile.id)
            .is('removed_at', null)

          if (assignedProjects) {
            projectIds.push(...assignedProjects.map((p: { project_id: string }) => p.project_id))
          }

          // Get projects where user has tasks
          const { data: taskProjects } = await supabase
            .from('tasks')
            .select('project_id')
            .eq('assigned_to', userProfile.id)

          if (taskProjects) {
            projectIds.push(...taskProjects.map((t: { project_id: string }) => t.project_id))
          }

          // Remove duplicates
          projectIds = Array.from(new Set(projectIds))
        }

        // Build query
        let query = supabase
          .from('projects')
          .select(`
            *,
            account:accounts(*)
          `)

        // Filter by accessible projects unless user has VIEW_ALL_PROJECTS or is superadmin
        if (!hasViewAllProjects && projectIds.length > 0) {
          query = query.in('id', projectIds)
        } else if (!hasViewAllProjects && projectIds.length === 0) {
          // No accessible projects
          query = query.eq('id', '00000000-0000-0000-0000-000000000000')
        }

        // Exclude completed projects - they go to "Finished Projects" on account page
        query = query.neq('status', 'complete')

        const { data, error: queryError } = await query

        if (queryError) {
          throw queryError
        }

        // Get departments for each project via project_assignments
        const fetchedProjectIds = (data || []).map((p: any) => p.id)
        const departmentsByProject: { [key: string]: any[] } = {}

        if (fetchedProjectIds.length > 0) {
          // First, get all project assignments to get user_ids
          const { data: assignments } = await supabase
            .from('project_assignments')
            .select('project_id, user_id')
            .in('project_id', fetchedProjectIds)
            .is('removed_at', null)

          if (assignments && assignments.length > 0) {
            // Get unique user IDs
            const userIds = Array.from(new Set(assignments.map((a: any) => a.user_id)))

            // Get user roles with department info for these users
            const { data: userRoles } = await supabase
              .from('user_roles')
              .select(`
                user_id,
                roles!user_roles_role_id_fkey (
                  department_id,
                  departments!roles_department_id_fkey (
                    id,
                    name
                  )
                )
              `)
              .in('user_id', userIds)

            // Build a map of user_id to departments
            const userDepartments: { [key: string]: any[] } = {}
            if (userRoles) {
              userRoles.forEach((ur: any) => {
                if (!userDepartments[ur.user_id]) {
                  userDepartments[ur.user_id] = []
                }
                const role = ur.roles
                if (role && role.departments) {
                  const dept = role.departments
                  const exists = userDepartments[ur.user_id].some((d: any) => d.id === dept.id)
                  if (!exists) {
                    userDepartments[ur.user_id].push(dept)
                  }
                }
              })
            }

            // Map departments to projects based on assigned users
            assignments.forEach((assignment: any) => {
              const projectId = assignment.project_id
              const userId = assignment.user_id

              if (!departmentsByProject[projectId]) {
                departmentsByProject[projectId] = []
              }

              const depts = userDepartments[userId] || []
              depts.forEach((dept: any) => {
                const exists = departmentsByProject[projectId].some((d: any) => d.id === dept.id)
                if (!exists) {
                  departmentsByProject[projectId].push(dept)
                }
              })
            })
          }
        }

        // Get workflow step info for each project
        const workflowSteps: { [key: string]: string | null } = {}
        if (fetchedProjectIds.length > 0) {
          const { data: workflowData } = await supabase
            .from('workflow_instances')
            .select(`
              project_id,
              current_node_id,
              workflow_nodes!workflow_instances_current_node_id_fkey (
                label
              )
            `)
            .in('project_id', fetchedProjectIds)
            .eq('status', 'active')

          if (workflowData) {
            workflowData.forEach((wi: any) => {
              if (wi.project_id) {
                workflowSteps[wi.project_id] = wi.workflow_nodes?.label || null
              }
            })
          }
        }

        // Transform the data to include departments and workflow step
        const projectsWithDetails: ProjectWithDetails[] = (data || []).map((project: any) => ({
          ...project,
          departments: departmentsByProject[project.id] || [],
          workflow_step: workflowSteps[project.id] || null
        }))

        setProjects(projectsWithDetails)

        // Extract unique departments from all projects for the filter dropdown
        const departmentsMap = new Map<string, Department>()
        projectsWithDetails.forEach(project => {
          project.departments.forEach(dept => {
            if (!departmentsMap.has(dept.id)) {
              departmentsMap.set(dept.id, dept)
            }
          })
        })
        setAllDepartments(Array.from(departmentsMap.values()).sort((a, b) => a.name.localeCompare(b.name)))
      } catch (err) {
        console.error('Error loading projects:', err)
        setError(err instanceof Error ? err.message : 'Failed to load projects')
      } finally {
        setLoading(false)
      }
    }

    loadProjects()
  }, [userProfile, refreshKey])

  // Filter projects based on permissions - ONLY runs on login or explicit refresh
  // This prevents race conditions with optimistic updates
  useEffect(() => {
    if (!userProfile || loading) return

    if (projects.length === 0) {
      setVisibleProjects([])
      return
    }

    async function filterProjects() {
      const filtered: ProjectWithDetails[] = []
      const hasViewAllProjects = await hasPermission(userProfile, Permission.VIEW_ALL_PROJECTS)
      const hasViewProjects = await hasPermission(userProfile, Permission.VIEW_PROJECTS)

      for (const project of projects) {
        if (hasViewAllProjects) {
          filtered.push(project)
          continue
        }

        if (hasViewProjects) {
          const canView = await canViewProject(userProfile, project.id)
          if (canView) {
            filtered.push(project)
          }
        }
      }

      setVisibleProjects(filtered)
    }

    filterProjects()
  }, [userProfile, refreshKey, loading])  // NOT [projects] - prevents race conditions

  // Status colors removed - projects now use workflow steps

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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set'
    return new Date(dateString).toLocaleDateString()
  }

  // Check if user can delete a project
  const canDeleteProject = async (project: ProjectWithDetails): Promise<boolean> => {
    if (!userProfile) return false

    // Check if user has DELETE_ALL_PROJECTS permission (override)
    const hasDeleteAll = await hasPermission(userProfile, Permission.DELETE_ALL_PROJECTS)
    if (hasDeleteAll) return true

    // Check if user has DELETE_PROJECT permission
    const hasDelete = await hasPermission(userProfile, Permission.DELETE_PROJECT)
    if (!hasDelete) return false

    // If user has DELETE_PROJECT, check if they have access to this project
    // (they should, since it's in their visible projects list)
    return visibleProjects.some(p => p.id === project.id)
  }

  // Handle project deletion
  const handleDeleteProject = async () => {
    if (!projectToDelete || !userProfile) return

    try {
      setDeletingProject(true)

      // Double-check permissions
      const canDelete = await canDeleteProject(projectToDelete)
      if (!canDelete) {
        toast.error('You do not have permission to delete this project')
        return
      }

      const supabase = createClientSupabase()
      if (!supabase) {
        throw new Error('Failed to create Supabase client')
      }

      // Delete the project
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectToDelete.id)

      if (error) {
        throw error
      }

      // Update local state to remove the deleted project
      setProjects(projects.filter(p => p.id !== projectToDelete.id))
      setVisibleProjects(visibleProjects.filter(p => p.id !== projectToDelete.id))

      // Close dialog and reset state
      setDeleteDialogOpen(false)
      setProjectToDelete(null)
    } catch (error: any) {
      console.error('Error deleting project:', error)
      toast.error(`Failed to delete project: ${error.message}`)
    } finally {
      setDeletingProject(false)
    }
  }

  // Open delete confirmation dialog
  const openDeleteDialog = (project: ProjectWithDetails) => {
    setProjectToDelete(project)
    setDeleteDialogOpen(true)
  }

  // Filter and sort projects (use visibleProjects which are already permission-filtered)
  const filteredAndSortedProjects = visibleProjects
    .filter(project => {
      // Status filter removed - projects now use workflow steps
      if (priorityFilter !== 'all' && project.priority !== priorityFilter) return false
      if (departmentFilter !== 'all' && !project.departments.some(dept => dept.id === departmentFilter)) return false
      return true
    })
    .sort((a, b) => {
      let aValue: any, bValue: any

      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case 'priority':
          const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 }
          aValue = priorityOrder[a.priority as keyof typeof priorityOrder] || 0
          bValue = priorityOrder[b.priority as keyof typeof priorityOrder] || 0
          break
        case 'deadline':
          aValue = a.end_date ? new Date(a.end_date).getTime() : 0
          bValue = b.end_date ? new Date(b.end_date).getTime() : 0
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
    .map(project => ({
      ...project,
      daysUntilDeadline: project.end_date 
        ? Math.ceil((new Date(project.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        : null
    }))

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading projects...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Error</h1>
          <p className="text-gray-600 mt-2">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <RoleGuard>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
            <p className="text-gray-600 mt-1">
              View and manage all projects
            </p>
          </div>
          {canCreateProject && (
            <ProjectCreationDialog
              onProjectCreated={handleProjectCreated}
            >
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Project
              </Button>
            </ProjectCreationDialog>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5" />
              Project Management
            </CardTitle>
            <CardDescription>
              All projects you have access to
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
                {visibleProjects.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <FolderOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Projects Found</h3>
                    <p className="text-sm">You don&apos;t have access to any projects yet, or no projects have been created.</p>
                  </div>
                ) : (
                  <>
                    {/* Filters and Sorting */}
                <div className="flex flex-wrap gap-2">
                  {/* Status filter removed - projects now use workflow steps */}

                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className="w-[140px]">
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

                  <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {allDepartments.map(dept => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={sortBy} onValueChange={(value: 'name' | 'priority' | 'deadline') => setSortBy(value)}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Name</SelectItem>
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

                {/* Projects Table */}
                <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Project</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Workflow Step</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Priority</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Account</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Departments</th>
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
                              <p className="text-sm text-gray-600 truncate max-w-xs">
                                {project.description}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {project.workflow_step ? (
                            <Badge
                              className="text-xs whitespace-nowrap border bg-blue-100 text-blue-800 border-blue-300"
                            >
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
                          <span className="text-sm text-gray-600">{project.account?.name || 'Unknown'}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {project.departments.length > 0 ? (
                              project.departments.map(dept => (
                                <Badge
                                  key={dept.id}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {dept.name}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-sm text-gray-400">No departments</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {project.end_date ? (
                            <div>
                              <p className="text-sm text-gray-900">
                                {format(new Date(project.end_date), 'MMM dd, yyyy')}
                              </p>
                              {project.daysUntilDeadline !== null && (
                                <p className={`text-xs ${
                                  project.daysUntilDeadline < 0 
                                    ? 'text-red-600' 
                                    : project.daysUntilDeadline <= 7 
                                      ? 'text-yellow-600' 
                                      : 'text-gray-600'
                                }`}>
                                  {project.daysUntilDeadline < 0 
                                    ? `${Math.abs(project.daysUntilDeadline)} days overdue`
                                    : `${project.daysUntilDeadline} days left`
                                  }
                                </p>
                              )}
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
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={async () => {
                                const canDelete = await canDeleteProject(project)
                                if (canDelete) {
                                  openDeleteDialog(project)
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
                  </>
                )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the project "{projectToDelete?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)
                setProjectToDelete(null)
              }}
              disabled={deletingProject}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteProject}
              disabled={deletingProject}
            >
              {deletingProject ? 'Deleting...' : 'Delete Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleGuard>
  )
}

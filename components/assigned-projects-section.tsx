'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  FolderOpen,
  AlertCircle,
  Building2,
  Users,
  Calendar,
  Clock,
  ArrowRight,
  SortAsc,
  SortDesc,
  ExternalLink
} from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'
import { hasPermission, canViewProject } from '@/lib/rbac'
import { Permission } from '@/lib/permissions'
import { useProjects } from '@/lib/hooks/use-data'
import { createClientSupabase } from '@/lib/supabase'

interface ProjectWithDetails {
  id: string;
  name: string;
  description: string | null;
  account_id: string;
  status: string;
  priority: string;
  start_date: string | null;
  end_date: string | null;
  estimated_hours: number | null;
  actual_hours: number;
  remaining_hours?: number | null; // Added for capacity tracking
  task_hours_sum?: number; // Sum of task estimated hours
  created_by: string;
  assigned_user_id: string | null;
  created_at: string;
  updated_at: string;
  account?: {
    id: string;
    name: string;
  } | null;
  departments: any[];
  workflow_step?: string | null;
  daysUntilDeadline?: number | null;
}

interface AssignedProjectsSectionProps {
  userProfile: any;
}

export function AssignedProjectsSection({ userProfile }: AssignedProjectsSectionProps) {
  // Use SWR hook for automatic caching and deduplication
  const { projects: assignedProjects, isLoading: projectsLoading, error: projectsError } = useProjects(userProfile?.id, 10)
  const [visibleProjects, setVisibleProjects] = useState<ProjectWithDetails[]>([])
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'name' | 'priority' | 'deadline'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [workflowSteps, setWorkflowSteps] = useState<{ [key: string]: string | null }>({})
  const router = useRouter()

  // Stabilize project IDs to prevent infinite loops from SWR array reference changes
  const projectIds = useMemo(
    () => assignedProjects.map((p: ProjectWithDetails) => p.id).join(','),
    [assignedProjects]
  )

  // Filter projects based on permissions - OPTIMIZED: Batch permission checks
  useEffect(() => {
    if (!userProfile || assignedProjects.length === 0) {
      setVisibleProjects([])
      return
    }

    let isMounted = true

    async function filterProjects() {
      // Batch all permission checks upfront instead of checking per project
      const [hasViewAllProjects, hasViewProjects] = await Promise.all([
        hasPermission(userProfile, Permission.VIEW_ALL_PROJECTS),
        hasPermission(userProfile, Permission.VIEW_PROJECTS)
      ])

      if (!isMounted) return

      // If user has VIEW_ALL_PROJECTS, they can see all projects - no need to check individual projects
      if (hasViewAllProjects) {
        setVisibleProjects([...assignedProjects])
        return
      }

      // If user doesn't have VIEW_PROJECTS, they can't see any projects
      if (!hasViewProjects) {
        setVisibleProjects([])
        return
      }

      // Batch check all project permissions in parallel instead of sequentially
      const projectPermissionChecks = await Promise.all(
        assignedProjects.map((project: ProjectWithDetails) =>
          canViewProject(userProfile, project.id).catch(() => false)
        )
      )

      if (!isMounted) return

      // Filter projects based on permission results
      const filtered = assignedProjects.filter((_: ProjectWithDetails, index: number) => projectPermissionChecks[index])
      setVisibleProjects(filtered)
    }

    filterProjects()

    return () => {
      isMounted = false
    }
  }, [projectIds, userProfile])

  // Fetch workflow steps for visible projects
  useEffect(() => {
    if (visibleProjects.length === 0) {
      setWorkflowSteps({})
      return
    }

    async function fetchWorkflowSteps() {
      const supabase = createClientSupabase()
      if (!supabase) return

      const projectIds = visibleProjects.map(p => p.id)
      const { data: workflowData, error } = await supabase
        .from('workflow_instances')
        .select(`
          project_id,
          current_node_id,
          workflow_nodes!workflow_instances_current_node_id_fkey (
            label
          )
        `)
        .in('project_id', projectIds)
        .eq('status', 'active')

      if (!error && workflowData) {
        const steps: { [key: string]: string | null } = {}
        workflowData.forEach((instance: any) => {
          if (instance.project_id && instance.workflow_nodes?.label) {
            steps[instance.project_id] = instance.workflow_nodes.label
          }
        })
        setWorkflowSteps(steps)
      }
    }

    fetchWorkflowSteps()
  }, [visibleProjects])

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set'
    try {
      return format(new Date(dateString), 'MMM dd, yyyy')
    } catch {
      return 'Invalid date'
    }
  }

  // Filter and sort projects (use visibleProjects which are already permission-filtered)
  const filteredAndSortedProjects = visibleProjects
    .filter(project => {
      if (priorityFilter !== 'all' && project.priority !== priorityFilter) return false
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
        : null,
      workflow_step: workflowSteps[project.id] || null
    }))

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col space-y-4">
          <div className="flex items-center space-x-2">
            <FolderOpen className="w-6 h-6 text-blue-600" />
            <div>
              <CardTitle>Your Assigned Projects</CardTitle>
              <CardDescription>Projects you have been assigned to work on</CardDescription>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-full min-w-0">
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

              <Select value={sortBy} onValueChange={(value: 'name' | 'priority' | 'deadline') => setSortBy(value)}>
                <SelectTrigger className="w-full min-w-0">
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
                className="w-full sm:w-auto"
              >
                {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {projectsLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Loading your projects...</p>
          </div>
        ) : projectsError ? (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Projects</h3>
            <p className="text-gray-600">
              {projectsError.message || 'Failed to load projects. Please try again.'}
            </p>
          </div>
        ) : assignedProjects.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Projects Assigned</h3>
            <p className="text-gray-600">
              You don&apos;t have any projects assigned yet. Check back later or contact your manager.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Project</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Workflow Step</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Priority</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Account</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Hours</th>
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
                        <Badge className="text-xs whitespace-nowrap border bg-blue-100 text-blue-800 border-blue-300">
                          {project.workflow_step}
                        </Badge>
                      ) : (
                        <span className="text-sm text-gray-400">No workflow</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className={`${getPriorityColor(project.priority)} text-xs whitespace-nowrap`}>
                        {project.priority}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-600">{project.account?.name || 'Unknown'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-semibold text-blue-600">
                          {project.estimated_hours !== null && project.estimated_hours !== undefined
                            ? `${Math.max(0, project.estimated_hours - (project.actual_hours || 0)).toFixed(1)}h left`
                            : '-'}
                        </span>
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {assignedProjects.length > 0 && (
          <div className="mt-4 text-center">
            <Button 
              variant="outline" 
              onClick={() => router.push('/projects')}
              className="inline-flex items-center space-x-2"
            >
              <span>View All Projects</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

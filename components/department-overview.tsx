'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  Users, 
  FolderOpen, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Plus,
  Settings,
  SortAsc,
  SortDesc,
  ExternalLink
} from 'lucide-react';
import { Department, UserProfile } from '@/lib/supabase';
import { UserWithRoles } from '@/lib/rbac-types';
import { DepartmentMetrics, DepartmentProject } from '@/lib/department-client-service';
import { projectIssuesService, type ProjectIssue } from '@/lib/project-issues-service';
import { format } from 'date-fns';
import { createClientSupabase } from '@/lib/supabase';
import CapacityDashboard from '@/components/capacity-dashboard';

interface DepartmentOverviewProps {
  department: Department;
  metrics: DepartmentMetrics;
  projects: DepartmentProject[];
  canManageDepartments: boolean;
  userProfile: UserWithRoles;
}

export function DepartmentOverview({
  department,
  metrics,
  projects,
  canManageDepartments,
  userProfile
}: DepartmentOverviewProps) {
  const [sortBy, setSortBy] = useState<'name' | 'priority' | 'deadline'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [workflowSteps, setWorkflowSteps] = useState<{ [key: string]: string | null }>({});

  // Projects with task data
  const [projectsWithTaskData, setProjectsWithTaskData] = useState<(DepartmentProject & { task_hours_sum?: number })[]>(projects);

  // Issues State
  const [activeIssues, setActiveIssues] = useState<(ProjectIssue & { project?: { id: string; name: string } })[]>([]);
  const [loadingActiveIssues, setLoadingActiveIssues] = useState(true);

  // Fetch task hours sum for projects
  useEffect(() => {
    const fetchTaskHours = async () => {
      if (!projects || projects.length === 0) return;

      const supabase = createClientSupabase();
      if (!supabase) return;

      const projectIds = projects.map(p => p.id);
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('project_id, estimated_hours')
        .in('project_id', projectIds);

      if (tasksData) {
        const projectTaskSum: Record<string, number> = {};
        tasksData.forEach((task: any) => {
          if (!projectTaskSum[task.project_id]) {
            projectTaskSum[task.project_id] = 0;
          }
          projectTaskSum[task.project_id] += (task.estimated_hours || 0);
        });

        setProjectsWithTaskData(projects.map(project => ({
          ...project,
          task_hours_sum: projectTaskSum[project.id] || 0
        })));
      }
    };

    void fetchTaskHours();
  }, [projects]);

  // Load active issues for this department
  useEffect(() => {
    const loadActiveIssues = async () => {
      try {
        setLoadingActiveIssues(true);
        const issues = await projectIssuesService.getDepartmentActiveIssues(department.id);
        setActiveIssues(issues);
      } catch (error) {
        console.error('Error loading department issues:', error);
        setActiveIssues([]);
      } finally {
        setLoadingActiveIssues(false);
      }
    };

    void loadActiveIssues();
  }, [department.id]);

  // Fetch workflow steps for projects
  useEffect(() => {
    if (!projects || projects.length === 0) {
      setWorkflowSteps({});
      return;
    }

    async function fetchWorkflowSteps() {
      const supabase = createClientSupabase();
      if (!supabase) return;

      const projectIds = projects.map(p => p.id);
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
        .eq('status', 'active');

      if (!error && workflowData) {
        const steps: { [key: string]: string | null } = {};
        workflowData.forEach((instance: any) => {
          if (instance.project_id && instance.workflow_nodes?.label) {
            steps[instance.project_id] = instance.workflow_nodes.label;
          }
        });
        setWorkflowSteps(steps);
      }
    }

    void fetchWorkflowSteps();
  }, [projects]);

  // Split projects into active and finished
  const activeProjects = projectsWithTaskData.filter(p => p.status !== 'complete');
  const finishedProjects = projectsWithTaskData.filter(p => p.status === 'complete');

  // Sort and filter active projects only
  const filteredAndSortedProjects = activeProjects
    .filter(project => {
      if (priorityFilter !== 'all' && project.priority !== priorityFilter) return false;
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'priority':
          const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
          comparison = priorityOrder[b.priority] - priorityOrder[a.priority];
          break;
        case 'deadline':
          if (!a.endDate && !b.endDate) comparison = 0;
          else if (!a.endDate) comparison = 1;
          else if (!b.endDate) comparison = -1;
          else comparison = new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    })
    .map(project => ({
      ...project,
      workflow_step: workflowSteps[project.id] ?? null
    }));

  // Chart data for workload distribution
  const workloadChartData = metrics.workloadDistribution.map(member => ({
    name: member.userName,
    workload: member.workloadPercentage,
    sentiment: member.workloadSentiment
  }));



  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200 hover:text-red-900';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200 hover:text-orange-900';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200 hover:text-yellow-900';
      case 'low': return 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200 hover:text-green-900';
      default: return 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200 hover:text-gray-900';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
          <div className="space-y-3">
            <h1 className="text-4xl font-bold text-gray-900">{department.name}</h1>
            {department.description && (
              <p className="text-gray-600 text-lg leading-relaxed">{department.description}</p>
            )}
          </div>
          {canManageDepartments && (
            <div className="flex gap-3">
              <Link href={`/departments/${department.id}/admin`}>
                <Button variant="outline" size="sm" className="inline-flex items-center space-x-2 h-10 px-4">
                  <Settings className="w-4 h-4" />
                  <span>Manage Department</span>
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Key Metrics Card */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <FolderOpen className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Active Projects</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.activeProjects}</p>
                <p className="text-xs text-gray-500">Projects assigned to this department</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <Users className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Team Size</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.teamSize}</p>
                <p className="text-xs text-gray-500">Users assigned to this department</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <TrendingUp className="w-8 h-8 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Capacity Utilization</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.capacityUtilization}%</p>
                <p className="text-xs text-gray-500">Current team workload</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Department Capacity Trends */}
      <CapacityDashboard
        userProfile={userProfile}
        mode="department"
        departmentId={department.id}
      />

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Capacity Utilization Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Team Capacity Utilization
            </CardTitle>
            <CardDescription>Current capacity utilization across team members</CardDescription>
          </CardHeader>
          <CardContent>
            {workloadChartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>No team members assigned to this department</p>
                </div>
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={workloadChartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      fontSize={12}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip
                      formatter={(value: any, name: any) => {
                        const color = value >= 90 ? '#EF4444' : value >= 75 ? '#F59E0B' : '#10B981';
                        return [`${value}%`, 'Utilization'];
                      }}
                      labelFormatter={(label) => `Team Member: ${label}`}
                    />
                    <Bar
                      dataKey="workload"
                      radius={[4, 4, 0, 0]}
                    >
                      {workloadChartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            entry.workload >= 90 ? '#EF4444' :
                            entry.workload >= 75 ? '#F59E0B' :
                            '#10B981'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="mt-4 flex items-center justify-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-green-500" />
                <span>&lt;75% Healthy</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-yellow-500" />
                <span>75-90% Stretched</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-red-500" />
                <span>&gt;90% Overloaded</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Department Activity Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Department Activity Overview</CardTitle>
            <CardDescription>Recent activity and project status distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{projects.filter(p => p.status === 'planning').length}</div>
                  <div className="text-sm text-blue-800">Planning</div>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{projects.filter(p => p.status === 'in_progress').length}</div>
                  <div className="text-sm text-yellow-800">In Progress</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{projects.filter(p => p.status === 'review').length}</div>
                  <div className="text-sm text-purple-800">In Review</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{projects.filter(p => p.status === 'complete').length}</div>
                  <div className="text-sm text-green-800">Complete</div>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Total Projects</span>
                  <span className="font-semibold">{projects.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Active Projects</span>
                  <span className="font-semibold">{metrics.activeProjects}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Team Members</span>
                  <span className="font-semibold">{metrics.teamSize}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Issues Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Active Issues
          </CardTitle>
          <CardDescription>
            Issues requiring attention from department projects
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
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge 
                            variant="outline" 
                            className={`${issue.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' : 'bg-orange-100 text-orange-800'} text-xs whitespace-nowrap`}
                          >
                            {issue.status.replace('_', ' ')}
                          </Badge>
                          {issue.project && (
                            <Badge variant="secondary" className="text-xs whitespace-nowrap">
                              {issue.project.name}
                            </Badge>
                          )}
                        </div>
                        <h4 className="font-medium text-gray-900 mb-1">Issue #{issue.id.slice(-6)}</h4>
                        <p className="text-sm text-gray-600 line-clamp-2 break-words">{issue.content}</p>
                      </div>
                      <div className="flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="hidden sm:inline-flex whitespace-nowrap"
                        >
                          <Link href={`/projects/${issue.project_id}`}>
                            View Project
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="sm:hidden h-8 w-8 p-0"
                        >
                          <Link href={`/projects/${issue.project_id}`}>
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Created {format(new Date(issue.created_at), 'MMM dd, yyyy')}</span>
                      {issue.user_profiles && (
                        <div className="flex items-center gap-1">
                          <Avatar className="h-4 w-4">
                            <AvatarImage src={issue.user_profiles.image || undefined} />
                            <AvatarFallback className="text-xs">
                              {issue.user_profiles.name?.split(' ').map((n: string) => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate">{issue.user_profiles.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Projects Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col space-y-4">
            <CardTitle>Active Projects</CardTitle>
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

                <Select value={sortBy} onValueChange={(value: 'name' | 'priority' | 'deadline') => { setSortBy(value); }}>
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
                  onClick={() => { setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}
                  className="w-full sm:w-auto"
                >
                  {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
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
                      <Badge variant="outline" className={`${getPriorityColor(project.priority)} text-xs whitespace-nowrap`}>
                        {project.priority}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-600">{project.accountName}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-semibold text-blue-600">
                          {project.estimatedHours ? `${project.estimatedHours}h` : '-'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {project.endDate ? (
                        <div>
                          <p className="text-sm text-gray-900">
                            {format(new Date(project.endDate), 'MMM dd, yyyy')}
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
        </CardContent>
      </Card>

      {/* Finished Projects Section */}
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
            <div className="space-y-3">
              {finishedProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/projects/${project.id}`}
                      className="font-medium text-gray-900 hover:text-blue-600"
                    >
                      {project.name}
                    </Link>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        Complete
                      </span>
                      {project.accountName && (
                        <span>{project.accountName}</span>
                      )}
                      {(project.actualHours ?? 0) > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {project.actualHours}h logged
                        </span>
                      )}
                    </div>
                  </div>
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
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

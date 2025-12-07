'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Inbox, CheckCircle2, Send, Clock, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { createClientSupabase } from '@/lib/supabase';

interface WorkflowProject {
  id: string;
  name: string;
  description: string | null;
  account_id: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  workflow_instance_id: string | null;
  account?: {
    id: string;
    name: string;
  };
  assigned_by?: string;
  role_in_project?: string;
}

interface ApprovalRequest {
  id: string;
  workflow_instance_id: string;
  current_node_id: string;
  project_id: string;
  projects?: WorkflowProject;
  workflow_nodes?: {
    id: string;
    label: string;
    node_type: string;
  };
}

export function UserInbox() {
  const [loading, setLoading] = useState(true);
  const [myProjects, setMyProjects] = useState<WorkflowProject[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [activeTab, setActiveTab] = useState('projects');
  const [workflowSteps, setWorkflowSteps] = useState<{ [key: string]: string | null }>({});

  useEffect(() => {
    void loadInboxData();
  }, []);

  // Fetch workflow steps when myProjects changes
  useEffect(() => {
    if (myProjects.length === 0) {
      setWorkflowSteps({});
      return;
    }

    async function fetchWorkflowSteps() {
      const supabase = createClientSupabase();
      if (!supabase) return;

      const projectIds = myProjects.map(p => p.id);
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
  }, [myProjects]);

  const loadInboxData = async () => {
    try {
      setLoading(true);

      // Load my active projects
      const projectsRes = await fetch('/api/workflows/my-projects');
      const projectsData = await projectsRes.json();
      if (projectsData.success) {
        setMyProjects(projectsData.projects || []);
      }

      // Load pending approvals
      const approvalsRes = await fetch('/api/workflows/my-approvals');
      const approvalsData = await approvalsRes.json();
      if (approvalsData.success) {
        setPendingApprovals(approvalsData.approvals || []);
      }
    } catch (error) {
      console.error('Error loading inbox data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'low':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Inbox className="w-5 h-5" />
          My Workflow Inbox
        </CardTitle>
        <CardDescription>
          Projects and approvals assigned to you
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="projects" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              My Projects
              {myProjects.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {myProjects.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="approvals" className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Pending Approvals
              {pendingApprovals.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {pendingApprovals.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* My Projects Tab */}
          <TabsContent value="projects" className="space-y-4 mt-4">
            {myProjects.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No active projects assigned to you</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myProjects.map((project: any) => (
                  <Card key={project.id} className="border-l-4 hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Link
                              href={`/projects/${project.id}`}
                              className="font-semibold text-lg hover:text-blue-600 transition-colors"
                            >
                              {project.projects?.name || project.name}
                            </Link>
                            <Badge className={getPriorityColor(project.projects?.priority || project.priority)}>
                              {project.projects?.priority || project.priority}
                            </Badge>
                            {workflowSteps[project.id] ? (
                              <Badge className="border bg-blue-100 text-blue-800 border-blue-300">
                                {workflowSteps[project.id]}
                              </Badge>
                            ) : (
                              <span className="text-xs text-gray-400">No workflow</span>
                            )}
                          </div>
                          {project.projects?.description && (
                            <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                              {project.projects.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            {project.projects?.account && (
                              <span className="flex items-center gap-1">
                                <span className="font-medium">Account:</span>
                                {project.projects.account.name}
                              </span>
                            )}
                            {project.role_in_project && (
                              <span className="flex items-center gap-1">
                                <span className="font-medium">Role:</span>
                                {project.role_in_project}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <span className="font-medium">Updated:</span>
                              {formatDistanceToNow(new Date(project.projects?.updated_at || project.updated_at), {
                                addSuffix: true,
                              })}
                            </span>
                          </div>
                        </div>
                        <Button size="sm" asChild>
                          <Link href={`/projects/${project.projects?.id || project.id}`}>
                            View Project
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Pending Approvals Tab */}
          <TabsContent value="approvals" className="space-y-4 mt-4">
            {pendingApprovals.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No pending approval requests</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingApprovals.map((approval: any) => (
                  <Card key={approval.id} className="border-l-4 border-l-yellow-400 hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Link
                              href={`/projects/${approval.project_id}`}
                              className="font-semibold text-lg hover:text-blue-600 transition-colors"
                            >
                              {approval.projects?.name || 'Unnamed Project'}
                            </Link>
                            <Badge className="bg-yellow-100 text-yellow-800">
                              Awaiting Approval
                            </Badge>
                            {approval.projects?.priority && (
                              <Badge className={getPriorityColor(approval.projects.priority)}>
                                {approval.projects.priority}
                              </Badge>
                            )}
                          </div>
                          {approval.projects?.description && (
                            <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                              {approval.projects.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            {approval.workflow_nodes?.label && (
                              <span className="flex items-center gap-1">
                                <span className="font-medium">Step:</span>
                                {approval.workflow_nodes.label}
                              </span>
                            )}
                            {approval.projects?.account && (
                              <span className="flex items-center gap-1">
                                <span className="font-medium">Account:</span>
                                {approval.projects.account.name}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button size="sm" asChild>
                          <Link href={`/projects/${approval.project_id}`}>
                            Review & Approve
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

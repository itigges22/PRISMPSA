'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Workflow, AlertCircle, Clock, CheckCircle2, ExternalLink } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import useSWR from 'swr';

interface WorkflowDetail {
  instanceId: string;
  projectId: string;
  projectName: string;
  accountName: string;
  activatedAt?: string;
  stepName?: string;
}

interface WorkflowsData {
  awaitingAction: number;
  activeWorkflows: number;
  inPipeline: number;
  completedRecently: number;
  awaitingDetails: WorkflowDetail[];
  pipelineDetails: WorkflowDetail[];
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function MyWorkflowsWidget() {
  const { data, error, isLoading } = useSWR<{ success: boolean; data: WorkflowsData }>(
    '/api/dashboard/my-workflows',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Workflow className="h-4 w-4 text-indigo-500" />
            My Workflows
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Failed to load workflow data</p>
        </CardContent>
      </Card>
    );
  }

  // Use default values when data is null (show widget with zeros)
  const workflowData = data?.data || {
    awaitingAction: 0,
    activeWorkflows: 0,
    inPipeline: 0,
    completedRecently: 0,
    awaitingDetails: [],
    pipelineDetails: [],
  };

  const hasNoWorkflows = workflowData.awaitingAction === 0 &&
                         workflowData.activeWorkflows === 0 &&
                         workflowData.inPipeline === 0 &&
                         workflowData.completedRecently === 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Workflow className="h-4 w-4 text-indigo-500" />
            My Workflows
          </div>
          <Link href="/workflows" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            View All <ExternalLink className="h-3 w-3" />
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {hasNoWorkflows ? (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No workflows assigned
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className={`rounded-lg p-2.5 ${workflowData.awaitingAction > 0 ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-muted/50'}`}>
                <div className="flex items-center gap-1.5">
                  <AlertCircle className={`h-3.5 w-3.5 ${workflowData.awaitingAction > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
                  <span className="text-xs text-muted-foreground">Awaiting Me</span>
                </div>
                <p className={`text-xl font-bold mt-0.5 ${workflowData.awaitingAction > 0 ? 'text-amber-600' : ''}`}>
                  {workflowData.awaitingAction}
                </p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-2.5">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-xs text-muted-foreground">In Pipeline</span>
                </div>
                <p className="text-xl font-bold mt-0.5">{workflowData.inPipeline}</p>
              </div>

              <div className="bg-indigo-50 dark:bg-indigo-950/30 rounded-lg p-2.5">
                <div className="flex items-center gap-1.5">
                  <Workflow className="h-3.5 w-3.5 text-indigo-500" />
                  <span className="text-xs text-muted-foreground">Active</span>
                </div>
                <p className="text-xl font-bold mt-0.5">{workflowData.activeWorkflows}</p>
              </div>

              <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-2.5">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-xs text-muted-foreground">Completed</span>
                </div>
                <p className="text-xl font-bold mt-0.5">{workflowData.completedRecently}</p>
              </div>
            </div>

            {/* Awaiting Action List */}
            {workflowData.awaitingDetails.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-2">Needs Your Action</p>
                <div className="space-y-1.5">
                  {workflowData.awaitingDetails.map((workflow) => (
                    <Link
                      key={workflow.instanceId}
                      href={`/projects/${workflow.projectId}`}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate group-hover:text-primary">
                          {workflow.projectName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {workflow.accountName}
                        </p>
                      </div>
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/50 text-amber-600 ml-2">
                        Pending
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* In Pipeline List */}
            {workflowData.awaitingDetails.length === 0 && workflowData.pipelineDetails.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-2">Coming to You</p>
                <div className="space-y-1.5">
                  {workflowData.pipelineDetails.map((workflow) => (
                    <Link
                      key={workflow.instanceId}
                      href={`/projects/${workflow.projectId}`}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate group-hover:text-primary">
                          {workflow.projectName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {workflow.stepName || workflow.accountName}
                        </p>
                      </div>
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950/50 text-blue-600 ml-2">
                        Pipeline
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default MyWorkflowsWidget;

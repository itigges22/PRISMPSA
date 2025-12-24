'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, CheckCircle2, Clock, FileText, ListPlus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import useSWR from 'swr';
import Link from 'next/link';

interface ActivityItem {
  id: string;
  type: 'task_completed' | 'task_assigned' | 'time_logged' | 'project_update' | 'task_created';
  title: string;
  description: string;
  timestamp: string;
  timeAgo: string;
  projectName?: string;
  projectId?: string;
  metadata?: Record<string, any>;
}

interface ActivityResponse {
  success: boolean;
  data: {
    activities: ActivityItem[];
    totalCount: number;
  };
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

function getActivityIcon(type: string) {
  switch (type) {
    case 'task_completed':
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
    case 'time_logged':
      return <Clock className="h-3.5 w-3.5 text-blue-500" />;
    case 'project_update':
      return <FileText className="h-3.5 w-3.5 text-purple-500" />;
    case 'task_assigned':
    case 'task_created':
      return <ListPlus className="h-3.5 w-3.5 text-amber-500" />;
    default:
      return <Activity className="h-3.5 w-3.5 text-gray-500" />;
  }
}

function getActivityColor(type: string): string {
  switch (type) {
    case 'task_completed':
      return 'border-l-green-500';
    case 'time_logged':
      return 'border-l-blue-500';
    case 'project_update':
      return 'border-l-purple-500';
    case 'task_assigned':
    case 'task_created':
      return 'border-l-amber-500';
    default:
      return 'border-l-gray-500';
  }
}

export function RecentActivityWidget() {
  const { data, error, isLoading } = useSWR<ActivityResponse>(
    '/api/dashboard/recent-activity',
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
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4 text-orange-500" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Failed to load data</p>
        </CardContent>
      </Card>
    );
  }

  const activities = data?.data?.activities || [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-orange-500" />
            Recent Activity
          </div>
          <span className="text-xs font-normal text-muted-foreground">
            Your Updates
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No recent activity
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className={`border-l-2 ${getActivityColor(activity.type)} pl-3 py-1.5 hover:bg-muted/30 rounded-r transition-colors`}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 shrink-0">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{activity.title}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {activity.timeAgo}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {activity.description}
                    </p>
                    {activity.projectName && activity.projectId && (
                      <Link
                        href={`/projects/${activity.projectId}`}
                        className="text-[10px] text-primary hover:underline"
                      >
                        {activity.projectName}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default RecentActivityWidget;

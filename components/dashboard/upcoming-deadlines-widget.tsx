'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarClock, AlertTriangle, Clock, CalendarDays } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import useSWR from 'swr';
import Link from 'next/link';

interface DeadlineItem {
  id: string;
  name: string;
  dueDate: string;
  dueDateLabel: string;
  projectName: string;
  projectId: string;
  status: string;
  priority: string;
  isOverdue: boolean;
  isDueToday: boolean;
  daysUntilDue: number;
}

interface DeadlinesResponse {
  success: boolean;
  data: {
    deadlines: DeadlineItem[];
    overdueCount: number;
    dueTodayCount: number;
    thisWeekCount: number;
    totalCount: number;
  };
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'urgent': return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400';
    case 'high': return 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400';
    case 'medium': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400';
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
  }
}

export function UpcomingDeadlinesWidget() {
  const { data, error, isLoading } = useSWR<DeadlinesResponse>(
    '/api/dashboard/upcoming-deadlines',
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
          <Skeleton className="h-5 w-44" />
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
            <CalendarClock className="h-4 w-4 text-purple-500" />
            Upcoming Deadlines
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Failed to load data</p>
        </CardContent>
      </Card>
    );
  }

  const deadlines = data?.data?.deadlines || [];
  const { overdueCount = 0, dueTodayCount = 0, thisWeekCount = 0 } = data?.data || {};

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-purple-500" />
            Upcoming Deadlines
          </div>
          <span className="text-xs font-normal text-muted-foreground">
            Next 14 Days
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {deadlines.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No upcoming deadlines
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary Pills */}
            <div className="flex gap-2 flex-wrap">
              {overdueCount > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 text-xs font-medium">
                  <AlertTriangle className="h-3 w-3" />
                  {overdueCount} overdue
                </div>
              )}
              {dueTodayCount > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 text-xs font-medium">
                  <Clock className="h-3 w-3" />
                  {dueTodayCount} today
                </div>
              )}
              {thisWeekCount > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 text-xs font-medium">
                  <CalendarDays className="h-3 w-3" />
                  {thisWeekCount} this week
                </div>
              )}
            </div>

            {/* Timeline */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {deadlines.slice(0, 6).map((deadline, index) => (
                <Link
                  key={deadline.id}
                  href={`/projects/${deadline.projectId}?task=${deadline.id}`}
                  className="block"
                >
                  <div
                    className={`flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors ${
                      deadline.isOverdue ? 'bg-red-50 dark:bg-red-950/20' :
                      deadline.isDueToday ? 'bg-amber-50 dark:bg-amber-950/20' : ''
                    }`}
                  >
                    {/* Timeline dot and line */}
                    <div className="flex flex-col items-center pt-1">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${
                          deadline.isOverdue ? 'bg-red-500' :
                          deadline.isDueToday ? 'bg-amber-500' :
                          'bg-purple-500'
                        }`}
                      />
                      {index < deadlines.slice(0, 6).length - 1 && (
                        <div className="w-0.5 h-full bg-muted mt-1" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{deadline.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground truncate">
                          {deadline.projectName}
                        </span>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] px-1.5 py-0 ${getPriorityColor(deadline.priority)}`}
                        >
                          {deadline.priority}
                        </Badge>
                      </div>
                    </div>

                    {/* Due date label */}
                    <div className="text-right shrink-0">
                      <span
                        className={`text-xs font-medium ${
                          deadline.isOverdue ? 'text-red-600 dark:text-red-400' :
                          deadline.isDueToday ? 'text-amber-600 dark:text-amber-400' :
                          'text-muted-foreground'
                        }`}
                      >
                        {deadline.dueDateLabel}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {deadlines.length > 6 && (
              <p className="text-xs text-muted-foreground text-center">
                +{deadlines.length - 6} more deadlines
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default UpcomingDeadlinesWidget;

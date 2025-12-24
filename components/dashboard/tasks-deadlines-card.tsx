'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckSquare, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO, isToday, isTomorrow, differenceInDays } from 'date-fns';
import Link from 'next/link';

interface UrgentTask {
  id: string;
  name: string;
  projectName: string;
  dueDate: string;
  status: string;
}

interface StatusBreakdown {
  backlog: number;
  todo: number;
  inProgress: number;
  review: number;
  done: number;
  blocked: number;
}

interface TasksData {
  inProgress: number;
  dueThisWeek: number;
  overdue: number;
  completedThisWeek: number;
  urgent: UrgentTask[];
  statusBreakdown: StatusBreakdown;
}

interface TasksDeadlinesCardProps {
  data: TasksData | null;
  isLoading: boolean;
}

function formatDueDate(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  const daysUntil = differenceInDays(date, new Date());
  if (daysUntil < 0) return `${Math.abs(daysUntil)}d overdue`;
  if (daysUntil <= 7) return `${daysUntil}d`;
  return format(date, 'MMM d');
}

function getDueDateColor(dateStr: string): string {
  const date = parseISO(dateStr);
  const daysUntil = differenceInDays(date, new Date());
  if (daysUntil < 0) return 'text-red-600';
  if (daysUntil === 0) return 'text-amber-600';
  if (daysUntil <= 2) return 'text-amber-500';
  return 'text-muted-foreground';
}

export function TasksDeadlinesCard({ data, isLoading }: TasksDeadlinesCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-purple-500" />
            Tasks & Deadlines
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No task data available</p>
        </CardContent>
      </Card>
    );
  }

  const totalActive = data.statusBreakdown.todo + data.statusBreakdown.inProgress +
    data.statusBreakdown.review + data.statusBreakdown.blocked;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-purple-500" />
          Tasks & Deadlines
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-2.5">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs text-muted-foreground">In Progress</span>
            </div>
            <p className="text-xl font-bold mt-0.5">{data.inProgress}</p>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-2.5">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs text-muted-foreground">Due This Week</span>
            </div>
            <p className="text-xl font-bold mt-0.5">{data.dueThisWeek}</p>
          </div>

          <div className={`rounded-lg p-2.5 ${data.overdue > 0 ? 'bg-red-50 dark:bg-red-950/30' : 'bg-muted/50'}`}>
            <div className="flex items-center gap-1.5">
              <AlertCircle className={`h-3.5 w-3.5 ${data.overdue > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
              <span className="text-xs text-muted-foreground">Overdue</span>
            </div>
            <p className={`text-xl font-bold mt-0.5 ${data.overdue > 0 ? 'text-red-600' : ''}`}>
              {data.overdue}
            </p>
          </div>

          <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-2.5">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              <span className="text-xs text-muted-foreground">Done This Week</span>
            </div>
            <p className="text-xl font-bold mt-0.5">{data.completedThisWeek}</p>
          </div>
        </div>

        {/* Status breakdown bar */}
        {totalActive > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Task Status</span>
              <span>{totalActive} active</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden flex">
              {data.statusBreakdown.blocked > 0 && (
                <div
                  className="bg-red-500 h-full"
                  style={{ width: `${(data.statusBreakdown.blocked / totalActive) * 100}%` }}
                  title={`Blocked: ${data.statusBreakdown.blocked}`}
                />
              )}
              {data.statusBreakdown.todo > 0 && (
                <div
                  className="bg-gray-400 h-full"
                  style={{ width: `${(data.statusBreakdown.todo / totalActive) * 100}%` }}
                  title={`To Do: ${data.statusBreakdown.todo}`}
                />
              )}
              {data.statusBreakdown.inProgress > 0 && (
                <div
                  className="bg-blue-500 h-full"
                  style={{ width: `${(data.statusBreakdown.inProgress / totalActive) * 100}%` }}
                  title={`In Progress: ${data.statusBreakdown.inProgress}`}
                />
              )}
              {data.statusBreakdown.review > 0 && (
                <div
                  className="bg-amber-500 h-full"
                  style={{ width: `${(data.statusBreakdown.review / totalActive) * 100}%` }}
                  title={`Review: ${data.statusBreakdown.review}`}
                />
              )}
            </div>
            <div className="flex gap-3 text-[10px] text-muted-foreground">
              {data.statusBreakdown.blocked > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500" />Blocked
                </span>
              )}
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-gray-400" />To Do
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" />In Progress
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" />Review
              </span>
            </div>
          </div>
        )}

        {/* Urgent tasks */}
        {data.urgent.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">Upcoming Deadlines</p>
            <div className="space-y-2">
              {data.urgent.map((task) => (
                <Link
                  key={task.id}
                  href={`/projects?task=${task.id}`}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate group-hover:text-primary">
                      {task.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {task.projectName}
                    </p>
                  </div>
                  <span className={`text-xs font-medium ml-2 ${getDueDateColor(task.dueDate)}`}>
                    {formatDueDate(task.dueDate)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {data.urgent.length === 0 && totalActive === 0 && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No active tasks assigned
          </div>
        )}
      </CardContent>
    </Card>
  );
}

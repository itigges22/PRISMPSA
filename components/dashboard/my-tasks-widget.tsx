'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckSquare, AlertCircle, Clock, CheckCircle2, ExternalLink } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { format, parseISO, isToday, isTomorrow, differenceInDays } from 'date-fns';

interface UrgentTask {
  id: string;
  name: string;
  projectId: string;
  projectName: string;
  dueDate: string;
  status: string;
  isOverdue?: boolean;
}

interface TasksData {
  inProgress: number;
  dueThisWeek: number;
  overdue: number;
  completedThisWeek: number;
  urgent: UrgentTask[];
}

interface MyTasksWidgetProps {
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
  if (daysUntil < 0) return 'text-red-600 bg-red-50 dark:bg-red-950/50';
  if (daysUntil === 0) return 'text-amber-600 bg-amber-50 dark:bg-amber-950/50';
  if (daysUntil <= 2) return 'text-amber-500 bg-amber-50 dark:bg-amber-950/30';
  return 'text-muted-foreground bg-muted';
}

export function MyTasksWidget({ data, isLoading }: MyTasksWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Use default values when data is null (show widget with zeros)
  const displayData = data || {
    inProgress: 0,
    dueThisWeek: 0,
    overdue: 0,
    completedThisWeek: 0,
    urgent: [],
  };

  const hasNoTasks = displayData.inProgress === 0 && displayData.dueThisWeek === 0 &&
                     displayData.overdue === 0 && displayData.completedThisWeek === 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-purple-500" />
            My Tasks
          </div>
          <Link href="/projects" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            View All <ExternalLink className="h-3 w-3" />
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {hasNoTasks ? (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No tasks assigned
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-2.5">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-xs text-muted-foreground">In Progress</span>
                </div>
                <p className="text-xl font-bold mt-0.5">{displayData.inProgress}</p>
              </div>

              <div className={`rounded-lg p-2.5 ${displayData.overdue > 0 ? 'bg-red-50 dark:bg-red-950/30' : 'bg-muted/50'}`}>
                <div className="flex items-center gap-1.5">
                  <AlertCircle className={`h-3.5 w-3.5 ${displayData.overdue > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
                  <span className="text-xs text-muted-foreground">Overdue</span>
                </div>
                <p className={`text-xl font-bold mt-0.5 ${displayData.overdue > 0 ? 'text-red-600' : ''}`}>
                  {displayData.overdue}
                </p>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-2.5">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-xs text-muted-foreground">Due This Week</span>
                </div>
                <p className="text-xl font-bold mt-0.5">{displayData.dueThisWeek}</p>
              </div>

              <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-2.5">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-xs text-muted-foreground">Completed</span>
                </div>
                <p className="text-xl font-bold mt-0.5">{displayData.completedThisWeek}</p>
              </div>
            </div>

            {/* Priority Tasks - Show overdue first, then upcoming */}
            {displayData.urgent.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-2">
                  {displayData.overdue > 0 ? 'Priority Tasks' : 'Upcoming Deadlines'}
                </p>
                <div className="space-y-1.5">
                  {displayData.urgent.slice(0, 5).map((task) => {
                    // Check if task is overdue (either from API flag or calculated)
                    const isOverdue = task.isOverdue ?? differenceInDays(parseISO(task.dueDate), new Date()) < 0;
                    return (
                      <Link
                        key={task.id}
                        href={`/projects/${task.projectId}?tab=tasks`}
                        className={`flex items-center justify-between p-2 rounded-lg transition-colors group ${
                          isOverdue
                            ? 'bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 border border-red-200 dark:border-red-800'
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-medium truncate group-hover:text-primary ${isOverdue ? 'text-red-700 dark:text-red-400' : ''}`}>
                            {task.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {task.projectName}
                          </p>
                        </div>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ml-2 ${getDueDateColor(task.dueDate)}`}>
                          {formatDueDate(task.dueDate)}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Show message if there are overdue tasks but none in the list */}
            {displayData.overdue > 0 && displayData.urgent.length === 0 && (
              <div className="pt-2 border-t">
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-sm text-red-700 dark:text-red-400">
                    You have {displayData.overdue} overdue task{displayData.overdue > 1 ? 's' : ''}.
                    <Link href="/projects" className="underline ml-1 font-medium hover:text-red-800">
                      View all projects
                    </Link>
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default MyTasksWidget;

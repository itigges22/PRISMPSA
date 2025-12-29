'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';

interface TimeData {
  hoursToday: number;
  hoursThisWeek: number;
  hoursThisMonth: number;
  weeklyTarget: number;
  dailyAverage: number;
}

interface MyTimeWidgetProps {
  data: TimeData | null;
  isLoading: boolean;
}

function _getProgressColor(percentage: number): string {
  if (percentage >= 100) return 'bg-green-500';
  if (percentage >= 75) return 'bg-blue-500';
  if (percentage >= 50) return 'bg-amber-500';
  return 'bg-gray-400';
}

export function MyTimeWidget({ data, isLoading }: MyTimeWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Use default values when data is null (show widget with zeros)
  const displayData = data || {
    hoursToday: 0,
    hoursThisWeek: 0,
    hoursThisMonth: 0,
    weeklyTarget: 40,
    dailyAverage: 0,
  };

  const weeklyProgress = displayData.weeklyTarget > 0
    ? Math.round((displayData.hoursThisWeek / displayData.weeklyTarget) * 100)
    : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-500" />
          My Time This Week
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Stats */}
        <div className="space-y-3">
          {/* Today */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Today</span>
            <span className="text-lg font-bold">{displayData.hoursToday}h</span>
          </div>

          {/* This Week - Highlighted */}
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">This Week</span>
              <span className="text-2xl font-bold">
                {displayData.hoursThisWeek}
                <span className="text-sm font-normal text-muted-foreground">
                  /{displayData.weeklyTarget}h
                </span>
              </span>
            </div>
            <div className="space-y-1">
              <Progress
                value={Math.min(weeklyProgress, 100)}
                className="h-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{weeklyProgress}% of target</span>
                <span>{Math.max(0, displayData.weeklyTarget - displayData.hoursThisWeek)}h remaining</span>
              </div>
            </div>
          </div>

          {/* Additional Stats */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">This Month</p>
              <p className="text-sm font-semibold">{displayData.hoursThisMonth}h</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Daily Avg</p>
              <p className="text-sm font-semibold">{displayData.dailyAverage}h</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default MyTimeWidget;

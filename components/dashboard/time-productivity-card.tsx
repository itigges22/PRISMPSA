'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Plus, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface TimeData {
  hoursToday: number;
  hoursThisWeek: number;
  hoursThisMonth: number;
  weeklyTarget: number;
  dailyAverage: number;
  weeklyTrend: number[];
}

interface TimeProductivityCardProps {
  data: TimeData | null;
  isLoading: boolean;
  onLogTime?: () => void;
}

export function TimeProductivityCard({ data, isLoading, onLogTime }: TimeProductivityCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500" />
            Time & Productivity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No time data available</p>
        </CardContent>
      </Card>
    );
  }

  const weekProgress = data.weeklyTarget > 0
    ? Math.min(100, Math.round((data.hoursThisWeek / data.weeklyTarget) * 100))
    : 0;

  // Mini sparkline for 7-day trend
  const maxHours = Math.max(...data.weeklyTrend, 1);
  const sparklineHeight = 24;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-500" />
          Time & Productivity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main stats */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Today</p>
            <p className="text-2xl font-bold">{data.hoursToday}h</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">This Week</p>
            <p className="text-2xl font-bold">
              {data.hoursThisWeek}
              <span className="text-sm font-normal text-muted-foreground">/{data.weeklyTarget}h</span>
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Week Progress</span>
            <span className="font-medium">{weekProgress}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                weekProgress >= 100 ? 'bg-green-500' :
                weekProgress >= 70 ? 'bg-blue-500' :
                weekProgress >= 40 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${weekProgress}%` }}
            />
          </div>
        </div>

        {/* Secondary stats */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Daily Avg:</span>
            <span className="font-medium">{data.dailyAverage}h</span>
          </div>
          <div>
            <span className="text-muted-foreground">Month:</span>
            <span className="font-medium ml-1">{data.hoursThisMonth}h</span>
          </div>
        </div>

        {/* 7-day sparkline */}
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground mb-2">Last 7 Days</p>
          <div className="flex items-end gap-1 h-6">
            {data.weeklyTrend.map((hours, i) => {
              const height = maxHours > 0 ? (hours / maxHours) * sparklineHeight : 0;
              const isToday = i === data.weeklyTrend.length - 1;
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-sm transition-all ${
                    isToday ? 'bg-blue-500' : 'bg-blue-200'
                  }`}
                  style={{ height: `${Math.max(2, height)}px` }}
                  title={`${hours}h`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>Mon</span>
            <span>Today</span>
          </div>
        </div>

        {/* Action button */}
        {onLogTime && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={onLogTime}
          >
            <Plus className="h-4 w-4 mr-1" />
            Log Time
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

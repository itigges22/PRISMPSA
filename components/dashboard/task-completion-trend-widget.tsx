'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import useSWR from 'swr';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface WeeklyData {
  weekStart: string;
  weekLabel: string;
  completed: number;
  created: number;
}

interface TaskTrendResponse {
  success: boolean;
  data: {
    weeks: WeeklyData[];
    totalCompleted: number;
    totalCreated: number;
    completionRate: number;
  };
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border rounded-lg shadow-lg p-3">
        <p className="font-medium text-sm mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-xs" style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function TaskCompletionTrendWidget() {
  const { data, error, isLoading } = useSWR<TaskTrendResponse>(
    '/api/dashboard/task-completion-trend',
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
          <Skeleton className="h-5 w-48" />
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
            <TrendingUp className="h-4 w-4 text-green-500" />
            Task Completion Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Failed to load data</p>
        </CardContent>
      </Card>
    );
  }

  const weeks = data?.data?.weeks || [];
  const totalCompleted = data?.data?.totalCompleted || 0;
  const completionRate = data?.data?.completionRate || 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            Task Completion Trend
          </div>
          <span className="text-xs font-normal text-muted-foreground">
            Last 4 Weeks
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {weeks.every(w => w.completed === 0 && w.created === 0) ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No task activity in the past 4 weeks
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold text-green-600 dark:text-green-400">
                  {totalCompleted}
                </p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {completionRate}%
                </p>
                <p className="text-xs text-muted-foreground">Completion Rate</p>
              </div>
            </div>

            {/* Line Chart */}
            <div className="h-36" style={{ minHeight: 144, minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <LineChart data={weeks} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="weekLabel"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="completed"
                    name="Completed"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ fill: '#22c55e', strokeWidth: 0, r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="created"
                    name="Created"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', strokeWidth: 0, r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex justify-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <span className="text-muted-foreground">Completed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="text-muted-foreground">Created</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default TaskCompletionTrendWidget;

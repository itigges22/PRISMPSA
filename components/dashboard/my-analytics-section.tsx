'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { TimeProductivityCard } from './time-productivity-card';
import { TasksDeadlinesCard } from './tasks-deadlines-card';
import { CapacityWorkloadCard } from './capacity-workload-card';

interface MyAnalyticsData {
  time: {
    hoursToday: number;
    hoursThisWeek: number;
    hoursThisMonth: number;
    weeklyTarget: number;
    dailyAverage: number;
    weeklyTrend: number[];
  };
  tasks: {
    inProgress: number;
    dueThisWeek: number;
    overdue: number;
    completedThisWeek: number;
    urgent: {
      id: string;
      name: string;
      projectName: string;
      dueDate: string;
      status: string;
    }[];
    statusBreakdown: {
      backlog: number;
      todo: number;
      inProgress: number;
      review: number;
      done: number;
      blocked: number;
    };
  };
  capacity: {
    availableHours: number;
    allocatedHours: number;
    loggedHours: number;
    utilizationRate: number;
    remainingCapacity: number;
    weekProgress: number;
    status: 'on_track' | 'behind' | 'ahead';
  };
}

interface MyAnalyticsSectionProps {
  onLogTime?: () => void;
  onSetAvailability?: () => void;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function MyAnalyticsSection({ onLogTime, onSetAvailability }: MyAnalyticsSectionProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data, error, isLoading, mutate } = useSWR<{ success: boolean; data: MyAnalyticsData }>(
    '/api/dashboard/my-analytics',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000, // 30 seconds
    }
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await mutate();
    setIsRefreshing(false);
  };

  const analyticsData = data?.data;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">My Week at a Glance</h3>
          <p className="text-sm text-muted-foreground">Your personal productivity metrics</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-4 text-sm text-red-600 dark:text-red-400">
          Failed to load analytics data. Please try again.
        </div>
      )}

      {/* Cards grid - stacks vertically in sidebar, 3 cols on full width */}
      <div className="grid grid-cols-1 gap-4">
        <TimeProductivityCard
          data={analyticsData?.time || null}
          isLoading={isLoading}
          onLogTime={onLogTime}
        />
        <TasksDeadlinesCard
          data={analyticsData?.tasks || null}
          isLoading={isLoading}
        />
        <CapacityWorkloadCard
          data={analyticsData?.capacity || null}
          isLoading={isLoading}
          onSetAvailability={onSetAvailability}
        />
      </div>
    </div>
  );
}

export default MyAnalyticsSection;

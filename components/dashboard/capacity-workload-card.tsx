'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface CapacityData {
  availableHours: number;
  allocatedHours: number;
  loggedHours: number;
  utilizationRate: number;
  remainingCapacity: number;
  weekProgress: number;
  status: 'on_track' | 'behind' | 'ahead';
}

interface CapacityWorkloadCardProps {
  data: CapacityData | null;
  isLoading: boolean;
  onSetAvailability?: () => void;
}

function getStatusConfig(status: 'on_track' | 'behind' | 'ahead') {
  switch (status) {
    case 'ahead':
      return {
        label: 'Ahead',
        color: 'text-blue-600',
        bgColor: 'bg-blue-100 dark:bg-blue-950/50',
        icon: TrendingUp,
      };
    case 'behind':
      return {
        label: 'Behind',
        color: 'text-amber-600',
        bgColor: 'bg-amber-100 dark:bg-amber-950/50',
        icon: TrendingDown,
      };
    default:
      return {
        label: 'On Track',
        color: 'text-green-600',
        bgColor: 'bg-green-100 dark:bg-green-950/50',
        icon: Minus,
      };
  }
}

function getUtilizationColor(rate: number): string {
  if (rate > 100) return 'text-red-600';
  if (rate >= 85) return 'text-amber-600';
  if (rate >= 60) return 'text-green-600';
  return 'text-gray-500';
}

function getUtilizationBgColor(rate: number): string {
  if (rate > 100) return 'bg-red-500';
  if (rate >= 85) return 'bg-amber-500';
  if (rate >= 60) return 'bg-green-500';
  return 'bg-gray-400';
}

export function CapacityWorkloadCard({ data, isLoading, onSetAvailability }: CapacityWorkloadCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            <Skeleton className="h-24 w-24 rounded-full" />
          </div>
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
            <Activity className="h-4 w-4 text-green-500" />
            Capacity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No capacity data available</p>
        </CardContent>
      </Card>
    );
  }

  const statusConfig = getStatusConfig(data.status);
  const StatusIcon = statusConfig.icon;

  // Calculate the circumference and offset for the circular progress
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(data.utilizationRate, 100) / 100) * circumference;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4 text-green-500" />
          Capacity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Circular progress gauge */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <svg width="100" height="100" className="transform -rotate-90">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-muted"
              />
              {/* Progress circle */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className={getUtilizationBgColor(data.utilizationRate).replace('bg-', 'text-')}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-2xl font-bold ${getUtilizationColor(data.utilizationRate)}`}>
                {data.utilizationRate}%
              </span>
              <span className="text-[10px] text-muted-foreground">utilized</span>
            </div>
          </div>

          {/* Status badge */}
          <div className={`mt-2 px-3 py-1 rounded-full flex items-center gap-1.5 ${statusConfig.bgColor}`}>
            <StatusIcon className={`h-3.5 w-3.5 ${statusConfig.color}`} />
            <span className={`text-xs font-medium ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Available</p>
            <p className="font-semibold">{data.availableHours}h</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Allocated</p>
            <p className="font-semibold">{data.allocatedHours}h</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Logged</p>
            <p className="font-semibold">{data.loggedHours}h</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Remaining</p>
            <p className={`font-semibold ${data.remainingCapacity < 0 ? 'text-red-600' : ''}`}>
              {data.remainingCapacity}h
            </p>
          </div>
        </div>

        {/* Week progress indicator */}
        <div className="pt-2 border-t">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Work Week</span>
            <span className="font-medium">{data.weekProgress}% complete</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gray-400 rounded-full transition-all"
              style={{ width: `${data.weekProgress}%` }}
            />
          </div>
        </div>

        {/* Action button */}
        {onSetAvailability && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={onSetAvailability}
          >
            <Calendar className="h-4 w-4 mr-1" />
            Set Availability
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

'use client';

import {
  useCapacityHistory,
  useOrganizationCapacity,
  useDepartmentCapacity,
  useAccountCapacity
} from '@/lib/hooks/use-data';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';

export type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly';

interface _CapacityDataPoint {
  label: string;
  available: number;
  allocated: number;
  actual: number;
  utilization: number;
}

interface CapacityTrendChartProps {
  userId: string;
  timePeriod: TimePeriod;
  onPeriodChange: (period: TimePeriod) => void;
  onOpenAvailability?: () => void;
  mode?: 'user' | 'organization' | 'department' | 'account';
  departmentId?: string;
  accountId?: string;
}

export default function CapacityTrendChart({
  userId,
  timePeriod,
  onPeriodChange,
  onOpenAvailability,
  mode = 'user',
  departmentId,
  accountId,
}: CapacityTrendChartProps) {
  // Use optimized SWR hooks based on mode - automatic caching & deduplication
  const userCapacity = useCapacityHistory(mode === 'user' ? userId : undefined, timePeriod);
  const orgCapacity = useOrganizationCapacity(timePeriod);
  const deptCapacity = useDepartmentCapacity(mode === 'department' ? departmentId : undefined, timePeriod);
  const acctCapacity = useAccountCapacity(mode === 'account' ? accountId : undefined, timePeriod);

  // Select the appropriate data based on mode
  const { data: rawData, error, isLoading } =
    mode === 'organization' ? orgCapacity :
    mode === 'department' ? deptCapacity :
    mode === 'account' ? acctCapacity :
    userCapacity;

  // Sanitize data to ensure all numeric values are valid numbers (not null/undefined/NaN)
  const data = (rawData || []).map((point: any) => ({
    ...point,
    available: typeof point.available === 'number' && !isNaN(point.available) ? point.available : 0,
    allocated: typeof point.allocated === 'number' && !isNaN(point.allocated) ? point.allocated : 0,
    actual: typeof point.actual === 'number' && !isNaN(point.actual) ? point.actual : 0,
    utilization: typeof point.utilization === 'number' && !isNaN(point.utilization) ? point.utilization : 0,
  }));

  // Debug: Log data for account mode
  if (mode === 'account') {
    console.log('[CapacityTrendChart] Account mode data:', {
      mode,
      accountId,
      rawDataLength: rawData?.length,
      sanitizedDataLength: data.length,
      sampleData: data.slice(0, 2),
      hasValidData: data.some((d: any) => d.available > 0 || d.allocated > 0 || d.actual > 0)
    });
  }

  const loading = isLoading;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Capacity Trend</CardTitle>
          <CardDescription>Loading capacity data...</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Capacity Trend</CardTitle>
          <CardDescription className="text-red-500">
            {error?.message || 'Failed to load capacity data'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Unable to load capacity data
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Capacity Trend</CardTitle>
          <CardDescription>
            Track your available, allocated, and actual hours over time
          </CardDescription>
        </div>
        <div className="flex rounded-lg border overflow-hidden">
          {(['daily', 'weekly', 'monthly', 'quarterly'] as TimePeriod[]).map((period:any) => (
            <button
              key={period}
              onClick={() => { onPeriodChange(period); }}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                timePeriod === period
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background hover:bg-muted'
              }`}
            >
              {period.charAt(0).toUpperCase() + period.slice(1)}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 5, right: 50, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
                stroke="#6b7280"
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `${value}h`}
                stroke="#6b7280"
                domain={[0, 'auto']}
                allowDataOverflow={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `${value}%`}
                stroke="#6b7280"
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                }}
                formatter={(value: number, name: string) => [
                  name === 'Utilization' ? `${value}%` : `${value}h`,
                  name,
                ]}
                labelFormatter={(label) => `Period: ${label}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="available"
                stroke="#10B981"
                strokeWidth={2}
                dot={{ fill: '#10B981', r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                name="Available"
                yAxisId="left"
                connectNulls
                isAnimationActive={false}
                style={{ strokeWidth: 2, stroke: '#10B981' }}
              />
              <Line
                type="monotone"
                dataKey="allocated"
                stroke="#F59E0B"
                strokeWidth={2}
                dot={{ fill: '#F59E0B', r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                name="Allocated"
                yAxisId="left"
                connectNulls
                isAnimationActive={false}
                style={{ strokeWidth: 2, stroke: '#F59E0B' }}
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={{ fill: '#3B82F6', r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                name="Actual"
                yAxisId="left"
                connectNulls
                isAnimationActive={false}
                style={{ strokeWidth: 2, stroke: '#3B82F6' }}
              />
              <Line
                type="monotone"
                dataKey="utilization"
                stroke="#8B5CF6"
                strokeWidth={2}
                dot={{ fill: '#8B5CF6', r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                name="Utilization"
                yAxisId="right"
                strokeDasharray="5 5"
                connectNulls
                isAnimationActive={false}
                style={{ strokeWidth: 2, stroke: '#8B5CF6' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex items-center justify-center gap-4 text-xs flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span>Allocated</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span>Actual</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500" />
            <span>Utilization %</span>
          </div>
        </div>
        {onOpenAvailability && (
          <div className="mt-4 pt-4 border-t">
            <Button
              onClick={onOpenAvailability}
              variant="outline"
              className="w-full"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Set Work Availability
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

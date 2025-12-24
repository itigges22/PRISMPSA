'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
} from 'recharts';
import { WidgetBase, DateRange, StatCard, WidgetEmptyState } from './widget-base';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, TrendingUp, Clock, AlertTriangle } from 'lucide-react';

type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly';

interface CapacityDataPoint {
  label: string;
  available: number;
  allocated: number;
  actual: number;
  utilization: number;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function CapacityUtilizationWidget() {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('weekly');

  const { data, error, isLoading, mutate } = useSWR<{ success: boolean; data: CapacityDataPoint[] }>(
    `/api/capacity/organization?period=${timePeriod}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  const capacityData = data?.data || [];

  // Calculate summary stats
  const currentPeriod = capacityData.length > 0 ? capacityData[Math.floor(capacityData.length / 2)] : null;
  const avgUtilization = capacityData.length > 0
    ? Math.round(capacityData.reduce((sum, d) => sum + d.utilization, 0) / capacityData.length)
    : 0;
  const totalAvailable = capacityData.reduce((sum, d) => sum + d.available, 0);
  const totalActual = capacityData.reduce((sum, d) => sum + d.actual, 0);
  const totalAllocated = capacityData.reduce((sum, d) => sum + d.allocated, 0);

  // Check for over-allocation
  const overAllocatedPeriods = capacityData.filter(d => d.allocated > d.available);

  const handleExport = (format: 'csv' | 'png') => {
    if (format === 'csv' && capacityData.length > 0) {
      const csvData = [
        ['Period', 'Available', 'Allocated', 'Actual', 'Utilization'],
        ...capacityData.map(d => [d.label, d.available, d.allocated, d.actual, `${d.utilization}%`]),
      ];
      const csv = csvData.map(row => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `capacity-${timePeriod}.csv`;
      a.click();
    }
  };

  // Convert date range to time period for compatibility
  const handleDateRangeChange = (range: DateRange) => {
    switch (range) {
      case '7d':
        setTimePeriod('daily');
        break;
      case '30d':
        setTimePeriod('weekly');
        break;
      case '90d':
        setTimePeriod('monthly');
        break;
      case 'ytd':
      case 'all':
        setTimePeriod('quarterly');
        break;
      default:
        setTimePeriod('weekly');
    }
  };

  const getDateRangeFromPeriod = (): DateRange => {
    switch (timePeriod) {
      case 'daily':
        return '7d';
      case 'weekly':
        return '30d';
      case 'monthly':
        return '90d';
      case 'quarterly':
        return 'ytd';
      default:
        return '30d';
    }
  };

  if (capacityData.length === 0 && !isLoading && !error) {
    return (
      <WidgetBase
        title="Capacity Utilization"
        description="Organization-wide capacity and utilization"
        dateRange={getDateRangeFromPeriod()}
        onDateRangeChange={handleDateRangeChange}
        isLoading={false}
      >
        <WidgetEmptyState
          title="No capacity data"
          description="Set up user availability to see capacity metrics"
          icon={<Activity className="h-8 w-8" />}
        />
      </WidgetBase>
    );
  }

  return (
    <WidgetBase
      title="Capacity Utilization"
      description="Organization-wide capacity, allocation, and actual hours"
      dateRange={getDateRangeFromPeriod()}
      onDateRangeChange={handleDateRangeChange}
      isLoading={isLoading}
      error={error}
      onExport={handleExport}
      onRefresh={() => mutate()}
      fullWidth
      minHeight="450px"
    >
      <div className="space-y-6">
        {/* Period Selector */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Select value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {overAllocatedPeriods.length > 0 && (
            <div className="flex items-center gap-2 text-amber-600 text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>{overAllocatedPeriods.length} period(s) over-allocated</span>
            </div>
          )}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Avg Utilization"
            value={`${avgUtilization}%`}
            change={avgUtilization >= 70 ? 5 : -3}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <StatCard
            label="Total Available"
            value={`${Math.round(totalAvailable)}h`}
            icon={<Clock className="h-4 w-4" />}
          />
          <StatCard
            label="Total Allocated"
            value={`${Math.round(totalAllocated)}h`}
            icon={<Activity className="h-4 w-4" />}
          />
          <StatCard
            label="Total Logged"
            value={`${Math.round(totalActual)}h`}
            icon={<Clock className="h-4 w-4" />}
          />
        </div>

        {/* Charts */}
        <Tabs defaultValue="trend" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="trend">Trend</TabsTrigger>
            <TabsTrigger value="comparison">Comparison</TabsTrigger>
          </TabsList>

          <TabsContent value="trend" className="mt-4">
            <div className="bg-muted/30 rounded-lg p-4">
              <h4 className="text-sm font-medium mb-4">Capacity Over Time</h4>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={capacityData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      `${value.toFixed(1)}h`,
                      name.charAt(0).toUpperCase() + name.slice(1)
                    ]}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="available"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ fill: '#10b981', r: 4 }}
                    name="Available"
                    connectNulls
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="allocated"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ fill: '#f59e0b', r: 4 }}
                    name="Allocated"
                    connectNulls
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', r: 4 }}
                    name="Actual"
                    connectNulls
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="comparison" className="mt-4">
            <div className="bg-muted/30 rounded-lg p-4">
              <h4 className="text-sm font-medium mb-4">Available vs Allocated vs Actual</h4>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={capacityData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      `${value.toFixed(1)}h`,
                      name
                    ]}
                  />
                  <Legend />
                  <ReferenceLine y={0} stroke="#666" />
                  <Bar dataKey="available" fill="#10b981" name="Available" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="allocated" fill="#f59e0b" name="Allocated" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="actual" fill="#3b82f6" name="Actual" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>

        {/* Utilization Band */}
        <div className="bg-muted/30 rounded-lg p-4">
          <h4 className="text-sm font-medium mb-4">Utilization by Period</h4>
          <ResponsiveContainer width="100%" height={Math.max(150, capacityData.length * 30)}>
            <BarChart data={capacityData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={false} />
              <XAxis type="number" domain={[0, 120]} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="label" width={60} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: number) => [`${value}%`, 'Utilization']}
              />
              <Bar dataKey="utilization" radius={[0, 4, 4, 0]}>
                {capacityData.map((entry, index) => {
                  let color = '#22c55e'; // green (60-85%)
                  if (entry.utilization > 100) color = '#ef4444'; // red
                  else if (entry.utilization > 85) color = '#f59e0b'; // amber
                  else if (entry.utilization < 60) color = '#94a3b8'; // gray
                  return <Cell key={`cell-${index}`} fill={color} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-2 text-xs">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-400" /> Under 60%</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500" /> 60-85%</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500" /> 85-100%</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500" /> Over 100%</span>
          </div>
        </div>
      </div>
    </WidgetBase>
  );
}

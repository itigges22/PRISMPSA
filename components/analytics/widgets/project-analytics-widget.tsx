'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';
import { WidgetBase, DateRange, StatCard, WidgetEmptyState } from './widget-base';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FolderKanban, TrendingUp, Clock, AlertTriangle } from 'lucide-react';

interface ProjectAnalyticsData {
  summary: {
    total: number;
    active: number;
    completed: number;
    onHold: number;
    healthScore: number;
    estimateAccuracy: number;
  };
  statusDistribution: { status: string; count: number; color: string }[];
  priorityDistribution: { priority: string; count: number; color: string }[];
  timeline: { date: string; created: number; completed: number }[];
  topProjectHours: { name: string; estimated: number; actual: number; remaining: number }[];
  hoursByAccount: { name: string; hours: number }[];
  estimatedVsActual: {
    estimated: number;
    actual: number;
    variance: number;
  };
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function ProjectAnalyticsWidget() {
  const [dateRange, setDateRange] = useState<DateRange>('30d');

  const { data, error, isLoading, mutate } = useSWR<{ success: boolean; data: ProjectAnalyticsData }>(
    `/api/analytics/projects?dateRange=${dateRange}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  const analytics = data?.data;

  const handleExport = (format: 'csv' | 'png') => {
    if (format === 'csv' && analytics) {
      // Generate CSV
      const csvData = [
        ['Metric', 'Value'],
        ['Total Projects', analytics.summary.total],
        ['Active Projects', analytics.summary.active],
        ['Completed Projects', analytics.summary.completed],
        ['Health Score', analytics.summary.healthScore],
        ['Estimate Accuracy', `${analytics.summary.estimateAccuracy}%`],
      ];
      const csv = csvData.map(row => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project-analytics-${dateRange}.csv`;
      a.click();
    }
  };

  if (!analytics && !isLoading && !error) {
    return (
      <WidgetBase
        title="Project Analytics"
        description="Overview of project metrics and trends"
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        isLoading={false}
      >
        <WidgetEmptyState
          title="No project data"
          description="Create some projects to see analytics"
          icon={<FolderKanban className="h-8 w-8" />}
        />
      </WidgetBase>
    );
  }

  return (
    <WidgetBase
      title="Project Analytics"
      description="Project metrics, status distribution, and trends"
      dateRange={dateRange}
      onDateRangeChange={setDateRange}
      isLoading={isLoading}
      error={error}
      onExport={handleExport}
      onRefresh={() => mutate()}
      fullWidth
      minHeight="500px"
    >
      {analytics && (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Total Projects"
              value={analytics.summary.total}
              icon={<FolderKanban className="h-4 w-4" />}
            />
            <StatCard
              label="Active"
              value={analytics.summary.active}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <StatCard
              label="Health Score"
              value={`${analytics.summary.healthScore}%`}
              change={analytics.summary.healthScore >= 80 ? 5 : -5}
              icon={<AlertTriangle className="h-4 w-4" />}
            />
            <StatCard
              label="Estimate Accuracy"
              value={`${analytics.summary.estimateAccuracy}%`}
              icon={<Clock className="h-4 w-4" />}
            />
          </div>

          {/* Tabs for different views */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="hours">Hours</TabsTrigger>
              <TabsTrigger value="accounts">By Account</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Status Distribution */}
                <div className="bg-muted/30 rounded-lg p-4">
                  <h4 className="text-sm font-medium mb-4">Status Distribution</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={analytics.statusDistribution}
                        dataKey="count"
                        nameKey="status"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        label={({ name, value }) => `${name}: ${value}`}
                        labelLine={false}
                      >
                        {analytics.statusDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-2 mt-2 justify-center">
                    {analytics.statusDistribution.map((item, index) => (
                      <div key={index} className="flex items-center gap-1 text-xs">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="capitalize">{item.status.replace('_', ' ')}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Priority Distribution */}
                <div className="bg-muted/30 rounded-lg p-4">
                  <h4 className="text-sm font-medium mb-4">Priority Distribution</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={analytics.priorityDistribution} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis type="number" />
                      <YAxis dataKey="priority" type="category" width={60} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {analytics.priorityDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Estimated vs Actual */}
              <div className="mt-6 bg-muted/30 rounded-lg p-4">
                <h4 className="text-sm font-medium mb-4">Estimated vs Actual Hours</h4>
                <div className="flex items-center gap-8">
                  <div className="flex-1">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Estimated</span>
                      <span className="text-sm font-medium">{analytics.estimatedVsActual.estimated}h</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-3">
                      <div
                        className="bg-blue-500 h-3 rounded-full"
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Actual</span>
                      <span className="text-sm font-medium">{analytics.estimatedVsActual.actual}h</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-3">
                      <div
                        className={`h-3 rounded-full ${analytics.estimatedVsActual.variance > 0 ? 'bg-amber-500' : 'bg-green-500'}`}
                        style={{
                          width: `${Math.min(100, (analytics.estimatedVsActual.actual / Math.max(1, analytics.estimatedVsActual.estimated)) * 100)}%`
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground">Variance</div>
                    <div className={`text-lg font-bold ${analytics.estimatedVsActual.variance > 0 ? 'text-amber-500' : 'text-green-500'}`}>
                      {analytics.estimatedVsActual.variance > 0 ? '+' : ''}{analytics.estimatedVsActual.variance}h
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="timeline" className="mt-4">
              <div className="bg-muted/30 rounded-lg p-4">
                <h4 className="text-sm font-medium mb-4">Projects Created vs Completed</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={analytics.timeline}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="created"
                      stackId="1"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.6}
                      name="Created"
                    />
                    <Area
                      type="monotone"
                      dataKey="completed"
                      stackId="2"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.6}
                      name="Completed"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>

            <TabsContent value="hours" className="mt-4">
              <div className="bg-muted/30 rounded-lg p-4">
                <h4 className="text-sm font-medium mb-4">Hours by Project (Top 10)</h4>
                {analytics.topProjectHours.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics.topProjectHours} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="actual" stackId="a" fill="#3b82f6" name="Actual" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="remaining" stackId="a" fill="#94a3b8" name="Remaining" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                    No hour data available
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="accounts" className="mt-4">
              <div className="bg-muted/30 rounded-lg p-4">
                <h4 className="text-sm font-medium mb-4">Hours by Account (Top 5)</h4>
                {analytics.hoursByAccount.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics.hoursByAccount}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="hours" fill="#8b5cf6" name="Hours" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                    No account data available
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </WidgetBase>
  );
}

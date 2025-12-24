'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { WidgetBase, DateRange, StatCard, WidgetEmptyState } from './widget-base';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, TrendingUp, Users, CheckCircle } from 'lucide-react';

interface TimeAnalyticsData {
  summary: {
    totalHours: number;
    totalEntries: number;
    avgHoursPerDay: number;
    avgHoursPerUser: number;
    trackingCompliance: number;
    activeUsers: number;
  };
  hoursByProject: { name: string; hours: number }[];
  hoursByDay: { day: string; hours: number }[];
  dailyTrend: { date: string; hours: number }[];
  topContributors: { name: string; hours: number }[];
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'];

export function TimeDistributionWidget() {
  const [dateRange, setDateRange] = useState<DateRange>('30d');

  const { data, error, isLoading, mutate } = useSWR<{ success: boolean; data: TimeAnalyticsData }>(
    `/api/analytics/time?dateRange=${dateRange}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  const analytics = data?.data;

  const handleExport = (format: 'csv' | 'png') => {
    if (format === 'csv' && analytics) {
      const csvData = [
        ['Metric', 'Value'],
        ['Total Hours', analytics.summary.totalHours],
        ['Total Entries', analytics.summary.totalEntries],
        ['Avg Hours/Day', analytics.summary.avgHoursPerDay],
        ['Avg Hours/User', analytics.summary.avgHoursPerUser],
        ['Tracking Compliance', `${analytics.summary.trackingCompliance}%`],
        [],
        ['Project', 'Hours'],
        ...analytics.hoursByProject.map(p => [p.name, p.hours]),
      ];
      const csv = csvData.map(row => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `time-distribution-${dateRange}.csv`;
      a.click();
    }
  };

  if (!analytics && !isLoading && !error) {
    return (
      <WidgetBase
        title="Time Distribution"
        description="How time is spent across projects"
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        isLoading={false}
      >
        <WidgetEmptyState
          title="No time entries"
          description="Log time to see distribution analytics"
          icon={<Clock className="h-8 w-8" />}
        />
      </WidgetBase>
    );
  }

  return (
    <WidgetBase
      title="Time Distribution"
      description="Time tracking patterns and project allocation"
      dateRange={dateRange}
      onDateRangeChange={setDateRange}
      isLoading={isLoading}
      error={error}
      onExport={handleExport}
      onRefresh={() => mutate()}
      fullWidth
      minHeight="450px"
    >
      {analytics && (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Total Hours"
              value={`${analytics.summary.totalHours}h`}
              icon={<Clock className="h-4 w-4" />}
            />
            <StatCard
              label="Avg/Day"
              value={`${analytics.summary.avgHoursPerDay}h`}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <StatCard
              label="Active Users"
              value={analytics.summary.activeUsers}
              icon={<Users className="h-4 w-4" />}
            />
            <StatCard
              label="Tracking Rate"
              value={`${analytics.summary.trackingCompliance}%`}
              change={analytics.summary.trackingCompliance >= 80 ? 5 : -5}
              icon={<CheckCircle className="h-4 w-4" />}
            />
          </div>

          <Tabs defaultValue="trend" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="trend">Daily Trend</TabsTrigger>
              <TabsTrigger value="projects">By Project</TabsTrigger>
              <TabsTrigger value="weekday">By Day</TabsTrigger>
              <TabsTrigger value="contributors">Top Users</TabsTrigger>
            </TabsList>

            <TabsContent value="trend" className="mt-4">
              <div className="bg-muted/30 rounded-lg p-4">
                <h4 className="text-sm font-medium mb-4">Hours Logged Over Time</h4>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={analytics.dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip formatter={(value: number) => [`${value}h`, 'Hours']} />
                    <Area
                      type="monotone"
                      dataKey="hours"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.3}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>

            <TabsContent value="projects" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Bar chart */}
                <div className="bg-muted/30 rounded-lg p-4">
                  <h4 className="text-sm font-medium mb-4">Hours by Project</h4>
                  {analytics.hoursByProject.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={analytics.hoursByProject} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(value: number) => [`${value}h`, 'Hours']} />
                        <Bar dataKey="hours" radius={[0, 4, 4, 0]}>
                          {analytics.hoursByProject.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                      No project data
                    </div>
                  )}
                </div>

                {/* Pie chart */}
                <div className="bg-muted/30 rounded-lg p-4">
                  <h4 className="text-sm font-medium mb-4">Project Distribution</h4>
                  {analytics.hoursByProject.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={analytics.hoursByProject.slice(0, 6)}
                            dataKey="hours"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={70}
                            label={({ percent }) =>
                              percent ? `${(percent * 100).toFixed(0)}%` : ''
                            }
                            labelLine={false}
                          >
                            {analytics.hoursByProject.slice(0, 6).map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => [`${value}h`, 'Hours']} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap gap-2 mt-2 justify-center">
                        {analytics.hoursByProject.slice(0, 6).map((item, index) => (
                          <div key={index} className="flex items-center gap-1 text-xs">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <span>{item.name}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                      No project data
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="weekday" className="mt-4">
              <div className="bg-muted/30 rounded-lg p-4">
                <h4 className="text-sm font-medium mb-4">Activity by Day of Week</h4>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={analytics.hoursByDay}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => [`${value.toFixed(1)}h`, 'Hours']} />
                    <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                      {analytics.hoursByDay.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.day === 'Sat' || entry.day === 'Sun' ? '#94a3b8' : '#3b82f6'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>

            <TabsContent value="contributors" className="mt-4">
              <div className="bg-muted/30 rounded-lg p-4">
                <h4 className="text-sm font-medium mb-4">Top Contributors</h4>
                {analytics.topContributors.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={analytics.topContributors}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => [`${value}h`, 'Hours']} />
                      <Bar dataKey="hours" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[280px] text-muted-foreground">
                    No contributor data
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

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
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { WidgetBase, DateRange, StatCard, WidgetEmptyState } from './widget-base';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, TrendingUp, Clock, CheckCircle, Smile } from 'lucide-react';

interface TeamAnalyticsData {
  summary: {
    totalUsers: number;
    activeUsers: number;
    avgUtilization: number;
    totalHoursLogged: number;
    avgHoursPerUser: number;
    taskCompletionRate: number;
  };
  topPerformers: { name: string; utilization: number; hoursLogged: number }[];
  workloadDistribution: { range: string; count: number; color: string }[];
  sentimentData: { sentiment: string; count: number; color: string }[];
  activityByDay: { day: string; hours: number }[];
  departmentStats: { name: string; users: number; hours: number }[];
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function TeamPerformanceWidget() {
  const [dateRange, setDateRange] = useState<DateRange>('30d');

  const { data, error, isLoading, mutate } = useSWR<{ success: boolean; data: TeamAnalyticsData }>(
    `/api/analytics/team?dateRange=${dateRange}`,
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
        ['Total Users', analytics.summary.totalUsers],
        ['Active Users', analytics.summary.activeUsers],
        ['Avg Utilization', `${analytics.summary.avgUtilization}%`],
        ['Total Hours Logged', analytics.summary.totalHoursLogged],
        ['Avg Hours/User', analytics.summary.avgHoursPerUser],
        ['Task Completion Rate', `${analytics.summary.taskCompletionRate}%`],
        [],
        ['Top Performers', ''],
        ['Name', 'Hours Logged', 'Utilization'],
        ...analytics.topPerformers.map(p => [p.name, p.hoursLogged, `${p.utilization}%`]),
      ];
      const csv = csvData.map(row => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `team-performance-${dateRange}.csv`;
      a.click();
    }
  };

  if (!analytics && !isLoading && !error) {
    return (
      <WidgetBase
        title="Team Performance"
        description="Team utilization and performance metrics"
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        isLoading={false}
      >
        <WidgetEmptyState
          title="No team data"
          description="Add team members to see analytics"
          icon={<Users className="h-8 w-8" />}
        />
      </WidgetBase>
    );
  }

  return (
    <WidgetBase
      title="Team Performance"
      description="Utilization, workload distribution, and team sentiment"
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
              label="Team Members"
              value={analytics.summary.totalUsers}
              icon={<Users className="h-4 w-4" />}
            />
            <StatCard
              label="Avg Utilization"
              value={`${analytics.summary.avgUtilization}%`}
              change={analytics.summary.avgUtilization >= 70 ? 5 : -5}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <StatCard
              label="Hours Logged"
              value={analytics.summary.totalHoursLogged}
              icon={<Clock className="h-4 w-4" />}
            />
            <StatCard
              label="Task Completion"
              value={`${analytics.summary.taskCompletionRate}%`}
              icon={<CheckCircle className="h-4 w-4" />}
            />
          </div>

          <Tabs defaultValue="performers" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="performers">Top Performers</TabsTrigger>
              <TabsTrigger value="workload">Workload</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="departments">Departments</TabsTrigger>
            </TabsList>

            <TabsContent value="performers" className="mt-4">
              <div className="bg-muted/30 rounded-lg p-4">
                <h4 className="text-sm font-medium mb-4">Top 10 by Hours Logged</h4>
                {analytics.topPerformers.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics.topPerformers} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          name === 'hoursLogged' ? `${value}h` : `${value}%`,
                          name === 'hoursLogged' ? 'Hours' : 'Utilization'
                        ]}
                      />
                      <Legend />
                      <Bar dataKey="hoursLogged" fill="#3b82f6" name="Hours" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                    No performer data available
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="workload" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Workload Distribution */}
                <div className="bg-muted/30 rounded-lg p-4">
                  <h4 className="text-sm font-medium mb-4">Workload Distribution</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={analytics.workloadDistribution}
                        dataKey="count"
                        nameKey="range"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        label={({ value }) => value && value > 0 ? `${value}` : ''}
                      >
                        {analytics.workloadDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-2 mt-2 justify-center">
                    {analytics.workloadDistribution.map((item, index) => (
                      <div key={index} className="flex items-center gap-1 text-xs">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span>{item.range}: {item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Team Sentiment */}
                <div className="bg-muted/30 rounded-lg p-4">
                  <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
                    <Smile className="h-4 w-4" />
                    Team Sentiment
                  </h4>
                  {analytics.sentimentData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={analytics.sentimentData}
                            dataKey="count"
                            nameKey="sentiment"
                            cx="50%"
                            cy="50%"
                            outerRadius={70}
                            label={({ name, value }) => value && value > 0 ? name : ''}
                          >
                            {analytics.sentimentData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap gap-2 mt-2 justify-center">
                        {analytics.sentimentData.map((item, index) => (
                          <div key={index} className="flex items-center gap-1 text-xs">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: item.color }}
                            />
                            <span>{item.sentiment}: {item.count}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                      No sentiment data reported
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="activity" className="mt-4">
              <div className="bg-muted/30 rounded-lg p-4">
                <h4 className="text-sm font-medium mb-4">Activity by Day of Week</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.activityByDay}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => [`${value.toFixed(1)}h`, 'Hours']} />
                    <Bar dataKey="hours" fill="#8b5cf6" name="Hours" radius={[4, 4, 0, 0]}>
                      {analytics.activityByDay.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.day === 'Sat' || entry.day === 'Sun' ? '#94a3b8' : '#8b5cf6'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>

            <TabsContent value="departments" className="mt-4">
              <div className="bg-muted/30 rounded-lg p-4">
                <h4 className="text-sm font-medium mb-4">Hours by Department</h4>
                {analytics.departmentStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics.departmentStats}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="left" orientation="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="hours" fill="#3b82f6" name="Hours" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="right" dataKey="users" fill="#10b981" name="Users" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                    No department data available
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

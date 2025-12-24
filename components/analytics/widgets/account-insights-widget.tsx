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
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { WidgetBase, DateRange, StatCard, WidgetEmptyState } from './widget-base';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, TrendingUp, Clock, FolderKanban } from 'lucide-react';

interface AccountAnalyticsData {
  summary: {
    total: number;
    active: number;
    totalHoursInvested: number;
    avgProjectsPerAccount: number;
  };
  statusDistribution: { status: string; count: number; color: string }[];
  topAccountsByHours: { name: string; hours: number }[];
  accountDetails: {
    id: string;
    name: string;
    status: string;
    projectCount: number;
    activeProjects: number;
    completedProjects: number;
    hoursInvested: number;
    teamSize: number;
  }[];
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function AccountInsightsWidget() {
  const [dateRange, setDateRange] = useState<DateRange>('30d');

  const { data, error, isLoading, mutate } = useSWR<{ success: boolean; data: AccountAnalyticsData }>(
    `/api/analytics/accounts?dateRange=${dateRange}`,
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
        ['Account', 'Status', 'Projects', 'Active', 'Completed', 'Hours', 'Team Size'],
        ...analytics.accountDetails.map(a => [
          a.name,
          a.status,
          a.projectCount,
          a.activeProjects,
          a.completedProjects,
          a.hoursInvested,
          a.teamSize,
        ]),
      ];
      const csv = csvData.map(row => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `account-insights-${dateRange}.csv`;
      a.click();
    }
  };

  if (!analytics && !isLoading && !error) {
    return (
      <WidgetBase
        title="Account Insights"
        description="Client/account analytics and engagement"
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        isLoading={false}
      >
        <WidgetEmptyState
          title="No account data"
          description="Create accounts to see insights"
          icon={<Building2 className="h-8 w-8" />}
        />
      </WidgetBase>
    );
  }

  return (
    <WidgetBase
      title="Account Insights"
      description="Client engagement, hours invested, and account health"
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
              label="Total Accounts"
              value={analytics.summary.total}
              icon={<Building2 className="h-4 w-4" />}
            />
            <StatCard
              label="Active"
              value={analytics.summary.active}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <StatCard
              label="Hours Invested"
              value={`${analytics.summary.totalHoursInvested}h`}
              icon={<Clock className="h-4 w-4" />}
            />
            <StatCard
              label="Avg Projects"
              value={analytics.summary.avgProjectsPerAccount}
              icon={<FolderKanban className="h-4 w-4" />}
            />
          </div>

          <Tabs defaultValue="hours" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="hours">Hours by Account</TabsTrigger>
              <TabsTrigger value="distribution">Distribution</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
            </TabsList>

            <TabsContent value="hours" className="mt-4">
              <div className="bg-muted/30 rounded-lg p-4">
                <h4 className="text-sm font-medium mb-4">Top Accounts by Hours Invested</h4>
                {analytics.topAccountsByHours.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics.topAccountsByHours} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value: number) => [`${value}h`, 'Hours']} />
                      <Bar dataKey="hours" fill="#f59e0b" name="Hours" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                    No hour data available
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="distribution" className="mt-4">
              <div className="bg-muted/30 rounded-lg p-4">
                <h4 className="text-sm font-medium mb-4">Account Status Distribution</h4>
                  {analytics.statusDistribution.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie
                            data={analytics.statusDistribution}
                            dataKey="count"
                            nameKey="status"
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={70}
                            label={({ value }) => `${value}`}
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
                            <span className="capitalize">{item.status}: {item.count}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-[180px] text-muted-foreground">
                      No status data
                    </div>
                  )}
              </div>
            </TabsContent>

            <TabsContent value="details" className="mt-4">
              <div className="bg-muted/30 rounded-lg p-4 overflow-x-auto">
                <h4 className="text-sm font-medium mb-4">Account Details</h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">Account</th>
                      <th className="text-left py-2 px-2">Status</th>
                      <th className="text-right py-2 px-2">Projects</th>
                      <th className="text-right py-2 px-2">Active</th>
                      <th className="text-right py-2 px-2">Hours</th>
                      <th className="text-right py-2 px-2">Team</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.accountDetails.map((account) => (
                      <tr key={account.id} className="border-b border-muted hover:bg-muted/50">
                        <td className="py-2 px-2 font-medium">{account.name}</td>
                        <td className="py-2 px-2 capitalize">{account.status}</td>
                        <td className="py-2 px-2 text-right">{account.projectCount}</td>
                        <td className="py-2 px-2 text-right">{account.activeProjects}</td>
                        <td className="py-2 px-2 text-right">{account.hoursInvested}h</td>
                        <td className="py-2 px-2 text-right">{account.teamSize}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </WidgetBase>
  );
}

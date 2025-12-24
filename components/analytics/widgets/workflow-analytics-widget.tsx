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
import { GitBranch, Clock, CheckCircle, AlertTriangle } from 'lucide-react';

interface WorkflowAnalyticsData {
  summary: {
    totalTemplates: number;
    activeInstances: number;
    completedThisMonth: number;
    avgCompletionDays: number;
    completionRate: number;
  };
  statusDistribution: { status: string; count: number; color: string }[];
  templateUsage: { name: string; count: number }[];
  bottleneckNodes: {
    id: string;
    name: string;
    type: string;
    avgHours: number;
    totalTransitions: number;
  }[];
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function WorkflowAnalyticsWidget() {
  const [dateRange, setDateRange] = useState<DateRange>('30d');

  const { data, error, isLoading, mutate } = useSWR<{ success: boolean; data: WorkflowAnalyticsData }>(
    `/api/analytics/workflows?dateRange=${dateRange}`,
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
        ['Total Templates', analytics.summary.totalTemplates],
        ['Active Instances', analytics.summary.activeInstances],
        ['Completed This Month', analytics.summary.completedThisMonth],
        ['Avg Completion Days', analytics.summary.avgCompletionDays],
        ['Completion Rate', `${analytics.summary.completionRate}%`],
        [],
        ['Template', 'Usage Count'],
        ...analytics.templateUsage.map(t => [t.name, t.count]),
      ];
      const csv = csvData.map(row => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workflow-analytics-${dateRange}.csv`;
      a.click();
    }
  };

  if (!analytics && !isLoading && !error) {
    return (
      <WidgetBase
        title="Workflow Analytics"
        description="Workflow efficiency and completion metrics"
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        isLoading={false}
      >
        <WidgetEmptyState
          title="No workflow data"
          description="Create workflows to see analytics"
          icon={<GitBranch className="h-8 w-8" />}
        />
      </WidgetBase>
    );
  }

  return (
    <WidgetBase
      title="Workflow Analytics"
      description="Workflow performance, bottlenecks, and completion metrics"
      dateRange={dateRange}
      onDateRangeChange={setDateRange}
      isLoading={isLoading}
      error={error}
      onExport={handleExport}
      onRefresh={() => mutate()}
      minHeight="400px"
    >
      {analytics && (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Active Workflows"
              value={analytics.summary.activeInstances}
              icon={<GitBranch className="h-4 w-4" />}
            />
            <StatCard
              label="Completed"
              value={analytics.summary.completedThisMonth}
              icon={<CheckCircle className="h-4 w-4" />}
            />
            <StatCard
              label="Avg Days"
              value={analytics.summary.avgCompletionDays}
              icon={<Clock className="h-4 w-4" />}
            />
            <StatCard
              label="Completion Rate"
              value={`${analytics.summary.completionRate}%`}
              change={analytics.summary.completionRate >= 80 ? 5 : -5}
              icon={<CheckCircle className="h-4 w-4" />}
            />
          </div>

          <Tabs defaultValue="status" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="status">Status</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
              <TabsTrigger value="bottlenecks">Bottlenecks</TabsTrigger>
            </TabsList>

            <TabsContent value="status" className="mt-4">
              <div className="bg-muted/30 rounded-lg p-4">
                <h4 className="text-sm font-medium mb-4">Workflow Status Distribution</h4>
                {analytics.statusDistribution.length > 0 ? (
                  <div className="flex items-center gap-8">
                    <ResponsiveContainer width="60%" height={200}>
                      <PieChart>
                        <Pie
                          data={analytics.statusDistribution}
                          dataKey="count"
                          nameKey="status"
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          label={({ value }) => value}
                        >
                          {analytics.statusDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-3">
                      {analytics.statusDistribution.map((item, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <div>
                            <div className="text-sm font-medium">{item.status}</div>
                            <div className="text-xs text-muted-foreground">{item.count} workflows</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                    No workflow instances yet
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="templates" className="mt-4">
              <div className="bg-muted/30 rounded-lg p-4">
                <h4 className="text-sm font-medium mb-4">Template Usage</h4>
                {analytics.templateUsage.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={analytics.templateUsage} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#8b5cf6" name="Usage Count" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                    No template usage data
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="bottlenecks" className="mt-4">
              <div className="bg-muted/30 rounded-lg p-4">
                <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Bottleneck Nodes (Avg Time Spent)
                </h4>
                {analytics.bottleneckNodes.length > 0 ? (
                  <div className="space-y-3">
                    {analytics.bottleneckNodes.map((node, index) => (
                      <div
                        key={node.id}
                        className="flex items-center justify-between p-3 bg-background rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`
                            w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                            ${index === 0 ? 'bg-red-100 text-red-700' :
                              index === 1 ? 'bg-amber-100 text-amber-700' :
                                'bg-gray-100 text-gray-700'}
                          `}>
                            {index + 1}
                          </div>
                          <div>
                            <div className="text-sm font-medium">{node.name}</div>
                            <div className="text-xs text-muted-foreground capitalize">
                              {node.type.replace('_', ' ')} node
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">{node.avgHours}h avg</div>
                          <div className="text-xs text-muted-foreground">
                            {node.totalTransitions} transitions
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                    No bottleneck data available
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

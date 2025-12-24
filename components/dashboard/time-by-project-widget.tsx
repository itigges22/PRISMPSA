'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart as PieChartIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import useSWR from 'swr';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface ProjectTime {
  projectId: string;
  projectName: string;
  accountName: string;
  hours: number;
  color: string;
  [key: string]: string | number; // Allow index signature for Recharts
}

interface TimeByProjectResponse {
  success: boolean;
  data: {
    projects: ProjectTime[];
    totalHours: number;
    weekStart: string;
    weekEnd: string;
  };
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-background border rounded-lg shadow-lg p-3">
        <p className="font-medium text-sm">{data.projectName}</p>
        <p className="text-xs text-muted-foreground">{data.accountName}</p>
        <p className="text-sm font-bold mt-1">{data.hours}h</p>
      </div>
    );
  }
  return null;
};

export function TimeByProjectWidget() {
  const { data, error, isLoading } = useSWR<TimeByProjectResponse>(
    '/api/dashboard/time-by-project',
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
          <Skeleton className="h-5 w-40" />
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
            <PieChartIcon className="h-4 w-4 text-blue-500" />
            Time by Project
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Failed to load data</p>
        </CardContent>
      </Card>
    );
  }

  const projects = data?.data?.projects || [];
  const totalHours = data?.data?.totalHours || 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PieChartIcon className="h-4 w-4 text-blue-500" />
            Time by Project
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold">{totalHours}h</span>
            <span className="text-xs font-normal text-muted-foreground">
              This Week
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {projects.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No time logged this week
          </div>
        ) : (
          <div className="space-y-4">
            {/* Pie Chart */}
            <div className="h-48" style={{ minHeight: 192, minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    data={projects}
                    dataKey="hours"
                    nameKey="projectName"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                  >
                    {projects.map((project, index) => (
                      <Cell key={project.projectId} fill={project.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {projects.slice(0, 5).map((project) => (
                <div key={project.projectId} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: project.color }}
                    />
                    <span className="truncate">{project.projectName}</span>
                  </div>
                  <span className="font-medium ml-2">{project.hours}h</span>
                </div>
              ))}
              {projects.length > 5 && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  +{projects.length - 5} more projects
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default TimeByProjectWidget;

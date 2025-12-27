/**
 * API Route: Analytics Overview
 * Returns comprehensive dashboard summary data for the analytics page
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getUserProfileFromRequest } from '@/lib/supabase-server';
import { startOfWeek, startOfMonth, endOfMonth, format } from 'date-fns';

interface ErrorWithMessage extends Error {
  message: string;
  status?: number;
}

interface ProjectSummary {
  total: number;
  active: number;
  completedThisMonth: number;
  onTimeRate: number;
  byStatus: { status: string; count: number }[];
  byPriority: { priority: string; count: number }[];
}

interface TeamSummary {
  totalUsers: number;
  activeUsers: number;
  avgUtilization: number;
  hoursLoggedThisWeek: number;
  hoursLoggedThisMonth: number;
}

interface AccountSummary {
  total: number;
  active: number;
  byServiceTier: { tier: string; count: number }[];
}

interface WorkflowSummary {
  active: number;
  completedThisMonth: number;
  avgCompletionDays: number;
}

interface TaskSummary {
  total: number;
  completed: number;
  inProgress: number;
  overdue: number;
  completionRate: number;
}

interface OverviewResponse {
  projects: ProjectSummary;
  team: TeamSummary;
  accounts: AccountSummary;
  workflows: WorkflowSummary;
  tasks: TaskSummary;
  recentActivity: {
    type: string;
    message: string;
    timestamp: string;
  }[];
  insights: string[];
}

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export async function GET(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database connection not available' },
        { status: 500 }
      );
    }

    const userProfile = await getUserProfileFromRequest(supabase);
    if (!userProfile) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // Fetch all data in parallel for performance
    const [
      projectsData,
      usersData,
      accountsData,
      workflowsData,
      tasksData,
      timeEntriesWeekData,
      timeEntriesMonthData,
      projectUpdatesData,
      availabilityData,
    ] = await Promise.all([
      // Projects
      supabase.from('projects').select('id, status, priority, end_date, created_at'),

      // Users
      supabase.from('user_profiles').select('id, created_at'),

      // Accounts
      supabase.from('accounts').select('id, status, service_tier'),

      // Workflow instances
      supabase.from('workflow_instances').select('id, status, started_at, completed_at'),

      // Tasks
      supabase.from('tasks').select('id, status, due_date'),

      // Time entries this week
      supabase
        .from('time_entries')
        .select('hours_logged, user_id')
        .gte('entry_date', format(weekStart, 'yyyy-MM-dd')),

      // Time entries this month
      supabase
        .from('time_entries')
        .select('hours_logged, user_id')
        .gte('entry_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('entry_date', format(monthEnd, 'yyyy-MM-dd')),

      // Recent project updates for activity feed
      supabase
        .from('project_updates')
        .select('id, content, created_at, projects(name)')
        .order('created_at', { ascending: false })
        .limit(5),

      // User availability for utilization
      supabase
        .from('user_availability')
        .select('user_id, available_hours')
        .eq('week_start_date', format(weekStart, 'yyyy-MM-dd')),
    ]);

    // Process Projects
    const projects = projectsData.data || [];
    const activeProjects = projects.filter((p: any) =>
      ['planning', 'in_progress', 'review'].includes(p.status)
    );
    const completedThisMonth = projects.filter((p: any) =>
      p.status === 'complete' &&
      new Date(p.created_at) >= monthStart
    );

    // Calculate on-time rate (completed projects that met their deadline)
    const completedWithDeadline = projects.filter((p: any) =>
      p.status === 'complete' && p.end_date
    );
    const onTimeProjects = completedWithDeadline.filter((p: any) =>
      new Date(p.end_date) >= new Date(p.created_at)
    );
    const onTimeRate = completedWithDeadline.length > 0
      ? Math.round((onTimeProjects.length / completedWithDeadline.length) * 100)
      : 100;

    // Group by status and priority
    const statusCounts: Record<string, number> = {};
    const priorityCounts: Record<string, number> = {};
    projects.forEach((p: any) => {
      statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
      priorityCounts[p.priority || 'medium'] = (priorityCounts[p.priority || 'medium'] || 0) + 1;
    });

    // Process Team
    const users = usersData.data || [];
    const timeEntriesWeek = timeEntriesWeekData.data || [];
    const timeEntriesMonth = timeEntriesMonthData.data || [];
    const availability = availabilityData.data || [];

    const hoursLoggedThisWeek = timeEntriesWeek.reduce((sum: number, te: any) =>
      sum + (te.hours_logged || 0), 0
    );
    const hoursLoggedThisMonth = timeEntriesMonth.reduce((sum: number, te: any) =>
      sum + (te.hours_logged || 0), 0
    );

    // Active users = users who logged time this month
    const activeUserIds = new Set(timeEntriesMonth.map((te: any) => te.user_id));

    // Calculate average utilization
    const totalAvailableHours = availability.reduce((sum: number, a: any) =>
      sum + (a.available_hours || 40), 0
    );
    const avgUtilization = totalAvailableHours > 0
      ? Math.round((hoursLoggedThisWeek / totalAvailableHours) * 100)
      : 0;

    // Process Accounts
    const accounts = accountsData.data || [];
    const activeAccounts = accounts.filter((a: any) => a.status === 'active');
    const tierCounts: Record<string, number> = {};
    accounts.forEach((a: any) => {
      const tier = a.service_tier || 'basic';
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    });

    // Process Workflows
    const workflows = workflowsData.data || [];
    const activeWorkflows = workflows.filter((w: any) => w.status === 'active');
    const completedWorkflowsThisMonth = workflows.filter((w: any) =>
      w.status === 'completed' &&
      w.completed_at &&
      new Date(w.completed_at) >= monthStart
    );

    // Calculate average completion time
    const completedWithTimes = workflows.filter((w: any) =>
      w.status === 'completed' && w.started_at && w.completed_at
    );
    let avgCompletionDays = 0;
    if (completedWithTimes.length > 0) {
      const totalDays = completedWithTimes.reduce((sum: number, w: any) => {
        const start = new Date(w.started_at);
        const end = new Date(w.completed_at);
        return sum + Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      }, 0);
      avgCompletionDays = Math.round(totalDays / completedWithTimes.length);
    }

    // Process Tasks
    const tasks = tasksData.data || [];
    const completedTasks = tasks.filter((t: any) => t.status === 'done' || t.status === 'complete');
    const inProgressTasks = tasks.filter((t: any) => t.status === 'in_progress');
    const overdueTasks = tasks.filter((t: any) => {
      if (!t.due_date || t.status === 'done' || t.status === 'complete') return false;
      return new Date(t.due_date) < now;
    });
    const taskCompletionRate = tasks.length > 0
      ? Math.round((completedTasks.length / tasks.length) * 100)
      : 0;

    // Generate insights
    const insights: string[] = [];

    if (avgUtilization > 90) {
      insights.push(`Team utilization is at ${avgUtilization}% - consider redistributing workload`);
    } else if (avgUtilization < 50) {
      insights.push(`Team utilization is at ${avgUtilization}% - capacity available for new projects`);
    }

    if (overdueTasks.length > 0) {
      insights.push(`${overdueTasks.length} task${overdueTasks.length > 1 ? 's are' : ' is'} overdue`);
    }

    if (completedThisMonth.length > 0) {
      insights.push(`${completedThisMonth.length} project${completedThisMonth.length > 1 ? 's' : ''} completed this month`);
    }

    if (onTimeRate < 80) {
      insights.push(`On-time delivery rate is ${onTimeRate}% - review project timelines`);
    }

    // Build recent activity from project updates
    const projectUpdates = projectUpdatesData.data || [];
    const recentActivity = projectUpdates.map((update: any) => ({
      type: 'update',
      message: `Update on ${(update.projects as any)?.name || 'Unknown Project'}`,
      timestamp: update.created_at,
    }));

    const response: OverviewResponse = {
      projects: {
        total: projects.length,
        active: activeProjects.length,
        completedThisMonth: completedThisMonth.length,
        onTimeRate,
        byStatus: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
        byPriority: Object.entries(priorityCounts).map(([priority, count]) => ({ priority, count })),
      },
      team: {
        totalUsers: users.length,
        activeUsers: activeUserIds.size,
        avgUtilization,
        hoursLoggedThisWeek: Math.round(hoursLoggedThisWeek * 10) / 10,
        hoursLoggedThisMonth: Math.round(hoursLoggedThisMonth * 10) / 10,
      },
      accounts: {
        total: accounts.length,
        active: activeAccounts.length,
        byServiceTier: Object.entries(tierCounts).map(([tier, count]) => ({ tier, count })),
      },
      workflows: {
        active: activeWorkflows.length,
        completedThisMonth: completedWorkflowsThisMonth.length,
        avgCompletionDays,
      },
      tasks: {
        total: tasks.length,
        completed: completedTasks.length,
        inProgress: inProgressTasks.length,
        overdue: overdueTasks.length,
        completionRate: taskCompletionRate,
      },
      recentActivity,
      insights,
    };

    return NextResponse.json({
      success: true,
      data: response,
    });

  } catch (error: unknown) {
    const err = error as ErrorWithMessage;
    console.error('Error in GET /api/analytics/overview:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: err.message },
      { status: 500 }
    );
  }
}

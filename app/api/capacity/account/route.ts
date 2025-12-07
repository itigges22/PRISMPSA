/**
 * API Route: Account Capacity
 * Returns aggregated capacity data for a specific account
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getUserProfileFromRequest } from '@/lib/supabase-server';
import { format, subDays, subWeeks, subMonths, startOfWeek, startOfMonth, startOfQuarter, subQuarters, endOfWeek, endOfMonth, endOfQuarter } from 'date-fns';

type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly';

interface CapacityDataPoint {
  label: string;
  startDate: string;
  endDate: string;
  available: number;
  allocated: number;
  actual: number;
  utilization: number;
}

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

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const period = (searchParams.get('period') ?? 'weekly') as TimePeriod;

    if (!accountId) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400 }
      );
    }

    const ranges = getDateRanges(period);
    const earliestDate = ranges[0].startDate;
    const latestDate = ranges[ranges.length - 1].endDate;

    // Get all projects for this account
    const { data: accountProjects } = await supabase
      .from('projects')
      .select('id')
      .eq('account_id', accountId);

    const projectIds = (accountProjects || []).map((p: any) => p.id);

    if (projectIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: ranges.map(r => ({
          label: r.label,
          startDate: r.startDate,
          endDate: r.endDate,
          available: 0,
          allocated: 0,
          actual: 0,
          utilization: 0,
        })),
        period,
      });
    }

    // Get all users assigned to these projects
    const { data: projectAssignmentsData } = await supabase
      .from('project_assignments')
      .select('user_id, project_id')
      .in('project_id', projectIds)
      .is('removed_at', null);

    const userIds = Array.from(new Set((projectAssignmentsData || []).map((pa: any) => pa.user_id)));

    if (userIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: ranges.map(r => ({
          label: r.label,
          startDate: r.startDate,
          endDate: r.endDate,
          available: 0,
          allocated: 0,
          actual: 0,
          utilization: 0,
        })),
        period,
      });
    }

    // Fetch account data + user's total project assignments (for capacity allocation)
    const [availabilityData, timeEntriesData, projectsData, tasksData, allUserProjectsData] = await Promise.all([
      supabase
        .from('user_availability')
        .select('user_id, week_start_date, available_hours')
        .in('user_id', userIds)
        .gte('week_start_date', earliestDate)
        .lte('week_start_date', latestDate),

      supabase
        .from('time_entries')
        .select('hours_logged, entry_date, project_id')
        .in('user_id', userIds)
        .in('project_id', projectIds)
        .gte('entry_date', earliestDate)
        .lte('entry_date', latestDate),

      supabase
        .from('projects')
        .select('id, estimated_hours, status, start_date, end_date')
        .in('id', projectIds),

      supabase
        .from('tasks')
        .select('id, project_id, estimated_hours, remaining_hours, status, start_date, due_date, created_at, assigned_to')
        .in('project_id', projectIds),

      // Get ALL projects for each user to calculate capacity allocation
      supabase
        .from('project_assignments')
        .select('user_id, project_id, projects!inner(account_id)')
        .in('user_id', userIds)
        .is('removed_at', null)
    ]);

    // Build availability map
    const availabilityMap = new Map<string, Map<string, number>>();
    if (availabilityData.data) {
      availabilityData.data.forEach((a: any) => {
        if (!availabilityMap.has(a.user_id)) {
          availabilityMap.set(a.user_id, new Map());
        }
        availabilityMap.get(a.user_id)?.set(a.week_start_date, a.available_hours);
      });
    }

    // Calculate how many accounts each user is working on (for proportional allocation)
    const userAccountsMap = new Map<string, Set<string>>();
    if (allUserProjectsData.data) {
      allUserProjectsData.data.forEach((assignment: any) => {
        if (!userAccountsMap.has(assignment.user_id)) {
          userAccountsMap.set(assignment.user_id, new Set());
        }
        userAccountsMap.get(assignment.user_id)?.add(assignment.projects.account_id);
      });
    }

    const dataPoints: CapacityDataPoint[] = ranges.map(range => {
      const periodStart = new Date(range.startDate);
      const periodEnd = new Date(range.endDate);

      // Calculate available hours for users working on account projects
      // Proportionally allocate user capacity based on number of accounts they work on
      let totalAvailable = 0;
      userIds.forEach(userId => {
        const userAvailability = availabilityMap.get(userId) ?? new Map();
        const userAccounts = userAccountsMap.get(userId);
        const accountCount = userAccounts ? userAccounts.size : 1;
        const allocationFactor = 1 / accountCount; // Split capacity evenly across accounts

        if (period === 'daily') {
          const weekStart = getWeekStartDate(periodStart);
          const weeklyHours = userAvailability.get(weekStart);
          // Only count if explicitly set, multiply by allocation factor
          if (weeklyHours !== undefined) {
            totalAvailable += (weeklyHours / 5) * allocationFactor;
          }
        } else if (period === 'weekly') {
          const weekStart = getWeekStartDate(periodStart);
          const weeklyHours = userAvailability.get(weekStart);
          // Only count if explicitly set, multiply by allocation factor
          if (weeklyHours !== undefined) {
            totalAvailable += weeklyHours * allocationFactor;
          }
        } else {
          // For monthly/quarterly, sum all weeks in the period
          let currentWeek = new Date(periodStart);
          const dayOfWeek = currentWeek.getDay();
          const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
          currentWeek.setDate(currentWeek.getDate() + daysToMonday);

          while (currentWeek < periodEnd) { // Changed from <= to < to avoid double-counting
            const weekStr = format(currentWeek, 'yyyy-MM-dd');
            const weekHours = userAvailability.get(weekStr);
            // Only count if explicitly set, multiply by allocation factor
            if (weekHours !== undefined) {
              totalAvailable += weekHours * allocationFactor;
            }
            currentWeek.setDate(currentWeek.getDate() + 7);
          }
        }
      });

      // Calculate allocated hours from tasks
      // Only count tasks assigned to users working on this account
      let totalAllocated = (tasksData.data || [])
        .filter((task: any) => {
          // Skip completed tasks
          if (task.status === 'done' || task.status === 'complete') return false;

          // Only count tasks assigned to users in this account (or unassigned tasks)
          if (task.assigned_to && !userIds.includes(task.assigned_to)) return false;

          // Check if task overlaps with period
          const taskStart = task.start_date ? new Date(task.start_date) : new Date(task.created_at);
          const taskEnd = task.due_date ? new Date(task.due_date) : new Date('2099-12-31');
          return taskStart <= periodEnd && taskEnd >= periodStart;
        })
        .reduce((sum, task: any) => {
          const hours = task.remaining_hours ?? task.estimated_hours ?? 0;
          if (hours === 0) return sum;

          const taskStart = task.start_date ? new Date(task.start_date) : new Date(task.created_at);
          const taskEnd = task.due_date ? new Date(task.due_date) : new Date('2099-12-31');
          const taskDurationMs = taskEnd.getTime() - taskStart.getTime();
          const taskDurationDays = Math.max(1, Math.ceil(taskDurationMs / (1000 * 60 * 60 * 24)));
          const dailyRate = hours / taskDurationDays;

          const overlapStart = new Date(Math.max(taskStart.getTime(), periodStart.getTime()));
          const overlapEnd = new Date(Math.min(taskEnd.getTime(), periodEnd.getTime()));
          const overlapMs = overlapEnd.getTime() - overlapStart.getTime();
          const overlapDays = Math.max(1, Math.ceil(overlapMs / (1000 * 60 * 60 * 24)));

          return sum + (dailyRate * overlapDays);
        }, 0);

      // Add project-level estimates for projects with no tasks
      if (projectsData.data) {
        for (const project of projectsData.data) {
          if (project.status === 'complete') continue;

          const projectHasTasks = (tasksData.data || []).some((t: any) => t.project_id === project.id);

          if (!projectHasTasks && project.estimated_hours) {
            const projectStart = project.start_date ? new Date(project.start_date) : new Date();
            const projectEnd = project.end_date ? new Date(project.end_date) : new Date('2099-12-31');

            if (projectStart <= periodEnd && projectEnd >= periodStart) {
              const projectDurationMs = projectEnd.getTime() - projectStart.getTime();
              const projectDurationDays = Math.max(1, Math.ceil(projectDurationMs / (1000 * 60 * 60 * 24)) + 1);
              const dailyRate = project.estimated_hours / projectDurationDays;

              const overlapStart = new Date(Math.max(projectStart.getTime(), periodStart.getTime()));
              const overlapEnd = new Date(Math.min(projectEnd.getTime(), periodEnd.getTime()));
              const overlapMs = overlapEnd.getTime() - overlapStart.getTime();
              const overlapDays = Math.max(0, Math.ceil(overlapMs / (1000 * 60 * 60 * 24)) + 1);

              totalAllocated += dailyRate * overlapDays;
            }
          }
        }
      }

      // Calculate actual hours from time entries on account projects
      const totalActual = (timeEntriesData.data || [])
        .filter((entry: any) => {
          const entryDate = new Date(entry.entry_date);
          return entryDate >= periodStart && entryDate <= periodEnd;
        })
        .reduce((sum: number, entry: any) => sum + (entry.hours_logged || 0), 0);

      const utilization = totalAvailable > 0 ? Math.round((totalActual / totalAvailable) * 100) : 0;

      return {
        label: range.label,
        startDate: range.startDate,
        endDate: range.endDate,
        available: Math.round(totalAvailable * 10) / 10,
        allocated: Math.round(totalAllocated * 10) / 10,
        actual: Math.round(totalActual * 10) / 10,
        utilization,
      };
    });

    return NextResponse.json({
      success: true,
      data: dataPoints,
      period,
    });
  } catch (error: any) {
    console.error('Error in GET /api/capacity/account:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

function getWeekStartDate(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.getFullYear(), d.getMonth(), diff);
  return format(monday, 'yyyy-MM-dd');
}

function getDateRanges(period: TimePeriod): { startDate: string; endDate: string; label: string }[] {
  const ranges: { startDate: string; endDate: string; label: string }[] = [];
  const today = new Date();

  switch (period) {
    case 'daily': {
      for (let i = -7; i <= 7; i++) {
        const date = subDays(today, -i);
        const dateStr = format(date, 'yyyy-MM-dd');
        ranges.push({
          startDate: dateStr,
          endDate: dateStr,
          label: format(date, 'MMM d'),
        });
      }
      break;
    }
    case 'weekly': {
      for (let i = -4; i <= 4; i++) {
        const weekStart = startOfWeek(subWeeks(today, -i), { weekStartsOn: 1 });
        const weekEnd = endOfWeek(subWeeks(today, -i), { weekStartsOn: 1 });
        ranges.push({
          startDate: format(weekStart, 'yyyy-MM-dd'),
          endDate: format(weekEnd, 'yyyy-MM-dd'),
          label: format(weekStart, 'MMM d'),
        });
      }
      break;
    }
    case 'monthly': {
      for (let i = -3; i <= 3; i++) {
        const monthStart = startOfMonth(subMonths(today, -i));
        const monthEnd = endOfMonth(subMonths(today, -i));
        ranges.push({
          startDate: format(monthStart, 'yyyy-MM-dd'),
          endDate: format(monthEnd, 'yyyy-MM-dd'),
          label: format(monthStart, 'MMM yyyy'),
        });
      }
      break;
    }
    case 'quarterly': {
      for (let i = -2; i <= 2; i++) {
        const quarterStart = startOfQuarter(subQuarters(today, -i));
        const quarterEnd = endOfQuarter(subQuarters(today, -i));
        ranges.push({
          startDate: format(quarterStart, 'yyyy-MM-dd'),
          endDate: format(quarterEnd, 'yyyy-MM-dd'),
          label: `Q${Math.floor(quarterStart.getMonth() / 3) + 1} ${format(quarterStart, 'yyyy')}`,
        });
      }
      break;
    }
  }

  return ranges;
}

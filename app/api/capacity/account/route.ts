/**
 * API Route: Account Capacity
 * Returns aggregated capacity data for a specific account
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getUserProfileFromRequest } from '@/lib/supabase-server';
import { format, subDays, subWeeks, subMonths, startOfWeek, startOfMonth, startOfQuarter, subQuarters, endOfWeek, endOfMonth, endOfQuarter } from 'date-fns';

// Type definitions
interface ErrorWithMessage extends Error {
  message: string;
  status?: number;
}

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

    console.log('[Capacity API] Account:', accountId, 'Period:', period, 'Date range:', earliestDate, 'to', latestDate);

    // Get all projects for this account
    const { data: accountProjects, error: projectsError } = await supabase
      .from('projects')
      .select('id')
      .eq('account_id', accountId);

    if (projectsError) {
      console.error('[Capacity API] Error fetching projects:', projectsError);
    }

    const projectIds = (accountProjects || []).map((p: any) => p.id);
    console.log('[Capacity API] Found', projectIds.length, 'projects for account');

    if (projectIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: ranges.map((r: any) => ({
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
    const { data: projectAssignmentsData, error: assignmentsError } = await supabase
      .from('project_assignments')
      .select('user_id, project_id')
      .in('project_id', projectIds)
      .is('removed_at', null);

    if (assignmentsError) {
      console.error('[Capacity API] Error fetching assignments:', assignmentsError);
    }

    const userIds = Array.from(new Set((projectAssignmentsData || []).map((pa: any) => pa.user_id as string)));
    console.log('[Capacity API] Found', userIds.length, 'unique users assigned to projects');

    if (userIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: ranges.map((r: any) => ({
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

    // Debug logging
    console.log('[Capacity API] Data fetched:');
    console.log('  - Availability records:', availabilityData.data?.length || 0, availabilityData.error ? `(error: ${availabilityData.error.message})` : '');
    console.log('  - Time entries:', timeEntriesData.data?.length || 0, timeEntriesData.error ? `(error: ${timeEntriesData.error.message})` : '');
    console.log('  - Tasks:', tasksData.data?.length || 0, tasksData.error ? `(error: ${tasksData.error.message})` : '');

    // Log sample availability data to check format
    if (availabilityData.data && availabilityData.data.length > 0) {
      console.log('  - Sample availability:', JSON.stringify(availabilityData.data[0]));
    }

    // Build a map of project end dates for tasks to inherit when they have no due_date
    const projectEndDateMap = new Map<string, Date | null>();
    if (projectsData.data) {
      for (const project of projectsData.data) {
        const endDate = project.end_date ? new Date(project.end_date) : null;
        projectEndDateMap.set(project.id, endDate);
      }
    }

    // Build availability map
    const availabilityMap = new Map<string, Map<string, number>>();
    if (availabilityData.data) {
      availabilityData.data.forEach((a: any) => {
        const userId = a.user_id as string;
        const weekStartDate = a.week_start_date as string;
        const availableHours = a.available_hours as number;

        if (!availabilityMap.has(userId)) {
          availabilityMap.set(userId, new Map<string, number>());
        }
        availabilityMap.get(userId)?.set(weekStartDate, availableHours);
      });
    }

    // Calculate how many accounts each user is working on (for proportional allocation)
    const userAccountsMap = new Map<string, Set<string>>();
    if (allUserProjectsData.data) {
      allUserProjectsData.data.forEach((assignment: any) => {
        const userId = assignment.user_id as string;
        const projects = assignment.projects as Record<string, unknown>;
        const accountId = projects.account_id as string;

        if (!userAccountsMap.has(userId)) {
          userAccountsMap.set(userId, new Set<string>());
        }
        userAccountsMap.get(userId)?.add(accountId);
      });
    }

    const dataPoints: CapacityDataPoint[] = ranges.map((range: any) => {
      const periodStart = new Date(range.startDate);
      const periodEnd = new Date(range.endDate);

      // Calculate available hours for users working on account projects
      // Proportionally allocate user capacity based on number of accounts they work on
      let totalAvailable = 0;
      userIds.forEach(userId => {
        const userAvailability = availabilityMap.get(userId) ?? new Map<string, number>();
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
          const currentWeek = new Date(periodStart);
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
      const incompleteTasks = (tasksData.data || []).filter((task: any) => {
        // Skip completed tasks
        if (task.status === 'done' || task.status === 'complete') return false;
        // Only count tasks assigned to users in this account (or unassigned tasks)
        if (task.assigned_to && !userIds.includes(task.assigned_to as string)) return false;
        return true;
      });

      const now = new Date();
      let totalAllocated = incompleteTasks.reduce((sum, task: any) => {
        const hours = ((task.remaining_hours ?? task.estimated_hours ?? 0) as number);
        if (hours === 0) return sum;

        const taskStart = task.start_date ? new Date(task.start_date as string) : new Date(task.created_at as string);
        // IMPORTANT: If task has no due_date, inherit from parent project's end_date
        // This ensures tasks in overdue projects are correctly treated as overdue
        const taskOwnDueDate = task.due_date ? new Date(task.due_date as string) : null;
        const projectEndDate = task.project_id ? projectEndDateMap.get(task.project_id as string) : null;
        const taskDueDate = taskOwnDueDate ?? projectEndDate;

        // CASE 1: Task is OVERDUE (due date is in the past)
        if (taskDueDate && taskDueDate < now) {
          // Allocate all remaining hours to the current period
          if (periodStart <= now && periodEnd >= now) {
            return sum + hours;
          }
          return sum; // Don't count in past or future periods
        }

        // CASE 2: Task has no due date - spread over 90 days from now
        if (!taskDueDate) {
          const effectiveEnd = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
          const effectiveStart = taskStart > now ? taskStart : now;

          if (effectiveStart > periodEnd || effectiveEnd < periodStart) return sum;

          const durationDays = Math.max(1, Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)));
          const dailyRate = hours / durationDays;

          const overlapStart = new Date(Math.max(effectiveStart.getTime(), periodStart.getTime()));
          const overlapEnd = new Date(Math.min(effectiveEnd.getTime(), periodEnd.getTime()));
          const overlapDays = Math.max(0, Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);

          return sum + (dailyRate * overlapDays);
        }

        // CASE 3: Task has a FUTURE due date - spread from now until due date
        const effectiveStart = taskStart > now ? taskStart : now;
        if (effectiveStart > periodEnd) return sum;

        const remainingDurationMs = taskDueDate.getTime() - effectiveStart.getTime();
        const remainingDurationDays = Math.max(1, Math.ceil(remainingDurationMs / (1000 * 60 * 60 * 24)));
        const dailyRate = hours / remainingDurationDays;

        const overlapStart = new Date(Math.max(effectiveStart.getTime(), periodStart.getTime()));
        const overlapEnd = new Date(Math.min(taskDueDate.getTime(), periodEnd.getTime()));
        const overlapMs = overlapEnd.getTime() - overlapStart.getTime();
        const overlapDays = Math.max(0, Math.ceil(overlapMs / (1000 * 60 * 60 * 24)) + 1);

        return sum + (dailyRate * overlapDays);
      }, 0);

      // Add project-level estimates for projects with no tasks
      if (projectsData.data) {
        for (const project of projectsData.data) {
          if (project.status === 'complete') continue;

          const projectHasTasks = (tasksData.data || []).some((t: any) => t.project_id === project.id);

          if (!projectHasTasks && project.estimated_hours) {
            const projectStart = project.start_date ? new Date(project.start_date) : new Date();
            const projectDueDate = project.end_date ? new Date(project.end_date) : null;
            const estimatedHours = project.estimated_hours;

            // CASE 1: Project is OVERDUE
            if (projectDueDate && projectDueDate < now) {
              if (periodStart <= now && periodEnd >= now) {
                totalAllocated += estimatedHours;
              }
              continue;
            }

            // CASE 2: No due date - spread over 90 days from now
            if (!projectDueDate) {
              const effectiveEnd = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
              const effectiveStart = projectStart > now ? projectStart : now;

              if (effectiveStart <= periodEnd && effectiveEnd >= periodStart) {
                const durationDays = Math.max(1, Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)));
                const dailyRate = estimatedHours / durationDays;

                const overlapStart = new Date(Math.max(effectiveStart.getTime(), periodStart.getTime()));
                const overlapEnd = new Date(Math.min(effectiveEnd.getTime(), periodEnd.getTime()));
                const overlapDays = Math.max(0, Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);

                totalAllocated += dailyRate * overlapDays;
              }
              continue;
            }

            // CASE 3: Future due date - spread from now until due date
            const effectiveStart = projectStart > now ? projectStart : now;
            if (effectiveStart > periodEnd) continue;

            const remainingDurationMs = projectDueDate.getTime() - effectiveStart.getTime();
            const remainingDurationDays = Math.max(1, Math.ceil(remainingDurationMs / (1000 * 60 * 60 * 24)));
            const dailyRate = estimatedHours / remainingDurationDays;

            const overlapStart = new Date(Math.max(effectiveStart.getTime(), periodStart.getTime()));
            const overlapEnd = new Date(Math.min(projectDueDate.getTime(), periodEnd.getTime()));
            const overlapMs = overlapEnd.getTime() - overlapStart.getTime();
            const overlapDays = Math.max(0, Math.ceil(overlapMs / (1000 * 60 * 60 * 24)) + 1);

            totalAllocated += dailyRate * overlapDays;
          }
        }
      }

      // Calculate actual hours from time entries on account projects
      const totalActual = (timeEntriesData.data || [])
        .filter((entry: any) => {
          const entryDate = new Date(entry.entry_date as string);
          return entryDate >= periodStart && entryDate <= periodEnd;
        })
        .reduce((sum: number, entry: any) => sum + ((entry.hours_logged as number) || 0), 0);

      const utilization = totalAvailable > 0 ? Math.round((totalActual / totalAvailable) * 100) : 0;

      // Ensure all values are valid finite numbers (NaN/Infinity breaks chart lines)
      const safeAvailable = Number.isFinite(totalAvailable) ? Math.round(totalAvailable * 10) / 10 : 0;
      const safeAllocated = Number.isFinite(totalAllocated) ? Math.round(totalAllocated * 10) / 10 : 0;
      const safeActual = Number.isFinite(totalActual) ? Math.round(totalActual * 10) / 10 : 0;
      const safeUtilization = Number.isFinite(utilization) ? utilization : 0;

      return {
        label: range.label,
        startDate: range.startDate,
        endDate: range.endDate,
        available: safeAvailable,
        allocated: safeAllocated,
        actual: safeActual,
        utilization: safeUtilization,
      };
    });

    // Log final computed data
    console.log('[Capacity API] Computed', dataPoints.length, 'data points');
    const hasNonZero = dataPoints.some(dp => dp.available > 0 || dp.allocated > 0 || dp.actual > 0);
    console.log('[Capacity API] Has non-zero data:', hasNonZero);
    if (dataPoints.length > 0) {
      console.log('[Capacity API] Sample data point:', JSON.stringify(dataPoints[0]));
    }

    return NextResponse.json({
      success: true,
      data: dataPoints,
      period,
    });
  } catch (error: unknown) {
    const err = error as ErrorWithMessage;
console.error('Error in GET /api/capacity/account:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: err.message },
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

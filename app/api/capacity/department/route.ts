/**
 * API Route: Department Capacity
 * Returns aggregated capacity data for a specific department
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
    const departmentId = searchParams.get('departmentId');
    const period = (searchParams.get('period') ?? 'weekly') as TimePeriod;

    if (!departmentId) {
      return NextResponse.json(
        { error: 'Department ID is required' },
        { status: 400 }
      );
    }

    const ranges = getDateRanges(period);
    const earliestDate = ranges[0].startDate;
    const latestDate = ranges[ranges.length - 1].endDate;

    // Get all roles in this department
    const { data: departmentRoles } = await supabase
      .from('roles')
      .select('id')
      .eq('department_id', departmentId);

    const roleIds = (departmentRoles || []).map((r: any) => r.id);

    if (roleIds.length === 0) {
      // No roles in department, return empty data
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

    // Get all users with these roles
    const { data: userRolesData } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role_id', roleIds);

    const userIds = Array.from(new Set((userRolesData || []).map((ur: any) => ur.user_id as string)));

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

    // Fetch department data
    const [availabilityData, timeEntriesData, projectAssignmentsData, tasksData] = await Promise.all([
      supabase
        .from('user_availability')
        .select('user_id, week_start_date, available_hours')
        .in('user_id', userIds)
        .gte('week_start_date', earliestDate)
        .lte('week_start_date', latestDate),

      supabase
        .from('time_entries')
        .select('hours_logged, entry_date')
        .in('user_id', userIds)
        .gte('entry_date', earliestDate)
        .lte('entry_date', latestDate),

      supabase
        .from('project_assignments')
        .select(`
          user_id,
          project_id,
          projects!inner (
            id,
            estimated_hours,
            status,
            start_date,
            end_date
          )
        `)
        .in('user_id', userIds)
        .is('removed_at', null),

      supabase
        .from('tasks')
        .select('id, project_id, estimated_hours, remaining_hours, status, start_date, due_date, created_at, assigned_to')
        .in('assigned_to', userIds)
    ]);

    const projectIds = Array.from(new Set((projectAssignmentsData.data || []).map((pa: any) => pa.project_id)));
    let projectTasksData = null;
    if (projectIds.length > 0) {
      const { data } = await supabase
        .from('tasks')
        .select('id, project_id, estimated_hours, remaining_hours, status, start_date, due_date, created_at')
        .in('project_id', projectIds);
      projectTasksData = data;
    }

    // Build a map of project end dates for tasks to inherit when they have no due_date
    const projectEndDateMap = new Map<string, Date | null>();
    if (projectAssignmentsData.data) {
      for (const pa of projectAssignmentsData.data) {
        const project = Array.isArray(pa.projects) ? pa.projects[0] : pa.projects;
        if (project) {
          const projectId = (project as Record<string, unknown>).id as string;
          const endDate = (project as Record<string, unknown>).end_date
            ? new Date((project as Record<string, unknown>).end_date as string)
            : null;
          projectEndDateMap.set(projectId, endDate);
        }
      }
    }

    const availabilityMap = new Map<string, Map<string, number>>();
    if (availabilityData.data) {
      availabilityData.data.forEach((a: any) => {
        const userId = a.user_id as string;
        const weekStartDate = a.week_start_date as string;
        const availableHours = a.available_hours as number;

        if (!availabilityMap.has(userId)) {
          availabilityMap.set(userId, new Map<string, number>());
        }
        availabilityMap.get(userId)!.set(weekStartDate, availableHours);
      });
    }

    const dataPoints: CapacityDataPoint[] = ranges.map((range: any) => {
      const periodStart = new Date(range.startDate);
      const periodEnd = new Date(range.endDate);

      let totalAvailable = 0;
      userIds.forEach(userId => {
        const userAvailability = availabilityMap.get(userId) ?? new Map<string, number>();

        if (period === 'daily') {
          const weekStart = getWeekStartDate(periodStart);
          const weeklyHours = userAvailability.get(weekStart) ?? 0;
          totalAvailable += weeklyHours / 5;
        } else if (period === 'weekly') {
          const weekStart = getWeekStartDate(periodStart);
          totalAvailable += userAvailability.get(weekStart) ?? 0;
        } else {
          const currentWeek = new Date(periodStart);
          const dayOfWeek = currentWeek.getDay();
          const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
          currentWeek.setDate(currentWeek.getDate() + daysToMonday);

          while (currentWeek <= periodEnd) {
            const weekStr = format(currentWeek, 'yyyy-MM-dd');
            const weekHours = userAvailability.get(weekStr) ?? 0;
            totalAvailable += weekHours;
            currentWeek.setDate(currentWeek.getDate() + 7);
          }
        }
      });

      const allTasks = [
        ...(tasksData.data || []),
        ...(projectTasksData ?? [])
      ];
      const uniqueTasks = Array.from(new Map(allTasks.map((t: any) => [t.id, t])).values());

      // Filter to incomplete tasks only
      const incompleteTasks = uniqueTasks.filter((task: any) => {
        return task.status !== 'done' && task.status !== 'complete';
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

        // CASE 1: Task is OVERDUE
        if (taskDueDate && taskDueDate < now) {
          if (periodStart <= now && periodEnd >= now) {
            return sum + hours;
          }
          return sum;
        }

        // CASE 2: No due date - spread over 90 days
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

        // CASE 3: Future due date
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
      if (projectAssignmentsData.data) {
        for (const pa of projectAssignmentsData.data) {
          const project = Array.isArray(pa.projects) ? pa.projects[0] : pa.projects;
          if (!project || (project as Record<string, unknown>).status === 'complete') continue;

          const projectHasTasks = (projectTasksData || []).some((t: any) => t.project_id === (project as Record<string, unknown>).id);

          if (!projectHasTasks && (project as Record<string, unknown>).estimated_hours) {
            const projectStart = (project as Record<string, unknown>).start_date ? new Date((project as Record<string, unknown>).start_date as string) : new Date();
            const projectDueDate = (project as Record<string, unknown>).end_date ? new Date((project as Record<string, unknown>).end_date as string) : null;
            const estimatedHours = (project as Record<string, unknown>).estimated_hours as number;

            // CASE 1: Project is OVERDUE
            if (projectDueDate && projectDueDate < now) {
              if (periodStart <= now && periodEnd >= now) {
                totalAllocated += estimatedHours;
              }
              continue;
            }

            // CASE 2: No due date
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

            // CASE 3: Future due date
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

      const totalActual = (timeEntriesData.data || [])
        .filter((entry: any) => {
          const entryDate = new Date(entry.entry_date as string);
          return entryDate >= periodStart && entryDate <= periodEnd;
        })
        .reduce((sum: number, entry: any) => sum + ((entry.hours_logged as number) || 0), 0);

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
  } catch (error: unknown) {
    const err = error as ErrorWithMessage;
console.error('Error in GET /api/capacity/department:', error);
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

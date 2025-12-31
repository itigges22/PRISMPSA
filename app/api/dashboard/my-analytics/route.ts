/**
 * API Route: My Analytics
 * Returns personal analytics data for the authenticated user
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getUserProfileFromRequest } from '@/lib/supabase-server';
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
  format,
  getDay,
  isAfter,
  isBefore,
  parseISO
} from 'date-fns';

export const dynamic = 'force-dynamic';

interface TimeEntry {
  hours_logged: number;
  entry_date: string;
}

interface Task {
  id: string;
  name: string;
  status: string;
  due_date: string | null;
  project_id: string;
  projects?: { name: string }[] | { name: string } | null;
  updated_at: string;
}

interface Allocation {
  allocated_hours: number;
}

interface Availability {
  available_hours: number;
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

    const userId = userProfile.id;
    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');

    // Calculate week start (Monday)
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');
    const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

    // Calculate month range
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const monthStartStr = format(monthStart, 'yyyy-MM-dd');
    const monthEndStr = format(monthEnd, 'yyyy-MM-dd');

    // Last 30 days for daily average
    const thirtyDaysAgo = subDays(now, 30);
    const thirtyDaysAgoStr = format(thirtyDaysAgo, 'yyyy-MM-dd');

    // Fetch all data in parallel
    const [
      todayTimeResult,
      weekTimeResult,
      monthTimeResult,
      last30DaysResult,
      tasksResult,
      availabilityResult,
      allocationsResult,
    ] = await Promise.all([
      // Hours today
      supabase
        .from('time_entries')
        .select('hours_logged')
        .eq('user_id', userId)
        .eq('entry_date', today),

      // Hours this week
      supabase
        .from('time_entries')
        .select('hours_logged, entry_date')
        .eq('user_id', userId)
        .gte('entry_date', weekStartStr)
        .lte('entry_date', weekEndStr),

      // Hours this month
      supabase
        .from('time_entries')
        .select('hours_logged')
        .eq('user_id', userId)
        .gte('entry_date', monthStartStr)
        .lte('entry_date', monthEndStr),

      // Last 30 days for daily average and trend
      supabase
        .from('time_entries')
        .select('hours_logged, entry_date')
        .eq('user_id', userId)
        .gte('entry_date', thirtyDaysAgoStr)
        .lte('entry_date', today)
        .order('entry_date', { ascending: true }),

      // User's assigned tasks
      supabase
        .from('tasks')
        .select('id, name, status, due_date, project_id, updated_at, projects(name)')
        .eq('assigned_to', userId)
        .neq('status', 'done'),

      // User availability for current week
      supabase
        .from('user_availability')
        .select('available_hours')
        .eq('user_id', userId)
        .eq('week_start_date', weekStartStr)
        .single(),

      // Task allocations for current week
      supabase
        .from('task_week_allocations')
        .select('allocated_hours')
        .eq('assigned_user_id', userId)
        .eq('week_start_date', weekStartStr),
    ]);

    // Also get completed tasks this week
    const completedThisWeekResult = await supabase
      .from('tasks')
      .select('id')
      .eq('assigned_to', userId)
      .eq('status', 'done')
      .gte('updated_at', weekStartStr);

    // Calculate time metrics
    const hoursToday = (todayTimeResult.data as TimeEntry[] || [])
      .reduce((sum, e) => sum + (e.hours_logged || 0), 0);

    const weekEntries = weekTimeResult.data as TimeEntry[] || [];
    const hoursThisWeek = weekEntries.reduce((sum, e) => sum + (e.hours_logged || 0), 0);

    const hoursThisMonth = (monthTimeResult.data as TimeEntry[] || [])
      .reduce((sum, e) => sum + (e.hours_logged || 0), 0);

    // Calculate daily average (only counting days with entries)
    const last30DaysEntries = last30DaysResult.data as TimeEntry[] || [];
    const uniqueDaysWithEntries = new Set(last30DaysEntries.map(e => e.entry_date)).size;
    const totalHoursLast30Days = last30DaysEntries.reduce((sum, e) => sum + (e.hours_logged || 0), 0);
    const dailyAverage = uniqueDaysWithEntries > 0
      ? Math.round((totalHoursLast30Days / uniqueDaysWithEntries) * 10) / 10
      : 0;

    // Calculate 7-day trend (hours per day for last 7 days)
    const last7Days: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = format(subDays(now, i), 'yyyy-MM-dd');
      const dayHours = last30DaysEntries
        .filter(e => e.entry_date === day)
        .reduce((sum, e) => sum + (e.hours_logged || 0), 0);
      last7Days.push(Math.round(dayHours * 10) / 10);
    }

    // Get weekly target from availability (default 40)
    const weeklyTarget = (availabilityResult.data as Availability)?.available_hours || 40;

    // Calculate task metrics
    const tasks = tasksResult.data as Task[] || [];

    const inProgress = tasks.filter(t => t.status === 'in_progress').length;

    const dueThisWeek = tasks.filter(t => {
      if (!t.due_date) return false;
      const dueDate = parseISO(t.due_date);
      return !isBefore(dueDate, weekStart) && !isAfter(dueDate, weekEnd);
    }).length;

    const overdue = tasks.filter(t => {
      if (!t.due_date) return false;
      const dueDate = parseISO(t.due_date);
      return isBefore(dueDate, now) && t.status !== 'done';
    }).length;

    const completedThisWeek = completedThisWeekResult.data?.length || 0;

    // Get urgent tasks - prioritize overdue tasks, then sort by nearest due dates
    // Include up to 5 tasks to ensure overdue tasks are visible
    const urgentTasks = tasks
      .filter(t => t.due_date && t.status !== 'done')
      .sort((a, b) => {
        // Use parseISO for consistent date parsing
        const dateA = parseISO(a.due_date!).getTime();
        const dateB = parseISO(b.due_date!).getTime();
        return dateA - dateB;
      })
      .slice(0, 5)
      .map(t => {
        // Handle both array and single object for projects relation
        const projectData = t.projects;
        let projectName = 'Unknown Project';
        if (Array.isArray(projectData) && projectData.length > 0) {
          projectName = projectData[0].name;
        } else if (projectData && typeof projectData === 'object' && 'name' in projectData) {
          projectName = (projectData as { name: string }).name;
        }
        // Check if this task is overdue
        const dueDate = parseISO(t.due_date!);
        const isOverdue = isBefore(dueDate, now);
        return {
          id: t.id,
          name: t.name,
          projectId: t.project_id,
          projectName,
          dueDate: t.due_date!,
          status: t.status,
          isOverdue,
        };
      });

    // Task status breakdown (including done tasks for display)
    const allTasksResult = await supabase
      .from('tasks')
      .select('status')
      .eq('assigned_to', userId);

    const allTasks = allTasksResult.data || [];
    const statusBreakdown = {
      backlog: allTasks.filter(t => t.status === 'backlog').length,
      todo: allTasks.filter(t => t.status === 'todo').length,
      inProgress: allTasks.filter(t => t.status === 'in_progress').length,
      review: allTasks.filter(t => t.status === 'review').length,
      done: allTasks.filter(t => t.status === 'done').length,
      blocked: allTasks.filter(t => t.status === 'blocked').length,
    };

    // Calculate capacity metrics
    const availableHours = weeklyTarget;
    const allocatedHours = (allocationsResult.data as Allocation[] || [])
      .reduce((sum, a) => sum + (a.allocated_hours || 0), 0);
    const loggedHours = hoursThisWeek;

    const utilizationRate = availableHours > 0
      ? Math.round((loggedHours / availableHours) * 100)
      : 0;

    const remainingCapacity = Math.max(0, availableHours - loggedHours);

    // Calculate week progress (what day of the work week is it?)
    // 0 = Sunday, 1 = Monday, etc.
    const dayOfWeek = getDay(now);
    // Work week is Mon-Fri (days 1-5)
    const workDaysPassed = dayOfWeek === 0 ? 5 : Math.min(dayOfWeek, 5);
    const weekProgress = Math.round((workDaysPassed / 5) * 100);

    // Calculate expected hours based on week progress
    const expectedHours = (availableHours * weekProgress) / 100;

    // Determine status
    let status: 'on_track' | 'behind' | 'ahead' = 'on_track';
    const tolerance = availableHours * 0.1; // 10% tolerance

    if (loggedHours < expectedHours - tolerance) {
      status = 'behind';
    } else if (loggedHours > expectedHours + tolerance) {
      status = 'ahead';
    }

    return NextResponse.json({
      success: true,
      data: {
        time: {
          hoursToday: Math.round(hoursToday * 10) / 10,
          hoursThisWeek: Math.round(hoursThisWeek * 10) / 10,
          hoursThisMonth: Math.round(hoursThisMonth * 10) / 10,
          weeklyTarget,
          dailyAverage,
          weeklyTrend: last7Days,
        },
        tasks: {
          inProgress,
          dueThisWeek,
          overdue,
          completedThisWeek,
          urgent: urgentTasks,
          statusBreakdown,
        },
        capacity: {
          availableHours,
          allocatedHours: Math.round(allocatedHours * 10) / 10,
          loggedHours: Math.round(loggedHours * 10) / 10,
          utilizationRate,
          remainingCapacity: Math.round(remainingCapacity * 10) / 10,
          weekProgress,
          status,
        },
      },
    });

  } catch (error: unknown) {
    console.error('Error in GET /api/dashboard/my-analytics:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: (error as Error).message },
      { status: 500 }
    );
  }
}

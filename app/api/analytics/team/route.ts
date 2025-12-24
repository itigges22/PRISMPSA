/**
 * API Route: Team Analytics
 * Returns detailed team performance metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getUserProfileFromRequest } from '@/lib/supabase-server';
import { subDays, format, startOfWeek, eachDayOfInterval, getDay } from 'date-fns';

interface ErrorWithMessage extends Error {
  message: string;
  status?: number;
}

type DateRangeType = '7d' | '30d' | '90d' | 'ytd' | 'all';

function getDateRange(range: DateRangeType): { start: Date; end: Date } {
  const now = new Date();
  const end = now;

  switch (range) {
    case '7d':
      return { start: subDays(now, 7), end };
    case '30d':
      return { start: subDays(now, 30), end };
    case '90d':
      return { start: subDays(now, 90), end };
    case 'ytd':
      return { start: new Date(now.getFullYear(), 0, 1), end };
    case 'all':
      return { start: new Date(2020, 0, 1), end };
    default:
      return { start: subDays(now, 30), end };
  }
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

    const { searchParams } = new URL(request.url);
    const dateRange = (searchParams.get('dateRange') || '30d') as DateRangeType;
    const departmentId = searchParams.get('departmentId');

    const { start, end } = getDateRange(dateRange);
    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

    // Fetch data in parallel
    const [usersData, timeEntriesData, availabilityData, tasksData, departmentsData, rolesData, userRolesData] = await Promise.all([
      supabase.from('user_profiles').select('id, name, email, workload_sentiment, created_at'),
      supabase
        .from('time_entries')
        .select('user_id, hours_logged, entry_date')
        .gte('entry_date', startStr)
        .lte('entry_date', endStr),
      supabase
        .from('user_availability')
        .select('user_id, available_hours, week_start_date')
        .eq('week_start_date', format(weekStart, 'yyyy-MM-dd')),
      supabase
        .from('tasks')
        .select('id, assigned_to, status')
        .gte('created_at', startStr),
      supabase.from('departments').select('id, name'),
      supabase.from('roles').select('id, name, department_id'),
      supabase.from('user_roles').select('user_id, role_id'),
    ]);

    const users = usersData.data || [];
    const timeEntries = timeEntriesData.data || [];
    const availability = availabilityData.data || [];
    const tasks = tasksData.data || [];
    const departments = departmentsData.data || [];
    const roles = rolesData.data || [];
    const userRoles = userRolesData.data || [];

    // Filter users by department if specified
    let filteredUserIds = users.map((u: any) => u.id);
    if (departmentId) {
      const deptRoleIds = roles
        .filter((r: any) => r.department_id === departmentId)
        .map((r: any) => r.id);
      filteredUserIds = userRoles
        .filter((ur: any) => deptRoleIds.includes(ur.role_id))
        .map((ur: any) => ur.user_id);
    }

    const filteredUsers = users.filter((u: any) => filteredUserIds.includes(u.id));
    const filteredTimeEntries = timeEntries.filter((te: any) => filteredUserIds.includes(te.user_id));

    // Calculate utilization data per user
    const utilizationData: { name: string; utilization: number; hoursLogged: number }[] = [];
    const availabilityMap = new Map<string, number>();
    availability.forEach((a: any) => {
      availabilityMap.set(a.user_id, a.available_hours || 40);
    });

    const userHoursMap = new Map<string, number>();
    filteredTimeEntries.forEach((te: any) => {
      const current = userHoursMap.get(te.user_id) || 0;
      userHoursMap.set(te.user_id, current + (te.hours_logged || 0));
    });

    filteredUsers.forEach((user: any) => {
      const hoursLogged = userHoursMap.get(user.id) || 0;
      const availableHours = availabilityMap.get(user.id) || 40;
      // Calculate expected hours based on date range
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const weeks = Math.max(1, days / 7);
      const expectedHours = availableHours * weeks;
      const utilization = expectedHours > 0 ? Math.round((hoursLogged / expectedHours) * 100) : 0;

      utilizationData.push({
        name: user.name?.split(' ')[0] || 'Unknown',
        utilization: Math.min(200, utilization), // Cap at 200%
        hoursLogged: Math.round(hoursLogged * 10) / 10,
      });
    });

    // Sort by hours logged and take top 10
    utilizationData.sort((a, b) => b.hoursLogged - a.hoursLogged);
    const topPerformers = utilizationData.slice(0, 10);

    // Calculate workload distribution
    const workloadBuckets = {
      'Under 60%': 0,
      '60-80%': 0,
      '80-100%': 0,
      'Over 100%': 0,
    };

    utilizationData.forEach(u => {
      if (u.utilization < 60) workloadBuckets['Under 60%']++;
      else if (u.utilization < 80) workloadBuckets['60-80%']++;
      else if (u.utilization <= 100) workloadBuckets['80-100%']++;
      else workloadBuckets['Over 100%']++;
    });

    const workloadDistribution = [
      { range: 'Under 60%', count: workloadBuckets['Under 60%'], color: '#94a3b8' },
      { range: '60-80%', count: workloadBuckets['60-80%'], color: '#22c55e' },
      { range: '80-100%', count: workloadBuckets['80-100%'], color: '#3b82f6' },
      { range: 'Over 100%', count: workloadBuckets['Over 100%'], color: '#ef4444' },
    ];

    // Sentiment aggregation
    const sentimentCounts = {
      comfortable: 0,
      stretched: 0,
      overwhelmed: 0,
      unknown: 0,
    };

    filteredUsers.forEach((u: any) => {
      const sentiment = u.workload_sentiment || 'unknown';
      if (sentiment in sentimentCounts) {
        sentimentCounts[sentiment as keyof typeof sentimentCounts]++;
      }
    });

    const sentimentData = [
      { sentiment: 'Comfortable', count: sentimentCounts.comfortable, color: '#22c55e' },
      { sentiment: 'Stretched', count: sentimentCounts.stretched, color: '#f59e0b' },
      { sentiment: 'Overwhelmed', count: sentimentCounts.overwhelmed, color: '#ef4444' },
    ].filter(s => s.count > 0);

    // Activity by day of week (heatmap data)
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const activityByDay: { day: string; hours: number }[] = dayNames.map(day => ({
      day,
      hours: 0,
    }));

    filteredTimeEntries.forEach((te: any) => {
      const dayOfWeek = getDay(new Date(te.entry_date));
      activityByDay[dayOfWeek].hours += te.hours_logged || 0;
    });

    // Rearrange to start from Monday
    const activityByDayOrdered = [
      activityByDay[1], // Mon
      activityByDay[2], // Tue
      activityByDay[3], // Wed
      activityByDay[4], // Thu
      activityByDay[5], // Fri
      activityByDay[6], // Sat
      activityByDay[0], // Sun
    ];

    // Calculate department breakdown
    const departmentStats: { name: string; users: number; hours: number }[] = [];
    departments.forEach((dept: any) => {
      const deptRoleIds = roles
        .filter((r: any) => r.department_id === dept.id)
        .map((r: any) => r.id);
      const deptUserIds = userRoles
        .filter((ur: any) => deptRoleIds.includes(ur.role_id))
        .map((ur: any) => ur.user_id);
      const uniqueDeptUserIds = [...new Set(deptUserIds)];
      const deptHours = timeEntries
        .filter((te: any) => deptUserIds.includes(te.user_id))
        .reduce((sum: number, te: any) => sum + (te.hours_logged || 0), 0);

      if (uniqueDeptUserIds.length > 0) {
        departmentStats.push({
          name: dept.name.length > 15 ? dept.name.substring(0, 12) + '...' : dept.name,
          users: uniqueDeptUserIds.length,
          hours: Math.round(deptHours * 10) / 10,
        });
      }
    });

    departmentStats.sort((a, b) => b.hours - a.hours);

    // Calculate summary metrics
    const totalHoursLogged = filteredTimeEntries.reduce((sum: number, te: any) =>
      sum + (te.hours_logged || 0), 0
    );
    const avgHoursPerUser = filteredUsers.length > 0
      ? Math.round((totalHoursLogged / filteredUsers.length) * 10) / 10
      : 0;
    const avgUtilization = utilizationData.length > 0
      ? Math.round(utilizationData.reduce((sum, u) => sum + u.utilization, 0) / utilizationData.length)
      : 0;

    // Task completion rate
    const completedTasks = tasks.filter((t: any) =>
      filteredUserIds.includes(t.assigned_to) &&
      (t.status === 'done' || t.status === 'complete')
    ).length;
    const totalAssignedTasks = tasks.filter((t: any) =>
      filteredUserIds.includes(t.assigned_to)
    ).length;
    const taskCompletionRate = totalAssignedTasks > 0
      ? Math.round((completedTasks / totalAssignedTasks) * 100)
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalUsers: filteredUsers.length,
          activeUsers: userHoursMap.size,
          avgUtilization,
          totalHoursLogged: Math.round(totalHoursLogged * 10) / 10,
          avgHoursPerUser,
          taskCompletionRate,
        },
        topPerformers,
        workloadDistribution,
        sentimentData,
        activityByDay: activityByDayOrdered,
        departmentStats: departmentStats.slice(0, 6),
      },
      dateRange,
    });

  } catch (error: unknown) {
    const err = error as ErrorWithMessage;
    console.error('Error in GET /api/analytics/team:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: err.message },
      { status: 500 }
    );
  }
}

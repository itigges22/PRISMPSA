/**
 * API Route: Time Analytics
 * Returns time distribution and tracking metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getUserProfileFromRequest } from '@/lib/supabase-server';
import { subDays, format, getDay, parseISO, eachDayOfInterval } from 'date-fns';

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

    const { start, end } = getDateRange(dateRange);
    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');

    // Fetch data
    const [timeEntriesData, projectsData, usersData] = await Promise.all([
      supabase
        .from('time_entries')
        .select('id, user_id, project_id, hours_logged, entry_date, created_at')
        .gte('entry_date', startStr)
        .lte('entry_date', endStr),
      supabase.from('projects').select('id, name'),
      supabase.from('user_profiles').select('id, name'),
    ]);

    const timeEntries = timeEntriesData.data || [];
    const projects = projectsData.data || [];
    const users = usersData.data || [];

    // Create lookup maps
    const projectMap = new Map(projects.map((p: any) => [p.id, p.name]));
    const userMap = new Map(users.map((u: any) => [u.id, u.name]));

    // Calculate total hours
    const totalHours = timeEntries.reduce((sum: number, te: any) =>
      sum + (te.hours_logged || 0), 0
    );

    // Hours by project
    const projectHoursMap = new Map<string, number>();
    timeEntries.forEach((te: any) => {
      if (te.project_id) {
        const current = projectHoursMap.get(te.project_id) || 0;
        projectHoursMap.set(te.project_id, current + (te.hours_logged || 0));
      }
    });

    const hoursByProject = Array.from(projectHoursMap.entries())
      .map(([projectId, hours]) => ({
        name: (projectMap.get(projectId) || 'Unknown').substring(0, 15),
        hours: Math.round(hours * 10) / 10,
      }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 10);

    // Hours by day of week
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const hoursByDay = dayNames.map(day => ({ day, hours: 0 }));

    timeEntries.forEach((te: any) => {
      const dayOfWeek = getDay(parseISO(te.entry_date));
      hoursByDay[dayOfWeek].hours += te.hours_logged || 0;
    });

    // Reorder to start from Monday
    const hoursByDayOrdered = [
      hoursByDay[1],
      hoursByDay[2],
      hoursByDay[3],
      hoursByDay[4],
      hoursByDay[5],
      hoursByDay[6],
      hoursByDay[0],
    ];

    // Calculate daily trend
    const days = eachDayOfInterval({ start, end });
    const dailyTrend = days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayEntries = timeEntries.filter((te: any) => te.entry_date === dateStr);
      const hours = dayEntries.reduce((sum: number, te: any) => sum + (te.hours_logged || 0), 0);
      return {
        date: format(day, 'MMM d'),
        hours: Math.round(hours * 10) / 10,
      };
    });

    // For longer ranges, aggregate by week
    let aggregatedTrend = dailyTrend;
    if (days.length > 60) {
      const weeklyMap = new Map<string, number>();
      dailyTrend.forEach(d => {
        const week = d.date.split(' ')[0]; // Just use month as key
        const current = weeklyMap.get(week) || 0;
        weeklyMap.set(week, current + d.hours);
      });
      aggregatedTrend = Array.from(weeklyMap.entries()).map(([date, hours]) => ({
        date,
        hours: Math.round(hours * 10) / 10,
      }));
    }

    // Calculate tracking compliance (days with entries / working days)
    const workingDays = days.filter(d => {
      const dow = getDay(d);
      return dow !== 0 && dow !== 6; // Exclude weekends
    });

    const daysWithEntries = new Set(timeEntries.map((te: any) => te.entry_date));
    const workingDaysWithEntries = workingDays.filter(d =>
      daysWithEntries.has(format(d, 'yyyy-MM-dd'))
    );

    const trackingCompliance = workingDays.length > 0
      ? Math.round((workingDaysWithEntries.length / workingDays.length) * 100)
      : 0;

    // Calculate averages
    const uniqueUsers = new Set(timeEntries.map((te: any) => te.user_id));
    const daysInRange = Math.max(1, days.length);
    const avgHoursPerDay = Math.round((totalHours / daysInRange) * 10) / 10;
    const avgHoursPerUser = uniqueUsers.size > 0
      ? Math.round((totalHours / uniqueUsers.size) * 10) / 10
      : 0;

    // Top contributors
    const userHoursMap = new Map<string, number>();
    timeEntries.forEach((te: any) => {
      const current = userHoursMap.get(te.user_id) || 0;
      userHoursMap.set(te.user_id, current + (te.hours_logged || 0));
    });

    const topContributors = Array.from(userHoursMap.entries())
      .map(([userId, hours]) => ({
        name: (userMap.get(userId) || 'Unknown').split(' ')[0],
        hours: Math.round(hours * 10) / 10,
      }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5);

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalHours: Math.round(totalHours * 10) / 10,
          totalEntries: timeEntries.length,
          avgHoursPerDay,
          avgHoursPerUser,
          trackingCompliance,
          activeUsers: uniqueUsers.size,
        },
        hoursByProject,
        hoursByDay: hoursByDayOrdered,
        dailyTrend: aggregatedTrend,
        topContributors,
      },
      dateRange,
    });

  } catch (error: unknown) {
    const err = error as ErrorWithMessage;
    console.error('Error in GET /api/analytics/time:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: err.message },
      { status: 500 }
    );
  }
}

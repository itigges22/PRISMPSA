/**
 * API Route: Time by Project
 * Returns hours logged per project for the current week
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getUserProfileFromRequest } from '@/lib/supabase-server';
import { startOfWeek, endOfWeek, format } from 'date-fns';

export const dynamic = 'force-dynamic';

interface ProjectTime {
  projectId: string;
  projectName: string;
  accountName: string;
  hours: number;
  color: string;
}

// Colors for the pie chart
const COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

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

    // Get current week range (Monday to Sunday)
    // Extend by 1 day to handle timezone differences
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const nextDay = new Date(weekEnd);
    nextDay.setDate(nextDay.getDate() + 1);
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');
    const weekEndStr = format(nextDay, 'yyyy-MM-dd');

    // Get time entries for this week grouped by project
    const { data: timeEntries, error } = await supabase
      .from('time_entries')
      .select(`
        hours_logged,
        project_id,
        projects(
          id,
          name,
          accounts(name)
        )
      `)
      .eq('user_id', userId)
      .gte('entry_date', weekStartStr)
      .lte('entry_date', weekEndStr);

    if (error) {
      console.error('Error fetching time entries:', error);
      return NextResponse.json(
        { error: 'Failed to fetch time data' },
        { status: 500 }
      );
    }

    // Aggregate by project
    const projectMap = new Map<string, ProjectTime>();

    timeEntries?.forEach((entry: any, index: number) => {
      const projectId = entry.project_id;
      const project = Array.isArray(entry.projects) ? entry.projects[0] : entry.projects;

      if (!project) return;

      const existing = projectMap.get(projectId);
      if (existing) {
        existing.hours += entry.hours_logged || 0;
      } else {
        const account = Array.isArray(project.accounts) ? project.accounts[0] : project.accounts;
        projectMap.set(projectId, {
          projectId,
          projectName: project.name,
          accountName: account?.name || 'No Account',
          hours: entry.hours_logged || 0,
          color: COLORS[projectMap.size % COLORS.length],
        });
      }
    });

    // Convert to array and sort by hours
    const projects = Array.from(projectMap.values())
      .sort((a, b) => b.hours - a.hours)
      .map((p, i) => ({
        ...p,
        hours: Math.round(p.hours * 10) / 10,
        color: COLORS[i % COLORS.length],
      }));

    const totalHours = projects.reduce((sum, p) => sum + p.hours, 0);

    return NextResponse.json({
      success: true,
      data: {
        projects,
        totalHours: Math.round(totalHours * 10) / 10,
        weekStart: weekStartStr,
        weekEnd: weekEndStr,
      },
    });

  } catch (error: unknown) {
    console.error('Error in GET /api/dashboard/time-by-project:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: (error as Error).message },
      { status: 500 }
    );
  }
}

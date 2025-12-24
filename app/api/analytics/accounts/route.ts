/**
 * API Route: Account Analytics
 * Returns detailed account/client insights
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getUserProfileFromRequest } from '@/lib/supabase-server';
import { subDays, format } from 'date-fns';

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

    // Fetch all data in parallel
    const [accountsData, projectsData, timeEntriesData, accountMembersData] = await Promise.all([
      supabase.from('accounts').select('id, name, status, created_at'),
      supabase.from('projects').select('id, name, account_id, status, estimated_hours, actual_hours'),
      supabase
        .from('time_entries')
        .select('project_id, hours_logged')
        .gte('entry_date', startStr)
        .lte('entry_date', endStr),
      supabase.from('account_members').select('account_id, user_id'),
    ]);

    const accounts = accountsData.data || [];
    const projects = projectsData.data || [];
    const timeEntries = timeEntriesData.data || [];
    const accountMembers = accountMembersData.data || [];

    // Calculate project hours from time entries
    const projectHoursMap = new Map<string, number>();
    timeEntries.forEach((te: any) => {
      const current = projectHoursMap.get(te.project_id) || 0;
      projectHoursMap.set(te.project_id, current + (te.hours_logged || 0));
    });

    // Calculate account metrics
    const accountMetrics: {
      id: string;
      name: string;
      status: string;
      projectCount: number;
      activeProjects: number;
      completedProjects: number;
      hoursInvested: number;
      teamSize: number;
    }[] = [];

    accounts.forEach((account: any) => {
      const accountProjects = projects.filter((p: any) => p.account_id === account.id);
      const activeProjects = accountProjects.filter((p: any) =>
        ['planning', 'in_progress', 'review'].includes(p.status)
      );
      const completedProjects = accountProjects.filter((p: any) => p.status === 'complete');

      let hoursInvested = 0;
      accountProjects.forEach((p: any) => {
        hoursInvested += projectHoursMap.get(p.id) || 0;
      });

      const teamMembers = accountMembers.filter((am: any) => am.account_id === account.id);

      accountMetrics.push({
        id: account.id,
        name: account.name,
        status: account.status || 'active',
        projectCount: accountProjects.length,
        activeProjects: activeProjects.length,
        completedProjects: completedProjects.length,
        hoursInvested: Math.round(hoursInvested * 10) / 10,
        teamSize: new Set(teamMembers.map((tm: any) => tm.user_id)).size,
      });
    });

    // Sort by hours invested
    accountMetrics.sort((a, b) => b.hoursInvested - a.hoursInvested);

    // Calculate status distribution
    const statusCounts: Record<string, number> = {};
    accounts.forEach((a: any) => {
      const status = a.status || 'active';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    const statusDistribution = [
      { status: 'active', count: statusCounts['active'] || 0, color: '#22c55e' },
      { status: 'inactive', count: statusCounts['inactive'] || 0, color: '#94a3b8' },
      { status: 'suspended', count: statusCounts['suspended'] || 0, color: '#ef4444' },
    ].filter(s => s.count > 0);

    // Top accounts by hours
    const topAccountsByHours = accountMetrics
      .slice(0, 10)
      .map(a => ({
        name: a.name.length > 15 ? a.name.substring(0, 12) + '...' : a.name,
        hours: a.hoursInvested,
      }));

    // Summary stats
    const activeAccounts = accounts.filter((a: any) => a.status === 'active').length;
    const totalHoursInvested = accountMetrics.reduce((sum, a) => sum + a.hoursInvested, 0);
    const totalProjects = projects.length;
    const avgProjectsPerAccount = accounts.length > 0
      ? Math.round((totalProjects / accounts.length) * 10) / 10
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          total: accounts.length,
          active: activeAccounts,
          totalHoursInvested: Math.round(totalHoursInvested * 10) / 10,
          avgProjectsPerAccount,
        },
        statusDistribution,
        topAccountsByHours,
        accountDetails: accountMetrics.slice(0, 15),
      },
      dateRange,
    });

  } catch (error: unknown) {
    const err = error as ErrorWithMessage;
    console.error('Error in GET /api/analytics/accounts:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: err.message },
      { status: 500 }
    );
  }
}

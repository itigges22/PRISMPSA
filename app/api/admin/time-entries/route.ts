/**
 * API Route: Admin Time Entries
 * GET - Get all time entries for admin view
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getUserProfileFromRequest } from '@/lib/supabase-server';
import { hasPermission } from '@/lib/permission-checker';
import { Permission } from '@/lib/permissions';

/**
 * GET /api/admin/time-entries
 * Get all time entries for admin dashboard
 * Query params: startDate, endDate, userId
 */
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

    // Check for admin permission
    const canViewTeam = await hasPermission(userProfile, Permission.VIEW_TEAM_TIME_ENTRIES);
    if (!canViewTeam) {
      return NextResponse.json(
        { error: 'Insufficient permissions to view team time entries' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const userId = searchParams.get('userId');

    // Build query
    let query = supabase
      .from('time_entries')
      .select(`
        *,
        user:user_profiles!user_id (
          id,
          name,
          email
        ),
        project:projects!project_id (
          id,
          name
        ),
        task:tasks!task_id (
          id,
          name
        )
      `)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false });

    // Apply filters
    if (startDate) {
      query = query.gte('entry_date', startDate);
    }
    if (endDate) {
      query = query.lte('entry_date', endDate);
    }
    if (userId) {
      query = query.eq('user_id', userId);
    }

    // Default to last 30 days if no date range specified
    if (!startDate && !endDate) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      query = query.gte('entry_date', thirtyDaysAgo.toISOString().split('T')[0]);
    }

    const { data: timeEntries, error } = await query;

    if (error) {
      console.error('Error fetching time entries:', error);
      return NextResponse.json(
        { error: 'Failed to fetch time entries', details: error.message },
        { status: 500 }
      );
    }

    // Calculate summary stats
    const totalHours = timeEntries?.reduce((sum, entry) => sum + (entry.hours_logged || 0), 0) || 0;
    const uniqueUsers = new Set(timeEntries?.map(e => e.user_id)).size;
    const uniqueProjects = new Set(timeEntries?.map(e => e.project_id)).size;
    const autoClockOuts = timeEntries?.filter(e => e.is_auto_clock_out).length || 0;

    return NextResponse.json({
      success: true,
      timeEntries: timeEntries || [],
      summary: {
        totalEntries: timeEntries?.length || 0,
        totalHours: Math.round(totalHours * 100) / 100,
        uniqueUsers,
        uniqueProjects,
        autoClockOuts
      }
    });
  } catch (error: any) {
    console.error('Error in GET /api/admin/time-entries:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

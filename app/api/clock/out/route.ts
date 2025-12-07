/**
 * API Route: Clock Out
 * POST - Clock out and allocate time to projects/tasks
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getUserProfileFromRequest } from '@/lib/supabase-server';
import { hasPermission } from '@/lib/permission-checker';
import { Permission } from '@/lib/permissions';

interface TimeAllocation {
  projectId: string;
  taskId?: string | null;
  hours: number;
  description?: string;
}

/**
 * POST /api/clock/out
 * Clock out and create time entries for allocated hours
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { allocations, notes } = body as {
      allocations: TimeAllocation[];
      notes?: string;
    };

    // Validate allocations
    if (!allocations || !Array.isArray(allocations) || allocations.length === 0) {
      return NextResponse.json(
        { error: 'At least one time allocation is required' },
        { status: 400 }
      );
    }

    // Validate each allocation has required fields
    for (const allocation of allocations) {
      if (allocation.hours === undefined || allocation.hours <= 0) {
        return NextResponse.json(
          { error: 'Each allocation must have positive hours' },
          { status: 400 }
        );
      }
      // Allow null projectId (for "Other" unassigned work)
    }

    // Permission check: LOG_TIME
    const canLogTime = await hasPermission(userProfile, Permission.LOG_TIME, undefined, supabase);
    if (!canLogTime) {
      return NextResponse.json(
        { error: 'Insufficient permissions to log time' },
        { status: 403 }
      );
    }

    // Get active session
    const { data: session, error: sessionError } = await supabase
      .from('clock_sessions')
      .select('*')
      .eq('user_id', userProfile.id)
      .eq('is_active', true)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'No active clock session found' },
        { status: 400 }
      );
    }

    const clockOutTime = new Date();
    const clockInTime = new Date(session.clock_in_time);

    // Calculate total hours clocked
    const totalMinutes = Math.round((clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60));
    const totalHours = totalMinutes / 60;

    // Calculate total allocated hours
    const totalAllocated = allocations.reduce((sum, a) => sum + a.hours, 0);

    // Warn if allocated hours significantly differ from actual (allow some flexibility)
    if (Math.abs(totalAllocated - totalHours) > 0.5) {
      console.warn(`Clock session ${session.id}: Allocated ${totalAllocated}h but was clocked in for ${totalHours.toFixed(2)}h`);
    }

    // Calculate week start date (Monday)
    const entryDate = clockOutTime.toISOString().split('T')[0];
    const day = clockOutTime.getDay();
    const diff = clockOutTime.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(clockOutTime);
    monday.setDate(diff);
    const weekStartDate = monday.toISOString().split('T')[0];

    // Create time entries for each allocation
    const timeEntries = allocations.map(allocation => ({
      task_id: allocation.taskId ?? null,
      user_id: userProfile.id,
      project_id: allocation.projectId,
      hours_logged: Math.round(allocation.hours * 100) / 100, // Round to 2 decimals
      entry_date: entryDate,
      week_start_date: weekStartDate,
      description: (allocation.description ?? notes) || null,
      clock_session_id: session.id,
      clock_in_time: session.clock_in_time,
      clock_out_time: clockOutTime.toISOString(),
      is_auto_clock_out: false
    }));

    // Insert time entries
    const { data: createdEntries, error: entriesError } = await supabase
      .from('time_entries')
      .insert(timeEntries)
      .select();

    if (entriesError) {
      console.error('Error creating time entries:', entriesError);
      return NextResponse.json(
        { error: 'Failed to create time entries', details: entriesError.message },
        { status: 500 }
      );
    }

    // Close the clock session
    const { error: updateError } = await supabase
      .from('clock_sessions')
      .update({
        is_active: false,
        clock_out_time: clockOutTime.toISOString(),
        notes: notes ?? null,
        updated_at: clockOutTime.toISOString()
      })
      .eq('id', session.id);

    if (updateError) {
      console.error('Error closing clock session:', updateError);
      // Don't fail the request since entries were created
    }

    return NextResponse.json({
      success: true,
      message: 'Clocked out successfully',
      session: {
        ...session,
        clock_out_time: clockOutTime.toISOString(),
        is_active: false
      },
      timeEntries: createdEntries,
      summary: {
        clockedInHours: Math.round(totalHours * 100) / 100,
        allocatedHours: totalAllocated,
        entriesCreated: createdEntries?.length || 0
      }
    });
  } catch (error: any) {
    console.error('Error in POST /api/clock/out:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

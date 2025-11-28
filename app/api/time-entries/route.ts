/**
 * API Route: Time Entries
 * Endpoints for logging and managing time on tasks
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getUserProfileFromRequest } from '@/lib/supabase-server';
import { timeEntryService } from '@/lib/services/time-entry-service';
import { hasPermission } from '@/lib/permission-checker';
import { Permission } from '@/lib/permissions';

/**
 * GET /api/time-entries
 * Get time entries for a user, task, or project
 * Query params: userId, taskId, projectId, startDate, endDate
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

    // Get current user
    const userProfile = await getUserProfileFromRequest(supabase);
    if (!userProfile) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const taskId = searchParams.get('taskId');
    const projectId = searchParams.get('projectId');
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    let timeEntries = [];

    if (taskId) {
      // Get time entries for a specific task
      timeEntries = await timeEntryService.getTaskTimeEntries(taskId);
    } else if (projectId) {
      // Get time entries for a project
      timeEntries = await timeEntryService.getProjectTimeEntries(projectId);
    } else {
      // Get time entries for a user (default to current user)
      const targetUserId = userId || userProfile.id;
      
      // Permission check for viewing other users' time entries
      if (targetUserId !== userProfile.id) {
        const canViewTeam = await hasPermission(userProfile, Permission.VIEW_TEAM_TIME_ENTRIES);
        if (!canViewTeam) {
          return NextResponse.json(
            { error: 'Insufficient permissions to view other users\' time entries' },
            { status: 403 }
          );
        }
      }

      timeEntries = await timeEntryService.getUserTimeEntries(targetUserId, startDate, endDate);
    }

    return NextResponse.json({
      success: true,
      timeEntries,
    });
  } catch (error: any) {
    console.error('Error in GET /api/time-entries:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/time-entries
 * Log time on a task
 * Body: { taskId, projectId, hoursLogged, entryDate, description? }
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

    // Get current user
    const userProfile = await getUserProfileFromRequest(supabase);
    if (!userProfile) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { taskId, projectId, hoursLogged, entryDate, description } = body;

    // Validation
    if (!taskId || !projectId || hoursLogged === undefined || !entryDate) {
      return NextResponse.json(
        { error: 'Missing required fields: taskId, projectId, hoursLogged, entryDate' },
        { status: 400 }
      );
    }

    if (hoursLogged <= 0 || hoursLogged > 24) {
      return NextResponse.json(
        { error: 'Hours logged must be between 0 and 24' },
        { status: 400 }
      );
    }

    // Permission check: LOG_TIME
    const canLogTime = await hasPermission(userProfile, Permission.LOG_TIME);
    if (!canLogTime) {
      return NextResponse.json(
        { error: 'Insufficient permissions to log time' },
        { status: 403 }
      );
    }

    // Calculate week start date (Monday)
    const entryDateObj = new Date(entryDate);
    const day = entryDateObj.getDay();
    const diff = entryDateObj.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(entryDateObj.setDate(diff));
    const weekStartDate = monday.toISOString().split('T')[0];

    // Insert time entry directly using server-side Supabase
    const { data: timeEntry, error: insertError } = await supabase
      .from('time_entries')
      .insert({
        task_id: taskId,
        user_id: userProfile.id,
        project_id: projectId,
        hours_logged: hoursLogged,
        entry_date: entryDate,
        week_start_date: weekStartDate,
        description: description || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting time entry:', insertError);
      return NextResponse.json(
        { error: 'Failed to log time', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      timeEntry,
    });
  } catch (error: any) {
    console.error('Error in POST /api/time-entries:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/time-entries
 * Update a time entry
 * Body: { entryId, hoursLogged?, entryDate?, description? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database connection not available' },
        { status: 500 }
      );
    }

    // Get current user
    const userProfile = await getUserProfileFromRequest(supabase);
    if (!userProfile) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { entryId, hoursLogged, entryDate, description } = body;

    if (!entryId) {
      return NextResponse.json(
        { error: 'Missing required field: entryId' },
        { status: 400 }
      );
    }

    // Permission check: EDIT_OWN_TIME_ENTRIES
    const canEdit = await hasPermission(userProfile, Permission.EDIT_OWN_TIME_ENTRIES);
    if (!canEdit) {
      return NextResponse.json(
        { error: 'Insufficient permissions to edit time entries' },
        { status: 403 }
      );
    }

    // Verify ownership and check 14-day limit
    const { data: existingEntry, error: fetchError } = await supabase
      .from('time_entries')
      .select('user_id, entry_date')
      .eq('id', entryId)
      .single();

    if (fetchError || !existingEntry) {
      return NextResponse.json(
        { error: 'Time entry not found' },
        { status: 404 }
      );
    }

    // Check ownership or team permission
    if (existingEntry.user_id !== userProfile.id) {
      const canEditTeam = await hasPermission(userProfile, Permission.EDIT_TEAM_TIME_ENTRIES);
      if (!canEditTeam) {
        return NextResponse.json(
          { error: 'Can only edit your own time entries' },
          { status: 403 }
        );
      }
    }

    // Check 14-day edit limit (only for own entries)
    if (existingEntry.user_id === userProfile.id) {
      const existingEntryDate = new Date(existingEntry.entry_date);
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      if (existingEntryDate < fourteenDaysAgo) {
        return NextResponse.json(
          { error: 'Cannot edit time entries older than 14 days' },
          { status: 403 }
        );
      }
    }

    const timeEntry = await timeEntryService.updateTimeEntry(entryId, {
      hours_logged: hoursLogged,
      entry_date: entryDate,
      description,
    });

    if (!timeEntry) {
      return NextResponse.json(
        { error: 'Failed to update time entry' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      timeEntry,
    });
  } catch (error: any) {
    console.error('Error in PATCH /api/time-entries:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/time-entries
 * Delete a time entry
 * Query params: entryId
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database connection not available' },
        { status: 500 }
      );
    }

    // Get current user
    const userProfile = await getUserProfileFromRequest(supabase);
    if (!userProfile) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const entryId = searchParams.get('entryId');

    if (!entryId) {
      return NextResponse.json(
        { error: 'Missing required parameter: entryId' },
        { status: 400 }
      );
    }

    // Permission check: EDIT_OWN_TIME_ENTRIES
    const canEdit = await hasPermission(userProfile, Permission.EDIT_OWN_TIME_ENTRIES);
    if (!canEdit) {
      return NextResponse.json(
        { error: 'Insufficient permissions to delete time entries' },
        { status: 403 }
      );
    }

    // Verify ownership and check 14-day limit
    const { data: existingEntry, error: fetchError } = await supabase
      .from('time_entries')
      .select('user_id, entry_date')
      .eq('id', entryId)
      .single();

    if (fetchError || !existingEntry) {
      return NextResponse.json(
        { error: 'Time entry not found' },
        { status: 404 }
      );
    }

    // Check ownership or team permission
    if (existingEntry.user_id !== userProfile.id) {
      const canEditTeam = await hasPermission(userProfile, Permission.EDIT_TEAM_TIME_ENTRIES);
      if (!canEditTeam) {
        return NextResponse.json(
          { error: 'Can only delete your own time entries' },
          { status: 403 }
        );
      }
    }

    // Check 14-day edit limit (only for own entries)
    if (existingEntry.user_id === userProfile.id) {
      const entryDate = new Date(existingEntry.entry_date);
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      if (entryDate < fourteenDaysAgo) {
        return NextResponse.json(
          { error: 'Cannot delete time entries older than 14 days' },
          { status: 403 }
        );
      }
    }

    const success = await timeEntryService.deleteTimeEntry(entryId);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete time entry' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Time entry deleted successfully',
    });
  } catch (error: any) {
    console.error('Error in DELETE /api/time-entries:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}


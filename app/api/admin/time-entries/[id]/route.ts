import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getUserProfileFromRequest } from '@/lib/supabase-server';
import { hasPermission } from '@/lib/permission-checker';
import { Permission } from '@/lib/permissions';

/**
 * PATCH /api/admin/time-entries/[id]
 * Update a time entry (hours, project, description)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createApiSupabaseClient(request);

    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Database connection not available' },
        { status: 500 }
      );
    }

    // Check authentication and permissions
    const userProfile = await getUserProfileFromRequest(supabase);
    if (!userProfile) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const canEdit = await hasPermission(userProfile, Permission.VIEW_TEAM_TIME_ENTRIES);
    if (!canEdit) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { hours_logged, project_id, description } = body;

    // Validate hours
    if (hours_logged !== undefined) {
      const hours = parseFloat(hours_logged);
      if (isNaN(hours) || hours < 0) {
        return NextResponse.json(
          { success: false, error: 'Invalid hours value' },
          { status: 400 }
        );
      }
    }

    // Build update object
    const updateData: any = {};
    if (hours_logged !== undefined) updateData.hours_logged = parseFloat(hours_logged);
    if (project_id !== undefined) updateData.project_id = project_id || null;
    if (description !== undefined) updateData.description = description || null;

    // Update the time entry
    const { data, error } = await supabase
      .from('time_entries')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating time entry:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update time entry' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      timeEntry: data,
    });
  } catch (error: any) {
    console.error('Error in PATCH /api/admin/time-entries/[id]:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/time-entries/[id]
 * Delete a time entry
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createApiSupabaseClient(request);

    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Database connection not available' },
        { status: 500 }
      );
    }

    // Check authentication and permissions
    const userProfile = await getUserProfileFromRequest(supabase);
    if (!userProfile) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const canDelete = await hasPermission(userProfile, Permission.VIEW_TEAM_TIME_ENTRIES);
    if (!canDelete) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Delete the time entry
    const { error } = await supabase
      .from('time_entries')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting time entry:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete time entry' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Time entry deleted successfully',
    });
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/time-entries/[id]:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

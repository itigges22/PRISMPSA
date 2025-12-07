/**
 * API Route: User Availability
 * Endpoints for managing weekly user work capacity
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getUserProfileFromRequest } from '@/lib/supabase-server';
import { availabilityService } from '@/lib/services/availability-service';
import { hasPermission } from '@/lib/permission-checker';
import { Permission } from '@/lib/permissions';

/**
 * GET /api/availability
 * Get user availability for a specific week
 * Query params: userId, weekStartDate
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
    const userId = searchParams.get('userId') ?? userProfile.id;
    const weekStartDate = searchParams.get('weekStartDate') ?? availabilityService.getWeekStartDate();

    // Permission check: can view own or has VIEW_TEAM_CAPACITY/VIEW_ALL_CAPACITY
    const isOwnData = userId === userProfile.id;
    if (!isOwnData) {
      const canViewTeam = await hasPermission(userProfile, Permission.VIEW_TEAM_CAPACITY, undefined, supabase);
      const canViewAll = await hasPermission(userProfile, Permission.VIEW_ALL_CAPACITY, undefined, supabase);
      
      if (!canViewTeam && !canViewAll) {
        return NextResponse.json(
          { error: 'Insufficient permissions to view other users\' availability' },
          { status: 403 }
        );
      }
    }

    const availability = await availabilityService.getUserAvailability(userId, weekStartDate, supabase);

    return NextResponse.json({
      success: true,
      availability,
    });
  } catch (error: any) {
    console.error('Error in GET /api/availability:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/availability
 * Set or update user availability for a week
 * Body: { userId, weekStartDate, availableHours, scheduleData?, notes? }
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
    const { userId, weekStartDate, availableHours, scheduleData, notes } = body;

    // Validation
    if (!userId || !weekStartDate || availableHours === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, weekStartDate, availableHours' },
        { status: 400 }
      );
    }

    // Permission check: can only edit own availability
    if (userId !== userProfile.id) {
      return NextResponse.json(
        { error: 'Can only edit your own availability' },
        { status: 403 }
      );
    }

    // Check EDIT_OWN_AVAILABILITY permission
    const canEdit = await hasPermission(userProfile, Permission.EDIT_OWN_AVAILABILITY, undefined, supabase);
    if (!canEdit) {
      return NextResponse.json(
        { error: 'Insufficient permissions to edit availability' },
        { status: 403 }
      );
    }

    const availability = await availabilityService.setUserAvailability(
      userId,
      weekStartDate,
      availableHours,
      scheduleData,
      notes,
      supabase
    );

    if (!availability) {
      return NextResponse.json(
        { error: 'Failed to set availability' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      availability,
    });
  } catch (error: any) {
    console.error('Error in POST /api/availability:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/availability
 * Delete user availability for a week
 * Query params: userId, weekStartDate
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
    const userId = searchParams.get('userId');
    const weekStartDate = searchParams.get('weekStartDate');

    if (!userId || !weekStartDate) {
      return NextResponse.json(
        { error: 'Missing required parameters: userId, weekStartDate' },
        { status: 400 }
      );
    }

    // Permission check: can only delete own availability
    if (userId !== userProfile.id) {
      return NextResponse.json(
        { error: 'Can only delete your own availability' },
        { status: 403 }
      );
    }

    const success = await availabilityService.deleteUserAvailability(userId, weekStartDate);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete availability' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Availability deleted successfully',
    });
  } catch (error: any) {
    console.error('Error in DELETE /api/availability:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}


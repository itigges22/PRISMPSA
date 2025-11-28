/**
 * API Route: Clock In/Out
 * GET - Check clock status
 * POST - Clock in
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getUserProfileFromRequest } from '@/lib/supabase-server';
import { hasPermission } from '@/lib/permission-checker';
import { Permission } from '@/lib/permissions';

/**
 * GET /api/clock
 * Check if user is currently clocked in
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

    // Check for active session
    const { data: session, error } = await supabase
      .from('clock_sessions')
      .select('*')
      .eq('user_id', userProfile.id)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching clock session:', error);
      return NextResponse.json(
        { error: 'Failed to fetch clock status' },
        { status: 500 }
      );
    }

    // Check for stale sessions (over 16 hours) and auto clock them out
    if (session) {
      const clockInTime = new Date(session.clock_in_time);
      const now = new Date();
      const hoursElapsed = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

      if (hoursElapsed >= 16) {
        // Auto clock out
        await supabase
          .from('clock_sessions')
          .update({
            is_active: false,
            is_auto_clock_out: true,
            clock_out_time: new Date(clockInTime.getTime() + 16 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', session.id);

        return NextResponse.json({
          success: true,
          isClockedIn: false,
          session: null,
          message: 'Previous session was auto clocked out after 16 hours'
        });
      }
    }

    return NextResponse.json({
      success: true,
      isClockedIn: !!session,
      session: session || null
    });
  } catch (error: any) {
    console.error('Error in GET /api/clock:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clock
 * Clock in - start a new session
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

    // Permission check: LOG_TIME
    const canLogTime = await hasPermission(userProfile, Permission.LOG_TIME);
    if (!canLogTime) {
      return NextResponse.json(
        { error: 'Insufficient permissions to clock in' },
        { status: 403 }
      );
    }

    // Check if user already has an active session
    const { data: existingSession } = await supabase
      .from('clock_sessions')
      .select('id')
      .eq('user_id', userProfile.id)
      .eq('is_active', true)
      .single();

    if (existingSession) {
      return NextResponse.json(
        { error: 'Already clocked in. Please clock out first.' },
        { status: 400 }
      );
    }

    // Create new clock session
    const { data: session, error } = await supabase
      .from('clock_sessions')
      .insert({
        user_id: userProfile.id,
        clock_in_time: new Date().toISOString(),
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating clock session:', error);
      return NextResponse.json(
        { error: 'Failed to clock in', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Clocked in successfully',
      session
    });
  } catch (error: any) {
    console.error('Error in POST /api/clock:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

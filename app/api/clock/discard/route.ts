/**
 * API Route: Discard Clock Session
 * POST - Clock out without creating time entries (for accidental clock-ins)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getUserProfileFromRequest } from '@/lib/supabase-server';

// Type definitions
interface ErrorWithMessage extends Error {
  message: string;
  status?: number;
}

/**
 * POST /api/clock/discard
 * Clock out without creating time entries
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

    // Get active session
    const { data: session, error: sessionError } = await supabase
      .from('clock_sessions')
      .select('*')
      .eq('user_id', (userProfile as any).id)
      .eq('is_active', true)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'No active clock session found' },
        { status: 400 }
      );
    }

    const clockOutTime = new Date();

    // Close the clock session without creating time entries
    const { error: updateError } = await supabase
      .from('clock_sessions')
      .update({
        is_active: false,
        clock_out_time: clockOutTime.toISOString(),
        notes: 'Discarded - no time logged'
      })
      .eq('id', session.id);

    if (updateError) {
      console.error('Error closing clock session:', updateError);
      return NextResponse.json(
        { error: 'Failed to close session', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Clocked out without saving time entries',
      session: {
        ...session,
        clock_out_time: clockOutTime.toISOString(),
        is_active: false
      }
    });
  } catch (error: unknown) {
    const err = error as ErrorWithMessage;
console.error('Error in POST /api/clock/discard:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: err.message },
      { status: 500 }
    );
  }
}

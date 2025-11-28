import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { userApprovalService } from '@/lib/user-approval-service';
import { requireAuthAndPermission, handleGuardError } from '@/lib/server-guards';
import { Permission } from '@/lib/permissions';
import { logger, apiCall, apiResponse } from '@/lib/debug-logger';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Check authentication and permission (approving users is part of assigning users to roles)
    await requireAuthAndPermission(Permission.ASSIGN_USERS_TO_ROLES, {}, request);
    
    const supabase = await createServerSupabase();
    if (!supabase) {
      logger.error('Supabase not configured', { action: 'getPendingUsers' });
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    apiCall('GET', '/api/users/pending', { action: 'getPendingUsers' });

    const pendingUsers = await userApprovalService.getPendingUsers();

    const duration = Date.now() - startTime;
    apiResponse('GET', '/api/users/pending', 200, { 
      action: 'getPendingUsers',
      duration,
      count: pendingUsers.length
    });

    logger.info('Pending users retrieved', { 
      action: 'getPendingUsers',
      count: pendingUsers.length,
      duration
    });

    return NextResponse.json({ 
      users: pendingUsers,
      count: pendingUsers.length
    });

  } catch (error) {
    return handleGuardError(error);
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { requireAuthAndPermission } from '@/lib/server-guards';
import { Permission } from '@/lib/permissions';

/**
 * DELETE /api/accounts/[accountId]/members/[userId]
 * Remove a user from an account
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string; userId: string }> }
) {
  try {
    const { accountId, userId } = await params;
    
    // Require permission to remove users from accounts
    await requireAuthAndPermission(Permission.REMOVE_ACCOUNT_USERS, {}, request);
    
    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase client not available' }, { status: 500 });
    }
    
    // Remove user from account
    const { error } = await supabase
      .from('account_members')
      .delete()
      .eq('account_id', accountId)
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error removing user from account:', error);
      return NextResponse.json({ error: 'Failed to remove user from account' }, { status: 500 });
    }
    
    return NextResponse.json({ message: 'User removed from account successfully' });
  } catch (error: any) {
    console.error('Error in DELETE /api/accounts/[accountId]/members/[userId]:', error);
    if (error && typeof error === 'object' && 'status' in error) {
      const err = error as { status: number; message?: string };
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


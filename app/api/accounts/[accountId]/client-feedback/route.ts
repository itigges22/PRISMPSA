import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';
import { hasAccountAccessServer } from '@/lib/access-control-server';

// GET /api/accounts/[id]/client-feedback - View feedback for specific account
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const { accountId } = await params;
    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile with roles
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select(`
        *,
        user_roles!user_roles_user_id_fkey (
          roles (
            id,
            name,
            permissions,
            department_id
          )
        )
      `)
      .eq('id', user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Check VIEW_CLIENT_FEEDBACK permission
    const canViewFeedback = await hasPermission(userProfile, Permission.VIEW_CLIENT_FEEDBACK, undefined, supabase);
    if (!canViewFeedback) {
      return NextResponse.json({ error: 'Insufficient permissions to view client feedback' }, { status: 403 });
    }

    // Verify user has access to this account
    const hasAccess = await hasAccountAccessServer(supabase, user.id, accountId);
    if (!hasAccess) {
      return NextResponse.json({
        error: 'You do not have access to this account'
      }, { status: 403 });
    }

    // Get feedback for account with enriched data
    const { data: feedback, error: feedbackError } = await supabase
      .from('client_feedback')
      .select(`
        *,
        projects!inner (
          id,
          name,
          account_id
        ),
        user_profiles!client_feedback_client_user_id_fkey (
          id,
          name,
          email
        )
      `)
      .eq('projects.account_id', accountId)
      .order('submitted_at', { ascending: false });

    if (feedbackError) {
      console.error('Error fetching feedback:', feedbackError);
      return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 });
    }

    return NextResponse.json({ success: true, feedback: feedback || [] }, { status: 200 });
  } catch (error) {
    console.error('Error in GET /api/accounts/[id]/client-feedback:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

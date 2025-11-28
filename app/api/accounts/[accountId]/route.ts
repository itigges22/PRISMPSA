import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { requireAuthAndPermission } from '@/lib/server-guards';
import { Permission } from '@/lib/permissions';

/**
 * PATCH /api/accounts/[accountId]
 * Update account details (admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const { accountId } = await params;

    // Require EDIT_ACCOUNT permission
    await requireAuthAndPermission(
      Permission.EDIT_ACCOUNT,
      { accountId },
      request
    );

    const supabase = await createServerSupabase();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase client not available' },
        { status: 500 }
      );
    }

    const body = await request.json();

    // Only allow updating specific fields
    const allowedUpdates: any = {};

    if (body.name !== undefined) {
      allowedUpdates.name = body.name;
    }
    if (body.description !== undefined) {
      allowedUpdates.description = body.description;
    }
    if (body.primary_contact_name !== undefined) {
      allowedUpdates.primary_contact_name = body.primary_contact_name;
    }
    if (body.primary_contact_email !== undefined) {
      allowedUpdates.primary_contact_email = body.primary_contact_email;
    }
    if (body.status !== undefined) {
      allowedUpdates.status = body.status;
    }
    if (body.account_manager_id !== undefined) {
      allowedUpdates.account_manager_id = body.account_manager_id;
    }

    if (Object.keys(allowedUpdates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('accounts')
      .update(allowedUpdates)
      .eq('id', accountId)
      .select()
      .single();

    if (error) {
      console.error('Error updating account:', error);
      return NextResponse.json(
        { error: 'Failed to update account' },
        { status: 500 }
      );
    }

    return NextResponse.json({ account: data });
  } catch (error: any) {
    console.error('Error in PATCH /api/accounts/[accountId]:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

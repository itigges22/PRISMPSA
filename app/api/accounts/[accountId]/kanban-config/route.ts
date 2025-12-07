import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { requireAuthAndPermission } from '@/lib/server-guards';
import { Permission } from '@/lib/permissions';

/**
 * GET /api/accounts/[accountId]/kanban-config
 * Get Kanban configuration for an account
 * NOTE: Kanban/Gantt for projects is deprecated (workflows replace it), but visual display still works
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const { accountId } = await params;

    // Require VIEW_PROJECTS permission (kanban view permissions are deprecated)
    await requireAuthAndPermission(Permission.VIEW_PROJECTS, { accountId }, request);

    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase client not available' }, { status: 500 });
    }

    const { data: config, error } = await supabase
      .from('account_kanban_configs')
      .select('*')
      .eq('account_id', accountId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No config found, return null (client will use defaults)
        return NextResponse.json({ config: null });
      }
      console.error('Error fetching kanban config:', error);
      return NextResponse.json({ error: 'Failed to fetch kanban config' }, { status: 500 });
    }

    return NextResponse.json({ config });
  } catch (error: any) {
    console.error('Error in GET /api/accounts/[accountId]/kanban-config:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/accounts/[accountId]/kanban-config
 * Update Kanban configuration for an account
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const { accountId } = await params;
    const body = await request.json();
    const { columns } = body;

    if (!columns || !Array.isArray(columns)) {
      return NextResponse.json({ error: 'Columns array is required' }, { status: 400 });
    }

    // Require EDIT_PROJECT permission (kanban layout permissions are deprecated)
    await requireAuthAndPermission(Permission.EDIT_PROJECT, { accountId }, request);

    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase client not available' }, { status: 500 });
    }

    // Check if config exists
    const { data: existingConfig } = await supabase
      .from('account_kanban_configs')
      .select('id')
      .eq('account_id', accountId)
      .single();

    let config;
    if (existingConfig) {
      // Update existing config
      const { data, error } = await supabase
        .from('account_kanban_configs')
        .update({
          columns,
          updated_at: new Date().toISOString()
        })
        .eq('account_id', accountId)
        .select()
        .single();

      if (error) {
        console.error('Error updating kanban config:', error);
        return NextResponse.json({ error: 'Failed to update kanban config' }, { status: 500 });
      }
      config = data;
    } else {
      // Create new config
      const { data, error } = await supabase
        .from('account_kanban_configs')
        .insert({
          account_id: accountId,
          columns
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating kanban config:', error);
        return NextResponse.json({ error: 'Failed to create kanban config' }, { status: 500 });
      }
      config = data;
    }

    return NextResponse.json({ success: true, config });
  } catch (error: any) {
    console.error('Error in PUT /api/accounts/[accountId]/kanban-config:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

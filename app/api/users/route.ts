import { NextResponse, NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { requireAuthAndPermission, handleGuardError } from '@/lib/server-guards';
import { Permission } from '@/lib/permissions';
import { logger } from '@/lib/debug-logger';

export async function GET(request: NextRequest) {
  try {
    // Check authentication and permission
    await requireAuthAndPermission(Permission.VIEW_USERS, {}, request);

    const supabase = await createServerSupabase();
    if (!supabase) {
      logger.error('Supabase not configured', { action: 'getUsers' });
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    // Fetch all user profiles with their roles
    const { data: users, error } = await supabase
      .from('user_profiles')
      .select(`
        id,
        name,
        email,
        image,
        user_roles!user_roles_user_id_fkey(
          id,
          roles!user_roles_role_id_fkey(
            id,
            name,
            department_id,
            departments!roles_department_id_fkey(
              id,
              name
            )
          )
        )
      `)
      .order('name');

    if (error) {
      logger.error('Error fetching users', { action: 'getUsers' }, error);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    return NextResponse.json({ users: users || [] });
  } catch (error) {
    return handleGuardError(error);
  }
}


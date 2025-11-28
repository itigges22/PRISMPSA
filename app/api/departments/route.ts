import { NextResponse, NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { requireAuthAndAnyPermission, requireAuthAndPermission, handleGuardError } from '@/lib/server-guards';
import { Permission } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    // Check authentication and permission
    await requireAuthAndAnyPermission([
      Permission.VIEW_DEPARTMENTS,
      Permission.VIEW_ALL_DEPARTMENTS
    ], undefined, request);

    const supabase = await createServerSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    // Fetch all departments
    const { data: departments, error } = await supabase
      .from('departments')
      .select('id, name, description, created_at, updated_at')
      .order('name');

    if (error) {
      console.error('Error fetching departments:', error);
      return NextResponse.json({ error: 'Failed to fetch departments' }, { status: 500 });
    }

    return NextResponse.json(departments || []);
  } catch (error) {
    return handleGuardError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication and permission
    await requireAuthAndPermission(Permission.CREATE_DEPARTMENT, {}, request);

    const supabase = await createServerSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json({ error: 'Department name is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('departments')
      .insert({
        name,
        description: description || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating department:', error);
      return NextResponse.json({ error: 'Failed to create department' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return handleGuardError(error);
  }
}


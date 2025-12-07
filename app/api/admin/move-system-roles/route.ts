import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { isSuperadmin } from '@/lib/rbac';
import { getCurrentUserProfileServer } from '@/lib/auth-server';

/**
 * POST /api/admin/move-system-roles
 * Move all roles from "system" department to "Internal Affairs" department
 * Except for "Superadmin" and "Unassigned User" roles
 */
export async function POST(request: NextRequest) {
  try {
    // Require superadmin access
    const userProfile = await getCurrentUserProfileServer();
    if (!userProfile || !isSuperadmin(userProfile)) {
      return NextResponse.json({ error: 'Unauthorized - Superadmin access required' }, { status: 403 });
    }
    
    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase client not available' }, { status: 500 });
    }
    
    // Find "system" department
    const { data: systemDept, error: systemDeptError } = await supabase
      .from('departments')
      .select('id, name')
      .or('name.ilike.system,name.ilike."System Administration"')
      .limit(1)
      .single();
    
    if (systemDeptError || !systemDept) {
      return NextResponse.json({ error: 'System department not found' }, { status: 404 });
    }
    
    // Find or create "Internal Affairs" department
    const { data: internalAffairsDept, error: internalAffairsError } = await supabase
      .from('departments')
      .select('id, name')
      .ilike('name', 'Internal Affairs')
      .limit(1)
      .single();
    
    let finalInternalAffairsDept = internalAffairsDept;

    if (internalAffairsError || !internalAffairsDept) {
      // Create Internal Affairs department if it doesn't exist
      const { data: newDept, error: createError } = await supabase
        .from('departments')
        .insert({
          name: 'Internal Affairs',
          description: 'Internal organizational roles and administration'
        })
        .select()
        .single();

      if (createError || !newDept) {
        return NextResponse.json({ error: 'Failed to create Internal Affairs department' }, { status: 500 });
      }

      finalInternalAffairsDept = newDept;
    }

    // Ensure we have a valid department
    if (!finalInternalAffairsDept) {
      return NextResponse.json({ error: 'Internal Affairs department not found or created' }, { status: 500 });
    }
    
    // Get all roles in system department except Superadmin and Unassigned User
    const { data: systemRoles, error: rolesError } = await supabase
      .from('roles')
      .select('id, name, is_system_role')
      .eq('department_id', systemDept.id)
      .not('name', 'ilike', 'superadmin')
      .not('name', 'ilike', 'unassigned%');
    
    if (rolesError) {
      return NextResponse.json({ error: 'Failed to fetch system roles' }, { status: 500 });
    }
    
    if (!systemRoles || systemRoles.length === 0) {
      return NextResponse.json({ 
        message: 'No roles to move',
        moved: 0,
        skipped: 0
      });
    }
    
    // Update each role's department_id
    const roleIds = systemRoles.map(r => r.id);
    if (roleIds.length === 0) {
      return NextResponse.json({ 
        message: 'No roles to move',
        moved: 0,
        skipped: 0
      });
    }
    
    const { error: updateError } = await supabase
      .from('roles')
      .update({
        department_id: finalInternalAffairsDept.id,
        updated_at: new Date().toISOString()
      })
      .in('id', roleIds);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update roles' }, { status: 500 });
    }

    return NextResponse.json({
      message: `Successfully moved ${systemRoles.length} role(s) to Internal Affairs department`,
      moved: systemRoles.length,
      roles: systemRoles.map(r => r.name),
      fromDepartment: systemDept.name,
      toDepartment: finalInternalAffairsDept.name
    });
  } catch (error: any) {
    console.error('Error in POST /api/admin/move-system-roles:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


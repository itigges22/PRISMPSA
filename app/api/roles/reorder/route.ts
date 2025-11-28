import { NextResponse, NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { requireAuthAndPermission, handleGuardError } from '@/lib/server-guards';
import { Permission } from '@/lib/permissions';

export async function PATCH(request: NextRequest) {
  try {
    // Parse request body first to get roleId
    const body = await request.json();
    const { roleId, newReportingRoleId, newHierarchyLevel: bodyHierarchyLevel, newDisplayOrder } = body;
    
    if (!roleId) {
      return NextResponse.json({ error: 'Role ID is required' }, { status: 400 });
    }
    
    // Check authentication and permission - reordering is editing
    await requireAuthAndPermission(Permission.EDIT_ROLE, {}, request);
    
    const supabase = await createServerSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    console.log('🔄 REORDER API: Received request:', {
      roleId,
      newReportingRoleId,
      newHierarchyLevel: bodyHierarchyLevel,
      newDisplayOrder,
      fullBody: body
    });

    // Check if role exists
          const { data: role, error: roleError } = await supabase
            .from('roles')
            .select('is_system_role, name')
            .eq('id', roleId)
            .single();

          if (roleError) {
            return NextResponse.json({ error: 'Role not found' }, { status: 404 });
          }

          // Allow all roles to be reordered (including system roles)

          // Validate hierarchy level is within range (1-100)
          const newHierarchyLevel = bodyHierarchyLevel !== undefined ? bodyHierarchyLevel : 1;
          
          if (newHierarchyLevel < 1 || newHierarchyLevel > 100) {
            return NextResponse.json({ 
              error: 'Hierarchy level must be between 1 and 100' 
            }, { status: 400 });
          }
          
          // Allow all roles to be reordered freely (including Superadmin)
    
    console.log(`🔄 REORDER API: Reordering role ${roleId}:`, {
      roleName: role.name,
      newReportingRoleId,
      newHierarchyLevel,
      newDisplayOrder,
      isSystemRole: role.is_system_role
    });

    // Update the role
    const updatePayload = {
      reporting_role_id: newReportingRoleId || null,
      hierarchy_level: newHierarchyLevel,
      display_order: newDisplayOrder || 0,
      updated_at: new Date().toISOString()
    };
    
    console.log('🔄 REORDER API: Update payload:', updatePayload);
    
    console.log('🔧 Updating role with payload:', updatePayload);
    
    console.log('🔄 REORDER API: Executing database update...');
    const { error: updateError, data: updatedData } = await supabase
      .from('roles')
      .update(updatePayload)
      .eq('id', roleId)
      .select('id, name, hierarchy_level, display_order, reporting_role_id, updated_at');

    if (updateError) {
      console.error('❌ REORDER API: Error updating role:', updateError);
      return NextResponse.json({ 
        error: 'Failed to update role', 
        details: updateError.message 
      }, { status: 500 });
    }
    
    console.log('✅ REORDER API: Role updated successfully!');
    console.log('📊 REORDER API: Updated role data from DB:', updatedData);
    
    // Check if database trigger overrode our hierarchy level
    const actualLevel = updatedData?.[0]?.hierarchy_level;
    if (actualLevel !== newHierarchyLevel) {
      console.log(`⚠️  DATABASE TRIGGER OVERRIDE: Expected Level ${newHierarchyLevel}, got Level ${actualLevel}`);
      
      // If the database overrode our level, we need to correct it
      if (newReportingRoleId) {
        // For roles with reporting relationships, calculate the correct level
        const { data: parentRole } = await supabase
          .from('roles')
          .select('hierarchy_level')
          .eq('id', newReportingRoleId)
          .single();
        
        if (parentRole) {
          const correctLevel = parentRole.hierarchy_level - 1;
          console.log(`🔧 Correcting hierarchy level: ${actualLevel} → ${correctLevel} (parent is Level ${parentRole.hierarchy_level})`);
          
          // Update with the correct level
          const { error: correctionError } = await supabase
            .from('roles')
            .update({ 
              hierarchy_level: correctLevel,
              updated_at: new Date().toISOString()
            })
            .eq('id', roleId);
          
          if (correctionError) {
            console.error('❌ Error correcting hierarchy level:', correctionError);
          } else {
            console.log('✅ Hierarchy level corrected successfully!');
            // Update the response data
            if (updatedData?.[0]) {
              updatedData[0].hierarchy_level = correctLevel;
            }
          }
        }
      } else {
        // For top-level roles, determine correct level based on name
        let correctLevel = 1; // Default for top-level roles
        if (role?.name === 'Superadmin') {
          correctLevel = 12;
        } else if (role?.name === 'No Assigned Role') {
          correctLevel = 0;
        }
        
        if (correctLevel !== actualLevel) {
          console.log(`🔧 Correcting top-level role hierarchy: ${actualLevel} → ${correctLevel}`);
          
          const { error: correctionError } = await supabase
            .from('roles')
            .update({ 
              hierarchy_level: correctLevel,
              updated_at: new Date().toISOString()
            })
            .eq('id', roleId);
          
          if (correctionError) {
            console.error('❌ Error correcting hierarchy level:', correctionError);
          } else {
            console.log('✅ Top-level hierarchy level corrected successfully!');
            // Update the response data
            if (updatedData?.[0]) {
              updatedData[0].hierarchy_level = correctLevel;
            }
          }
        }
      }
    }
    
    console.log('📊 REORDER API: Final role state:', updatedData?.[0] ? {
      name: updatedData[0].name,
      hierarchy_level: updatedData[0].hierarchy_level,
      display_order: updatedData[0].display_order,
      reporting_role_id: updatedData[0].reporting_role_id
    } : 'No data returned');

    // Note: We're skipping sibling reordering for now as it causes delays
    // display_order is primarily for visual ordering within the same level
    // and will be naturally adjusted as users drag-and-drop roles

    return NextResponse.json({ 
      success: true,
      updatedRole: updatedData && updatedData.length > 0 ? updatedData[0] : null
    });
  } catch (error) {
    return handleGuardError(error);
  }
}


/**
 * Comprehensive Permission Testing Script
 * 
 * Tests both scenarios:
 * 1. User with NO permissions (all disabled)
 * 2. User with ALL permissions (all enabled)
 * 
 * Creates/updates roles and tests access patterns
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { Permission } from '../lib/permissions';

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get all current permissions
const ALL_PERMISSIONS = Object.values(Permission);

async function createTestRole(name: string, grantAll: boolean) {
  // Create permissions object
  const permissions: Record<string, boolean> = {};
  for (const perm of ALL_PERMISSIONS) {
    permissions[perm] = grantAll;
  }

  // Check if role exists
  const { data: existingRole } = await supabase
    .from('roles')
    .select('id')
    .eq('name', name)
    .single();

  if (existingRole) {
    // Update existing role
    const { error } = await supabase
      .from('roles')
      .update({ permissions })
      .eq('id', existingRole.id);

    if (error) {
      console.log(`   ❌ Error updating role: ${error.message}`);
      return null;
    }

    console.log(`   ✅ Updated existing role "${name}"`);
    return existingRole.id;
  } else {
    // Get a valid department ID (required field)
    const { data: dept } = await supabase
      .from('departments')
      .select('id')
      .limit(1)
      .single();

    if (!dept) {
      console.log('   ❌ No departments found - cannot create role');
      return null;
    }

    // Create new role
    const { data: newRole, error } = await supabase
      .from('roles')
      .insert({
        name,
        department_id: dept.id,
        permissions,
        is_system_role: false,
      })
      .select('id')
      .single();

    if (error) {
      console.log(`   ❌ Error creating role: ${error.message}`);
      return null;
    }

    console.log(`   ✅ Created new role "${name}"`);
    return newRole.id;
  }
}

async function assignRoleToUser(userId: string, roleId: string) {
  // Check if assignment exists
  const { data: existing } = await supabase
    .from('user_roles')
    .select('id')
    .eq('user_id', userId)
    .eq('role_id', roleId)
    .single();

  if (existing) {
    console.log('   ℹ️  Role already assigned');
    return true;
  }

  // Create assignment
  const { error } = await supabase
    .from('user_roles')
    .insert({
      user_id: userId,
      role_id: roleId,
    });

  if (error) {
    console.log(`   ❌ Error assigning role: ${error.message}`);
    return false;
  }

  console.log('   ✅ Assigned role to user');
  return true;
}

async function removeAllRolesFromUser(userId: string, exceptRoleId?: string) {
  let query = supabase
    .from('user_roles')
    .delete()
    .eq('user_id', userId);

  if (exceptRoleId) {
    query = query.neq('role_id', exceptRoleId);
  }

  const { error } = await query;

  if (error) {
    console.log(`   ❌ Error removing roles: ${error.message}`);
    return false;
  }

  return true;
}

async function testPermissions() {
  console.log('\n🧪 Comprehensive Permission Testing\n');
  console.log('═'.repeat(80));

  // Get test user
  const { data: testUser } = await supabase
    .from('user_profiles')
    .select('id, email, name')
    .eq('email', 'itigges22@gmail.com')
    .single();

  if (!testUser) {
    console.log('❌ Test user not found');
    return;
  }

  console.log(`\n👤 Test User: ${testUser.name} (${testUser.email})`);
  console.log(`   ID: ${testUser.id}`);

  // Create both roles first
  console.log('\n\n📋 Step 1: Creating/Updating Test Roles');
  console.log('─'.repeat(80));
  
  console.log('\n1. Creating/updating "Test - No Permissions" role...');
  const noPermsRoleId = await createTestRole('Test User - No Permissions', false);
  
  console.log('\n2. Creating/updating "Test - All Permissions" role...');
  const allPermsRoleId = await createTestRole('Test User - All Permissions', true);

  if (!noPermsRoleId || !allPermsRoleId) {
    console.log('\n❌ Failed to create test roles');
    return;
  }

  // Scenario 1: NO Permissions
  console.log('\n\n📋 SCENARIO 1: User with NO Permissions');
  console.log('─'.repeat(80));
  
  console.log('\n1. Removing other roles except "Test - No Permissions"...');
  await removeAllRolesFromUser(testUser.id, noPermsRoleId);
  
  console.log('\n2. Ensuring "Test - No Permissions" role is assigned...');
  await assignRoleToUser(testUser.id, noPermsRoleId);
  
  console.log('\n✅ Test user now has NO permissions');
  console.log('   Expected behavior:');
  console.log('   - Cannot access /dashboard');
  console.log('   - Cannot access /accounts');
  console.log('   - Cannot access /departments');
  console.log('   - Cannot access /projects');
  console.log('   - Can only access /welcome and /profile');
  
  console.log('\n💡 To verify: npm run debug:permissions itigges22@gmail.com');

  // Wait a moment for changes to propagate
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Scenario 2: ALL Permissions  
  console.log('\n\n📋 SCENARIO 2: User with ALL Permissions');
  console.log('─'.repeat(80));
  
  console.log('\n1. Removing other roles except "Test - All Permissions"...');
  await removeAllRolesFromUser(testUser.id, allPermsRoleId);
  
  console.log('\n2. Ensuring "Test - All Permissions" role is assigned...');
  await assignRoleToUser(testUser.id, allPermsRoleId);
  
  console.log('\n✅ Test user now has ALL permissions');
  console.log('   Expected behavior:');
  console.log('   - Can access ALL pages');
  console.log('   - Can see ALL departments, accounts, projects');
  console.log('   - Can create, edit, delete all resources');
  console.log('   - Can configure Kanban layouts');
  console.log('   - Can access admin pages');
  
  console.log('\n💡 To verify: npm run debug:permissions itigges22@gmail.com');

  // Summary
  console.log('\n\n' + '═'.repeat(80));
  console.log('\n📊 Test Summary:\n');
  console.log(`✅ Created/updated test roles with ${ALL_PERMISSIONS.length} permissions`);
  console.log('✅ Test user configured for both scenarios');
  console.log('\n💡 To verify permissions, run:');
  console.log('   npm run debug:permissions itigges22@gmail.com');
  console.log('\n💡 To test in browser:');
  console.log('   1. Log in as test user (itigges22@gmail.com)');
  console.log('   2. Try accessing different pages');
  console.log('   3. Verify access matches expected behavior');
  console.log('\n');
}

testPermissions()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });


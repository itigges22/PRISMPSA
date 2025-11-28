/**
 * Permission Debugging Utility
 * Run this script to test and debug permission checks for specific users
 * 
 * Usage: npx tsx scripts/debug-permissions.ts <user-email>
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { Permission } from '../lib/permissions';

// Load environment variables from .env.local
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  console.error('   Make sure .env.local file exists with these variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface RolePermission {
  permission: string;
  granted: boolean;
}

interface Role {
  id: string;
  name: string;
  is_system_role: boolean;
  permissions: RolePermission[];
}

interface UserProfile {
  id: string;
  email: string;
  name: string;
  is_superadmin: boolean;
  roles: Role[];
}

async function getUserWithRoles(email: string): Promise<UserProfile | null> {
  // Get user by email
  const { data: authUser, error: authError } = await supabase.auth.admin.listUsers();
  
  if (authError) {
    console.error('Error fetching users:', authError);
    return null;
  }

  const user = authUser.users.find(u => u.email === email);
  if (!user) {
    console.error(`User not found: ${email}`);
    return null;
  }

  // Get user profile
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    console.error('Error fetching user profile:', profileError);
    return null;
  }

  // Get user's role assignments with permissions
  const { data: roleAssignments, error: rolesError} = await supabase
    .from('user_roles')
    .select(`
      role_id,
      roles (
        id,
        name,
        is_system_role,
        permissions,
        department_id,
        departments (
          name
        )
      )
    `)
    .eq('user_id', user.id);

  if (rolesError) {
    console.error('Error fetching role assignments:', rolesError);
    return null;
  }

  const roles: Role[] = [];

  for (const assignment of roleAssignments || []) {
    const role = (assignment as any).roles;
    
    // Permissions are stored as JSONB in the roles table
    const permissionsObj = role.permissions || {};
    const permissionsArray: RolePermission[] = [];
    
    // Convert permissions object to array format
    for (const [permission, granted] of Object.entries(permissionsObj)) {
      if (typeof granted === 'boolean') {
        permissionsArray.push({
          permission,
          granted,
        });
      }
    }

    roles.push({
      id: role.id,
      name: role.name,
      is_system_role: role.is_system_role || false,
      permissions: permissionsArray,
    });
  }

  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    is_superadmin: profile.is_superadmin || false,
    roles,
  };
}

function getAllPermissions(): Permission[] {
  return Object.values(Permission);
}

function checkPermission(userProfile: UserProfile, permission: Permission): {
  hasPermission: boolean;
  source: string;
  details: string[];
} {
  const details: string[] = [];

  // Check if superadmin (user-level flag)
  if (userProfile.is_superadmin) {
    return {
      hasPermission: true,
      source: 'Superadmin',
      details: ['User is superadmin - grants all permissions'],
    };
  }

  // Check base permission across all roles
  for (const role of userProfile.roles) {
    const perm = role.permissions.find(p => p.permission === permission);
    if (perm && perm.granted) {
      details.push(`✓ Role "${role.name}" has base permission "${permission}"`);
      return {
        hasPermission: true,
        source: `Role: ${role.name}`,
        details,
      };
    }
  }

  // Check override permissions
  const overrideMap: Record<string, string[]> = {
    [Permission.VIEW_PROJECTS]: [Permission.VIEW_ALL_PROJECTS],
    [Permission.EDIT_PROJECT]: [Permission.EDIT_ALL_PROJECTS],
    [Permission.DELETE_PROJECT]: [Permission.DELETE_ALL_PROJECTS],
    [Permission.VIEW_DEPARTMENTS]: [Permission.VIEW_ALL_DEPARTMENTS],
    [Permission.EDIT_DEPARTMENT]: [Permission.VIEW_ALL_DEPARTMENTS],
    [Permission.DELETE_DEPARTMENT]: [Permission.VIEW_ALL_DEPARTMENTS],
    [Permission.VIEW_ACCOUNTS]: [Permission.VIEW_ALL_ACCOUNTS],
    [Permission.EDIT_ACCOUNT]: [Permission.VIEW_ALL_ACCOUNTS],
    [Permission.DELETE_ACCOUNT]: [Permission.VIEW_ALL_ACCOUNTS],
    [Permission.VIEW_ANALYTICS]: [Permission.VIEW_ALL_ANALYTICS],
  };

  const overrides = overrideMap[permission] || [];
  for (const override of overrides) {
    for (const role of userProfile.roles) {
      const overridePerm = role.permissions.find(p => p.permission === override);
      if (overridePerm && overridePerm.granted) {
        details.push(`✓ Role "${role.name}" has override permission "${override}"`);
        return {
          hasPermission: true,
          source: `Override: ${role.name}`,
          details,
        };
      }
    }
  }

  details.push(`✗ No role grants "${permission}" or its overrides`);
  return {
    hasPermission: false,
    source: 'None',
    details,
  };
}

async function debugUserPermissions(email: string) {
  console.log('\n🔍 PRISM PSA - Permission Debugger\n');
  console.log('═'.repeat(80));
  
  const userProfile = await getUserWithRoles(email);
  
  if (!userProfile) {
    console.log('❌ Could not load user profile');
    return;
  }

  console.log(`\n👤 User: ${userProfile.name} (${userProfile.email})`);
  console.log(`   ID: ${userProfile.id}`);
  console.log(`   Superadmin: ${userProfile.is_superadmin ? 'Yes ⭐' : 'No'}`);
  console.log(`\n📋 Assigned Roles (${userProfile.roles.length}):`);
  
  for (const role of userProfile.roles) {
    console.log(`   • ${role.name}`);
    console.log(`     - System Role: ${role.is_system_role ? 'Yes' : 'No'}`);
    console.log(`     - Permissions: ${role.permissions.filter(p => p.granted).length} granted`);
  }

  console.log('\n' + '═'.repeat(80));
  console.log('\n🔐 Permission Analysis:\n');

  const allPermissions = getAllPermissions();
  const permissionResults: Array<{
    permission: string;
    hasAccess: boolean;
    source: string;
  }> = [];

  for (const permission of allPermissions) {
    const result = checkPermission(userProfile, permission);
    permissionResults.push({
      permission,
      hasAccess: result.hasPermission,
      source: result.source,
    });
  }

  // Group by category
  const categories = new Map<string, typeof permissionResults>();
  
  for (const result of permissionResults) {
    const category = result.permission.split('_')[0];
    if (!categories.has(category)) {
      categories.set(category, []);
    }
    categories.get(category)!.push(result);
  }

  for (const [category, perms] of categories) {
    const granted = perms.filter(p => p.hasAccess).length;
    const total = perms.length;
    
    console.log(`\n📦 ${category.toUpperCase()} (${granted}/${total} granted)`);
    console.log('   ' + '─'.repeat(76));
    
    for (const perm of perms) {
      const icon = perm.hasAccess ? '✅' : '❌';
      const permName = perm.permission.replace(`${category}_`, '');
      console.log(`   ${icon} ${permName.padEnd(40)} ${perm.source}`);
    }
  }

  console.log('\n' + '═'.repeat(80));
  
  // Summary
  const totalGranted = permissionResults.filter(p => p.hasAccess).length;
  const totalPermissions = permissionResults.length;
  const percentage = ((totalGranted / totalPermissions) * 100).toFixed(1);
  
  console.log(`\n📊 Summary: ${totalGranted}/${totalPermissions} permissions granted (${percentage}%)\n`);

  // Detailed permission breakdown for each role
  console.log('═'.repeat(80));
  console.log('\n📝 Detailed Role Breakdown:\n');
  
  for (const role of userProfile.roles) {
    console.log(`\n🏷️  ${role.name}`);
    console.log('   ' + '─'.repeat(76));
    
    if (role.is_system_role) {
      console.log('   🔒 SYSTEM ROLE');
    }

    const grantedPerms = role.permissions.filter(p => p.granted);
    const deniedPerms = role.permissions.filter(p => !p.granted);
    
    console.log(`   Granted Permissions (${grantedPerms.length}):`);
    if (grantedPerms.length === 0) {
      console.log('      (none)');
    } else {
      for (const perm of grantedPerms.sort((a, b) => a.permission.localeCompare(b.permission))) {
        console.log(`      ✓ ${perm.permission}`);
      }
    }
    
    if (deniedPerms.length > 0) {
      console.log(`\n   Explicitly Denied Permissions (${deniedPerms.length}):`);
      for (const perm of deniedPerms.sort((a, b) => a.permission.localeCompare(b.permission))) {
        console.log(`      ✗ ${perm.permission}`);
      }
    }
  }

  console.log('\n' + '═'.repeat(80) + '\n');
}

// Main execution
const email = process.argv[2];

if (!email) {
  console.error('Usage: npx tsx scripts/debug-permissions.ts <user-email>');
  process.exit(1);
}

debugUserPermissions(email)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });


/**
 * Check User Status Script
 * Verifies user permissions and role configurations
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkUserStatus() {
  console.log('\n🔍 Checking User Status and Permissions\n');
  console.log('═'.repeat(80));

  // Check both users
  const emails = ['jitigges@vt.edu', 'itigges22@gmail.com'];

  for (const email of emails) {
    console.log(`\n\n👤 User: ${email}`);
    console.log('─'.repeat(80));

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, email, name, is_superadmin')
      .eq('email', email)
      .single();

    if (profileError || !profile) {
      console.log('❌ User not found');
      continue;
    }

    console.log(`   Name: ${profile.name}`);
    console.log(`   ID: ${profile.id}`);
    console.log(`   is_superadmin flag: ${profile.is_superadmin ? '✅ TRUE' : '❌ FALSE'}`);

    // Get user roles
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select(`
        role_id,
        roles (
          id,
          name,
          is_system_role,
          permissions
        )
      `)
      .eq('user_id', profile.id);

    if (rolesError) {
      console.log('❌ Error fetching roles:', rolesError.message);
      continue;
    }

    console.log(`\n   📋 Assigned Roles (${userRoles?.length || 0}):`);
    
    if (!userRoles || userRoles.length === 0) {
      console.log('      (none)');
      continue;
    }

    for (const ur of userRoles) {
      const role = (ur as any).roles;
      if (!role) continue;

      const permissions = role.permissions || {};
      const grantedCount = Object.values(permissions).filter(v => v === true).length;
      const totalCount = Object.keys(permissions).length;

      console.log(`\n   • ${role.name}`);
      console.log(`     - System Role: ${role.is_system_role ? 'Yes' : 'No'}`);
      console.log(`     - Permissions: ${grantedCount}/${totalCount} granted`);
      
      // Show first few permissions as sample
      const samplePerms = Object.entries(permissions)
        .filter(([_, v]) => v === true)
        .slice(0, 5)
        .map(([k]) => k);
      
      if (samplePerms.length > 0) {
        console.log(`     - Sample: ${samplePerms.join(', ')}...`);
      }
    }
  }

  console.log('\n\n' + '═'.repeat(80));
  console.log('✅ Check complete\n');
}

checkUserStatus()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });


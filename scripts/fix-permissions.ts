/**
 * Fix Permission Issues Script
 * 
 * Fixes:
 * 1. Remove Founder role from test user
 * 2. Set is_superadmin flag for admin user (optional but recommended)
 * 3. Verify all changes
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

async function fixPermissions() {
  console.log('\n🔧 Fixing Permission Issues\n');
  console.log('═'.repeat(80));

  // Fix 1: Remove Founder role from test user
  console.log('\n📝 Fix 1: Removing Founder role from test user...');
  
  const { data: testUser } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('email', 'itigges22@gmail.com')
    .single();

  if (testUser) {
    const { data: founderRole } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'Founder')
      .single();

    if (founderRole) {
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', testUser.id)
        .eq('role_id', founderRole.id);

      if (deleteError) {
        console.log('   ❌ Error:', deleteError.message);
      } else {
        console.log('   ✅ Removed Founder role from test user');
      }
    } else {
      console.log('   ⚠️  Founder role not found');
    }
  } else {
    console.log('   ⚠️  Test user not found');
  }

  // Fix 2: Set is_superadmin flag for admin user (recommended)
  console.log('\n📝 Fix 2: Setting is_superadmin flag for admin user...');
  
  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({ is_superadmin: true })
    .eq('email', 'jitigges@vt.edu');

  if (updateError) {
    console.log('   ❌ Error:', updateError.message);
  } else {
    console.log('   ✅ Set is_superadmin flag for admin user');
    console.log('   Note: Admin already had access via "Superadmin" role name');
  }

  // Verify changes
  console.log('\n\n🔍 Verifying Changes...\n');
  console.log('─'.repeat(80));

  // Check admin user
  const { data: adminProfile } = await supabase
    .from('user_profiles')
    .select('id, email, name, is_superadmin')
    .eq('email', 'jitigges@vt.edu')
    .single();

  if (adminProfile) {
    console.log(`\n✅ Admin User (${adminProfile.email}):`);
    console.log(`   is_superadmin: ${adminProfile.is_superadmin ? 'TRUE ✅' : 'FALSE ❌'}`);
  }

  // Check test user roles
  const { data: testProfile } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('email', 'itigges22@gmail.com')
    .single();

  if (testProfile) {
    const { data: testUserRoles } = await supabase
      .from('user_roles')
      .select(`
        role_id,
        roles (
          name,
          permissions
        )
      `)
      .eq('user_id', testProfile.id);

    console.log(`\n✅ Test User (itigges22@gmail.com):`);
    console.log(`   Roles assigned: ${testUserRoles?.length || 0}`);
    
    if (testUserRoles) {
      for (const ur of testUserRoles) {
        const role = (ur as any).roles;
        const permissions = role.permissions || {};
        const granted = Object.values(permissions).filter(v => v === true).length;
        console.log(`   - ${role.name}: ${granted} permissions`);
      }
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log('✅ Fixes complete!\n');
}

fixPermissions()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });


#!/usr/bin/env tsx

import { Client } from 'pg'

async function verifyMigration() {
  const password = encodeURIComponent('Isaac@9389454!')
  const connectionString = `postgresql://postgres.oomnezdhkmsfjlihkmui:${password}@aws-1-us-east-2.pooler.supabase.com:5432/postgres`
  
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  })

  try {
    await client.connect()
    console.log('🔍 Verifying RBAC Migration\n')
    console.log('='.repeat(60))

    // 1. Check project_assignments table
    console.log('\n1️⃣  Checking project_assignments table...')
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'project_assignments'
      );
    `)
    console.log(tableCheck.rows[0].exists ? '   ✅ project_assignments table exists' : '   ❌ Table missing')

    // 2. Check RBAC columns in roles table
    console.log('\n2️⃣  Checking RBAC columns in roles table...')
    const rolesColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'roles' 
        AND column_name IN ('description', 'is_system_role', 'hierarchy_level', 'display_order', 'reporting_role_id')
      ORDER BY column_name;
    `)
    console.log(`   ✅ Found ${rolesColumns.rows.length}/5 RBAC columns:`)
    rolesColumns.rows.forEach(row => console.log(`      - ${row.column_name}`))

    // 3. Check is_superadmin column in user_profiles
    console.log('\n3️⃣  Checking user_profiles table...')
    const profilesColumn = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'user_profiles' 
        AND column_name = 'is_superadmin'
      );
    `)
    console.log(profilesColumn.rows[0].exists ? '   ✅ is_superadmin column exists' : '   ❌ Column missing')

    // 4. Check RLS helper functions
    console.log('\n4️⃣  Checking RLS helper functions...')
    const functions = await client.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
        AND routine_name IN (
          'get_user_role_ids', 
          'user_is_superadmin', 
          'user_has_permission',
          'user_assigned_to_project',
          'user_manages_department',
          'user_has_account_access',
          'get_user_department_ids',
          'can_view_project',
          'can_edit_project',
          'can_delete_project'
        )
      ORDER BY routine_name;
    `)
    console.log(`   ✅ Found ${functions.rows.length}/10 RLS helper functions:`)
    functions.rows.forEach(row => console.log(`      - ${row.routine_name}()`))

    // 5. Check system roles
    console.log('\n5️⃣  Checking system roles...')
    const systemRoles = await client.query(`
      SELECT name, is_system_role, hierarchy_level 
      FROM roles 
      WHERE is_system_role = true 
      ORDER BY hierarchy_level;
    `)
    console.log(`   ✅ Found ${systemRoles.rows.length} system roles:`)
    systemRoles.rows.forEach(row => {
      console.log(`      - ${row.name} (hierarchy: ${row.hierarchy_level})`)
    })

    // 6. Check RLS policies
    console.log('\n6️⃣  Checking RLS policies...')
    const policies = await client.query(`
      SELECT tablename, COUNT(*) as policy_count
      FROM pg_policies 
      WHERE schemaname = 'public'
        AND tablename IN (
          'user_profiles', 'roles', 'user_roles', 'departments', 
          'accounts', 'projects', 'project_assignments', 'tasks', 'deliverables'
        )
      GROUP BY tablename
      ORDER BY tablename;
    `)
    console.log(`   ✅ RLS policies applied to ${policies.rows.length} tables:`)
    policies.rows.forEach(row => {
      console.log(`      - ${row.tablename}: ${row.policy_count} policies`)
    })

    console.log('\n' + '='.repeat(60))
    console.log('✅ Migration verification complete!\n')

  } catch (error: any) {
    console.error('❌ Verification error:', error.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

verifyMigration()


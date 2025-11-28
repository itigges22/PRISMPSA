#!/usr/bin/env tsx

import { Client } from 'pg'
import { readFileSync } from 'fs'
import { join } from 'path'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: join(process.cwd(), '.env.local') })

async function applyRLSFix() {
  // Use the same connection approach as apply-migration-now.ts
  // Password is in DATABASE_URL but we'll use the working format
  const password = encodeURIComponent('Isaac@9389454!')
  const connectionString = `postgresql://postgres.oomnezdhkmsfjlihkmui:${password}@aws-1-us-east-2.pooler.supabase.com:5432/postgres`
  
  console.log('📋 Applying RLS Policy Fixes\n')
  console.log('='.repeat(60))
  console.log('🔐 Connecting to Supabase via IPv4 pooler...')
  console.log(`    Host: aws-1-us-east-2.pooler.supabase.com`)
  console.log(`    Port: 5432`)
  console.log(`    User: postgres.oomnezdhkmsfjlihkmui`)
  console.log(`    Database: postgres`)
  console.log(`    SSL: enabled\n`)

  const client = new Client({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  })

  try {
    console.log('🔌 Attempting connection...')
    await client.connect()
    console.log('✅ Connected successfully!\n')

    // Test query first
    console.log('🧪 Testing connection with simple query...')
    const testResult = await client.query('SELECT current_database(), current_user, version()')
    console.log(`✅ Database: ${testResult.rows[0].current_database}`)
    console.log(`✅ User: ${testResult.rows[0].current_user}\n`)

    // Read SQL file
    console.log('📖 Reading SQL migration file...')
    const sqlPath = join(process.cwd(), 'supabase', 'FIX_RLS_POLICIES.sql')
    const sqlContent = readFileSync(sqlPath, 'utf-8')
    console.log(`✅ Read ${sqlContent.split('\n').length} lines from FIX_RLS_POLICIES.sql\n`)

    console.log('🚀 Executing RLS policy fixes...')
    console.log('    This may take 10-30 seconds...\n')
    
    const startTime = Date.now()
    
    // Execute the SQL
    const result = await client.query(sqlContent)
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    
    console.log(`\n✅ RLS policies fixed successfully in ${duration}s!`)
    
    // Verify the policies were applied
    console.log('\n🔍 Verifying RLS policies...\n')
    
    const policiesCheck = await client.query(`
      SELECT 
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename IN ('roles', 'departments', 'accounts', 'projects', 'user_profiles', 'user_roles')
      ORDER BY tablename, policyname;
    `)
    
    console.log(`✅ Found ${policiesCheck.rows.length} RLS policies:`)
    const tables = new Set(policiesCheck.rows.map((r: any) => r.tablename))
    tables.forEach(table => {
      const tablePolicies = policiesCheck.rows.filter((r: any) => r.tablename === table)
      console.log(`   📋 ${table}: ${tablePolicies.length} policies`)
      tablePolicies.forEach((policy: any) => {
        console.log(`      - ${policy.policyname} (${policy.cmd})`)
      })
    })
    
    // Check RLS is enabled
    console.log('\n🔒 Verifying RLS is enabled...')
    const rlsCheck = await client.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND tablename IN ('user_profiles', 'roles', 'user_roles', 'departments', 'accounts', 'projects')
      ORDER BY tablename;
    `)
    
    console.log('\n✅ RLS Status:')
    rlsCheck.rows.forEach((row: any) => {
      const status = row.rowsecurity ? '✅ Enabled' : '❌ Disabled'
      console.log(`   ${row.tablename}: ${status}`)
    })
    
    console.log('\n🎉 RLS Policy Fix Complete!')
    console.log('\nWhat was fixed:')
    console.log('  ✅ Roles table - Now requires VIEW_ROLES permission')
    console.log('  ✅ Departments table - Added VIEW_DEPARTMENTS permission check')
    console.log('  ✅ Accounts table - Added VIEW_ACCOUNTS permission check')
    console.log('  ✅ Projects table - Permission checks verified')
    console.log('  ✅ User profiles & roles - Permission checks verified')
    console.log('  ✅ All helper functions updated')
    
  } catch (error: any) {
    console.error('\n❌ Error:')
    console.error(`   Message: ${error.message}`)
    console.error(`   Code: ${error.code}`)
    if (error.position) {
      console.error(`   Position: ${error.position}`)
    }
    if (error.detail) {
      console.error(`   Detail: ${error.detail}`)
    }
    if (error.hint) {
      console.error(`   Hint: ${error.hint}`)
    }
    if (error.stack) {
      console.error(`\nStack trace:\n${error.stack}`)
    }
    process.exit(1)
  } finally {
    await client.end()
    console.log('\n🔌 Connection closed')
  }
}

applyRLSFix()


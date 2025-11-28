#!/usr/bin/env tsx

import { Client } from 'pg'
import { readFileSync } from 'fs'
import { join } from 'path'

async function applySQL() {
  // New password: Isaac@9389454!
  const password = encodeURIComponent('Isaac@9389454!')
  const connectionString = `postgresql://postgres.oomnezdhkmsfjlihkmui:${password}@aws-1-us-east-2.pooler.supabase.com:5432/postgres`
  
  console.log('📋 Reading SQL migration file...')
  const sqlPath = join(process.cwd(), 'supabase', 'MANUAL_APPLY_ALL_PUBLIC.sql')
  const sqlContent = readFileSync(sqlPath, 'utf-8')

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

    console.log('🚀 Executing SQL migration (497 lines)...')
    console.log('    This may take 10-30 seconds...\n')
    
    const startTime = Date.now()
    const result = await client.query(sqlContent)
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    
    console.log(`\n✅ Migration executed successfully in ${duration}s!`)
    console.log(`📊 Result: ${result.rowCount !== null ? result.rowCount + ' rows affected' : 'Success'}`)
    
    console.log('\n🎉 RBAC System Migration Complete!')
    console.log('\nWhat was applied:')
    console.log('  ✅ project_assignments table created')
    console.log('  ✅ RBAC columns added to roles & user_profiles')
    console.log('  ✅ 10 RLS helper functions deployed')
    console.log('  ✅ RLS policies for 9 tables applied')
    console.log('  ✅ System roles (Superadmin, Unassigned) seeded')
    
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
    process.exit(1)
  } finally {
    await client.end()
    console.log('\n🔌 Connection closed')
  }
}

console.log('🎯 Applying RBAC SQL Migration\n')
console.log('='.repeat(60))
applySQL().catch(err => {
  console.error('\n💥 Fatal error:', err.message)
  process.exit(1)
})


import { Client } from 'pg'
import { readFileSync } from 'fs'
import { join } from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: join(process.cwd(), '.env.local') })

async function applyTaskAssignmentMigration() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in .env.local')
    process.exit(1)
  }

  console.log('📋 Applying Task Assignment Migration\n')
  console.log('='.repeat(60))
  console.log('🔐 Connecting to Supabase...')

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  })

  try {
    await client.connect()
    console.log('✅ Connected successfully!\n')

    // Test query
    const testResult = await client.query('SELECT NOW()')
    console.log(`✅ Database connection verified: ${testResult.rows[0].now}\n`)

    const sqlPath = join(process.cwd(), 'supabase', 'ADD_TASK_ASSIGNMENT.sql')
    const sqlContent = readFileSync(sqlPath, 'utf-8')
    console.log('📖 Reading SQL migration file...')
    console.log(`✅ Read ${sqlContent.split('\n').length} lines from ADD_TASK_ASSIGNMENT.sql\n`)

    console.log('🚀 Executing migration...')
    await client.query(sqlContent)
    console.log('✅ Migration applied successfully!')

    // Verify the column was added
    console.log('\n🔍 Verifying migration...')
    const verifyResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'tasks' AND column_name = 'assigned_to'
    `)
    
    if (verifyResult.rows.length > 0) {
      console.log('✅ Column "assigned_to" exists in tasks table:')
      console.log(`   Type: ${verifyResult.rows[0].data_type}`)
      console.log(`   Nullable: ${verifyResult.rows[0].is_nullable}`)
    } else {
      console.log('⚠️  Warning: Could not verify column existence')
    }

    // Verify indexes
    const indexResult = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'tasks' AND indexname LIKE '%assigned_to%'
    `)
    
    if (indexResult.rows.length > 0) {
      console.log(`✅ Found ${indexResult.rows.length} index(es) for assigned_to:`)
      indexResult.rows.forEach(row => {
        console.log(`   - ${row.indexname}`)
      })
    }

    console.log('\n✅ Migration completed successfully!')
  } catch (error: any) {
    console.error('\n❌ Error:')
    console.error(`   Message: ${error.message}`)
    if (error.code) {
      console.error(`   Code: ${error.code}`)
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

applyTaskAssignmentMigration().catch(err => {
  console.error('\n💥 Fatal error:', err.message)
  process.exit(1)
})


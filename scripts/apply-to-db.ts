import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function applyMigration() {
  // Extract password from DATABASE_URL
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL not found in .env.local');
    process.exit(1);
  }
  
  // Parse password from DATABASE_URL
  const passwordMatch = dbUrl.match(/:([^@]+)@/);
  const password = passwordMatch ? passwordMatch[1] : '';
  
  // Use pooler connection which is more reliable
  const connectionString = `postgresql://postgres.oomnezdhkmsfjlihkmui:${encodeURIComponent(password)}@aws-1-us-east-2.pooler.supabase.com:5432/postgres`;
  
  console.log('🔌 Using pooler connection...');
  
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to Supabase...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    const sqlFile = path.join(__dirname, '../supabase/APPLY_THIS_MIGRATION.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log('📝 Executing migration...\n');
    
    const result = await client.query(sql);
    
    console.log('✅ Migration applied successfully!');
    console.log('\n📊 Result:', result);
    
  } catch (error: any) {
    console.error('❌ Error applying migration:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Disconnected from database');
  }
}

applyMigration();


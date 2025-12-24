#!/usr/bin/env tsx
/**
 * Docker Health Check Script
 *
 * This script verifies that the local Docker-based Supabase environment
 * is properly configured and running with seed data.
 *
 * Checks performed:
 * 1. Database connection
 * 2. Seed data exists (users, accounts, projects)
 * 3. RLS functions work correctly
 * 4. Permission system is functional
 * 5. Critical tables are accessible
 *
 * Usage:
 *   npm run docker:health
 *   or: npx tsx scripts/docker-health-check.ts
 */

import { createClient } from '@supabase/supabase-js';

// Local Supabase configuration - try 127.0.0.1 first for Windows compatibility
const SUPABASE_URLS = [
  'http://127.0.0.1:54321',  // Windows prefers IP address
  'http://localhost:54321',  // Fallback to localhost (macOS/Linux)
];
const SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

interface HealthCheckResult {
  name: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const results: HealthCheckResult[] = [];

function printResult(result: HealthCheckResult) {
  const icon = result.passed ? '✅' : '❌';
  const status = result.passed ? 'PASS' : 'FAIL';
  console.log(`${icon} ${result.name}: ${status}`);
  if (result.details) {
    console.log(`   ${result.details}`);
  }
  if (result.error) {
    console.log(`   Error: ${result.error}`);
  }
}

async function runHealthChecks() {
  console.log('🏥 Running MovaLab Docker Health Checks\n');
  console.log('='.repeat(60));
  console.log('');

  // Try both localhost and 127.0.0.1 (Windows compatibility)
  let workingUrl: string | null = null;
  let supabase: any = null;

  for (const url of SUPABASE_URLS) {
    const testClient = createClient(url, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    try {
      // Quick connectivity test
      const { error } = await testClient.from('user_profiles').select('count').limit(1);
      if (!error) {
        workingUrl = url;
        supabase = testClient;
        break;
      }
    } catch (e) {
      // Try next URL
      continue;
    }
  }

  if (!supabase || !workingUrl) {
    // Create client anyway for remaining checks (will fail gracefully)
    workingUrl = SUPABASE_URLS[0];
    supabase = createClient(workingUrl, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  // ============================================================================
  // CHECK 1: Database Connection (with retry and better diagnostics)
  // ============================================================================
  console.log('1️⃣  Testing database connection...');
  console.log(`   Attempting connection to Supabase API...`);

  let connectionSuccess = false;
  let connectionError: string | null = null;
  const maxRetries = 5; // Increased from 3 to 5 for Windows
  let retryDelay = 2000; // Start with 2 seconds

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`   Retry ${attempt - 1}/${maxRetries - 1} (waiting ${retryDelay / 1000}s)...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retryDelay = Math.min(retryDelay + 1000, 5000); // Increase delay up to 5s
      }

      const { error } = await supabase.from('user_profiles').select('count').limit(1);

      if (error) {
        connectionError = error.message;
        // If it's a connection error, retry
        if (error.message && (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED'))) {
          continue;
        }
        // Other errors (like table not found) shouldn't retry
        break;
      } else {
        connectionSuccess = true;
        break;
      }
    } catch (error: any) {
      connectionError = error.message || 'Connection failed';

      // Provide more specific error messages
      if (error.message && error.message.includes('fetch failed')) {
        connectionError = 'Cannot connect to Supabase API (localhost:54321)';
        if (attempt === maxRetries) {
          connectionError += '\n        Services are running in Docker but API is not accessible.';
          connectionError += '\n        Try: npx supabase status (to verify services)';
          connectionError += '\n        Or: npx supabase stop && npx supabase start (to restart)';
        }
      } else if (error.message && error.message.includes('ECONNREFUSED')) {
        connectionError = 'Connection refused - Supabase API not responding';
      }
    }
  }

  if (connectionSuccess) {
    results.push({
      name: 'Database Connection',
      passed: true,
      details: `Successfully connected via ${workingUrl}`,
    });
  } else {
    results.push({
      name: 'Database Connection',
      passed: false,
      error: connectionError || 'Connection failed after retries',
    });
  }

  printResult(results[results.length - 1]);
  console.log('');

  // ============================================================================
  // CHECK 2: Seed Data - Users
  // ============================================================================
  console.log('2️⃣  Checking seed data - Users...');
  try {
    const { data: users, error } = await supabase.from('user_profiles').select('id, email, name');

    if (error) {
      results.push({
        name: 'Seed Data - Users',
        passed: false,
        error: error.message,
      });
    } else if (!users || users.length === 0) {
      results.push({
        name: 'Seed Data - Users',
        passed: false,
        details: 'No users found. Run: npx tsx scripts/create-seed-users.ts',
      });
    } else {
      results.push({
        name: 'Seed Data - Users',
        passed: true,
        details: `Found ${users.length} test users`,
      });
    }
  } catch (error: any) {
    results.push({
      name: 'Seed Data - Users',
      passed: false,
      error: error.message,
    });
  }

  printResult(results[results.length - 1]);
  console.log('');

  // ============================================================================
  // CHECK 3: Seed Data - Accounts
  // ============================================================================
  console.log('3️⃣  Checking seed data - Accounts...');
  try {
    const { data: accounts, error } = await supabase.from('accounts').select('id, name');

    if (error) {
      results.push({
        name: 'Seed Data - Accounts',
        passed: false,
        error: error.message,
      });
    } else if (!accounts || accounts.length === 0) {
      results.push({
        name: 'Seed Data - Accounts',
        passed: false,
        details: 'No accounts found. Check seed.sql was loaded',
      });
    } else {
      results.push({
        name: 'Seed Data - Accounts',
        passed: true,
        details: `Found ${accounts.length} test accounts`,
      });
    }
  } catch (error: any) {
    results.push({
      name: 'Seed Data - Accounts',
      passed: false,
      error: error.message,
    });
  }

  printResult(results[results.length - 1]);
  console.log('');

  // ============================================================================
  // CHECK 4: Seed Data - Projects
  // ============================================================================
  console.log('4️⃣  Checking seed data - Projects...');
  try {
    const { data: projects, error } = await supabase.from('projects').select('id, name, status');

    if (error) {
      results.push({
        name: 'Seed Data - Projects',
        passed: false,
        error: error.message,
      });
    } else if (!projects || projects.length === 0) {
      results.push({
        name: 'Seed Data - Projects',
        passed: false,
        details: 'No projects found. Check seed.sql was loaded',
      });
    } else {
      results.push({
        name: 'Seed Data - Projects',
        passed: true,
        details: `Found ${projects.length} test projects`,
      });
    }
  } catch (error: any) {
    results.push({
      name: 'Seed Data - Projects',
      passed: false,
      error: error.message,
    });
  }

  printResult(results[results.length - 1]);
  console.log('');

  // ============================================================================
  // CHECK 5: RLS Functions - user_is_superadmin()
  // ============================================================================
  console.log('5️⃣  Testing RLS function - user_is_superadmin()...');
  try {
    const { data, error } = await supabase.rpc('user_is_superadmin');

    if (error) {
      results.push({
        name: 'RLS Function - user_is_superadmin()',
        passed: false,
        error: error.message,
      });
    } else {
      results.push({
        name: 'RLS Function - user_is_superadmin()',
        passed: true,
        details: `Function executed successfully (result: ${data})`,
      });
    }
  } catch (error: any) {
    results.push({
      name: 'RLS Function - user_is_superadmin()',
      passed: false,
      error: error.message,
    });
  }

  printResult(results[results.length - 1]);
  console.log('');

  // ============================================================================
  // CHECK 6: Permission System - Roles
  // ============================================================================
  console.log('6️⃣  Testing permission system - Roles...');
  try {
    const { data: roles, error } = await supabase
      .from('roles')
      .select('id, name, permissions')
      .limit(5);

    if (error) {
      results.push({
        name: 'Permission System - Roles',
        passed: false,
        error: error.message,
      });
    } else if (!roles || roles.length === 0) {
      results.push({
        name: 'Permission System - Roles',
        passed: false,
        details: 'No roles found. Check seed.sql was loaded',
      });
    } else {
      // Check if roles have permissions JSONB field
      const hasPermissions = roles.every((role: { id: string; name: string; permissions: unknown }) => role.permissions && typeof role.permissions === 'object');

      if (hasPermissions) {
        results.push({
          name: 'Permission System - Roles',
          passed: true,
          details: `Found ${roles.length} roles with permissions`,
        });
      } else {
        results.push({
          name: 'Permission System - Roles',
          passed: false,
          details: 'Roles exist but permissions field is invalid',
        });
      }
    }
  } catch (error: any) {
    results.push({
      name: 'Permission System - Roles',
      passed: false,
      error: error.message,
    });
  }

  printResult(results[results.length - 1]);
  console.log('');

  // ============================================================================
  // CHECK 7: Critical Tables - Tasks
  // ============================================================================
  console.log('7️⃣  Testing critical tables - Tasks...');
  try {
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('id, name, status')
      .limit(5);

    if (error) {
      results.push({
        name: 'Critical Tables - Tasks',
        passed: false,
        error: error.message,
      });
    } else {
      results.push({
        name: 'Critical Tables - Tasks',
        passed: true,
        details: `Found ${tasks?.length || 0} tasks`,
      });
    }
  } catch (error: any) {
    results.push({
      name: 'Critical Tables - Tasks',
      passed: false,
      error: error.message,
    });
  }

  printResult(results[results.length - 1]);
  console.log('');

  // ============================================================================
  // CHECK 8: Workflow System
  // ============================================================================
  console.log('8️⃣  Testing workflow system...');
  try {
    const { data: workflows, error } = await supabase
      .from('workflow_templates')
      .select('id, name, is_active')
      .limit(5);

    if (error) {
      results.push({
        name: 'Workflow System',
        passed: false,
        error: error.message,
      });
    } else {
      results.push({
        name: 'Workflow System',
        passed: true,
        details: `Found ${workflows?.length || 0} workflow templates`,
      });
    }
  } catch (error: any) {
    results.push({
      name: 'Workflow System',
      passed: false,
      error: error.message,
    });
  }

  printResult(results[results.length - 1]);
  console.log('');

  // ============================================================================
  // Summary
  // ============================================================================
  console.log('='.repeat(60));
  console.log('');

  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  const allPassed = passedCount === totalCount;

  if (allPassed) {
    console.log('🎉 All health checks passed! (' + passedCount + '/' + totalCount + ')');
    console.log('');
    console.log('✅ Your MovaLab Docker environment is ready!');
    console.log('');
    console.log('📍 Service URLs:');
    console.log('   - App:             http://localhost:3000 (run: npm run dev)');
    console.log('   - Supabase Studio: http://localhost:54323');
    console.log('   - API:             http://localhost:54321');
    console.log('   - PostgreSQL:      localhost:54322');
    console.log('');
    console.log('🔐 Test User Login:');
    console.log('   Email:    superadmin@test.local');
    console.log('   Password: Test1234!');
    console.log('');
  } else {
    console.log('⚠️  Some health checks failed (' + passedCount + '/' + totalCount + ' passed)');
    console.log('');
    console.log('🔧 Troubleshooting:');
    console.log('');
    console.log('   1. Make sure Supabase is running:');
    console.log('      npm run docker:start');
    console.log('');
    console.log('   2. Reset database and migrations:');
    console.log('      npm run docker:reset');
    console.log('');
    console.log('   3. Create seed users:');
    console.log('      npx tsx scripts/create-seed-users.ts');
    console.log('');
    console.log('   4. Run full setup again:');
    console.log('      ./scripts/first-time-setup.sh');
    console.log('');
  }

  process.exit(allPassed ? 0 : 1);
}

// Run the health checks
runHealthChecks().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});

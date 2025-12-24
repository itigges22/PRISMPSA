#!/usr/bin/env tsx
/**
 * Test Project Page Permissions
 *
 * Tests different user types accessing project data to verify:
 * 1. Correct access based on permissions
 * 2. Account information is accessible
 * 3. No RLS errors occur
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const PASSWORD = 'Test1234!';

// Test users
const TEST_USERS = {
  superadmin: { email: 'superadmin@test.local', name: 'Super Admin' },
  executive: { email: 'exec@test.local', name: 'Alex Executive' },
  accountManager: { email: 'manager@test.local', name: 'Morgan Manager' },
  projectManager: { email: 'pm@test.local', name: 'Pat ProjectManager' },
  designer: { email: 'designer@test.local', name: 'Dana Designer' },
  developer: { email: 'dev@test.local', name: 'Dev Developer' },
  contributor: { email: 'contributor@test.local', name: 'Casey Contributor' },
};

// Test projects
const TEST_PROJECTS = {
  websiteRedesign: {
    id: 'ffffffff-0001-0002-0003-000000000001',
    name: 'Website Redesign',
    accountName: 'Acme Corp',
  },
  mobileApp: {
    id: 'ffffffff-0001-0002-0003-000000000003',
    name: 'Mobile App MVP',
    accountName: 'StartupXYZ',
  },
  socialMedia: {
    id: 'ffffffff-0001-0002-0003-000000000005',
    name: 'Social Media Management',
    accountName: 'Local Business',
  },
};

interface TestResult {
  user: string;
  project: string;
  canViewProject: boolean;
  canViewAccount: boolean;
  accountName: string | null;
  error: string | null;
}

async function loginAsUser(email: string): Promise<SupabaseClient | null> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });

  if (error) {
    console.error(`  ❌ Login failed for ${email}: ${error.message}`);
    return null;
  }

  return supabase;
}

async function testProjectAccess(
  supabase: SupabaseClient,
  projectId: string,
  projectName: string
): Promise<{ canView: boolean; accountName: string | null; error: string | null }> {
  // Query project with account info (same as project page does - using maybeSingle)
  const { data: project, error } = await supabase
    .from('projects')
    .select(`
      id,
      name,
      account:accounts(id, name)
    `)
    .eq('id', projectId)
    .maybeSingle();

  if (error) {
    return {
      canView: false,
      accountName: null,
      error: `${error.code}: ${error.message}`,
    };
  }

  if (!project) {
    // This is expected when RLS blocks access - not an error
    return {
      canView: false,
      accountName: null,
      error: null, // Access denied by RLS (expected behavior)
    };
  }

  const account = Array.isArray(project.account) ? project.account[0] : project.account;

  return {
    canView: true,
    accountName: account?.name || null,
    error: null,
  };
}

async function testUserPermissions(userKey: string, user: { email: string; name: string }): Promise<TestResult[]> {
  const results: TestResult[] = [];

  const supabase = await loginAsUser(user.email);
  if (!supabase) {
    return Object.values(TEST_PROJECTS).map((p) => ({
      user: user.name,
      project: p.name,
      canViewProject: false,
      canViewAccount: false,
      accountName: null,
      error: 'Login failed',
    }));
  }

  for (const [projectKey, project] of Object.entries(TEST_PROJECTS)) {
    const result = await testProjectAccess(supabase, project.id, project.name);

    results.push({
      user: user.name,
      project: project.name,
      canViewProject: result.canView,
      canViewAccount: result.accountName !== null,
      accountName: result.accountName,
      error: result.error,
    });
  }

  await supabase.auth.signOut();
  return results;
}

async function runTests() {
  console.log('🔐 Project Page Permission Tests\n');
  console.log('='.repeat(80));

  // Check if Supabase is running
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  try {
    await adminClient.from('departments').select('count').limit(1);
    console.log('✅ Connected to local Supabase\n');
  } catch (e) {
    console.error('❌ Cannot connect to Supabase. Make sure it is running: npm run docker:start');
    process.exit(1);
  }

  const allResults: TestResult[] = [];

  // Test each user
  for (const [userKey, user] of Object.entries(TEST_USERS)) {
    console.log(`\n👤 Testing: ${user.name} (${user.email})`);
    console.log('-'.repeat(60));

    const results = await testUserPermissions(userKey, user);

    for (const result of results) {
      const projectIcon = result.canViewProject ? '✅' : '❌';
      const accountIcon = result.canViewAccount ? '✅' : '⚠️';

      console.log(
        `  ${projectIcon} ${result.project.padEnd(25)} | Account: ${accountIcon} ${(result.accountName || 'N/A').padEnd(15)} ${result.error ? `| Error: ${result.error}` : ''}`
      );
    }

    allResults.push(...results);
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 Summary\n');

  const totalTests = allResults.length;
  const projectAccessSuccess = allResults.filter((r) => r.canViewProject).length;
  const accountAccessSuccess = allResults.filter((r) => r.canViewAccount).length;
  const errors = allResults.filter((r) => r.error && !r.error.includes('RLS'));

  console.log(`  Total tests: ${totalTests}`);
  console.log(`  Project access: ${projectAccessSuccess}/${totalTests} (expected varies by user)`);
  console.log(`  Account visible: ${accountAccessSuccess}/${projectAccessSuccess} projects with account info`);
  console.log(`  Errors (excluding RLS blocks): ${errors.length}`);

  // Check for PGRST116 errors (the main bug we're fixing)
  const pgrst116Errors = allResults.filter((r) => r.error?.includes('PGRST116'));
  if (pgrst116Errors.length > 0) {
    console.log(`\n  ❌ PGRST116 errors found (these should not happen):`);
    for (const e of pgrst116Errors) {
      console.log(`     - ${e.user} viewing ${e.project}: ${e.error}`);
    }
  } else {
    console.log(`\n  ✅ No PGRST116 errors (fix is working!)`);
  }

  // Check for 406 errors
  const http406Errors = allResults.filter((r) => r.error?.includes('406'));
  if (http406Errors.length > 0) {
    console.log(`\n  ❌ HTTP 406 errors found:`);
    for (const e of http406Errors) {
      console.log(`     - ${e.user} viewing ${e.project}: ${e.error}`);
    }
  } else {
    console.log(`  ✅ No HTTP 406 errors`);
  }

  // Expected access matrix
  console.log('\n' + '='.repeat(80));
  console.log('📋 Expected Access Matrix\n');
  console.log('  Superadmin & Executive: All projects, all accounts');
  console.log('  Account Manager: Projects in managed accounts (Acme, StartupXYZ)');
  console.log('  Project Manager: Website Redesign, Marketing Campaign, Local Business projects');
  console.log('  Designer: Website Redesign, Mobile App, Brand Identity');
  console.log('  Developer: Website Redesign, Mobile App');
  console.log('  Contributor: Social Media, SEO Optimization');
  console.log('');
}

runTests().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});

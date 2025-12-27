#!/usr/bin/env tsx
/**
 * Create Seed Users and Load User-Dependent Data
 *
 * This script:
 * 1. Creates 8 test users in local Supabase auth.users
 * 2. Updates user_profiles with bio/skills/is_superadmin
 * 3. Assigns roles to users
 * 4. Loads all user-dependent seed data (accounts, projects, tasks, etc.)
 *
 * All test users have the password: Test1234!
 *
 * Usage:
 *   1. Start local Supabase: npm run docker:start
 *   2. Reset database: npm run docker:reset
 *   3. Run this script: npx tsx scripts/create-seed-users.ts
 *
 * Or use: npm run docker:seed
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Helper function to get Monday of the week (handles timezone correctly)
function getWeekStartDate(date: Date = new Date()): string {
  // Create a new date at noon to avoid timezone edge cases
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.getFullYear(), d.getMonth(), diff);
  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, '0');
  const dayOfMonth = String(monday.getDate()).padStart(2, '0');
  return `${year}-${month}-${dayOfMonth}`;
}

// Local Supabase configuration - try multiple URLs for Windows compatibility
const SUPABASE_URLS = [
  'http://127.0.0.1:54321', // Windows prefers IP address
  'http://localhost:54321', // Fallback to localhost
];
const SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

// Helper to find working Supabase URL
async function findWorkingSupabaseClient(): Promise<{ client: SupabaseClient; url: string } | null> {
  for (const url of SUPABASE_URLS) {
    const client = createClient(url, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    try {
      const { error } = await client.from('departments').select('count').limit(1);
      if (!error) {
        return { client, url };
      }
    } catch {
      continue;
    }
  }
  return null;
}

// Test users matching specific UUIDs
const TEST_USERS = [
  {
    id: '11111111-1111-1111-1111-000000000001',
    email: 'superadmin@test.local',
    name: 'Super Admin',
    password: 'Test1234!',
    is_superadmin: true,
    bio: 'System administrator with full access to all features',
    skills: ['administration', 'management', 'system-architecture'],
    role_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', // Superadmin role
  },
  {
    id: '11111111-1111-1111-1111-000000000002',
    email: 'exec@test.local',
    name: 'Alex Executive',
    password: 'Test1234!',
    is_superadmin: false,
    bio: 'Executive Director overseeing all operations',
    skills: ['leadership', 'strategy', 'business-development'],
    role_id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', // Executive Director
  },
  {
    id: '11111111-1111-1111-1111-000000000003',
    email: 'manager@test.local',
    name: 'Morgan Manager',
    password: 'Test1234!',
    is_superadmin: false,
    bio: 'Account Manager handling enterprise clients',
    skills: ['account-management', 'client-relations', 'project-planning'],
    role_id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', // Account Manager
  },
  {
    id: '11111111-1111-1111-1111-000000000004',
    email: 'pm@test.local',
    name: 'Pat ProjectManager',
    password: 'Test1234!',
    is_superadmin: false,
    bio: 'Project Manager coordinating cross-functional teams',
    skills: ['project-management', 'agile', 'scrum', 'coordination'],
    role_id: 'ffffffff-ffff-ffff-ffff-ffffffffffff', // Project Manager
  },
  {
    id: '11111111-1111-1111-1111-000000000009',
    email: 'admin@test.local',
    name: 'Andy Admin',
    password: 'Test1234!',
    is_superadmin: false,
    bio: 'System Administrator managing workflows and user roles',
    skills: ['system-administration', 'workflow-design', 'user-management', 'analytics'],
    role_id: '77777777-7777-7777-7777-777777777777', // Admin
  },
  {
    id: '11111111-1111-1111-1111-000000000005',
    email: 'designer@test.local',
    name: 'Dana Designer',
    password: 'Test1234!',
    is_superadmin: false,
    bio: 'Senior Designer creating beautiful user experiences',
    skills: ['ui-design', 'ux-design', 'figma', 'adobe-creative-suite'],
    role_id: '10101010-1010-1010-1010-101010101010', // Senior Designer
  },
  {
    id: '11111111-1111-1111-1111-000000000006',
    email: 'dev@test.local',
    name: 'Dev Developer',
    password: 'Test1234!',
    is_superadmin: false,
    bio: 'Senior Developer building scalable applications',
    skills: ['typescript', 'react', 'node.js', 'postgresql', 'next.js'],
    role_id: '30303030-3030-3030-3030-303030303030', // Senior Developer
  },
  {
    id: '11111111-1111-1111-1111-000000000007',
    email: 'contributor@test.local',
    name: 'Casey Contributor',
    password: 'Test1234!',
    is_superadmin: false,
    bio: 'Part-time contributor supporting various projects',
    skills: ['content-writing', 'qa-testing', 'documentation'],
    role_id: '70707070-7070-7070-7070-707070707070', // Contributor
  },
  {
    id: '11111111-1111-1111-1111-000000000008',
    email: 'client@test.local',
    name: 'Chris Client',
    password: 'Test1234!',
    is_superadmin: false,
    bio: 'Client user from Acme Corp',
    skills: [],
    role_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', // Client
  },
];

async function createSeedUsers() {
  console.log('🔐 MovaLab Seed Data Setup\n');
  console.log('='.repeat(60));

  // Test connection with multiple URLs (Windows compatibility)
  console.log('\n📡 Step 1: Connecting to local Supabase...');

  const result = await findWorkingSupabaseClient();

  if (!result) {
    console.error('❌ Failed to connect to Supabase');
    console.error('\n💡 Make sure local Supabase is running:');
    console.error('   npm run docker:start');
    console.error('\n   If services are running but connection fails, try:');
    console.error('   npx supabase stop && npx supabase start\n');
    process.exit(1);
  }

  const { client: supabase, url: workingUrl } = result;
  console.log(`✅ Connected to Supabase at ${workingUrl}\n`);

  // Step 2: Create auth users
  console.log('👥 Step 2: Creating auth users...');
  let usersCreated = 0;
  let usersExisted = 0;

  for (const user of TEST_USERS) {
    const { data, error } = await supabase.auth.admin.createUser({
      id: user.id,
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { name: user.name },
    });

    if (error) {
      if (error.message.includes('already been registered')) {
        usersExisted++;
      } else {
        console.error(`   ❌ Failed to create ${user.email}: ${error.message}`);
      }
    } else {
      usersCreated++;
    }
  }

  console.log(`   ✅ Created: ${usersCreated} users`);
  if (usersExisted > 0) {
    console.log(`   ℹ️  Already existed: ${usersExisted} users`);
  }

  // Wait for trigger to create profiles
  console.log('\n⏳ Waiting for profile triggers...');
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Step 3: Update user profiles
  console.log('\n📝 Step 3: Updating user profiles...');
  for (const user of TEST_USERS) {
    const { error } = await supabase
      .from('user_profiles')
      .update({
        name: user.name,
        bio: user.bio,
        skills: user.skills,
        is_superadmin: user.is_superadmin,
      })
      .eq('id', user.id);

    if (error) {
      console.error(`   ❌ Failed to update profile for ${user.email}: ${error.message}`);
    }
  }
  console.log('   ✅ Profiles updated');

  // Step 4: Assign roles
  console.log('\n🎭 Step 4: Assigning roles...');
  for (const user of TEST_USERS) {
    // Delete existing role assignment if any
    await supabase.from('user_roles').delete().eq('user_id', user.id);

    const { error } = await supabase.from('user_roles').insert({
      user_id: user.id,
      role_id: user.role_id,
    });

    if (error) {
      console.error(`   ❌ Failed to assign role for ${user.email}: ${error.message}`);
    }
  }
  console.log('   ✅ Roles assigned');

  // Step 5: Load user-dependent seed data
  console.log('\n📦 Step 5: Loading seed data...');
  await loadSeedData(supabase);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('🎉 Setup Complete!\n');
  console.log('📋 Test User Credentials (password for all: Test1234!)\n');
  for (const user of TEST_USERS) {
    console.log(`   ${user.email.padEnd(28)} - ${user.name}`);
  }
  console.log('\n🚀 Next steps:');
  console.log('   1. Start the app: npm run dev');
  console.log('   2. Open: http://localhost:3000');
  console.log('   3. Login with any test user');
  console.log('   4. Access Supabase Studio: http://127.0.0.1:54323\n');
}

async function loadSeedData(supabase: SupabaseClient) {
  // Accounts
  console.log('   Loading accounts...');
  await supabase.from('accounts').upsert([
    {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001',
      name: 'Acme Corp',
      description: 'Enterprise technology company',
      service_tier: 'enterprise',
      account_manager_id: '11111111-1111-1111-1111-000000000003',
      status: 'active',
    },
    {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-000000000002',
      name: 'StartupXYZ',
      description: 'Fast-growing SaaS startup',
      service_tier: 'premium',
      account_manager_id: '11111111-1111-1111-1111-000000000003',
      status: 'active',
    },
    {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-000000000003',
      name: 'Local Business',
      description: 'Regional retail business',
      service_tier: 'basic',
      account_manager_id: '11111111-1111-1111-1111-000000000004',
      status: 'active',
    },
  ]);

  // Account members
  console.log('   Loading account members...');
  await supabase.from('account_members').upsert([
    { user_id: '11111111-1111-1111-1111-000000000003', account_id: 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001' },
    { user_id: '11111111-1111-1111-1111-000000000004', account_id: 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001' },
    { user_id: '11111111-1111-1111-1111-000000000005', account_id: 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001' },
    { user_id: '11111111-1111-1111-1111-000000000006', account_id: 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001' },
    { user_id: '11111111-1111-1111-1111-000000000003', account_id: 'aaaaaaaa-aaaa-aaaa-aaaa-000000000002' },
    { user_id: '11111111-1111-1111-1111-000000000005', account_id: 'aaaaaaaa-aaaa-aaaa-aaaa-000000000002' },
    { user_id: '11111111-1111-1111-1111-000000000006', account_id: 'aaaaaaaa-aaaa-aaaa-aaaa-000000000002' },
    { user_id: '11111111-1111-1111-1111-000000000004', account_id: 'aaaaaaaa-aaaa-aaaa-aaaa-000000000003' },
    { user_id: '11111111-1111-1111-1111-000000000007', account_id: 'aaaaaaaa-aaaa-aaaa-aaaa-000000000003' },
  ]);

  // Projects
  console.log('   Loading projects...');
  await supabase.from('projects').upsert([
    {
      id: 'ffffffff-0001-0002-0003-000000000001',
      name: 'Website Redesign',
      description: 'Complete overhaul of corporate website',
      account_id: 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001',
      status: 'in_progress',
      priority: 'high',
      start_date: '2025-01-15',
      end_date: '2025-03-15',
      estimated_hours: 200,
      created_by: '11111111-1111-1111-1111-000000000003',
      assigned_user_id: '11111111-1111-1111-1111-000000000004',
    },
    {
      id: 'ffffffff-0001-0002-0003-000000000002',
      name: 'Marketing Campaign',
      description: 'Q1 2025 marketing campaign',
      account_id: 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001',
      status: 'planning',
      priority: 'medium',
      start_date: '2025-02-01',
      end_date: '2025-04-30',
      estimated_hours: 120,
      created_by: '11111111-1111-1111-1111-000000000003',
      assigned_user_id: '11111111-1111-1111-1111-000000000004',
    },
    {
      id: 'ffffffff-0001-0002-0003-000000000003',
      name: 'Mobile App MVP',
      description: 'iOS and Android mobile application',
      account_id: 'aaaaaaaa-aaaa-aaaa-aaaa-000000000002',
      status: 'in_progress',
      priority: 'urgent',
      start_date: '2025-01-10',
      end_date: '2025-02-28',
      estimated_hours: 300,
      created_by: '11111111-1111-1111-1111-000000000003',
      assigned_user_id: '11111111-1111-1111-1111-000000000006',
    },
    {
      id: 'ffffffff-0001-0002-0003-000000000004',
      name: 'Brand Identity',
      description: 'Logo and brand guidelines',
      account_id: 'aaaaaaaa-aaaa-aaaa-aaaa-000000000002',
      status: 'review',
      priority: 'high',
      start_date: '2025-01-05',
      end_date: '2025-02-05',
      estimated_hours: 80,
      created_by: '11111111-1111-1111-1111-000000000003',
      assigned_user_id: '11111111-1111-1111-1111-000000000005',
    },
    {
      id: 'ffffffff-0001-0002-0003-000000000005',
      name: 'Social Media Management',
      description: 'Monthly social media content',
      account_id: 'aaaaaaaa-aaaa-aaaa-aaaa-000000000003',
      status: 'in_progress',
      priority: 'low',
      start_date: '2025-01-01',
      end_date: '2025-12-31',
      estimated_hours: 240,
      created_by: '11111111-1111-1111-1111-000000000004',
      assigned_user_id: '11111111-1111-1111-1111-000000000007',
    },
    {
      id: 'ffffffff-0001-0002-0003-000000000006',
      name: 'SEO Optimization',
      description: 'Website SEO improvements',
      account_id: 'aaaaaaaa-aaaa-aaaa-aaaa-000000000003',
      status: 'complete',
      priority: 'medium',
      start_date: '2024-12-01',
      end_date: '2025-01-15',
      estimated_hours: 60,
      created_by: '11111111-1111-1111-1111-000000000004',
      assigned_user_id: '11111111-1111-1111-1111-000000000007',
    },
  ]);

  // Project assignments
  console.log('   Loading project assignments...');
  await supabase.from('project_assignments').upsert([
    { project_id: 'ffffffff-0001-0002-0003-000000000001', user_id: '11111111-1111-1111-1111-000000000004', role_in_project: 'Project Manager', assigned_by: '11111111-1111-1111-1111-000000000003' },
    { project_id: 'ffffffff-0001-0002-0003-000000000001', user_id: '11111111-1111-1111-1111-000000000005', role_in_project: 'Lead Designer', assigned_by: '11111111-1111-1111-1111-000000000003' },
    { project_id: 'ffffffff-0001-0002-0003-000000000001', user_id: '11111111-1111-1111-1111-000000000006', role_in_project: 'Lead Developer', assigned_by: '11111111-1111-1111-1111-000000000003' },
    { project_id: 'ffffffff-0001-0002-0003-000000000002', user_id: '11111111-1111-1111-1111-000000000004', role_in_project: 'Project Manager', assigned_by: '11111111-1111-1111-1111-000000000003' },
    { project_id: 'ffffffff-0001-0002-0003-000000000002', user_id: '11111111-1111-1111-1111-000000000005', role_in_project: 'Creative Lead', assigned_by: '11111111-1111-1111-1111-000000000003' },
    { project_id: 'ffffffff-0001-0002-0003-000000000003', user_id: '11111111-1111-1111-1111-000000000006', role_in_project: 'Tech Lead', assigned_by: '11111111-1111-1111-1111-000000000003' },
    { project_id: 'ffffffff-0001-0002-0003-000000000003', user_id: '11111111-1111-1111-1111-000000000005', role_in_project: 'UI Designer', assigned_by: '11111111-1111-1111-1111-000000000003' },
    { project_id: 'ffffffff-0001-0002-0003-000000000004', user_id: '11111111-1111-1111-1111-000000000005', role_in_project: 'Brand Designer', assigned_by: '11111111-1111-1111-1111-000000000003' },
    { project_id: 'ffffffff-0001-0002-0003-000000000005', user_id: '11111111-1111-1111-1111-000000000007', role_in_project: 'Content Creator', assigned_by: '11111111-1111-1111-1111-000000000004' },
    { project_id: 'ffffffff-0001-0002-0003-000000000006', user_id: '11111111-1111-1111-1111-000000000007', role_in_project: 'SEO Specialist', assigned_by: '11111111-1111-1111-1111-000000000004' },
  ]);

  // Tasks
  console.log('   Loading tasks...');
  await supabase.from('tasks').upsert([
    { id: 'cccccccc-dddd-eeee-ffff-000000000001', name: 'Homepage Design Mockup', description: 'Create high-fidelity homepage design', project_id: 'ffffffff-0001-0002-0003-000000000001', status: 'in_progress', priority: 'high', estimated_hours: 16, assigned_to: '11111111-1111-1111-1111-000000000005', created_by: '11111111-1111-1111-1111-000000000004' },
    { id: 'cccccccc-dddd-eeee-ffff-000000000002', name: 'About Page Design', description: 'Design company about page', project_id: 'ffffffff-0001-0002-0003-000000000001', status: 'done', priority: 'medium', estimated_hours: 8, assigned_to: '11111111-1111-1111-1111-000000000005', created_by: '11111111-1111-1111-1111-000000000004' },
    { id: 'cccccccc-dddd-eeee-ffff-000000000003', name: 'Frontend Implementation', description: 'Implement React components', project_id: 'ffffffff-0001-0002-0003-000000000001', status: 'todo', priority: 'high', estimated_hours: 40, assigned_to: '11111111-1111-1111-1111-000000000006', created_by: '11111111-1111-1111-1111-000000000004' },
    { id: 'cccccccc-dddd-eeee-ffff-000000000004', name: 'User Authentication', description: 'Implement login and signup', project_id: 'ffffffff-0001-0002-0003-000000000003', status: 'done', priority: 'urgent', estimated_hours: 24, assigned_to: '11111111-1111-1111-1111-000000000006', created_by: '11111111-1111-1111-1111-000000000006' },
    { id: 'cccccccc-dddd-eeee-ffff-000000000005', name: 'Dashboard Screen', description: 'Main dashboard UI', project_id: 'ffffffff-0001-0002-0003-000000000003', status: 'in_progress', priority: 'high', estimated_hours: 20, assigned_to: '11111111-1111-1111-1111-000000000006', created_by: '11111111-1111-1111-1111-000000000006' },
    { id: 'cccccccc-dddd-eeee-ffff-000000000006', name: 'Profile Settings', description: 'User profile management', project_id: 'ffffffff-0001-0002-0003-000000000003', status: 'todo', priority: 'medium', estimated_hours: 16, assigned_to: '11111111-1111-1111-1111-000000000006', created_by: '11111111-1111-1111-1111-000000000006' },
    { id: 'cccccccc-dddd-eeee-ffff-000000000007', name: 'Content Calendar', description: 'Q1 social media content calendar', project_id: 'ffffffff-0001-0002-0003-000000000002', status: 'done', priority: 'high', estimated_hours: 12, assigned_to: '11111111-1111-1111-1111-000000000005', created_by: '11111111-1111-1111-1111-000000000004' },
    { id: 'cccccccc-dddd-eeee-ffff-000000000008', name: 'Email Campaign Design', description: 'Newsletter template design', project_id: 'ffffffff-0001-0002-0003-000000000002', status: 'in_progress', priority: 'medium', estimated_hours: 8, assigned_to: '11111111-1111-1111-1111-000000000005', created_by: '11111111-1111-1111-1111-000000000004' },
    { id: 'cccccccc-dddd-eeee-ffff-000000000009', name: 'Logo Design', description: 'Create 3 logo concepts', project_id: 'ffffffff-0001-0002-0003-000000000004', status: 'done', priority: 'urgent', estimated_hours: 20, assigned_to: '11111111-1111-1111-1111-000000000005', created_by: '11111111-1111-1111-1111-000000000005' },
    { id: 'cccccccc-dddd-eeee-ffff-000000000010', name: 'Brand Guidelines', description: 'Document brand colors, fonts, usage', project_id: 'ffffffff-0001-0002-0003-000000000004', status: 'review', priority: 'high', estimated_hours: 12, assigned_to: '11111111-1111-1111-1111-000000000005', created_by: '11111111-1111-1111-1111-000000000005' },
  ]);

  // Workflow templates
  console.log('   Loading workflow templates...');
  await supabase.from('workflow_templates').upsert([
    { id: '00000001-0002-0003-0004-000000000001', name: 'Blog Post Approval', description: 'Standard workflow for reviewing and publishing blog content', created_by: '11111111-1111-1111-1111-000000000002', is_active: true },
    { id: '00000001-0002-0003-0004-000000000002', name: 'Video Production', description: 'End-to-end video production workflow from concept to delivery', created_by: '11111111-1111-1111-1111-000000000002', is_active: true },
  ]);

  // Workflow nodes - using current node types: start, role, approval, form, conditional, end
  // Note: 'department' and 'sync' node types are deprecated
  // Role IDs from seed.sql: Senior Designer: 10101010-..., Senior Developer: 30303030-..., Project Manager: ffffffff-...-ffffffffffff
  console.log('   Loading workflow nodes...');
  await supabase.from('workflow_nodes').upsert([
    // Blog Post Approval Workflow
    { id: 'aaaaaaaa-bbbb-cccc-dddd-000000000001', workflow_template_id: '00000001-0002-0003-0004-000000000001', node_type: 'start', label: 'Start', position_x: 100, position_y: 100 },
    { id: 'aaaaaaaa-bbbb-cccc-dddd-000000000002', workflow_template_id: '00000001-0002-0003-0004-000000000001', node_type: 'role', label: 'Content Writer', entity_id: 'ffffffff-ffff-ffff-ffff-ffffffffffff', position_x: 300, position_y: 100 },
    { id: 'aaaaaaaa-bbbb-cccc-dddd-000000000003', workflow_template_id: '00000001-0002-0003-0004-000000000001', node_type: 'approval', label: 'Manager Approval', position_x: 500, position_y: 100 },
    { id: 'aaaaaaaa-bbbb-cccc-dddd-000000000004', workflow_template_id: '00000001-0002-0003-0004-000000000001', node_type: 'role', label: 'Graphic Designer', entity_id: '10101010-1010-1010-1010-101010101010', position_x: 700, position_y: 100 },
    { id: 'aaaaaaaa-bbbb-cccc-dddd-000000000005', workflow_template_id: '00000001-0002-0003-0004-000000000001', node_type: 'end', label: 'Publish', position_x: 900, position_y: 100 },
    // Video Production Workflow
    { id: 'aaaaaaaa-bbbb-cccc-dddd-000000000006', workflow_template_id: '00000001-0002-0003-0004-000000000002', node_type: 'start', label: 'Start', position_x: 100, position_y: 200 },
    { id: 'aaaaaaaa-bbbb-cccc-dddd-000000000007', workflow_template_id: '00000001-0002-0003-0004-000000000002', node_type: 'role', label: 'Script Writer', entity_id: 'ffffffff-ffff-ffff-ffff-ffffffffffff', position_x: 300, position_y: 200 },
    { id: 'aaaaaaaa-bbbb-cccc-dddd-000000000008', workflow_template_id: '00000001-0002-0003-0004-000000000002', node_type: 'approval', label: 'Client Approval', position_x: 500, position_y: 200 },
    { id: 'aaaaaaaa-bbbb-cccc-dddd-000000000009', workflow_template_id: '00000001-0002-0003-0004-000000000002', node_type: 'role', label: 'Video Producer', entity_id: '10101010-1010-1010-1010-101010101010', position_x: 700, position_y: 200 },
    { id: 'aaaaaaaa-bbbb-cccc-dddd-000000000010', workflow_template_id: '00000001-0002-0003-0004-000000000002', node_type: 'role', label: 'Video Editor', entity_id: '30303030-3030-3030-3030-303030303030', position_x: 900, position_y: 200 },
    { id: 'aaaaaaaa-bbbb-cccc-dddd-000000000011', workflow_template_id: '00000001-0002-0003-0004-000000000002', node_type: 'end', label: 'Deliver', position_x: 1100, position_y: 200 },
  ]);

  // Workflow connections
  console.log('   Loading workflow connections...');
  await supabase.from('workflow_connections').upsert([
    { workflow_template_id: '00000001-0002-0003-0004-000000000001', from_node_id: 'aaaaaaaa-bbbb-cccc-dddd-000000000001', to_node_id: 'aaaaaaaa-bbbb-cccc-dddd-000000000002', label: 'Draft Complete' },
    { workflow_template_id: '00000001-0002-0003-0004-000000000001', from_node_id: 'aaaaaaaa-bbbb-cccc-dddd-000000000002', to_node_id: 'aaaaaaaa-bbbb-cccc-dddd-000000000003', label: 'Content Ready' },
    { workflow_template_id: '00000001-0002-0003-0004-000000000001', from_node_id: 'aaaaaaaa-bbbb-cccc-dddd-000000000003', to_node_id: 'aaaaaaaa-bbbb-cccc-dddd-000000000004', label: 'Approved' },
    { workflow_template_id: '00000001-0002-0003-0004-000000000001', from_node_id: 'aaaaaaaa-bbbb-cccc-dddd-000000000004', to_node_id: 'aaaaaaaa-bbbb-cccc-dddd-000000000005', label: 'Graphics Complete' },
    { workflow_template_id: '00000001-0002-0003-0004-000000000002', from_node_id: 'aaaaaaaa-bbbb-cccc-dddd-000000000006', to_node_id: 'aaaaaaaa-bbbb-cccc-dddd-000000000007', label: 'Concept Approved' },
    { workflow_template_id: '00000001-0002-0003-0004-000000000002', from_node_id: 'aaaaaaaa-bbbb-cccc-dddd-000000000007', to_node_id: 'aaaaaaaa-bbbb-cccc-dddd-000000000008', label: 'Script Ready' },
    { workflow_template_id: '00000001-0002-0003-0004-000000000002', from_node_id: 'aaaaaaaa-bbbb-cccc-dddd-000000000008', to_node_id: 'aaaaaaaa-bbbb-cccc-dddd-000000000009', label: 'Approved to Film' },
    { workflow_template_id: '00000001-0002-0003-0004-000000000002', from_node_id: 'aaaaaaaa-bbbb-cccc-dddd-000000000009', to_node_id: 'aaaaaaaa-bbbb-cccc-dddd-000000000010', label: 'Footage Captured' },
    { workflow_template_id: '00000001-0002-0003-0004-000000000002', from_node_id: 'aaaaaaaa-bbbb-cccc-dddd-000000000010', to_node_id: 'aaaaaaaa-bbbb-cccc-dddd-000000000011', label: 'Editing Complete' },
  ]);

  // Workflow instances (attach workflows to 5 of 6 projects - leave SEO Optimization without workflow)
  console.log('   Loading workflow instances...');
  const { error: wiError } = await supabase.from('workflow_instances').upsert([
    // Project 1: Website Redesign - Blog Post Approval workflow
    {
      id: 'bbbbbbbb-cccc-dddd-eeee-000000000001',
      workflow_template_id: '00000001-0002-0003-0004-000000000001',
      project_id: 'ffffffff-0001-0002-0003-000000000001',
      current_node_id: 'aaaaaaaa-bbbb-cccc-dddd-000000000002',
      status: 'active'
    },
    // Project 2: Marketing Campaign - Blog Post Approval workflow
    {
      id: 'bbbbbbbb-cccc-dddd-eeee-000000000002',
      workflow_template_id: '00000001-0002-0003-0004-000000000001',
      project_id: 'ffffffff-0001-0002-0003-000000000002',
      current_node_id: 'aaaaaaaa-bbbb-cccc-dddd-000000000001', // At start
      status: 'active'
    },
    // Project 3: Mobile App MVP - Video Production workflow
    {
      id: 'bbbbbbbb-cccc-dddd-eeee-000000000003',
      workflow_template_id: '00000001-0002-0003-0004-000000000002',
      project_id: 'ffffffff-0001-0002-0003-000000000003',
      current_node_id: 'aaaaaaaa-bbbb-cccc-dddd-000000000009',
      status: 'active'
    },
    // Project 4: Brand Identity - Blog Post Approval workflow
    {
      id: 'bbbbbbbb-cccc-dddd-eeee-000000000004',
      workflow_template_id: '00000001-0002-0003-0004-000000000001',
      project_id: 'ffffffff-0001-0002-0003-000000000004',
      current_node_id: 'aaaaaaaa-bbbb-cccc-dddd-000000000004', // At Graphic Designer
      status: 'active'
    },
    // Project 5: Social Media Management - Video Production workflow
    {
      id: 'bbbbbbbb-cccc-dddd-eeee-000000000005',
      workflow_template_id: '00000001-0002-0003-0004-000000000002',
      project_id: 'ffffffff-0001-0002-0003-000000000005',
      current_node_id: 'aaaaaaaa-bbbb-cccc-dddd-000000000007', // At Script Writer
      status: 'active'
    },
    // Project 6: SEO Optimization - NO WORKFLOW (complete project, shows what a project without workflow looks like)
  ]);
  if (wiError) console.error('   Workflow instances error:', wiError);

  // User availability (for capacity charts) - 6 weeks of historical data with random availability
  console.log('   Loading user availability...');

  // Helper to get week start for N weeks ago
  const getWeekStartNWeeksAgo = (weeksAgo: number) => {
    const date = new Date();
    date.setDate(date.getDate() - (weeksAgo * 7));
    return getWeekStartDate(date);
  };

  // Random availability between 20-40 hours (realistic working hours)
  const randomAvailability = () => Math.floor(Math.random() * 21) + 20; // 20-40

  // User IDs
  const users = [
    '11111111-1111-1111-1111-000000000004', // Project Manager
    '11111111-1111-1111-1111-000000000005', // Senior Designer
    '11111111-1111-1111-1111-000000000006', // Senior Developer
    '11111111-1111-1111-1111-000000000007', // Intern
  ];

  const availabilityData: { user_id: string; week_start_date: string; available_hours: number }[] = [];

  // Generate 6 weeks of availability data (current week + 5 past weeks)
  for (let weekOffset = 0; weekOffset < 6; weekOffset++) {
    const weekStart = getWeekStartNWeeksAgo(weekOffset);
    for (const userId of users) {
      // Intern gets lower hours (15-25)
      const hours = userId.endsWith('000000000007')
        ? Math.floor(Math.random() * 11) + 15 // 15-25
        : randomAvailability(); // 20-40
      availabilityData.push({
        user_id: userId,
        week_start_date: weekStart,
        available_hours: hours
      });
    }
  }

  await supabase.from('user_availability').upsert(availabilityData);

  // Time entries (for capacity charts) - multiple weeks of realistic time logging
  console.log('   Loading time entries...');

  // Helper to get a date N days ago (formatted as YYYY-MM-DD in local timezone)
  const getDateNDaysAgo = (daysAgo: number) => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper to get week start for a specific date (handles timezone correctly)
  const getWeekStartForDate = (dateStr: string) => {
    // Parse YYYY-MM-DD format correctly in local timezone
    const [year, month, day] = dateStr.split('-').map(Number);
    return getWeekStartDate(new Date(year, month - 1, day));
  };

  const timeEntries: {
    user_id: string;
    task_id: string;
    project_id: string;
    hours_logged: number;
    entry_date: string;
    week_start_date: string;
    description: string;
  }[] = [];

  // Task-User-Project mapping for realistic entries WITH estimated hours
  // This ensures time entries don't exceed reasonable bounds
  const taskAssignments = [
    { taskId: 'cccccccc-dddd-eeee-ffff-000000000001', userId: '11111111-1111-1111-1111-000000000005', projectId: 'ffffffff-0001-0002-0003-000000000001', desc: 'Homepage design work', estimatedHours: 16 },
    { taskId: 'cccccccc-dddd-eeee-ffff-000000000002', userId: '11111111-1111-1111-1111-000000000005', projectId: 'ffffffff-0001-0002-0003-000000000001', desc: 'About page design', estimatedHours: 8 },
    { taskId: 'cccccccc-dddd-eeee-ffff-000000000003', userId: '11111111-1111-1111-1111-000000000006', projectId: 'ffffffff-0001-0002-0003-000000000001', desc: 'Frontend implementation', estimatedHours: 40 },
    { taskId: 'cccccccc-dddd-eeee-ffff-000000000004', userId: '11111111-1111-1111-1111-000000000006', projectId: 'ffffffff-0001-0002-0003-000000000003', desc: 'Auth implementation', estimatedHours: 24 },
    { taskId: 'cccccccc-dddd-eeee-ffff-000000000005', userId: '11111111-1111-1111-1111-000000000006', projectId: 'ffffffff-0001-0002-0003-000000000003', desc: 'Dashboard progress', estimatedHours: 20 },
    { taskId: 'cccccccc-dddd-eeee-ffff-000000000007', userId: '11111111-1111-1111-1111-000000000005', projectId: 'ffffffff-0001-0002-0003-000000000002', desc: 'Content calendar', estimatedHours: 12 },
    { taskId: 'cccccccc-dddd-eeee-ffff-000000000008', userId: '11111111-1111-1111-1111-000000000005', projectId: 'ffffffff-0001-0002-0003-000000000002', desc: 'Email campaign design', estimatedHours: 8 },
    { taskId: 'cccccccc-dddd-eeee-ffff-000000000009', userId: '11111111-1111-1111-1111-000000000005', projectId: 'ffffffff-0001-0002-0003-000000000004', desc: 'Logo design concepts', estimatedHours: 20 },
    { taskId: 'cccccccc-dddd-eeee-ffff-000000000010', userId: '11111111-1111-1111-1111-000000000005', projectId: 'ffffffff-0001-0002-0003-000000000004', desc: 'Brand guidelines', estimatedHours: 12 },
  ];

  // Track logged hours per task to avoid over-logging
  const taskLoggedHours: Record<string, number> = {};
  taskAssignments.forEach(t => taskLoggedHours[t.taskId] = 0);

  // Generate time entries for the past 35 days (5 weeks) - skip weekends
  // Iterate from oldest to newest so we can stop when task is "complete"
  for (let dayOffset = 34; dayOffset >= 0; dayOffset--) {
    const entryDate = getDateNDaysAgo(dayOffset);
    const dateObj = new Date(entryDate);
    const dayOfWeek = dateObj.getDay();

    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    const weekStart = getWeekStartForDate(entryDate);

    // Each user logs 1-3 entries per day with varying hours
    for (const assignment of taskAssignments) {
      // Skip if task has already reached ~90% of estimate
      const maxHours = assignment.estimatedHours * 0.9;
      if (taskLoggedHours[assignment.taskId] >= maxHours) continue;

      // 40% chance of logging time on any given task-day (reduced from 60%)
      if (Math.random() > 0.4) continue;

      // Random hours between 1-6, weighted towards 2-4
      const baseHours = Math.random() > 0.3 ? (Math.random() * 2 + 2) : (Math.random() * 5 + 1);
      const remainingEstimate = maxHours - taskLoggedHours[assignment.taskId];
      const hours = Math.min(
        Math.round(baseHours * 10) / 10, // Round to 1 decimal
        8, // Cap at 8 hours per entry
        remainingEstimate // Don't exceed estimated hours
      );

      if (hours <= 0) continue;

      taskLoggedHours[assignment.taskId] += hours;

      timeEntries.push({
        user_id: assignment.userId,
        task_id: assignment.taskId,
        project_id: assignment.projectId,
        hours_logged: hours,
        entry_date: entryDate,
        week_start_date: weekStart,
        description: assignment.desc
      });
    }
  }

  await supabase.from('time_entries').upsert(timeEntries);

  // Task week allocations (for capacity planning) - multiple weeks
  console.log('   Loading task week allocations...');

  const taskAllocations: {
    task_id: string;
    week_start_date: string;
    allocated_hours: number;
    assigned_user_id: string;
  }[] = [];

  // Generate allocations for 4 weeks (current + 3 past)
  for (let weekOffset = 0; weekOffset < 4; weekOffset++) {
    const weekStart = getWeekStartNWeeksAgo(weekOffset);

    // Allocations for Senior Designer (user 5)
    taskAllocations.push(
      { task_id: 'cccccccc-dddd-eeee-ffff-000000000001', week_start_date: weekStart, allocated_hours: 16, assigned_user_id: '11111111-1111-1111-1111-000000000005' },
      { task_id: 'cccccccc-dddd-eeee-ffff-000000000008', week_start_date: weekStart, allocated_hours: 8, assigned_user_id: '11111111-1111-1111-1111-000000000005' }
    );

    // Allocations for Senior Developer (user 6)
    taskAllocations.push(
      { task_id: 'cccccccc-dddd-eeee-ffff-000000000003', week_start_date: weekStart, allocated_hours: 20, assigned_user_id: '11111111-1111-1111-1111-000000000006' },
      { task_id: 'cccccccc-dddd-eeee-ffff-000000000005', week_start_date: weekStart, allocated_hours: 16, assigned_user_id: '11111111-1111-1111-1111-000000000006' }
    );
  }

  await supabase.from('task_week_allocations').upsert(taskAllocations);

  // Newsletters
  console.log('   Loading newsletters...');
  await supabase.from('newsletters').upsert([
    { id: 'eeeeeeee-ffff-0001-0002-000000000001', title: 'Welcome to MovaLab!', content: 'We are excited to announce the launch of MovaLab, our new project management platform.', created_by: '11111111-1111-1111-1111-000000000002', is_published: true, published_at: '2025-01-15T10:00:00Z' },
    { id: 'eeeeeeee-ffff-0001-0002-000000000002', title: 'Q1 2025 Roadmap', content: 'Here is what we are planning for Q1 2025...', created_by: '11111111-1111-1111-1111-000000000002', is_published: false },
  ]);

  console.log('   ✅ Seed data loaded');
}

// Run the script
createSeedUsers().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});

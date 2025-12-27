import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// This endpoint resets demo data daily for demo.movalab.dev
// Runs via Vercel Cron at midnight UTC

const DEMO_PROJECT_URL = 'https://xxtelrazoeuirsnvdoml.supabase.co';

export async function GET(request: NextRequest) {
  // Verify this is a legitimate cron request from Vercel
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceRoleKey = process.env.DEMO_SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 });
  }

  const supabase = createClient(DEMO_PROJECT_URL, serviceRoleKey);

  try {
    // Step 1: Clear existing seed data
    const clearQueries = [
      `DELETE FROM time_entries WHERE id::text LIKE '66666666%'`,
      `DELETE FROM project_updates WHERE id::text LIKE '55555555%'`,
      `DELETE FROM project_assignments WHERE id::text LIKE '44444444%'`,
      `DELETE FROM account_members WHERE id::text LIKE '33333333%'`,
      `DELETE FROM tasks WHERE id::text LIKE '22222222%'`,
      `DELETE FROM projects WHERE id::text LIKE '11111111-2222%'`,
      `DELETE FROM milestones WHERE id::text LIKE '88888888%'`,
      `DELETE FROM user_availability WHERE id::text LIKE '77777777%'`,
    ];

    for (const query of clearQueries) {
      const { error } = await supabase.rpc('exec_sql', { query });
      if (error) console.error('Clear error:', error);
    }

    // Step 2: Insert fresh projects with current dates
    const { error: projectsError } = await supabase.from('projects').upsert([
      {
        id: '11111111-2222-3333-4444-000000000001',
        name: 'Enterprise Dashboard Redesign',
        description: 'Complete redesign of the internal analytics dashboard with modern UI/UX',
        account_id: 'aaaaaaaa-0000-0000-0000-000000000001',
        status: 'in_progress',
        priority: 'high',
        start_date: getRelativeDate(-14),
        end_date: getRelativeDate(30),
        estimated_hours: 240,
        actual_hours: 86,
        created_by: '11111111-1111-1111-1111-000000000004'
      },
      {
        id: '11111111-2222-3333-4444-000000000002',
        name: 'Mobile App Development',
        description: 'Native iOS and Android app for field workers',
        account_id: 'aaaaaaaa-0000-0000-0000-000000000001',
        status: 'planning',
        priority: 'medium',
        start_date: getRelativeDate(7),
        end_date: getRelativeDate(120),
        estimated_hours: 480,
        actual_hours: 0,
        created_by: '11111111-1111-1111-1111-000000000004'
      },
      {
        id: '11111111-2222-3333-4444-000000000003',
        name: 'MVP Launch Website',
        description: 'Landing page and product showcase for upcoming launch',
        account_id: 'aaaaaaaa-0000-0000-0000-000000000002',
        status: 'in_progress',
        priority: 'urgent',
        start_date: getRelativeDate(-10),
        end_date: getRelativeDate(14),
        estimated_hours: 120,
        actual_hours: 68,
        created_by: '11111111-1111-1111-1111-000000000004'
      },
      {
        id: '11111111-2222-3333-4444-000000000004',
        name: 'User Onboarding Flow',
        description: 'Design and implement new user onboarding experience',
        account_id: 'aaaaaaaa-0000-0000-0000-000000000002',
        status: 'review',
        priority: 'high',
        start_date: getRelativeDate(-21),
        end_date: getRelativeDate(3),
        estimated_hours: 80,
        actual_hours: 72,
        created_by: '11111111-1111-1111-1111-000000000004'
      },
      {
        id: '11111111-2222-3333-4444-000000000005',
        name: 'Brand Identity Package',
        description: 'Complete brand refresh including logo, colors, and guidelines',
        account_id: 'aaaaaaaa-0000-0000-0000-000000000003',
        status: 'in_progress',
        priority: 'medium',
        start_date: getRelativeDate(-7),
        end_date: getRelativeDate(21),
        estimated_hours: 60,
        actual_hours: 28,
        created_by: '11111111-1111-1111-1111-000000000004'
      },
      {
        id: '11111111-2222-3333-4444-000000000006',
        name: 'E-commerce Platform',
        description: 'Full e-commerce solution with inventory management',
        account_id: 'aaaaaaaa-0000-0000-0000-000000000004',
        status: 'planning',
        priority: 'high',
        start_date: getRelativeDate(14),
        end_date: getRelativeDate(150),
        estimated_hours: 600,
        actual_hours: 0,
        created_by: '11111111-1111-1111-1111-000000000004'
      },
      {
        id: '11111111-2222-3333-4444-000000000007',
        name: 'Spring Collection Lookbook',
        description: 'Digital lookbook and social media assets for spring line',
        account_id: 'aaaaaaaa-0000-0000-0000-000000000004',
        status: 'complete',
        priority: 'medium',
        start_date: getRelativeDate(-45),
        end_date: getRelativeDate(-7),
        estimated_hours: 40,
        actual_hours: 38,
        created_by: '11111111-1111-1111-1111-000000000004'
      },
      {
        id: '11111111-2222-3333-4444-000000000008',
        name: 'Website Redesign',
        description: 'Modern responsive website with online ordering',
        account_id: 'aaaaaaaa-0000-0000-0000-000000000005',
        status: 'in_progress',
        priority: 'medium',
        start_date: getRelativeDate(-12),
        end_date: getRelativeDate(18),
        estimated_hours: 80,
        actual_hours: 32,
        created_by: '11111111-1111-1111-1111-000000000004'
      }
    ], { onConflict: 'id' });

    if (projectsError) {
      console.error('Projects error:', projectsError);
    }

    // Step 3: Insert tasks
    const tasks = generateTasks();
    const { error: tasksError } = await supabase.from('tasks').upsert(tasks, { onConflict: 'id' });
    if (tasksError) console.error('Tasks error:', tasksError);

    // Step 4: Insert project assignments
    const assignments = generateAssignments();
    const { error: assignmentsError } = await supabase.from('project_assignments').upsert(assignments, { onConflict: 'id' });
    if (assignmentsError) console.error('Assignments error:', assignmentsError);

    // Step 5: Insert account members
    const members = generateAccountMembers();
    const { error: membersError } = await supabase.from('account_members').upsert(members, { onConflict: 'id' });
    if (membersError) console.error('Members error:', membersError);

    // Step 6: Insert time entries
    const timeEntries = generateTimeEntries();
    const { error: timeError } = await supabase.from('time_entries').upsert(timeEntries, { onConflict: 'id' });
    if (timeError) console.error('Time entries error:', timeError);

    // Step 7: Insert project updates
    const updates = generateProjectUpdates();
    const { error: updatesError } = await supabase.from('project_updates').upsert(updates, { onConflict: 'id' });
    if (updatesError) console.error('Updates error:', updatesError);

    // Step 8: Insert milestones
    const milestones = generateMilestones();
    const { error: milestonesError } = await supabase.from('milestones').upsert(milestones, { onConflict: 'id' });
    if (milestonesError) console.error('Milestones error:', milestonesError);

    // Step 9: Insert user availability
    const availability = generateUserAvailability();
    const { error: availabilityError } = await supabase.from('user_availability').upsert(availability, { onConflict: 'id' });
    if (availabilityError) console.error('Availability error:', availabilityError);

    return NextResponse.json({
      success: true,
      message: 'Demo data reset successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error resetting demo data:', error);
    return NextResponse.json({
      error: 'Failed to reset demo data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Helper functions
function getRelativeDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

function getWeekStart(daysOffset: number = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date.toISOString().split('T')[0];
}

function generateTasks() {
  return [
    { id: '22222222-3333-4444-5555-000000000001', name: 'User Research & Analysis', description: 'Conduct user interviews', project_id: '11111111-2222-3333-4444-000000000001', status: 'done', priority: 'high', start_date: getRelativeDate(-14), due_date: getRelativeDate(-7), estimated_hours: 16, actual_hours: 16, assigned_to: '11111111-1111-1111-1111-000000000005', created_by: '11111111-1111-1111-1111-000000000004' },
    { id: '22222222-3333-4444-5555-000000000002', name: 'Wireframes & Mockups', description: 'Create wireframes', project_id: '11111111-2222-3333-4444-000000000001', status: 'done', priority: 'high', start_date: getRelativeDate(-7), due_date: getRelativeDate(-2), estimated_hours: 24, actual_hours: 26, assigned_to: '11111111-1111-1111-1111-000000000005', created_by: '11111111-1111-1111-1111-000000000004' },
    { id: '22222222-3333-4444-5555-000000000003', name: 'Frontend Development', description: 'Implement UI components', project_id: '11111111-2222-3333-4444-000000000001', status: 'in_progress', priority: 'high', start_date: getRelativeDate(-2), due_date: getRelativeDate(14), estimated_hours: 80, actual_hours: 24, assigned_to: '11111111-1111-1111-1111-000000000006', created_by: '11111111-1111-1111-1111-000000000004' },
    { id: '22222222-3333-4444-5555-000000000004', name: 'Backend API Updates', description: 'Update API endpoints', project_id: '11111111-2222-3333-4444-000000000001', status: 'in_progress', priority: 'medium', start_date: getRelativeDate(-1), due_date: getRelativeDate(12), estimated_hours: 60, actual_hours: 20, assigned_to: '11111111-1111-1111-1111-000000000006', created_by: '11111111-1111-1111-1111-000000000004' },
    { id: '22222222-3333-4444-5555-000000000005', name: 'QA Testing', description: 'Comprehensive testing', project_id: '11111111-2222-3333-4444-000000000001', status: 'todo', priority: 'medium', start_date: getRelativeDate(14), due_date: getRelativeDate(21), estimated_hours: 24, actual_hours: 0, assigned_to: null, created_by: '11111111-1111-1111-1111-000000000004' },
    { id: '22222222-3333-4444-5555-000000000006', name: 'Homepage Design', description: 'Design hero section', project_id: '11111111-2222-3333-4444-000000000003', status: 'done', priority: 'urgent', start_date: getRelativeDate(-10), due_date: getRelativeDate(-5), estimated_hours: 16, actual_hours: 18, assigned_to: '11111111-1111-1111-1111-000000000005', created_by: '11111111-1111-1111-1111-000000000004' },
    { id: '22222222-3333-4444-5555-000000000007', name: 'Features Section', description: 'Product features showcase', project_id: '11111111-2222-3333-4444-000000000003', status: 'done', priority: 'high', start_date: getRelativeDate(-5), due_date: getRelativeDate(-1), estimated_hours: 20, actual_hours: 22, assigned_to: '11111111-1111-1111-1111-000000000005', created_by: '11111111-1111-1111-1111-000000000004' },
    { id: '22222222-3333-4444-5555-000000000008', name: 'Responsive Development', description: 'Build responsive frontend', project_id: '11111111-2222-3333-4444-000000000003', status: 'in_progress', priority: 'urgent', start_date: getRelativeDate(-3), due_date: getRelativeDate(5), estimated_hours: 40, actual_hours: 28, assigned_to: '11111111-1111-1111-1111-000000000006', created_by: '11111111-1111-1111-1111-000000000004' },
    { id: '22222222-3333-4444-5555-000000000009', name: 'Contact Form Integration', description: 'Set up contact form', project_id: '11111111-2222-3333-4444-000000000003', status: 'todo', priority: 'medium', start_date: getRelativeDate(5), due_date: getRelativeDate(8), estimated_hours: 8, actual_hours: 0, assigned_to: '11111111-1111-1111-1111-000000000006', created_by: '11111111-1111-1111-1111-000000000004' },
    { id: '22222222-3333-4444-5555-000000000010', name: 'Logo Concepts', description: 'Create logo concepts', project_id: '11111111-2222-3333-4444-000000000005', status: 'done', priority: 'high', start_date: getRelativeDate(-7), due_date: getRelativeDate(-3), estimated_hours: 16, actual_hours: 14, assigned_to: '11111111-1111-1111-1111-000000000005', created_by: '11111111-1111-1111-1111-000000000004' },
    { id: '22222222-3333-4444-5555-000000000011', name: 'Color Palette Development', description: 'Define color palette', project_id: '11111111-2222-3333-4444-000000000005', status: 'in_progress', priority: 'medium', start_date: getRelativeDate(-2), due_date: getRelativeDate(3), estimated_hours: 8, actual_hours: 6, assigned_to: '11111111-1111-1111-1111-000000000005', created_by: '11111111-1111-1111-1111-000000000004' },
    { id: '22222222-3333-4444-5555-000000000012', name: 'Menu Page Design', description: 'Design interactive menu', project_id: '11111111-2222-3333-4444-000000000008', status: 'done', priority: 'high', start_date: getRelativeDate(-12), due_date: getRelativeDate(-6), estimated_hours: 16, actual_hours: 14, assigned_to: '11111111-1111-1111-1111-000000000005', created_by: '11111111-1111-1111-1111-000000000004' },
    { id: '22222222-3333-4444-5555-000000000013', name: 'Online Ordering System', description: 'Integrate ordering functionality', project_id: '11111111-2222-3333-4444-000000000008', status: 'in_progress', priority: 'high', start_date: getRelativeDate(-2), due_date: getRelativeDate(10), estimated_hours: 40, actual_hours: 8, assigned_to: '11111111-1111-1111-1111-000000000006', created_by: '11111111-1111-1111-1111-000000000004' },
  ];
}

function generateAssignments() {
  return [
    { id: '44444444-5555-6666-7777-000000000001', project_id: '11111111-2222-3333-4444-000000000001', user_id: '11111111-1111-1111-1111-000000000004', role_in_project: 'Project Manager', assigned_by: '11111111-1111-1111-1111-000000000003' },
    { id: '44444444-5555-6666-7777-000000000002', project_id: '11111111-2222-3333-4444-000000000001', user_id: '11111111-1111-1111-1111-000000000005', role_in_project: 'Lead Designer', assigned_by: '11111111-1111-1111-1111-000000000004' },
    { id: '44444444-5555-6666-7777-000000000003', project_id: '11111111-2222-3333-4444-000000000001', user_id: '11111111-1111-1111-1111-000000000006', role_in_project: 'Lead Developer', assigned_by: '11111111-1111-1111-1111-000000000004' },
    { id: '44444444-5555-6666-7777-000000000004', project_id: '11111111-2222-3333-4444-000000000003', user_id: '11111111-1111-1111-1111-000000000004', role_in_project: 'Project Manager', assigned_by: '11111111-1111-1111-1111-000000000003' },
    { id: '44444444-5555-6666-7777-000000000005', project_id: '11111111-2222-3333-4444-000000000003', user_id: '11111111-1111-1111-1111-000000000005', role_in_project: 'Designer', assigned_by: '11111111-1111-1111-1111-000000000004' },
    { id: '44444444-5555-6666-7777-000000000006', project_id: '11111111-2222-3333-4444-000000000003', user_id: '11111111-1111-1111-1111-000000000006', role_in_project: 'Developer', assigned_by: '11111111-1111-1111-1111-000000000004' },
    { id: '44444444-5555-6666-7777-000000000007', project_id: '11111111-2222-3333-4444-000000000003', user_id: '11111111-1111-1111-1111-000000000008', role_in_project: 'Client Stakeholder', assigned_by: '11111111-1111-1111-1111-000000000004' },
    { id: '44444444-5555-6666-7777-000000000008', project_id: '11111111-2222-3333-4444-000000000005', user_id: '11111111-1111-1111-1111-000000000004', role_in_project: 'Project Manager', assigned_by: '11111111-1111-1111-1111-000000000003' },
    { id: '44444444-5555-6666-7777-000000000009', project_id: '11111111-2222-3333-4444-000000000005', user_id: '11111111-1111-1111-1111-000000000005', role_in_project: 'Brand Designer', assigned_by: '11111111-1111-1111-1111-000000000004' },
    { id: '44444444-5555-6666-7777-000000000010', project_id: '11111111-2222-3333-4444-000000000008', user_id: '11111111-1111-1111-1111-000000000004', role_in_project: 'Project Manager', assigned_by: '11111111-1111-1111-1111-000000000003' },
    { id: '44444444-5555-6666-7777-000000000011', project_id: '11111111-2222-3333-4444-000000000008', user_id: '11111111-1111-1111-1111-000000000005', role_in_project: 'Designer', assigned_by: '11111111-1111-1111-1111-000000000004' },
    { id: '44444444-5555-6666-7777-000000000012', project_id: '11111111-2222-3333-4444-000000000008', user_id: '11111111-1111-1111-1111-000000000006', role_in_project: 'Developer', assigned_by: '11111111-1111-1111-1111-000000000004' },
  ];
}

function generateAccountMembers() {
  return [
    { id: '33333333-4444-5555-6666-000000000001', user_id: '11111111-1111-1111-1111-000000000003', account_id: 'aaaaaaaa-0000-0000-0000-000000000001' },
    { id: '33333333-4444-5555-6666-000000000002', user_id: '11111111-1111-1111-1111-000000000003', account_id: 'aaaaaaaa-0000-0000-0000-000000000002' },
    { id: '33333333-4444-5555-6666-000000000003', user_id: '11111111-1111-1111-1111-000000000004', account_id: 'aaaaaaaa-0000-0000-0000-000000000001' },
    { id: '33333333-4444-5555-6666-000000000004', user_id: '11111111-1111-1111-1111-000000000004', account_id: 'aaaaaaaa-0000-0000-0000-000000000002' },
    { id: '33333333-4444-5555-6666-000000000005', user_id: '11111111-1111-1111-1111-000000000004', account_id: 'aaaaaaaa-0000-0000-0000-000000000003' },
    { id: '33333333-4444-5555-6666-000000000006', user_id: '11111111-1111-1111-1111-000000000004', account_id: 'aaaaaaaa-0000-0000-0000-000000000005' },
    { id: '33333333-4444-5555-6666-000000000007', user_id: '11111111-1111-1111-1111-000000000005', account_id: 'aaaaaaaa-0000-0000-0000-000000000001' },
    { id: '33333333-4444-5555-6666-000000000008', user_id: '11111111-1111-1111-1111-000000000005', account_id: 'aaaaaaaa-0000-0000-0000-000000000002' },
    { id: '33333333-4444-5555-6666-000000000009', user_id: '11111111-1111-1111-1111-000000000005', account_id: 'aaaaaaaa-0000-0000-0000-000000000003' },
    { id: '33333333-4444-5555-6666-000000000010', user_id: '11111111-1111-1111-1111-000000000005', account_id: 'aaaaaaaa-0000-0000-0000-000000000005' },
    { id: '33333333-4444-5555-6666-000000000011', user_id: '11111111-1111-1111-1111-000000000006', account_id: 'aaaaaaaa-0000-0000-0000-000000000001' },
    { id: '33333333-4444-5555-6666-000000000012', user_id: '11111111-1111-1111-1111-000000000006', account_id: 'aaaaaaaa-0000-0000-0000-000000000002' },
    { id: '33333333-4444-5555-6666-000000000013', user_id: '11111111-1111-1111-1111-000000000006', account_id: 'aaaaaaaa-0000-0000-0000-000000000005' },
    { id: '33333333-4444-5555-6666-000000000014', user_id: '11111111-1111-1111-1111-000000000008', account_id: 'aaaaaaaa-0000-0000-0000-000000000002' },
    { id: '33333333-4444-5555-6666-000000000015', user_id: '11111111-1111-1111-1111-000000000002', account_id: 'aaaaaaaa-0000-0000-0000-000000000001' },
    { id: '33333333-4444-5555-6666-000000000016', user_id: '11111111-1111-1111-1111-000000000002', account_id: 'aaaaaaaa-0000-0000-0000-000000000002' },
    { id: '33333333-4444-5555-6666-000000000017', user_id: '11111111-1111-1111-1111-000000000002', account_id: 'aaaaaaaa-0000-0000-0000-000000000003' },
    { id: '33333333-4444-5555-6666-000000000018', user_id: '11111111-1111-1111-1111-000000000002', account_id: 'aaaaaaaa-0000-0000-0000-000000000004' },
    { id: '33333333-4444-5555-6666-000000000019', user_id: '11111111-1111-1111-1111-000000000002', account_id: 'aaaaaaaa-0000-0000-0000-000000000005' },
  ];
}

function generateTimeEntries() {
  return [
    { id: '66666666-7777-8888-9999-000000000001', task_id: '22222222-3333-4444-5555-000000000011', user_id: '11111111-1111-1111-1111-000000000005', project_id: '11111111-2222-3333-4444-000000000005', hours_logged: 4, entry_date: getRelativeDate(0), week_start_date: getWeekStart(), description: 'Color palette iterations' },
    { id: '66666666-7777-8888-9999-000000000002', task_id: '22222222-3333-4444-5555-000000000003', user_id: '11111111-1111-1111-1111-000000000005', project_id: '11111111-2222-3333-4444-000000000001', hours_logged: 3, entry_date: getRelativeDate(0), week_start_date: getWeekStart(), description: 'Design review' },
    { id: '66666666-7777-8888-9999-000000000003', task_id: '22222222-3333-4444-5555-000000000003', user_id: '11111111-1111-1111-1111-000000000006', project_id: '11111111-2222-3333-4444-000000000001', hours_logged: 8, entry_date: getRelativeDate(0), week_start_date: getWeekStart(), description: 'React component development' },
    { id: '66666666-7777-8888-9999-000000000004', task_id: '22222222-3333-4444-5555-000000000004', user_id: '11111111-1111-1111-1111-000000000006', project_id: '11111111-2222-3333-4444-000000000001', hours_logged: 6, entry_date: getRelativeDate(0), week_start_date: getWeekStart(), description: 'API updates' },
    { id: '66666666-7777-8888-9999-000000000005', task_id: '22222222-3333-4444-5555-000000000008', user_id: '11111111-1111-1111-1111-000000000006', project_id: '11111111-2222-3333-4444-000000000003', hours_logged: 8, entry_date: getRelativeDate(-1), week_start_date: getWeekStart(), description: 'Responsive implementation' },
    { id: '66666666-7777-8888-9999-000000000006', task_id: '22222222-3333-4444-5555-000000000007', user_id: '11111111-1111-1111-1111-000000000005', project_id: '11111111-2222-3333-4444-000000000003', hours_logged: 6, entry_date: getRelativeDate(-1), week_start_date: getWeekStart(), description: 'Features section design' },
    { id: '66666666-7777-8888-9999-000000000007', task_id: '22666666-3333-4444-5555-000000000002', user_id: '11111111-1111-1111-1111-000000000005', project_id: '11111111-2222-3333-4444-000000000001', hours_logged: 8, entry_date: getRelativeDate(-2), week_start_date: getWeekStart(), description: 'Dashboard mockups' },
    { id: '66666666-7777-8888-9999-000000000008', task_id: '22222222-3333-4444-5555-000000000003', user_id: '11111111-1111-1111-1111-000000000006', project_id: '11111111-2222-3333-4444-000000000001', hours_logged: 8, entry_date: getRelativeDate(-2), week_start_date: getWeekStart(), description: 'Dashboard charts' },
    { id: '66666666-7777-8888-9999-000000000009', task_id: '22222222-3333-4444-5555-000000000008', user_id: '11111111-1111-1111-1111-000000000006', project_id: '11111111-2222-3333-4444-000000000003', hours_logged: 6, entry_date: getRelativeDate(-3), week_start_date: getWeekStart(), description: 'Mobile breakpoints' },
    { id: '66666666-7777-8888-9999-000000000010', task_id: '22222222-3333-4444-5555-000000000010', user_id: '11111111-1111-1111-1111-000000000005', project_id: '11111111-2222-3333-4444-000000000005', hours_logged: 8, entry_date: getRelativeDate(-4), week_start_date: getWeekStart(-7), description: 'Logo concepts' },
    { id: '66666666-7777-8888-9999-000000000011', task_id: '22222222-3333-4444-5555-000000000012', user_id: '11111111-1111-1111-1111-000000000005', project_id: '11111111-2222-3333-4444-000000000008', hours_logged: 6, entry_date: getRelativeDate(-5), week_start_date: getWeekStart(-7), description: 'Menu page design' },
    { id: '66666666-7777-8888-9999-000000000012', task_id: '22222222-3333-4444-5555-000000000013', user_id: '11111111-1111-1111-1111-000000000006', project_id: '11111111-2222-3333-4444-000000000008', hours_logged: 4, entry_date: getRelativeDate(-5), week_start_date: getWeekStart(-7), description: 'Order system setup' },
  ];
}

function generateProjectUpdates() {
  const now = new Date();
  return [
    { id: '55555555-6666-7777-8888-000000000001', project_id: '11111111-2222-3333-4444-000000000001', content: 'Frontend development kicked off. Using React with TypeScript. Component library setup complete.', created_by: '11111111-1111-1111-1111-000000000006', created_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString() },
    { id: '55555555-6666-7777-8888-000000000002', project_id: '11111111-2222-3333-4444-000000000001', content: 'Wireframes approved by stakeholders! Client loves the new filtering approach.', created_by: '11111111-1111-1111-1111-000000000005', created_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString() },
    { id: '55555555-6666-7777-8888-000000000003', project_id: '11111111-2222-3333-4444-000000000003', content: 'Responsive implementation going well. All breakpoints working. Focused on mobile now.', created_by: '11111111-1111-1111-1111-000000000006', created_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString() },
    { id: '55555555-6666-7777-8888-000000000004', project_id: '11111111-2222-3333-4444-000000000003', content: 'Homepage design approved! Client is thrilled with the hero section.', created_by: '11111111-1111-1111-1111-000000000005', created_at: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString() },
    { id: '55555555-6666-7777-8888-000000000005', project_id: '11111111-2222-3333-4444-000000000005', content: 'Logo selected! Now working on color palette and typography.', created_by: '11111111-1111-1111-1111-000000000005', created_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString() },
    { id: '55555555-6666-7777-8888-000000000006', project_id: '11111111-2222-3333-4444-000000000008', content: 'Online ordering integration started. Setting up payment processing next week.', created_by: '11111111-1111-1111-1111-000000000006', created_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString() },
  ];
}

function generateMilestones() {
  return [
    { id: '88888888-9999-aaaa-bbbb-000000000001', name: 'TechStart MVP Launch', description: 'Client product goes live!', date: getRelativeDate(14), color: '#ef4444' },
    { id: '88888888-9999-aaaa-bbbb-000000000002', name: 'User Onboarding Go-Live', description: 'New onboarding deployed', date: getRelativeDate(5), color: '#22c55e' },
    { id: '88888888-9999-aaaa-bbbb-000000000003', name: 'Acme Dashboard Beta', description: 'Internal beta testing', date: getRelativeDate(21), color: '#3b82f6' },
    { id: '88888888-9999-aaaa-bbbb-000000000004', name: 'Brand Guidelines Delivery', description: 'Complete brand package', date: getRelativeDate(18), color: '#a855f7' },
  ];
}

function generateUserAvailability() {
  return [
    { id: '77777777-8888-9999-aaaa-000000000001', user_id: '11111111-1111-1111-1111-000000000005', week_start_date: getWeekStart(), available_hours: 40, notes: 'Full week available' },
    { id: '77777777-8888-9999-aaaa-000000000002', user_id: '11111111-1111-1111-1111-000000000005', week_start_date: getWeekStart(7), available_hours: 32, notes: 'Training on Friday' },
    { id: '77777777-8888-9999-aaaa-000000000003', user_id: '11111111-1111-1111-1111-000000000006', week_start_date: getWeekStart(), available_hours: 40, notes: 'Full week available' },
    { id: '77777777-8888-9999-aaaa-000000000004', user_id: '11111111-1111-1111-1111-000000000006', week_start_date: getWeekStart(7), available_hours: 40, notes: 'Full week available' },
    { id: '77777777-8888-9999-aaaa-000000000005', user_id: '11111111-1111-1111-1111-000000000004', week_start_date: getWeekStart(), available_hours: 40, notes: 'Full week available' },
    { id: '77777777-8888-9999-aaaa-000000000006', user_id: '11111111-1111-1111-1111-000000000004', week_start_date: getWeekStart(7), available_hours: 40, notes: 'Full week available' },
  ];
}

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

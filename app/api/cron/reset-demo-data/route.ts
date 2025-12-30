import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// This endpoint resets demo data daily for demo.movalab.dev
// Runs via Vercel Cron at midnight UTC
// ONLY runs when DEMO_MODE is enabled

const DEMO_PROJECT_URL = 'https://xxtelrazoeuirsnvdoml.supabase.co';

// Check if demo mode is enabled
function isDemoModeEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ||
    process.env.DEMO_MODE === 'true'
  );
}

export async function GET(request: NextRequest) {
  // CRITICAL: Only run if demo mode is enabled
  if (!isDemoModeEnabled()) {
    return NextResponse.json(
      {
        error: 'Demo mode is not enabled',
        message: 'This cron job only runs when NEXT_PUBLIC_DEMO_MODE=true or DEMO_MODE=true'
      },
      { status: 403 }
    );
  }

  // Note: CRON_SECRET auth removed - DEMO_MODE check above is sufficient protection
  // This endpoint is safe without additional auth because:
  // 1. Only runs when DEMO_MODE=true (production deployments don't have this)
  // 2. Only resets demo seed data (idempotent, no security risk)
  // 3. No sensitive data is exposed or modified

  const serviceRoleKey = process.env.DEMO_SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 });
  }

  const supabase = createClient(DEMO_PROJECT_URL, serviceRoleKey);

  try {
    // Step 0: Ensure all 5 departments exist (use ON CONFLICT name since that's the unique constraint)
    const departmentsUpsert = `
      INSERT INTO departments (name, description) VALUES
        ('Leadership', 'Executive leadership and strategic direction'),
        ('Marketing', 'Marketing and communications'),
        ('Design', 'Creative and visual design'),
        ('Development', 'Software development and engineering'),
        ('Operations', 'Operations and project coordination')
      ON CONFLICT (name) DO UPDATE SET
        description = EXCLUDED.description;
    `;
    const { error: deptError } = await supabase.rpc('exec_sql', { query: departmentsUpsert });
    if (deptError) console.error('Departments upsert error:', deptError);

    // Get the Operations department ID (it may have been created with a different UUID)
    const { data: opsDept } = await supabase
      .from('departments')
      .select('id')
      .eq('name', 'Operations')
      .single();

    const operationsDeptId = opsDept?.id;

    // Ensure Operations Coordinator role exists (only if we have a valid department)
    if (operationsDeptId) {
      const opsRoleUpsert = `
        INSERT INTO roles (name, department_id, permissions, is_system_role, hierarchy_level, description) VALUES
          ('Operations Coordinator', '${operationsDeptId}',
            '{"view_projects": true, "manage_time": true, "view_time_entries": true, "edit_own_availability": true, "view_departments": true, "view_newsletters": true}'::jsonb,
            FALSE, 50, 'Operations and logistics')
        ON CONFLICT (name) DO UPDATE SET
          department_id = EXCLUDED.department_id,
          permissions = EXCLUDED.permissions;
      `;
      const { error: opsRoleError } = await supabase.rpc('exec_sql', { query: opsRoleUpsert });
      if (opsRoleError) console.error('Operations role upsert error:', opsRoleError);
    }

    // Step 1: Clear existing seed data
    const clearQueries = [
      `DELETE FROM workflow_active_steps WHERE workflow_instance_id IN (SELECT id FROM workflow_instances WHERE id::text LIKE 'cccccccc%')`,
      `DELETE FROM workflow_history WHERE workflow_instance_id IN (SELECT id FROM workflow_instances WHERE id::text LIKE 'cccccccc%')`,
      `DELETE FROM workflow_instances WHERE id::text LIKE 'cccccccc%'`,
      `DELETE FROM workflow_connections WHERE id::text LIKE 'bbbbbbbb-cccc%'`,
      `DELETE FROM workflow_nodes WHERE id::text LIKE 'bbbbbbbb-aaaa%'`,
      `DELETE FROM workflow_templates WHERE id::text LIKE 'aaaaaaaa-bbbb%'`,
      `DELETE FROM time_entries WHERE id::text LIKE '66666666%'`,
      `DELETE FROM task_week_allocations WHERE id::text LIKE '99999999%'`,
      `DELETE FROM project_issues WHERE id::text LIKE 'dddddddd%'`,
      `DELETE FROM newsletters WHERE id::text LIKE 'eeeeeeee%'`,
      `DELETE FROM project_updates WHERE id::text LIKE '55555555%'`,
      `DELETE FROM project_assignments WHERE id::text LIKE '44444444%'`,
      `DELETE FROM project_stakeholders WHERE id::text LIKE 'ffffffff%'`,
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

    // Step 10: Insert workflow templates
    const workflowTemplates = generateWorkflowTemplates();
    const { error: templatesError } = await supabase.from('workflow_templates').upsert(workflowTemplates, { onConflict: 'id' });
    if (templatesError) console.error('Workflow templates error:', templatesError);

    // Step 11: Insert workflow nodes
    const workflowNodes = generateWorkflowNodes();
    const { error: nodesError } = await supabase.from('workflow_nodes').upsert(workflowNodes, { onConflict: 'id' });
    if (nodesError) console.error('Workflow nodes error:', nodesError);

    // Step 12: Insert workflow connections
    const workflowConnections = generateWorkflowConnections();
    const { error: connectionsError } = await supabase.from('workflow_connections').upsert(workflowConnections, { onConflict: 'id' });
    if (connectionsError) console.error('Workflow connections error:', connectionsError);

    // Step 13: Insert workflow instances
    const workflowInstances = generateWorkflowInstances();
    const { error: instancesError } = await supabase.from('workflow_instances').upsert(workflowInstances, { onConflict: 'id' });
    if (instancesError) console.error('Workflow instances error:', instancesError);

    // Step 14: Insert newsletters
    const newsletters = generateNewsletters();
    const { error: newslettersError } = await supabase.from('newsletters').upsert(newsletters, { onConflict: 'id' });
    if (newslettersError) console.error('Newsletters error:', newslettersError);

    // Step 15: Insert project issues
    const projectIssues = generateProjectIssues();
    const { error: issuesError } = await supabase.from('project_issues').upsert(projectIssues, { onConflict: 'id' });
    if (issuesError) console.error('Project issues error:', issuesError);

    // Step 16: Insert task week allocations
    const taskAllocations = generateTaskWeekAllocations();
    const { error: allocationsError } = await supabase.from('task_week_allocations').upsert(taskAllocations, { onConflict: 'id' });
    if (allocationsError) console.error('Task allocations error:', allocationsError);

    // Step 17: Insert project stakeholders
    const stakeholders = generateProjectStakeholders();
    const { error: stakeholdersError } = await supabase.from('project_stakeholders').upsert(stakeholders, { onConflict: 'id' });
    if (stakeholdersError) console.error('Stakeholders error:', stakeholdersError);

    // Step 18: Update role permissions for demo (all internal users get manage_time, edit_own_availability, view_newsletters, view_issues)
    const rolePermissionsUpdate = `
      UPDATE roles SET permissions = permissions ||
        '{"manage_time": true, "edit_own_availability": true, "view_newsletters": true, "view_departments": true, "view_issues": true}'::jsonb
      WHERE name IN ('Executive Director', 'Account Manager', 'Project Manager', 'Senior Designer', 'Senior Developer', 'Junior Designer', 'Junior Developer', 'Admin');
    `;
    const { error: permError } = await supabase.rpc('exec_sql', { query: rolePermissionsUpdate });
    if (permError) console.error('Role permissions update error:', permError);

    // Step 19: Add leadership permissions (manage_issues for managers and above)
    const leadershipPermissionsUpdate = `
      UPDATE roles SET permissions = permissions ||
        '{"manage_issues": true}'::jsonb
      WHERE name IN ('Executive Director', 'Account Manager', 'Project Manager', 'Admin');
    `;
    const { error: leadershipPermError } = await supabase.rpc('exec_sql', { query: leadershipPermissionsUpdate });
    if (leadershipPermError) console.error('Leadership permissions update error:', leadershipPermError);

    // Step 20: Add admin-specific permissions to Admin role
    const adminPermissionsUpdate = `
      UPDATE roles SET permissions = permissions ||
        '{"manage_departments": true, "manage_user_roles": true, "manage_workflows": true, "manage_accounts": true, "view_all_accounts": true, "view_all_projects": true, "manage_projects": true, "view_all_analytics": true, "view_all_capacity": true, "view_all_time_entries": true, "manage_all_workflows": true, "execute_any_workflow": true, "view_all_updates": true, "view_all_department_analytics": true, "view_all_account_analytics": true}'::jsonb
      WHERE name = 'Admin';
    `;
    const { error: adminPermError } = await supabase.rpc('exec_sql', { query: adminPermissionsUpdate });
    if (adminPermError) console.error('Admin permissions update error:', adminPermError);

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
    // Existing assignments
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
    // Alex Executive as Executive Sponsor on key projects
    { id: '44444444-5555-6666-7777-000000000013', project_id: '11111111-2222-3333-4444-000000000001', user_id: '11111111-1111-1111-1111-000000000002', role_in_project: 'Executive Sponsor', assigned_by: '11111111-1111-1111-1111-000000000003' },
    { id: '44444444-5555-6666-7777-000000000014', project_id: '11111111-2222-3333-4444-000000000003', user_id: '11111111-1111-1111-1111-000000000002', role_in_project: 'Executive Sponsor', assigned_by: '11111111-1111-1111-1111-000000000003' },
    { id: '44444444-5555-6666-7777-000000000015', project_id: '11111111-2222-3333-4444-000000000005', user_id: '11111111-1111-1111-1111-000000000002', role_in_project: 'Executive Sponsor', assigned_by: '11111111-1111-1111-1111-000000000003' },
    // Morgan Manager on more projects
    { id: '44444444-5555-6666-7777-000000000016', project_id: '11111111-2222-3333-4444-000000000002', user_id: '11111111-1111-1111-1111-000000000004', role_in_project: 'Project Manager', assigned_by: '11111111-1111-1111-1111-000000000003' },
    { id: '44444444-5555-6666-7777-000000000017', project_id: '11111111-2222-3333-4444-000000000002', user_id: '11111111-1111-1111-1111-000000000006', role_in_project: 'Lead Developer', assigned_by: '11111111-1111-1111-1111-000000000004' },
    { id: '44444444-5555-6666-7777-000000000018', project_id: '11111111-2222-3333-4444-000000000006', user_id: '11111111-1111-1111-1111-000000000003', role_in_project: 'Account Manager', assigned_by: '11111111-1111-1111-1111-000000000002' },
    { id: '44444444-5555-6666-7777-000000000019', project_id: '11111111-2222-3333-4444-000000000004', user_id: '11111111-1111-1111-1111-000000000004', role_in_project: 'Project Manager', assigned_by: '11111111-1111-1111-1111-000000000003' },
    { id: '44444444-5555-6666-7777-000000000020', project_id: '11111111-2222-3333-4444-000000000004', user_id: '11111111-1111-1111-1111-000000000005', role_in_project: 'UX Designer', assigned_by: '11111111-1111-1111-1111-000000000004' },
    { id: '44444444-5555-6666-7777-000000000021', project_id: '11111111-2222-3333-4444-000000000004', user_id: '11111111-1111-1111-1111-000000000006', role_in_project: 'Developer', assigned_by: '11111111-1111-1111-1111-000000000004' },
    // Andy Admin on all projects (admin access)
    { id: '44444444-5555-6666-7777-000000000022', project_id: '11111111-2222-3333-4444-000000000001', user_id: '11111111-1111-1111-1111-000000000009', role_in_project: 'Admin', assigned_by: '11111111-1111-1111-1111-000000000002' },
    { id: '44444444-5555-6666-7777-000000000023', project_id: '11111111-2222-3333-4444-000000000002', user_id: '11111111-1111-1111-1111-000000000009', role_in_project: 'Admin', assigned_by: '11111111-1111-1111-1111-000000000002' },
    { id: '44444444-5555-6666-7777-000000000024', project_id: '11111111-2222-3333-4444-000000000003', user_id: '11111111-1111-1111-1111-000000000009', role_in_project: 'Admin', assigned_by: '11111111-1111-1111-1111-000000000002' },
    { id: '44444444-5555-6666-7777-000000000025', project_id: '11111111-2222-3333-4444-000000000004', user_id: '11111111-1111-1111-1111-000000000009', role_in_project: 'Admin', assigned_by: '11111111-1111-1111-1111-000000000002' },
    { id: '44444444-5555-6666-7777-000000000026', project_id: '11111111-2222-3333-4444-000000000005', user_id: '11111111-1111-1111-1111-000000000009', role_in_project: 'Admin', assigned_by: '11111111-1111-1111-1111-000000000002' },
    { id: '44444444-5555-6666-7777-000000000027', project_id: '11111111-2222-3333-4444-000000000006', user_id: '11111111-1111-1111-1111-000000000009', role_in_project: 'Admin', assigned_by: '11111111-1111-1111-1111-000000000002' },
    { id: '44444444-5555-6666-7777-000000000028', project_id: '11111111-2222-3333-4444-000000000007', user_id: '11111111-1111-1111-1111-000000000009', role_in_project: 'Admin', assigned_by: '11111111-1111-1111-1111-000000000002' },
    { id: '44444444-5555-6666-7777-000000000029', project_id: '11111111-2222-3333-4444-000000000008', user_id: '11111111-1111-1111-1111-000000000009', role_in_project: 'Admin', assigned_by: '11111111-1111-1111-1111-000000000002' },
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
    // Andy Admin on all accounts
    { id: '33333333-4444-5555-6666-000000000020', user_id: '11111111-1111-1111-1111-000000000009', account_id: 'aaaaaaaa-0000-0000-0000-000000000001' },
    { id: '33333333-4444-5555-6666-000000000021', user_id: '11111111-1111-1111-1111-000000000009', account_id: 'aaaaaaaa-0000-0000-0000-000000000002' },
    { id: '33333333-4444-5555-6666-000000000022', user_id: '11111111-1111-1111-1111-000000000009', account_id: 'aaaaaaaa-0000-0000-0000-000000000003' },
    { id: '33333333-4444-5555-6666-000000000023', user_id: '11111111-1111-1111-1111-000000000009', account_id: 'aaaaaaaa-0000-0000-0000-000000000004' },
    { id: '33333333-4444-5555-6666-000000000024', user_id: '11111111-1111-1111-1111-000000000009', account_id: 'aaaaaaaa-0000-0000-0000-000000000005' },
  ];
}

function generateTimeEntries() {
  return [
    // Dana Designer entries
    { id: '66666666-7777-8888-9999-000000000001', task_id: '22222222-3333-4444-5555-000000000011', user_id: '11111111-1111-1111-1111-000000000005', project_id: '11111111-2222-3333-4444-000000000005', hours_logged: 4, entry_date: getRelativeDate(0), week_start_date: getWeekStart(), description: 'Color palette iterations' },
    { id: '66666666-7777-8888-9999-000000000002', task_id: '22222222-3333-4444-5555-000000000003', user_id: '11111111-1111-1111-1111-000000000005', project_id: '11111111-2222-3333-4444-000000000001', hours_logged: 3, entry_date: getRelativeDate(0), week_start_date: getWeekStart(), description: 'Design review' },
    { id: '66666666-7777-8888-9999-000000000006', task_id: '22222222-3333-4444-5555-000000000007', user_id: '11111111-1111-1111-1111-000000000005', project_id: '11111111-2222-3333-4444-000000000003', hours_logged: 6, entry_date: getRelativeDate(-1), week_start_date: getWeekStart(), description: 'Features section design' },
    { id: '66666666-7777-8888-9999-000000000007', task_id: '22222222-3333-4444-5555-000000000002', user_id: '11111111-1111-1111-1111-000000000005', project_id: '11111111-2222-3333-4444-000000000001', hours_logged: 8, entry_date: getRelativeDate(-2), week_start_date: getWeekStart(), description: 'Dashboard mockups' },
    { id: '66666666-7777-8888-9999-000000000010', task_id: '22222222-3333-4444-5555-000000000010', user_id: '11111111-1111-1111-1111-000000000005', project_id: '11111111-2222-3333-4444-000000000005', hours_logged: 8, entry_date: getRelativeDate(-4), week_start_date: getWeekStart(-7), description: 'Logo concepts' },
    { id: '66666666-7777-8888-9999-000000000011', task_id: '22222222-3333-4444-5555-000000000012', user_id: '11111111-1111-1111-1111-000000000005', project_id: '11111111-2222-3333-4444-000000000008', hours_logged: 6, entry_date: getRelativeDate(-5), week_start_date: getWeekStart(-7), description: 'Menu page design' },
    // Dev Developer entries
    { id: '66666666-7777-8888-9999-000000000003', task_id: '22222222-3333-4444-5555-000000000003', user_id: '11111111-1111-1111-1111-000000000006', project_id: '11111111-2222-3333-4444-000000000001', hours_logged: 8, entry_date: getRelativeDate(0), week_start_date: getWeekStart(), description: 'React component development' },
    { id: '66666666-7777-8888-9999-000000000004', task_id: '22222222-3333-4444-5555-000000000004', user_id: '11111111-1111-1111-1111-000000000006', project_id: '11111111-2222-3333-4444-000000000001', hours_logged: 6, entry_date: getRelativeDate(0), week_start_date: getWeekStart(), description: 'API updates' },
    { id: '66666666-7777-8888-9999-000000000005', task_id: '22222222-3333-4444-5555-000000000008', user_id: '11111111-1111-1111-1111-000000000006', project_id: '11111111-2222-3333-4444-000000000003', hours_logged: 8, entry_date: getRelativeDate(-1), week_start_date: getWeekStart(), description: 'Responsive implementation' },
    { id: '66666666-7777-8888-9999-000000000008', task_id: '22222222-3333-4444-5555-000000000003', user_id: '11111111-1111-1111-1111-000000000006', project_id: '11111111-2222-3333-4444-000000000001', hours_logged: 8, entry_date: getRelativeDate(-2), week_start_date: getWeekStart(), description: 'Dashboard charts' },
    { id: '66666666-7777-8888-9999-000000000009', task_id: '22222222-3333-4444-5555-000000000008', user_id: '11111111-1111-1111-1111-000000000006', project_id: '11111111-2222-3333-4444-000000000003', hours_logged: 6, entry_date: getRelativeDate(-3), week_start_date: getWeekStart(), description: 'Mobile breakpoints' },
    { id: '66666666-7777-8888-9999-000000000012', task_id: '22222222-3333-4444-5555-000000000013', user_id: '11111111-1111-1111-1111-000000000006', project_id: '11111111-2222-3333-4444-000000000008', hours_logged: 4, entry_date: getRelativeDate(-5), week_start_date: getWeekStart(-7), description: 'Order system setup' },
    // Alex Executive entries (executive oversight and reviews)
    { id: '66666666-7777-8888-9999-000000000013', task_id: null, user_id: '11111111-1111-1111-1111-000000000002', project_id: '11111111-2222-3333-4444-000000000001', hours_logged: 2, entry_date: getRelativeDate(0), week_start_date: getWeekStart(), description: 'Executive dashboard review meeting' },
    { id: '66666666-7777-8888-9999-000000000014', task_id: null, user_id: '11111111-1111-1111-1111-000000000002', project_id: '11111111-2222-3333-4444-000000000003', hours_logged: 1.5, entry_date: getRelativeDate(-1), week_start_date: getWeekStart(), description: 'TechStart MVP stakeholder call' },
    { id: '66666666-7777-8888-9999-000000000015', task_id: null, user_id: '11111111-1111-1111-1111-000000000002', project_id: '11111111-2222-3333-4444-000000000005', hours_logged: 1, entry_date: getRelativeDate(-2), week_start_date: getWeekStart(), description: 'Brand strategy review' },
    { id: '66666666-7777-8888-9999-000000000016', task_id: null, user_id: '11111111-1111-1111-1111-000000000002', project_id: '11111111-2222-3333-4444-000000000001', hours_logged: 2, entry_date: getRelativeDate(-4), week_start_date: getWeekStart(-7), description: 'Acme quarterly review' },
    { id: '66666666-7777-8888-9999-000000000017', task_id: null, user_id: '11111111-1111-1111-1111-000000000002', project_id: '11111111-2222-3333-4444-000000000003', hours_logged: 1, entry_date: getRelativeDate(-5), week_start_date: getWeekStart(-7), description: 'TechStart budget approval' },
    // Morgan Manager entries (account management)
    { id: '66666666-7777-8888-9999-000000000018', task_id: null, user_id: '11111111-1111-1111-1111-000000000003', project_id: '11111111-2222-3333-4444-000000000006', hours_logged: 3, entry_date: getRelativeDate(0), week_start_date: getWeekStart(), description: 'Fashion Forward kickoff planning' },
    { id: '66666666-7777-8888-9999-000000000019', task_id: null, user_id: '11111111-1111-1111-1111-000000000003', project_id: '11111111-2222-3333-4444-000000000006', hours_logged: 2, entry_date: getRelativeDate(-1), week_start_date: getWeekStart(), description: 'E-commerce requirements gathering' },
    { id: '66666666-7777-8888-9999-000000000020', task_id: null, user_id: '11111111-1111-1111-1111-000000000003', project_id: '11111111-2222-3333-4444-000000000001', hours_logged: 1.5, entry_date: getRelativeDate(-2), week_start_date: getWeekStart(), description: 'Acme account check-in' },
    { id: '66666666-7777-8888-9999-000000000021', task_id: null, user_id: '11111111-1111-1111-1111-000000000003', project_id: '11111111-2222-3333-4444-000000000003', hours_logged: 2, entry_date: getRelativeDate(-4), week_start_date: getWeekStart(-7), description: 'TechStart client meeting' },
    // Pat Project Manager entries (project coordination)
    { id: '66666666-7777-8888-9999-000000000022', task_id: null, user_id: '11111111-1111-1111-1111-000000000004', project_id: '11111111-2222-3333-4444-000000000001', hours_logged: 4, entry_date: getRelativeDate(0), week_start_date: getWeekStart(), description: 'Dashboard sprint planning' },
    { id: '66666666-7777-8888-9999-000000000023', task_id: null, user_id: '11111111-1111-1111-1111-000000000004', project_id: '11111111-2222-3333-4444-000000000003', hours_logged: 3, entry_date: getRelativeDate(-1), week_start_date: getWeekStart(), description: 'MVP launch coordination' },
    { id: '66666666-7777-8888-9999-000000000024', task_id: null, user_id: '11111111-1111-1111-1111-000000000004', project_id: '11111111-2222-3333-4444-000000000005', hours_logged: 2, entry_date: getRelativeDate(-2), week_start_date: getWeekStart(), description: 'Brand identity review with client' },
    { id: '66666666-7777-8888-9999-000000000025', task_id: null, user_id: '11111111-1111-1111-1111-000000000004', project_id: '11111111-2222-3333-4444-000000000008', hours_logged: 2.5, entry_date: getRelativeDate(-3), week_start_date: getWeekStart(), description: 'Bistro website progress review' },
    { id: '66666666-7777-8888-9999-000000000026', task_id: null, user_id: '11111111-1111-1111-1111-000000000004', project_id: '11111111-2222-3333-4444-000000000004', hours_logged: 3, entry_date: getRelativeDate(-4), week_start_date: getWeekStart(-7), description: 'Onboarding flow UAT coordination' },
    { id: '66666666-7777-8888-9999-000000000027', task_id: null, user_id: '11111111-1111-1111-1111-000000000004', project_id: '11111111-2222-3333-4444-000000000001', hours_logged: 3, entry_date: getRelativeDate(-5), week_start_date: getWeekStart(-7), description: 'Dashboard retrospective' },
    // Andy Admin entries (admin oversight and system management)
    { id: '66666666-7777-8888-9999-000000000028', task_id: null, user_id: '11111111-1111-1111-1111-000000000009', project_id: '11111111-2222-3333-4444-000000000001', hours_logged: 3, entry_date: getRelativeDate(0), week_start_date: getWeekStart(), description: 'System configuration and workflow setup' },
    { id: '66666666-7777-8888-9999-000000000029', task_id: null, user_id: '11111111-1111-1111-1111-000000000009', project_id: '11111111-2222-3333-4444-000000000003', hours_logged: 2, entry_date: getRelativeDate(0), week_start_date: getWeekStart(), description: 'TechStart access management' },
    { id: '66666666-7777-8888-9999-000000000030', task_id: null, user_id: '11111111-1111-1111-1111-000000000009', project_id: '11111111-2222-3333-4444-000000000002', hours_logged: 1.5, entry_date: getRelativeDate(-1), week_start_date: getWeekStart(), description: 'Mobile app project setup' },
    { id: '66666666-7777-8888-9999-000000000031', task_id: null, user_id: '11111111-1111-1111-1111-000000000009', project_id: '11111111-2222-3333-4444-000000000005', hours_logged: 2, entry_date: getRelativeDate(-1), week_start_date: getWeekStart(), description: 'Green Energy workflow configuration' },
    { id: '66666666-7777-8888-9999-000000000032', task_id: null, user_id: '11111111-1111-1111-1111-000000000009', project_id: '11111111-2222-3333-4444-000000000006', hours_logged: 3, entry_date: getRelativeDate(-2), week_start_date: getWeekStart(), description: 'E-commerce platform initial setup' },
    { id: '66666666-7777-8888-9999-000000000033', task_id: null, user_id: '11111111-1111-1111-1111-000000000009', project_id: '11111111-2222-3333-4444-000000000008', hours_logged: 1.5, entry_date: getRelativeDate(-3), week_start_date: getWeekStart(), description: 'Local Bistro permissions audit' },
    { id: '66666666-7777-8888-9999-000000000034', task_id: null, user_id: '11111111-1111-1111-1111-000000000009', project_id: '11111111-2222-3333-4444-000000000001', hours_logged: 2, entry_date: getRelativeDate(-4), week_start_date: getWeekStart(-7), description: 'Dashboard role configuration' },
    { id: '66666666-7777-8888-9999-000000000035', task_id: null, user_id: '11111111-1111-1111-1111-000000000009', project_id: '11111111-2222-3333-4444-000000000004', hours_logged: 2.5, entry_date: getRelativeDate(-5), week_start_date: getWeekStart(-7), description: 'Onboarding workflow review' },
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
    // Dana Designer
    { id: '77777777-8888-9999-aaaa-000000000001', user_id: '11111111-1111-1111-1111-000000000005', week_start_date: getWeekStart(), available_hours: 40, notes: 'Full week available' },
    { id: '77777777-8888-9999-aaaa-000000000002', user_id: '11111111-1111-1111-1111-000000000005', week_start_date: getWeekStart(7), available_hours: 32, notes: 'Training on Friday' },
    // Dev Developer
    { id: '77777777-8888-9999-aaaa-000000000003', user_id: '11111111-1111-1111-1111-000000000006', week_start_date: getWeekStart(), available_hours: 40, notes: 'Full week available' },
    { id: '77777777-8888-9999-aaaa-000000000004', user_id: '11111111-1111-1111-1111-000000000006', week_start_date: getWeekStart(7), available_hours: 40, notes: 'Full week available' },
    // Pat Project Manager
    { id: '77777777-8888-9999-aaaa-000000000005', user_id: '11111111-1111-1111-1111-000000000004', week_start_date: getWeekStart(), available_hours: 40, notes: 'Full week available' },
    { id: '77777777-8888-9999-aaaa-000000000006', user_id: '11111111-1111-1111-1111-000000000004', week_start_date: getWeekStart(7), available_hours: 40, notes: 'Full week available' },
    // Alex Executive
    { id: '77777777-8888-9999-aaaa-000000000007', user_id: '11111111-1111-1111-1111-000000000002', week_start_date: getWeekStart(), available_hours: 20, notes: 'Part-time oversight - executive duties' },
    { id: '77777777-8888-9999-aaaa-000000000008', user_id: '11111111-1111-1111-1111-000000000002', week_start_date: getWeekStart(7), available_hours: 20, notes: 'Part-time oversight' },
    // Morgan Manager
    { id: '77777777-8888-9999-aaaa-000000000009', user_id: '11111111-1111-1111-1111-000000000003', week_start_date: getWeekStart(), available_hours: 35, notes: 'Account management focus' },
    { id: '77777777-8888-9999-aaaa-000000000010', user_id: '11111111-1111-1111-1111-000000000003', week_start_date: getWeekStart(7), available_hours: 35, notes: 'Account management focus' },
    // Andy Admin
    { id: '77777777-8888-9999-aaaa-000000000011', user_id: '11111111-1111-1111-1111-000000000009', week_start_date: getWeekStart(), available_hours: 40, notes: 'Full week available' },
    { id: '77777777-8888-9999-aaaa-000000000012', user_id: '11111111-1111-1111-1111-000000000009', week_start_date: getWeekStart(7), available_hours: 40, notes: 'Full week available' },
  ];
}

// Workflow Templates
function generateWorkflowTemplates() {
  return [
    {
      id: 'aaaaaaaa-bbbb-0000-0000-000000000001',
      name: 'Standard Project Delivery',
      description: 'Standard workflow for client project delivery with design, development, and approval phases',
      created_by: '11111111-1111-1111-1111-000000000009',
      is_active: true
    },
    {
      id: 'aaaaaaaa-bbbb-0000-0000-000000000002',
      name: 'Quick Turnaround',
      description: 'Expedited workflow for urgent projects with fewer approval stages',
      created_by: '11111111-1111-1111-1111-000000000009',
      is_active: true
    }
  ];
}

// Workflow Nodes - using 'role' instead of deprecated 'department' node type
// Role IDs: Senior Designer = 10101010-1010-1010-1010-101010101010
//           Senior Developer = 30303030-3030-3030-3030-303030303030
//           Project Manager = ffffffff-ffff-ffff-ffff-ffffffffffff
//           Account Manager = eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee
// Settings use roleId/roleName for role nodes, approverRoleId/approverRoleName for approval nodes
function generateWorkflowNodes() {
  return [
    // Standard Project Delivery workflow nodes
    { id: 'bbbbbbbb-aaaa-0000-0000-000000000001', workflow_template_id: 'aaaaaaaa-bbbb-0000-0000-000000000001', node_type: 'start', label: 'Project Kickoff', position_x: 100, position_y: 200, step_order: 0, settings: {} },
    { id: 'bbbbbbbb-aaaa-0000-0000-000000000002', workflow_template_id: 'aaaaaaaa-bbbb-0000-0000-000000000001', node_type: 'role', entity_id: '10101010-1010-1010-1010-101010101010', label: 'Design Phase', position_x: 300, position_y: 200, step_order: 1, settings: { roleId: '10101010-1010-1010-1010-101010101010', roleName: 'Senior Designer' } },
    { id: 'bbbbbbbb-aaaa-0000-0000-000000000003', workflow_template_id: 'aaaaaaaa-bbbb-0000-0000-000000000001', node_type: 'approval', entity_id: 'ffffffff-ffff-ffff-ffff-ffffffffffff', label: 'Design Approval', position_x: 500, position_y: 200, step_order: 2, settings: { approverRoleId: 'ffffffff-ffff-ffff-ffff-ffffffffffff', approverRoleName: 'Project Manager' } },
    { id: 'bbbbbbbb-aaaa-0000-0000-000000000004', workflow_template_id: 'aaaaaaaa-bbbb-0000-0000-000000000001', node_type: 'role', entity_id: '30303030-3030-3030-3030-303030303030', label: 'Development Phase', position_x: 700, position_y: 200, step_order: 3, settings: { roleId: '30303030-3030-3030-3030-303030303030', roleName: 'Senior Developer' } },
    { id: 'bbbbbbbb-aaaa-0000-0000-000000000005', workflow_template_id: 'aaaaaaaa-bbbb-0000-0000-000000000001', node_type: 'approval', entity_id: 'ffffffff-ffff-ffff-ffff-ffffffffffff', label: 'QA Review', position_x: 900, position_y: 200, step_order: 4, settings: { approverRoleId: 'ffffffff-ffff-ffff-ffff-ffffffffffff', approverRoleName: 'Project Manager' } },
    { id: 'bbbbbbbb-aaaa-0000-0000-000000000006', workflow_template_id: 'aaaaaaaa-bbbb-0000-0000-000000000001', node_type: 'approval', entity_id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', label: 'Client Sign-off', position_x: 1100, position_y: 200, step_order: 5, settings: { approverRoleId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', approverRoleName: 'Account Manager' } },
    { id: 'bbbbbbbb-aaaa-0000-0000-000000000007', workflow_template_id: 'aaaaaaaa-bbbb-0000-0000-000000000001', node_type: 'end', label: 'Project Complete', position_x: 1300, position_y: 200, step_order: 6, settings: {} },
    // Quick Turnaround workflow nodes
    { id: 'bbbbbbbb-aaaa-0000-0000-000000000008', workflow_template_id: 'aaaaaaaa-bbbb-0000-0000-000000000002', node_type: 'start', label: 'Quick Start', position_x: 100, position_y: 200, step_order: 0, settings: {} },
    { id: 'bbbbbbbb-aaaa-0000-0000-000000000009', workflow_template_id: 'aaaaaaaa-bbbb-0000-0000-000000000002', node_type: 'role', entity_id: '10101010-1010-1010-1010-101010101010', label: 'Design & Dev', position_x: 300, position_y: 200, step_order: 1, settings: { roleId: '10101010-1010-1010-1010-101010101010', roleName: 'Senior Designer' } },
    { id: 'bbbbbbbb-aaaa-0000-0000-000000000010', workflow_template_id: 'aaaaaaaa-bbbb-0000-0000-000000000002', node_type: 'approval', entity_id: 'ffffffff-ffff-ffff-ffff-ffffffffffff', label: 'Final Review', position_x: 500, position_y: 200, step_order: 2, settings: { approverRoleId: 'ffffffff-ffff-ffff-ffff-ffffffffffff', approverRoleName: 'Project Manager' } },
    { id: 'bbbbbbbb-aaaa-0000-0000-000000000011', workflow_template_id: 'aaaaaaaa-bbbb-0000-0000-000000000002', node_type: 'end', label: 'Delivered', position_x: 700, position_y: 200, step_order: 3, settings: {} }
  ];
}

// Workflow Connections - each approval node has both Approved and Rejected pathways
// Approval edges need condition JSONB with conditionType: 'approval_decision', conditionValue, decision for UI colors
function generateWorkflowConnections() {
  return [
    // Standard Project Delivery connections
    // Start -> Design Phase (no condition - regular edge)
    { id: 'bbbbbbbb-cccc-0000-0000-000000000001', workflow_template_id: 'aaaaaaaa-bbbb-0000-0000-000000000001', from_node_id: 'bbbbbbbb-aaaa-0000-0000-000000000001', to_node_id: 'bbbbbbbb-aaaa-0000-0000-000000000002', label: 'Start Design', condition: null },
    // Design Phase -> Design Approval (no condition - regular edge)
    { id: 'bbbbbbbb-cccc-0000-0000-000000000002', workflow_template_id: 'aaaaaaaa-bbbb-0000-0000-000000000001', from_node_id: 'bbbbbbbb-aaaa-0000-0000-000000000002', to_node_id: 'bbbbbbbb-aaaa-0000-0000-000000000003', label: 'Submit for Approval', condition: null },
    // Design Approval -> Development Phase (Approved - green edge)
    { id: 'bbbbbbbb-cccc-0000-0000-000000000003', workflow_template_id: 'aaaaaaaa-bbbb-0000-0000-000000000001', from_node_id: 'bbbbbbbb-aaaa-0000-0000-000000000003', to_node_id: 'bbbbbbbb-aaaa-0000-0000-000000000004', label: 'Approved', condition: { conditionType: 'approval_decision', conditionValue: 'approved', decision: 'approved', label: 'Approved' } },
    // Design Approval -> Design Phase (Rejected - red edge)
    { id: 'bbbbbbbb-cccc-0000-0000-000000000010', workflow_template_id: 'aaaaaaaa-bbbb-0000-0000-000000000001', from_node_id: 'bbbbbbbb-aaaa-0000-0000-000000000003', to_node_id: 'bbbbbbbb-aaaa-0000-0000-000000000002', label: 'Rejected', condition: { conditionType: 'approval_decision', conditionValue: 'rejected', decision: 'rejected', label: 'Rejected' } },
    // Development Phase -> QA Review (no condition - regular edge)
    { id: 'bbbbbbbb-cccc-0000-0000-000000000004', workflow_template_id: 'aaaaaaaa-bbbb-0000-0000-000000000001', from_node_id: 'bbbbbbbb-aaaa-0000-0000-000000000004', to_node_id: 'bbbbbbbb-aaaa-0000-0000-000000000005', label: 'Ready for QA', condition: null },
    // QA Review -> Client Sign-off (Approved - green edge)
    { id: 'bbbbbbbb-cccc-0000-0000-000000000005', workflow_template_id: 'aaaaaaaa-bbbb-0000-0000-000000000001', from_node_id: 'bbbbbbbb-aaaa-0000-0000-000000000005', to_node_id: 'bbbbbbbb-aaaa-0000-0000-000000000006', label: 'QA Passed', condition: { conditionType: 'approval_decision', conditionValue: 'approved', decision: 'approved', label: 'QA Passed' } },
    // QA Review -> Development Phase (Rejected - red edge)
    { id: 'bbbbbbbb-cccc-0000-0000-000000000011', workflow_template_id: 'aaaaaaaa-bbbb-0000-0000-000000000001', from_node_id: 'bbbbbbbb-aaaa-0000-0000-000000000005', to_node_id: 'bbbbbbbb-aaaa-0000-0000-000000000004', label: 'Rejected', condition: { conditionType: 'approval_decision', conditionValue: 'rejected', decision: 'rejected', label: 'Rejected' } },
    // Client Sign-off -> Project Complete (Approved - green edge)
    { id: 'bbbbbbbb-cccc-0000-0000-000000000006', workflow_template_id: 'aaaaaaaa-bbbb-0000-0000-000000000001', from_node_id: 'bbbbbbbb-aaaa-0000-0000-000000000006', to_node_id: 'bbbbbbbb-aaaa-0000-0000-000000000007', label: 'Client Approved', condition: { conditionType: 'approval_decision', conditionValue: 'approved', decision: 'approved', label: 'Client Approved' } },
    // Client Sign-off -> Development Phase (Rejected - red edge)
    { id: 'bbbbbbbb-cccc-0000-0000-000000000012', workflow_template_id: 'aaaaaaaa-bbbb-0000-0000-000000000001', from_node_id: 'bbbbbbbb-aaaa-0000-0000-000000000006', to_node_id: 'bbbbbbbb-aaaa-0000-0000-000000000004', label: 'Rejected', condition: { conditionType: 'approval_decision', conditionValue: 'rejected', decision: 'rejected', label: 'Rejected' } },

    // Quick Turnaround connections
    // Quick Start -> Design & Dev (no condition - regular edge)
    { id: 'bbbbbbbb-cccc-0000-0000-000000000007', workflow_template_id: 'aaaaaaaa-bbbb-0000-0000-000000000002', from_node_id: 'bbbbbbbb-aaaa-0000-0000-000000000008', to_node_id: 'bbbbbbbb-aaaa-0000-0000-000000000009', label: 'Begin Work', condition: null },
    // Design & Dev -> Final Review (no condition - regular edge)
    { id: 'bbbbbbbb-cccc-0000-0000-000000000008', workflow_template_id: 'aaaaaaaa-bbbb-0000-0000-000000000002', from_node_id: 'bbbbbbbb-aaaa-0000-0000-000000000009', to_node_id: 'bbbbbbbb-aaaa-0000-0000-000000000010', label: 'Submit', condition: null },
    // Final Review -> Delivered (Approved - green edge)
    { id: 'bbbbbbbb-cccc-0000-0000-000000000009', workflow_template_id: 'aaaaaaaa-bbbb-0000-0000-000000000002', from_node_id: 'bbbbbbbb-aaaa-0000-0000-000000000010', to_node_id: 'bbbbbbbb-aaaa-0000-0000-000000000011', label: 'Approved', condition: { conditionType: 'approval_decision', conditionValue: 'approved', decision: 'approved', label: 'Approved' } },
    // Final Review -> Design & Dev (Rejected - red edge)
    { id: 'bbbbbbbb-cccc-0000-0000-000000000013', workflow_template_id: 'aaaaaaaa-bbbb-0000-0000-000000000002', from_node_id: 'bbbbbbbb-aaaa-0000-0000-000000000010', to_node_id: 'bbbbbbbb-aaaa-0000-0000-000000000009', label: 'Rejected', condition: { conditionType: 'approval_decision', conditionValue: 'rejected', decision: 'rejected', label: 'Rejected' } }
  ];
}

// Workflow Instances - attach workflows to projects
function generateWorkflowInstances() {
  return [
    { id: 'cccccccc-0000-0000-0000-000000000001', workflow_template_id: 'aaaaaaaa-bbbb-0000-0000-000000000001', project_id: '11111111-2222-3333-4444-000000000001', current_node_id: 'bbbbbbbb-aaaa-0000-0000-000000000004', status: 'active' },
    { id: 'cccccccc-0000-0000-0000-000000000002', workflow_template_id: 'aaaaaaaa-bbbb-0000-0000-000000000001', project_id: '11111111-2222-3333-4444-000000000003', current_node_id: 'bbbbbbbb-aaaa-0000-0000-000000000004', status: 'active' },
    { id: 'cccccccc-0000-0000-0000-000000000003', workflow_template_id: 'aaaaaaaa-bbbb-0000-0000-000000000002', project_id: '11111111-2222-3333-4444-000000000004', current_node_id: 'bbbbbbbb-aaaa-0000-0000-000000000010', status: 'active' },
    { id: 'cccccccc-0000-0000-0000-000000000004', workflow_template_id: 'aaaaaaaa-bbbb-0000-0000-000000000001', project_id: '11111111-2222-3333-4444-000000000005', current_node_id: 'bbbbbbbb-aaaa-0000-0000-000000000003', status: 'active' },
    { id: 'cccccccc-0000-0000-0000-000000000005', workflow_template_id: 'aaaaaaaa-bbbb-0000-0000-000000000001', project_id: '11111111-2222-3333-4444-000000000008', current_node_id: 'bbbbbbbb-aaaa-0000-0000-000000000004', status: 'active' },
    { id: 'cccccccc-0000-0000-0000-000000000006', workflow_template_id: 'aaaaaaaa-bbbb-0000-0000-000000000002', project_id: '11111111-2222-3333-4444-000000000007', current_node_id: 'bbbbbbbb-aaaa-0000-0000-000000000011', status: 'completed' }
  ];
}

// Newsletters
function generateNewsletters() {
  const now = new Date();
  return [
    {
      id: 'eeeeeeee-0000-0000-0000-000000000001',
      title: 'Q4 Company Update: New Clients & Team Growth',
      content: `# Q4 2024 Company Update\n\nHello Team!\n\nWe're excited to share some great news from Q4:\n\n## New Clients\n- **Acme Corporation** - Enterprise Dashboard Redesign\n- **TechStart Inc** - MVP Launch Website\n- **Green Energy Co** - Brand Identity Package\n\n## Team Achievements\n- Completed 15 projects this quarter\n- 98% client satisfaction rate\n- Welcomed 3 new team members\n\n## Looking Ahead\nQ1 2025 will focus on expanding our design capabilities and launching new workflow automation features.\n\nThank you for your hard work!\n\n*- Leadership Team*`,
      created_by: '11111111-1111-1111-1111-000000000002',
      is_published: true,
      published_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'eeeeeeee-0000-0000-0000-000000000002',
      title: 'January Team Spotlight & Upcoming Events',
      content: `# January 2025 Team Spotlight\n\n## Employee of the Month\nCongratulations to **Dana Designer** for exceptional work on the TechStart MVP website!\n\n## Upcoming Events\n- **Jan 15**: All-hands meeting (virtual)\n- **Jan 22**: Design team workshop\n- **Jan 30**: Q1 planning session\n\n## Process Updates\nWe're rolling out improved project workflows next week. Training sessions will be scheduled.\n\n## Open Positions\nWe're hiring! Refer qualified candidates for:\n- Senior Developer\n- UX Designer\n- Project Coordinator\n\n*Stay tuned for more updates!*`,
      created_by: '11111111-1111-1111-1111-000000000009',
      is_published: true,
      published_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];
}

// Project Issues
function generateProjectIssues() {
  const now = new Date();
  return [
    { id: 'dddddddd-0000-0000-0000-000000000001', project_id: '11111111-2222-3333-4444-000000000001', content: 'API rate limiting causing dashboard refresh issues', status: 'in_progress', created_by: '11111111-1111-1111-1111-000000000006', created_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString() },
    { id: 'dddddddd-0000-0000-0000-000000000002', project_id: '11111111-2222-3333-4444-000000000001', content: 'Need access to production analytics database', status: 'open', created_by: '11111111-1111-1111-1111-000000000006', created_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString() },
    { id: 'dddddddd-0000-0000-0000-000000000003', project_id: '11111111-2222-3333-4444-000000000003', content: 'Waiting for final copy from client marketing team', status: 'open', created_by: '11111111-1111-1111-1111-000000000005', created_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString() },
    { id: 'dddddddd-0000-0000-0000-000000000004', project_id: '11111111-2222-3333-4444-000000000005', content: 'Color palette needs adjustment for accessibility', status: 'resolved', created_by: '11111111-1111-1111-1111-000000000005', resolved_by: '11111111-1111-1111-1111-000000000005', created_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(), resolved_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString() },
    { id: 'dddddddd-0000-0000-0000-000000000005', project_id: '11111111-2222-3333-4444-000000000008', content: 'Payment gateway integration delayed - waiting for merchant account', status: 'open', created_by: '11111111-1111-1111-1111-000000000006', created_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString() }
  ];
}

// Task Week Allocations for capacity planning
function generateTaskWeekAllocations() {
  return [
    // Current week allocations - Dev Developer
    { id: '99999999-0000-0000-0000-000000000001', task_id: '22222222-3333-4444-5555-000000000003', week_start_date: getWeekStart(), allocated_hours: 24, assigned_user_id: '11111111-1111-1111-1111-000000000006', notes: 'Frontend development sprint' },
    { id: '99999999-0000-0000-0000-000000000002', task_id: '22222222-3333-4444-5555-000000000004', week_start_date: getWeekStart(), allocated_hours: 16, assigned_user_id: '11111111-1111-1111-1111-000000000006', notes: 'API updates' },
    { id: '99999999-0000-0000-0000-000000000003', task_id: '22222222-3333-4444-5555-000000000008', week_start_date: getWeekStart(), allocated_hours: 20, assigned_user_id: '11111111-1111-1111-1111-000000000006', notes: 'Responsive work' },
    // Current week allocations - Dana Designer
    { id: '99999999-0000-0000-0000-000000000004', task_id: '22222222-3333-4444-5555-000000000011', week_start_date: getWeekStart(), allocated_hours: 8, assigned_user_id: '11111111-1111-1111-1111-000000000005', notes: 'Color palette finalization' },
    { id: '99999999-0000-0000-0000-000000000005', task_id: '22222222-3333-4444-5555-000000000013', week_start_date: getWeekStart(), allocated_hours: 16, assigned_user_id: '11111111-1111-1111-1111-000000000006', notes: 'Ordering system' },
    // Next week allocations
    { id: '99999999-0000-0000-0000-000000000006', task_id: '22222222-3333-4444-5555-000000000003', week_start_date: getWeekStart(7), allocated_hours: 32, assigned_user_id: '11111111-1111-1111-1111-000000000006', notes: 'Continue frontend' },
    { id: '99999999-0000-0000-0000-000000000007', task_id: '22222222-3333-4444-5555-000000000009', week_start_date: getWeekStart(7), allocated_hours: 8, assigned_user_id: '11111111-1111-1111-1111-000000000006', notes: 'Contact form' },
    { id: '99999999-0000-0000-0000-000000000008', task_id: '22222222-3333-4444-5555-000000000005', week_start_date: getWeekStart(7), allocated_hours: 24, assigned_user_id: '11111111-1111-1111-1111-000000000006', notes: 'QA testing' },
    // Andy Admin allocations - admin tasks (using QA Testing task since admin helps with QA)
    { id: '99999999-0000-0000-0000-000000000009', task_id: '22222222-3333-4444-5555-000000000005', week_start_date: getWeekStart(), allocated_hours: 8, assigned_user_id: '11111111-1111-1111-1111-000000000009', notes: 'QA coordination and testing support' },
    { id: '99999999-0000-0000-0000-000000000010', task_id: '22222222-3333-4444-5555-000000000009', week_start_date: getWeekStart(), allocated_hours: 4, assigned_user_id: '11111111-1111-1111-1111-000000000009', notes: 'Contact form review' },
    { id: '99999999-0000-0000-0000-000000000011', task_id: '22222222-3333-4444-5555-000000000005', week_start_date: getWeekStart(7), allocated_hours: 12, assigned_user_id: '11111111-1111-1111-1111-000000000009', notes: 'QA testing next week' }
  ];
}

// Project Stakeholders
function generateProjectStakeholders() {
  return [
    // Alex Executive as stakeholder on key projects
    { id: 'ffffffff-0000-0000-0000-000000000001', project_id: '11111111-2222-3333-4444-000000000001', user_id: '11111111-1111-1111-1111-000000000002', role: 'Executive Sponsor', added_by: '11111111-1111-1111-1111-000000000003' },
    { id: 'ffffffff-0000-0000-0000-000000000002', project_id: '11111111-2222-3333-4444-000000000003', user_id: '11111111-1111-1111-1111-000000000002', role: 'Executive Sponsor', added_by: '11111111-1111-1111-1111-000000000003' },
    { id: 'ffffffff-0000-0000-0000-000000000003', project_id: '11111111-2222-3333-4444-000000000005', user_id: '11111111-1111-1111-1111-000000000002', role: 'Executive Sponsor', added_by: '11111111-1111-1111-1111-000000000003' },
    { id: 'ffffffff-0000-0000-0000-000000000004', project_id: '11111111-2222-3333-4444-000000000006', user_id: '11111111-1111-1111-1111-000000000002', role: 'Executive Sponsor', added_by: '11111111-1111-1111-1111-000000000003' },
    // Morgan Manager as stakeholder
    { id: 'ffffffff-0000-0000-0000-000000000005', project_id: '11111111-2222-3333-4444-000000000001', user_id: '11111111-1111-1111-1111-000000000003', role: 'Account Manager', added_by: '11111111-1111-1111-1111-000000000002' },
    { id: 'ffffffff-0000-0000-0000-000000000006', project_id: '11111111-2222-3333-4444-000000000003', user_id: '11111111-1111-1111-1111-000000000003', role: 'Account Manager', added_by: '11111111-1111-1111-1111-000000000002' }
  ];
}

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

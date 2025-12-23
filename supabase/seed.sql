-- MovaLab Comprehensive Seed Data
-- Date: 2025-01-23
-- Description: Complete test dataset for local Docker development
--
-- Test Users (all with password: Test1234!):
-- - superadmin@test.local - Superadmin (full access)
-- - exec@test.local - Executive Director
-- - manager@test.local - Account Manager
-- - pm@test.local - Project Manager
-- - designer@test.local - Senior Designer
-- - dev@test.local - Senior Developer
-- - contributor@test.local - Contributor (part-time)
-- - client@test.local - Client portal access

BEGIN;

-- ============================================================================
-- CLEANUP: Truncate all tables (preserves structure)
-- ============================================================================

TRUNCATE
  workflow_sync_locks,
  workflow_step_assignments,
  workflow_node_assignments,
  workflow_active_steps,
  workflow_approvals,
  client_feedback,
  client_portal_invitations,
  form_responses,
  workflow_history,
  workflow_instances,
  workflow_connections,
  workflow_nodes,
  workflow_templates,
  form_templates,
  project_contributors,
  clock_sessions,
  task_week_allocations,
  time_entries,
  user_availability,
  account_members,
  project_assignments,
  role_hierarchy_audit,
  newsletters,
  project_issues,
  project_updates,
  project_stakeholders,
  account_kanban_configs,
  notifications,
  deliverables,
  task_dependencies,
  task_assignments,
  tasks,
  projects,
  accounts,
  user_roles,
  user_profiles,
  roles,
  departments,
  milestones,
  groups,
  statuses
CASCADE;

-- ============================================================================
-- 1. DEPARTMENTS (5 departments)
-- ============================================================================

INSERT INTO departments (id, name, description) VALUES
('11111111-1111-1111-1111-111111111111', 'Leadership', 'Executive leadership and strategic direction'),
('22222222-2222-2222-2222-222222222222', 'Marketing', 'Marketing and communications'),
('33333333-3333-3333-3333-333333333333', 'Design', 'Creative and visual design'),
('44444444-4444-4444-4444-444444444444', 'Development', 'Software development and engineering'),
('55555555-5555-5555-5555-555555555555', 'Operations', 'Operations and project coordination');

-- ============================================================================
-- 2. ROLES (15 roles with permissions)
-- ============================================================================

-- System Roles
INSERT INTO roles (id, name, department_id, permissions, is_system_role, hierarchy_level, description) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Superadmin', NULL, '{}'::jsonb, TRUE, 100, 'System administrator with full access'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Client', NULL, '{}'::jsonb, TRUE, 0, 'Client portal user'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'No Assigned Role', NULL, '{}'::jsonb, TRUE, 0, 'Default unassigned role');

-- Leadership Roles
INSERT INTO roles (id, name, department_id, permissions, is_system_role, hierarchy_level, description) VALUES
('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Executive Director', '11111111-1111-1111-1111-111111111111',
  '{
    "view_all_projects": true,
    "manage_all_projects": true,
    "view_all_accounts": true,
    "manage_accounts": true,
    "view_all_departments": true,
    "manage_departments": true,
    "view_all_updates": true,
    "view_all_analytics": true,
    "view_all_department_analytics": true,
    "view_all_account_analytics": true,
    "view_all_capacity": true,
    "manage_all_workflows": true,
    "execute_any_workflow": true
  }'::jsonb, FALSE, 90, 'C-level executive'),

('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Account Manager', '11111111-1111-1111-1111-111111111111',
  '{
    "view_accounts": true,
    "manage_accounts": true,
    "view_projects": true,
    "manage_projects": true,
    "view_all_account_analytics": true,
    "manage_users_in_accounts": true,
    "manage_updates": true,
    "view_updates": true,
    "manage_issues": true,
    "view_issues": true,
    "execute_workflows": true
  }'::jsonb, FALSE, 70, 'Manages client accounts'),

('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Project Manager', '11111111-1111-1111-1111-111111111111',
  '{
    "view_projects": true,
    "manage_projects": true,
    "manage_updates": true,
    "view_updates": true,
    "manage_issues": true,
    "view_issues": true,
    "manage_time": true,
    "view_time_entries": true,
    "execute_workflows": true
  }'::jsonb, FALSE, 60, 'Manages individual projects');

-- Design Roles
INSERT INTO roles (id, name, department_id, permissions, is_system_role, hierarchy_level, description) VALUES
('10101010-1010-1010-1010-101010101010', 'Senior Designer', '33333333-3333-3333-3333-333333333333',
  '{
    "view_projects": true,
    "manage_updates": true,
    "view_updates": true,
    "manage_deliverables": true,
    "execute_workflows": true
  }'::jsonb, FALSE, 50, 'Lead creative designer'),

('20202020-2020-2020-2020-202020202020', 'Junior Designer', '33333333-3333-3333-3333-333333333333',
  '{
    "view_projects": true,
    "view_updates": true,
    "execute_workflows": true
  }'::jsonb, FALSE, 40, 'Entry-level designer');

-- Development Roles
INSERT INTO roles (id, name, department_id, permissions, is_system_role, hierarchy_level, description) VALUES
('30303030-3030-3030-3030-303030303030', 'Senior Developer', '44444444-4444-4444-4444-444444444444',
  '{
    "view_projects": true,
    "manage_updates": true,
    "view_updates": true,
    "execute_workflows": true
  }'::jsonb, FALSE, 50, 'Senior software engineer'),

('40404040-4040-4040-4040-404040404040', 'Junior Developer', '44444444-4444-4444-4444-444444444444',
  '{
    "view_projects": true,
    "view_updates": true,
    "execute_workflows": true
  }'::jsonb, FALSE, 40, 'Entry-level developer');

-- Marketing & Operations
INSERT INTO roles (id, name, department_id, permissions, is_system_role, hierarchy_level, description) VALUES
('50505050-5050-5050-5050-505050505050', 'Marketing Specialist', '22222222-2222-2222-2222-222222222222',
  '{
    "view_projects": true,
    "manage_newsletters": true,
    "view_newsletters": true,
    "execute_workflows": true
  }'::jsonb, FALSE, 50, 'Marketing and content specialist'),

('60606060-6060-6060-6060-606060606060', 'Operations Coordinator', '55555555-5555-5555-5555-555555555555',
  '{
    "view_projects": true,
    "view_updates": true,
    "view_all_capacity": true,
    "view_time_entries": true
  }'::jsonb, FALSE, 50, 'Operations and logistics');

-- Generic Roles
INSERT INTO roles (id, name, department_id, permissions, is_system_role, hierarchy_level, description) VALUES
('70707070-7070-7070-7070-707070707070', 'Contributor', NULL,
  '{
    "view_projects": true,
    "view_updates": true
  }'::jsonb, FALSE, 30, 'Basic contributor access'),

('80808080-8080-8080-8080-808080808080', 'Read-Only Observer', NULL,
  '{
    "view_projects": true,
    "view_updates": true,
    "view_newsletters": true
  }'::jsonb, FALSE, 10, 'Read-only stakeholder');

-- ============================================================================
-- 3. USER PROFILES (8 test users)
-- Note: auth.users entries are created via scripts/create-seed-users.ts
-- ============================================================================

INSERT INTO user_profiles (id, email, name, is_superadmin, bio, skills) VALUES
('11111111-1111-1111-1111-000000000001', 'superadmin@test.local', 'Super Admin', TRUE,
 'System administrator with full access to all features',
 ARRAY['administration', 'management', 'system-architecture']),

('11111111-1111-1111-1111-000000000002', 'exec@test.local', 'Alex Executive', FALSE,
 'Executive Director overseeing all operations',
 ARRAY['leadership', 'strategy', 'business-development']),

('11111111-1111-1111-1111-000000000003', 'manager@test.local', 'Morgan Manager', FALSE,
 'Account Manager handling enterprise clients',
 ARRAY['account-management', 'client-relations', 'project-planning']),

('11111111-1111-1111-1111-000000000004', 'pm@test.local', 'Pat ProjectManager', FALSE,
 'Project Manager coordinating cross-functional teams',
 ARRAY['project-management', 'agile', 'scrum', 'coordination']),

('11111111-1111-1111-1111-000000000005', 'designer@test.local', 'Dana Designer', FALSE,
 'Senior Designer creating beautiful user experiences',
 ARRAY['ui-design', 'ux-design', 'figma', 'adobe-creative-suite']),

('11111111-1111-1111-1111-000000000006', 'dev@test.local', 'Dev Developer', FALSE,
 'Senior Developer building scalable applications',
 ARRAY['typescript', 'react', 'node.js', 'postgresql', 'next.js']),

('11111111-1111-1111-1111-000000000007', 'contributor@test.local', 'Casey Contributor', FALSE,
 'Part-time contributor supporting various projects',
 ARRAY['content-writing', 'qa-testing', 'documentation']),

('11111111-1111-1111-1111-000000000008', 'client@test.local', 'Chris Client', FALSE,
 'Client user from Acme Corp',
 ARRAY[]);

-- ============================================================================
-- 4. USER ROLES (assign roles to users)
-- ============================================================================

INSERT INTO user_roles (user_id, role_id) VALUES
('11111111-1111-1111-1111-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), -- superadmin
('11111111-1111-1111-1111-000000000002', 'dddddddd-dddd-dddd-dddd-dddddddddddd'), -- exec
('11111111-1111-1111-1111-000000000003', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'), -- account manager
('11111111-1111-1111-1111-000000000004', 'ffffffff-ffff-ffff-ffff-ffffffffffff'), -- project manager
('11111111-1111-1111-1111-000000000005', '10101010-1010-1010-1010-101010101010'), -- senior designer
('11111111-1111-1111-1111-000000000006', '30303030-3030-3030-3030-303030303030'), -- senior developer
('11111111-1111-1111-1111-000000000007', '70707070-7070-7070-7070-707070707070'), -- contributor
('11111111-1111-1111-1111-000000000008', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'); -- client

-- ============================================================================
-- 5. ACCOUNTS (3 client accounts)
-- ============================================================================

INSERT INTO accounts (id, name, description, service_tier, account_manager_id, status) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-000000000001', 'Acme Corp', 'Enterprise technology company', 'enterprise',
 '11111111-1111-1111-1111-000000000003', 'active'),

('aaaaaaaa-aaaa-aaaa-aaaa-000000000002', 'StartupXYZ', 'Fast-growing SaaS startup', 'premium',
 '11111111-1111-1111-1111-000000000003', 'active'),

('aaaaaaaa-aaaa-aaaa-aaaa-000000000003', 'Local Business', 'Regional retail business', 'basic',
 '11111111-1111-1111-1111-000000000004', 'active');

-- ============================================================================
-- 6. ACCOUNT MEMBERS (assign users to accounts)
-- ============================================================================

INSERT INTO account_members (user_id, account_id) VALUES
-- Acme Corp team
('11111111-1111-1111-1111-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001'), -- manager
('11111111-1111-1111-1111-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001'), -- pm
('11111111-1111-1111-1111-000000000005', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001'), -- designer
('11111111-1111-1111-1111-000000000006', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001'), -- dev

-- StartupXYZ team
('11111111-1111-1111-1111-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000002'), -- manager
('11111111-1111-1111-1111-000000000005', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000002'), -- designer
('11111111-1111-1111-1111-000000000006', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000002'), -- dev

-- Local Business team
('11111111-1111-1111-1111-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000003'), -- pm
('11111111-1111-1111-1111-000000000007', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000003'); -- contributor

-- ============================================================================
-- 7. PROJECTS (6 projects across 3 accounts)
-- ============================================================================

INSERT INTO projects (id, name, description, account_id, status, priority, start_date, end_date, estimated_hours, created_by, assigned_user_id) VALUES
-- Acme Corp projects
('ffffffff-0001-0002-0003-000000000001', 'Website Redesign', 'Complete overhaul of corporate website',
 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001', 'in_progress', 'high',
 '2025-01-15', '2025-03-15', 200,
 '11111111-1111-1111-1111-000000000003', '11111111-1111-1111-1111-000000000004'),

('ffffffff-0001-0002-0003-000000000002', 'Marketing Campaign', 'Q1 2025 marketing campaign',
 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001', 'planning', 'medium',
 '2025-02-01', '2025-04-30', 120,
 '11111111-1111-1111-1111-000000000003', '11111111-1111-1111-1111-000000000004'),

-- StartupXYZ projects
('ffffffff-0001-0002-0003-000000000003', 'Mobile App MVP', 'iOS and Android mobile application',
 'aaaaaaaa-aaaa-aaaa-aaaa-000000000002', 'in_progress', 'urgent',
 '2025-01-10', '2025-02-28', 300,
 '11111111-1111-1111-1111-000000000003', '11111111-1111-1111-1111-000000000006'),

('ffffffff-0001-0002-0003-000000000004', 'Brand Identity', 'Logo and brand guidelines',
 'aaaaaaaa-aaaa-aaaa-aaaa-000000000002', 'review', 'high',
 '2025-01-05', '2025-02-05', 80,
 '11111111-1111-1111-1111-000000000003', '11111111-1111-1111-1111-000000000005'),

-- Local Business projects
('ffffffff-0001-0002-0003-000000000005', 'Social Media Management', 'Monthly social media content',
 'aaaaaaaa-aaaa-aaaa-aaaa-000000000003', 'in_progress', 'low',
 '2025-01-01', '2025-12-31', 240,
 '11111111-1111-1111-1111-000000000004', '11111111-1111-1111-1111-000000000007'),

('ffffffff-0001-0002-0003-000000000006', 'SEO Optimization', 'Website SEO improvements',
 'aaaaaaaa-aaaa-aaaa-aaaa-000000000003', 'complete', 'medium',
 '2024-12-01', '2025-01-15', 60,
 '11111111-1111-1111-1111-000000000004', '11111111-1111-1111-1111-000000000007');

-- ============================================================================
-- 8. PROJECT ASSIGNMENTS
-- ============================================================================

INSERT INTO project_assignments (project_id, user_id, role_in_project, assigned_by) VALUES
-- Website Redesign team
('ffffffff-0001-0002-0003-000000000001', '11111111-1111-1111-1111-000000000004', 'Project Manager', '11111111-1111-1111-1111-000000000003'),
('ffffffff-0001-0002-0003-000000000001', '11111111-1111-1111-1111-000000000005', 'Lead Designer', '11111111-1111-1111-1111-000000000003'),
('ffffffff-0001-0002-0003-000000000001', '11111111-1111-1111-1111-000000000006', 'Lead Developer', '11111111-1111-1111-1111-000000000003'),

-- Marketing Campaign team
('ffffffff-0001-0002-0003-000000000002', '11111111-1111-1111-1111-000000000004', 'Project Manager', '11111111-1111-1111-1111-000000000003'),
('ffffffff-0001-0002-0003-000000000002', '11111111-1111-1111-1111-000000000005', 'Creative Lead', '11111111-1111-1111-1111-000000000003'),

-- Mobile App MVP team
('ffffffff-0001-0002-0003-000000000003', '11111111-1111-1111-1111-000000000006', 'Tech Lead', '11111111-1111-1111-1111-000000000003'),
('ffffffff-0001-0002-0003-000000000003', '11111111-1111-1111-1111-000000000005', 'UI Designer', '11111111-1111-1111-1111-000000000003'),

-- Brand Identity team
('ffffffff-0001-0002-0003-000000000004', '11111111-1111-1111-1111-000000000005', 'Brand Designer', '11111111-1111-1111-1111-000000000003'),

-- Social Media team
('ffffffff-0001-0002-0003-000000000005', '11111111-1111-1111-1111-000000000007', 'Content Creator', '11111111-1111-1111-1111-000000000004'),

-- SEO team
('ffffffff-0001-0002-0003-000000000006', '11111111-1111-1111-1111-000000000007', 'SEO Specialist', '11111111-1111-1111-1111-000000000004');

-- ============================================================================
-- 9. TASKS (20 tasks across projects)
-- ============================================================================

INSERT INTO tasks (id, name, description, project_id, status, priority, estimated_hours, assigned_to, created_by) VALUES
-- Website Redesign tasks
('cccccccc-dddd-eeee-ffff-000000000001', 'Homepage Design Mockup', 'Create high-fidelity homepage design',
 'ffffffff-0001-0002-0003-000000000001', 'in_progress', 'high', 16,
 '11111111-1111-1111-1111-000000000005', '11111111-1111-1111-1111-000000000004'),

('cccccccc-dddd-eeee-ffff-000000000002', 'About Page Design', 'Design company about page',
 'ffffffff-0001-0002-0003-000000000001', 'done', 'medium', 8,
 '11111111-1111-1111-1111-000000000005', '11111111-1111-1111-1111-000000000004'),

('cccccccc-dddd-eeee-ffff-000000000003', 'Frontend Implementation', 'Implement React components',
 'ffffffff-0001-0002-0003-000000000001', 'todo', 'high', 40,
 '11111111-1111-1111-1111-000000000006', '11111111-1111-1111-1111-000000000004'),

-- Mobile App tasks
('cccccccc-dddd-eeee-ffff-000000000004', 'User Authentication', 'Implement login and signup',
 'ffffffff-0001-0002-0003-000000000003', 'done', 'urgent', 24,
 '11111111-1111-1111-1111-000000000006', '11111111-1111-1111-1111-000000000006'),

('cccccccc-dddd-eeee-ffff-000000000005', 'Dashboard Screen', 'Main dashboard UI',
 'ffffffff-0001-0002-0003-000000000003', 'in_progress', 'high', 20,
 '11111111-1111-1111-1111-000000000006', '11111111-1111-1111-1111-000000000006'),

('cccccccc-dddd-eeee-ffff-000000000006', 'Profile Settings', 'User profile management',
 'ffffffff-0001-0002-0003-000000000003', 'todo', 'medium', 16,
 '11111111-1111-1111-1111-000000000006', '11111111-1111-1111-1111-000000000006'),

-- Marketing Campaign tasks
('cccccccc-dddd-eeee-ffff-000000000007', 'Content Calendar', 'Q1 social media content calendar',
 'ffffffff-0001-0002-0003-000000000002', 'done', 'high', 12,
 '11111111-1111-1111-1111-000000000005', '11111111-1111-1111-1111-000000000004'),

('cccccccc-dddd-eeee-ffff-000000000008', 'Email Campaign Design', 'Newsletter template design',
 'ffffffff-0001-0002-0003-000000000002', 'in_progress', 'medium', 8,
 '11111111-1111-1111-1111-000000000005', '11111111-1111-1111-1111-000000000004'),

('cccccccc-dddd-eeee-ffff-000000000009', 'Analytics Setup', 'Configure Google Analytics and tracking',
 'ffffffff-0001-0002-0003-000000000002', 'todo', 'low', 6,
 '11111111-1111-1111-1111-000000000006', '11111111-1111-1111-1111-000000000004'),

-- Brand Identity tasks
('cccccccc-dddd-eeee-ffff-000000000010', 'Logo Design', 'Create 3 logo concepts',
 'ffffffff-0001-0002-0003-000000000004', 'done', 'urgent', 20,
 '11111111-1111-1111-1111-000000000005', '11111111-1111-1111-1111-000000000005'),

('cccccccc-dddd-eeee-ffff-000000000011', 'Brand Guidelines', 'Document brand colors, fonts, usage',
 'ffffffff-0001-0002-0003-000000000004', 'review', 'high', 12,
 '11111111-1111-1111-1111-000000000005', '11111111-1111-1111-1111-000000000005'),

('cccccccc-dddd-eeee-ffff-000000000012', 'Social Media Templates', 'Instagram and Facebook post templates',
 'ffffffff-0001-0002-0003-000000000004', 'in_progress', 'medium', 10,
 '11111111-1111-1111-1111-000000000005', '11111111-1111-1111-1111-000000000005'),

-- Social Media Management tasks
('cccccccc-dddd-eeee-ffff-000000000013', 'January Posts', 'Create and schedule 20 posts',
 'ffffffff-0001-0002-0003-000000000005', 'done', 'medium', 8,
 '11111111-1111-1111-1111-000000000007', '11111111-1111-1111-1111-000000000007'),

('cccccccc-dddd-eeee-ffff-000000000014', 'February Posts', 'Create and schedule 20 posts',
 'ffffffff-0001-0002-0003-000000000005', 'in_progress', 'medium', 8,
 '11111111-1111-1111-1111-000000000007', '11111111-1111-1111-1111-000000000007'),

('cccccccc-dddd-eeee-ffff-000000000015', 'Community Engagement', 'Respond to comments and DMs',
 'ffffffff-0001-0002-0003-000000000005', 'todo', 'low', 4,
 '11111111-1111-1111-1111-000000000007', '11111111-1111-1111-1111-000000000007'),

-- SEO Optimization tasks
('cccccccc-dddd-eeee-ffff-000000000016', 'Keyword Research', 'Identify target keywords',
 'ffffffff-0001-0002-0003-000000000006', 'done', 'high', 6,
 '11111111-1111-1111-1111-000000000007', '11111111-1111-1111-1111-000000000007'),

('cccccccc-dddd-eeee-ffff-000000000017', 'On-Page SEO', 'Optimize meta tags and content',
 'ffffffff-0001-0002-0003-000000000006', 'done', 'high', 10,
 '11111111-1111-1111-1111-000000000007', '11111111-1111-1111-1111-000000000007'),

('cccccccc-dddd-eeee-ffff-000000000018', 'Technical SEO Audit', 'Fix crawl errors and improve site speed',
 'ffffffff-0001-0002-0003-000000000006', 'done', 'medium', 8,
 '11111111-1111-1111-1111-000000000007', '11111111-1111-1111-1111-000000000007'),

-- Additional Website Redesign tasks
('cccccccc-dddd-eeee-ffff-000000000019', 'Contact Form', 'Design and implement contact form',
 'ffffffff-0001-0002-0003-000000000001', 'todo', 'medium', 6,
 '11111111-1111-1111-1111-000000000006', '11111111-1111-1111-1111-000000000004'),

('cccccccc-dddd-eeee-ffff-000000000020', 'Mobile Responsiveness', 'Test and fix mobile layout issues',
 'ffffffff-0001-0002-0003-000000000001', 'todo', 'high', 12,
 '11111111-1111-1111-1111-000000000006', '11111111-1111-1111-1111-000000000004');

-- ============================================================================
-- 10. USER AVAILABILITY (weekly capacity)
-- ============================================================================

INSERT INTO user_availability (user_id, week_start_date, available_hours) VALUES
-- Current week (adjust date as needed)
('11111111-1111-1111-1111-000000000002', '2025-01-20', 30), -- exec (30hrs/week)
('11111111-1111-1111-1111-000000000003', '2025-01-20', 40), -- manager
('11111111-1111-1111-1111-000000000004', '2025-01-20', 40), -- pm
('11111111-1111-1111-1111-000000000005', '2025-01-20', 40), -- designer
('11111111-1111-1111-1111-000000000006', '2025-01-20', 40), -- dev
('11111111-1111-1111-1111-000000000007', '2025-01-20', 20); -- contributor (part-time)

-- ============================================================================
-- 11. TIME ENTRIES (sample time logs)
-- ============================================================================

INSERT INTO time_entries (task_id, user_id, project_id, hours_logged, entry_date, week_start_date, description) VALUES
('cccccccc-dddd-eeee-ffff-000000000001', '11111111-1111-1111-1111-000000000005',
 'ffffffff-0001-0002-0003-000000000001', 4.5, '2025-01-21', '2025-01-20',
 'Initial homepage design concepts'),

('cccccccc-dddd-eeee-ffff-000000000002', '11111111-1111-1111-1111-000000000005',
 'ffffffff-0001-0002-0003-000000000001', 8.0, '2025-01-22', '2025-01-20',
 'Completed about page design and client review'),

('cccccccc-dddd-eeee-ffff-000000000004', '11111111-1111-1111-1111-000000000006',
 'ffffffff-0001-0002-0003-000000000003', 6.0, '2025-01-21', '2025-01-20',
 'Implemented OAuth integration');

-- ============================================================================
-- 12. WORKFLOW TEMPLATES (2 templates)
-- ============================================================================

INSERT INTO workflow_templates (id, name, description, created_by, is_active) VALUES
('00000001-0002-0003-0004-000000000001', 'Blog Post Approval',
 'Standard workflow for reviewing and publishing blog content',
 '11111111-1111-1111-1111-000000000002', TRUE),

('00000001-0002-0003-0004-000000000002', 'Video Production',
 'End-to-end video production workflow from concept to delivery',
 '11111111-1111-1111-1111-000000000002', TRUE);

-- ============================================================================
-- 13. WORKFLOW NODES (nodes for Blog Post Approval workflow)
-- ============================================================================

INSERT INTO workflow_nodes (id, workflow_template_id, node_type, label, position_x, position_y) VALUES
-- Blog Post Approval workflow nodes
('aaaaaaaa-bbbb-cccc-dddd-000000000001', '00000001-0002-0003-0004-000000000001', 'start', 'Start', 100, 100),
('aaaaaaaa-bbbb-cccc-dddd-000000000002', '00000001-0002-0003-0004-000000000001', 'department', 'Marketing Review', 300, 100),
('aaaaaaaa-bbbb-cccc-dddd-000000000003', '00000001-0002-0003-0004-000000000001', 'approval', 'Manager Approval', 500, 100),
('aaaaaaaa-bbbb-cccc-dddd-000000000004', '00000001-0002-0003-0004-000000000001', 'department', 'Design Graphics', 700, 100),
('aaaaaaaa-bbbb-cccc-dddd-000000000005', '00000001-0002-0003-0004-000000000001', 'end', 'Publish', 900, 100),

-- Video Production workflow nodes
('aaaaaaaa-bbbb-cccc-dddd-000000000006', '00000001-0002-0003-0004-000000000002', 'start', 'Start', 100, 200),
('aaaaaaaa-bbbb-cccc-dddd-000000000007', '00000001-0002-0003-0004-000000000002', 'department', 'Script Writing', 300, 200),
('aaaaaaaa-bbbb-cccc-dddd-000000000008', '00000001-0002-0003-0004-000000000002', 'approval', 'Client Approval', 500, 200),
('aaaaaaaa-bbbb-cccc-dddd-000000000009', '00000001-0002-0003-0004-000000000002', 'department', 'Video Filming', 700, 200),
('aaaaaaaa-bbbb-cccc-dddd-000000000010', '00000001-0002-0003-0004-000000000002', 'department', 'Post-Production', 900, 200),
('aaaaaaaa-bbbb-cccc-dddd-000000000011', '00000001-0002-0003-0004-000000000002', 'end', 'Deliver', 1100, 200);

-- ============================================================================
-- 14. WORKFLOW CONNECTIONS (define valid transitions)
-- ============================================================================

INSERT INTO workflow_connections (workflow_template_id, from_node_id, to_node_id, label) VALUES
-- Blog Post Approval connections
('00000001-0002-0003-0004-000000000001', 'aaaaaaaa-bbbb-cccc-dddd-000000000001', 'aaaaaaaa-bbbb-cccc-dddd-000000000002', 'Draft Complete'),
('00000001-0002-0003-0004-000000000001', 'aaaaaaaa-bbbb-cccc-dddd-000000000002', 'aaaaaaaa-bbbb-cccc-dddd-000000000003', 'Content Ready'),
('00000001-0002-0003-0004-000000000001', 'aaaaaaaa-bbbb-cccc-dddd-000000000003', 'aaaaaaaa-bbbb-cccc-dddd-000000000004', 'Approved'),
('00000001-0002-0003-0004-000000000001', 'aaaaaaaa-bbbb-cccc-dddd-000000000004', 'aaaaaaaa-bbbb-cccc-dddd-000000000005', 'Graphics Complete'),

-- Video Production connections
('00000001-0002-0003-0004-000000000002', 'aaaaaaaa-bbbb-cccc-dddd-000000000006', 'aaaaaaaa-bbbb-cccc-dddd-000000000007', 'Concept Approved'),
('00000001-0002-0003-0004-000000000002', 'aaaaaaaa-bbbb-cccc-dddd-000000000007', 'aaaaaaaa-bbbb-cccc-dddd-000000000008', 'Script Ready'),
('00000001-0002-0003-0004-000000000002', 'aaaaaaaa-bbbb-cccc-dddd-000000000008', 'aaaaaaaa-bbbb-cccc-dddd-000000000009', 'Approved to Film'),
('00000001-0002-0003-0004-000000000002', 'aaaaaaaa-bbbb-cccc-dddd-000000000009', 'aaaaaaaa-bbbb-cccc-dddd-000000000010', 'Footage Captured'),
('00000001-0002-0003-0004-000000000002', 'aaaaaaaa-bbbb-cccc-dddd-000000000010', 'aaaaaaaa-bbbb-cccc-dddd-000000000011', 'Editing Complete');

-- ============================================================================
-- 15. WORKFLOW INSTANCES (2 instances: 1 active, 1 completed)
-- ============================================================================

INSERT INTO workflow_instances (id, workflow_template_id, project_id, current_node_id, status, started_at, completed_at) VALUES
-- Active blog post workflow for Marketing Campaign project
('bbbbbbbb-cccc-dddd-eeee-000000000001', '00000001-0002-0003-0004-000000000001',
 'ffffffff-0001-0002-0003-000000000002', 'aaaaaaaa-bbbb-cccc-dddd-000000000003', 'active',
 '2025-01-20 09:00:00', NULL),

-- Completed video workflow for Brand Identity project
('bbbbbbbb-cccc-dddd-eeee-000000000002', '00000001-0002-0003-0004-000000000002',
 'ffffffff-0001-0002-0003-000000000004', 'aaaaaaaa-bbbb-cccc-dddd-000000000011', 'completed',
 '2025-01-10 08:00:00', '2025-01-22 16:00:00');

-- ============================================================================
-- 16. WORKFLOW HISTORY (transition log for completed workflow)
-- ============================================================================

INSERT INTO workflow_history (workflow_instance_id, from_node_id, to_node_id, transitioned_by, transition_type, created_at) VALUES
-- Completed video production workflow history
('bbbbbbbb-cccc-dddd-eeee-000000000002', NULL, 'aaaaaaaa-bbbb-cccc-dddd-000000000006', '11111111-1111-1111-1111-000000000002', 'normal', '2025-01-10 08:00:00'),
('bbbbbbbb-cccc-dddd-eeee-000000000002', 'aaaaaaaa-bbbb-cccc-dddd-000000000006', 'aaaaaaaa-bbbb-cccc-dddd-000000000007', '11111111-1111-1111-1111-000000000005', 'normal', '2025-01-12 10:00:00'),
('bbbbbbbb-cccc-dddd-eeee-000000000002', 'aaaaaaaa-bbbb-cccc-dddd-000000000007', 'aaaaaaaa-bbbb-cccc-dddd-000000000008', '11111111-1111-1111-1111-000000000005', 'normal', '2025-01-15 14:00:00'),
('bbbbbbbb-cccc-dddd-eeee-000000000002', 'aaaaaaaa-bbbb-cccc-dddd-000000000008', 'aaaaaaaa-bbbb-cccc-dddd-000000000009', '11111111-1111-1111-1111-000000000008', 'normal', '2025-01-16 09:00:00'),
('bbbbbbbb-cccc-dddd-eeee-000000000002', 'aaaaaaaa-bbbb-cccc-dddd-000000000009', 'aaaaaaaa-bbbb-cccc-dddd-000000000010', '11111111-1111-1111-1111-000000000005', 'normal', '2025-01-19 11:00:00'),
('bbbbbbbb-cccc-dddd-eeee-000000000002', 'aaaaaaaa-bbbb-cccc-dddd-000000000010', 'aaaaaaaa-bbbb-cccc-dddd-000000000011', '11111111-1111-1111-1111-000000000005', 'normal', '2025-01-22 16:00:00');

-- ============================================================================
-- 17. FORM TEMPLATES (2 reusable forms)
-- ============================================================================

INSERT INTO form_templates (id, name, description, schema, created_by) VALUES
('dddddddd-eeee-ffff-0001-000000000001', 'Client Intake Form',
 'Standard client onboarding questionnaire',
 '{
   "fields": [
     {
       "id": "company_name",
       "type": "text",
       "label": "Company Name",
       "required": true
     },
     {
       "id": "contact_email",
       "type": "email",
       "label": "Primary Contact Email",
       "required": true
     },
     {
       "id": "service_type",
       "type": "dropdown",
       "label": "Service Type",
       "required": true,
       "options": ["Web Development", "Marketing", "Design", "Video Production"]
     },
     {
       "id": "budget",
       "type": "number",
       "label": "Estimated Budget",
       "required": false
     },
     {
       "id": "timeline",
       "type": "text",
       "label": "Desired Timeline",
       "required": false
     }
   ]
 }'::jsonb,
 '11111111-1111-1111-1111-000000000002'),

('dddddddd-eeee-ffff-0001-000000000002', 'Project Feedback Form',
 'Collect client feedback at project milestones',
 '{
   "fields": [
     {
       "id": "satisfaction",
       "type": "dropdown",
       "label": "Overall Satisfaction",
       "required": true,
       "options": ["Very Satisfied", "Satisfied", "Neutral", "Dissatisfied", "Very Dissatisfied"]
     },
     {
       "id": "communication",
       "type": "dropdown",
       "label": "Communication Quality",
       "required": true,
       "options": ["Excellent", "Good", "Fair", "Poor"]
     },
     {
       "id": "feedback",
       "type": "textarea",
       "label": "Additional Feedback",
       "required": false,
       "placeholder": "Tell us what we can improve..."
     }
   ]
 }'::jsonb,
 '11111111-1111-1111-1111-000000000002');

-- ============================================================================
-- 18. NEWSLETTERS (3 newsletters)
-- ============================================================================

INSERT INTO newsletters (id, title, content, created_by, is_published, published_at) VALUES
('eeeeeeee-ffff-0001-0002-000000000001', 'Welcome to MovaLab!',
 'We are excited to announce the launch of MovaLab, our new project management platform.',
 '11111111-1111-1111-1111-000000000002', TRUE, '2025-01-15 10:00:00'),

('eeeeeeee-ffff-0001-0002-000000000002', 'Q1 2025 Roadmap',
 'Here is what we are planning for Q1 2025...',
 '11111111-1111-1111-1111-000000000002', FALSE, NULL),

('eeeeeeee-ffff-0001-0002-000000000003', 'Team Updates',
 'Meet our new team members and see what everyone is working on.',
 '11111111-1111-1111-1111-000000000002', FALSE, NULL);

COMMIT;

-- ============================================================================
-- SEED DATA COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Create auth.users via scripts/create-seed-users.ts
-- 2. Login with any test user (password: Test1234!)
-- 3. Explore the seeded data

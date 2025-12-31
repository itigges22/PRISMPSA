-- MovaLab Comprehensive Seed Data
-- Date: 2025-01-23
-- Description: Complete test dataset for local Docker development
--
-- Test Users (all with password: Test1234!):
-- - superadmin@test.local - Superadmin (full access)
-- - exec@test.local - Executive Director
-- - manager@test.local - Account Manager
-- - pm@test.local - Project Manager
-- - admin@test.local - Admin (workflows, roles, analytics)
-- - designer@test.local - Senior Designer
-- - dev@test.local - Senior Developer
-- - contributor@test.local - Contributor (part-time)
-- - client@test.local - Client portal access

BEGIN;

-- ============================================================================
-- CLEANUP: Truncate all tables (preserves structure)
-- ============================================================================

TRUNCATE
  workflow_active_steps,
  client_feedback,
  client_portal_invitations,
  form_responses,
  workflow_history,
  workflow_instances,
  workflow_connections,
  workflow_nodes,
  workflow_templates,
  form_templates,
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
  tasks,
  projects,
  accounts,
  user_roles,
  user_profiles,
  roles,
  departments,
  milestones
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
    "manage_updates": true,
    "view_issues": true,
    "manage_issues": true,
    "view_all_analytics": true,
    "view_all_department_analytics": true,
    "view_all_account_analytics": true,
    "view_all_capacity": true,
    "manage_all_workflows": true,
    "execute_any_workflow": true,
    "manage_time": true,
    "view_time_entries": true,
    "view_all_time_entries": true,
    "edit_own_availability": true,
    "view_newsletters": true
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
    "execute_workflows": true,
    "manage_time": true,
    "view_time_entries": true,
    "edit_own_availability": true,
    "view_newsletters": true,
    "view_departments": true
  }'::jsonb, FALSE, 70, 'Manages client accounts'),

('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Project Manager', '11111111-1111-1111-1111-111111111111',
  '{
    "view_projects": true,
    "manage_projects": true,
    "view_accounts": true,
    "manage_updates": true,
    "view_updates": true,
    "manage_issues": true,
    "view_issues": true,
    "manage_time": true,
    "view_time_entries": true,
    "execute_workflows": true,
    "edit_own_availability": true,
    "view_departments": true,
    "view_newsletters": true
  }'::jsonb, FALSE, 60, 'Manages individual projects'),

('77777777-7777-7777-7777-777777777777', 'Admin', '11111111-1111-1111-1111-111111111111',
  '{
    "manage_user_roles": true,
    "manage_users": true,
    "manage_workflows": true,
    "manage_all_workflows": true,
    "execute_any_workflow": true,
    "view_all_projects": true,
    "manage_all_projects": true,
    "view_all_accounts": true,
    "view_all_departments": true,
    "view_all_time_entries": true,
    "view_all_analytics": true,
    "view_all_department_analytics": true,
    "view_all_account_analytics": true,
    "view_all_capacity": true,
    "view_all_updates": true,
    "manage_newsletters": true,
    "view_newsletters": true,
    "manage_time": true,
    "edit_own_availability": true,
    "manage_accounts": true,
    "manage_projects": true,
    "manage_departments": true
  }'::jsonb, FALSE, 80, 'System administrator with full read access and workflow management');

-- Design Roles
INSERT INTO roles (id, name, department_id, permissions, is_system_role, hierarchy_level, description) VALUES
('10101010-1010-1010-1010-101010101010', 'Senior Designer', '33333333-3333-3333-3333-333333333333',
  '{
    "view_projects": true,
    "manage_updates": true,
    "view_updates": true,
    "manage_deliverables": true,
    "execute_workflows": true,
    "manage_time": true,
    "view_time_entries": true,
    "edit_own_availability": true,
    "view_newsletters": true,
    "view_departments": true
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
    "execute_workflows": true,
    "manage_time": true,
    "view_time_entries": true,
    "edit_own_availability": true,
    "view_newsletters": true,
    "view_departments": true
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
-- 3. USER PROFILES - SKIPPED
-- Note: User profiles are created automatically by the handle_new_user() trigger
-- when auth.users are created via scripts/create-seed-users.ts
-- The create-seed-users.ts script will also update profiles with bio/skills
-- ============================================================================

-- ============================================================================
-- 4. USER ROLES - SKIPPED
-- Note: User roles are assigned in scripts/create-seed-users.ts after users exist
-- ============================================================================

-- ============================================================================
-- NOTE: All user-dependent data moved to scripts/load-seed-data.ts
-- This includes: accounts, account_members, projects, project_assignments,
-- tasks, user_availability, time_entries, workflow_templates/instances, etc.
-- ============================================================================

COMMIT;

-- ============================================================================
-- SEED DATA PHASE 1 COMPLETE (Departments + Roles only)
-- ============================================================================
-- Run scripts/create-seed-users.ts to create users and load remaining data

-- ============================================================================
-- SEED DATA COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Create auth.users via scripts/create-seed-users.ts
-- 2. Login with any test user (password: Test1234!)
-- 3. Explore the seeded data

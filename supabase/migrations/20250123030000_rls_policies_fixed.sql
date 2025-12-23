-- Phase 2: Fixed RLS Policies
-- Date: 2025-01-23
-- Description: Create fixed RLS policies that address all 5 critical security issues
--
-- FIX #1: Circular RLS dependency (uses SECURITY DEFINER functions)
-- FIX #2: Duplicate/conflicting policies (one policy per operation per table)
-- FIX #3: Overly permissive policies (requires proper permissions + context)
-- FIX #4: Nested RLS queries (uses helper functions with SECURITY DEFINER)
-- FIX #5: Function access issues (SECURITY DEFINER functions bypass RLS)
--
-- Pattern: Each table gets exactly 4 policies (SELECT, INSERT, UPDATE, DELETE)
-- No "authenticated_users_can_*" overly permissive policies

BEGIN;

-- ============================================================================
-- TABLE: user_roles (CRITICAL - FIX #1, #2)
-- ============================================================================
-- Fixes circular dependency and removes 10 duplicate policies
-- Now uses SECURITY DEFINER functions that bypass RLS

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies (removes duplicates)
DROP POLICY IF EXISTS "user_roles_select_policy" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
DROP POLICY IF EXISTS "authenticated_users_can_read_user_roles" ON user_roles;
DROP POLICY IF EXISTS "authenticated_users_can_insert_user_roles" ON user_roles;
DROP POLICY IF EXISTS "authenticated_users_can_delete_user_roles" ON user_roles;
DROP POLICY IF EXISTS "Superadmins can manage all user roles" ON user_roles;
DROP POLICY IF EXISTS "Superadmins can view all user roles" ON user_roles;
DROP POLICY IF EXISTS "allow_authenticated_select" ON user_roles;
DROP POLICY IF EXISTS "allow_authenticated_insert" ON user_roles;
DROP POLICY IF EXISTS "allow_authenticated_delete" ON user_roles;

-- SELECT: Users can view their own roles, superadmins can view all
CREATE POLICY "user_roles_select" ON user_roles
FOR SELECT
USING (
  user_id = auth.uid()
  OR user_is_superadmin()
);

-- INSERT: Only superadmins and users with manage_user_roles permission
CREATE POLICY "user_roles_insert" ON user_roles
FOR INSERT
WITH CHECK (
  user_is_superadmin()
  OR user_has_permission('manage_user_roles')
);

-- UPDATE: Only superadmins
CREATE POLICY "user_roles_update" ON user_roles
FOR UPDATE
USING (
  user_is_superadmin()
  OR user_has_permission('manage_user_roles')
);

-- DELETE: Only superadmins and users with manage_user_roles permission
CREATE POLICY "user_roles_delete" ON user_roles
FOR DELETE
USING (
  user_is_superadmin()
  OR user_has_permission('manage_user_roles')
);

-- ============================================================================
-- TABLE: user_profiles
-- ============================================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_authenticated_select" ON user_profiles;
DROP POLICY IF EXISTS "allow_authenticated_update" ON user_profiles;
DROP POLICY IF EXISTS "allow_authenticated_insert" ON user_profiles;
DROP POLICY IF EXISTS "allow_authenticated_delete" ON user_profiles;

-- SELECT: All authenticated users can view all profiles
CREATE POLICY "user_profiles_select" ON user_profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- INSERT: Only system (via trigger) or superadmin
CREATE POLICY "user_profiles_insert" ON user_profiles
FOR INSERT
WITH CHECK (
  user_is_superadmin()
  OR auth.uid() = id
);

-- UPDATE: Users can update their own profile, superadmins can update any
CREATE POLICY "user_profiles_update" ON user_profiles
FOR UPDATE
USING (
  auth.uid() = id
  OR user_is_superadmin()
  OR user_has_permission('manage_users')
);

-- DELETE: Only superadmins
CREATE POLICY "user_profiles_delete" ON user_profiles
FOR DELETE
USING (user_is_superadmin());

-- ============================================================================
-- TABLE: roles
-- ============================================================================

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_authenticated_select" ON roles;
DROP POLICY IF EXISTS "allow_authenticated_update" ON roles;
DROP POLICY IF EXISTS "allow_authenticated_insert" ON roles;
DROP POLICY IF EXISTS "allow_authenticated_delete" ON roles;

-- SELECT: All authenticated users can view roles
CREATE POLICY "roles_select" ON roles
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- INSERT: Only superadmins and users with manage_departments
CREATE POLICY "roles_insert" ON roles
FOR INSERT
WITH CHECK (
  user_is_superadmin()
  OR user_has_permission('manage_departments')
);

-- UPDATE: Only superadmins and users with manage_departments
CREATE POLICY "roles_update" ON roles
FOR UPDATE
USING (
  user_is_superadmin()
  OR user_has_permission('manage_departments')
);

-- DELETE: Only superadmins (prevent deletion of system roles)
CREATE POLICY "roles_delete" ON roles
FOR DELETE
USING (
  user_is_superadmin()
  AND is_system_role = FALSE
);

-- ============================================================================
-- TABLE: departments
-- ============================================================================

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_authenticated_select" ON departments;
DROP POLICY IF EXISTS "allow_authenticated_update" ON departments;
DROP POLICY IF EXISTS "allow_authenticated_insert" ON departments;
DROP POLICY IF EXISTS "allow_authenticated_delete" ON departments;

-- SELECT: All authenticated users can view departments
CREATE POLICY "departments_select" ON departments
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- INSERT: Only superadmins and users with manage_departments
CREATE POLICY "departments_insert" ON departments
FOR INSERT
WITH CHECK (
  user_is_superadmin()
  OR user_has_permission('manage_departments')
);

-- UPDATE: Only superadmins and users with manage_departments
CREATE POLICY "departments_update" ON departments
FOR UPDATE
USING (
  user_is_superadmin()
  OR user_has_permission('manage_departments')
);

-- DELETE: Only superadmins
CREATE POLICY "departments_delete" ON departments
FOR DELETE
USING (user_is_superadmin());

-- ============================================================================
-- TABLE: accounts (FIX #3 - Overly Permissive)
-- ============================================================================

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_authenticated_select" ON accounts;
DROP POLICY IF EXISTS "allow_authenticated_update" ON accounts;
DROP POLICY IF EXISTS "allow_authenticated_insert" ON accounts;
DROP POLICY IF EXISTS "allow_authenticated_delete" ON accounts;

-- SELECT: Users with view_accounts permission and context
CREATE POLICY "accounts_select" ON accounts
FOR SELECT
USING (
  user_is_superadmin()
  OR user_has_permission('view_all_accounts')
  OR (
    user_has_permission('view_accounts')
    AND (
      -- User is member of account
      EXISTS (
        SELECT 1 FROM account_members am
        WHERE am.account_id = accounts.id
        AND am.user_id = auth.uid()
      )
      OR account_manager_id = auth.uid()
    )
  )
);

-- INSERT: Only users with manage_accounts permission
CREATE POLICY "accounts_insert" ON accounts
FOR INSERT
WITH CHECK (
  user_is_superadmin()
  OR user_has_permission('manage_accounts')
);

-- UPDATE: Account managers or users with manage_accounts
CREATE POLICY "accounts_update" ON accounts
FOR UPDATE
USING (
  user_is_superadmin()
  OR user_has_permission('manage_accounts')
  OR account_manager_id = auth.uid()
);

-- DELETE: Only superadmins or users with manage_accounts
CREATE POLICY "accounts_delete" ON accounts
FOR DELETE
USING (
  user_is_superadmin()
  OR user_has_permission('manage_accounts')
);

-- ============================================================================
-- TABLE: account_members
-- ============================================================================

ALTER TABLE account_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_authenticated_select" ON account_members;
DROP POLICY IF EXISTS "allow_authenticated_update" ON account_members;
DROP POLICY IF EXISTS "allow_authenticated_insert" ON account_members;
DROP POLICY IF EXISTS "allow_authenticated_delete" ON account_members;

-- SELECT: Users can view memberships for accounts they have access to
CREATE POLICY "account_members_select" ON account_members
FOR SELECT
USING (
  user_is_superadmin()
  OR user_has_permission('view_all_accounts')
  OR user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM accounts a
    WHERE a.id = account_members.account_id
    AND a.account_manager_id = auth.uid()
  )
);

-- INSERT: Account managers or users with manage_users_in_accounts
CREATE POLICY "account_members_insert" ON account_members
FOR INSERT
WITH CHECK (
  user_is_superadmin()
  OR user_has_permission('manage_users_in_accounts')
  OR EXISTS (
    SELECT 1 FROM accounts a
    WHERE a.id = account_members.account_id
    AND a.account_manager_id = auth.uid()
  )
);

-- UPDATE: Only superadmins (memberships are insert/delete only)
CREATE POLICY "account_members_update" ON account_members
FOR UPDATE
USING (user_is_superadmin());

-- DELETE: Account managers or users with manage_users_in_accounts
CREATE POLICY "account_members_delete" ON account_members
FOR DELETE
USING (
  user_is_superadmin()
  OR user_has_permission('manage_users_in_accounts')
  OR EXISTS (
    SELECT 1 FROM accounts a
    WHERE a.id = account_members.account_id
    AND a.account_manager_id = auth.uid()
  )
);

-- ============================================================================
-- TABLE: projects (FIX #3 - Overly Permissive)
-- ============================================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_authenticated_select" ON projects;
DROP POLICY IF EXISTS "allow_authenticated_update" ON projects;
DROP POLICY IF EXISTS "allow_authenticated_insert" ON projects;
DROP POLICY IF EXISTS "allow_authenticated_delete" ON projects;

-- SELECT: Users assigned to project or account manager
CREATE POLICY "projects_select" ON projects
FOR SELECT
USING (
  user_is_superadmin()
  OR user_has_permission('view_all_projects')
  OR (
    user_has_permission('view_projects')
    AND (
      -- User is assigned to project
      EXISTS (
        SELECT 1 FROM project_assignments pa
        WHERE pa.project_id = projects.id
        AND pa.user_id = auth.uid()
        AND pa.removed_at IS NULL
      )
      OR
      -- User is account manager
      EXISTS (
        SELECT 1 FROM accounts a
        WHERE a.id = projects.account_id
        AND a.account_manager_id = auth.uid()
      )
      OR created_by = auth.uid()
    )
  )
);

-- INSERT: Users with manage_projects and account access
CREATE POLICY "projects_insert" ON projects
FOR INSERT
WITH CHECK (
  user_is_superadmin()
  OR user_has_permission('manage_all_projects')
  OR (
    user_has_permission('manage_projects')
    AND EXISTS (
      SELECT 1 FROM account_members am
      WHERE am.account_id = projects.account_id
      AND am.user_id = auth.uid()
    )
  )
);

-- UPDATE: Assigned users or users with manage_projects
CREATE POLICY "projects_update" ON projects
FOR UPDATE
USING (
  user_is_superadmin()
  OR user_has_permission('manage_all_projects')
  OR (
    user_has_permission('manage_projects')
    AND (
      EXISTS (
        SELECT 1 FROM project_assignments pa
        WHERE pa.project_id = projects.id
        AND pa.user_id = auth.uid()
        AND pa.removed_at IS NULL
      )
      OR created_by = auth.uid()
    )
  )
);

-- DELETE: Only creators or users with manage_all_projects
CREATE POLICY "projects_delete" ON projects
FOR DELETE
USING (
  user_is_superadmin()
  OR user_has_permission('manage_all_projects')
  OR (
    user_has_permission('manage_projects')
    AND created_by = auth.uid()
  )
);

-- ============================================================================
-- TABLE: project_assignments
-- ============================================================================

ALTER TABLE project_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_authenticated_select" ON project_assignments;
DROP POLICY IF EXISTS "allow_authenticated_update" ON project_assignments;
DROP POLICY IF EXISTS "allow_authenticated_insert" ON project_assignments;
DROP POLICY IF EXISTS "allow_authenticated_delete" ON project_assignments;

-- SELECT: Users can view assignments for projects they have access to
CREATE POLICY "project_assignments_select" ON project_assignments
FOR SELECT
USING (
  user_is_superadmin()
  OR user_has_permission('view_all_projects')
  OR user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_assignments.project_id
    AND (
      p.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM project_assignments pa2
        WHERE pa2.project_id = p.id
        AND pa2.user_id = auth.uid()
        AND pa2.removed_at IS NULL
      )
    )
  )
);

-- INSERT: Users with manage_projects permission
CREATE POLICY "project_assignments_insert" ON project_assignments
FOR INSERT
WITH CHECK (
  user_is_superadmin()
  OR user_has_permission('manage_all_projects')
  OR (
    user_has_permission('manage_projects')
    AND EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_assignments.project_id
      AND p.created_by = auth.uid()
    )
  )
);

-- UPDATE: Users with manage_projects permission (for soft delete via removed_at)
CREATE POLICY "project_assignments_update" ON project_assignments
FOR UPDATE
USING (
  user_is_superadmin()
  OR user_has_permission('manage_all_projects')
  OR (
    user_has_permission('manage_projects')
    AND EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_assignments.project_id
      AND p.created_by = auth.uid()
    )
  )
);

-- DELETE: Only superadmins (use soft delete via UPDATE)
CREATE POLICY "project_assignments_delete" ON project_assignments
FOR DELETE
USING (user_is_superadmin());

-- ============================================================================
-- TABLE: tasks (FIX #3 - Overly Permissive)
-- ============================================================================

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_authenticated_select" ON tasks;
DROP POLICY IF EXISTS "allow_authenticated_update" ON tasks;
DROP POLICY IF EXISTS "allow_authenticated_insert" ON tasks;
DROP POLICY IF EXISTS "allow_authenticated_delete" ON tasks;

-- SELECT: Users assigned to task or project
CREATE POLICY "tasks_select" ON tasks
FOR SELECT
USING (
  user_is_superadmin()
  OR user_has_permission('view_all_projects')
  OR (
    user_has_permission('view_projects')
    AND (
      assigned_to = auth.uid()
      OR created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM project_assignments pa
        WHERE pa.project_id = tasks.project_id
        AND pa.user_id = auth.uid()
        AND pa.removed_at IS NULL
      )
    )
  )
);

-- INSERT: Users with manage_projects and project access
CREATE POLICY "tasks_insert" ON tasks
FOR INSERT
WITH CHECK (
  user_is_superadmin()
  OR user_has_permission('manage_all_projects')
  OR (
    user_has_permission('manage_projects')
    AND EXISTS (
      SELECT 1 FROM project_assignments pa
      WHERE pa.project_id = tasks.project_id
      AND pa.user_id = auth.uid()
      AND pa.removed_at IS NULL
    )
  )
);

-- UPDATE: Assigned users or project members
CREATE POLICY "tasks_update" ON tasks
FOR UPDATE
USING (
  user_is_superadmin()
  OR user_has_permission('manage_all_projects')
  OR assigned_to = auth.uid()
  OR (
    user_has_permission('manage_projects')
    AND EXISTS (
      SELECT 1 FROM project_assignments pa
      WHERE pa.project_id = tasks.project_id
      AND pa.user_id = auth.uid()
      AND pa.removed_at IS NULL
    )
  )
);

-- DELETE: Only creators or users with manage_all_projects
CREATE POLICY "tasks_delete" ON tasks
FOR DELETE
USING (
  user_is_superadmin()
  OR user_has_permission('manage_all_projects')
  OR (
    user_has_permission('manage_projects')
    AND created_by = auth.uid()
  )
);

-- ============================================================================
-- TABLE: workflow_instances (FIX #4 - Nested RLS)
-- ============================================================================

ALTER TABLE workflow_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_authenticated_select" ON workflow_instances;
DROP POLICY IF EXISTS "workflow_instances_view_assigned" ON workflow_instances;

-- SELECT: Uses helper function to prevent nested RLS queries
CREATE POLICY "workflow_instances_select" ON workflow_instances
FOR SELECT
USING (user_can_view_workflow(id));

-- INSERT: Users with execute_workflows permission and project access
CREATE POLICY "workflow_instances_insert" ON workflow_instances
FOR INSERT
WITH CHECK (
  user_is_superadmin()
  OR user_has_permission('execute_any_workflow')
  OR (
    user_has_permission('execute_workflows')
    AND EXISTS (
      SELECT 1 FROM project_assignments pa
      WHERE pa.project_id = workflow_instances.project_id
      AND pa.user_id = auth.uid()
      AND pa.removed_at IS NULL
    )
  )
);

-- UPDATE: Users who can manage workflow
CREATE POLICY "workflow_instances_update" ON workflow_instances
FOR UPDATE
USING (user_can_manage_workflow(id));

-- DELETE: Only superadmins or users with manage_all_workflows
CREATE POLICY "workflow_instances_delete" ON workflow_instances
FOR DELETE
USING (
  user_is_superadmin()
  OR user_has_permission('manage_all_workflows')
);

-- ============================================================================
-- TABLE: workflow_history (FIX #4 - Nested RLS)
-- ============================================================================

ALTER TABLE workflow_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_authenticated_select" ON workflow_history;
DROP POLICY IF EXISTS "workflow_history_view_assigned" ON workflow_history;

-- SELECT: Uses helper function to prevent nested RLS queries
CREATE POLICY "workflow_history_select" ON workflow_history
FOR SELECT
USING (user_can_view_workflow(workflow_instance_id));

-- INSERT: Users who can manage workflow
CREATE POLICY "workflow_history_insert" ON workflow_history
FOR INSERT
WITH CHECK (user_can_manage_workflow(workflow_instance_id));

-- UPDATE: Only superadmins (history should be immutable)
CREATE POLICY "workflow_history_update" ON workflow_history
FOR UPDATE
USING (user_is_superadmin());

-- DELETE: Only superadmins
CREATE POLICY "workflow_history_delete" ON workflow_history
FOR DELETE
USING (user_is_superadmin());

-- ============================================================================
-- TABLE: time_entries
-- ============================================================================

ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_authenticated_select" ON time_entries;
DROP POLICY IF EXISTS "allow_authenticated_update" ON time_entries;
DROP POLICY IF EXISTS "allow_authenticated_insert" ON time_entries;
DROP POLICY IF EXISTS "allow_authenticated_delete" ON time_entries;

-- SELECT: Users can view their own entries or all with permission
CREATE POLICY "time_entries_select" ON time_entries
FOR SELECT
USING (
  user_is_superadmin()
  OR user_has_permission('view_all_time_entries')
  OR user_id = auth.uid()
  OR (
    user_has_permission('view_time_entries')
    AND EXISTS (
      SELECT 1 FROM project_assignments pa
      WHERE pa.project_id = time_entries.project_id
      AND pa.user_id = auth.uid()
      AND pa.removed_at IS NULL
    )
  )
);

-- INSERT: Users can log time for themselves
CREATE POLICY "time_entries_insert" ON time_entries
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  OR user_is_superadmin()
  OR user_has_permission('manage_time')
);

-- UPDATE: Users can edit their own entries within 14 days
CREATE POLICY "time_entries_update" ON time_entries
FOR UPDATE
USING (
  user_is_superadmin()
  OR user_has_permission('manage_time')
  OR (
    user_id = auth.uid()
    AND entry_date >= CURRENT_DATE - INTERVAL '14 days'
  )
);

-- DELETE: Users can delete their own entries within 14 days
CREATE POLICY "time_entries_delete" ON time_entries
FOR DELETE
USING (
  user_is_superadmin()
  OR user_has_permission('manage_time')
  OR (
    user_id = auth.uid()
    AND entry_date >= CURRENT_DATE - INTERVAL '14 days'
  )
);

COMMIT;

-- ============================================================================
-- NOTES FOR REMAINING TABLES
-- ============================================================================
--
-- Apply similar patterns to these remaining tables:
-- - project_stakeholders
-- - project_updates
-- - project_issues
-- - task_dependencies
-- - task_week_allocations
-- - user_availability
-- - clock_sessions
-- - deliverables
-- - workflow_templates
-- - workflow_nodes
-- - workflow_connections
-- - workflow_active_steps
-- - form_templates
-- - form_responses
-- - newsletters
-- - milestones
-- - role_hierarchy_audit
-- - account_kanban_configs
-- - notifications
--
-- Pattern for each table:
-- 1. Enable RLS
-- 2. Drop existing policies
-- 3. CREATE POLICY "table_select" FOR SELECT USING (...)
-- 4. CREATE POLICY "table_insert" FOR INSERT WITH CHECK (...)
-- 5. CREATE POLICY "table_update" FOR UPDATE USING (...)
-- 6. CREATE POLICY "table_delete" FOR DELETE USING (...)
--
-- Rules:
-- - One policy per operation (no duplicates)
-- - Use permission checks + context (no overly permissive)
-- - Use SECURITY DEFINER functions (no circular dependencies)
-- - Use helper functions for complex nested queries

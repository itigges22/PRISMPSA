-- Phase 5: Fix RLS Infinite Recursion
-- Date: 2025-01-23
-- Description: Fix circular dependencies in RLS policies
--
-- PROBLEMS FIXED:
--   1. accounts_select ↔ account_members_select (circular)
--   2. project_assignments_select → projects → project_assignments (circular)
--   3. projects_select → project_assignments (one-way but causing issues)
--
-- SOLUTION:
--   Create SECURITY DEFINER helper functions that bypass RLS
--   These functions can safely query related tables without triggering their RLS policies

BEGIN;

-- ============================================================================
-- FUNCTION: user_is_account_member (NEW)
-- ============================================================================
-- Checks if current user is a member of a specific account
-- SECURITY DEFINER: Bypasses RLS to prevent circular dependency

CREATE OR REPLACE FUNCTION user_is_account_member(check_account_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.account_members
    WHERE account_id = check_account_id
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp;

COMMENT ON FUNCTION user_is_account_member(uuid) IS
'Checks if the current user is a member of a specific account. Uses SECURITY DEFINER to bypass RLS and prevent circular dependency.';

-- ============================================================================
-- FUNCTION: user_is_account_manager (NEW)
-- ============================================================================
-- Checks if current user is the account manager for a specific account
-- SECURITY DEFINER: Bypasses RLS to prevent circular dependency

CREATE OR REPLACE FUNCTION user_is_account_manager(check_account_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.accounts
    WHERE id = check_account_id
    AND account_manager_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp;

COMMENT ON FUNCTION user_is_account_manager(uuid) IS
'Checks if the current user is the account manager for a specific account. Uses SECURITY DEFINER to bypass RLS and prevent circular dependency.';

-- ============================================================================
-- FUNCTION: user_is_project_assigned (NEW)
-- ============================================================================
-- Checks if current user is assigned to a specific project
-- SECURITY DEFINER: Bypasses RLS to prevent circular dependency

CREATE OR REPLACE FUNCTION user_is_project_assigned(check_project_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.project_assignments
    WHERE project_id = check_project_id
    AND user_id = auth.uid()
    AND removed_at IS NULL
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp;

COMMENT ON FUNCTION user_is_project_assigned(uuid) IS
'Checks if the current user is assigned to a specific project. Uses SECURITY DEFINER to bypass RLS and prevent circular dependency.';

-- ============================================================================
-- FUNCTION: user_is_project_creator (NEW)
-- ============================================================================
-- Checks if current user created a specific project
-- SECURITY DEFINER: Bypasses RLS to prevent circular dependency

CREATE OR REPLACE FUNCTION user_is_project_creator(check_project_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = check_project_id
    AND created_by = auth.uid()
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp;

COMMENT ON FUNCTION user_is_project_creator(uuid) IS
'Checks if the current user created a specific project. Uses SECURITY DEFINER to bypass RLS and prevent circular dependency.';

-- ============================================================================
-- FUNCTION: user_can_access_project (NEW)
-- ============================================================================
-- Comprehensive check if user can access a project
-- SECURITY DEFINER: Bypasses RLS to prevent circular dependency

CREATE OR REPLACE FUNCTION user_can_access_project(check_project_id uuid)
RETURNS boolean AS $$
DECLARE
  proj_account_id uuid;
BEGIN
  -- Get the project's account_id
  SELECT account_id INTO proj_account_id
  FROM public.projects
  WHERE id = check_project_id;

  -- Check access: assigned, creator, or account manager
  RETURN (
    user_is_project_assigned(check_project_id)
    OR user_is_project_creator(check_project_id)
    OR (proj_account_id IS NOT NULL AND user_is_account_manager(proj_account_id))
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp;

COMMENT ON FUNCTION user_can_access_project(uuid) IS
'Checks if the current user can access a specific project (assigned, creator, or account manager). Uses SECURITY DEFINER to bypass RLS.';

-- ============================================================================
-- FIX: accounts table policies
-- ============================================================================

DROP POLICY IF EXISTS "accounts_select" ON accounts;
DROP POLICY IF EXISTS "accounts_insert" ON accounts;
DROP POLICY IF EXISTS "accounts_update" ON accounts;
DROP POLICY IF EXISTS "accounts_delete" ON accounts;

-- SELECT: Users with view_accounts permission and context
-- Uses SECURITY DEFINER function to avoid recursion
CREATE POLICY "accounts_select" ON accounts
FOR SELECT
USING (
  user_is_superadmin()
  OR user_has_permission('view_all_accounts')
  OR (
    user_has_permission('view_accounts')
    AND (
      -- Use SECURITY DEFINER function instead of direct query
      user_is_account_member(id)
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
-- FIX: account_members table policies
-- ============================================================================

DROP POLICY IF EXISTS "account_members_select" ON account_members;
DROP POLICY IF EXISTS "account_members_insert" ON account_members;
DROP POLICY IF EXISTS "account_members_update" ON account_members;
DROP POLICY IF EXISTS "account_members_delete" ON account_members;

-- SELECT: Users can view memberships for accounts they have access to
-- Uses SECURITY DEFINER function to avoid recursion
CREATE POLICY "account_members_select" ON account_members
FOR SELECT
USING (
  user_is_superadmin()
  OR user_has_permission('view_all_accounts')
  OR user_id = auth.uid()
  -- Use SECURITY DEFINER function instead of direct query
  OR user_is_account_manager(account_id)
);

-- INSERT: Account managers or users with manage_users_in_accounts
CREATE POLICY "account_members_insert" ON account_members
FOR INSERT
WITH CHECK (
  user_is_superadmin()
  OR user_has_permission('manage_users_in_accounts')
  -- Use SECURITY DEFINER function
  OR user_is_account_manager(account_id)
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
  -- Use SECURITY DEFINER function
  OR user_is_account_manager(account_id)
);

-- ============================================================================
-- FIX: projects table policies (also references accounts)
-- ============================================================================

DROP POLICY IF EXISTS "projects_select" ON projects;

-- SELECT: Users can view projects they have access to
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
      -- User is account manager - use SECURITY DEFINER function
      user_is_account_manager(account_id)
      OR created_by = auth.uid()
    )
  )
);

-- ============================================================================
-- FIX: project_assignments table policies
-- ============================================================================

DROP POLICY IF EXISTS "project_assignments_select" ON project_assignments;
DROP POLICY IF EXISTS "project_assignments_insert" ON project_assignments;
DROP POLICY IF EXISTS "project_assignments_update" ON project_assignments;
DROP POLICY IF EXISTS "project_assignments_delete" ON project_assignments;

-- SELECT: Users can view assignments for projects they have access to
-- Uses SECURITY DEFINER functions to avoid recursion
CREATE POLICY "project_assignments_select" ON project_assignments
FOR SELECT
USING (
  user_is_superadmin()
  OR user_has_permission('view_all_projects')
  OR user_id = auth.uid()
  -- Use SECURITY DEFINER function instead of nested queries
  OR user_is_project_creator(project_id)
  OR user_is_project_assigned(project_id)
);

-- INSERT: Users with manage_projects permission and project access
CREATE POLICY "project_assignments_insert" ON project_assignments
FOR INSERT
WITH CHECK (
  user_is_superadmin()
  OR user_has_permission('manage_all_projects')
  OR (
    user_has_permission('manage_projects')
    -- Use SECURITY DEFINER function
    AND user_is_project_creator(project_id)
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
    -- Use SECURITY DEFINER function
    AND user_is_project_creator(project_id)
  )
);

-- DELETE: Only superadmins (use soft delete via UPDATE)
CREATE POLICY "project_assignments_delete" ON project_assignments
FOR DELETE
USING (user_is_superadmin());

-- ============================================================================
-- FIX: tasks table policies (also references project_assignments)
-- ============================================================================

DROP POLICY IF EXISTS "tasks_select" ON tasks;
DROP POLICY IF EXISTS "tasks_insert" ON tasks;
DROP POLICY IF EXISTS "tasks_update" ON tasks;
DROP POLICY IF EXISTS "tasks_delete" ON tasks;

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
      -- Use SECURITY DEFINER function
      OR user_is_project_assigned(project_id)
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
    -- Use SECURITY DEFINER function
    AND user_is_project_assigned(project_id)
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
    -- Use SECURITY DEFINER function
    AND user_is_project_assigned(project_id)
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
-- FIX: time_entries table policies
-- ============================================================================

DROP POLICY IF EXISTS "time_entries_select" ON time_entries;

-- SELECT: Users can view their own entries or all with permission
CREATE POLICY "time_entries_select" ON time_entries
FOR SELECT
USING (
  user_is_superadmin()
  OR user_has_permission('view_all_time_entries')
  OR user_id = auth.uid()
  OR (
    user_has_permission('view_time_entries')
    -- Use SECURITY DEFINER function
    AND user_is_project_assigned(project_id)
  )
);

-- ============================================================================
-- FIX: workflow_instances table policies
-- ============================================================================

DROP POLICY IF EXISTS "workflow_instances_insert" ON workflow_instances;

-- INSERT: Users with execute_workflows permission and project access
CREATE POLICY "workflow_instances_insert" ON workflow_instances
FOR INSERT
WITH CHECK (
  user_is_superadmin()
  OR user_has_permission('execute_any_workflow')
  OR (
    user_has_permission('execute_workflows')
    -- Use SECURITY DEFINER function
    AND user_is_project_assigned(project_id)
  )
);

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
--
-- Test 1: Verify new functions exist
-- SELECT routine_name FROM information_schema.routines
-- WHERE routine_schema = 'public'
-- AND routine_name IN ('user_is_account_member', 'user_is_account_manager');
-- Expected: 2 rows
--
-- Test 2: Verify SECURITY DEFINER is set
-- SELECT proname, prosecdef FROM pg_proc p
-- JOIN pg_namespace n ON p.pronamespace = n.oid
-- WHERE n.nspname = 'public'
-- AND proname IN ('user_is_account_member', 'user_is_account_manager')
-- AND prosecdef = true;
-- Expected: 2 rows

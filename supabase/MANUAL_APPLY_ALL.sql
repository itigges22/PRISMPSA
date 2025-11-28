-- ================================================================================
-- PRISM RBAC - Complete Migration (Manual Application)
-- ================================================================================
-- INSTRUCTIONS:
-- 1. Go to: https://supabase.com/dashboard/project/oomnezdhkmsfjlihkmui/sql
-- 2. Click "New Query"
-- 3. Copy this ENTIRE file
-- 4. Paste into the query editor
-- 5. Click "Run" (or press Cmd/Ctrl + Enter)
-- 6. Check for any errors in the output
-- ================================================================================

-- ================================================================================
-- PART 1: CREATE PROJECT_ASSIGNMENTS TABLE (if not exists)
-- ================================================================================

CREATE TABLE IF NOT EXISTS public.project_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    role_in_project TEXT,
    assigned_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    assigned_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    removed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_assignments_unique_active
ON public.project_assignments(project_id, user_id)
WHERE removed_at IS NULL;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_project_assignments_project_id ON public.project_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_assignments_user_id ON public.project_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_project_assignments_removed_at ON public.project_assignments(removed_at);

-- ================================================================================
-- PART 2: RLS HELPER FUNCTIONS
-- ================================================================================

-- Function: Get user's role IDs
CREATE OR REPLACE FUNCTION auth.get_user_role_ids()
RETURNS UUID[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT role_id 
    FROM user_roles 
    WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function: Check if user is superadmin
CREATE OR REPLACE FUNCTION auth.user_is_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Check is_superadmin flag first
  IF EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() AND is_superadmin = TRUE
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user has Superadmin role
  RETURN EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND LOWER(r.name) = 'superadmin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function: Check if user has a specific permission
CREATE OR REPLACE FUNCTION auth.user_has_permission(permission_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Superadmin has all permissions
  IF auth.user_is_superadmin() THEN
    RETURN TRUE;
  END IF;
  
  -- Check if any of user's roles have this permission
  RETURN EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND (r.permissions->permission_name)::boolean = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function: Check if user is assigned to a project
CREATE OR REPLACE FUNCTION auth.user_assigned_to_project(project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM project_assignments
    WHERE user_id = auth.uid()
    AND project_assignments.project_id = user_assigned_to_project.project_id
    AND removed_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function: Check if user manages a department
CREATE OR REPLACE FUNCTION auth.user_manages_department(dept_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.department_id = dept_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function: Check if user has access to an account
CREATE OR REPLACE FUNCTION auth.user_has_account_access(account_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM project_assignments pa
    JOIN projects p ON pa.project_id = p.id
    WHERE pa.user_id = auth.uid()
    AND p.account_id = user_has_account_access.account_id
    AND pa.removed_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function: Get user's department IDs
CREATE OR REPLACE FUNCTION auth.get_user_department_ids()
RETURNS UUID[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT DISTINCT r.department_id
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function: Comprehensive project view check
CREATE OR REPLACE FUNCTION auth.can_view_project(project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Superadmin can view all
  IF auth.user_is_superadmin() THEN
    RETURN TRUE;
  END IF;
  
  -- Has VIEW_ALL_PROJECTS permission
  IF auth.user_has_permission('view_all_projects') THEN
    RETURN TRUE;
  END IF;
  
  -- Must have base VIEW_PROJECTS permission
  IF NOT auth.user_has_permission('view_projects') THEN
    RETURN FALSE;
  END IF;
  
  -- Is assigned to the project
  IF auth.user_assigned_to_project(project_id) THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function: Check if user can edit a project
CREATE OR REPLACE FUNCTION auth.can_edit_project(project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Superadmin can edit all
  IF auth.user_is_superadmin() THEN
    RETURN TRUE;
  END IF;
  
  -- Has EDIT_ALL_PROJECTS permission
  IF auth.user_has_permission('edit_all_projects') THEN
    RETURN TRUE;
  END IF;
  
  -- Must have base EDIT_PROJECT permission
  IF NOT auth.user_has_permission('edit_project') THEN
    RETURN FALSE;
  END IF;
  
  -- Is assigned to the project
  RETURN auth.user_assigned_to_project(project_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function: Check if user can delete a project
CREATE OR REPLACE FUNCTION auth.can_delete_project(project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Superadmin can delete all
  IF auth.user_is_superadmin() THEN
    RETURN TRUE;
  END IF;
  
  -- Has DELETE_ALL_PROJECTS permission
  IF auth.user_has_permission('delete_all_projects') THEN
    RETURN TRUE;
  END IF;
  
  -- Must have base DELETE_PROJECT permission
  IF NOT auth.user_has_permission('delete_project') THEN
    RETURN FALSE;
  END IF;
  
  -- Is assigned to the project
  RETURN auth.user_assigned_to_project(project_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant permissions
GRANT EXECUTE ON FUNCTION auth.get_user_role_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.user_is_superadmin() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.user_has_permission(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION auth.user_assigned_to_project(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION auth.user_manages_department(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION auth.user_has_account_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION auth.get_user_department_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.can_view_project(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION auth.can_edit_project(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION auth.can_delete_project(UUID) TO authenticated;

-- ================================================================================
-- PART 3: ROW-LEVEL SECURITY POLICIES
-- ================================================================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliverables ENABLE ROW LEVEL SECURITY;

-- USER_PROFILES POLICIES
DROP POLICY IF EXISTS "user_profiles_select_policy" ON user_profiles;
CREATE POLICY "user_profiles_select_policy" ON user_profiles
  FOR SELECT
  USING (
    auth.uid() = id
    OR auth.user_is_superadmin()
    OR auth.user_has_permission('view_users')
  );

DROP POLICY IF EXISTS "user_profiles_update_policy" ON user_profiles;
CREATE POLICY "user_profiles_update_policy" ON user_profiles
  FOR UPDATE
  USING (
    auth.uid() = id
    OR auth.user_is_superadmin()
    OR auth.user_has_permission('edit_users')
  );

-- ROLES POLICIES
DROP POLICY IF EXISTS "roles_select_policy" ON roles;
CREATE POLICY "roles_select_policy" ON roles
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "roles_insert_policy" ON roles;
CREATE POLICY "roles_insert_policy" ON roles
  FOR INSERT
  WITH CHECK (auth.user_has_permission('create_role'));

DROP POLICY IF EXISTS "roles_update_policy" ON roles;
CREATE POLICY "roles_update_policy" ON roles
  FOR UPDATE
  USING (
    auth.user_has_permission('edit_role')
    AND NOT is_system_role
  );

DROP POLICY IF EXISTS "roles_delete_policy" ON roles;
CREATE POLICY "roles_delete_policy" ON roles
  FOR DELETE
  USING (
    auth.user_has_permission('delete_role')
    AND NOT is_system_role
  );

-- USER_ROLES POLICIES
DROP POLICY IF EXISTS "user_roles_select_policy" ON user_roles;
CREATE POLICY "user_roles_select_policy" ON user_roles
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR auth.user_is_superadmin()
    OR auth.user_has_permission('view_users')
  );

DROP POLICY IF EXISTS "user_roles_insert_policy" ON user_roles;
CREATE POLICY "user_roles_insert_policy" ON user_roles
  FOR INSERT
  WITH CHECK (auth.user_has_permission('assign_users_to_roles'));

DROP POLICY IF EXISTS "user_roles_delete_policy" ON user_roles;
CREATE POLICY "user_roles_delete_policy" ON user_roles
  FOR DELETE
  USING (auth.user_has_permission('remove_users_from_roles'));

-- DEPARTMENTS POLICIES
DROP POLICY IF EXISTS "departments_select_policy" ON departments;
CREATE POLICY "departments_select_policy" ON departments
  FOR SELECT
  USING (
    auth.user_is_superadmin()
    OR auth.user_has_permission('view_all_departments')
    OR auth.user_manages_department(id)
  );

DROP POLICY IF EXISTS "departments_insert_policy" ON departments;
CREATE POLICY "departments_insert_policy" ON departments
  FOR INSERT
  WITH CHECK (auth.user_has_permission('create_department'));

DROP POLICY IF EXISTS "departments_update_policy" ON departments;
CREATE POLICY "departments_update_policy" ON departments
  FOR UPDATE
  USING (auth.user_has_permission('edit_department'));

DROP POLICY IF EXISTS "departments_delete_policy" ON departments;
CREATE POLICY "departments_delete_policy" ON departments
  FOR DELETE
  USING (auth.user_has_permission('delete_department'));

-- ACCOUNTS POLICIES
DROP POLICY IF EXISTS "accounts_select_policy" ON accounts;
CREATE POLICY "accounts_select_policy" ON accounts
  FOR SELECT
  USING (
    auth.user_is_superadmin()
    OR auth.user_has_permission('view_all_accounts')
    OR auth.user_has_account_access(id)
  );

DROP POLICY IF EXISTS "accounts_insert_policy" ON accounts;
CREATE POLICY "accounts_insert_policy" ON accounts
  FOR INSERT
  WITH CHECK (auth.user_has_permission('create_account'));

DROP POLICY IF EXISTS "accounts_update_policy" ON accounts;
CREATE POLICY "accounts_update_policy" ON accounts
  FOR UPDATE
  USING (auth.user_has_permission('edit_account'));

DROP POLICY IF EXISTS "accounts_delete_policy" ON accounts;
CREATE POLICY "accounts_delete_policy" ON accounts
  FOR DELETE
  USING (auth.user_has_permission('delete_account'));

-- PROJECTS POLICIES
DROP POLICY IF EXISTS "projects_select_policy" ON projects;
CREATE POLICY "projects_select_policy" ON projects
  FOR SELECT
  USING (auth.can_view_project(id));

DROP POLICY IF EXISTS "projects_insert_policy" ON projects;
CREATE POLICY "projects_insert_policy" ON projects
  FOR INSERT
  WITH CHECK (auth.user_has_permission('create_project'));

DROP POLICY IF EXISTS "projects_update_policy" ON projects;
CREATE POLICY "projects_update_policy" ON projects
  FOR UPDATE
  USING (auth.can_edit_project(id));

DROP POLICY IF EXISTS "projects_delete_policy" ON projects;
CREATE POLICY "projects_delete_policy" ON projects
  FOR DELETE
  USING (auth.can_delete_project(id));

-- PROJECT_ASSIGNMENTS POLICIES
DROP POLICY IF EXISTS "project_assignments_select_policy" ON project_assignments;
CREATE POLICY "project_assignments_select_policy" ON project_assignments
  FOR SELECT
  USING (auth.can_view_project(project_id));

DROP POLICY IF EXISTS "project_assignments_insert_policy" ON project_assignments;
CREATE POLICY "project_assignments_insert_policy" ON project_assignments
  FOR INSERT
  WITH CHECK (
    auth.user_has_permission('assign_project_users')
    AND auth.can_edit_project(project_id)
  );

DROP POLICY IF EXISTS "project_assignments_update_policy" ON project_assignments;
CREATE POLICY "project_assignments_update_policy" ON project_assignments
  FOR UPDATE
  USING (
    auth.user_has_permission('assign_project_users')
    AND auth.can_edit_project(project_id)
  );

DROP POLICY IF EXISTS "project_assignments_delete_policy" ON project_assignments;
CREATE POLICY "project_assignments_delete_policy" ON project_assignments
  FOR DELETE
  USING (
    auth.user_has_permission('remove_project_users')
    AND auth.can_edit_project(project_id)
  );

-- TASKS POLICIES
DROP POLICY IF EXISTS "tasks_select_policy" ON tasks;
CREATE POLICY "tasks_select_policy" ON tasks
  FOR SELECT
  USING (
    auth.user_has_permission('view_tasks')
    AND auth.can_view_project(project_id)
  );

DROP POLICY IF EXISTS "tasks_insert_policy" ON tasks;
CREATE POLICY "tasks_insert_policy" ON tasks
  FOR INSERT
  WITH CHECK (
    auth.user_has_permission('create_task')
    AND auth.can_edit_project(project_id)
  );

DROP POLICY IF EXISTS "tasks_update_policy" ON tasks;
CREATE POLICY "tasks_update_policy" ON tasks
  FOR UPDATE
  USING (
    auth.user_has_permission('edit_task')
    AND auth.can_edit_project(project_id)
  );

DROP POLICY IF EXISTS "tasks_delete_policy" ON tasks;
CREATE POLICY "tasks_delete_policy" ON tasks
  FOR DELETE
  USING (
    auth.user_has_permission('delete_task')
    AND auth.can_edit_project(project_id)
  );

-- DELIVERABLES POLICIES
DROP POLICY IF EXISTS "deliverables_select_policy" ON deliverables;
CREATE POLICY "deliverables_select_policy" ON deliverables
  FOR SELECT
  USING (
    auth.user_has_permission('view_deliverables')
    AND auth.can_view_project(project_id)
  );

DROP POLICY IF EXISTS "deliverables_insert_policy" ON deliverables;
CREATE POLICY "deliverables_insert_policy" ON deliverables
  FOR INSERT
  WITH CHECK (
    auth.user_has_permission('upload_deliverable')
    AND auth.can_edit_project(project_id)
  );

DROP POLICY IF EXISTS "deliverables_update_policy" ON deliverables;
CREATE POLICY "deliverables_update_policy" ON deliverables
  FOR UPDATE
  USING (
    (auth.user_has_permission('edit_deliverable') OR auth.user_has_permission('approve_content'))
    AND auth.can_edit_project(project_id)
  );

DROP POLICY IF EXISTS "deliverables_delete_policy" ON deliverables;
CREATE POLICY "deliverables_delete_policy" ON deliverables
  FOR DELETE
  USING (
    auth.user_has_permission('delete_deliverable')
    AND auth.can_edit_project(project_id)
  );

-- ================================================================================
-- VERIFICATION QUERIES - Run these after applying
-- ================================================================================
-- SELECT * FROM auth.user_is_superadmin();
-- SELECT * FROM auth.user_has_permission('create_project');
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
-- ================================================================================


-- ================================================================================
-- FIX RLS POLICIES - Ensure all helper functions exist and policies are correct
-- ================================================================================
-- This script fixes RLS policy issues by ensuring functions exist in the correct schema
-- Run this in Supabase SQL Editor if RLS policies are failing
-- ================================================================================

-- Step 1: Ensure helper functions exist in PUBLIC schema (for RLS policies)
-- ================================================================================

-- Function: Check if user is superadmin
CREATE OR REPLACE FUNCTION public.user_is_superadmin()
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
    AND (r.is_system_role = TRUE AND LOWER(r.name) = 'superadmin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function: Check if user has a specific permission
CREATE OR REPLACE FUNCTION public.user_has_permission(permission_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Superadmin has all permissions
  IF public.user_is_superadmin() THEN
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

-- Function: Check if user can edit a role
CREATE OR REPLACE FUNCTION public.user_can_edit_role(role_id UUID)
RETURNS BOOLEAN AS $$
DECLARE 
  is_system BOOLEAN;
BEGIN
  SELECT is_system_role INTO is_system FROM roles WHERE id = role_id;
  IF is_system THEN 
    RETURN FALSE; 
  END IF;
  RETURN public.user_has_permission('edit_role');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function: Check if user can delete a role
CREATE OR REPLACE FUNCTION public.user_can_delete_role(role_id UUID)
RETURNS BOOLEAN AS $$
DECLARE 
  is_system BOOLEAN;
BEGIN
  SELECT is_system_role INTO is_system FROM roles WHERE id = role_id;
  IF is_system THEN 
    RETURN FALSE; 
  END IF;
  RETURN public.user_has_permission('delete_role');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function: Check if user can view user profile
CREATE OR REPLACE FUNCTION public.user_can_view_user_profile(profile_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Can view own profile
  IF auth.uid() = profile_id THEN
    RETURN TRUE;
  END IF;
  
  -- Check if same department
  RETURN EXISTS (
    SELECT 1
    FROM user_roles ur1
    JOIN roles r1 ON ur1.role_id = r1.id
    JOIN user_roles ur2 ON ur2.role_id = r1.id
    WHERE ur1.user_id = auth.uid()
    AND ur2.user_id = profile_id
    AND r1.department_id IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function: Check if user is assigned to a project
CREATE OR REPLACE FUNCTION public.user_assigned_to_project(project_id UUID)
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
CREATE OR REPLACE FUNCTION public.user_manages_department(dept_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.department_id = dept_id
    AND (
      (r.permissions->'manage_department_settings')::boolean = TRUE
      OR (r.permissions->'manage_department_tasks')::boolean = TRUE
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function: Check if user is in a department
CREATE OR REPLACE FUNCTION public.user_in_department(dept_id UUID)
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

-- Function: Check if user has account access
CREATE OR REPLACE FUNCTION public.user_has_account_access(account_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM project_assignments pa
    JOIN projects p ON p.id = pa.project_id
    WHERE pa.user_id = auth.uid()
    AND p.account_id = account_id
    AND pa.removed_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.user_is_superadmin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_permission(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_edit_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_delete_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_view_user_profile(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_assigned_to_project(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_manages_department(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_in_department(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_account_access(UUID) TO authenticated;

-- Step 2: Fix RLS Policies to use PUBLIC schema functions
-- ================================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "roles_select_policy" ON roles;
DROP POLICY IF EXISTS "roles_insert_policy" ON roles;
DROP POLICY IF EXISTS "roles_update_policy" ON roles;
DROP POLICY IF EXISTS "roles_delete_policy" ON roles;

-- Create fixed policies using PUBLIC schema functions
CREATE POLICY "roles_select_policy" ON roles
  FOR SELECT
  USING (
    public.user_has_permission('view_roles')
    OR public.user_is_superadmin()
  );

CREATE POLICY "roles_insert_policy" ON roles
  FOR INSERT
  WITH CHECK (
    public.user_has_permission('create_role') 
    AND is_system_role = FALSE
  );

CREATE POLICY "roles_update_policy" ON roles
  FOR UPDATE
  USING (public.user_can_edit_role(id));

CREATE POLICY "roles_delete_policy" ON roles
  FOR DELETE
  USING (public.user_can_delete_role(id));

-- Fix user_roles policies
DROP POLICY IF EXISTS "user_roles_select_policy" ON user_roles;
CREATE POLICY "user_roles_select_policy" ON user_roles
  FOR SELECT
  USING (
    user_id = auth.uid() 
    OR public.user_is_superadmin()
    OR public.user_has_permission('view_users')
    OR public.user_has_permission('manage_users')
  );

-- Fix user_profiles policies
DROP POLICY IF EXISTS "user_profiles_select_policy" ON user_profiles;
CREATE POLICY "user_profiles_select_policy" ON user_profiles
  FOR SELECT
  USING (
    id = auth.uid()
    OR public.user_is_superadmin()
    OR public.user_has_permission('view_users')
    OR public.user_can_view_user_profile(id)
  );

DROP POLICY IF EXISTS "user_profiles_update_policy" ON user_profiles;
CREATE POLICY "user_profiles_update_policy" ON user_profiles
  FOR UPDATE
  USING (
    id = auth.uid()
    OR public.user_is_superadmin()
    OR public.user_has_permission('edit_users')
  );

-- Fix departments policies
DROP POLICY IF EXISTS "departments_select_policy" ON departments;
CREATE POLICY "departments_select_policy" ON departments
  FOR SELECT
  USING (
    public.user_in_department(id)
    OR public.user_has_permission('view_departments')
    OR public.user_has_permission('view_all_departments')
    OR public.user_is_superadmin()
  );

-- Fix projects policies
DROP POLICY IF EXISTS "projects_select_policy" ON projects;
CREATE POLICY "projects_select_policy" ON projects
  FOR SELECT
  USING (
    public.user_assigned_to_project(id)
    OR public.user_has_account_access(account_id)
    OR public.user_has_permission('view_all_projects')
    OR public.user_is_superadmin()
  );

DROP POLICY IF EXISTS "projects_update_policy" ON projects;
CREATE POLICY "projects_update_policy" ON projects
  FOR UPDATE
  USING (
    (public.user_assigned_to_project(id) AND public.user_has_permission('edit_project'))
    OR public.user_has_permission('edit_all_projects')
    OR public.user_is_superadmin()
  );

DROP POLICY IF EXISTS "projects_delete_policy" ON projects;
CREATE POLICY "projects_delete_policy" ON projects
  FOR DELETE
  USING (
    (public.user_assigned_to_project(id) AND public.user_has_permission('delete_project'))
    OR public.user_has_permission('delete_all_projects')
    OR public.user_is_superadmin()
  );

-- Fix accounts policies
DROP POLICY IF EXISTS "accounts_select_policy" ON accounts;
CREATE POLICY "accounts_select_policy" ON accounts
  FOR SELECT
  USING (
    public.user_has_account_access(id)
    OR public.user_has_permission('view_accounts')
    OR public.user_has_permission('view_all_accounts')
    OR public.user_is_superadmin()
  );

DROP POLICY IF EXISTS "accounts_insert_policy" ON accounts;
CREATE POLICY "accounts_insert_policy" ON accounts
  FOR INSERT
  WITH CHECK (
    public.user_has_permission('create_account')
    OR public.user_is_superadmin()
  );

DROP POLICY IF EXISTS "accounts_update_policy" ON accounts;
CREATE POLICY "accounts_update_policy" ON accounts
  FOR UPDATE
  USING (
    (public.user_has_account_access(id) AND public.user_has_permission('edit_account'))
    OR public.user_has_permission('manage_accounts')
    OR public.user_is_superadmin()
  );

DROP POLICY IF EXISTS "accounts_delete_policy" ON accounts;
CREATE POLICY "accounts_delete_policy" ON accounts
  FOR DELETE
  USING (
    public.user_has_permission('delete_account')
    OR public.user_has_permission('manage_accounts')
    OR public.user_is_superadmin()
  );

-- Fix user_roles insert/delete policies to check proper permissions
DROP POLICY IF EXISTS "user_roles_insert_policy" ON user_roles;
CREATE POLICY "user_roles_insert_policy" ON user_roles
  FOR INSERT
  WITH CHECK (
    public.user_has_permission('assign_users_to_roles')
    OR public.user_is_superadmin()
  );

DROP POLICY IF EXISTS "user_roles_delete_policy" ON user_roles;
CREATE POLICY "user_roles_delete_policy" ON user_roles
  FOR DELETE
  USING (
    public.user_has_permission('remove_users_from_roles')
    OR public.user_is_superadmin()
  );

-- Fix departments insert/update/delete policies
DROP POLICY IF EXISTS "departments_insert_policy" ON departments;
CREATE POLICY "departments_insert_policy" ON departments
  FOR INSERT
  WITH CHECK (
    public.user_has_permission('create_department')
    OR public.user_is_superadmin()
  );

DROP POLICY IF EXISTS "departments_update_policy" ON departments;
CREATE POLICY "departments_update_policy" ON departments
  FOR UPDATE
  USING (
    (public.user_in_department(id) AND public.user_has_permission('edit_department'))
    OR public.user_has_permission('manage_department_settings')
    OR public.user_is_superadmin()
  );

DROP POLICY IF EXISTS "departments_delete_policy" ON departments;
CREATE POLICY "departments_delete_policy" ON departments
  FOR DELETE
  USING (
    public.user_has_permission('delete_department')
    OR public.user_is_superadmin()
  );

-- Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('user_profiles', 'roles', 'user_roles', 'departments', 'accounts', 'projects')
ORDER BY tablename;

SELECT 'RLS policies fixed successfully!' AS status;


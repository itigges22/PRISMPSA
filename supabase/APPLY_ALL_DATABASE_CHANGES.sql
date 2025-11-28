-- ================================================================================
-- PRISM RBAC SYSTEM - COMPLETE DATABASE SETUP
-- ================================================================================
-- This file applies ALL database changes in the correct order:
-- 1. Schema changes (new columns, tables, indexes)
-- 2. System role seeding
-- 3. RLS helper functions  
-- 4. RLS policies
--
-- INSTRUCTIONS:
-- 1. Go to: https://supabase.com/dashboard/project/oomnezdhkmsfjlihkmui/sql
-- 2. Click "New Query"
-- 3. Copy and paste this ENTIRE file
-- 4. Click "Run" (Cmd/Ctrl + Enter)
-- 5. Verify success in output
-- ================================================================================

\echo '================================================================================';
\echo 'STEP 1: Applying schema changes...';
\echo '================================================================================';

-- Add columns to roles table
ALTER TABLE roles
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS is_system_role BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS hierarchy_level INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS reporting_role_id UUID REFERENCES roles(id) ON DELETE SET NULL;

-- Add foreign key constraint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'roles_reporting_role_id_fkey') THEN
        ALTER TABLE roles ADD CONSTRAINT roles_reporting_role_id_fkey
        FOREIGN KEY (reporting_role_id) REFERENCES roles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add superadmin flag to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN DEFAULT FALSE NOT NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_roles_department_id ON roles(department_id);
CREATE INDEX IF NOT EXISTS idx_roles_reporting_role_id ON roles(reporting_role_id);
CREATE INDEX IF NOT EXISTS idx_roles_is_system_role ON roles(is_system_role);
CREATE INDEX IF NOT EXISTS idx_roles_display_order ON roles(display_order);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_superadmin ON user_profiles(is_superadmin);
CREATE INDEX IF NOT EXISTS idx_projects_account_id ON projects(account_id);
CREATE INDEX IF NOT EXISTS idx_projects_assigned_user_id ON projects(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_project_id ON deliverables(project_id);

-- Create project_assignments table
CREATE TABLE IF NOT EXISTS project_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    role_in_project TEXT,
    assigned_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    assigned_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    removed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_assignments_project_id ON project_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_assignments_user_id ON project_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_project_assignments_removed_at ON project_assignments(removed_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_assignments_unique_active
ON project_assignments(project_id, user_id) WHERE removed_at IS NULL;

\echo 'Schema changes applied successfully!';
\echo '';
\echo '================================================================================';
\echo 'STEP 2: Seeding system roles...';
\echo '================================================================================';

-- Mark Superadmin as system role
UPDATE roles
SET is_system_role = TRUE, hierarchy_level = 1000, display_order = 1,
    description = 'System administrator with full access. Cannot be deleted.'
WHERE LOWER(name) = 'superadmin' AND is_system_role = FALSE;

-- Create or update Unassigned role
DO $$
DECLARE
    system_dept_id UUID;
    unassigned_role_id UUID;
BEGIN
    SELECT id INTO system_dept_id FROM departments WHERE LOWER(name) = 'system' LIMIT 1;
    IF system_dept_id IS NULL THEN
        INSERT INTO departments (name, description, created_at, updated_at)
        VALUES ('System', 'System department for built-in roles', NOW(), NOW())
        RETURNING id INTO system_dept_id;
        RAISE NOTICE 'Created System department';
    END IF;
    
    SELECT id INTO unassigned_role_id FROM roles WHERE LOWER(name) = 'unassigned';
    IF unassigned_role_id IS NULL THEN
        INSERT INTO roles (name, department_id, description, is_system_role, hierarchy_level, display_order, permissions, created_at, updated_at)
        VALUES ('Unassigned', system_dept_id, 'Default role for unassigned users', TRUE, 0, 999,
                jsonb_build_object('view_own_profile', true, 'edit_own_profile', true), NOW(), NOW())
        RETURNING id INTO unassigned_role_id;
        RAISE NOTICE 'Created Unassigned role';
    ELSE
        UPDATE roles SET is_system_role = TRUE, hierarchy_level = 0, display_order = 999,
               description = 'Default role for unassigned users',
               permissions = jsonb_build_object('view_own_profile', true, 'edit_own_profile', true)
        WHERE id = unassigned_role_id;
        RAISE NOTICE 'Updated Unassigned role';
    END IF;
    
    INSERT INTO user_roles (user_id, role_id, assigned_at, assigned_by)
    SELECT up.id, unassigned_role_id, NOW(), NULL
    FROM user_profiles up
    LEFT JOIN user_roles ur ON up.id = ur.user_id
    WHERE ur.id IS NULL
    ON CONFLICT DO NOTHING;
END $$;

-- Protection triggers
CREATE OR REPLACE FUNCTION prevent_system_role_deletion()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_system_role = TRUE THEN
        RAISE EXCEPTION 'Cannot delete system role: %', OLD.name;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_system_role_deletion_trigger ON roles;
CREATE TRIGGER prevent_system_role_deletion_trigger
BEFORE DELETE ON roles FOR EACH ROW
EXECUTE FUNCTION prevent_system_role_deletion();

CREATE OR REPLACE FUNCTION prevent_system_role_flag_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_system_role = TRUE AND NEW.is_system_role = FALSE THEN
        RAISE EXCEPTION 'Cannot remove system role protection from: %', OLD.name;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_system_role_flag_change_trigger ON roles;
CREATE TRIGGER prevent_system_role_flag_change_trigger
BEFORE UPDATE ON roles FOR EACH ROW
EXECUTE FUNCTION prevent_system_role_flag_change();

\echo 'System roles configured successfully!';
\echo '';
\echo '================================================================================';
\echo 'STEP 3: Creating RLS helper functions...';
\echo '================================================================================';

-- Helper functions for RLS policies
CREATE OR REPLACE FUNCTION auth.get_user_role_ids() RETURNS UUID[] AS $$
BEGIN
  RETURN ARRAY(SELECT role_id FROM user_roles WHERE user_id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth.user_is_superadmin() RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND r.is_system_role = TRUE AND LOWER(r.name) = 'superadmin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth.user_has_permission(permission_name TEXT) RETURNS BOOLEAN AS $$
BEGIN
  IF auth.user_is_superadmin() THEN RETURN TRUE; END IF;
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND (r.permissions->permission_name)::boolean = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth.user_assigned_to_project(project_id UUID) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM project_assignments
    WHERE user_id = auth.uid() AND project_id = $1 AND removed_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth.user_manages_department(department_id UUID) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND r.department_id = $1
      AND ((r.permissions->'manage_department_settings')::boolean = TRUE
           OR (r.permissions->'manage_department_tasks')::boolean = TRUE)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth.user_in_department(department_id UUID) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND r.department_id = $1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth.user_has_account_access(account_id UUID) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM project_assignments pa JOIN projects p ON p.id = pa.project_id
    WHERE pa.user_id = auth.uid() AND p.account_id = $1 AND pa.removed_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth.user_can_edit_role(role_id UUID) RETURNS BOOLEAN AS $$
DECLARE is_system BOOLEAN;
BEGIN
  SELECT is_system_role INTO is_system FROM roles WHERE id = $1;
  IF is_system THEN RETURN FALSE; END IF;
  RETURN auth.user_has_permission('edit_role');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth.user_can_delete_role(role_id UUID) RETURNS BOOLEAN AS $$
DECLARE is_system BOOLEAN;
BEGIN
  SELECT is_system_role INTO is_system FROM roles WHERE id = $1;
  IF is_system THEN RETURN FALSE; END IF;
  RETURN auth.user_has_permission('delete_role');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth.user_can_view_user_profile(target_user_id UUID) RETURNS BOOLEAN AS $$
BEGIN
  IF auth.uid() = target_user_id THEN RETURN TRUE; END IF;
  IF auth.user_is_superadmin() THEN RETURN TRUE; END IF;
  IF auth.user_has_permission('view_users') THEN RETURN TRUE; END IF;
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur1 JOIN roles r1 ON r1.id = ur1.role_id
    JOIN roles r2 ON r2.department_id = r1.department_id
    JOIN user_roles ur2 ON ur2.role_id = r2.id
    WHERE ur1.user_id = auth.uid() AND ur2.user_id = target_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant permissions
GRANT EXECUTE ON FUNCTION auth.get_user_role_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.user_is_superadmin() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.user_has_permission(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION auth.user_assigned_to_project(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION auth.user_manages_department(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION auth.user_in_department(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION auth.user_has_account_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION auth.user_can_edit_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION auth.user_can_delete_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION auth.user_can_view_user_profile(UUID) TO authenticated;

\echo 'RLS helper functions created successfully!';
\echo '';
\echo '================================================================================';
\echo 'STEP 4: Applying RLS policies...';
\echo '================================================================================';

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
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- User Profiles Policies
DROP POLICY IF EXISTS "user_profiles_select_policy" ON user_profiles;
CREATE POLICY "user_profiles_select_policy" ON user_profiles FOR SELECT
  USING (id = auth.uid() OR auth.user_is_superadmin() OR auth.user_has_permission('view_users') OR auth.user_can_view_user_profile(id));

DROP POLICY IF EXISTS "user_profiles_update_policy" ON user_profiles;
CREATE POLICY "user_profiles_update_policy" ON user_profiles FOR UPDATE
  USING (id = auth.uid() OR auth.user_has_permission('edit_users'));

-- Roles Policies
DROP POLICY IF EXISTS "roles_select_policy" ON roles;
CREATE POLICY "roles_select_policy" ON roles FOR SELECT 
  USING (
    auth.user_has_permission('view_roles') 
    OR auth.user_is_superadmin()
  );

DROP POLICY IF EXISTS "roles_insert_policy" ON roles;
CREATE POLICY "roles_insert_policy" ON roles FOR INSERT
  WITH CHECK (auth.user_has_permission('create_role') AND is_system_role = FALSE);

DROP POLICY IF EXISTS "roles_update_policy" ON roles;
CREATE POLICY "roles_update_policy" ON roles FOR UPDATE USING (auth.user_can_edit_role(id));

DROP POLICY IF EXISTS "roles_delete_policy" ON roles;
CREATE POLICY "roles_delete_policy" ON roles FOR DELETE USING (auth.user_can_delete_role(id));

-- User Roles Policies
DROP POLICY IF EXISTS "user_roles_select_policy" ON user_roles;
CREATE POLICY "user_roles_select_policy" ON user_roles FOR SELECT
  USING (user_id = auth.uid() OR auth.user_has_permission('view_users') OR auth.user_has_permission('manage_users'));

DROP POLICY IF EXISTS "user_roles_insert_policy" ON user_roles;
CREATE POLICY "user_roles_insert_policy" ON user_roles FOR INSERT
  WITH CHECK (auth.user_has_permission('assign_users_to_roles'));

DROP POLICY IF EXISTS "user_roles_delete_policy" ON user_roles;
CREATE POLICY "user_roles_delete_policy" ON user_roles FOR DELETE
  USING (auth.user_has_permission('remove_users_from_roles'));

-- Departments Policies
DROP POLICY IF EXISTS "departments_select_policy" ON departments;
CREATE POLICY "departments_select_policy" ON departments FOR SELECT
  USING (
    auth.user_in_department(id) 
    OR auth.user_has_permission('view_departments')
    OR auth.user_has_permission('view_all_departments') 
    OR auth.user_is_superadmin()
  );

DROP POLICY IF EXISTS "departments_insert_policy" ON departments;
CREATE POLICY "departments_insert_policy" ON departments FOR INSERT
  WITH CHECK (auth.user_has_permission('create_department'));

DROP POLICY IF EXISTS "departments_update_policy" ON departments;
CREATE POLICY "departments_update_policy" ON departments FOR UPDATE
  USING (auth.user_has_permission('edit_department'));

DROP POLICY IF EXISTS "departments_delete_policy" ON departments;
CREATE POLICY "departments_delete_policy" ON departments FOR DELETE
  USING (auth.user_has_permission('delete_department'));

-- Projects Policies  
DROP POLICY IF EXISTS "projects_select_policy" ON projects;
CREATE POLICY "projects_select_policy" ON projects FOR SELECT
  USING (auth.user_assigned_to_project(id) OR auth.user_has_account_access(account_id) OR auth.user_has_permission('view_all_projects') OR auth.user_is_superadmin());

DROP POLICY IF EXISTS "projects_insert_policy" ON projects;
CREATE POLICY "projects_insert_policy" ON projects FOR INSERT
  WITH CHECK (auth.user_has_permission('create_project'));

DROP POLICY IF EXISTS "projects_update_policy" ON projects;
CREATE POLICY "projects_update_policy" ON projects FOR UPDATE
  USING ((auth.user_assigned_to_project(id) AND auth.user_has_permission('edit_project')) OR auth.user_has_permission('edit_all_projects') OR auth.user_is_superadmin());

DROP POLICY IF EXISTS "projects_delete_policy" ON projects;
CREATE POLICY "projects_delete_policy" ON projects FOR DELETE
  USING ((auth.user_assigned_to_project(id) AND auth.user_has_permission('delete_project')) OR auth.user_has_permission('delete_all_projects') OR auth.user_is_superadmin());

\echo 'RLS policies applied successfully!';
\echo '';
\echo '================================================================================';
\echo 'DATABASE SETUP COMPLETE!';
\echo '================================================================================';
\echo 'Next steps:';
\echo '1. Verify the changes above show no errors';
\echo '2. Test with different user roles';
\echo '3. Continue with application code deployment';
\echo '================================================================================';

-- Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('user_profiles', 'roles', 'user_roles', 'departments', 'accounts', 'projects')
ORDER BY tablename;


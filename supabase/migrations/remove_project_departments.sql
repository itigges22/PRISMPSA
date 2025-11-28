-- Migration: Remove project_departments table and derive department membership from user assignments
-- Date: 2025-01-21
-- Purpose: Transition from manual department assignment to automatic derivation via project_assignments + user_roles

-- ============================================================================
-- STEP 1: Backup existing project_departments data (optional, for safety)
-- ============================================================================

-- Create a backup table (comment out if you don't want backup)
CREATE TABLE IF NOT EXISTS project_departments_backup AS
SELECT * FROM project_departments;

-- ============================================================================
-- STEP 2: Drop the project_departments table
-- ============================================================================

-- Drop any foreign key constraints first (if they exist)
-- Note: Adjust table names if there are other tables referencing project_departments
-- ALTER TABLE some_other_table DROP CONSTRAINT IF EXISTS fk_project_departments;

-- Drop the table
DROP TABLE IF EXISTS project_departments CASCADE;

-- ============================================================================
-- STEP 3: Ensure project_assignments table is properly structured
-- ============================================================================

-- Verify that project_assignments.role_in_project column exists
-- (It should already exist based on the schema, but this ensures it)

DO $$
BEGIN
    -- Add role_in_project column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'project_assignments'
        AND column_name = 'role_in_project'
    ) THEN
        ALTER TABLE project_assignments
        ADD COLUMN role_in_project TEXT;
    END IF;
END $$;

-- ============================================================================
-- STEP 4: Add helpful indexes for the new query patterns
-- ============================================================================

-- Index for quickly finding projects by department via assignments
CREATE INDEX IF NOT EXISTS idx_project_assignments_user_project
ON project_assignments(user_id, project_id)
WHERE removed_at IS NULL;

-- Index for joining user_roles to find department memberships
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role
ON user_roles(user_id, role_id);

-- Index for roles by department
CREATE INDEX IF NOT EXISTS idx_roles_department
ON roles(department_id)
WHERE department_id IS NOT NULL;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- The application will now derive department membership from:
-- 1. project_assignments (which users are on which projects)
-- 2. user_roles (which roles each user has)
-- 3. roles (which department each role belongs to)
-- 4. The role_in_project field indicates which capacity the user is working in

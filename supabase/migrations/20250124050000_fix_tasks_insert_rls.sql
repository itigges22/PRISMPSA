-- Fix tasks INSERT RLS policy
-- Date: 2025-01-24
-- Description: Allow users with project access to create tasks
--
-- Per CLAUDE.md: "Task permissions are now inherited from project access -
-- if user can view the project page, they can manage tasks."
--
-- The current policy only allows users with manage_projects + project_assignments,
-- but this is too restrictive. Users who can VIEW the project should also be able
-- to create tasks in it.

BEGIN;

-- Drop the existing overly restrictive insert policy
DROP POLICY IF EXISTS "tasks_insert" ON tasks;

-- Create new policy that allows task creation for anyone with project access
-- This matches the SELECT policy logic - if you can see the project, you can create tasks
CREATE POLICY "tasks_insert" ON tasks
FOR INSERT
WITH CHECK (
  user_is_superadmin()
  OR user_has_permission('manage_all_projects')
  OR user_has_permission('view_all_projects')
  OR (
    -- User has view_projects permission and has project access
    user_has_permission('view_projects')
    AND (
      -- User is assigned to the project
      EXISTS (
        SELECT 1 FROM project_assignments pa
        WHERE pa.project_id = tasks.project_id
        AND pa.user_id = auth.uid()
        AND pa.removed_at IS NULL
      )
      OR
      -- User created the project
      EXISTS (
        SELECT 1 FROM projects p
        WHERE p.id = tasks.project_id
        AND p.created_by = auth.uid()
      )
      OR
      -- User is account manager of the project's account
      EXISTS (
        SELECT 1 FROM projects p
        JOIN accounts a ON a.id = p.account_id
        WHERE p.id = tasks.project_id
        AND a.account_manager_id = auth.uid()
      )
    )
  )
);

-- Also update the tasks_update policy to match
-- Users who can view the project should be able to update tasks
DROP POLICY IF EXISTS "tasks_update" ON tasks;

CREATE POLICY "tasks_update" ON tasks
FOR UPDATE
USING (
  user_is_superadmin()
  OR user_has_permission('manage_all_projects')
  OR user_has_permission('view_all_projects')
  OR assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR (
    user_has_permission('view_projects')
    AND (
      EXISTS (
        SELECT 1 FROM project_assignments pa
        WHERE pa.project_id = tasks.project_id
        AND pa.user_id = auth.uid()
        AND pa.removed_at IS NULL
      )
      OR
      EXISTS (
        SELECT 1 FROM projects p
        WHERE p.id = tasks.project_id
        AND p.created_by = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM projects p
        JOIN accounts a ON a.id = p.account_id
        WHERE p.id = tasks.project_id
        AND a.account_manager_id = auth.uid()
      )
    )
  )
);

-- Also update the tasks_delete policy to match
DROP POLICY IF EXISTS "tasks_delete" ON tasks;

CREATE POLICY "tasks_delete" ON tasks
FOR DELETE
USING (
  user_is_superadmin()
  OR user_has_permission('manage_all_projects')
  OR user_has_permission('view_all_projects')
  OR created_by = auth.uid()
  OR (
    user_has_permission('view_projects')
    AND (
      EXISTS (
        SELECT 1 FROM project_assignments pa
        WHERE pa.project_id = tasks.project_id
        AND pa.user_id = auth.uid()
        AND pa.removed_at IS NULL
      )
      OR
      EXISTS (
        SELECT 1 FROM projects p
        WHERE p.id = tasks.project_id
        AND p.created_by = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM projects p
        JOIN accounts a ON a.id = p.account_id
        WHERE p.id = tasks.project_id
        AND a.account_manager_id = auth.uid()
      )
    )
  )
);

COMMIT;

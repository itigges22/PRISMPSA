-- Fix accounts RLS for implicit project-based access
-- Date: 2025-01-27
-- Description: Users assigned to projects should be able to see account info
--              WITHOUT requiring the view_accounts permission.
--              This makes project assignment sufficient for account visibility.

BEGIN;

-- Drop existing policy
DROP POLICY IF EXISTS "accounts_select" ON accounts;

-- Recreate with project assignment as standalone condition
CREATE POLICY "accounts_select" ON accounts
FOR SELECT
USING (
  -- Superadmin bypass
  user_is_superadmin()
  -- Override permission - sees all accounts
  OR user_has_permission('view_all_accounts')
  -- Project assignment grants implicit account visibility (NO permission required)
  OR EXISTS (
    SELECT 1 FROM project_assignments pa
    JOIN projects p ON p.id = pa.project_id
    WHERE p.account_id = accounts.id
    AND pa.user_id = auth.uid()
    AND pa.removed_at IS NULL
  )
  -- For other cases, require view_accounts permission
  OR (
    user_has_permission('view_accounts')
    AND (
      -- User is member of account
      EXISTS (
        SELECT 1 FROM account_members am
        WHERE am.account_id = accounts.id
        AND am.user_id = auth.uid()
      )
      -- OR user is account manager
      OR account_manager_id = auth.uid()
    )
  )
);

COMMIT;

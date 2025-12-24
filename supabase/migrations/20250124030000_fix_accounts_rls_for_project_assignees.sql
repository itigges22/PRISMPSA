-- Fix accounts RLS to allow access via project assignments
-- Date: 2025-01-24
-- Description: Users assigned to projects should be able to see the account info
--              for those projects, even if not explicitly in account_members

BEGIN;

-- Drop existing policy
DROP POLICY IF EXISTS "accounts_select" ON accounts;

-- Recreate with project assignment check
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
      -- OR user is account manager
      OR account_manager_id = auth.uid()
      -- OR user is assigned to any project in this account
      OR EXISTS (
        SELECT 1 FROM project_assignments pa
        JOIN projects p ON p.id = pa.project_id
        WHERE p.account_id = accounts.id
        AND pa.user_id = auth.uid()
        AND pa.removed_at IS NULL
      )
    )
  )
);

COMMIT;

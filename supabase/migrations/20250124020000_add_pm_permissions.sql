-- Add missing permissions to Project Manager and other roles
-- Date: 2025-01-24
-- Description: Fixes permission issues for Project Manager role:
--   - edit_own_availability: Allow users to set their availability
--   - view_departments: Allow viewing departments they belong to
--   - manage_issues: Allow managing project issues (may already exist)

BEGIN;

-- Update Project Manager role to include missing permissions
UPDATE roles
SET permissions = permissions || '{
  "edit_own_availability": true,
  "view_departments": true,
  "manage_issues": true
}'::jsonb
WHERE name = 'Project Manager';

-- Also add edit_own_availability to other roles that should have it
-- All users should be able to set their own availability
UPDATE roles
SET permissions = permissions || '{"edit_own_availability": true}'::jsonb
WHERE name IN ('Contributor', 'Senior Designer', 'Junior Designer', 'Senior Developer', 'Junior Developer');

-- Add view_departments to roles that should see department info
UPDATE roles
SET permissions = permissions || '{"view_departments": true}'::jsonb
WHERE name IN ('Contributor', 'Senior Designer', 'Junior Designer', 'Senior Developer', 'Junior Developer');

COMMIT;

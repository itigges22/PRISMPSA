-- Add view_accounts permission to Project Manager role
-- Date: 2025-01-24
-- Description: Project Managers need to see account info for projects they're working on

BEGIN;

-- Update Project Manager role to include view_accounts permission
UPDATE roles
SET permissions = permissions || '{"view_accounts": true}'::jsonb
WHERE name = 'Project Manager';

-- Also add to Contributor role so they can see account info too
UPDATE roles
SET permissions = permissions || '{"view_accounts": true}'::jsonb
WHERE name = 'Contributor';

-- Also add to Senior Designer and Senior Developer roles
UPDATE roles
SET permissions = permissions || '{"view_accounts": true}'::jsonb
WHERE name IN ('Senior Designer', 'Junior Designer', 'Senior Developer', 'Junior Developer');

COMMIT;

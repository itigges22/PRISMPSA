-- Add get_project_stakeholders function
-- Date: 2025-01-24
-- Description: SQL function to retrieve project stakeholders, bypassing RLS

BEGIN;

-- ============================================================================
-- FUNCTION: get_project_stakeholders
-- ============================================================================
-- Returns all stakeholders for a project with their user profile info
-- Uses SECURITY DEFINER to ensure consistent access for authorized users

CREATE OR REPLACE FUNCTION get_project_stakeholders(project_uuid UUID)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    role TEXT,
    user_name TEXT,
    user_email TEXT,
    user_image TEXT,
    added_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ps.id,
        ps.user_id,
        ps.role,
        up.name AS user_name,
        up.email AS user_email,
        up.image AS user_image,
        ps.added_at
    FROM public.project_stakeholders ps
    LEFT JOIN public.user_profiles up ON ps.user_id = up.id
    WHERE ps.project_id = project_uuid
    ORDER BY ps.added_at DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp;

COMMENT ON FUNCTION get_project_stakeholders(UUID) IS
'Returns all stakeholders for a project with their user profile information. Uses SECURITY DEFINER to bypass RLS.';

COMMIT;

-- Phase 2: Fixed Database Functions
-- Date: 2025-01-23
-- Description: Create database functions with SECURITY DEFINER to fix circular RLS dependency
--
-- CRITICAL FIX #1 & #5: Circular RLS Dependency
-- Problem: user_has_permission() queries user_roles table which has RLS policies
--          calling user_has_permission() → infinite loop
-- Solution: SECURITY DEFINER makes functions bypass RLS when querying permission tables
--
-- Security: SET search_path prevents SQL injection attacks

BEGIN;

-- ============================================================================
-- FUNCTION 1: user_has_permission (FIXED)
-- ============================================================================
-- Checks if current user has a specific permission
-- SECURITY DEFINER: Bypasses RLS to prevent circular dependency
-- SET search_path: Prevents SQL injection

CREATE OR REPLACE FUNCTION user_has_permission(permission_name text)
RETURNS boolean AS $$
BEGIN
  -- Check if user has permission via their roles
  -- Runs with creator privileges (SECURITY DEFINER), bypassing RLS
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND (r.permissions->permission_name)::boolean = TRUE
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp;

-- Add comment
COMMENT ON FUNCTION user_has_permission(text) IS
'Checks if the current user has a specific permission. Uses SECURITY DEFINER to bypass RLS and prevent circular dependency.';

-- ============================================================================
-- FUNCTION 2: user_is_superadmin (FIXED)
-- ============================================================================
-- Checks if current user is a superadmin
-- SECURITY DEFINER: Bypasses RLS to prevent circular dependency
-- Two-stage check: is_superadmin flag first, then role name (for legacy support)

CREATE OR REPLACE FUNCTION user_is_superadmin()
RETURNS boolean AS $$
BEGIN
  -- Fast path: Check is_superadmin flag first
  IF EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND is_superadmin = TRUE
  ) THEN
    RETURN TRUE;
  END IF;

  -- Fallback: Check for Superadmin role (legacy support)
  -- Bypasses RLS via SECURITY DEFINER
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.is_system_role = TRUE
    AND LOWER(r.name) = 'superadmin'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp;

-- Add comment
COMMENT ON FUNCTION user_is_superadmin() IS
'Checks if the current user is a superadmin. Uses SECURITY DEFINER to bypass RLS and prevent circular dependency.';

-- ============================================================================
-- FUNCTION 3: user_can_view_workflow (NEW - FIX #4)
-- ============================================================================
-- Helper function to check workflow access
-- SECURITY DEFINER: Bypasses nested RLS queries for performance
-- Fixes: Nested RLS queries in workflow_history causing timeouts

CREATE OR REPLACE FUNCTION user_can_view_workflow(workflow_instance_id uuid)
RETURNS boolean AS $$
BEGIN
  -- Single query, bypasses nested RLS via SECURITY DEFINER
  RETURN EXISTS (
    SELECT 1
    FROM workflow_instances wi
    LEFT JOIN project_assignments pa ON pa.project_id = wi.project_id
    LEFT JOIN tasks t ON t.id = wi.task_id
    WHERE wi.id = user_can_view_workflow.workflow_instance_id
    AND (
      user_is_superadmin()
      OR user_has_permission('view_all_workflows')
      OR (pa.user_id = auth.uid() AND pa.removed_at IS NULL)
      OR t.assigned_to = auth.uid()
    )
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp;

-- Add comment
COMMENT ON FUNCTION user_can_view_workflow(uuid) IS
'Checks if the current user can view a specific workflow instance. Uses SECURITY DEFINER to prevent nested RLS performance issues.';

-- ============================================================================
-- FUNCTION 4: user_can_manage_workflow (NEW - FIX #4)
-- ============================================================================
-- Helper function to check workflow management access

CREATE OR REPLACE FUNCTION user_can_manage_workflow(workflow_instance_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM workflow_instances wi
    LEFT JOIN project_assignments pa ON pa.project_id = wi.project_id
    WHERE wi.id = user_can_manage_workflow.workflow_instance_id
    AND (
      user_is_superadmin()
      OR user_has_permission('manage_all_workflows')
      OR (
        user_has_permission('execute_workflows')
        AND pa.user_id = auth.uid()
        AND pa.removed_at IS NULL
      )
    )
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp;

-- Add comment
COMMENT ON FUNCTION user_can_manage_workflow(uuid) IS
'Checks if the current user can manage a specific workflow instance.';

-- ============================================================================
-- FUNCTION 5: get_week_start_date (EXISTING)
-- ============================================================================
-- Returns Monday of the week for a given date (ISO 8601 standard)
-- Used for capacity planning and time tracking

CREATE OR REPLACE FUNCTION get_week_start_date(input_date DATE)
RETURNS DATE AS $$
BEGIN
  -- ISO 8601: Monday = 1, Sunday = 7
  -- Subtract days to get to Monday
  RETURN input_date - (EXTRACT(ISODOW FROM input_date)::INTEGER - 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add comment
COMMENT ON FUNCTION get_week_start_date(DATE) IS
'Returns Monday of the week for a given date using ISO 8601 standard (Monday = week start).';

-- ============================================================================
-- FUNCTION 6: auto_clock_out_stale_sessions (EXISTING)
-- ============================================================================
-- Automatically closes clock sessions that have been active for more than 16 hours
-- Prevents overnight sessions from corrupting time tracking data
-- SECURITY DEFINER: Needs elevated permissions to update clock_sessions

CREATE OR REPLACE FUNCTION auto_clock_out_stale_sessions()
RETURNS void AS $$
BEGIN
  UPDATE public.clock_sessions
  SET
    clock_out_time = clock_in_time + INTERVAL '16 hours',
    is_active = false,
    is_auto_clock_out = true
  WHERE is_active = true
    AND clock_in_time < NOW() - INTERVAL '16 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Add comment
COMMENT ON FUNCTION auto_clock_out_stale_sessions() IS
'Automatically closes clock sessions that have been active for more than 16 hours. Prevents overnight sessions from corrupting data.';

-- ============================================================================
-- FUNCTION 7: is_superadmin (ALIAS for backwards compatibility)
-- ============================================================================
-- Alias function that takes user_id parameter
-- Used by some older code

CREATE OR REPLACE FUNCTION is_superadmin(user_id uuid)
RETURNS boolean AS $$
BEGIN
  -- Check is_superadmin flag
  IF EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = is_superadmin.user_id
    AND is_superadmin = TRUE
  ) THEN
    RETURN TRUE;
  END IF;

  -- Check for Superadmin role
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = is_superadmin.user_id
    AND r.is_system_role = TRUE
    AND LOWER(r.name) = 'superadmin'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp;

-- Add comment
COMMENT ON FUNCTION is_superadmin(uuid) IS
'Checks if a specific user is a superadmin. Backwards compatibility wrapper.';

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Run these in Supabase Studio to verify)
-- ============================================================================
--
-- Test 1: Verify functions exist
-- SELECT routine_name, routine_type
-- FROM information_schema.routines
-- WHERE routine_schema = 'public'
-- AND routine_name IN (
--   'user_has_permission',
--   'user_is_superadmin',
--   'user_can_view_workflow',
--   'get_week_start_date',
--   'auto_clock_out_stale_sessions'
-- );
-- Expected: 5 rows
--
-- Test 2: Verify SECURITY DEFINER is set
-- SELECT proname, prosecdef
-- FROM pg_proc p
-- JOIN pg_namespace n ON p.pronamespace = n.oid
-- WHERE n.nspname = 'public'
-- AND proname IN ('user_has_permission', 'user_is_superadmin', 'user_can_view_workflow')
-- AND prosecdef = true;
-- Expected: 3 rows with prosecdef = true

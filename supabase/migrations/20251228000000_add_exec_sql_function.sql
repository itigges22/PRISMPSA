-- Migration: Add exec_sql function for demo data reset cron job
-- Date: 2025-12-28
-- Description: Creates a SECURITY DEFINER function that allows the cron job
--              to execute SQL statements for clearing demo data

-- Create the exec_sql function
-- This function is used by the demo data reset cron job to clear old seed data
-- SECURITY DEFINER allows it to bypass RLS policies
CREATE OR REPLACE FUNCTION exec_sql(query TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE query;
END;
$$;

-- Grant execute permission to authenticated users (the service role will use this)
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO service_role;

-- Add a comment documenting the function's purpose
COMMENT ON FUNCTION exec_sql(TEXT) IS 'Executes arbitrary SQL. Used by demo data reset cron job. SECURITY DEFINER bypasses RLS.';

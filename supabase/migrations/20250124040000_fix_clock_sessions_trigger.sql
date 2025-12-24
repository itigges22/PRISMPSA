-- Fix clock_sessions trigger issue
-- The table doesn't have an updated_at column but the trigger tries to set it
-- Solution: Drop the trigger since clock_sessions tracks state via clock_out_time

BEGIN;

-- Drop the problematic trigger
DROP TRIGGER IF EXISTS update_clock_sessions_updated_at ON clock_sessions;

COMMIT;

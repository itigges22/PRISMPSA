-- Phase 2: Database Views
-- Date: 2025-01-23
-- Description: Create database views for analytics and reporting

BEGIN;

-- ============================================================================
-- VIEW: weekly_capacity_summary
-- ============================================================================
-- Aggregates user availability, task allocations, and actual time logged
-- Used for capacity planning dashboards and utilization reports

CREATE OR REPLACE VIEW weekly_capacity_summary AS
SELECT
  ua.user_id,
  ua.week_start_date,
  ua.available_hours,
  COALESCE(SUM(twa.allocated_hours), 0) AS allocated_hours,
  COALESCE(SUM(te.hours_logged), 0) AS actual_hours,

  -- Utilization rate: (actual hours / available hours) * 100
  CASE
    WHEN ua.available_hours > 0
    THEN (COALESCE(SUM(te.hours_logged), 0) / ua.available_hours * 100)
    ELSE 0
  END AS utilization_rate,

  -- Remaining capacity: available - actual
  ua.available_hours - COALESCE(SUM(te.hours_logged), 0) AS remaining_capacity,

  -- Over-allocated: allocated > available
  CASE
    WHEN COALESCE(SUM(twa.allocated_hours), 0) > ua.available_hours
    THEN TRUE
    ELSE FALSE
  END AS is_over_allocated,

  -- Number of projects user is working on this week
  COUNT(DISTINCT twa.task_id) AS active_task_count

FROM user_availability ua

LEFT JOIN task_week_allocations twa
  ON twa.assigned_user_id = ua.user_id
  AND twa.week_start_date = ua.week_start_date

LEFT JOIN time_entries te
  ON te.user_id = ua.user_id
  AND te.week_start_date = ua.week_start_date

GROUP BY
  ua.user_id,
  ua.week_start_date,
  ua.available_hours;

-- Add comment
COMMENT ON VIEW weekly_capacity_summary IS
'Aggregates weekly capacity metrics for users including availability, allocations, actual hours, and utilization rate.';

COMMIT;

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================
--
-- Get capacity summary for specific user
-- SELECT * FROM weekly_capacity_summary
-- WHERE user_id = '...'
-- AND week_start_date >= CURRENT_DATE
-- ORDER BY week_start_date;
--
-- Find over-allocated users
-- SELECT
--   up.name,
--   wcs.*
-- FROM weekly_capacity_summary wcs
-- JOIN user_profiles up ON up.id = wcs.user_id
-- WHERE wcs.is_over_allocated = TRUE
-- AND wcs.week_start_date >= get_week_start_date(CURRENT_DATE);
--
-- Team utilization report
-- SELECT
--   week_start_date,
--   COUNT(*) as team_size,
--   AVG(utilization_rate) as avg_utilization,
--   SUM(available_hours) as total_capacity,
--   SUM(actual_hours) as total_utilized
-- FROM weekly_capacity_summary
-- GROUP BY week_start_date
-- ORDER BY week_start_date DESC;

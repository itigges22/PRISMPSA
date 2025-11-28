-- ============================================================================
-- PRISM PSA - Capacity Management System
-- ============================================================================
-- This migration adds comprehensive capacity tracking and work allocation
-- features including:
-- - Weekly user availability tracking
-- - Task week allocations
-- - Time entry logging
-- - Capacity analytics

-- ============================================================================
-- 1. USER AVAILABILITY TABLE
-- ============================================================================
-- Tracks user's available hours on a weekly basis
CREATE TABLE IF NOT EXISTS user_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL, -- Monday of the week
  available_hours NUMERIC NOT NULL DEFAULT 40,
  schedule_data JSONB, -- Day-by-day breakdown: {monday: 8, tuesday: 8, ...}
  notes TEXT, -- Optional notes (PTO, holidays, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one record per user per week
  UNIQUE(user_id, week_start_date),
  
  -- Validate hours
  CHECK (available_hours >= 0 AND available_hours <= 168) -- Max hours in a week
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_availability_user_id ON user_availability(user_id);
CREATE INDEX IF NOT EXISTS idx_user_availability_week ON user_availability(week_start_date);
CREATE INDEX IF NOT EXISTS idx_user_availability_user_week ON user_availability(user_id, week_start_date);

-- RLS Policies
ALTER TABLE user_availability ENABLE ROW LEVEL SECURITY;

-- Users can view their own availability
CREATE POLICY "Users can view own availability"
  ON user_availability
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own availability
CREATE POLICY "Users can insert own availability"
  ON user_availability
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own availability
CREATE POLICY "Users can update own availability"
  ON user_availability
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own availability
CREATE POLICY "Users can delete own availability"
  ON user_availability
  FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE user_availability IS 'Tracks user work capacity on a weekly basis';
COMMENT ON COLUMN user_availability.week_start_date IS 'Monday of the week (ISO week start)';
COMMENT ON COLUMN user_availability.available_hours IS 'Total hours available for work this week';
COMMENT ON COLUMN user_availability.schedule_data IS 'JSONB object with daily breakdown';

-- ============================================================================
-- 2. TIME ENTRIES TABLE
-- ============================================================================
-- Tracks actual time spent on tasks
CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  hours_logged NUMERIC NOT NULL,
  entry_date DATE NOT NULL, -- Date the work was done
  week_start_date DATE NOT NULL, -- Monday of the week for aggregation
  description TEXT, -- Optional description of work done
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Validate hours
  CHECK (hours_logged > 0 AND hours_logged <= 24) -- Max 24 hours per entry
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_time_entries_task ON time_entries(task_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_project ON time_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_week ON time_entries(week_start_date);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_week ON time_entries(user_id, week_start_date);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(entry_date);

-- RLS Policies
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

-- Users can view their own time entries
CREATE POLICY "Users can view own time entries"
  ON time_entries
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own time entries
CREATE POLICY "Users can insert own time entries"
  ON time_entries
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own time entries
CREATE POLICY "Users can update own time entries"
  ON time_entries
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own time entries
CREATE POLICY "Users can delete own time entries"
  ON time_entries
  FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE time_entries IS 'Tracks actual time spent on tasks';
COMMENT ON COLUMN time_entries.entry_date IS 'Date the work was performed';
COMMENT ON COLUMN time_entries.week_start_date IS 'Monday of the week for weekly aggregation';

-- ============================================================================
-- 3. TASK WEEK ALLOCATIONS TABLE
-- ============================================================================
-- Breaks down task estimated hours into weekly chunks
CREATE TABLE IF NOT EXISTS task_week_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL, -- Monday of the week
  allocated_hours NUMERIC NOT NULL,
  assigned_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  notes TEXT, -- Optional planning notes
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Validate hours
  CHECK (allocated_hours > 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_task_week_alloc_task ON task_week_allocations(task_id);
CREATE INDEX IF NOT EXISTS idx_task_week_alloc_week ON task_week_allocations(week_start_date);
CREATE INDEX IF NOT EXISTS idx_task_week_alloc_user ON task_week_allocations(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_task_week_alloc_user_week ON task_week_allocations(assigned_user_id, week_start_date);

-- RLS Policies
ALTER TABLE task_week_allocations ENABLE ROW LEVEL SECURITY;

-- Users can view allocations for their assigned tasks
CREATE POLICY "Users can view task allocations"
  ON task_week_allocations
  FOR SELECT
  USING (
    assigned_user_id = auth.uid() OR
    task_id IN (
      SELECT id FROM tasks WHERE assigned_to = auth.uid() OR created_by = auth.uid()
    )
  );

-- Users can insert allocations for tasks they manage
CREATE POLICY "Users can insert task allocations"
  ON task_week_allocations
  FOR INSERT
  WITH CHECK (
    task_id IN (
      SELECT id FROM tasks WHERE assigned_to = auth.uid() OR created_by = auth.uid()
    )
  );

-- Users can update allocations for their tasks
CREATE POLICY "Users can update task allocations"
  ON task_week_allocations
  FOR UPDATE
  USING (
    task_id IN (
      SELECT id FROM tasks WHERE assigned_to = auth.uid() OR created_by = auth.uid()
    )
  );

-- Users can delete allocations for their tasks
CREATE POLICY "Users can delete task allocations"
  ON task_week_allocations
  FOR DELETE
  USING (
    task_id IN (
      SELECT id FROM tasks WHERE assigned_to = auth.uid() OR created_by = auth.uid()
    )
  );

COMMENT ON TABLE task_week_allocations IS 'Breaks down task estimated hours into weekly work allocations';

-- ============================================================================
-- 4. CAPACITY SUMMARY VIEW
-- ============================================================================
-- Provides weekly capacity metrics per user
CREATE OR REPLACE VIEW weekly_capacity_summary AS
SELECT 
  ua.user_id,
  ua.week_start_date,
  up.name as user_name,
  up.email as user_email,
  ua.available_hours,
  COALESCE(SUM(twa.allocated_hours), 0) as allocated_hours,
  COALESCE(SUM(te.hours_logged), 0) as actual_hours,
  CASE 
    WHEN ua.available_hours > 0 THEN 
      ROUND((COALESCE(SUM(te.hours_logged), 0) / ua.available_hours * 100), 2)
    ELSE 0 
  END as utilization_rate,
  ua.available_hours - COALESCE(SUM(te.hours_logged), 0) as remaining_capacity
FROM user_availability ua
INNER JOIN user_profiles up ON ua.user_id = up.id
LEFT JOIN task_week_allocations twa ON 
  ua.user_id = twa.assigned_user_id AND 
  ua.week_start_date = twa.week_start_date
LEFT JOIN time_entries te ON 
  ua.user_id = te.user_id AND 
  ua.week_start_date = te.week_start_date
GROUP BY ua.user_id, ua.week_start_date, up.name, up.email, ua.available_hours;

COMMENT ON VIEW weekly_capacity_summary IS 'Aggregated weekly capacity metrics per user';

-- ============================================================================
-- 5. DEPARTMENT CAPACITY VIEW
-- ============================================================================
-- Aggregates capacity by department
CREATE OR REPLACE VIEW department_capacity_summary AS
SELECT 
  d.id as department_id,
  d.name as department_name,
  wcs.week_start_date,
  COUNT(DISTINCT wcs.user_id) as team_size,
  SUM(wcs.available_hours) as total_available_hours,
  SUM(wcs.allocated_hours) as total_allocated_hours,
  SUM(wcs.actual_hours) as total_actual_hours,
  CASE 
    WHEN SUM(wcs.available_hours) > 0 THEN 
      ROUND((SUM(wcs.actual_hours) / SUM(wcs.available_hours) * 100), 2)
    ELSE 0 
  END as department_utilization_rate
FROM departments d
INNER JOIN user_roles ur ON d.id = ur.roles.department_id
INNER JOIN weekly_capacity_summary wcs ON ur.user_id = wcs.user_id
GROUP BY d.id, d.name, wcs.week_start_date;

COMMENT ON VIEW department_capacity_summary IS 'Aggregated capacity metrics by department and week';

-- ============================================================================
-- 6. PROJECT CAPACITY VIEW
-- ============================================================================
-- Shows capacity allocated to each project by week
CREATE OR REPLACE VIEW project_capacity_summary AS
SELECT 
  p.id as project_id,
  p.name as project_name,
  p.account_id,
  twa.week_start_date,
  COUNT(DISTINCT twa.assigned_user_id) as assigned_users,
  SUM(twa.allocated_hours) as allocated_hours,
  COALESCE(SUM(te.hours_logged), 0) as actual_hours,
  p.estimated_hours as total_estimated_hours
FROM projects p
LEFT JOIN tasks t ON p.id = t.project_id
LEFT JOIN task_week_allocations twa ON t.id = twa.task_id
LEFT JOIN time_entries te ON t.id = te.task_id AND twa.week_start_date = te.week_start_date
GROUP BY p.id, p.name, p.account_id, twa.week_start_date, p.estimated_hours;

COMMENT ON VIEW project_capacity_summary IS 'Capacity allocated to projects by week';

-- ============================================================================
-- 7. UPDATE TRIGGERS FOR TIMESTAMPS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_availability_updated_at
  BEFORE UPDATE ON user_availability
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_time_entries_updated_at
  BEFORE UPDATE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_task_week_allocations_updated_at
  BEFORE UPDATE ON task_week_allocations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 8. HELPER FUNCTION: Get Week Start Date
-- ============================================================================
CREATE OR REPLACE FUNCTION get_week_start_date(input_date DATE)
RETURNS DATE AS $$
BEGIN
  -- Returns the Monday of the week for any given date (ISO week)
  RETURN input_date - (EXTRACT(ISODOW FROM input_date)::INT - 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_week_start_date IS 'Returns Monday of the week for any given date (ISO week standard)';

-- ============================================================================
-- COMPLETED
-- ============================================================================


-- Clock Sessions table for tracking active clock-in sessions
CREATE TABLE IF NOT EXISTS clock_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  clock_in_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clock_out_time TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  is_auto_clock_out BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for finding active sessions quickly
CREATE INDEX IF NOT EXISTS idx_clock_sessions_user_active ON clock_sessions(user_id, is_active) WHERE is_active = true;

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_clock_sessions_clock_in ON clock_sessions(clock_in_time);

-- Add columns to time_entries for clock session tracking
ALTER TABLE time_entries
ADD COLUMN IF NOT EXISTS clock_session_id UUID REFERENCES clock_sessions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS clock_in_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS clock_out_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_auto_clock_out BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Index for time entries by session
CREATE INDEX IF NOT EXISTS idx_time_entries_session ON time_entries(clock_session_id);

-- Index for time entries by date for admin queries
CREATE INDEX IF NOT EXISTS idx_time_entries_entry_date ON time_entries(entry_date);

-- RLS Policies for clock_sessions
ALTER TABLE clock_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own sessions
CREATE POLICY "Users can view own clock sessions" ON clock_sessions
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own sessions
CREATE POLICY "Users can create own clock sessions" ON clock_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own sessions
CREATE POLICY "Users can update own clock sessions" ON clock_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- Admins can view all sessions (for admin dashboard)
CREATE POLICY "Admins can view all clock sessions" ON clock_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND (r.name = 'Admin' OR r.name = 'Executive' OR r.is_superadmin = true)
    )
  );

-- Function to auto clock-out sessions after 16 hours
CREATE OR REPLACE FUNCTION auto_clock_out_stale_sessions()
RETURNS void AS $$
BEGIN
  UPDATE clock_sessions
  SET
    is_active = false,
    is_auto_clock_out = true,
    clock_out_time = clock_in_time + INTERVAL '16 hours',
    updated_at = NOW()
  WHERE
    is_active = true
    AND clock_in_time < NOW() - INTERVAL '16 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment for documentation
COMMENT ON TABLE clock_sessions IS 'Tracks user clock-in/clock-out sessions for time tracking';
COMMENT ON COLUMN clock_sessions.is_auto_clock_out IS 'True if session was automatically closed after 16 hours';
COMMENT ON COLUMN time_entries.clock_session_id IS 'Links time entry to the clock session it was created from';

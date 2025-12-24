-- Migration: Add Dashboard Preferences
-- Purpose: Allow users to customize their dashboard widget layout and visibility

-- Create the user_dashboard_preferences table
CREATE TABLE IF NOT EXISTS user_dashboard_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE UNIQUE,
  widget_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on user_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_dashboard_preferences_user_id
  ON user_dashboard_preferences(user_id);

-- Enable Row Level Security
ALTER TABLE user_dashboard_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_dashboard_preferences
-- Users can view only their own preferences
CREATE POLICY "Users can view own dashboard preferences"
  ON user_dashboard_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users can insert own dashboard preferences"
  ON user_dashboard_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update only their own preferences
CREATE POLICY "Users can update own dashboard preferences"
  ON user_dashboard_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own preferences (reset to defaults)
CREATE POLICY "Users can delete own dashboard preferences"
  ON user_dashboard_preferences
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add comment describing the table structure
COMMENT ON TABLE user_dashboard_preferences IS 'Stores user dashboard customization settings';
COMMENT ON COLUMN user_dashboard_preferences.widget_config IS 'JSON object containing widget visibility, order, and size preferences. Structure: { widgets: [{ id, type, visible, order, size }], theme?: "compact"|"comfortable" }';

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_dashboard_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_dashboard_preferences_updated_at ON user_dashboard_preferences;
CREATE TRIGGER trigger_update_dashboard_preferences_updated_at
  BEFORE UPDATE ON user_dashboard_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_dashboard_preferences_updated_at();

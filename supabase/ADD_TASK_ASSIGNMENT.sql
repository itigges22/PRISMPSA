-- Migration: Add assigned_to field to tasks table
-- This allows tasks to be assigned to users, which grants them access to the project and account

-- Add assigned_to column to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES user_profiles(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);

-- Create index for querying tasks by project and assigned user
CREATE INDEX IF NOT EXISTS idx_tasks_project_assigned ON tasks(project_id, assigned_to);

-- Add comment explaining the field
COMMENT ON COLUMN tasks.assigned_to IS 'User assigned to this task. Assigned users get access to the project and account.';


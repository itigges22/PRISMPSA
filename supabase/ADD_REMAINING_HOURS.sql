-- Migration: Add remaining_hours field to tasks table
-- This allows tracking how much time is left on a task

-- Add remaining_hours column to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS remaining_hours NUMERIC;

-- Initialize remaining_hours to estimated_hours for existing tasks
UPDATE tasks 
SET remaining_hours = estimated_hours
WHERE remaining_hours IS NULL;

-- Add comment explaining the field
COMMENT ON COLUMN tasks.remaining_hours IS 'Hours remaining to complete the task. Automatically set to estimated_hours on creation. When set to 0, task status moves to done.';


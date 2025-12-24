-- Fix project_updates schema
-- Date: 2025-01-23
-- Description: Add workflow_history_id column to project_updates table

BEGIN;

-- Add workflow_history_id column to project_updates if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'project_updates'
        AND column_name = 'workflow_history_id'
    ) THEN
        ALTER TABLE public.project_updates
        ADD COLUMN workflow_history_id UUID REFERENCES public.workflow_history(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create index for the new column
CREATE INDEX IF NOT EXISTS idx_project_updates_workflow_history_id
ON public.project_updates(workflow_history_id);

COMMIT;

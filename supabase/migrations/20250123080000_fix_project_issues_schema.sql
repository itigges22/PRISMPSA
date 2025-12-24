-- Fix project_issues schema
-- Date: 2025-01-23
-- Description: Add workflow_history_id column to project_issues table

BEGIN;

-- Add workflow_history_id column to project_issues if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'project_issues'
        AND column_name = 'workflow_history_id'
    ) THEN
        ALTER TABLE public.project_issues
        ADD COLUMN workflow_history_id UUID REFERENCES public.workflow_history(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create index for the new column
CREATE INDEX IF NOT EXISTS idx_project_issues_workflow_history_id
ON public.project_issues(workflow_history_id);

COMMIT;

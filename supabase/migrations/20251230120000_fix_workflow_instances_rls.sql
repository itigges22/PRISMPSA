-- Fix: Workflow Instances RLS Violation on Project Creation
-- Problem: When creating a project with a workflow, the INSERT policy only checks
-- project_assignments table, but the project creator isn't in that table yet.
-- Solution: Create a new function that also checks if user is the project creator.

-- Create function that checks both project_assignments AND project creator/assignee
CREATE OR REPLACE FUNCTION public.user_can_start_project_workflow(check_project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  RETURN EXISTS (
    -- Check project_assignments table
    SELECT 1 FROM public.project_assignments
    WHERE project_id = check_project_id
    AND user_id = auth.uid()
    AND removed_at IS NULL
  )
  OR EXISTS (
    -- Check if user is project creator or assigned user
    SELECT 1 FROM public.projects
    WHERE id = check_project_id
    AND (created_by = auth.uid() OR assigned_user_id = auth.uid())
  );
END;
$$;

ALTER FUNCTION public.user_can_start_project_workflow(uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.user_can_start_project_workflow(uuid) IS
'Checks if the current user can start a workflow on a project. Returns true if user is assigned to the project, or is the project creator/assignee. Uses SECURITY DEFINER to bypass RLS.';

-- Grant permissions on the new function
GRANT ALL ON FUNCTION public.user_can_start_project_workflow(uuid) TO anon;
GRANT ALL ON FUNCTION public.user_can_start_project_workflow(uuid) TO authenticated;
GRANT ALL ON FUNCTION public.user_can_start_project_workflow(uuid) TO service_role;

-- Drop the old INSERT policy
DROP POLICY IF EXISTS "workflow_instances_insert" ON public.workflow_instances;

-- Create the new INSERT policy using the new function
CREATE POLICY "workflow_instances_insert" ON public.workflow_instances
FOR INSERT WITH CHECK (
  public.user_is_superadmin()
  OR public.user_has_permission('execute_any_workflow'::text)
  OR (
    public.user_has_permission('execute_workflows'::text)
    AND public.user_can_start_project_workflow(project_id)
  )
);

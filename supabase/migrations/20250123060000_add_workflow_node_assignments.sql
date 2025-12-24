-- Add workflow_node_assignments table
-- Date: 2025-01-23
-- Description: Add table for pre-assigning users to workflow steps (pipeline feature)

BEGIN;

-- ============================================================================
-- TABLE: workflow_node_assignments
-- ============================================================================
-- Stores pre-assignments of users to workflow nodes
-- Used for "pipeline" feature - showing users what steps they're assigned to
-- before the workflow reaches that step

CREATE TABLE IF NOT EXISTS public.workflow_node_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id UUID NOT NULL REFERENCES public.workflow_nodes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    workflow_instance_id UUID NOT NULL REFERENCES public.workflow_instances(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    assigned_by UUID REFERENCES public.user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(node_id, user_id, workflow_instance_id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_node_assignments_node_id ON public.workflow_node_assignments(node_id);
CREATE INDEX IF NOT EXISTS idx_workflow_node_assignments_user_id ON public.workflow_node_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_node_assignments_workflow_instance_id ON public.workflow_node_assignments(workflow_instance_id);

-- ============================================================================
-- RLS POLICIES: workflow_node_assignments
-- ============================================================================

ALTER TABLE public.workflow_node_assignments ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can see their own assignments, superadmins see all
CREATE POLICY "workflow_node_assignments_select" ON public.workflow_node_assignments
FOR SELECT
USING (
    user_is_superadmin()
    OR user_has_permission('view_all_projects')
    OR user_id = auth.uid()
    -- Also allow access if user can see the project
    OR user_is_project_assigned(
        (SELECT project_id FROM workflow_instances WHERE id = workflow_instance_id)
    )
);

-- INSERT: Users with manage_workflows or manage_all_projects
CREATE POLICY "workflow_node_assignments_insert" ON public.workflow_node_assignments
FOR INSERT
WITH CHECK (
    user_is_superadmin()
    OR user_has_permission('manage_all_workflows')
    OR user_has_permission('manage_all_projects')
    OR (
        user_has_permission('manage_workflows')
        AND user_is_project_assigned(
            (SELECT project_id FROM workflow_instances WHERE id = workflow_instance_id)
        )
    )
);

-- UPDATE: Users with manage_workflows or manage_all_projects
CREATE POLICY "workflow_node_assignments_update" ON public.workflow_node_assignments
FOR UPDATE
USING (
    user_is_superadmin()
    OR user_has_permission('manage_all_workflows')
    OR user_has_permission('manage_all_projects')
);

-- DELETE: Users with manage_workflows or manage_all_projects
CREATE POLICY "workflow_node_assignments_delete" ON public.workflow_node_assignments
FOR DELETE
USING (
    user_is_superadmin()
    OR user_has_permission('manage_all_workflows')
    OR user_has_permission('manage_all_projects')
);

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- SELECT * FROM workflow_node_assignments LIMIT 5;

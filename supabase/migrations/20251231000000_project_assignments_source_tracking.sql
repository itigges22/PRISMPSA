-- Migration: Add source tracking to project_assignments
-- This tracks whether a team member was added manually (collaborator),
-- via workflow step, or as the project creator

-- Add source_type column
ALTER TABLE "public"."project_assignments"
ADD COLUMN IF NOT EXISTS "source_type" "text" DEFAULT 'manual'::"text";

-- Add workflow_node_id for workflow-added members
ALTER TABLE "public"."project_assignments"
ADD COLUMN IF NOT EXISTS "workflow_node_id" "uuid";

-- Add workflow_node_label for display purposes
ALTER TABLE "public"."project_assignments"
ADD COLUMN IF NOT EXISTS "workflow_node_label" "text";

-- Add foreign key constraint for workflow_node_id
ALTER TABLE "public"."project_assignments"
ADD CONSTRAINT "project_assignments_workflow_node_id_fkey"
FOREIGN KEY ("workflow_node_id") REFERENCES "public"."workflow_nodes"("id") ON DELETE SET NULL;

-- Add check constraint for source_type
ALTER TABLE "public"."project_assignments"
ADD CONSTRAINT "project_assignments_source_type_check"
CHECK ("source_type" = ANY (ARRAY['manual'::"text", 'workflow'::"text", 'creator'::"text"]));

-- Update existing assignments:
-- Mark assignments with role_in_project = 'Project Creator' as 'creator' source
UPDATE "public"."project_assignments"
SET "source_type" = 'creator'
WHERE "role_in_project" = 'Project Creator';

-- Create index for faster lookups by source_type
CREATE INDEX IF NOT EXISTS "idx_project_assignments_source_type"
ON "public"."project_assignments" ("source_type");

-- Create index for faster lookups by workflow_node_id
CREATE INDEX IF NOT EXISTS "idx_project_assignments_workflow_node_id"
ON "public"."project_assignments" ("workflow_node_id");

COMMENT ON COLUMN "public"."project_assignments"."source_type" IS 'How this team member was added: manual (collaborator), workflow (via workflow step), or creator (project creator)';
COMMENT ON COLUMN "public"."project_assignments"."workflow_node_id" IS 'The workflow node that added this user (only set when source_type is workflow)';
COMMENT ON COLUMN "public"."project_assignments"."workflow_node_label" IS 'The label of the workflow node for display (only set when source_type is workflow)';

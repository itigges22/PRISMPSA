SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."auto_clock_out_stale_sessions"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  UPDATE public.clock_sessions
  SET
    clock_out_time = clock_in_time + INTERVAL '16 hours',
    is_active = false,
    is_auto_clock_out = true
  WHERE is_active = true
    AND clock_in_time < NOW() - INTERVAL '16 hours';
END;
$$;


ALTER FUNCTION "public"."auto_clock_out_stale_sessions"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."auto_clock_out_stale_sessions"() IS 'Automatically closes clock sessions that have been active for more than 16 hours. Prevents overnight sessions from corrupting data.';



CREATE OR REPLACE FUNCTION "public"."get_project_stakeholders"("project_uuid" "uuid") RETURNS TABLE("id" "uuid", "user_id" "uuid", "role" "text", "user_name" "text", "user_email" "text", "user_image" "text", "added_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        ps.id,
        ps.user_id,
        ps.role,
        up.name AS user_name,
        up.email AS user_email,
        up.image AS user_image,
        ps.added_at
    FROM public.project_stakeholders ps
    LEFT JOIN public.user_profiles up ON ps.user_id = up.id
    WHERE ps.project_id = project_uuid
    ORDER BY ps.added_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_project_stakeholders"("project_uuid" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_project_stakeholders"("project_uuid" "uuid") IS 'Returns all stakeholders for a project with their user profile information. Uses SECURITY DEFINER to bypass RLS.';



CREATE OR REPLACE FUNCTION "public"."get_week_start_date"("input_date" "date") RETURNS "date"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  -- ISO 8601: Monday = 1, Sunday = 7
  -- Subtract days to get to Monday
  RETURN input_date - (EXTRACT(ISODOW FROM input_date)::INTEGER - 1);
END;
$$;


ALTER FUNCTION "public"."get_week_start_date"("input_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_week_start_date"("input_date" "date") IS 'Returns Monday of the week for a given date using ISO 8601 standard (Monday = week start).';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email)
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_new_user"() IS 'Automatically creates a user_profiles entry when a new auth.users record is inserted.';



CREATE OR REPLACE FUNCTION "public"."is_superadmin"("user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Check is_superadmin flag
  IF EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = is_superadmin.user_id
    AND is_superadmin = TRUE
  ) THEN
    RETURN TRUE;
  END IF;

  -- Check for Superadmin role
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = is_superadmin.user_id
    AND r.is_system_role = TRUE
    AND LOWER(r.name) = 'superadmin'
  );
END;
$$;


ALTER FUNCTION "public"."is_superadmin"("user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_superadmin"("user_id" "uuid") IS 'Checks if a specific user is a superadmin. Backwards compatibility wrapper.';



CREATE OR REPLACE FUNCTION "public"."update_dashboard_preferences_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_dashboard_preferences_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_updated_at_column"() IS 'Automatically updates the updated_at column to NOW() when a row is modified.';



CREATE OR REPLACE FUNCTION "public"."user_can_access_project"("check_project_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  proj_account_id uuid;
BEGIN
  -- Get the project's account_id
  SELECT account_id INTO proj_account_id
  FROM public.projects
  WHERE id = check_project_id;

  -- Check access: assigned, creator, or account manager
  RETURN (
    user_is_project_assigned(check_project_id)
    OR user_is_project_creator(check_project_id)
    OR (proj_account_id IS NOT NULL AND user_is_account_manager(proj_account_id))
  );
END;
$$;


ALTER FUNCTION "public"."user_can_access_project"("check_project_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."user_can_access_project"("check_project_id" "uuid") IS 'Checks if the current user can access a specific project (assigned, creator, or account manager). Uses SECURITY DEFINER to bypass RLS.';



CREATE OR REPLACE FUNCTION "public"."user_can_manage_workflow"("workflow_instance_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM workflow_instances wi
    LEFT JOIN project_assignments pa ON pa.project_id = wi.project_id AND pa.removed_at IS NULL
    LEFT JOIN projects p ON p.id = wi.project_id
    WHERE wi.id = user_can_manage_workflow.workflow_instance_id
    AND (
      user_is_superadmin()
      OR user_has_permission('manage_all_workflows')
      OR (
        user_has_permission('execute_workflows')
        AND pa.user_id = auth.uid()
        AND pa.removed_at IS NULL
      )
    )
  );
END;
$$;


ALTER FUNCTION "public"."user_can_manage_workflow"("workflow_instance_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."user_can_manage_workflow"("workflow_instance_id" "uuid") IS 'Checks if the current user can manage a specific workflow instance.';



CREATE OR REPLACE FUNCTION "public"."user_can_view_workflow"("workflow_instance_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Single query, bypasses nested RLS via SECURITY DEFINER
  RETURN EXISTS (
    SELECT 1
    FROM workflow_instances wi
    LEFT JOIN project_assignments pa ON pa.project_id = wi.project_id AND pa.removed_at IS NULL
    LEFT JOIN projects p ON p.id = wi.project_id
    LEFT JOIN tasks t ON t.id = wi.task_id
    WHERE wi.id = user_can_view_workflow.workflow_instance_id
    AND (
      user_is_superadmin()
      OR user_has_permission('view_all_workflows')
      OR (pa.user_id = auth.uid() AND pa.removed_at IS NULL)
      OR t.assigned_to = auth.uid()
      OR p.created_by = auth.uid()
      OR p.assigned_user_id = auth.uid()
    )
  );
END;
$$;


ALTER FUNCTION "public"."user_can_view_workflow"("workflow_instance_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."user_can_view_workflow"("workflow_instance_id" "uuid") IS 'Checks if the current user can view a specific workflow instance. Uses SECURITY DEFINER to prevent nested RLS performance issues.';



CREATE OR REPLACE FUNCTION "public"."user_has_permission"("permission_name" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Check if user has permission via their roles
  -- Runs with creator privileges (SECURITY DEFINER), bypassing RLS
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND (r.permissions->permission_name)::boolean = TRUE
  );
END;
$$;


ALTER FUNCTION "public"."user_has_permission"("permission_name" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."user_has_permission"("permission_name" "text") IS 'Checks if the current user has a specific permission. Uses SECURITY DEFINER to bypass RLS and prevent circular dependency.';



CREATE OR REPLACE FUNCTION "public"."user_is_account_manager"("check_account_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.accounts
    WHERE id = check_account_id
    AND account_manager_id = auth.uid()
  );
END;
$$;


ALTER FUNCTION "public"."user_is_account_manager"("check_account_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."user_is_account_manager"("check_account_id" "uuid") IS 'Checks if the current user is the account manager for a specific account. Uses SECURITY DEFINER to bypass RLS and prevent circular dependency.';



CREATE OR REPLACE FUNCTION "public"."user_is_account_member"("check_account_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.account_members
    WHERE account_id = check_account_id
    AND user_id = auth.uid()
  );
END;
$$;


ALTER FUNCTION "public"."user_is_account_member"("check_account_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."user_is_account_member"("check_account_id" "uuid") IS 'Checks if the current user is a member of a specific account. Uses SECURITY DEFINER to bypass RLS and prevent circular dependency.';



CREATE OR REPLACE FUNCTION "public"."user_is_project_assigned"("check_project_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.project_assignments
    WHERE project_id = check_project_id
    AND user_id = auth.uid()
    AND removed_at IS NULL
  );
END;
$$;


ALTER FUNCTION "public"."user_is_project_assigned"("check_project_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."user_is_project_assigned"("check_project_id" "uuid") IS 'Checks if the current user is assigned to a specific project. Uses SECURITY DEFINER to bypass RLS and prevent circular dependency.';



CREATE OR REPLACE FUNCTION "public"."user_is_project_creator"("check_project_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = check_project_id
    AND created_by = auth.uid()
  );
END;
$$;


ALTER FUNCTION "public"."user_is_project_creator"("check_project_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."user_is_project_creator"("check_project_id" "uuid") IS 'Checks if the current user created a specific project. Uses SECURITY DEFINER to bypass RLS and prevent circular dependency.';



CREATE OR REPLACE FUNCTION "public"."user_can_start_project_workflow"("check_project_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."user_can_start_project_workflow"("check_project_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."user_can_start_project_workflow"("check_project_id" "uuid") IS 'Checks if the current user can start a workflow on a project. Returns true if user is assigned to the project, or is the project creator/assignee. Uses SECURITY DEFINER to bypass RLS.';



CREATE OR REPLACE FUNCTION "public"."user_is_superadmin"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Fast path: Check is_superadmin flag first
  IF EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND is_superadmin = TRUE
  ) THEN
    RETURN TRUE;
  END IF;

  -- Fallback: Check for Superadmin role (legacy support)
  -- Bypasses RLS via SECURITY DEFINER
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.is_system_role = TRUE
    AND LOWER(r.name) = 'superadmin'
  );
END;
$$;


ALTER FUNCTION "public"."user_is_superadmin"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."user_is_superadmin"() IS 'Checks if the current user is a superadmin. Uses SECURITY DEFINER to bypass RLS and prevent circular dependency.';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."account_kanban_configs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "account_id" "uuid" NOT NULL,
    "columns" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."account_kanban_configs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."account_members" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."account_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."accounts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "primary_contact_email" "text",
    "primary_contact_name" "text",
    "account_manager_id" "uuid",
    "service_tier" "text",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "accounts_service_tier_check" CHECK (("service_tier" = ANY (ARRAY['basic'::"text", 'premium'::"text", 'enterprise'::"text"]))),
    CONSTRAINT "accounts_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'suspended'::"text"])))
);


ALTER TABLE "public"."accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_feedback" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "submitted_by" "uuid",
    "rating" integer,
    "feedback_text" "text",
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "client_feedback_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."client_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_portal_invitations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "account_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "invited_by" "uuid",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    CONSTRAINT "client_portal_invitations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."client_portal_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clock_sessions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "clock_in_time" timestamp with time zone NOT NULL,
    "clock_out_time" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "is_auto_clock_out" boolean DEFAULT false,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."clock_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deliverables" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "project_id" "uuid" NOT NULL,
    "task_id" "uuid",
    "status" "text" DEFAULT 'draft'::"text",
    "submitted_by" "uuid",
    "approved_by" "uuid",
    "submitted_at" timestamp with time zone,
    "approved_at" timestamp with time zone,
    "feedback" "text",
    "file_url" "text",
    "version" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "deliverables_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'pending_review'::"text", 'approved'::"text", 'rejected'::"text", 'revised'::"text"])))
);


ALTER TABLE "public"."deliverables" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."departments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."departments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."form_responses" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "form_template_id" "uuid",
    "workflow_history_id" "uuid",
    "submitted_by" "uuid",
    "response_data" "jsonb" NOT NULL,
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."form_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."form_templates" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "schema" "jsonb" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."form_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."milestones" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "date" "date" NOT NULL,
    "color" "text" DEFAULT '#3b82f6'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."milestones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."newsletters" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "created_by" "uuid",
    "is_published" boolean DEFAULT false,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."newsletters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "type" "text",
    "read" boolean DEFAULT false,
    "link" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_assignments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role_in_project" "text",
    "assigned_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "assigned_by" "uuid",
    "removed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source_type" "text" DEFAULT 'manual'::"text",
    "workflow_node_id" "uuid",
    "workflow_node_label" "text",
    CONSTRAINT "project_assignments_source_type_check" CHECK ("source_type" = ANY (ARRAY['manual'::"text", 'workflow'::"text", 'creator'::"text"]))
);


ALTER TABLE "public"."project_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_issues" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text",
    "created_by" "uuid",
    "resolved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "workflow_history_id" "uuid",
    CONSTRAINT "project_issues_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'resolved'::"text"])))
);


ALTER TABLE "public"."project_issues" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_stakeholders" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text",
    "added_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "added_by" "uuid"
);


ALTER TABLE "public"."project_stakeholders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_updates" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "workflow_history_id" "uuid"
);


ALTER TABLE "public"."project_updates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "account_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'planning'::"text",
    "priority" "text" DEFAULT 'medium'::"text",
    "start_date" "date",
    "end_date" "date",
    "estimated_hours" numeric(10,2),
    "actual_hours" numeric(10,2) DEFAULT 0,
    "remaining_hours" numeric(10,2),
    "created_by" "uuid",
    "assigned_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "projects_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "projects_status_check" CHECK (("status" = ANY (ARRAY['planning'::"text", 'in_progress'::"text", 'review'::"text", 'complete'::"text", 'on_hold'::"text"])))
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_hierarchy_audit" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "role_id" "uuid" NOT NULL,
    "changed_by" "uuid",
    "action" "text" NOT NULL,
    "old_reporting_role_id" "uuid",
    "new_reporting_role_id" "uuid",
    "old_hierarchy_level" integer,
    "new_hierarchy_level" integer,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."role_hierarchy_audit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "department_id" "uuid",
    "description" "text",
    "permissions" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_system_role" boolean DEFAULT false NOT NULL,
    "hierarchy_level" integer DEFAULT 0,
    "display_order" integer DEFAULT 0,
    "reporting_role_id" "uuid",
    "chart_position_x" double precision,
    "chart_position_y" double precision,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_dependencies" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "depends_on_task_id" "uuid" NOT NULL,
    "dependency_type" "text" DEFAULT 'finish_to_start'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "task_dependencies_dependency_type_check" CHECK (("dependency_type" = ANY (ARRAY['finish_to_start'::"text", 'start_to_start'::"text", 'finish_to_finish'::"text", 'start_to_finish'::"text"])))
);


ALTER TABLE "public"."task_dependencies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_week_allocations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "week_start_date" "date" NOT NULL,
    "allocated_hours" numeric(5,2) NOT NULL,
    "assigned_user_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."task_week_allocations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "project_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'todo'::"text",
    "priority" "text" DEFAULT 'medium'::"text",
    "start_date" "date",
    "due_date" "date",
    "estimated_hours" numeric(10,2),
    "actual_hours" numeric(10,2) DEFAULT 0,
    "remaining_hours" numeric(10,2),
    "assigned_to" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tasks_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "tasks_status_check" CHECK (("status" = ANY (ARRAY['backlog'::"text", 'todo'::"text", 'in_progress'::"text", 'review'::"text", 'done'::"text", 'blocked'::"text"])))
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."time_entries" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "task_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "hours_logged" numeric(5,2) NOT NULL,
    "entry_date" "date" NOT NULL,
    "week_start_date" "date" NOT NULL,
    "description" "text",
    "clock_session_id" "uuid",
    "clock_in_time" timestamp with time zone,
    "clock_out_time" timestamp with time zone,
    "is_auto_clock_out" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "time_entries_hours_logged_check" CHECK ((("hours_logged" > (0)::numeric) AND ("hours_logged" <= (24)::numeric)))
);


ALTER TABLE "public"."time_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_availability" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "week_start_date" "date" NOT NULL,
    "available_hours" numeric(5,2) DEFAULT 40 NOT NULL,
    "schedule_data" "jsonb",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_availability_available_hours_check" CHECK ((("available_hours" >= (0)::numeric) AND ("available_hours" <= (168)::numeric)))
);


ALTER TABLE "public"."user_availability" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_dashboard_preferences" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "widget_config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_dashboard_preferences" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_dashboard_preferences" IS 'Stores user dashboard customization settings';



COMMENT ON COLUMN "public"."user_dashboard_preferences"."widget_config" IS 'JSON object containing widget visibility, order, and size preferences. Structure: { widgets: [{ id, type, visible, order, size }], theme?: "compact"|"comfortable" }';



CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text" NOT NULL,
    "image" "text",
    "bio" "text",
    "skills" "text"[],
    "workload_sentiment" "text",
    "is_superadmin" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_profiles_workload_sentiment_check" CHECK (("workload_sentiment" = ANY (ARRAY['comfortable'::"text", 'stretched'::"text", 'overwhelmed'::"text"])))
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "assigned_by" "uuid"
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."weekly_capacity_summary" AS
 SELECT "ua"."user_id",
    "ua"."week_start_date",
    "ua"."available_hours",
    COALESCE("sum"("twa"."allocated_hours"), (0)::numeric) AS "allocated_hours",
    COALESCE("sum"("te"."hours_logged"), (0)::numeric) AS "actual_hours",
        CASE
            WHEN ("ua"."available_hours" > (0)::numeric) THEN ((COALESCE("sum"("te"."hours_logged"), (0)::numeric) / "ua"."available_hours") * (100)::numeric)
            ELSE (0)::numeric
        END AS "utilization_rate",
    ("ua"."available_hours" - COALESCE("sum"("te"."hours_logged"), (0)::numeric)) AS "remaining_capacity",
        CASE
            WHEN (COALESCE("sum"("twa"."allocated_hours"), (0)::numeric) > "ua"."available_hours") THEN true
            ELSE false
        END AS "is_over_allocated",
    "count"(DISTINCT "twa"."task_id") AS "active_task_count"
   FROM (("public"."user_availability" "ua"
     LEFT JOIN "public"."task_week_allocations" "twa" ON ((("twa"."assigned_user_id" = "ua"."user_id") AND ("twa"."week_start_date" = "ua"."week_start_date"))))
     LEFT JOIN "public"."time_entries" "te" ON ((("te"."user_id" = "ua"."user_id") AND ("te"."week_start_date" = "ua"."week_start_date"))))
  GROUP BY "ua"."user_id", "ua"."week_start_date", "ua"."available_hours";


ALTER TABLE "public"."weekly_capacity_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."weekly_capacity_summary" IS 'Aggregates weekly capacity metrics for users including availability, allocations, actual hours, and utilization rate.';



CREATE TABLE IF NOT EXISTS "public"."workflow_active_steps" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "workflow_instance_id" "uuid" NOT NULL,
    "node_id" "uuid" NOT NULL,
    "branch_id" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    "assigned_user_id" "uuid",
    "activated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "aggregate_decision" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "workflow_active_steps_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text", 'waiting'::"text"])))
);


ALTER TABLE "public"."workflow_active_steps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workflow_connections" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "workflow_template_id" "uuid" NOT NULL,
    "from_node_id" "uuid" NOT NULL,
    "to_node_id" "uuid" NOT NULL,
    "condition" "jsonb",
    "label" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."workflow_connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workflow_history" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "workflow_instance_id" "uuid" NOT NULL,
    "from_node_id" "uuid",
    "to_node_id" "uuid",
    "transitioned_by" "uuid",
    "transition_type" "text",
    "notes" "text",
    "form_response_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "workflow_history_transition_type_check" CHECK (("transition_type" = ANY (ARRAY['normal'::"text", 'out_of_order'::"text", 'auto'::"text"])))
);


ALTER TABLE "public"."workflow_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workflow_instances" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "workflow_template_id" "uuid",
    "project_id" "uuid",
    "task_id" "uuid",
    "current_node_id" "uuid",
    "status" "text" DEFAULT 'active'::"text",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "started_snapshot" "jsonb",
    "completed_snapshot" "jsonb",
    CONSTRAINT "workflow_instances_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."workflow_instances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workflow_node_assignments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "node_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "workflow_instance_id" "uuid" NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "assigned_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."workflow_node_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workflow_nodes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "workflow_template_id" "uuid" NOT NULL,
    "node_type" "text" NOT NULL,
    "entity_id" "uuid",
    "label" "text" NOT NULL,
    "settings" "jsonb",
    "form_template_id" "uuid",
    "position_x" double precision,
    "position_y" double precision,
    "step_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "workflow_nodes_node_type_check" CHECK (("node_type" = ANY (ARRAY['start'::"text", 'role'::"text", 'approval'::"text", 'form'::"text", 'conditional'::"text", 'end'::"text"])))
);


ALTER TABLE "public"."workflow_nodes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workflow_templates" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_by" "uuid",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."workflow_templates" OWNER TO "postgres";


ALTER TABLE ONLY "public"."account_kanban_configs"
    ADD CONSTRAINT "account_kanban_configs_account_id_key" UNIQUE ("account_id");



ALTER TABLE ONLY "public"."account_kanban_configs"
    ADD CONSTRAINT "account_kanban_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."account_members"
    ADD CONSTRAINT "account_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."account_members"
    ADD CONSTRAINT "account_members_user_id_account_id_key" UNIQUE ("user_id", "account_id");



ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_feedback"
    ADD CONSTRAINT "client_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_portal_invitations"
    ADD CONSTRAINT "client_portal_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clock_sessions"
    ADD CONSTRAINT "clock_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deliverables"
    ADD CONSTRAINT "deliverables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."form_responses"
    ADD CONSTRAINT "form_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."form_templates"
    ADD CONSTRAINT "form_templates_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."form_templates"
    ADD CONSTRAINT "form_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."milestones"
    ADD CONSTRAINT "milestones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."newsletters"
    ADD CONSTRAINT "newsletters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_assignments"
    ADD CONSTRAINT "project_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_issues"
    ADD CONSTRAINT "project_issues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_stakeholders"
    ADD CONSTRAINT "project_stakeholders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_updates"
    ADD CONSTRAINT "project_updates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_hierarchy_audit"
    ADD CONSTRAINT "role_hierarchy_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_dependencies"
    ADD CONSTRAINT "task_dependencies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_week_allocations"
    ADD CONSTRAINT "task_week_allocations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_week_allocations"
    ADD CONSTRAINT "task_week_allocations_task_id_week_start_date_assigned_user_key" UNIQUE ("task_id", "week_start_date", "assigned_user_id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."time_entries"
    ADD CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_availability"
    ADD CONSTRAINT "user_availability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_availability"
    ADD CONSTRAINT "user_availability_user_id_week_start_date_key" UNIQUE ("user_id", "week_start_date");



ALTER TABLE ONLY "public"."user_dashboard_preferences"
    ADD CONSTRAINT "user_dashboard_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_dashboard_preferences"
    ADD CONSTRAINT "user_dashboard_preferences_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_id_key" UNIQUE ("user_id", "role_id");



ALTER TABLE ONLY "public"."workflow_active_steps"
    ADD CONSTRAINT "workflow_active_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workflow_connections"
    ADD CONSTRAINT "workflow_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workflow_history"
    ADD CONSTRAINT "workflow_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workflow_instances"
    ADD CONSTRAINT "workflow_instances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workflow_node_assignments"
    ADD CONSTRAINT "workflow_node_assignments_node_id_user_id_workflow_instance_key" UNIQUE ("node_id", "user_id", "workflow_instance_id");



ALTER TABLE ONLY "public"."workflow_node_assignments"
    ADD CONSTRAINT "workflow_node_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workflow_nodes"
    ADD CONSTRAINT "workflow_nodes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workflow_templates"
    ADD CONSTRAINT "workflow_templates_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."workflow_templates"
    ADD CONSTRAINT "workflow_templates_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_account_kanban_configs_account_id" ON "public"."account_kanban_configs" USING "btree" ("account_id");



CREATE INDEX "idx_account_members_account_id" ON "public"."account_members" USING "btree" ("account_id");



CREATE INDEX "idx_account_members_user_id" ON "public"."account_members" USING "btree" ("user_id");



CREATE INDEX "idx_accounts_account_manager_id" ON "public"."accounts" USING "btree" ("account_manager_id");



CREATE INDEX "idx_accounts_status" ON "public"."accounts" USING "btree" ("status");



CREATE INDEX "idx_client_feedback_project_id" ON "public"."client_feedback" USING "btree" ("project_id");



CREATE INDEX "idx_client_portal_invitations_account_id" ON "public"."client_portal_invitations" USING "btree" ("account_id");



CREATE INDEX "idx_client_portal_invitations_email" ON "public"."client_portal_invitations" USING "btree" ("email");



CREATE INDEX "idx_clock_sessions_is_active" ON "public"."clock_sessions" USING "btree" ("is_active");



CREATE INDEX "idx_clock_sessions_user_id" ON "public"."clock_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_dashboard_preferences_user_id" ON "public"."user_dashboard_preferences" USING "btree" ("user_id");



CREATE INDEX "idx_deliverables_project_id" ON "public"."deliverables" USING "btree" ("project_id");



CREATE INDEX "idx_deliverables_status" ON "public"."deliverables" USING "btree" ("status");



CREATE INDEX "idx_form_responses_form_template_id" ON "public"."form_responses" USING "btree" ("form_template_id");



CREATE INDEX "idx_form_responses_submitted_by" ON "public"."form_responses" USING "btree" ("submitted_by");



CREATE INDEX "idx_newsletters_is_published" ON "public"."newsletters" USING "btree" ("is_published");



CREATE INDEX "idx_notifications_read" ON "public"."notifications" USING "btree" ("read");



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_project_assignments_project_id" ON "public"."project_assignments" USING "btree" ("project_id");



CREATE INDEX "idx_project_assignments_removed_at" ON "public"."project_assignments" USING "btree" ("removed_at");



CREATE INDEX "idx_project_assignments_user_id" ON "public"."project_assignments" USING "btree" ("user_id");


CREATE INDEX "idx_project_assignments_source_type" ON "public"."project_assignments" USING "btree" ("source_type");


CREATE INDEX "idx_project_assignments_workflow_node_id" ON "public"."project_assignments" USING "btree" ("workflow_node_id");


CREATE INDEX "idx_project_issues_project_id" ON "public"."project_issues" USING "btree" ("project_id");



CREATE INDEX "idx_project_issues_status" ON "public"."project_issues" USING "btree" ("status");



CREATE INDEX "idx_project_issues_workflow_history_id" ON "public"."project_issues" USING "btree" ("workflow_history_id");



CREATE INDEX "idx_project_stakeholders_project_id" ON "public"."project_stakeholders" USING "btree" ("project_id");



CREATE INDEX "idx_project_stakeholders_user_id" ON "public"."project_stakeholders" USING "btree" ("user_id");



CREATE INDEX "idx_project_updates_project_id" ON "public"."project_updates" USING "btree" ("project_id");



CREATE INDEX "idx_project_updates_workflow_history_id" ON "public"."project_updates" USING "btree" ("workflow_history_id");



CREATE INDEX "idx_projects_account_id" ON "public"."projects" USING "btree" ("account_id");



CREATE INDEX "idx_projects_assigned_user_id" ON "public"."projects" USING "btree" ("assigned_user_id");



CREATE INDEX "idx_projects_created_by" ON "public"."projects" USING "btree" ("created_by");



CREATE INDEX "idx_projects_status" ON "public"."projects" USING "btree" ("status");



CREATE INDEX "idx_role_hierarchy_audit_role_id" ON "public"."role_hierarchy_audit" USING "btree" ("role_id");



CREATE INDEX "idx_roles_department_id" ON "public"."roles" USING "btree" ("department_id");



CREATE INDEX "idx_roles_is_system_role" ON "public"."roles" USING "btree" ("is_system_role");



CREATE INDEX "idx_roles_reporting_role_id" ON "public"."roles" USING "btree" ("reporting_role_id");



CREATE INDEX "idx_task_dependencies_depends_on_task_id" ON "public"."task_dependencies" USING "btree" ("depends_on_task_id");



CREATE INDEX "idx_task_dependencies_task_id" ON "public"."task_dependencies" USING "btree" ("task_id");



CREATE INDEX "idx_task_week_allocations_assigned_user_id" ON "public"."task_week_allocations" USING "btree" ("assigned_user_id");



CREATE INDEX "idx_task_week_allocations_task_id" ON "public"."task_week_allocations" USING "btree" ("task_id");



CREATE INDEX "idx_task_week_allocations_week_start_date" ON "public"."task_week_allocations" USING "btree" ("week_start_date");



CREATE INDEX "idx_tasks_assigned_to" ON "public"."tasks" USING "btree" ("assigned_to");



CREATE INDEX "idx_tasks_project_id" ON "public"."tasks" USING "btree" ("project_id");



CREATE INDEX "idx_tasks_status" ON "public"."tasks" USING "btree" ("status");



CREATE INDEX "idx_time_entries_entry_date" ON "public"."time_entries" USING "btree" ("entry_date");



CREATE INDEX "idx_time_entries_project_id" ON "public"."time_entries" USING "btree" ("project_id");



CREATE INDEX "idx_time_entries_task_id" ON "public"."time_entries" USING "btree" ("task_id");



CREATE INDEX "idx_time_entries_user_id" ON "public"."time_entries" USING "btree" ("user_id");



CREATE INDEX "idx_time_entries_week_start_date" ON "public"."time_entries" USING "btree" ("week_start_date");



CREATE INDEX "idx_user_availability_user_id" ON "public"."user_availability" USING "btree" ("user_id");



CREATE INDEX "idx_user_availability_week_start_date" ON "public"."user_availability" USING "btree" ("week_start_date");



CREATE INDEX "idx_user_profiles_email" ON "public"."user_profiles" USING "btree" ("email");



CREATE INDEX "idx_user_profiles_is_superadmin" ON "public"."user_profiles" USING "btree" ("is_superadmin");



CREATE INDEX "idx_user_roles_role_id" ON "public"."user_roles" USING "btree" ("role_id");



CREATE INDEX "idx_user_roles_user_id" ON "public"."user_roles" USING "btree" ("user_id");



CREATE INDEX "idx_workflow_active_steps_node_id" ON "public"."workflow_active_steps" USING "btree" ("node_id");



CREATE INDEX "idx_workflow_active_steps_status" ON "public"."workflow_active_steps" USING "btree" ("status");



CREATE INDEX "idx_workflow_active_steps_workflow_instance_id" ON "public"."workflow_active_steps" USING "btree" ("workflow_instance_id");



CREATE INDEX "idx_workflow_connections_from_node_id" ON "public"."workflow_connections" USING "btree" ("from_node_id");



CREATE INDEX "idx_workflow_connections_to_node_id" ON "public"."workflow_connections" USING "btree" ("to_node_id");



CREATE INDEX "idx_workflow_connections_workflow_template_id" ON "public"."workflow_connections" USING "btree" ("workflow_template_id");



CREATE INDEX "idx_workflow_history_workflow_instance_id" ON "public"."workflow_history" USING "btree" ("workflow_instance_id");



CREATE INDEX "idx_workflow_instances_project_id" ON "public"."workflow_instances" USING "btree" ("project_id");



CREATE INDEX "idx_workflow_instances_status" ON "public"."workflow_instances" USING "btree" ("status");



CREATE INDEX "idx_workflow_instances_workflow_template_id" ON "public"."workflow_instances" USING "btree" ("workflow_template_id");



CREATE INDEX "idx_workflow_node_assignments_node_id" ON "public"."workflow_node_assignments" USING "btree" ("node_id");



CREATE INDEX "idx_workflow_node_assignments_user_id" ON "public"."workflow_node_assignments" USING "btree" ("user_id");



CREATE INDEX "idx_workflow_node_assignments_workflow_instance_id" ON "public"."workflow_node_assignments" USING "btree" ("workflow_instance_id");



CREATE INDEX "idx_workflow_nodes_node_type" ON "public"."workflow_nodes" USING "btree" ("node_type");



CREATE INDEX "idx_workflow_nodes_workflow_template_id" ON "public"."workflow_nodes" USING "btree" ("workflow_template_id");



CREATE OR REPLACE TRIGGER "trigger_update_dashboard_preferences_updated_at" BEFORE UPDATE ON "public"."user_dashboard_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_dashboard_preferences_updated_at"();



CREATE OR REPLACE TRIGGER "update_account_kanban_configs_updated_at" BEFORE UPDATE ON "public"."account_kanban_configs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_accounts_updated_at" BEFORE UPDATE ON "public"."accounts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_deliverables_updated_at" BEFORE UPDATE ON "public"."deliverables" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_departments_updated_at" BEFORE UPDATE ON "public"."departments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_form_templates_updated_at" BEFORE UPDATE ON "public"."form_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_newsletters_updated_at" BEFORE UPDATE ON "public"."newsletters" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_project_assignments_updated_at" BEFORE UPDATE ON "public"."project_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_project_issues_updated_at" BEFORE UPDATE ON "public"."project_issues" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_project_updates_updated_at" BEFORE UPDATE ON "public"."project_updates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_projects_updated_at" BEFORE UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_roles_updated_at" BEFORE UPDATE ON "public"."roles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_task_week_allocations_updated_at" BEFORE UPDATE ON "public"."task_week_allocations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tasks_updated_at" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_time_entries_updated_at" BEFORE UPDATE ON "public"."time_entries" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_availability_updated_at" BEFORE UPDATE ON "public"."user_availability" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_profiles_updated_at" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_workflow_templates_updated_at" BEFORE UPDATE ON "public"."workflow_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."account_kanban_configs"
    ADD CONSTRAINT "account_kanban_configs_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."account_members"
    ADD CONSTRAINT "account_members_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."account_members"
    ADD CONSTRAINT "account_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_account_manager_id_fkey" FOREIGN KEY ("account_manager_id") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."client_feedback"
    ADD CONSTRAINT "client_feedback_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_feedback"
    ADD CONSTRAINT "client_feedback_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."client_portal_invitations"
    ADD CONSTRAINT "client_portal_invitations_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_portal_invitations"
    ADD CONSTRAINT "client_portal_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."clock_sessions"
    ADD CONSTRAINT "clock_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deliverables"
    ADD CONSTRAINT "deliverables_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."deliverables"
    ADD CONSTRAINT "deliverables_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deliverables"
    ADD CONSTRAINT "deliverables_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."deliverables"
    ADD CONSTRAINT "deliverables_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id");



ALTER TABLE ONLY "public"."form_responses"
    ADD CONSTRAINT "fk_form_responses_workflow_history" FOREIGN KEY ("workflow_history_id") REFERENCES "public"."workflow_history"("id");



ALTER TABLE ONLY "public"."form_responses"
    ADD CONSTRAINT "form_responses_form_template_id_fkey" FOREIGN KEY ("form_template_id") REFERENCES "public"."form_templates"("id");



ALTER TABLE ONLY "public"."form_responses"
    ADD CONSTRAINT "form_responses_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."form_templates"
    ADD CONSTRAINT "form_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."newsletters"
    ADD CONSTRAINT "newsletters_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_assignments"
    ADD CONSTRAINT "project_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."project_assignments"
    ADD CONSTRAINT "project_assignments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_assignments"
    ADD CONSTRAINT "project_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."project_assignments"
    ADD CONSTRAINT "project_assignments_workflow_node_id_fkey" FOREIGN KEY ("workflow_node_id") REFERENCES "public"."workflow_nodes"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."project_issues"
    ADD CONSTRAINT "project_issues_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."project_issues"
    ADD CONSTRAINT "project_issues_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_issues"
    ADD CONSTRAINT "project_issues_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."project_issues"
    ADD CONSTRAINT "project_issues_workflow_history_id_fkey" FOREIGN KEY ("workflow_history_id") REFERENCES "public"."workflow_history"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_stakeholders"
    ADD CONSTRAINT "project_stakeholders_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."project_stakeholders"
    ADD CONSTRAINT "project_stakeholders_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_stakeholders"
    ADD CONSTRAINT "project_stakeholders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_updates"
    ADD CONSTRAINT "project_updates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."project_updates"
    ADD CONSTRAINT "project_updates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_updates"
    ADD CONSTRAINT "project_updates_workflow_history_id_fkey" FOREIGN KEY ("workflow_history_id") REFERENCES "public"."workflow_history"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."role_hierarchy_audit"
    ADD CONSTRAINT "role_hierarchy_audit_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."role_hierarchy_audit"
    ADD CONSTRAINT "role_hierarchy_audit_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_reporting_role_id_fkey" FOREIGN KEY ("reporting_role_id") REFERENCES "public"."roles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_dependencies"
    ADD CONSTRAINT "task_dependencies_depends_on_task_id_fkey" FOREIGN KEY ("depends_on_task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_dependencies"
    ADD CONSTRAINT "task_dependencies_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_week_allocations"
    ADD CONSTRAINT "task_week_allocations_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."task_week_allocations"
    ADD CONSTRAINT "task_week_allocations_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_entries"
    ADD CONSTRAINT "time_entries_clock_session_id_fkey" FOREIGN KEY ("clock_session_id") REFERENCES "public"."clock_sessions"("id");



ALTER TABLE ONLY "public"."time_entries"
    ADD CONSTRAINT "time_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_entries"
    ADD CONSTRAINT "time_entries_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_entries"
    ADD CONSTRAINT "time_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_availability"
    ADD CONSTRAINT "user_availability_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_dashboard_preferences"
    ADD CONSTRAINT "user_dashboard_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workflow_active_steps"
    ADD CONSTRAINT "workflow_active_steps_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."workflow_active_steps"
    ADD CONSTRAINT "workflow_active_steps_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "public"."workflow_nodes"("id");



ALTER TABLE ONLY "public"."workflow_active_steps"
    ADD CONSTRAINT "workflow_active_steps_workflow_instance_id_fkey" FOREIGN KEY ("workflow_instance_id") REFERENCES "public"."workflow_instances"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workflow_connections"
    ADD CONSTRAINT "workflow_connections_from_node_id_fkey" FOREIGN KEY ("from_node_id") REFERENCES "public"."workflow_nodes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workflow_connections"
    ADD CONSTRAINT "workflow_connections_to_node_id_fkey" FOREIGN KEY ("to_node_id") REFERENCES "public"."workflow_nodes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workflow_connections"
    ADD CONSTRAINT "workflow_connections_workflow_template_id_fkey" FOREIGN KEY ("workflow_template_id") REFERENCES "public"."workflow_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workflow_history"
    ADD CONSTRAINT "workflow_history_form_response_id_fkey" FOREIGN KEY ("form_response_id") REFERENCES "public"."form_responses"("id");



ALTER TABLE ONLY "public"."workflow_history"
    ADD CONSTRAINT "workflow_history_from_node_id_fkey" FOREIGN KEY ("from_node_id") REFERENCES "public"."workflow_nodes"("id");



ALTER TABLE ONLY "public"."workflow_history"
    ADD CONSTRAINT "workflow_history_to_node_id_fkey" FOREIGN KEY ("to_node_id") REFERENCES "public"."workflow_nodes"("id");



ALTER TABLE ONLY "public"."workflow_history"
    ADD CONSTRAINT "workflow_history_transitioned_by_fkey" FOREIGN KEY ("transitioned_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."workflow_history"
    ADD CONSTRAINT "workflow_history_workflow_instance_id_fkey" FOREIGN KEY ("workflow_instance_id") REFERENCES "public"."workflow_instances"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workflow_instances"
    ADD CONSTRAINT "workflow_instances_current_node_id_fkey" FOREIGN KEY ("current_node_id") REFERENCES "public"."workflow_nodes"("id");



ALTER TABLE ONLY "public"."workflow_instances"
    ADD CONSTRAINT "workflow_instances_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workflow_instances"
    ADD CONSTRAINT "workflow_instances_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."workflow_instances"
    ADD CONSTRAINT "workflow_instances_workflow_template_id_fkey" FOREIGN KEY ("workflow_template_id") REFERENCES "public"."workflow_templates"("id");



ALTER TABLE ONLY "public"."workflow_node_assignments"
    ADD CONSTRAINT "workflow_node_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."workflow_node_assignments"
    ADD CONSTRAINT "workflow_node_assignments_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "public"."workflow_nodes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workflow_node_assignments"
    ADD CONSTRAINT "workflow_node_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workflow_node_assignments"
    ADD CONSTRAINT "workflow_node_assignments_workflow_instance_id_fkey" FOREIGN KEY ("workflow_instance_id") REFERENCES "public"."workflow_instances"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workflow_nodes"
    ADD CONSTRAINT "workflow_nodes_form_template_id_fkey" FOREIGN KEY ("form_template_id") REFERENCES "public"."form_templates"("id");



ALTER TABLE ONLY "public"."workflow_nodes"
    ADD CONSTRAINT "workflow_nodes_workflow_template_id_fkey" FOREIGN KEY ("workflow_template_id") REFERENCES "public"."workflow_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workflow_templates"
    ADD CONSTRAINT "workflow_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id");



CREATE POLICY "Users can delete own dashboard preferences" ON "public"."user_dashboard_preferences" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own dashboard preferences" ON "public"."user_dashboard_preferences" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own dashboard preferences" ON "public"."user_dashboard_preferences" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own dashboard preferences" ON "public"."user_dashboard_preferences" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."account_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "account_members_delete" ON "public"."account_members" FOR DELETE USING (("public"."user_is_superadmin"() OR "public"."user_has_permission"('manage_users_in_accounts'::"text") OR "public"."user_is_account_manager"("account_id")));



CREATE POLICY "account_members_insert" ON "public"."account_members" FOR INSERT WITH CHECK (("public"."user_is_superadmin"() OR "public"."user_has_permission"('manage_users_in_accounts'::"text") OR "public"."user_is_account_manager"("account_id")));



CREATE POLICY "account_members_select" ON "public"."account_members" FOR SELECT USING (("public"."user_is_superadmin"() OR "public"."user_has_permission"('view_all_accounts'::"text") OR ("user_id" = "auth"."uid"()) OR "public"."user_is_account_manager"("account_id")));



CREATE POLICY "account_members_update" ON "public"."account_members" FOR UPDATE USING ("public"."user_is_superadmin"());



ALTER TABLE "public"."accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "accounts_delete" ON "public"."accounts" FOR DELETE USING (("public"."user_is_superadmin"() OR "public"."user_has_permission"('manage_accounts'::"text")));



CREATE POLICY "accounts_insert" ON "public"."accounts" FOR INSERT WITH CHECK (("public"."user_is_superadmin"() OR "public"."user_has_permission"('manage_accounts'::"text")));



CREATE POLICY "accounts_select" ON "public"."accounts" FOR SELECT USING (("public"."user_is_superadmin"() OR "public"."user_has_permission"('view_all_accounts'::"text") OR (EXISTS ( SELECT 1
   FROM ("public"."project_assignments" "pa"
     JOIN "public"."projects" "p" ON (("p"."id" = "pa"."project_id")))
  WHERE (("p"."account_id" = "accounts"."id") AND ("pa"."user_id" = "auth"."uid"()) AND ("pa"."removed_at" IS NULL)))) OR ("public"."user_has_permission"('view_accounts'::"text") AND ((EXISTS ( SELECT 1
   FROM "public"."account_members" "am"
  WHERE (("am"."account_id" = "accounts"."id") AND ("am"."user_id" = "auth"."uid"())))) OR ("account_manager_id" = "auth"."uid"())))));



CREATE POLICY "accounts_update" ON "public"."accounts" FOR UPDATE USING (("public"."user_is_superadmin"() OR "public"."user_has_permission"('manage_accounts'::"text") OR ("account_manager_id" = "auth"."uid"())));



ALTER TABLE "public"."departments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "departments_delete" ON "public"."departments" FOR DELETE USING ("public"."user_is_superadmin"());



CREATE POLICY "departments_insert" ON "public"."departments" FOR INSERT WITH CHECK (("public"."user_is_superadmin"() OR "public"."user_has_permission"('manage_departments'::"text")));



CREATE POLICY "departments_select" ON "public"."departments" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "departments_update" ON "public"."departments" FOR UPDATE USING (("public"."user_is_superadmin"() OR "public"."user_has_permission"('manage_departments'::"text")));



ALTER TABLE "public"."project_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "project_assignments_delete" ON "public"."project_assignments" FOR DELETE USING ("public"."user_is_superadmin"());



CREATE POLICY "project_assignments_insert" ON "public"."project_assignments" FOR INSERT WITH CHECK (("public"."user_is_superadmin"() OR "public"."user_has_permission"('manage_all_projects'::"text") OR ("public"."user_has_permission"('manage_projects'::"text") AND "public"."user_is_project_creator"("project_id"))));



CREATE POLICY "project_assignments_select" ON "public"."project_assignments" FOR SELECT USING (("public"."user_is_superadmin"() OR "public"."user_has_permission"('view_all_projects'::"text") OR ("user_id" = "auth"."uid"()) OR "public"."user_is_project_creator"("project_id") OR "public"."user_is_project_assigned"("project_id")));



CREATE POLICY "project_assignments_update" ON "public"."project_assignments" FOR UPDATE USING (("public"."user_is_superadmin"() OR "public"."user_has_permission"('manage_all_projects'::"text") OR ("public"."user_has_permission"('manage_projects'::"text") AND "public"."user_is_project_creator"("project_id"))));



ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "projects_delete" ON "public"."projects" FOR DELETE USING (("public"."user_is_superadmin"() OR "public"."user_has_permission"('manage_all_projects'::"text") OR ("public"."user_has_permission"('manage_projects'::"text") AND ("created_by" = "auth"."uid"()))));



CREATE POLICY "projects_insert" ON "public"."projects" FOR INSERT WITH CHECK (("public"."user_is_superadmin"() OR "public"."user_has_permission"('manage_all_projects'::"text") OR ("public"."user_has_permission"('manage_projects'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."account_members" "am"
  WHERE (("am"."account_id" = "projects"."account_id") AND ("am"."user_id" = "auth"."uid"())))))));



CREATE POLICY "projects_select" ON "public"."projects" FOR SELECT USING (("public"."user_is_superadmin"() OR "public"."user_has_permission"('view_all_projects'::"text") OR ("public"."user_has_permission"('view_projects'::"text") AND ((EXISTS ( SELECT 1
   FROM "public"."project_assignments" "pa"
  WHERE (("pa"."project_id" = "projects"."id") AND ("pa"."user_id" = "auth"."uid"()) AND ("pa"."removed_at" IS NULL)))) OR "public"."user_is_account_manager"("account_id") OR ("created_by" = "auth"."uid"())))));



CREATE POLICY "projects_update" ON "public"."projects" FOR UPDATE USING (("public"."user_is_superadmin"() OR "public"."user_has_permission"('manage_all_projects'::"text") OR ("public"."user_has_permission"('manage_projects'::"text") AND ((EXISTS ( SELECT 1
   FROM "public"."project_assignments" "pa"
  WHERE (("pa"."project_id" = "projects"."id") AND ("pa"."user_id" = "auth"."uid"()) AND ("pa"."removed_at" IS NULL)))) OR ("created_by" = "auth"."uid"())))));



ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "roles_delete" ON "public"."roles" FOR DELETE USING (("public"."user_is_superadmin"() AND ("is_system_role" = false)));



CREATE POLICY "roles_insert" ON "public"."roles" FOR INSERT WITH CHECK (("public"."user_is_superadmin"() OR "public"."user_has_permission"('manage_departments'::"text")));



CREATE POLICY "roles_select" ON "public"."roles" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "roles_update" ON "public"."roles" FOR UPDATE USING (("public"."user_is_superadmin"() OR "public"."user_has_permission"('manage_departments'::"text")));



ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tasks_delete" ON "public"."tasks" FOR DELETE USING (("public"."user_is_superadmin"() OR "public"."user_has_permission"('manage_all_projects'::"text") OR "public"."user_has_permission"('view_all_projects'::"text") OR ("created_by" = "auth"."uid"()) OR ("public"."user_has_permission"('view_projects'::"text") AND ((EXISTS ( SELECT 1
   FROM "public"."project_assignments" "pa"
  WHERE (("pa"."project_id" = "tasks"."project_id") AND ("pa"."user_id" = "auth"."uid"()) AND ("pa"."removed_at" IS NULL)))) OR (EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE (("p"."id" = "tasks"."project_id") AND ("p"."created_by" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM ("public"."projects" "p"
     JOIN "public"."accounts" "a" ON (("a"."id" = "p"."account_id")))
  WHERE (("p"."id" = "tasks"."project_id") AND ("a"."account_manager_id" = "auth"."uid"()))))))));



CREATE POLICY "tasks_insert" ON "public"."tasks" FOR INSERT WITH CHECK (("public"."user_is_superadmin"() OR "public"."user_has_permission"('manage_all_projects'::"text") OR "public"."user_has_permission"('view_all_projects'::"text") OR ("public"."user_has_permission"('view_projects'::"text") AND ((EXISTS ( SELECT 1
   FROM "public"."project_assignments" "pa"
  WHERE (("pa"."project_id" = "tasks"."project_id") AND ("pa"."user_id" = "auth"."uid"()) AND ("pa"."removed_at" IS NULL)))) OR (EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE (("p"."id" = "tasks"."project_id") AND ("p"."created_by" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM ("public"."projects" "p"
     JOIN "public"."accounts" "a" ON (("a"."id" = "p"."account_id")))
  WHERE (("p"."id" = "tasks"."project_id") AND ("a"."account_manager_id" = "auth"."uid"()))))))));



CREATE POLICY "tasks_select" ON "public"."tasks" FOR SELECT USING (("public"."user_is_superadmin"() OR "public"."user_has_permission"('view_all_projects'::"text") OR ("public"."user_has_permission"('view_projects'::"text") AND (("assigned_to" = "auth"."uid"()) OR ("created_by" = "auth"."uid"()) OR "public"."user_is_project_assigned"("project_id")))));



CREATE POLICY "tasks_update" ON "public"."tasks" FOR UPDATE USING (("public"."user_is_superadmin"() OR "public"."user_has_permission"('manage_all_projects'::"text") OR "public"."user_has_permission"('view_all_projects'::"text") OR ("assigned_to" = "auth"."uid"()) OR ("created_by" = "auth"."uid"()) OR ("public"."user_has_permission"('view_projects'::"text") AND ((EXISTS ( SELECT 1
   FROM "public"."project_assignments" "pa"
  WHERE (("pa"."project_id" = "tasks"."project_id") AND ("pa"."user_id" = "auth"."uid"()) AND ("pa"."removed_at" IS NULL)))) OR (EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE (("p"."id" = "tasks"."project_id") AND ("p"."created_by" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM ("public"."projects" "p"
     JOIN "public"."accounts" "a" ON (("a"."id" = "p"."account_id")))
  WHERE (("p"."id" = "tasks"."project_id") AND ("a"."account_manager_id" = "auth"."uid"()))))))));



ALTER TABLE "public"."time_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "time_entries_delete" ON "public"."time_entries" FOR DELETE USING (("public"."user_is_superadmin"() OR "public"."user_has_permission"('manage_time'::"text") OR (("user_id" = "auth"."uid"()) AND ("entry_date" >= (CURRENT_DATE - '14 days'::interval)))));



CREATE POLICY "time_entries_insert" ON "public"."time_entries" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."user_is_superadmin"() OR "public"."user_has_permission"('manage_time'::"text")));



CREATE POLICY "time_entries_select" ON "public"."time_entries" FOR SELECT USING (("public"."user_is_superadmin"() OR "public"."user_has_permission"('view_all_time_entries'::"text") OR ("user_id" = "auth"."uid"()) OR ("public"."user_has_permission"('view_time_entries'::"text") AND "public"."user_is_project_assigned"("project_id"))));



CREATE POLICY "time_entries_update" ON "public"."time_entries" FOR UPDATE USING (("public"."user_is_superadmin"() OR "public"."user_has_permission"('manage_time'::"text") OR (("user_id" = "auth"."uid"()) AND ("entry_date" >= (CURRENT_DATE - '14 days'::interval)))));



ALTER TABLE "public"."user_dashboard_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_profiles_delete" ON "public"."user_profiles" FOR DELETE USING ("public"."user_is_superadmin"());



CREATE POLICY "user_profiles_insert" ON "public"."user_profiles" FOR INSERT WITH CHECK (("public"."user_is_superadmin"() OR ("auth"."uid"() = "id")));



CREATE POLICY "user_profiles_select" ON "public"."user_profiles" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "user_profiles_update" ON "public"."user_profiles" FOR UPDATE USING ((("auth"."uid"() = "id") OR "public"."user_is_superadmin"() OR "public"."user_has_permission"('manage_users'::"text")));



ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_roles_delete" ON "public"."user_roles" FOR DELETE USING (("public"."user_is_superadmin"() OR "public"."user_has_permission"('manage_user_roles'::"text")));



CREATE POLICY "user_roles_insert" ON "public"."user_roles" FOR INSERT WITH CHECK (("public"."user_is_superadmin"() OR "public"."user_has_permission"('manage_user_roles'::"text")));



CREATE POLICY "user_roles_select" ON "public"."user_roles" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."user_is_superadmin"()));



CREATE POLICY "user_roles_update" ON "public"."user_roles" FOR UPDATE USING (("public"."user_is_superadmin"() OR "public"."user_has_permission"('manage_user_roles'::"text")));



ALTER TABLE "public"."workflow_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "workflow_history_delete" ON "public"."workflow_history" FOR DELETE USING ("public"."user_is_superadmin"());



CREATE POLICY "workflow_history_insert" ON "public"."workflow_history" FOR INSERT WITH CHECK ("public"."user_can_manage_workflow"("workflow_instance_id"));



CREATE POLICY "workflow_history_select" ON "public"."workflow_history" FOR SELECT USING ("public"."user_can_view_workflow"("workflow_instance_id"));



CREATE POLICY "workflow_history_update" ON "public"."workflow_history" FOR UPDATE USING ("public"."user_is_superadmin"());



ALTER TABLE "public"."workflow_instances" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "workflow_instances_delete" ON "public"."workflow_instances" FOR DELETE USING (("public"."user_is_superadmin"() OR "public"."user_has_permission"('manage_all_workflows'::"text")));



CREATE POLICY "workflow_instances_insert" ON "public"."workflow_instances" FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_superadmin = TRUE)
  OR "public"."user_has_permission"('execute_any_workflow'::"text")
  OR ("public"."user_has_permission"('execute_workflows'::"text") AND "public"."user_can_start_project_workflow"("project_id"))
);



CREATE POLICY "workflow_instances_select" ON "public"."workflow_instances" FOR SELECT USING ("public"."user_is_superadmin"() OR "public"."user_has_permission"('view_all_workflows'::"text") OR "public"."user_has_permission"('execute_any_workflow'::"text") OR "public"."user_has_permission"('manage_all_workflows'::"text") OR "public"."user_can_view_workflow"("id"));



CREATE POLICY "workflow_instances_update" ON "public"."workflow_instances" FOR UPDATE USING ("public"."user_can_manage_workflow"("id"));



ALTER TABLE "public"."workflow_node_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "workflow_node_assignments_delete" ON "public"."workflow_node_assignments" FOR DELETE USING (("public"."user_is_superadmin"() OR "public"."user_has_permission"('manage_all_workflows'::"text") OR "public"."user_has_permission"('manage_all_projects'::"text")));



CREATE POLICY "workflow_node_assignments_insert" ON "public"."workflow_node_assignments" FOR INSERT WITH CHECK (("public"."user_is_superadmin"() OR "public"."user_has_permission"('manage_all_workflows'::"text") OR "public"."user_has_permission"('manage_all_projects'::"text") OR ("public"."user_has_permission"('manage_workflows'::"text") AND "public"."user_is_project_assigned"(( SELECT "workflow_instances"."project_id"
   FROM "public"."workflow_instances"
  WHERE ("workflow_instances"."id" = "workflow_node_assignments"."workflow_instance_id"))))));



CREATE POLICY "workflow_node_assignments_select" ON "public"."workflow_node_assignments" FOR SELECT USING (("public"."user_is_superadmin"() OR "public"."user_has_permission"('view_all_projects'::"text") OR ("user_id" = "auth"."uid"()) OR "public"."user_is_project_assigned"(( SELECT "workflow_instances"."project_id"
   FROM "public"."workflow_instances"
  WHERE ("workflow_instances"."id" = "workflow_node_assignments"."workflow_instance_id")))));



CREATE POLICY "workflow_node_assignments_update" ON "public"."workflow_node_assignments" FOR UPDATE USING (("public"."user_is_superadmin"() OR "public"."user_has_permission"('manage_all_workflows'::"text") OR "public"."user_has_permission"('manage_all_projects'::"text")));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_clock_out_stale_sessions"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_clock_out_stale_sessions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_clock_out_stale_sessions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_project_stakeholders"("project_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_project_stakeholders"("project_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_project_stakeholders"("project_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_week_start_date"("input_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_week_start_date"("input_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_week_start_date"("input_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_superadmin"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_superadmin"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_superadmin"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_dashboard_preferences_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_dashboard_preferences_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_dashboard_preferences_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_can_access_project"("check_project_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_can_access_project"("check_project_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_can_access_project"("check_project_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_can_manage_workflow"("workflow_instance_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_can_manage_workflow"("workflow_instance_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_can_manage_workflow"("workflow_instance_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_can_view_workflow"("workflow_instance_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_can_view_workflow"("workflow_instance_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_can_view_workflow"("workflow_instance_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_permission"("permission_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_permission"("permission_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_permission"("permission_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_is_account_manager"("check_account_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_is_account_manager"("check_account_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_is_account_manager"("check_account_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_is_account_member"("check_account_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_is_account_member"("check_account_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_is_account_member"("check_account_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_is_project_assigned"("check_project_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_is_project_assigned"("check_project_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_is_project_assigned"("check_project_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_is_project_creator"("check_project_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_is_project_creator"("check_project_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_is_project_creator"("check_project_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_can_start_project_workflow"("check_project_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_can_start_project_workflow"("check_project_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_can_start_project_workflow"("check_project_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_is_superadmin"() TO "anon";
GRANT ALL ON FUNCTION "public"."user_is_superadmin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_is_superadmin"() TO "service_role";



GRANT ALL ON TABLE "public"."account_kanban_configs" TO "anon";
GRANT ALL ON TABLE "public"."account_kanban_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."account_kanban_configs" TO "service_role";



GRANT ALL ON TABLE "public"."account_members" TO "anon";
GRANT ALL ON TABLE "public"."account_members" TO "authenticated";
GRANT ALL ON TABLE "public"."account_members" TO "service_role";



GRANT ALL ON TABLE "public"."accounts" TO "anon";
GRANT ALL ON TABLE "public"."accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."accounts" TO "service_role";



GRANT ALL ON TABLE "public"."client_feedback" TO "anon";
GRANT ALL ON TABLE "public"."client_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."client_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."client_portal_invitations" TO "anon";
GRANT ALL ON TABLE "public"."client_portal_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."client_portal_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."clock_sessions" TO "anon";
GRANT ALL ON TABLE "public"."clock_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."clock_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."deliverables" TO "anon";
GRANT ALL ON TABLE "public"."deliverables" TO "authenticated";
GRANT ALL ON TABLE "public"."deliverables" TO "service_role";



GRANT ALL ON TABLE "public"."departments" TO "anon";
GRANT ALL ON TABLE "public"."departments" TO "authenticated";
GRANT ALL ON TABLE "public"."departments" TO "service_role";



GRANT ALL ON TABLE "public"."form_responses" TO "anon";
GRANT ALL ON TABLE "public"."form_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."form_responses" TO "service_role";



GRANT ALL ON TABLE "public"."form_templates" TO "anon";
GRANT ALL ON TABLE "public"."form_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."form_templates" TO "service_role";



GRANT ALL ON TABLE "public"."milestones" TO "anon";
GRANT ALL ON TABLE "public"."milestones" TO "authenticated";
GRANT ALL ON TABLE "public"."milestones" TO "service_role";



GRANT ALL ON TABLE "public"."newsletters" TO "anon";
GRANT ALL ON TABLE "public"."newsletters" TO "authenticated";
GRANT ALL ON TABLE "public"."newsletters" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."project_assignments" TO "anon";
GRANT ALL ON TABLE "public"."project_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."project_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."project_issues" TO "anon";
GRANT ALL ON TABLE "public"."project_issues" TO "authenticated";
GRANT ALL ON TABLE "public"."project_issues" TO "service_role";



GRANT ALL ON TABLE "public"."project_stakeholders" TO "anon";
GRANT ALL ON TABLE "public"."project_stakeholders" TO "authenticated";
GRANT ALL ON TABLE "public"."project_stakeholders" TO "service_role";



GRANT ALL ON TABLE "public"."project_updates" TO "anon";
GRANT ALL ON TABLE "public"."project_updates" TO "authenticated";
GRANT ALL ON TABLE "public"."project_updates" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON TABLE "public"."role_hierarchy_audit" TO "anon";
GRANT ALL ON TABLE "public"."role_hierarchy_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."role_hierarchy_audit" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON TABLE "public"."task_dependencies" TO "anon";
GRANT ALL ON TABLE "public"."task_dependencies" TO "authenticated";
GRANT ALL ON TABLE "public"."task_dependencies" TO "service_role";



GRANT ALL ON TABLE "public"."task_week_allocations" TO "anon";
GRANT ALL ON TABLE "public"."task_week_allocations" TO "authenticated";
GRANT ALL ON TABLE "public"."task_week_allocations" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."time_entries" TO "anon";
GRANT ALL ON TABLE "public"."time_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."time_entries" TO "service_role";



GRANT ALL ON TABLE "public"."user_availability" TO "anon";
GRANT ALL ON TABLE "public"."user_availability" TO "authenticated";
GRANT ALL ON TABLE "public"."user_availability" TO "service_role";



GRANT ALL ON TABLE "public"."user_dashboard_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_dashboard_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_dashboard_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."weekly_capacity_summary" TO "anon";
GRANT ALL ON TABLE "public"."weekly_capacity_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."weekly_capacity_summary" TO "service_role";



GRANT ALL ON TABLE "public"."workflow_active_steps" TO "anon";
GRANT ALL ON TABLE "public"."workflow_active_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."workflow_active_steps" TO "service_role";



GRANT ALL ON TABLE "public"."workflow_connections" TO "anon";
GRANT ALL ON TABLE "public"."workflow_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."workflow_connections" TO "service_role";



GRANT ALL ON TABLE "public"."workflow_history" TO "anon";
GRANT ALL ON TABLE "public"."workflow_history" TO "authenticated";
GRANT ALL ON TABLE "public"."workflow_history" TO "service_role";



GRANT ALL ON TABLE "public"."workflow_instances" TO "anon";
GRANT ALL ON TABLE "public"."workflow_instances" TO "authenticated";
GRANT ALL ON TABLE "public"."workflow_instances" TO "service_role";



GRANT ALL ON TABLE "public"."workflow_node_assignments" TO "anon";
GRANT ALL ON TABLE "public"."workflow_node_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."workflow_node_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."workflow_nodes" TO "anon";
GRANT ALL ON TABLE "public"."workflow_nodes" TO "authenticated";
GRANT ALL ON TABLE "public"."workflow_nodes" TO "service_role";



GRANT ALL ON TABLE "public"."workflow_templates" TO "anon";
GRANT ALL ON TABLE "public"."workflow_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."workflow_templates" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";







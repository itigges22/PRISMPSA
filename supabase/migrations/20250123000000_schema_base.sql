-- Base Schema Migration for MovaLab
-- Generated: December 22, 2025
-- This file contains the complete table structure from cloud Supabase
--
-- IMPORTANT: This file should be generated from your cloud database using:
-- supabase link --project-ref oomnezdhkmsfjlihkmui
-- supabase db pull
-- mv supabase/migrations/*_remote_schema.sql supabase/migrations/20250123_01_schema_base.sql
--
-- This version is a template showing the expected structure.

BEGIN;

-- ===========================================================================
-- ENABLE EXTENSIONS
-- ===========================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- Enable PostgreSQL cryptographic functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- ===========================================================================
-- CORE USER TABLES
-- ===========================================================================

-- User profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    image TEXT,
    bio TEXT,
    skills TEXT[],
    workload_sentiment TEXT CHECK (workload_sentiment IN ('comfortable', 'stretched', 'overwhelmed')),
    is_superadmin BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_superadmin ON public.user_profiles(is_superadmin);

-- ===========================================================================
-- ORGANIZATIONAL STRUCTURE
-- ===========================================================================

-- Departments
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Roles
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_system_role BOOLEAN DEFAULT false NOT NULL,
    hierarchy_level INTEGER DEFAULT 0,
    display_order INTEGER DEFAULT 0,
    reporting_role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
    chart_position_x FLOAT,
    chart_position_y FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_roles_department_id ON public.roles(department_id);
CREATE INDEX IF NOT EXISTS idx_roles_reporting_role_id ON public.roles(reporting_role_id);
CREATE INDEX IF NOT EXISTS idx_roles_is_system_role ON public.roles(is_system_role);

-- User roles (many-to-many)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    assigned_by UUID REFERENCES public.user_profiles(id),
    UNIQUE(user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles(role_id);

-- Role hierarchy audit trail
CREATE TABLE IF NOT EXISTS public.role_hierarchy_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    changed_by UUID REFERENCES public.user_profiles(id),
    action TEXT NOT NULL,
    old_reporting_role_id UUID,
    new_reporting_role_id UUID,
    old_hierarchy_level INTEGER,
    new_hierarchy_level INTEGER,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_role_hierarchy_audit_role_id ON public.role_hierarchy_audit(role_id);

-- ===========================================================================
-- ACCOUNTS & PROJECTS
-- ===========================================================================

-- Client accounts
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    primary_contact_email TEXT,
    primary_contact_name TEXT,
    account_manager_id UUID REFERENCES public.user_profiles(id),
    service_tier TEXT CHECK (service_tier IN ('basic', 'premium', 'enterprise')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_accounts_account_manager_id ON public.accounts(account_manager_id);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON public.accounts(status);

-- Account members (who has access to which accounts)
CREATE TABLE IF NOT EXISTS public.account_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(user_id, account_id)
);

CREATE INDEX IF NOT EXISTS idx_account_members_user_id ON public.account_members(user_id);
CREATE INDEX IF NOT EXISTS idx_account_members_account_id ON public.account_members(account_id);

-- Account Kanban configurations
CREATE TABLE IF NOT EXISTS public.account_kanban_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE UNIQUE,
    columns JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_account_kanban_configs_account_id ON public.account_kanban_configs(account_id);

-- Projects
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'planning' CHECK (status IN ('planning', 'in_progress', 'review', 'complete', 'on_hold')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    start_date DATE,
    end_date DATE,
    estimated_hours NUMERIC(10, 2),
    actual_hours NUMERIC(10, 2) DEFAULT 0,
    remaining_hours NUMERIC(10, 2),
    created_by UUID REFERENCES public.user_profiles(id),
    assigned_user_id UUID REFERENCES public.user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_account_id ON public.projects(account_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON public.projects(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_assigned_user_id ON public.projects(assigned_user_id);

-- Project assignments (who's working on what)
CREATE TABLE IF NOT EXISTS public.project_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    role_in_project TEXT,
    assigned_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    assigned_by UUID REFERENCES public.user_profiles(id),
    removed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_assignments_project_id ON public.project_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_assignments_user_id ON public.project_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_project_assignments_removed_at ON public.project_assignments(removed_at);

-- Project stakeholders (observers, approvers, etc.)
CREATE TABLE IF NOT EXISTS public.project_stakeholders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    role TEXT,
    added_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    added_by UUID REFERENCES public.user_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_project_stakeholders_project_id ON public.project_stakeholders(project_id);
CREATE INDEX IF NOT EXISTS idx_project_stakeholders_user_id ON public.project_stakeholders(user_id);

-- Project updates (status updates, journal entries)
CREATE TABLE IF NOT EXISTS public.project_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_by UUID REFERENCES public.user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_updates_project_id ON public.project_updates(project_id);

-- Project issues (blockers, problems)
CREATE TABLE IF NOT EXISTS public.project_issues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
    created_by UUID REFERENCES public.user_profiles(id),
    resolved_by UUID REFERENCES public.user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_project_issues_project_id ON public.project_issues(project_id);
CREATE INDEX IF NOT EXISTS idx_project_issues_status ON public.project_issues(status);

-- ===========================================================================
-- TASKS
-- ===========================================================================

-- Tasks
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'todo' CHECK (status IN ('backlog', 'todo', 'in_progress', 'review', 'done', 'blocked')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    start_date DATE,
    due_date DATE,
    estimated_hours NUMERIC(10, 2),
    actual_hours NUMERIC(10, 2) DEFAULT 0,
    remaining_hours NUMERIC(10, 2),
    assigned_to UUID REFERENCES public.user_profiles(id),
    created_by UUID REFERENCES public.user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);

-- Task dependencies (for Gantt charts)
CREATE TABLE IF NOT EXISTS public.task_dependencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    depends_on_task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    dependency_type TEXT DEFAULT 'finish_to_start' CHECK (dependency_type IN ('finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_task_dependencies_task_id ON public.task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends_on_task_id ON public.task_dependencies(depends_on_task_id);

-- ===========================================================================
-- TIME TRACKING & CAPACITY
-- ===========================================================================

-- User availability (weekly capacity)
CREATE TABLE IF NOT EXISTS public.user_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL,
    available_hours NUMERIC(5, 2) NOT NULL DEFAULT 40,
    schedule_data JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(user_id, week_start_date),
    CHECK (available_hours >= 0 AND available_hours <= 168)
);

CREATE INDEX IF NOT EXISTS idx_user_availability_user_id ON public.user_availability(user_id);
CREATE INDEX IF NOT EXISTS idx_user_availability_week_start_date ON public.user_availability(week_start_date);

-- Clock sessions (when users are actively working)
CREATE TABLE IF NOT EXISTS public.clock_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    clock_in_time TIMESTAMPTZ NOT NULL,
    clock_out_time TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    is_auto_clock_out BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_clock_sessions_user_id ON public.clock_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_clock_sessions_is_active ON public.clock_sessions(is_active);

-- Time entries (actual hours logged)
CREATE TABLE IF NOT EXISTS public.time_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    hours_logged NUMERIC(5, 2) NOT NULL CHECK (hours_logged > 0 AND hours_logged <= 24),
    entry_date DATE NOT NULL,
    week_start_date DATE NOT NULL,
    description TEXT,
    clock_session_id UUID REFERENCES public.clock_sessions(id),
    clock_in_time TIMESTAMPTZ,
    clock_out_time TIMESTAMPTZ,
    is_auto_clock_out BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON public.time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_task_id ON public.time_entries(task_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_project_id ON public.time_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_week_start_date ON public.time_entries(week_start_date);
CREATE INDEX IF NOT EXISTS idx_time_entries_entry_date ON public.time_entries(entry_date);

-- Task week allocations (planned hours per week)
CREATE TABLE IF NOT EXISTS public.task_week_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL,
    allocated_hours NUMERIC(5, 2) NOT NULL,
    assigned_user_id UUID REFERENCES public.user_profiles(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(task_id, week_start_date, assigned_user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_week_allocations_task_id ON public.task_week_allocations(task_id);
CREATE INDEX IF NOT EXISTS idx_task_week_allocations_week_start_date ON public.task_week_allocations(week_start_date);
CREATE INDEX IF NOT EXISTS idx_task_week_allocations_assigned_user_id ON public.task_week_allocations(assigned_user_id);

-- ===========================================================================
-- WORKFLOW SYSTEM
-- ===========================================================================

-- Form templates (dynamic forms)
CREATE TABLE IF NOT EXISTS public.form_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    schema JSONB NOT NULL,
    created_by UUID REFERENCES public.user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Workflow templates (reusable workflow definitions)
CREATE TABLE IF NOT EXISTS public.workflow_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_by UUID REFERENCES public.user_profiles(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Workflow nodes (individual steps in workflow)
CREATE TABLE IF NOT EXISTS public.workflow_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_template_id UUID NOT NULL REFERENCES public.workflow_templates(id) ON DELETE CASCADE,
    node_type TEXT NOT NULL CHECK (node_type IN ('start', 'department', 'role', 'approval', 'form', 'conditional', 'sync', 'end')),
    entity_id UUID,
    label TEXT NOT NULL,
    settings JSONB,
    form_template_id UUID REFERENCES public.form_templates(id),
    position_x FLOAT,
    position_y FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workflow_nodes_workflow_template_id ON public.workflow_nodes(workflow_template_id);
CREATE INDEX IF NOT EXISTS idx_workflow_nodes_node_type ON public.workflow_nodes(node_type);

-- Workflow connections (edges between nodes)
CREATE TABLE IF NOT EXISTS public.workflow_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_template_id UUID NOT NULL REFERENCES public.workflow_templates(id) ON DELETE CASCADE,
    from_node_id UUID NOT NULL REFERENCES public.workflow_nodes(id) ON DELETE CASCADE,
    to_node_id UUID NOT NULL REFERENCES public.workflow_nodes(id) ON DELETE CASCADE,
    condition JSONB,
    label TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workflow_connections_workflow_template_id ON public.workflow_connections(workflow_template_id);
CREATE INDEX IF NOT EXISTS idx_workflow_connections_from_node_id ON public.workflow_connections(from_node_id);
CREATE INDEX IF NOT EXISTS idx_workflow_connections_to_node_id ON public.workflow_connections(to_node_id);

-- Workflow instances (active workflow execution)
CREATE TABLE IF NOT EXISTS public.workflow_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_template_id UUID REFERENCES public.workflow_templates(id),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    current_node_id UUID REFERENCES public.workflow_nodes(id),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    completed_at TIMESTAMPTZ,
    started_snapshot JSONB,
    completed_snapshot JSONB
);

CREATE INDEX IF NOT EXISTS idx_workflow_instances_workflow_template_id ON public.workflow_instances(workflow_template_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_project_id ON public.workflow_instances(project_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_status ON public.workflow_instances(status);

-- Form responses (submitted form data)
CREATE TABLE IF NOT EXISTS public.form_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_template_id UUID REFERENCES public.form_templates(id),
    workflow_history_id UUID,
    submitted_by UUID REFERENCES public.user_profiles(id),
    response_data JSONB NOT NULL,
    submitted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_form_responses_form_template_id ON public.form_responses(form_template_id);
CREATE INDEX IF NOT EXISTS idx_form_responses_submitted_by ON public.form_responses(submitted_by);

-- Workflow history (audit trail of transitions)
CREATE TABLE IF NOT EXISTS public.workflow_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_instance_id UUID NOT NULL REFERENCES public.workflow_instances(id) ON DELETE CASCADE,
    from_node_id UUID REFERENCES public.workflow_nodes(id),
    to_node_id UUID REFERENCES public.workflow_nodes(id),
    transitioned_by UUID REFERENCES public.user_profiles(id),
    transition_type TEXT CHECK (transition_type IN ('normal', 'out_of_order', 'auto')),
    notes TEXT,
    form_response_id UUID REFERENCES public.form_responses(id),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workflow_history_workflow_instance_id ON public.workflow_history(workflow_instance_id);

-- Add foreign key constraint after workflow_history table exists
ALTER TABLE public.form_responses
  ADD CONSTRAINT fk_form_responses_workflow_history
  FOREIGN KEY (workflow_history_id) REFERENCES public.workflow_history(id);

-- Workflow active steps (current steps being worked on)
CREATE TABLE IF NOT EXISTS public.workflow_active_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_instance_id UUID NOT NULL REFERENCES public.workflow_instances(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES public.workflow_nodes(id),
    branch_id TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'waiting')),
    assigned_user_id UUID REFERENCES public.user_profiles(id),
    activated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    completed_at TIMESTAMPTZ,
    aggregate_decision TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workflow_active_steps_workflow_instance_id ON public.workflow_active_steps(workflow_instance_id);
CREATE INDEX IF NOT EXISTS idx_workflow_active_steps_node_id ON public.workflow_active_steps(node_id);
CREATE INDEX IF NOT EXISTS idx_workflow_active_steps_status ON public.workflow_active_steps(status);

-- ===========================================================================
-- DELIVERABLES & CLIENT PORTAL
-- ===========================================================================

-- Deliverables
CREATE TABLE IF NOT EXISTS public.deliverables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    task_id UUID REFERENCES public.tasks(id),
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'revised')),
    submitted_by UUID REFERENCES public.user_profiles(id),
    approved_by UUID REFERENCES public.user_profiles(id),
    submitted_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    feedback TEXT,
    file_url TEXT,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_deliverables_project_id ON public.deliverables(project_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_status ON public.deliverables(status);

-- Client portal invitations
CREATE TABLE IF NOT EXISTS public.client_portal_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    invited_by UUID REFERENCES public.user_profiles(id),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_client_portal_invitations_account_id ON public.client_portal_invitations(account_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_invitations_email ON public.client_portal_invitations(email);

-- Client feedback
CREATE TABLE IF NOT EXISTS public.client_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    submitted_by UUID REFERENCES public.user_profiles(id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    feedback_text TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_client_feedback_project_id ON public.client_feedback(project_id);

-- ===========================================================================
-- SUPPORTING TABLES
-- ===========================================================================

-- Newsletters
CREATE TABLE IF NOT EXISTS public.newsletters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_by UUID REFERENCES public.user_profiles(id),
    is_published BOOLEAN DEFAULT false,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_newsletters_is_published ON public.newsletters(is_published);

-- Milestones
CREATE TABLE IF NOT EXISTS public.milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    color TEXT DEFAULT '#3b82f6',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT,
    read BOOLEAN DEFAULT false,
    link TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);

COMMIT;

-- ===========================================================================
-- NOTES
-- ===========================================================================

-- Row Level Security (RLS) policies will be applied in:
-- 20250123_04_rls_policies_fixed.sql
--
-- Database functions will be created in:
-- 20250123_02_functions_fixed.sql
--
-- Database views will be created in:
-- 20250123_03_views.sql
--
-- Database triggers will be created in:
-- 20250123_05_triggers.sql

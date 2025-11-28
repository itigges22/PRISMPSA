# PRISM PSA - Comprehensive Feature List & Architecture Documentation

## Table of Contents
1. [Platform Overview](#platform-overview)
2. [System Architecture](#system-architecture)
3. [Database Architecture](#database-architecture)
4. [RBAC System (Role-Based Access Control)](#rbac-system-role-based-access-control)
5. [Core Features](#core-features)
6. [Data Relationships & Correlations](#data-relationships--correlations)
7. [User Workflows](#user-workflows)
8. [Technical Implementation](#technical-implementation)

---

## Platform Overview

**PRISM PSA** (Professional Service Automation) is an enterprise-grade project and resource management platform designed for professional services organizations. It provides comprehensive tools for managing client accounts, projects, departments, teams, capacity planning, time tracking, and organizational structure through a sophisticated role-based permission system.

### Key Value Propositions
- **Granular Permission Control**: 136 unique permissions across 15 categories
- **Multi-Dimensional Resource Planning**: Track capacity at user, department, and organization levels
- **Real-Time Capacity Management**: Week-by-week availability and utilization tracking
- **Flexible Organizational Structure**: Support for complex hierarchies with reporting relationships
- **Time Tracking & Clock Sessions**: Built-in time tracking with automatic clock-out protection
- **Client & Project Management**: Complete lifecycle management from planning to completion
- **Visual Project Management**: Kanban boards, Gantt charts, and table views

---

## System Architecture

### Technology Stack
- **Frontend**: Next.js 14+ (App Router), React, TypeScript
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: React Hooks + Server Components
- **Authentication**: Supabase Auth with Row Level Security

### Architecture Patterns
1. **Hybrid Permission System**: Base permissions + override permissions + context-aware checks
2. **Server-First Architecture**: Heavy use of Server Components for data fetching
3. **Client-Side Interactivity**: Strategic use of Client Components for dynamic features
4. **Service Layer Pattern**: Centralized business logic in service classes
5. **Row Level Security (RLS)**: Database-level security on all tables

---

## Database Architecture

### Core Tables & Their Purpose

#### User Management
**`user_profiles`** (RLS enabled)
- Central user identity table linked to Supabase Auth
- Fields: `id`, `email`, `name`, `image`, `bio`, `skills`, `workload_sentiment`, `is_superadmin`
- Purpose: Extended user profile beyond authentication
- Special: Links to auth.users via foreign key on id

**`user_roles`** (RLS enabled)
- Junction table for user-role assignments
- Fields: `id`, `user_id`, `role_id`, `assigned_at`, `assigned_by`
- Purpose: Many-to-many relationship between users and roles
- Importance: Core of RBAC system - determines all user permissions

#### Role & Permission System
**`roles`** (RLS enabled)
- Defines all roles in the system with their permissions
- Fields: `id`, `name`, `department_id`, `permissions` (JSONB), `reporting_role_id`, `hierarchy_level`, `is_system_role`, `display_order`, `chart_position_x`, `chart_position_y`
- Purpose: Central role definition with permission storage and org chart positioning
- Key Feature: `permissions` JSONB stores map of Permission → boolean
- Hierarchy: `reporting_role_id` creates reporting structure, `hierarchy_level` for depth
- System Roles: Flagged with `is_system_role` (Superadmin, Unassigned, etc.)

**`role_hierarchy_audit`** (RLS enabled)
- Audit trail for role hierarchy changes
- Fields: `id`, `role_id`, `changed_by`, `action`, `old_reporting_role_id`, `new_reporting_role_id`, `old_hierarchy_level`, `new_hierarchy_level`, `metadata`
- Purpose: Track who changed reporting relationships and when
- Compliance: Important for auditing organizational changes

#### Organizational Structure
**`departments`** (RLS enabled)
- Organizational departments
- Fields: `id`, `name`, `description`, `created_at`, `updated_at`
- Purpose: Group roles and users into business units
- Relationships: One department → many roles → many users

**`accounts`** (RLS enabled)
- Client/customer accounts
- Fields: `id`, `name`, `description`, `primary_contact_email`, `primary_contact_name`, `account_manager_id`, `service_tier`, `status`
- Service Tiers: basic, premium, enterprise
- Status: active, inactive, suspended
- Purpose: Represent client organizations

**`account_members`** (RLS enabled)
- Junction table for user-account assignments
- Fields: `id`, `user_id`, `account_id`, `created_at`
- Purpose: Track which users have access to which accounts
- Access Pattern: Users can access accounts they're members of or manage

#### Project Management
**`projects`** (RLS enabled)
- Core project entity
- Fields: `id`, `name`, `description`, `account_id`, `status`, `priority`, `start_date`, `end_date`, `estimated_hours`, `actual_hours`, `remaining_hours`, `created_by`, `assigned_user_id`, `updates`, `issues_roadblocks`
- Status: planning, in_progress, review, complete, on_hold
- Priority: low, medium, high, urgent
- Purpose: Track client deliverables and work packages
- Department Derivation: Via project_assignments → user_roles → roles → departments

**`project_assignments`** (RLS enabled)
- User assignments to projects
- Fields: `id`, `project_id`, `user_id`, `role_in_project`, `assigned_at`, `assigned_by`, `removed_at`
- Purpose: Track which users work on which projects in which capacity
- Soft Delete: Uses `removed_at` for historical tracking
- Department Link: User's role determines which department is working on project

**`project_stakeholders`** (RLS enabled)
- Additional project stakeholders beyond assignments
- Fields: `id`, `project_id`, `user_id`, `role`, `added_at`, `added_by`
- Purpose: Track observers, approvers, and other interested parties
- Auto-populated: `role` field derives from user_roles table

**`project_updates`** (RLS enabled)
- Journal-style project status updates
- Fields: `id`, `project_id`, `content`, `created_by`, `created_at`, `updated_at`
- Purpose: Historical record of project progress
- Feature: Displayed on dashboard and project detail pages

**`project_issues`** (RLS enabled)
- Project blockers and problems
- Fields: `id`, `project_id`, `content`, `status`, `created_by`, `resolved_by`, `created_at`, `resolved_at`
- Status: open, in_progress, resolved
- Purpose: Track and resolve project impediments

#### Task Management
**`tasks`** (RLS enabled)
- Individual work items within projects
- Fields: `id`, `name`, `description`, `project_id`, `status`, `priority`, `start_date`, `due_date`, `estimated_hours`, `actual_hours`, `remaining_hours`, `assigned_to`, `created_by`
- Status: backlog, todo, in_progress, review, done, blocked
- Purpose: Granular work breakdown
- Auto-assignment: When user is assigned, they get project access
- Remaining Hours: When set to 0, task auto-moves to done

**`task_assignments`** (No RLS)
- Historical task assignments (legacy - being phased out)
- Fields: `id`, `task_id`, `user_id`, `assigned_at`, `assigned_by`
- Purpose: Track assignment history

**`task_dependencies`** (No RLS)
- Task dependency relationships
- Fields: `id`, `task_id`, `depends_on_task_id`, `dependency_type`
- Types: finish_to_start, start_to_start, finish_to_finish, start_to_finish
- Purpose: Define task ordering constraints

#### Capacity Planning & Time Tracking
**`user_availability`** (RLS enabled)
- Weekly work capacity per user
- Fields: `id`, `user_id`, `week_start_date` (Monday), `available_hours`, `schedule_data` (JSONB), `notes`
- Default: 40 hours/week if not set
- Purpose: Define how many hours user can work each week
- Schedule Data: Day-by-day breakdown {monday: 8, tuesday: 8, ...}
- Constraint: Max 168 hours (full week)

**`time_entries`** (RLS enabled)
- Actual time logged on tasks
- Fields: `id`, `task_id`, `user_id`, `project_id`, `hours_logged`, `entry_date`, `week_start_date`, `description`, `clock_session_id`, `clock_in_time`, `clock_out_time`, `is_auto_clock_out`
- Purpose: Track actual work performed
- Constraint: Max 24 hours per entry
- Link: Can be tied to clock sessions for automatic time tracking

**`task_week_allocations`** (RLS enabled)
- Planned task hours per week
- Fields: `id`, `task_id`, `week_start_date`, `allocated_hours`, `assigned_user_id`, `notes`
- Purpose: Break down task estimates into weekly plans
- Use Case: Capacity planning and workload balancing

**`clock_sessions`** (RLS enabled)
- Active clock-in/out sessions
- Fields: `id`, `user_id`, `clock_in_time`, `clock_out_time`, `is_active`, `is_auto_clock_out`, `notes`
- Purpose: Track when users are actively working
- Auto Clock-Out: Function auto-closes sessions after 16 hours
- Safety: Prevents overnight sessions from skewing time tracking

#### Supporting Tables
**`deliverables`** (RLS enabled)
- Project deliverable documents
- Fields: `id`, `name`, `description`, `project_id`, `task_id`, `status`, `submitted_by`, `approved_by`, `feedback`, `file_url`, `version`
- Status: draft, pending_review, approved, rejected, revised
- Purpose: Track formal deliverables and approvals

**`newsletters`** (RLS enabled)
- Company newsletters shown on welcome page
- Fields: `id`, `title`, `content`, `created_by`, `is_published`, `published_at`
- Purpose: Internal communications

**`notifications`** (No RLS)
- User notifications (not currently used)
- Fields: `id`, `user_id`, `title`, `message`, `type`, `read_at`
- Types: assignment, deadline, approval, general

**`milestones`** (No RLS)
- Project milestones for Gantt chart
- Fields: `id`, `name`, `description`, `date`, `color`
- Purpose: Mark important dates on Gantt view

**`account_kanban_configs`** (RLS enabled)
- Custom Kanban columns per account
- Fields: `id`, `account_id`, `columns` (JSONB)
- Purpose: Allow account-specific workflow customization

### Database Views

**`weekly_capacity_summary`**
- Aggregated weekly metrics per user
- Columns: user_id, week_start_date, available_hours, allocated_hours, actual_hours, utilization_rate, remaining_capacity
- Purpose: Single-query capacity metrics

**`department_capacity_summary`**
- Department-wide capacity rollup
- Columns: department_id, week_start_date, team_size, total_available_hours, total_allocated_hours, total_actual_hours, department_utilization_rate
- Purpose: Manager-level capacity overview

**`project_capacity_summary`**
- Project capacity allocation
- Columns: project_id, week_start_date, assigned_users, allocated_hours, actual_hours, total_estimated_hours
- Purpose: Project-level capacity tracking

### Critical Database Functions

**`get_week_start_date(input_date DATE)`**
- Returns Monday of the week for any date (ISO week standard)
- Used throughout system for consistent week calculations

**`update_updated_at_column()`**
- Trigger function to auto-update `updated_at` timestamps
- Applied to: user_availability, time_entries, task_week_allocations

**`auto_clock_out_stale_sessions()`**
- Auto-closes clock sessions after 16 hours
- Security Definer: Runs with elevated permissions
- Purpose: Prevent runaway sessions

---

## RBAC System (Role-Based Access Control)

### Permission System Overview

The RBAC system uses a **hybrid approach** combining:
1. **Base Permissions**: Standard permissions that all roles can have
2. **Override Permissions**: Special permissions that bypass contextual restrictions
3. **Context-Aware Checks**: Permissions evaluated with specific context (department, account, project)

### Total Permissions: 136
Organized into 15 categories across the platform.

### Permission Categories

#### 1. Role Management (10 permissions)
| Permission | Description | Use Case |
|------------|-------------|----------|
| `CREATE_ROLE` | Create new roles | HR/Admin creating new positions |
| `EDIT_ROLE` | Modify role settings | Updating permissions or role details |
| `DELETE_ROLE` | Remove roles | Deprecating unused roles |
| `VIEW_ROLES` | View role configurations | Accessing org chart and role management |
| `ASSIGN_USERS_TO_ROLES` | Assign users to roles | Onboarding or promoting users |
| `REMOVE_USERS_FROM_ROLES` | Remove role assignments | Offboarding or demoting users |
| `VIEW_ACCOUNTS_TAB` | Access Accounts tab in role management | Managing account-level access |
| `ASSIGN_ACCOUNT_USERS` | Add users to accounts | Giving team members client access |
| `REMOVE_ACCOUNT_USERS` | Remove users from accounts | Revoking client access |
| `MANAGE_USERS` | Full user management | View, edit, delete all users |

#### 2. Department Management (5 permissions)
| Permission | Description | Override? |
|------------|-------------|-----------|
| `CREATE_DEPARTMENT` | Create new departments | No |
| `EDIT_DEPARTMENT` | Modify department settings | No |
| `DELETE_DEPARTMENT` | Remove departments | No |
| `VIEW_DEPARTMENTS` | View own departments | No |
| `VIEW_ALL_DEPARTMENTS` | **View ALL departments** | **YES** |

**Important**: `VIEW_ALL_DEPARTMENTS` is an override permission that bypasses the normal restriction of only viewing your own departments.

#### 3. Account Management (5 permissions)
| Permission | Description | Override? |
|------------|-------------|-----------|
| `CREATE_ACCOUNT` | Create client accounts | No |
| `EDIT_ACCOUNT` | Modify account information | No |
| `DELETE_ACCOUNT` | Remove client accounts | No |
| `VIEW_ACCOUNTS` | View assigned accounts | No |
| `VIEW_ALL_ACCOUNTS` | **View ALL accounts** | **YES** |

#### 4. Project Management (9 permissions)
| Permission | Description | Override? |
|------------|-------------|-----------|
| `CREATE_PROJECT` | Create projects in assigned accounts | No |
| `EDIT_PROJECT` | Edit assigned projects | No |
| `DELETE_PROJECT` | Delete accessible projects | No |
| `VIEW_PROJECTS` | View assigned projects | No |
| `VIEW_ALL_PROJECTS` | **View ALL projects** | **YES** |
| `EDIT_ALL_PROJECTS` | **Edit ANY project** | **YES** |
| `DELETE_ALL_PROJECTS` | **Delete ANY project** | **YES** |
| `ASSIGN_PROJECT_USERS` | Assign team members to projects | No |
| `REMOVE_PROJECT_USERS` | Remove team members from projects | No |

**Key Insight**: Non-override project permissions are scoped to:
- Projects the user created
- Projects the user is assigned to
- Projects in accounts the user manages

#### 5. Project Updates (8 permissions)
| Permission | Description | Scope |
|------------|-------------|-------|
| `VIEW_UPDATES` | View updates in project pages | Project-level |
| `CREATE_UPDATE` | Post project updates | Project-level |
| `EDIT_UPDATE` | Modify project updates | Project-level |
| `DELETE_UPDATE` | Remove project updates | Project-level |
| `VIEW_ALL_PROJECT_UPDATES` | **View ALL updates on welcome page** | **Organization** |
| `VIEW_ASSIGNED_PROJECTS_UPDATES` | View updates for assigned projects | Personal |
| `VIEW_DEPARTMENT_PROJECTS_UPDATES` | View department project updates | Department |
| `VIEW_ACCOUNT_PROJECTS_UPDATES` | View account project updates | Account |

**Dashboard Filtering**: The welcome page uses these permissions to filter which updates appear.

#### 6. Project Issues (4 permissions)
| Permission | Description |
|------------|-------------|
| `VIEW_ISSUES` | View project issues/blockers |
| `CREATE_ISSUE` | Report new issues |
| `EDIT_ISSUE` | Modify existing issues |
| `DELETE_ISSUE` | Remove issues |

#### 7. Task Management (6 permissions)
| Permission | Description | Special Behavior |
|------------|-------------|------------------|
| `VIEW_TASKS` | View tasks in assigned projects | - |
| `CREATE_TASK` | Create new tasks | - |
| `EDIT_TASK` | Modify task details | - |
| `DELETE_TASK` | Remove tasks | - |
| `ASSIGN_TASK` | Assign tasks to team members | **Grants project access** |
| `MANAGE_DEPARTMENT_TASKS` | Oversee all department tasks | Department-wide |

**Critical**: `ASSIGN_TASK` automatically gives the assigned user access to the project and account!

#### 8. Kanban Board (4 permissions)
| Permission | Description | Restriction |
|------------|-------------|-------------|
| `VIEW_KANBAN` | View Kanban boards | - |
| `EDIT_KANBAN_LAYOUT` | Modify board structure | - |
| `CREATE_KANBAN_CARD` | Create new cards | - |
| `MOVE_ALL_KANBAN_ITEMS` | Move any project on board | Without: can only move assigned items |

#### 9. Gantt Chart & Table View (4 permissions)
| Permission | Description |
|------------|-------------|
| `VIEW_GANTT` | View Gantt charts |
| `EDIT_GANTT` | Move tasks, add milestones, modify dates |
| `VIEW_TABLE` | View project table view |
| `EDIT_TABLE` | Delete projects, assign users in table view |

#### 10. Newsletters (4 permissions)
| Permission | Description |
|------------|-------------|
| `VIEW_NEWSLETTERS` | View company newsletters on welcome page |
| `CREATE_NEWSLETTER` | Create new newsletters |
| `EDIT_NEWSLETTER` | Modify existing newsletters |
| `DELETE_NEWSLETTER` | Remove newsletters |

#### 11. Analytics (3 permissions)
| Permission | Description | Scope |
|------------|-------------|-------|
| `VIEW_ANALYTICS` | View analytics for assigned projects | Personal |
| `VIEW_DEPARTMENT_ANALYTICS` | View department-wide analytics | Department |
| `VIEW_ALL_ANALYTICS` | **View organization-wide analytics** | **Organization** |

#### 12. Profile Management (2 permissions)
| Permission | Description |
|------------|-------------|
| `VIEW_OWN_PROFILE` | View own user profile |
| `EDIT_OWN_PROFILE` | Edit own user profile |

#### 13. Capacity Management (4 permissions)
| Permission | Description | Use Case |
|------------|-------------|----------|
| `EDIT_OWN_AVAILABILITY` | Set personal weekly availability | Individual capacity planning |
| `VIEW_OWN_CAPACITY` | View personal capacity metrics | Self-monitoring |
| `VIEW_TEAM_CAPACITY` | View team/department capacity | Manager oversight |
| `VIEW_ALL_CAPACITY` | **View org-wide capacity** | **Executive reporting** |

#### 14. Time Tracking (5 permissions)
| Permission | Description | Scope |
|------------|-------------|-------|
| `LOG_TIME` | Log time on assigned tasks | Own tasks |
| `LOG_TIME_ALL_PROJECT_TASKS` | Log time to any task in assigned projects | Project-wide |
| `EDIT_OWN_TIME_ENTRIES` | Edit/delete own time entries | Personal |
| `VIEW_TEAM_TIME_ENTRIES` | View team time entries | Team/Department |
| `EDIT_TEAM_TIME_ENTRIES` | Edit/delete team time entries | Team/Department |

#### 15. Capacity Planning (2 permissions)
| Permission | Description |
|------------|-------------|
| `ALLOCATE_TASK_WEEKS` | Allocate tasks to specific weeks |
| `VIEW_CAPACITY_ANALYTICS` | Access capacity analytics dashboard |

### How Permissions Work

#### Permission Storage
Permissions are stored as JSONB in the `roles` table:
```json
{
  "view_projects": true,
  "edit_project": true,
  "view_all_projects": false,
  "create_task": true,
  ...
}
```

#### Permission Checking Flow
1. **Superadmin Check**: Superadmins always have all permissions
2. **User Roles Query**: Fetch all roles for the user
3. **Permission Union**: User has permission if ANY role grants it
4. **Context Check**: For context-aware permissions, verify the context matches
5. **Override Check**: Override permissions bypass context restrictions

#### Superadmin Detection
A user is Superadmin if:
- They have a role with `is_system_role = true` AND name contains "superadmin" or "executive"
- OR `user_profiles.is_superadmin = true`

#### Permission Context
```typescript
interface PermissionContext {
  userId?: string;
  departmentId?: string;
  accountId?: string;
  projectId?: string;
  taskId?: string;
  deliverableId?: string;
}
```

Example: Checking `EDIT_PROJECT` with `projectId` context verifies the user has access to that specific project.

#### Override Permissions List
All permissions with `isOverride: true`:
- `VIEW_ALL_DEPARTMENTS`
- `VIEW_ALL_ACCOUNTS`
- `VIEW_ALL_PROJECTS`
- `EDIT_ALL_PROJECTS`
- `DELETE_ALL_PROJECTS`
- `VIEW_ALL_PROJECT_UPDATES`
- `VIEW_ALL_ANALYTICS`
- `VIEW_ALL_CAPACITY`

### System Roles

**Pre-configured system roles** (marked with `is_system_role = true`):
1. **Superadmin**: Has all 136 permissions
2. **Executive**: Has all 136 permissions (same as Superadmin)
3. **Unassigned** / **No Assigned Role**: Has zero permissions, used for pending approvals

---

## Core Features

### 1. User Management & Authentication

#### Registration & Approval Flow
1. User signs up via Supabase Auth
2. User profile created in `user_profiles` table
3. User automatically assigned "Unassigned" role
4. User sees "Pending Approval" page
5. Admin with `ASSIGN_USERS_TO_ROLES` approves and assigns proper role
6. User gains access based on role permissions

#### Profile Features
- **Name, Email, Avatar**: Basic identity
- **Bio & Skills**: Professional information
- **Workload Sentiment**: self-reported (comfortable, stretched, overwhelmed)
- **Role Display**: Shows all assigned roles and departments

### 2. Organizational Structure

#### Departments
- **Purpose**: Organize users into business units (Engineering, Sales, Marketing, etc.)
- **Features**:
  - Department creation/edit/delete (permission-gated)
  - Department metrics dashboard (active projects, team size, capacity)
  - Department-specific analytics
- **Access Control**: Users can view departments they belong to, or all if they have override permission

#### Roles & Hierarchy
- **Hierarchical Org Chart**: Roles have reporting relationships
- **Visual Positioning**: X/Y coordinates for drag-and-drop org chart
- **Hierarchy Levels**: Numeric depth for automatic layout
- **Audit Trail**: All hierarchy changes tracked in `role_hierarchy_audit`

#### Role Management Interface
Three tabs:
1. **Roles Tab**: Create/edit roles, set permissions, assign users
2. **Accounts Tab**: Manage account memberships (requires `VIEW_ACCOUNTS_TAB`)
3. **Pending Users**: Approve new registrations (requires `ASSIGN_USERS_TO_ROLES`)

### 3. Client Account Management

#### Account Features
- **Account Details**: Name, description, contacts
- **Service Tiers**: Basic, Premium, Enterprise
- **Status Management**: Active, Inactive, Suspended
- **Account Manager**: Designated user with management rights
- **Projects View**: All projects for the account
- **Metrics Dashboard**:
  - Active projects count
  - Total projects
  - Upcoming deadlines
  - Overdue projects
  - Health score (0-100)

#### Account Members
- **Assignment**: Users can be added as account members
- **Auto-Access**: Account members automatically see all projects for that account
- **Removal**: Members can be removed to revoke access

### 4. Project Management

#### Project Lifecycle
1. **Planning**: Initial scoping and setup
2. **In Progress**: Active development/work
3. **Review**: Under review/QA
4. **Complete**: Delivered/finished
5. **On Hold**: Paused/blocked

#### Project Fields
- **Basic**: Name, description, account assignment
- **Timeline**: Start date, end date
- **Effort**: Estimated hours, actual hours, remaining hours
- **Priority**: Low, Medium, High, Urgent
- **Assignments**: Primary assigned user + project assignments
- **Notes**: Updates and issues/roadblocks (being deprecated in favor of dedicated tables)

#### Department Association
Projects are associated with departments through **implicit derivation**:
- User is assigned to project (via `project_assignments`)
- User has role(s) in `user_roles`
- Each role belongs to a department
- Project "belongs" to all departments whose users are assigned

**Migration Note**: `project_departments` table was removed - department membership is now derived dynamically.

#### Project Updates
- **Journal-Style**: Chronological log of project progress
- **Visibility**: Filtered on dashboard based on update permissions
- **Who Can See**:
  - Users with `VIEW_ALL_PROJECT_UPDATES`: See all
  - Users with `VIEW_ASSIGNED_PROJECTS_UPDATES`: Only their projects
  - Users with `VIEW_DEPARTMENT_PROJECTS_UPDATES`: Department projects
  - Users with `VIEW_ACCOUNT_PROJECTS_UPDATES`: Account projects

#### Project Issues
- **Problem Tracking**: Log blockers and impediments
- **Status**: Open, In Progress, Resolved
- **Resolution Tracking**: Who resolved and when
- **Purpose**: Separate from updates to highlight problems

### 5. Task Management

#### Task System
- **Hierarchy**: Tasks belong to projects belong to accounts
- **Statuses**: Backlog, To Do, In Progress, Review, Done, Blocked
- **Priority**: Low, Medium, High, Urgent
- **Time Tracking**:
  - Estimated hours
  - Actual hours (from time entries)
  - Remaining hours (manually updated)
- **Auto-Complete**: When `remaining_hours` set to 0, status → done

#### Task Assignment
- **Direct Assignment**: `assigned_to` field on tasks table
- **Access Grant**: Assigning a user to a task automatically gives them:
  - Access to the project
  - Access to the account
- **Permission Required**: `ASSIGN_TASK`

#### Task Dependencies
- **Types**:
  - Finish-to-Start: Task B starts when Task A finishes
  - Start-to-Start: Task B starts when Task A starts
  - Finish-to-Finish: Task B finishes when Task A finishes
  - Start-to-Finish: Task B finishes when Task A starts
- **Purpose**: Gantt chart relationships

### 6. Kanban Board

#### Features
- **Drag-and-Drop**: Move tasks between columns
- **Custom Columns**: Account-specific Kanban configurations
- **Default Columns**: Backlog, To Do, In Progress, Review, Done, Blocked
- **Colored Status Badges**: Visual status indicators
- **Task Cards Show**:
  - Task name and description
  - Priority badge
  - Project/group name
  - Assigned user avatar
  - Estimated and remaining hours with progress %
  - Start and end dates
  - Tags

#### Permission Control
- **View**: Requires `VIEW_KANBAN`
- **Create Cards**: Requires `CREATE_KANBAN_CARD`
- **Edit Layout**: Requires `EDIT_KANBAN_LAYOUT`
- **Move Cards**:
  - With `MOVE_ALL_KANBAN_ITEMS`: Can move any task
  - Without: Can only move tasks assigned to you (cards appear disabled)

### 7. Gantt Chart

#### Capabilities
- **Timeline View**: Visual project timeline
- **Dependencies**: Show task relationships
- **Milestones**: Mark important dates
- **Drag-to-Reschedule**: Modify task dates visually (requires `EDIT_GANTT`)
- **Color Coding**: Status-based coloring

#### Permissions
- `VIEW_GANTT`: See the chart
- `EDIT_GANTT`: Move tasks, add milestones, modify dates

### 8. Table View (Projects)

#### Features
- **Sortable Columns**: Name, status, priority, deadline
- **Filterable**: By status, priority, department
- **Bulk Actions**: With `EDIT_TABLE` permission
- **Delete Projects**: Direct delete from table (requires `DELETE_PROJECT`)
- **External Links**: Quick navigation to project detail pages

### 9. Capacity Planning System

#### User Availability
- **Weekly Schedule**: Set available hours per week
- **Day Breakdown**: JSONB schedule_data for daily hours
- **Default**: 40 hours/week if not set
- **Max**: 168 hours (full week)
- **UI**: Drag-to-mark-unavailable calendar interface

#### Capacity Metrics (Calculated)
For each user, each week:
- **Available Hours**: From user_availability table
- **Allocated Hours**: Sum of task_week_allocations or project assigned hours
- **Actual Hours**: Sum of time_entries for the week
- **Utilization Rate**: (Actual ÷ Available) × 100
- **Remaining Capacity**: Available - Actual

#### Aggregation Levels
1. **User Level**: Individual capacity metrics
2. **Department Level**: Team capacity rollup
3. **Organization Level**: Company-wide capacity view

#### Capacity Dashboard
- **Current Week Display**: Shows utilization bar chart
- **Trend Chart**: 8-week historical view
- **Color Coding**:
  - Green: Under 70% utilized
  - Yellow: 70-90% utilized
  - Red: Over 90% utilized
- **Quick Actions**: Button to set availability

### 10. Time Tracking

#### Time Entry System
- **Manual Entry**: Log hours on tasks
- **Clock Sessions**: Clock in/out with automatic tracking
- **Fields**:
  - Task and project association
  - Hours logged
  - Entry date
  - Week start date (auto-calculated)
  - Description
  - Clock session linkage

#### Clock Sessions
- **Clock In**: Start timer
- **Clock Out**: End timer, optionally create time entries
- **Auto Clock-Out**: Sessions auto-close after 16 hours (safety feature)
- **Active Session Indicator**: Widget shows current session
- **Clock Out Dialog**: Allocate hours to tasks before finishing

#### Time Entry Permissions
- **`LOG_TIME`**: Log time on assigned tasks
- **`LOG_TIME_ALL_PROJECT_TASKS`**: Log on any task in assigned projects
- **`EDIT_OWN_TIME_ENTRIES`**: Edit/delete own entries
- **`VIEW_TEAM_TIME_ENTRIES`**: See team's time entries
- **`EDIT_TEAM_TIME_ENTRIES`**: Edit/delete team entries (manager feature)

#### Admin Time Tracking Dashboard
- **View All Entries**: See all team time entries
- **Edit Any Entry**: Modify or delete entries
- **Filter by Date**: View specific time periods
- **Export**: Download time entry reports
- **Permissions**: Accessed via `/admin/time-tracking` (requires admin permissions)

### 11. Analytics & Reporting

#### Personal Analytics
- **Permission**: `VIEW_ANALYTICS`
- **Metrics**:
  - Tasks completed
  - Hours logged
  - Projects active
  - Capacity utilization

#### Department Analytics
- **Permission**: `VIEW_DEPARTMENT_ANALYTICS`
- **Metrics**:
  - Department capacity
  - Team workload distribution
  - Project health (healthy, at-risk, critical)
  - Active projects count
  - Recent projects

#### Organization Analytics
- **Permission**: `VIEW_ALL_ANALYTICS`
- **Metrics**:
  - Org-wide capacity
  - Department comparisons
  - Top performers
  - Bottlenecks
  - Resource allocation

### 12. Dashboard (Welcome Page)

#### Personal Dashboard
Accessible at `/dashboard`, shows:
- **Assigned Projects Section**:
  - Projects user is working on
  - Project status and progress
  - Quick links to project pages
- **Capacity Dashboard**:
  - Current week utilization
  - Available vs. actual hours
  - Set availability button
- **Profile Information**:
  - User details
  - Roles and departments
- **Quick Actions**:
  - View Accounts (if permission)
  - View Departments (if permission)
  - Admin Page (if permission)
  - Analytics (if permission)

#### Welcome Page Features
- **Project Updates Feed**: Filtered by update permissions
- **Newsletters**: Company announcements
- **Recent Activity**: Task completions, project changes

### 13. Admin Dashboard

#### Access Requirements
Any of:
- Role management permissions (CREATE_ROLE, EDIT_ROLE, etc.)
- `VIEW_ALL_ANALYTICS`
- `CREATE_DEPARTMENT`
- `CREATE_ACCOUNT`
- `MANAGE_USERS`

#### Admin Features
1. **Role Management**: Full org chart and role editor
2. **User Management**: View, edit, delete users
3. **Department Management**: Create, edit departments
4. **Account Management**: Manage client accounts
5. **Database Status**: View connection health
6. **Time Tracking Admin**: View/edit all time entries

### 14. Navigation System

#### Dynamic Navigation
- **Route Guards**: Pages check permissions before rendering
- **Menu Items**: Dynamically shown based on permissions
- **404 Handling**: Unauthorized access redirects
- **Breadcrumbs**: Context-aware navigation trail

#### Main Routes
- `/` - Landing/Login
- `/dashboard` - Main dashboard (requires role assignment)
- `/welcome` - Alternative dashboard view
- `/projects` - Project list
- `/projects/[id]` - Project detail
- `/accounts` - Account list (requires VIEW_ACCOUNTS)
- `/accounts/[id]` - Account detail
- `/departments` - Department list (requires VIEW_DEPARTMENTS)
- `/departments/[id]` - Department detail
- `/kanban` - Kanban board (requires VIEW_KANBAN)
- `/gantt` - Gantt chart (requires VIEW_GANTT)
- `/analytics` - Analytics dashboard (requires VIEW_ANALYTICS)
- `/profile` - User profile (requires VIEW_OWN_PROFILE)
- `/capacity` - Capacity planning (requires VIEW_OWN_CAPACITY)
- `/admin` - Admin dashboard (requires admin permissions)
- `/admin/roles` - Role management
- `/admin/time-tracking` - Time tracking admin
- `/pending-approval` - Waiting for role assignment
- `/signup` - New user registration
- `/login` - User login

---

## Data Relationships & Correlations

### Primary Relationships

#### User → Roles → Departments
```
user_profiles
  ↓ (many-to-many via user_roles)
roles
  ↓ (many-to-one)
departments
```
- A user can have multiple roles
- Each role belongs to one department
- Users inherit department membership through roles

#### Accounts → Projects → Tasks
```
accounts
  ↓ (one-to-many)
projects
  ↓ (one-to-many)
tasks
```
- Linear hierarchy: Client → Work Package → Work Item

#### Projects → Departments (Derived)
```
projects
  ↓ (many-to-many via project_assignments)
user_profiles
  ↓ (many-to-many via user_roles)
roles
  ↓ (many-to-one)
departments
```
- Projects belong to departments through user assignments
- No direct project_departments table (removed in migration)

#### Capacity System
```
user_availability (weekly capacity)
  ↕
user_profiles
  ↕
time_entries (actual work)
  ↕
tasks
  ↕
task_week_allocations (planned work)
```
- All connected through user_id and week_start_date
- Forms complete capacity picture

### Access Control Derivation

#### "Who can see this project?"
1. User has `VIEW_ALL_PROJECTS` → YES
2. User has `VIEW_PROJECTS` AND:
   - User created the project, OR
   - User is assigned to project (project_assignments), OR
   - User is project stakeholder, OR
   - User manages the account (account_manager_id)

#### "Who can see this account?"
1. User has `VIEW_ALL_ACCOUNTS` → YES
2. User has `VIEW_ACCOUNTS` AND:
   - User is account manager, OR
   - User is account member (account_members), OR
   - User has projects in the account

#### "Who can see this department?"
1. User has `VIEW_ALL_DEPARTMENTS` → YES
2. User has `VIEW_DEPARTMENTS` AND:
   - User has a role in the department (user_roles → roles → department_id)

### Data Consistency Rules

#### Cascade Deletes
- Delete user → deletes user_roles, account_members, project_assignments
- Delete project → deletes tasks, time_entries, project_assignments
- Delete task → deletes time_entries, task_week_allocations
- Delete department → ??? (should prevent if roles exist)
- Delete role → deletes user_roles (users lose permissions)

#### Soft Deletes
- `project_assignments.removed_at`: Keep historical record
- No other tables use soft delete currently

#### Auto-Updates
- `updated_at` triggers on: user_availability, time_entries, task_week_allocations
- Week calculations: Automatic via `get_week_start_date()` function

### Computed Fields & Aggregations

#### Project Hours
- `projects.actual_hours`: Calculated from sum of time_entries
- `projects.remaining_hours`: Manually updated or calculated from task remaining hours
- `projects.task_hours_sum`: Calculated from sum of task estimated hours

#### Task Hours
- `tasks.actual_hours`: Sum of time_entries for task
- `tasks.remaining_hours`: Manually updated, triggers status change when 0

#### Capacity Utilization
- Per User: `(actual_hours / available_hours) * 100`
- Per Department: `(Σ actual_hours / Σ available_hours) * 100`
- Per Organization: `(Σ all actual / Σ all available) * 100`

---

## User Workflows

### Workflow 1: New User Onboarding
1. User registers via `/signup`
2. Account created in Supabase Auth
3. `user_profiles` row created automatically
4. User auto-assigned "Unassigned" system role
5. User sees `/pending-approval` page
6. Admin with `ASSIGN_USERS_TO_ROLES` goes to Admin → Pending Users
7. Admin assigns user to appropriate role
8. User refreshes, sees `/dashboard`
9. User can now access features per role permissions

### Workflow 2: Creating a Project
1. User has `CREATE_PROJECT` permission
2. User navigates to account detail page
3. Clicks "Create Project"
4. Fills out project form:
   - Name, description
   - Timeline (start/end dates)
   - Priority
   - Estimated hours
5. Project created in database
6. Project automatically associated with account
7. Department association derived when users are assigned

### Workflow 3: Assigning Work
1. Manager has `ASSIGN_TASK` permission
2. Manager views project detail page
3. Manager creates task within project
4. Manager assigns task to team member
5. Assignment creates `project_assignments` entry
6. Team member gains access to:
   - The task
   - The project
   - The account
7. Team member sees project in "Assigned Projects" section

### Workflow 4: Logging Time
**Option A: Manual Entry**
1. User has `LOG_TIME` permission
2. User navigates to project or task
3. Clicks "Log Time"
4. Enters:
   - Hours
   - Date
   - Description
5. Time entry created
6. Week automatically calculated
7. Capacity metrics updated

**Option B: Clock Session**
1. User clicks "Clock In" in navigation widget
2. Clock session created with `is_active = true`
3. User works (session shows in UI)
4. User clicks "Clock Out"
5. Clock out dialog appears
6. User allocates hours to tasks
7. Time entries created from session
8. Session marked `is_active = false`

### Workflow 5: Capacity Planning
1. Manager views capacity dashboard
2. Sees team utilization at 85% (yellow)
3. Clicks "View Team Capacity"
4. Identifies overloaded team members
5. Reassigns tasks to underutilized members
6. Sets realistic `task_week_allocations`
7. Monitors actual vs. allocated weekly

### Workflow 6: Project Lifecycle
1. **Planning Phase**:
   - Project created with status = planning
   - Scope defined
   - Tasks created but not assigned
   - Estimated hours set
2. **Assignment**:
   - Team members assigned to project
   - Tasks assigned to individuals
   - Week allocations planned
3. **Execution (In Progress)**:
   - Status changed to in_progress
   - Team logs time on tasks
   - Project updates posted
   - Issues logged when blockers arise
4. **Review**:
   - Status changed to review
   - Deliverables submitted
   - Approvals obtained
5. **Completion**:
   - Status changed to complete
   - Final time entries logged
   - Remaining hours set to 0
   - Project archived in system

---

## Technical Implementation

### Service Layer

#### Account Service (`lib/account-service.ts`)
- `getAccountById()`: Fetch account with projects
- `getAllAccounts()`: List all accounts
- `getUserAccounts()`: Accounts user has access to
- `canUserAccessAccount()`: Permission check
- `hasFullAccountAccess()`: Edit vs. view check
- `getAccountProjects()`: Projects for account with department derivation
- `getAccountMetrics()`: Health scores, deadlines, active projects
- `getUrgentItems()`: Overdue and high-priority items
- `createProject()`: Create project under account
- `updateProject()`: Modify project
- `deleteProject()`: Remove project
- `getAllUsers()`: Users for assignment dropdowns

#### Department Service (`lib/department-service.ts`)
Server-side only:
- `getAllDepartments()`: List departments
- `getDepartmentById()`: Fetch one department
- `getDepartmentProjects()`: Projects with department users
- `getDepartmentMetrics()`: Team size, capacity, project health, workload distribution

#### Capacity Service (`lib/services/capacity-service.ts`)
- `getUserCapacityMetrics()`: Weekly metrics for one user
- `getDepartmentCapacityMetrics()`: Aggregated department metrics
- `getProjectCapacityMetrics()`: Project capacity allocation
- `getOrgCapacityMetrics()`: Organization-wide rollup
- `getUserCapacityTrend()`: Multi-week historical data
- `getDepartmentCapacityTrend()`: Department trend analysis

#### Time Entry Service (`lib/services/time-entry-service.ts`)
- `logTime()`: Create time entry
- `getUserTimeEntries()`: Fetch user's entries
- `getTaskTimeEntries()`: Task-specific entries
- `getProjectTimeEntries()`: Project-specific entries
- `getUserWeeklySummary()`: Total hours for week
- `updateTimeEntry()`: Modify entry
- `deleteTimeEntry()`: Remove entry
- `getUserTimeEntriesByWeek()`: Multi-week aggregation

#### Availability Service (`lib/services/availability-service.ts`)
- `getUserAvailability()`: Get weekly availability
- `setUserAvailability()`: Update weekly hours
- `getWeekStartDate()`: Calculate Monday for any date

#### RBAC Service (`lib/rbac.ts`)
- `isSuperadmin()`: Check superadmin status
- `isUnassigned()`: Check if user has no real role
- `getUserRoles()`: Get role names
- `getUserDepartments()`: Get department names
- `hasPermission()`: Core permission check with context
- `hasAnyPermission()`: OR check across multiple permissions
- `hasAllPermissions()`: AND check across multiple permissions
- `isAdminLevel()`: Check if user can access admin dashboard

#### Permission Checker (`lib/permission-checker.ts`)
- `checkPermissionHybrid()`: Main permission logic
- `checkAnyPermission()`: Batch OR check
- `checkAllPermissions()`: Batch AND check
- `getUserPermissions()`: Get all permissions for user
- Context-aware evaluation
- Override permission handling

### API Routes

#### User & Auth
- `POST /api/users/approve` - Approve pending user
- `GET /api/users/pending` - List pending users
- `GET /api/users` - List all users
- `GET /api/auth/permissions` - Get current user permissions

#### Roles
- `GET /api/roles` - List all roles
- `POST /api/roles` - Create role
- `GET /api/roles/[roleId]` - Get role details
- `PATCH /api/roles/[roleId]` - Update role
- `DELETE /api/roles/[roleId]` - Delete role
- `POST /api/roles/[roleId]/assign-user` - Assign user to role
- `DELETE /api/roles/[roleId]/remove-user/[userId]` - Remove user from role
- `GET /api/roles/[roleId]/users` - Get users with role
- `POST /api/roles/reorder` - Update role display order

#### Departments
- `GET /api/departments` - List departments
- `POST /api/departments` - Create department
- `PATCH /api/departments/[id]` - Update department
- `DELETE /api/departments/[id]` - Delete department

#### Accounts
- `GET /api/accounts/members` - Get account members
- `POST /api/accounts/members` - Add account member
- `GET /api/accounts/[accountId]` - Get account details
- `PATCH /api/accounts/[accountId]` - Update account
- `GET /api/accounts/[accountId]/members` - Get members for account
- `POST /api/accounts/[accountId]/members` - Add member to account
- `DELETE /api/accounts/[accountId]/members/[userId]` - Remove member

#### Projects
- `GET /api/projects/[projectId]/stakeholders` - Get stakeholders
- `POST /api/projects/[projectId]/stakeholders` - Add stakeholder

#### Capacity & Time
- `GET /api/capacity` - Get user capacity metrics
- `POST /api/capacity` - Update capacity metrics
- `GET /api/capacity/account` - Account capacity
- `GET /api/capacity/department` - Department capacity
- `GET /api/capacity/organization` - Org capacity
- `GET /api/capacity/history` - Historical capacity data
- `GET /api/availability` - Get user availability
- `POST /api/availability` - Set user availability
- `PATCH /api/availability` - Update user availability
- `GET /api/time-entries` - Get time entries
- `POST /api/time-entries` - Create time entry
- `PATCH /api/time-entries/[id]` - Update time entry
- `DELETE /api/time-entries/[id]` - Delete time entry
- `GET /api/admin/time-entries` - Admin: All time entries
- `PATCH /api/admin/time-entries/[id]` - Admin: Update any entry
- `DELETE /api/admin/time-entries/[id]` - Admin: Delete any entry

#### Clock Sessions
- `POST /api/clock` - Clock in
- `POST /api/clock/out` - Clock out
- `GET /api/clock` - Get active session

#### Project Updates
- `GET /api/project-updates` - Get updates
- `POST /api/project-updates` - Create update
- `PATCH /api/project-updates/[id]` - Edit update
- `DELETE /api/project-updates/[id]` - Delete update

#### Profile
- `GET /api/profile` - Get user profile
- `PATCH /api/profile` - Update user profile

### Component Architecture

#### Route Guards
- **`<RoleGuard>`**: Requires user to have assigned role (not Unassigned)
- **`requirePermission` prop**: Requires specific permission to view component
- **Redirect**: Unauthorized users sent to /pending-approval or /login

#### Key Components
- **Navigation** (`components/navigation.tsx`): Dynamic menu based on permissions
- **Capacity Dashboard** (`components/capacity-dashboard.tsx`): Current week utilization
- **Drag Availability Calendar** (`components/drag-availability-calendar.tsx`): Set unavailable times
- **Clock Widget** (`components/clock-widget.tsx`): Clock in/out controls
- **Kanban Board** (`components/ui/shadcn-io/kanban/`): Drag-drop task board
- **Gantt Chart** (`components/gantt-chart.tsx`): Timeline visualization
- **Org Chart** (`components/org-chart/`): Role hierarchy visualization
- **Task Dialogs**: Create/edit dialogs for tasks
- **Project Dialogs**: Create/edit dialogs for projects

### Database Security (RLS Policies)

#### User Availability Policies
```sql
-- Users can view own availability
POLICY "Users can view own availability" ON user_availability
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert own availability
POLICY "Users can insert own availability" ON user_availability
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update own availability
POLICY "Users can update own availability" ON user_availability
  FOR UPDATE USING (auth.uid() = user_id);
```

#### Time Entries Policies
```sql
-- Users can view own time entries
POLICY "Users can view own time entries" ON time_entries
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert own time entries
POLICY "Users can insert own time entries" ON time_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

#### Clock Sessions Policies
```sql
-- Users can view own sessions
POLICY "Users can view own clock sessions" ON clock_sessions
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can view all sessions
POLICY "Admins can view all clock sessions" ON clock_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND (r.name = 'Admin' OR r.name = 'Executive' OR r.is_superadmin = true)
    )
  );
```

**Note**: RLS policies enforce database-level security, but application-level permission checks provide finer-grained control.

---

## Summary

**PRISM PSA** is a comprehensive professional services automation platform built on:

1. **Sophisticated RBAC**: 136 permissions, hybrid permission system, context-aware checks
2. **Complete Capacity Management**: Weekly planning, real-time utilization, multi-level aggregation
3. **Flexible Organizational Structure**: Departments, roles, reporting hierarchies, org charts
4. **Full Project Lifecycle**: From planning to completion with updates, issues, and tasks
5. **Time Tracking**: Manual and clock-based time entry with admin oversight
6. **Visual Management**: Kanban, Gantt, and table views for different work styles
7. **Security-First**: RLS policies + application-level permission checks
8. **Data-Driven**: Comprehensive analytics at personal, department, and org levels

The platform's architecture enables:
- **Scalability**: Handles complex org structures with many users, departments, and projects
- **Security**: Multi-layered access control from database to UI
- **Flexibility**: Customizable permissions per role, account-specific Kanban configs
- **Visibility**: Managers see team capacity, executives see org-wide metrics
- **Efficiency**: Automated calculations, derived relationships, real-time updates

The use of **derived department membership** (via user assignments) rather than direct tables creates a more flexible system where project collaboration naturally reflects organizational reality.

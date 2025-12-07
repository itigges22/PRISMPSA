# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PRISM PSA is an enterprise-grade Professional Service Automation platform built with Next.js 15, TypeScript, Supabase (PostgreSQL + Row Level Security), and Tailwind CSS. It consolidates project management, time tracking, capacity planning, and workflow automation for professional services organizations.

## Common Commands

```bash
# Development
npm run dev              # Start dev server on localhost:3000
npm run dev:clean        # Clear .next cache and start dev server
npm run dev:fresh        # Kill port 3000 processes, clear cache, start dev server

# Build & Production
npm run build            # Production build
npm run start            # Start production server
npm run lint             # Run ESLint

# Testing (Permission System)
npm run test:unit        # Run permission checker unit tests
npm run test:integration # Run permission integration tests
npm run test:permissions # Run all permission tests + validation
npm run validate:permissions  # Validate permission definitions
npm run debug:permissions     # Debug permission issues
```

## Architecture

### Tech Stack
- **Framework**: Next.js 15 (App Router, React Server Components)
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **UI**: Tailwind CSS + shadcn/ui components
- **State**: Jotai for client state, SWR for data fetching
- **Charts**: Recharts
- **Workflow Editor**: @xyflow/react (React Flow)

### Key Directories
- `app/` - Next.js App Router pages and API routes
- `app/api/` - REST API routes (accounts, projects, tasks, workflows, etc.)
- `app/(main)/admin/` - Admin pages (workflows, forms, client portal)
- `components/` - React components (UI components in `components/ui/`)
- `lib/` - Business logic, services, and utilities

### Service Layer Pattern
Business logic is organized into `*-service.ts` files in `/lib`:
- `workflow-service.ts` / `workflow-execution-service.ts` - Workflow engine
- `account-service.ts`, `project-updates-service.ts`, `task-service.ts`
- `permission-checker.ts` - Hybrid RBAC permission checking
- `rbac.ts` - Role-based access control helpers
- `validation-schemas.ts` - Zod schemas for API input validation

### Permission System (Hybrid RBAC)
The permission system uses a three-tier approach:
1. **Base Permissions**: User must have permission in their role
2. **Context Awareness**: Check if user is assigned to the resource
3. **Override Permissions**: `*_ALL_*` permissions bypass assignment checks

Key files:
- `lib/permissions.ts` - Permission enum definitions (136+ permissions across 15 categories)
- `lib/permission-checker.ts` - Core permission checking logic
- `lib/rbac.ts` - Helper functions for role/permission checks
- `lib/rbac-types.ts` - TypeScript types for RBAC system

### Supabase Client Usage
- **Client-side**: Use `createClientSupabase()` from `lib/supabase.ts`
- **Server-side (API routes)**: Use `createServerSupabase()` from `lib/supabase-server.ts`
- Server-side code MUST pass authenticated SupabaseClient to service functions for proper RLS context

### Workflow System
Visual workflow builder with node types:
- `department` - Department handoff nodes
- `role` - Role-specific assignment nodes
- `client` - Client approval nodes
- `conditional` - Branching logic based on form responses

Tables: `workflow_templates`, `workflow_nodes`, `workflow_connections`, `workflow_instances`, `workflow_history`

### Data Model Hierarchy
`Clients → Accounts → Projects → Tasks`
- Users are assigned to accounts and projects
- Capacity is proportionally split across assigned accounts
- Time entries link to tasks for audit trail

## Environment Variables

Required:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Optional:
```
UPSTASH_REDIS_REST_URL=     # For rate limiting
UPSTASH_REDIS_REST_TOKEN=
ENABLE_RATE_LIMIT=true      # Auto-enabled in production
LOG_LEVEL=debug             # debug|info|warn|error
```

## API Route Patterns

API routes follow consistent patterns:
1. Authenticate user via `createServerSupabase()`
2. Validate input with Zod schemas from `lib/validation-schemas.ts`
3. Check permissions via `checkPermissionHybrid()` or role checks
4. Call service layer functions
5. Return JSON responses with appropriate status codes

## Middleware

`middleware.ts` handles:
- Rate limiting on `/api` routes (via Upstash Redis)
- Security headers (X-Frame-Options, HSTS, CSP)
- Basic auth cookie presence check (full auth in pages)

Public routes: `/`, `/login`, `/signup`, `/pending-approval`, `/welcome`, `/reset-password`, `/forgot-password`

## Database Migrations

SQL migrations are in `supabase/migrations/` (not currently present - run via Supabase dashboard SQL Editor). Key tables include:
- `users`, `roles`, `permissions`, `role_permissions`, `user_roles`
- `accounts`, `projects`, `tasks`, `time_entries`
- `departments`, `user_availability`
- `workflow_templates`, `workflow_nodes`, `workflow_connections`, `workflow_instances`, `workflow_history`
- `form_templates`, `form_responses`

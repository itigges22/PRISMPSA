# Demo User Guide

This guide explains what each demo user can do and what features they have access to.

## Logging In

All demo users share the same password. Visit the demo site and use any of the demo user emails to log in.

## Demo Users Overview

### Super Admin (superadmin@movalab.dev)

**Role**: Superadmin - Full system access

**Can Do**:
- Everything - all features, all data
- Access all admin pages including RBAC Diagnostics and Database Status
- Manage all users, roles, and permissions
- View all accounts, projects, and analytics
- Configure system settings

**Best For**: Testing admin features, system configuration

---

### Alex Executive (alex@movalab.dev)

**Role**: Executive - Strategic oversight

**Can Do**:
- View all 5 accounts and their projects
- See dashboards with capacity and analytics data
- Access executive-level reports
- Clock in/out and track time
- View newsletters
- See project stakeholder information (Executive Sponsor on key projects)

**Cannot Do**:
- Access superadmin-only pages (Database, RBAC Diagnostics)
- Manage user roles or permissions

**Best For**: Testing executive dashboard views, high-level analytics

---

### Morgan Manager (morgan@movalab.dev)

**Role**: Account Manager

**Can Do**:
- Manage accounts they're assigned to
- View all projects within their accounts
- Clock in/out and track time
- Edit personal availability
- View newsletters
- Coordinate with project managers
- Access capacity planning for their teams

**Cannot Do**:
- Access admin pages
- Manage roles or permissions
- View accounts they're not assigned to

**Best For**: Testing account management features, client coordination

---

### Pat ProjectManager (pat@movalab.dev)

**Role**: Project Manager

**Can Do**:
- Manage projects they're assigned to
- View and update tasks
- Track project progress and issues
- Clock in/out and track time
- Edit personal availability
- View newsletters
- Coordinate team members on projects

**Cannot Do**:
- Access admin pages
- Manage accounts
- View projects they're not assigned to

**Best For**: Testing project management, task coordination, workflow execution

---

### Dana Designer (dana@movalab.dev)

**Role**: Designer

**Can Do**:
- View and work on assigned projects
- Log time against tasks
- Clock in/out
- Edit personal availability
- Submit deliverables for review
- View newsletters

**Cannot Do**:
- Access admin pages
- Manage projects or accounts
- Approve deliverables

**Best For**: Testing designer workflow, time logging, deliverable submission

---

### Dev Developer (dev@movalab.dev)

**Role**: Developer

**Can Do**:
- View and work on assigned projects
- Log time against tasks
- Clock in/out
- Edit personal availability
- Submit code deliverables
- View newsletters

**Cannot Do**:
- Access admin pages
- Manage projects or accounts

**Best For**: Testing developer workflow, time tracking, task completion

---

### Client User (client@movalab.dev)

**Role**: Client

**Can Do**:
- View their projects (TechStart Inc)
- See project progress and updates
- Provide feedback
- View deliverables
- Approve or request changes

**Cannot Do**:
- Clock in/out (internal feature)
- View other accounts
- Access internal features

**Best For**: Testing client portal, external stakeholder view

---

## Feature Testing by Role

### Dashboard Widgets

| Widget | Super | Alex | Morgan | Pat | Dana | Dev | Client |
|--------|-------|------|--------|-----|------|-----|--------|
| My Projects | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Capacity Chart | Yes | Yes | Yes | Yes | Yes | Yes | No |
| My Time | Yes | Yes | Yes | Yes | Yes | Yes | No |
| My Tasks | Yes | Yes | Yes | Yes | Yes | Yes | No |
| My Workflows | Yes | Yes | Yes | Yes | Yes | Yes | No |
| My Accounts | Yes | Yes | Yes | Yes | Yes | Yes | No |
| Collaborators | Yes | Yes | Yes | Yes | Yes | Yes | No |

### Admin Pages

| Page | Super | Alex | Morgan | Pat | Dana | Dev | Client |
|------|-------|------|--------|-----|------|-----|--------|
| Admin Hub | Yes | No | No | No | No | No | No |
| Role Management | Yes | No | No | No | No | No | No |
| Workflows Admin | Yes | No | No | No | No | No | No |
| Time Tracking Admin | Yes | No | No | No | No | No | No |
| Analytics | Yes | Yes | No | No | No | No | No |
| RBAC Diagnostics | Yes | No | No | No | No | No | No |
| Database Status | Yes | No | No | No | No | No | No |

### Core Features

| Feature | Super | Alex | Morgan | Pat | Dana | Dev | Client |
|---------|-------|------|--------|-----|------|-----|--------|
| Clock In/Out | Yes | Yes | Yes | Yes | Yes | Yes | No |
| Edit Availability | Yes | Yes | Yes | Yes | Yes | Yes | No |
| View Newsletters | Yes | Yes | Yes | Yes | Yes | Yes | No |
| Log Time | Yes | Yes | Yes | Yes | Yes | Yes | No |
| Manage Tasks | Yes | Yes | Yes | Yes | No | No | No |
| Create Projects | Yes | No | No | Yes | No | No | No |
| Manage Accounts | Yes | No | Yes | No | No | No | No |

## Recommended Testing Flow

1. **Start as Alex Executive**:
   - View the executive dashboard
   - Check capacity charts
   - Browse accounts and projects
   - Try accessing admin pages (should see Access Denied)

2. **Switch to Pat Project Manager**:
   - Manage a project
   - Create/update tasks
   - Execute workflow steps
   - Log time entries

3. **Switch to Dana Designer**:
   - View assigned tasks
   - Log time against a task
   - Submit a deliverable

4. **Switch to Client User**:
   - View client portal
   - See project updates
   - Provide feedback

5. **Switch to Super Admin**:
   - Access all admin pages
   - View RBAC diagnostics
   - Manage roles and permissions

## Data Reset Notification

Remember: All demo data resets daily at midnight UTC. Any changes you make will be reverted to the default seed data.

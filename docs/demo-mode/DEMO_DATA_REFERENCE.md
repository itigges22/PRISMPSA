# Demo Data Reference

This document describes all seed data that is created for the demo environment. The data is reset daily via a Vercel cron job at midnight UTC.

## Demo Users

| User | Email | Role | Accounts |
|------|-------|------|----------|
| Super Admin | superadmin@movalab.dev | Superadmin | All |
| Alex Executive | alex@movalab.dev | Executive | 5 accounts |
| Morgan Manager | morgan@movalab.dev | Account Manager | 2 accounts |
| Pat ProjectManager | pat@movalab.dev | Project Manager | 4 accounts |
| Dana Designer | dana@movalab.dev | Designer | 4 accounts |
| Dev Developer | dev@movalab.dev | Developer | 3 accounts |
| Client User | client@movalab.dev | Client | 1 account |

## User IDs

```
Super Admin:       11111111-1111-1111-1111-000000000009
Alex Executive:    11111111-1111-1111-1111-000000000002
Morgan Manager:    11111111-1111-1111-1111-000000000003
Pat ProjectManager: 11111111-1111-1111-1111-000000000004
Dana Designer:     11111111-1111-1111-1111-000000000005
Dev Developer:     11111111-1111-1111-1111-000000000006
Client User:       11111111-1111-1111-1111-000000000008
```

## Accounts

| Account | ID | Account Manager |
|---------|----|-----------------|
| Acme Corporation | aaaaaaaa-0000-0000-0000-000000000001 | - |
| TechStart Inc | aaaaaaaa-0000-0000-0000-000000000002 | - |
| Green Energy Co | aaaaaaaa-0000-0000-0000-000000000003 | - |
| Fashion Forward | aaaaaaaa-0000-0000-0000-000000000004 | Morgan |
| The Local Bistro | aaaaaaaa-0000-0000-0000-000000000005 | - |

## Projects

| Project | Account | Status | Priority |
|---------|---------|--------|----------|
| Enterprise Dashboard Redesign | Acme Corporation | in_progress | high |
| Mobile App Development | Acme Corporation | planning | medium |
| MVP Launch Website | TechStart Inc | in_progress | urgent |
| User Onboarding Flow | TechStart Inc | review | high |
| Brand Identity Package | Green Energy Co | in_progress | medium |
| E-commerce Platform | Fashion Forward | planning | high |
| Spring Collection Lookbook | Fashion Forward | complete | medium |
| Website Redesign | The Local Bistro | in_progress | medium |

### Project IDs

All project IDs follow pattern: `11111111-2222-3333-4444-00000000000X`

- Project 1: `...000000000001` (Enterprise Dashboard)
- Project 2: `...000000000002` (Mobile App)
- Project 3: `...000000000003` (MVP Launch)
- Project 4: `...000000000004` (User Onboarding)
- Project 5: `...000000000005` (Brand Identity)
- Project 6: `...000000000006` (E-commerce)
- Project 7: `...000000000007` (Spring Collection)
- Project 8: `...000000000008` (Bistro Website)

## Tasks

13 tasks across various projects covering design, development, and QA phases.

## Workflow Templates

### 1. Standard Project Delivery
7-node workflow for client project delivery:
- Project Kickoff (start)
- Design Phase (department)
- Design Approval (approval)
- Development Phase (department)
- QA Review (approval)
- Client Sign-off (approval)
- Project Complete (end)

### 2. Quick Turnaround
4-node expedited workflow:
- Quick Start (start)
- Design & Dev (department)
- Final Review (approval)
- Delivered (end)

## Workflow Instances

Active workflows attached to projects:
- Enterprise Dashboard: Standard, at Development Phase
- MVP Launch Website: Standard, at Development Phase
- User Onboarding: Quick Turnaround, at Final Review
- Brand Identity: Standard, at Design Approval
- Bistro Website: Standard, at Development Phase
- Spring Collection: Quick Turnaround, completed

## Time Entries

### This Week
- Dana: ~21 hours across color palette, design reviews
- Dev: ~36 hours on frontend development, responsive work
- Alex: ~4.5 hours on executive reviews/meetings
- Morgan: ~8.5 hours on account management
- Pat: ~14.5 hours on project coordination

### Last Week
- Dana: ~14 hours on logo work, menu design
- Dev: ~4 hours on order system
- Alex: ~3 hours on reviews
- Morgan: ~2 hours on client meetings
- Pat: ~6 hours on UAT coordination

## User Availability

| User | This Week | Next Week |
|------|-----------|-----------|
| Dana Designer | 40 hrs | 32 hrs (training Friday) |
| Dev Developer | 40 hrs | 40 hrs |
| Pat Project Manager | 40 hrs | 40 hrs |
| Alex Executive | 20 hrs | 20 hrs |
| Morgan Manager | 35 hrs | 35 hrs |

## Task Week Allocations

Capacity planning allocations for current and next week:
- Frontend development: 24 hrs (this week), 32 hrs (next week)
- API updates: 16 hrs
- Responsive work: 20 hrs
- Color palette: 8 hrs
- Ordering system: 16 hrs
- QA testing: 24 hrs (next week)
- Executive oversight: 8 hrs
- Account management: 12 hrs
- Project coordination: 16 hrs

## Newsletters

1. **Q4 Company Update** (Published 7 days ago)
   - New clients announcement
   - Team achievements
   - Q1 2025 preview

2. **January Team Spotlight** (Published 2 days ago)
   - Employee of the month
   - Upcoming events
   - Process updates
   - Open positions

## Project Issues

5 project issues across different projects:
- API rate limiting (in_progress)
- Database access needed (open)
- Waiting for client copy (open)
- Color accessibility (resolved)
- Payment gateway delayed (open)

## Project Updates

6 project updates with recent activity notes from team members.

## Milestones

4 upcoming milestones:
- TechStart MVP Launch (+14 days)
- User Onboarding Go-Live (+5 days)
- Acme Dashboard Beta (+21 days)
- Brand Guidelines Delivery (+18 days)

## Project Stakeholders

Alex Executive is added as Executive Sponsor on key projects:
- Enterprise Dashboard Redesign
- MVP Launch Website
- Brand Identity Package
- E-commerce Platform

Morgan Manager is added as Account Manager on:
- Enterprise Dashboard Redesign
- MVP Launch Website

## Role Permissions

All internal roles (Executive, Account Manager, Project Manager, Designer, Developer, Admin) have these permissions enabled:
- `manage_time` - Clock in/out functionality
- `edit_own_availability` - Set weekly availability
- `view_newsletters` - Access company newsletters
- `view_departments` - View department pages

## Data Reset Schedule

- **When**: Daily at midnight UTC (Vercel Cron)
- **Endpoint**: `/api/cron/reset-demo-data`
- **Guard**: Only runs when `DEMO_MODE=true` or `NEXT_PUBLIC_DEMO_MODE=true`

## ID Patterns

All seed data uses predictable UUID patterns for easy identification:

| Entity | ID Pattern |
|--------|------------|
| Users | `11111111-1111-1111-1111-00000000000X` |
| Projects | `11111111-2222-3333-4444-00000000000X` |
| Tasks | `22222222-3333-4444-5555-00000000000X` |
| Assignments | `44444444-5555-6666-7777-00000000000X` |
| Time Entries | `66666666-7777-8888-9999-00000000000X` |
| Availability | `77777777-8888-9999-aaaa-00000000000X` |
| Workflow Templates | `aaaaaaaa-bbbb-0000-0000-00000000000X` |
| Workflow Nodes | `bbbbbbbb-aaaa-0000-0000-00000000000X` |
| Workflow Connections | `bbbbbbbb-cccc-0000-0000-00000000000X` |
| Workflow Instances | `cccccccc-0000-0000-0000-00000000000X` |
| Project Issues | `dddddddd-0000-0000-0000-00000000000X` |
| Newsletters | `eeeeeeee-0000-0000-0000-00000000000X` |
| Stakeholders | `ffffffff-0000-0000-0000-00000000000X` |
| Task Allocations | `99999999-0000-0000-0000-00000000000X` |

# PRISM PSA - Professional Service Automation

**Stop juggling disconnected tools. Start delivering exceptional client work.**

PRISM PSA is an enterprise-grade project and resource management platform built to solve the chaos of running a professional services organization with fragmented tools, disconnected workflows, and limited visibility. Originally developed for a student-run marketing agency managing 11 client accounts across 8 departments with 60+ members, PRISM PSA consolidates what used to require Basecamp, Monday.com, Notion, MS Planner, and Slack into a single unified system.

![Next.js](https://img.shields.io/badge/Next.js-15.5-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)

---

## 🎯 The Problem We Solve

### Running a Professional Services Agency Is Hard

If you're managing client work across multiple teams, you know these challenges intimately:

**Tool Fragmentation**
- Project management in one tool (Monday.com/Basecamp)
- Time tracking in another (Toggl/Harvest)
- Communication scattered across Slack threads
- Capacity planning in spreadsheets (or worse, not at all)
- No single source of truth for "what's actually happening?"

**Lack of Visibility**
- Leadership doesn't know who's overloaded until someone breaks
- Clients ask "when will this be done?" and you scramble for answers
- Junior team members work in silos without seeing the full picture
- You can't answer "do we have capacity for this new project?" without hours of investigation

**Organizational Chaos**
- Team members rotate between departments—who has access to what?
- New clients get added but projects fall through the cracks
- No clear accountability for deliverables
- Quality tracking is reactive, not proactive

**Student/High-Turnover Organizations Face Even More**
- Members stay 2-3 years then graduate/move on
- Tribal knowledge disappears with every departure
- Training new members takes weeks because tools are scattered
- Need to balance professional delivery with educational development

**The Result?** Micromanagement. Missed deadlines. Burned-out team members. Clients losing confidence.

---

## 💡 Why PRISM PSA Exists

PRISM PSA was purpose-built for an organization operating a complex, professional services model:

- **11 active client accounts** requiring dedicated account management
- **8 specialized departments** (Accounts, Analytics, Social Media, Multimedia, Copy, Graphics, Leadership, Internal Affairs)
- **60+ team members** with varying tenure, experience, and capacity
- **Frequent role rotations** as members develop new skills
- **Real client deliverables** with actual deadlines and consequences
- **Educational mission** requiring visibility into full workflows for learning

The agency tried everything—Basecamp for projects, Monday.com for tasks, Notion for documentation, Slack for communication, spreadsheets for capacity. Nothing integrated. Leadership lacked visibility into what was happening across teams. Team culture suffered because no one understood how their work connected to the bigger picture.

**PRISM PSA consolidates all of this into one intelligent system** that provides transparency, accountability without chaos, and professional delivery while supporting experiential learning.

---

## 🚀 How PRISM PSA Works

### The Client-Centric Approach

Everything in PRISM PSA starts with **client accounts**. Each client gets a dedicated account with:
- All their projects in one place
- Dedicated account managers
- Historical work and deliverables
- Capacity allocation showing who's working on their projects
- Real-time project health indicators

**Example:** Your "Coca-Cola" account shows 4 active projects (social campaign, analytics dashboard, video series, website redesign), 12 team members currently assigned, 145 hours of capacity allocated this month, and 87% utilization.

### The Work Distribution Model

Work flows naturally through the organization:

1. **Accounts Department** manages client relationships and creates projects
2. **Projects get assigned** to specialized departments (Graphics, Copy, Social, etc.)
3. **Team members get assigned** to projects based on skills and capacity
4. **Tasks break down** into actionable work with estimates and dependencies
5. **Progress flows up** through project updates, time tracking, and status changes

**Account assignments flow through workflows**—Your role and department stay consistent, but the client accounts you work on change dynamically based on project assignments. When a workflow step assigns you to a project, you automatically gain visibility into that account's work. This reflects how agencies actually operate: specialists maintain their expertise while flexibly supporting different clients.

### Multiple Views for Task Management

**Kanban Boards** - Teams see their **tasks** moving through status columns (To Do → In Progress → Review → Done). Drag-and-drop simplicity for managing daily work.

**Gantt Charts** - Project managers visualize **task** timelines, dependencies, and critical paths. See which tasks block others and identify bottlenecks before they become crises.

**Table Views** - Leadership gets sortable, filterable lists for bulk task updates and quick status checks.

**Workflow Views** - **Projects** move through custom workflows that define your agency's standard operating procedures. See exactly where each project stands in your delivery process.

**Analytics Dashboards** - Data-driven insights into department performance, resource allocation, project health, and utilization trends.

### Capacity Planning That Actually Works

Here's the game-changer: **PRISM PSA tracks capacity at every level**.

**Individual Level**
- Set your weekly availability (40 hours, 25 hours, whatever matches your commitment)
- See your current workload across all projects
- Track your utilization: Are you at 60% (room for more) or 110% (need help)?

**Account Level**
- See total capacity allocated to each client
- Understand if you're over-committed before accepting new work
- Proportionally splits team members' capacity across their assigned accounts

**Department Level**
- Track team capacity and workload distribution
- Identify over-allocated or under-utilized resources
- Make hiring decisions based on actual data

**Organization Level**
- Company-wide resource overview
- Capacity trends over time (daily, weekly, monthly, quarterly)
- Answer "can we take this project?" with confidence

**The Math Behind It:**
- **Available Hours** = User capacity proportionally split across their accounts
- **Allocated Hours** = Task estimates spread across project durations
- **Actual Hours** = Real logged time from time tracking
- **Utilization** = (Actual ÷ Available) × 100

**Example:** Sarah works 40 hours/week and is assigned to 3 client accounts. Her capacity is proportionally split, so each account sees ~13.3 hours of her available time. If Sarah logs 32 hours across all her work this week, her overall utilization is 80% (32 ÷ 40)—a healthy, sustainable workload.

### Time Tracking Without the Pain

Two flexible options:

**Clock In/Out** - Start a timer when you begin work. The system tracks your session. When you're done, allocate those hours across the tasks you worked on. Perfect for students who work in bursts between classes.

**Manual Entry** - Log hours directly on specific tasks with descriptions. Quick and straightforward for focused work sessions.

**Safety Features:**
- Sessions auto-close after 16 hours (catches "forgot to clock out" scenarios)
- Edit and delete your own entries
- Managers can view and adjust team entries
- Complete audit trail linking time to projects and tasks

### Permissions That Match Your Organization

**136 unique permissions across 15 categories** provide enterprise-grade access control:

- **Project Permissions** - Who can create, edit, delete projects?
- **Task Permissions** - Who can assign tasks, update status, log time?
- **Account Permissions** - Who manages client relationships?
- **Capacity Permissions** - Who sees capacity analytics?
- **Role Permissions** - Who can manage organizational structure?

**Context-aware permissions** mean access adapts automatically:
- Assigned to a project? You can update it and log time.
- Not assigned? You can view it but not edit (if your role allows viewing).
- Account manager for a client? You have elevated permissions for that client's projects.

**Hierarchical reporting** creates clear chains of accountability while supporting lateral collaboration.

### Communication Built Into Workflow

**Project Updates** - Journal-style status updates that flow to your dashboard based on what you have access to. See updates for your projects, your department's projects, or all projects (depending on your role).

**Issue Tracking** - Log blockers and problems separately from status updates. Track issue status (Open → In Progress → Resolved) with clear ownership and resolution tracking.

**Newsletters** - Organization-wide announcements appear on the welcome page. Keep everyone aligned on company news, policy changes, and celebrations.

**The Difference:** Communication happens in context, not scattered across Slack channels where important updates get buried.

---

## 🔄 Workflow Automation: SOPs That Actually Work

### The Problem with Traditional SOPs

Every marketing agency has Standard Operating Procedures. They're documented in Google Docs, printed in binders, explained in onboarding meetings—and promptly forgotten. Why? Because traditional SOPs are:

- **Static documents** that don't match dynamic reality
- **Disconnected** from actual work tools
- **Unenforceable** without constant follow-up
- **Invisible** to leadership (until something breaks)

**The result?** Work flows through informal channels. "Hey, is this done?" Slack messages. Missed handoffs. Blame games. Quality inconsistency.

### Visual Workflow Builder

PRISM PSA transforms your SOPs into **visual, interactive workflows** that guide work through your organization:

**Create Workflows Visually**
- Drag-and-drop node-based editor (similar to n8n or Zapier)
- Node types: Department handoffs, Role assignments, Client approvals, Conditional branches
- Connect nodes to define valid paths work can take
- Set requirements at each step (forms, approvals, deliverables)

**Example: Video Production Workflow**
```
Account Manager (briefing) → Creative Lead (concept) → Videographer (production)
→ Creative Lead (review) → Account Manager (client prep) → Client (approval) → Delivery
```

Each step has clear ownership. Each handoff is tracked. No work falls through the cracks.

### Why Workflow Automation Matters for Marketing Agencies

**For Account Managers:**
- Know exactly where every project stands
- Get notified when work reaches client-ready status
- Never miss a handoff or approval

**For Creative Teams:**
- Clear understanding of what's expected at each stage
- No ambiguity about "who has this next?"
- Automatic assignment based on role and capacity

**For Leadership:**
- See where work bottlenecks occur
- Identify process inefficiencies with data
- Make informed decisions about resource allocation

**For Clients:**
- Professional approval workflows built into the process
- Clear visibility into project progression
- Feedback captured at the right moments

### Guardrails, Not Handcuffs

Workflows provide structure without being rigid:

- **Standard paths guide work** - Team members know exactly what comes next
- **Consistent quality** - Every project follows proven processes
- **Clear accountability** - No ambiguity about who owns what at each stage
- **Process improvement** - See how work actually flows and optimize over time

This isn't about forcing compliance—it's about **consistency with clarity**.

---

## 🤝 Client Portal: Professional Client Experience

### Stop the "Any Updates?" Emails

Clients deserve visibility without pestering your team. PRISM PSA's Client Portal provides:

**Project Visibility**
- Clients see their projects' current status
- Progress through workflow stages visible
- Timeline and milestone tracking

**Built-in Approval Workflows**
- When work reaches client approval stage, they get notified
- Review, approve, or request revisions directly in the portal
- Feedback captured and routed to the right team

**Feedback Collection**
- Satisfaction scoring after project completion
- Private feedback (only visible to account managers and leadership)
- Data-driven client relationship insights

### How It Works

1. Account managers invite clients via email
2. Clients create a limited portal account
3. They see only their account's projects
4. Approval requests appear in their dashboard
5. Feedback forms appear after project completion

**Security:** Client access is isolated. They see only their own projects. Row Level Security ensures no data leakage.

---

## 📊 What You Get: Real-World Use Cases

### For Account Managers
**Scenario:** Client asks, "When will the social media campaign be ready?"

**Before PRISM PSA:** Slack 5 different people, check Monday.com, search email for the last update, piece together a guess.

**With PRISM PSA:** Open the client's account page. See the campaign project is 67% complete, 3 tasks in review, 1 blocked (waiting on client feedback), estimated completion in 6 days. Answer the client in 30 seconds with confidence.

### For Department Leaders
**Scenario:** New project request comes in. Do you have capacity to take it on?

**Before PRISM PSA:** Ping team members one-by-one asking about their workload. Make a gut-feel decision. Hope you're right.

**With PRISM PSA:** Check department capacity dashboard. See current utilization at 72% (healthy). View weekly capacity trends showing 15 hours available next week. Accept the project and assign it with data-backed confidence.

### For Team Members
**Scenario:** You work on multiple projects across different clients. What should you work on today?

**Before PRISM PSA:** Check Basecamp for Client A, Monday.com for Client B, Notion for internal projects. Hope you didn't miss anything urgent.

**With PRISM PSA:** Open your dashboard. See all assigned tasks prioritized by due date and status. Clock in, work, clock out, allocate time. Everything in one place.

### For Leadership
**Scenario:** Board meeting tomorrow. Need to report on organizational health.

**Before PRISM PSA:** Spend 4 hours compiling spreadsheets from disparate tools. Present outdated data. Field questions you can't answer.

**With PRISM PSA:** Open analytics dashboard. See real-time metrics: 23 active projects across 11 clients, 78% average utilization, 4 projects at-risk (and why), department performance breakdown. Export reports in minutes.

### For New Members (Onboarding)
**Scenario:** New student joins the agency. They need to understand how work flows and get productive quickly.

**Before PRISM PSA:** Read scattered documentation across Notion, watch outdated Loom videos, shadow 5 different people across 3 tools, still confused after 2 weeks.

**With PRISM PSA:** Get assigned to projects with clear tasks, see the full workflow from client request to deliverable completion, understand your role in the bigger picture, log time and contribute meaningfully within days.

---

## 🔍 Why PRISM PSA Is Different

### vs. Basecamp
**Basecamp** is great for communication and simple project tracking, but it doesn't handle capacity planning, time tracking, or complex organizational permissions. You'll still need spreadsheets for resource management and another tool for time tracking.

**PRISM PSA** integrates capacity planning, time tracking, and sophisticated permissions into the project workflow. You can see not just what projects exist, but whether you have the capacity to deliver them.

### vs. Monday.com
**Monday.com** is powerful for task management with beautiful boards, but its capacity features are limited to add-ons, permissions are board-based (not contextual), and it's not designed for organizations with frequent role changes and complex departmental relationships.

**PRISM PSA** provides dynamic department membership based on actual project assignments, proportional capacity allocation for people working across multiple clients, and context-aware permissions that adapt to your organizational structure.

### vs. Notion
**Notion** is incredible for documentation and lightweight databases, but it's not purpose-built for professional services project management. Time tracking is manual, capacity planning requires complex formulas, and there's no built-in permissions for client confidentiality.

**PRISM PSA** is purpose-built for client services work with first-class time tracking, automatic capacity calculations, and enterprise-grade Row Level Security protecting sensitive client data.

### vs. Spreadsheets
**Spreadsheets** are flexible but become unmaintainable nightmares as organizations grow. Data gets stale, formulas break, permissions are all-or-nothing, and there's no audit trail.

**PRISM PSA** provides structured data with automatic calculations, granular permissions, complete audit trails, and real-time updates across all views.

### The PRISM PSA Advantage

**Single Source of Truth** - One system for projects, tasks, time, capacity, and communication.

**Dynamic Organization** - Departments and permissions adapt as people change roles and projects.

**Data-Driven Decisions** - Stop guessing about capacity and project health.

**Professional + Educational** - Support learning while delivering real client work.

**Scalable Architecture** - Built on enterprise-grade technologies with Row Level Security, sophisticated permissions, and real-time updates.

---

## 🛠️ Technical Foundation

### Built for Scale and Security

**Modern Tech Stack**
- **Next.js 15** (App Router) with React Server Components for optimal performance
- **TypeScript** throughout for type safety and developer confidence
- **Supabase** (PostgreSQL + Row Level Security) for enterprise-grade data security
- **Tailwind CSS + shadcn/ui** for beautiful, accessible interfaces
- **Recharts** for powerful analytics visualizations

**Security-First Architecture**
- **Row Level Security** on every database table—data access controlled at the PostgreSQL level
- **136 unique permissions** providing fine-grained access control
- **Rate limiting** to prevent abuse and DDoS attacks
- **Input validation** on all API endpoints with Zod schemas
- **Audit logging** for critical organizational changes
- **HTTP-only cookies** for secure authentication
- **Security headers** (CSP, HSTS, X-Frame-Options) for production hardening

**Performance & Reliability**
- **Real-time updates** with Supabase subscriptions
- **Optimistic UI updates** for responsive interactions
- **Automatic session management** (16-hour auto-clock-out prevents errors)
- **Environment-aware configuration** (stricter security in production)
- **Mobile-responsive** design works on desktop, tablet, and phone

### Architecture Highlights

**Dynamic Department Membership** - Unlike static organizational charts, departments derive from actual project assignments. Work on Graphics projects? You're in Graphics. This accurately reflects collaborative work patterns and adapts as people rotate roles.

**Proportional Capacity Allocation** - Users working on multiple client accounts have their capacity split proportionally. A 40-hour/week person on 3 accounts contributes 13.3 hours to each account's capacity calculations. This prevents the over-counting that plagues traditional resource management tools.

**Context-Aware Permissions** - Permissions aren't just role-based; they're contextual. You might have limited global permissions but elevated permissions for projects you're assigned to or accounts you manage. This enables appropriate access without administrative overhead.

**Task-Level Time Tracking** - Time entries link directly to tasks, creating an audit trail from client hours billed back to specific deliverables. Managers can see not just "how much time was logged" but "what was actually accomplished."

**Hierarchical Data Model** - Clients → Accounts → Projects → Tasks creates clear relationships with cascade rules. Delete a project? Associated tasks are handled appropriately. Remove a user from an account? Their project assignments update automatically.

**Workflow State Machine** - The workflow engine uses a state-machine architecture with:
- `workflow_templates` - Reusable workflow definitions
- `workflow_nodes` - Individual steps (department, role, client approval, conditional)
- `workflow_connections` - Valid transition paths between nodes
- `workflow_instances` - Active workflow executions tied to projects
- `workflow_history` - Complete audit trail of every handoff, including out-of-order transitions

**Dynamic Form Builder** - Forms are stored as JSONB schemas supporting:
- Multiple field types: text, number, date, dropdown, multiselect, file upload, textarea, email, checkbox
- Conditional field visibility (show field B only if field A = value)
- Form responses linked to workflow history for complete traceability
- Admin-configurable templates without code changes

**Service Layer Pattern** - Business logic is organized into dedicated service files (`*-service.ts`) that:
- Encapsulate complex operations
- Provide consistent interfaces for API routes
- Enable testing and reuse
- Separate concerns from data access layer

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18.0 or higher
- **npm**, **pnpm**, or **yarn**
- **Supabase account** (free tier works great for small teams)
- **Upstash Redis account** (optional, for production rate limiting)

### Quick Setup

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd PRISMPSA
   npm install
   ```

2. **Environment Configuration**

   Create `.env.local`:
   ```env
   # Supabase (Required)
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

   # Rate Limiting (Optional - Recommended for Production)
   UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your-token
   ENABLE_RATE_LIMIT=true

   # Development (Optional)
   EXPOSE_ERROR_DETAILS=true
   ```

3. **Database Setup**

   In your Supabase project SQL Editor, run migration files from `supabase/migrations/` in order. These migrations create:
   - Core tables (users, accounts, projects, tasks, time_entries, etc.)
   - Row Level Security policies for data protection
   - Permission system tables (roles, permissions, role_permissions)
   - Capacity tracking tables (user_availability)
   - Organizational structure (departments, role hierarchies)

4. **Launch**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000)

### Initial Configuration

1. **Create Your Superadmin Account**
   - Sign up through the app interface
   - Navigate to `/superadmin-setup` to grant yourself superadmin privileges
   - (Alternatively, manually set `is_superadmin = true` in the database `users` table)

2. **Build Your Organization Structure**
   - Navigate to **Admin → Roles → Departments**
   - Create departments matching your organization (e.g., Accounts, Graphics, Social Media, Leadership)
   - Define roles with appropriate permissions for each department
   - Use permission categories to grant access systematically

3. **Invite and Configure Team Members**
   - Team members sign up through the app
   - Approve pending users via **Admin → Roles → Pending Users**
   - Assign roles that match their responsibilities
   - Permissions cascade automatically based on role assignments

4. **Set Up Capacity Tracking**
   - Each user navigates to their Profile page
   - Set weekly availability (e.g., 40 hours/week for full-time, 15 hours/week for part-time students)
   - Optionally configure daily breakdowns if availability varies by day
   - System automatically allocates capacity across assigned projects

5. **Create Client Accounts and Start Managing Projects**
   - Navigate to **Accounts** page
   - Create accounts for each client
   - Assign account managers
   - Create projects under accounts
   - Assign team members and start tracking work

---

## 💼 Common Workflows

### Account Manager: Onboarding a New Client

1. Navigate to **Accounts** page → **Create Account**
2. Enter client details (name, contact info, service tier)
3. Assign yourself as account manager
4. Create initial projects for the client (e.g., "Website Redesign", "Social Media Campaign")
5. Assign team members from relevant departments
6. Set project timelines and estimated hours
7. Monitor progress through the account dashboard

### Project Manager: Planning Sprint Work

1. Open project detail page
2. Switch to **Kanban View** to see current task status
3. Create new tasks for upcoming sprint
4. Set task estimates, priorities, and due dates
5. Assign tasks to team members based on capacity
6. Check **Capacity Dashboard** to verify assignments don't over-allocate team
7. Add task dependencies for sequential work
8. Post project update communicating sprint plan to team

### Team Member: Daily Work Routine

1. **Morning:** Check Dashboard for assigned tasks prioritized by due date
2. **Start Work:** Clock in using header clock icon
3. **Execute:** Work on tasks, moving them through statuses on Kanban board
4. **End Work:** Clock out and allocate session hours across tasks worked on
5. **Communication:** Post project updates for significant progress or blockers
6. **Track:** View personal capacity and utilization to balance workload

### Department Leader: Capacity Review

1. Navigate to **Department Page** (auto-generated based on your role)
2. Review team capacity metrics:
   - Available hours across all team members
   - Current utilization percentages
   - Over-allocated or under-utilized individuals
3. Switch to **Capacity Trends** view
4. Analyze weekly/monthly patterns to identify:
   - Upcoming capacity crunches
   - Opportunities to take on new work
   - Need for additional hiring or redistribution
5. Adjust project assignments if team members are over-allocated
6. Use data in resource planning conversations with leadership

### Leadership: Organizational Health Check

1. Navigate to **Analytics Dashboard**
2. Review key metrics:
   - Active projects by client and status
   - Project health distribution (Healthy, At-Risk, Critical)
   - Department utilization comparison
   - Capacity allocation across accounts
3. Drill into at-risk projects to understand blockers
4. Check capacity trends to forecast hiring needs
5. Export data for board meetings and stakeholder reports

---

## 📁 Project Structure

```
PRISMPSA/
├── app/                          # Next.js App Router pages and routes
│   ├── (auth)/                  # Authentication pages (login, signup)
│   ├── accounts/                # Client account management
│   │   └── [accountId]/        # Account detail pages
│   ├── projects/                # Project detail pages
│   │   └── [projectId]/        # Individual project views
│   ├── kanban/                  # Kanban board view
│   ├── gantt/                   # Gantt chart view
│   ├── capacity/                # Capacity planning dashboard
│   ├── analytics/               # Analytics and reporting
│   ├── admin/                   # Admin pages (roles, permissions, departments)
│   ├── profile/                 # User profile and availability
│   ├── time-tracking/           # Time entry management
│   └── api/                     # API routes
│       ├── accounts/           # Account CRUD operations
│       ├── projects/           # Project management
│       ├── tasks/              # Task operations
│       ├── time-entries/       # Time tracking
│       ├── capacity/           # Capacity calculations
│       └── auth/               # Authentication endpoints
├── components/                   # React components
│   ├── ui/                      # Base UI components (shadcn/ui)
│   ├── account-overview.tsx     # Account dashboard component
│   ├── kanban-*.tsx             # Kanban board components
│   ├── gantt-chart.tsx          # Gantt visualization
│   ├── capacity-*.tsx           # Capacity planning components
│   ├── analytics-*.tsx          # Analytics dashboards
│   └── ...
├── lib/                         # Utilities and business logic
│   ├── supabase-*.ts            # Supabase client configurations
│   ├── *-service.ts             # Business logic services
│   ├── rbac.ts                  # Role-based access control logic
│   ├── permissions.ts           # Permission definitions (136 permissions)
│   ├── validation-schemas.ts    # Zod input validation schemas
│   ├── rate-limit.ts            # Rate limiting with Upstash Redis
│   └── config.ts                # Application configuration
├── supabase/                    # Database migrations and types
│   └── migrations/              # SQL migration files
├── public/                      # Static assets
└── README/                      # Additional documentation
    ├── FEATURELIST.md          # Comprehensive feature documentation
    └── SECURITY.md             # Security architecture details
```

---

## 📊 Key Metrics Explained

### Available Hours
**What it means:** Total capacity your team has available to work, accounting for people working on multiple clients.

**How it's calculated:** User weekly availability proportionally split across the accounts they're assigned to.

**Example:** Alex works 40 hours/week and is assigned to projects for 2 clients. Each client account sees 20 hours of Alex's available capacity.

**Why it matters:** Prevents over-counting capacity when team members work across multiple accounts. Traditional systems count Alex's 40 hours twice (once per client), leading to accepting more work than you can deliver.

### Allocated Hours
**What it means:** Hours committed to specific tasks based on estimates and project timelines.

**How it's calculated:** Task estimates spread proportionally across their duration (start date to due date).

**Example:** A 40-hour task spanning 4 weeks contributes 10 hours to each week's allocation. If the task is only active for 2 weeks of a month, it contributes 20 hours to that month's allocation.

**Why it matters:** Shows future commitments, helping you understand if you're over-committing before work begins. If allocated hours exceed available hours, you're setting up for failure.

### Actual Hours
**What it means:** Real hours logged through time tracking—the ground truth of work performed.

**How it's calculated:** Sum of all time entries logged by team members via clock sessions or manual entries.

**Example:** Sarah logged 6.5 hours today across 3 tasks on 2 different projects.

**Why it matters:** This is what you bill clients (if applicable) and what actually happened vs. what you planned. Tracking actual vs. estimated reveals whether estimates are accurate.

### Utilization
**What it means:** How effectively you're using available capacity.

**Formula:** `(Actual Hours ÷ Available Hours) × 100`

**Interpretation:**
- **Under 60%** - Significantly under-utilized, room for much more work
- **60-80%** - Healthy utilization with buffer for unexpected work
- **80-95%** - High utilization, team is busy and productive
- **95-110%** - Over-allocated, risk of burnout, deadlines at risk
- **Over 110%** - Critical over-allocation, immediate redistribution needed

**Example:** Department has 200 available hours this week. Team logged 165 actual hours. Utilization = 82.5% (healthy).

**Why it matters:** Too low and you're under-utilizing talent (or over-staffed). Too high and you're burning out your team and risking quality. Sweet spot is 70-90% with some variance based on project deadlines.

---

## 🔒 Security & Privacy

PRISM PSA is built with enterprise-grade security:

- **Row Level Security (RLS)** - All data access controlled at the PostgreSQL database level, not just application logic
- **136 Granular Permissions** - Fine-grained control over who can do what, organized across 15 permission categories
- **Context-Aware Access** - Permissions adapt based on project assignments, account management, and organizational hierarchy
- **Secure Authentication** - Industry-standard OAuth with Supabase, HTTP-only cookies, secure session management
- **Rate Limiting** - Protect against abuse and DDoS attacks with Upstash Redis
- **Input Validation** - All API inputs validated with Zod schemas before processing
- **Audit Logging** - Track critical organizational changes with user attribution and timestamps
- **Auto Clock-Out** - Time tracking sessions automatically close after 16 hours to prevent exploits
- **Production Hardening** - Security headers (CSP, HSTS, X-Frame-Options), HTTPS enforcement, environment-aware security levels

**Data Privacy:** Row Level Security ensures users only see data they're authorized to access. Even database administrators can't bypass RLS policies. Client confidentiality is protected by design.

---

## 🚀 Future Roadmap

PRISM PSA is continuously evolving. Here's what's planned for future releases:

### Phase 2: Analytics Foundation

**ELO Rating System**
- Admin-configurable performance scoring per role
- Factors: deadline adherence, client satisfaction, revision frequency, collaboration
- Users see their progression and standing within their role
- Leadership uses data for informed assignment decisions

**Enhanced Wellbeing Analytics**
- Track workload sentiment over time
- Leadership alerts when team members show declining wellbeing
- Integrate with capacity to prevent burnout

**Workflow Analytics Engine**
- Identify bottlenecks in your processes
- Measure average time at each workflow stage
- Surface inefficiencies and improvement opportunities

**Project Health Indicators**
- Real-time calculation of project health (Green/Yellow/Red)
- Based on: deadline proximity, activity frequency, open issues, hours vs estimates
- Proactive alerts before projects become critical

### Phase 3: Dashboard Enhancements

**Personal Dashboard Enhancement**
- ELO scores and trends at a glance
- Wellbeing tracking integration
- Active workflow status for all assigned work
- Performance insights and improvement suggestions

**Leadership Capacity Dashboard**
- Color-coded team heatmap showing capacity and wellbeing
- Predictive forecasting for upcoming bottlenecks
- Quick action buttons for workload redistribution

**Skills Tracking Integration**
- Tag tasks with required skills
- Track skill development across the organization
- Match assignments to skill profiles

**Department & Account Analytics Pages**
- Aggregate performance metrics by team
- Comparative benchmarking across departments
- Deep-dive analytics for account managers

### Phase 4: Organizational Analytics

**Executive Analytics Dashboard**
- Consolidated org-wide metrics
- Quality trends, capacity utilization, client satisfaction
- Predictive alerts and recommendations

**Collaboration Network Visualization**
- Interactive graph showing who works with whom
- Identify silos and cross-team collaboration opportunities
- Measure collaboration density and patterns

**Leadership Intelligence Hub**
- Permission-gated page for executive insights
- Weekly auto-generated intelligence reports
- Action items: check-ins needed, recognition opportunities, redistribution needs

### Phase 5: Recognition & Engagement

**Performance Tier System**
- Tier assignments based on ELO and other metrics
- Progress tracking toward next tier
- Recognition for advancement

**Achievements System**
- Admin-configurable badges and achievements
- Auto-awarded when criteria met
- Displayed on profiles and dashboards

**Competitive Challenges** (Optional)
- Time-bound competitions with leaderboards
- Department vs department, individual rankings
- Configurable to match your culture

---

## 🎓 Perfect for Student Organizations

PRISM PSA was built for a student-run agency, making it ideal for organizations where:

- **Members have limited tenure** (2-4 years typical) and knowledge transfer is critical
- **Roles rotate frequently** as students develop new skills and interests
- **Capacity varies** based on academic schedules, finals, breaks
- **Learning is the mission** alongside professional delivery
- **Budgets are limited** but quality expectations are high

**Key Student-Friendly Features:**

- **Comprehensive onboarding** - New members see the full workflow in one place
- **Educational transparency** - Juniors learn by seeing how seniors manage complex projects
- **Flexible capacity** - Set availability that matches your academic schedule
- **Built-in accountability** - Clear expectations and workflow tracking
- **Career skill building** - Work with professional-grade tools that prepare you for industry

---

## 🤝 Contributing

Contributions are welcome! This project was originally developed for a student-run marketing agency but is designed to be adaptable for any professional services organization.

For feature requests, bug reports, or questions about adapting PRISM PSA for your organization, please open an issue on GitHub.

---

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details.

---

## 🆘 Support & Documentation

- **Feature Documentation**: See `/README/FEATURELIST.md` for comprehensive feature descriptions and database architecture
- **Security Guide**: See `/README/SECURITY.md` for detailed security architecture and best practices
- **API Documentation**: See inline code comments and validation schemas in `/lib/validation-schemas.ts`

---

**Built by students, for students—delivering professional results without the professional price tag.**

*PRISM PSA: Because your team deserves better than spreadsheet chaos and Slack pandemonium.*

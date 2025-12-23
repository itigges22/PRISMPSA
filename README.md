# MovaLab

**Professional Services Automation for the Modern Agency**

MovaLab is a cloud-based platform that consolidates agency operations into a single, intelligent system. Built for marketing agencies, creative studios, and consulting firms with 5-50 employees who are tired of juggling Monday.com, Notion, Harvest, Float, and spreadsheets just to answer "do we have capacity for this project?"

Originally developed for a student-run marketing agency managing 11 client accounts across 8 departments with 60+ members, MovaLab replaces what used to require Basecamp, Monday.com, Notion, MS Planner, and Slack with a single unified system.

![Next.js](https://img.shields.io/badge/Next.js-15.5-black?style=for-the-badge&logo=next.js&labelColor=aliceblue&color=bbd3dd&logoColor=%23000000)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=TypeScript&labelColor=aliceblue&color=bbd3dd)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green?style=for-the-badge&logo=Supabase&labelColor=aliceblue&color=bbd3dd)
[![Discord](https://img.shields.io/discord/1450515917724188757?style=for-the-badge&logo=discord&label=Join%20Our%20Discord!&labelColor=aliceblue&color=bbd3dd)](https://discord.gg/99SpYzNbcu)

---

## 🎯 The Problem

Professional services organizations struggle with:

- **Tool fragmentation** — Projects in Monday.com, time in Toggl, communication in Slack, capacity in spreadsheets
- **Lack of visibility** — Can't answer "who's overloaded?" or "do we have capacity?" without hours of investigation
- **Organizational chaos** — Team rotations, unclear accountability, tribal knowledge lost when people leave
- **Client communication** — "Any updates?" emails because clients have no visibility into progress
- **Ignored SOPs** — 30-page PDFs that no one reads, informal workflows, inconsistent quality

The result? Burnout, missed deadlines, over-commitment, and margins that erode with every project.

## 💡 The Solution

MovaLab replaces your fragmented tool stack with one unified platform:

| What You Have Now | What MovaLab Provides |
|-------------------|----------------------|
| Monday/Asana/Basecamp | Project & task management (Kanban, Gantt, Table views) |
| Harvest/Toggl | Time tracking (clock in/out + manual entry) |
| Float/spreadsheets | Real-time capacity planning with proportional allocation |
| Static SOP documents | Visual workflow builder with enforced handoffs |
| Slack status updates | Automated project visibility for clients and leadership |

**One platform. One source of truth. 40-60% reduction in software costs.**

---

## ✨ Core Features

### 📊 Intelligent Capacity Planning
- **Proportional allocation** — Users on 3 accounts split their 40 hrs/week capacity proportionally (13.3 hrs each)
- **Real-time utilization** — Track individual, department, and organization-wide capacity
- **Multi-level analytics** — Individual → Department → Account → Organization views
- **Prevents over-commitment** — Know if you can take new work before saying yes

### 🔄 Visual Workflow Automation
- **Drag-and-drop workflow builder** — Transform SOPs into visual, enforceable workflows
- **Node types** — Department handoffs, role assignments, client approvals, conditional branches
- **Complete audit trail** — Track every transition, handoff, and approval
- **Guardrails, not handcuffs** — Structure that guides without being rigid

### ⏱️ Flexible Time Tracking
- **Clock in/out** — Start timer, work, allocate hours across tasks when done
- **Manual entry** — Log hours directly on specific tasks
- **Auto clock-out** — Sessions auto-close after 16 hours (prevents forgotten sessions)
- **User dashboard** — View, filter, and analyze logged time with charts and 14-day edit window

### 👥 Dynamic Permissions
- **~40 consolidated permissions** across 15 categories (reduced from 136 via RBAC refactoring)
- **Context-aware access** — Permissions adapt based on project assignments and account management
- **Row Level Security** — Data access controlled at PostgreSQL level, not just application logic
- **Hierarchical reporting** — Clear chains of accountability

### 📈 Multiple Task Views
- **Kanban boards** — Drag-and-drop task management (To Do → In Progress → Review → Done)
- **Gantt charts** — Timeline visualization with dependencies and critical paths
- **Table views** — Sortable, filterable lists for bulk updates
- **Workflow views** — Track projects through custom approval workflows
- **Analytics dashboards** — Performance metrics, resource allocation, project health

### 🤝 Client Portal
- **Project visibility** — Clients see real-time progress without pestering your team
- **Built-in approvals** — Review, approve, or request revisions directly
- **Feedback collection** — Post-project satisfaction scoring and insights
- **Secure isolation** — Clients see only their own projects (RLS enforced)

---

## 🛠️ Tech Stack

**Modern & Scalable**
- Next.js 15 (App Router) + React Server Components
- TypeScript for type safety
- Supabase (PostgreSQL + Row Level Security)
- Tailwind CSS + shadcn/ui
- Recharts for analytics

**Security-First**
- Row Level Security on every table
- ~40 consolidated permissions (MANAGE pattern)
- Rate limiting (Upstash Redis)
- Input validation (Zod schemas)
- Audit logging for critical changes
- HTTP-only cookies, security headers

---

## 🚀 Quick Setup

### Prerequisites
- Node.js 18.0+
- Supabase account (free tier works)
- Upstash Redis (optional, for production rate limiting)

### Installation

1. **Clone and Install**
   ```bash
   git clone https://github.com/itigges/MovaLab.git
   cd MovaLab
   npm install
   ```

2. **Environment Configuration**

   Create `.env.local`:
   ```env
   # Supabase (Required)
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

   # Rate Limiting (Optional - Production Recommended)
   UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your-token
   ENABLE_RATE_LIMIT=true

   # Development (Optional)
   EXPOSE_ERROR_DETAILS=true
   LOG_LEVEL=debug
   ```

3. **Database Setup**

   In your Supabase SQL Editor, run migration files from `supabase/migrations/` in order to create:
   - Core tables (users, accounts, projects, tasks, time_entries)
   - Row Level Security policies
   - Permission system (roles, departments, hierarchies)
   - Capacity tracking tables
   - Workflow system tables

4. **Launch**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

### Initial Setup

1. **Create Superadmin** — Sign up, visit `/superadmin-setup` to grant yourself admin privileges
2. **Build Organization** — Create departments and roles via Admin → Roles
3. **Invite Team** — Members sign up, you approve via Admin → Pending Users
4. **Set Capacity** — Users set weekly availability in their profile
5. **Create Accounts** — Add client accounts and start managing projects

---

## 📁 Project Structure

```
MovaLab/
├── app/                    # Next.js App Router
│   ├── accounts/          # Client account management
│   ├── projects/          # Project detail pages
│   ├── capacity/          # Capacity planning
│   ├── analytics/         # Analytics & reporting
│   ├── admin/             # Admin pages
│   ├── time-entries/      # User time tracking dashboard
│   └── api/               # API routes
├── components/            # React components
│   ├── ui/               # shadcn/ui base components
│   ├── kanban-*.tsx      # Kanban boards
│   ├── gantt-chart.tsx   # Gantt visualization
│   ├── capacity-*.tsx    # Capacity planning
│   └── workflow-*.tsx    # Workflow builder
├── lib/                   # Business logic & utilities
│   ├── *-service.ts      # Service layer (encapsulates business logic)
│   ├── permissions.ts    # ~40 permission definitions
│   ├── rbac.ts           # Permission checking logic
│   └── supabase-*.ts     # Supabase client configs
├── types/                 # TypeScript definitions
└── docs/                  # Documentation
    ├── architecture/FEATURELIST.md
    └── security/SECURITY.md
```

---

## 🔍 Why MovaLab vs Alternatives

| Feature | MovaLab | Basecamp | Monday.com | Notion |
|---------|---------|----------|------------|--------|
| **Capacity Planning** | ✅ Built-in, proportional | ❌ None | 🟡 Add-on only | ❌ Manual formulas |
| **Time Tracking** | ✅ Clock + manual entry | ❌ None | 🟡 Basic | ❌ Manual only |
| **Context Permissions** | ✅ Assignment-based | ❌ Basic | 🟡 Board-based | ❌ Page-based |
| **Dynamic Departments** | ✅ Derived from work | ❌ Static | ❌ Static | ❌ Static |
| **Workflow Automation** | ✅ Visual builder | ❌ None | 🟡 Limited | ❌ None |
| **Client Portal** | ✅ Built-in | ❌ None | 🟡 Separate product | ❌ None |
| **RLS Security** | ✅ Database-level | ❌ App-level | ❌ App-level | ❌ App-level |
| **Single Source of Truth** | ✅ Yes | ❌ No | ❌ No | ❌ No |

**MovaLab Advantage:** Purpose-built for professional services with integrated capacity planning, sophisticated permissions, and real-time visibility across all work.

---

## 📊 Key Metrics

### Available Hours
Total team capacity proportionally split across assigned accounts. Prevents over-counting when people work on multiple clients.

### Allocated Hours
Future commitments based on task estimates. Shows if you're over-committing before work begins.

### Actual Hours
Real logged time — the ground truth of work performed. What you bill and what actually happened.

### Utilization
`(Actual ÷ Available) × 100`
- **60-80%** — Healthy with buffer
- **80-95%** — High productivity
- **95-110%** — Risk of burnout
- **>110%** — Critical, redistribute immediately

---

## 🎯 Perfect for Small Creative Agencies

MovaLab is purpose-built for agencies where:
- Teams wear multiple hats across several clients
- Capacity is tight and over-commitment kills margins
- Turnover means knowledge walks out the door
- Enterprise tools are overkill (and overpriced)
- You need structure without bureaucracy

**Agency-Friendly Features:**
- Single source of truth across all client work
- Proportional capacity planning that actually works
- Workflows that enforce quality without slowing you down
- Client portal that eliminates status update emails
- Enterprise-grade security at SMB-friendly pricing

---

## 🚀 Roadmap

### Near-Term (Q1-Q2 2025)

**Analytics & Insights**
- Project health scoring and risk indicators
- Workflow analytics (completion times, bottleneck identification)
- Team wellbeing dashboard for leadership
- Enhanced capacity forecasting

**Client & Account Enhancements**
- Full client dashboard with project visibility
- External data source integrations (social media analytics per account)
- Strategic plans tied to accounts and projects
- Client feedback improvements

### Mid-Term (Q3-Q4 2025)

**Revenue & Business Operations**
- Service offerings library (tied to workflow templates)
- Proposals and estimates
- Bill of materials / project budgeting
- QuickBooks and/or Stripe integration for revenue tracking

**Collaboration Analytics**
- Network visualizations (who collaborates with whom)
- Department collaboration mapping
- Cross-account team insights

**CRM Functions**
- New client outreach tracking
- Pipeline management for prospects
- Lead-to-account conversion

### Long-Term (2026+)

**Platform Maturity**
- Executive analytics dashboard / leadership intelligence hub
- Full mobile compatibility
- Performance recognition system (achievements, badges, tiers)
- Advanced reporting and custom dashboards

*Roadmap priorities may shift based on user feedback and design partner needs.*

---

## 🤝 Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

MovaLab was originally developed in partnership with PRISM, a faculty-led, student-run marketing agency at Virginia Tech managing 11 client accounts with 60+ team members. It's designed to be adaptable for any professional services organization.

For feature requests, bug reports, or questions about adapting MovaLab for your organization, please open an issue on GitHub or join our [Discord community](https://discord.gg/99SpYzNbcu).

---

## 🆘 Support & Documentation

- **Developer Guide:** See `CLAUDE.md` for comprehensive development documentation
- **Feature Documentation:** `/docs/architecture/FEATURELIST.md`
- **Security Guide:** `/docs/security/SECURITY.md`
- **Contributing Guide:** `CONTRIBUTING.md`
- **Discord Community:** [Join our Discord](https://discord.gg/99SpYzNbcu)

---

## 📄 License

MovaLab is licensed under the **Sustainable Use License**.

**You can:**
- Use MovaLab for your agency's internal operations
- Self-host for your own business
- Modify the code for your internal use
- Offer consulting services helping others implement MovaLab

**You cannot:**
- Host MovaLab as a paid service for others
- Resell or white-label MovaLab
- Embed MovaLab in a commercial product

This is a "fair-code" license similar to n8n and other source-available projects. It protects against commercial exploitation while allowing agencies to use and benefit from the platform.

See [LICENSE](LICENSE) for complete terms.

---

**Built for agencies who believe operational excellence — not just creative excellence — drives profitability.**

*MovaLab: Because your team deserves better than spreadsheet chaos and Slack pandemonium.*

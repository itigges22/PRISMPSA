# MovaLab Demo Mode

Demo mode allows you to showcase MovaLab without risking data corruption or requiring user signup. It's perfect for public demonstrations, testing, and evaluation.

---

## Table of Contents

1. [Overview](#overview)
2. [Critical: Database Architecture](#critical-database-architecture)
3. [Quick Start](#quick-start)
4. [Demo Users](#demo-users)
5. [Features in Demo Mode](#features-in-demo-mode)
6. [Local Demo Setup](#local-demo-setup)
7. [Switching from Demo to Production](#switching-from-demo-to-production)
8. [Cloud Demo Setup (Vercel)](#cloud-demo-setup-vercel)
9. [Resetting and Clearing Demo Data](#resetting-and-clearing-demo-data)
10. [Security Considerations](#security-considerations)
11. [Technical Implementation](#technical-implementation)
12. [Troubleshooting](#troubleshooting)
13. [FAQ](#faq)

---

## Overview

Demo mode is a special configuration that:

- **Enables quick-login buttons** - Users can log in as different roles with one click (no signup required)
- **Disables destructive actions** - Delete, remove, and dangerous operations are blocked
- **Hides superadmin access** - Prevents exposure of sensitive admin features
- **Protects demo data** - Ensures the demo environment stays clean for the next user

### When to Use Demo Mode

| Scenario | Use Demo Mode? |
|----------|----------------|
| Public product demo | Yes |
| Internal testing | Yes |
| Evaluating MovaLab | Yes |
| Development with test data | Optional |
| Production deployment | **No** |
| Staging with real data | **No** |

---

## Critical: Database Architecture

### Understanding Demo vs Production Databases

**This is the most important concept to understand:**

| Mode | Database | Location | Isolated? |
|------|----------|----------|-----------|
| **Local Demo** (Docker) | PostgreSQL in Docker | Your machine | Yes - from cloud |
| **Local "Production"** (Docker) | **Same** PostgreSQL in Docker | Your machine | **NO - same as demo!** |
| **Cloud Production** | Supabase Cloud | Supabase servers | Yes - completely separate |

### The Critical Point

**Local Docker Demo and Local Docker "Production" use the SAME database.**

The Supabase CLI creates a single set of containers with a fixed project name. There is only ONE local database. Demo mode is purely a **UI/API protection layer** - it does NOT create a separate database.

```
Local Docker Database (ONE database)
├── With NEXT_PUBLIC_DEMO_MODE=true  → Demo UI, blocked actions
└── With NEXT_PUBLIC_DEMO_MODE=false → Full UI, all actions allowed
    ↑
    Same data in both cases!
```

### What This Means

1. **Demo mode protects data from deletion** - but it's the same data either way
2. **Disabling demo mode exposes the same data** - just without protections
3. **For true data isolation, use Cloud Supabase** for production

### Recommended Architecture

| Environment | Database | Demo Mode | Purpose |
|-------------|----------|-----------|---------|
| **Production** | Cloud Supabase (`movalab-prod`) | `false` | Real users, real data |
| **Demo/Testing** | Local Docker | `true` | Safe testing, demos |
| **Staging** (optional) | Cloud Supabase (`movalab-staging`) | `false` | Pre-production testing |

**Do NOT use local Docker for production data.** See [Security Considerations](#security-considerations) for why.

---

## Quick Start

### Option 1: Using `npm run dev:demo` (Recommended)

```bash
# One command starts everything
npm run dev:demo
```

This will:
1. Check Docker is installed and running
2. Start Supabase containers (PostgreSQL, Auth, API, etc.)
3. Wait for services to be ready
4. Start Next.js with demo mode enabled
5. Open http://localhost:3000

### Option 2: Manual Setup with `.env.local`

If Supabase containers are already running, you can just set the environment variable:

1. Add to `.env.local`:
   ```
   NEXT_PUBLIC_DEMO_MODE=true
   ```

2. Start the dev server:
   ```bash
   npm run dev
   ```

Both approaches result in the same demo experience.

### Stop Demo Environment

```bash
npm run docker:stop
```

---

## Demo Users

Demo mode provides 6 pre-configured users representing different roles:

| User | Email | Role | Access Level |
|------|-------|------|--------------|
| Alex Executive | `exec@test.local` | Executive Director | Full visibility across all accounts |
| Morgan Manager | `manager@test.local` | Account Manager | Manages client accounts and teams |
| Pat ProjectManager | `pm@test.local` | Project Manager | Oversees project execution |
| Dana Designer | `designer@test.local` | Senior Designer | Creative work and deliverables |
| Dev Developer | `dev@test.local` | Senior Developer | Technical implementation |
| Chris Client | `client@test.local` | Client | Client portal access only |

**Password for all users:** `Test1234!`

### Why No Superadmin?

The superadmin user (`superadmin@test.local`) is intentionally excluded from demo mode to:
- Prevent accidental system configuration changes
- Protect sensitive admin functionality
- Keep the demo focused on typical user workflows

**Note:** The superadmin still exists in the database. Disabling demo mode will expose superadmin login.

---

## Features in Demo Mode

### Login Experience

Instead of the standard login form with email/password, demo mode shows:
- Quick-login buttons for each demo user
- Role descriptions to help users choose
- One-click access (no password typing needed)
- Password hint displayed for manual login if needed

### Blocked Actions

The following destructive actions are blocked in demo mode:

| Action | Normal Mode | Demo Mode |
|--------|-------------|-----------|
| Delete accounts | Allowed | Blocked |
| Remove users from accounts | Allowed | Blocked |
| Delete departments | Allowed | Blocked |
| Delete roles | Allowed | Blocked |
| Remove users from roles | Allowed | Blocked |
| Delete projects | Allowed | Blocked |
| Delete tasks | Allowed | Blocked |
| Delete time entries | Allowed | Blocked |
| Delete workflows | Allowed | Blocked |
| Delete newsletters | Allowed | Blocked |
| Superadmin setup | Accessible | Hidden |

When a user attempts a blocked action, they see a friendly message explaining that the action is disabled in demo mode.

### Hidden Features

- Superadmin setup page (`/admin/superadmin-setup`)
- User signup toggle on login page

---

## Local Demo Setup

### Prerequisites

1. **Docker Desktop** - [Download here](https://www.docker.com/products/docker-desktop)
2. **Node.js 18+** - [Download here](https://nodejs.org/)
3. **Git** - For cloning the repository

### First-Time Setup

```bash
# Clone the repository
git clone https://github.com/your-org/MovaLab.git
cd MovaLab

# Install dependencies
npm install

# Run the full first-time setup (includes database seeding)
./scripts/first-time-setup.sh

# Or on Windows (Git Bash)
bash scripts/first-time-setup.sh
```

### Daily Usage

```bash
# Start demo mode
npm run dev:demo

# When done, stop Docker to free RAM
npm run docker:stop
```

### Resource Usage

Local demo mode runs several Docker containers:
- PostgreSQL database
- Supabase Auth (GoTrue)
- Supabase API (PostgREST)
- Supabase Studio (optional, for database UI)
- And more...

**Typical RAM usage:** 2-4 GB

To minimize resource usage:
- Stop Docker when not in use: `npm run docker:stop`
- Use cloud demo mode for presentations (see below)

---

## Switching from Demo to Production

### Step-by-Step: Local Demo to Cloud Production

This is the correct way to transition from demo/testing to production:

#### 1. Create a Cloud Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Name it something like `movalab-prod`
3. Wait for the project to be provisioned
4. Note your project URL and publishable key from Project Settings > API

#### 2. Apply Database Migrations

```bash
# Link to your production project
npx supabase link --project-ref YOUR_PROJECT_REF

# Push all migrations to cloud
npx supabase db push
```

#### 3. Create Production Users

You'll need to create real users in your cloud project:
- Use the Supabase dashboard Authentication tab, OR
- Invite users via email through the app

**Important:** Do NOT use the demo seed users (`exec@test.local`, etc.) in production.

#### 4. Update Environment Variables

Edit `.env.local`:

```bash
# Comment out local Docker settings
# NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=eyJhbGciOiJIUzI1NiIs...

# Use cloud settings
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-cloud-publishable-key

# IMPORTANT: Disable demo mode for production!
# NEXT_PUBLIC_DEMO_MODE=true  # <-- Comment this out or set to false
```

#### 5. Stop Docker (No Longer Needed)

```bash
npm run docker:stop
```

#### 6. Start in Production Mode

```bash
npm run dev
```

You're now connected to your cloud production database with full functionality.

### For Vercel Deployment

Set these environment variables in Vercel dashboard:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-cloud-publishable-key
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

Do NOT set `NEXT_PUBLIC_DEMO_MODE=true` unless you're deploying a public demo instance.

---

## Cloud Demo Setup (Vercel)

For production demos (shareable URL, no Docker required):

### Step 1: Create a Demo Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Name it something like `movalab-demo` (separate from production!)
3. Note your project URL and publishable key

### Step 2: Apply Migrations

```bash
# Link to your demo project
npx supabase link --project-ref YOUR_DEMO_PROJECT_REF

# Push migrations
npx supabase db push
```

### Step 3: Create Demo Users

Create the 6 demo users in your cloud Supabase project:
1. Use the Supabase dashboard Authentication tab
2. Create users with the emails from the [Demo Users](#demo-users) table
3. Set password `Test1234!` for all

### Step 4: Deploy to Vercel

1. Connect your GitHub repository to Vercel
2. Set these environment variables in Vercel dashboard:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-demo-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-publishable-key
NEXT_PUBLIC_DEMO_MODE=true
NEXT_PUBLIC_APP_URL=https://demo.your-domain.com
```

3. Deploy!

### Recommended Multi-Environment Setup

| Environment | Supabase Project | Demo Mode | URL |
|-------------|------------------|-----------|-----|
| Production | `movalab-prod` | `false` | app.your-domain.com |
| Demo | `movalab-demo` | `true` | demo.your-domain.com |
| Local Dev | Docker | Either | localhost:3000 |

---

## Resetting and Clearing Demo Data

### Full Database Reset

To completely reset the database to a fresh state with seed data:

```bash
npm run docker:seed
```

This will:
1. Drop all existing data
2. Re-run all migrations
3. Create fresh demo users
4. Seed sample data (accounts, projects, tasks, etc.)

**Warning:** This destroys ALL data in the local database.

### Partial Data Cleanup

If you want to clean specific data without a full reset:

1. Open Supabase Studio: `npm run docker:studio` (opens http://localhost:54323)
2. Navigate to the Table Editor
3. Manually delete rows from specific tables

### Reset Docker Completely

If Docker containers are corrupted:

```bash
# Stop and remove all Supabase containers
npm run docker:clean

# This runs: supabase stop --no-backup && docker system prune -f

# Start fresh
npm run dev:demo
```

### Cloud Demo Reset

For cloud demo environments, you can:
1. Use Supabase dashboard to truncate tables
2. Re-run seed scripts
3. Or create a new project and re-deploy

---

## Security Considerations

### Why NOT to Use Local Docker for Production

**Do not run production data in local Docker.** Here's why:

| Risk | Description |
|------|-------------|
| **No automatic backups** | Docker volumes can be lost if you prune, reset, or have disk issues |
| **Single point of failure** | Your laptop/desktop is the only copy of your data |
| **No disaster recovery** | Hard drive dies = data gone forever |
| **No high availability** | Computer sleeps/restarts = app unavailable |
| **No team access** | Only accessible from your machine |
| **Resource intensive** | Consumes 2-4 GB RAM constantly |

**Always use Cloud Supabase for production data.**

### Security Risks of Disabling Demo Mode Locally

If you disable demo mode while using local Docker:

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
# NEXT_PUBLIC_DEMO_MODE=true  # <-- Disabled
```

**Risks:**
1. **All destructive actions are enabled** - Anyone can delete data
2. **Superadmin setup is exposed** - `/admin/superadmin-setup` is accessible
3. **Standard login form shown** - Exposes superadmin login option
4. **Same demo database** - You're still using the same data, just without protections

**If you must run without demo mode locally:**
- Understand this is the SAME database as demo mode
- Your test data can be permanently deleted
- Use `npm run docker:seed` to restore if needed
- Never put real/important data in the local Docker database

### Demo Mode is NOT a Security Boundary

Demo mode provides:
- UI convenience (quick-login buttons)
- Accidental deletion prevention
- Clean demo experience

Demo mode does NOT provide:
- Database isolation
- User authentication bypass prevention
- API security (beyond blocking specific endpoints)

For true security, use:
- Separate Cloud Supabase projects for demo vs production
- Proper authentication and authorization
- Row Level Security (RLS) policies

---

## Technical Implementation

### Key Files

| File | Purpose |
|------|---------|
| `lib/demo-mode.ts` | Core demo mode logic and configuration |
| `lib/api-demo-guard.ts` | API route protection |
| `components/demo-login-form.tsx` | Quick-login UI component |
| `scripts/start-demo.js` | Smart startup script |

### Environment Variables

| Variable | Purpose | Values |
|----------|---------|--------|
| `NEXT_PUBLIC_DEMO_MODE` | Enable demo mode UI | `true` / `false` |
| `DEMO_MODE` | Server-side demo check (fallback) | `true` / `false` |

Note: `NEXT_PUBLIC_` prefix makes the variable available in browser code.

### Two Ways to Enable Demo Mode

**Option 1: Via `npm run dev:demo`**
- Sets `NEXT_PUBLIC_DEMO_MODE=true` at runtime
- Also starts Supabase containers automatically
- Includes safety checks (won't run against cloud DB)

**Option 2: Via `.env.local`**
- Add `NEXT_PUBLIC_DEMO_MODE=true` to your `.env.local`
- Run `npm run dev` normally
- Supabase must already be running

Both methods produce identical behavior.

### How Demo Mode Works

1. **Client-side detection:**
   ```typescript
   import { isDemoMode } from '@/lib/demo-mode';

   if (isDemoMode()) {
     // Show demo UI
   }
   ```

2. **Blocking actions (client):**
   ```typescript
   import { isActionBlocked, getBlockedActionMessage } from '@/lib/demo-mode';

   if (isActionBlocked('delete_project')) {
     toast.error(getBlockedActionMessage('delete_project'));
     return;
   }
   ```

3. **Blocking actions (API):**
   ```typescript
   import { checkDemoModeForDestructiveAction } from '@/lib/api-demo-guard';

   export async function DELETE(request: NextRequest) {
     const blocked = checkDemoModeForDestructiveAction('delete_project');
     if (blocked) return blocked;

     // Continue with delete...
   }
   ```

### Adding New Blocked Actions

1. Add the action type to `lib/demo-mode.ts`:
   ```typescript
   export type BlockedAction =
     | 'delete_account'
     | 'your_new_action'  // Add here
     // ...
   ```

2. Add the message:
   ```typescript
   const BLOCKED_MESSAGES: Record<BlockedAction, string> = {
     your_new_action: 'This action is disabled in demo mode.',
     // ...
   };
   ```

3. Use in your component or API route.

---

## Troubleshooting

### Docker Won't Start

**Error:** `Docker is not running!`

**Solution:**
1. Open Docker Desktop
2. Wait for it to fully start (check the whale icon in system tray)
3. Try again: `npm run dev:demo`

### Port Already in Use

**Error:** `Port 54321 is already in use`

**Solution:**
```bash
# Stop any existing Supabase
npm run docker:stop

# If that doesn't work, force stop all containers
docker stop $(docker ps -q)

# Try again
npm run dev:demo
```

### Stale Container Conflict

**Error:** `container name is already in use`

**Solution:**
```bash
# Remove stale containers (Windows)
docker ps -aq --filter "name=supabase" | ForEach-Object { docker rm -f $_ }

# Or on Mac/Linux
docker rm -f $(docker ps -aq --filter "name=supabase")

# Try again
npm run dev:demo
```

### API Not Responding

**Error:** `Supabase API did not become ready`

**Solution:**
```bash
# Full restart
npm run docker:stop
docker system prune -f
npm run dev:demo
```

### Demo Mode Not Working

**Symptoms:** Delete buttons still visible, normal login shown

**Check:**
1. Verify `NEXT_PUBLIC_DEMO_MODE=true` is set in `.env.local` OR you're using `npm run dev:demo`
2. Restart the dev server (the env var is read at startup)
3. Clear browser cache / hard refresh (Ctrl+Shift+R)
4. Check browser console for errors

### Login Page Stuck on "Checking authentication..."

**Symptoms:** Login page shows loading state forever

**Solutions:**
1. Verify Supabase is running: `npx supabase status`
2. Check the Supabase API: `curl http://127.0.0.1:54321/rest/v1/`
3. Clear `.next` cache: `rm -rf .next && npm run dev`
4. Check for JavaScript errors in browser console

### High Memory Usage

**Symptoms:** Computer slow, Docker using lots of RAM

**Solutions:**
1. Stop Docker when not in use: `npm run docker:stop`
2. Use cloud demo mode instead
3. Allocate less memory to Docker in Docker Desktop settings
4. Close Supabase Studio if open

---

## FAQ

### Can demo users create data?

Yes! Demo users can create projects, tasks, log time, etc. They just can't delete data. This allows users to fully experience the platform.

### Is demo data persistent?

- **Local Docker:** Yes, data persists in Docker volumes until you run `npm run docker:seed`
- **Cloud Demo:** Yes, until manually cleaned or the project is reset

### Can I customize demo users?

Yes, edit `lib/demo-mode.ts` to change:
- User list and roles
- Colors and descriptions
- Which actions are blocked

### How do I add more demo data?

Edit `supabase/seed.sql` or `scripts/create-seed-users.ts` to add more sample accounts, projects, tasks, etc.

### Can I use local Docker for production?

**Not recommended.** See [Security Considerations](#security-considerations). Use Cloud Supabase for any data you care about.

### What happens if I disable demo mode locally?

You'll have full access to delete data, access superadmin features, etc. But it's the SAME database - there's no separate "local production" database. See [Critical: Database Architecture](#critical-database-architecture).

### How do I switch from demo to real production?

Follow the [Switching from Demo to Production](#switching-from-demo-to-production) guide. The key is using Cloud Supabase, not local Docker.

### Is the demo database backed up?

**No.** Local Docker volumes are not backed up. If you need backups, use Cloud Supabase which has automatic backups.

---

## Need Help?

- **Discord:** [Join the MovaLab community](https://discord.gg/99SpYzNbcu)
- **GitHub Issues:** [Report bugs or request features](https://github.com/your-org/MovaLab/issues)
- **Documentation:** Check `CLAUDE.md` for comprehensive technical docs

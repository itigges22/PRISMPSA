# Contributing to MovaLab

Thank you for your interest in contributing to MovaLab! This document provides guidelines for contributing to the project.

## Ways to Contribute

- **Bug Reports**: Found something broken? Open an issue with details
- **Feature Requests**: Have an idea? We'd love to hear it
- **Code Contributions**: Fix bugs or implement new features
- **Documentation**: Improve docs, fix typos, add examples
- **Testing**: Help test new features and report issues

## Development Setup

> **✨ Zero-configuration setup!** Everything runs locally with Docker - no cloud accounts required.

### Prerequisites

- **Node.js 18.0+** ([Download](https://nodejs.org/))
- **Docker Desktop** ([Download](https://www.docker.com/products/docker-desktop))
- **Git**
- **Windows users:** Git Bash (included with [Git for Windows](https://gitforwindows.org/)) or [WSL2](https://docs.microsoft.com/en-us/windows/wsl/install)

That's it! No Supabase account, no cloud setup, no credentials management.

> **💡 Windows Note:** The setup script requires bash. Use Git Bash (recommended) or WSL2. Open Git Bash and run `./scripts/first-time-setup.sh`

### One-Command Setup

1. **Fork the repository** on GitHub

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/movalab.git
   cd movalab
   ```

3. **Run the setup script**

   **macOS / Linux:**
   ```bash
   ./scripts/first-time-setup.sh
   ```

   **Windows - Choose Your Terminal:**

   <details>
   <summary><strong>📘 Git Bash</strong> (Recommended)</summary>

   ```bash
   # In Git Bash terminal:
   ./scripts/first-time-setup.sh
   ```
   </details>

   <details>
   <summary><strong>💻 Command Prompt (CMD)</strong></summary>

   ```cmd
   REM In Command Prompt:
   scripts\first-time-setup.bat
   ```
   </details>

   <details>
   <summary><strong>⚡ PowerShell</strong></summary>

   ```powershell
   # In PowerShell:
   scripts\first-time-setup.bat
   ```
   </details>

   > **💡 Windows Tip:** All three terminals work! The `.bat` file automatically finds Git Bash and runs the setup.

   This script will automatically:
   - ✅ Verify Node.js and Docker are installed
   - ✅ Install Supabase CLI (if needed)
   - ✅ Install npm dependencies
   - ✅ Start local Supabase with Docker
   - ✅ Apply all database migrations (35+ tables)
   - ✅ Load seed data (8 users, 3 accounts, 6 projects, 20 tasks)
   - ✅ Create test user accounts
   - ✅ Run health checks

4. **Start developing**
   ```bash
   npm run dev
   ```

5. **Open** [http://localhost:3000](http://localhost:3000)

### Login with Test Accounts

All test users have the password: **`Test1234!`**

| Email | Role | Purpose |
|-------|------|---------|
| `superadmin@test.local` | Superadmin | Full system access |
| `exec@test.local` | Executive Director | Leadership view |
| `manager@test.local` | Account Manager | Multi-account management |
| `pm@test.local` | Project Manager | Project coordination |
| `designer@test.local` | Senior Designer | Creative tasks |
| `dev@test.local` | Senior Developer | Technical tasks |
| `contributor@test.local` | Contributor | Part-time (20 hrs/week) |
| `client@test.local` | Client | Client portal view |

## Docker-Based Development

MovaLab uses **local Supabase** (PostgreSQL + Auth + Storage) via Docker. Everything runs on your machine - no cloud dependencies.

### Docker Commands

```bash
# Start/stop Supabase services
npm run docker:start         # Start all services
npm run docker:stop          # Stop services (preserves data)

# Database management
npm run docker:reset         # Reset DB, re-run migrations
npm run docker:seed          # Reset DB + create seed users
npm run docker:health        # Verify setup

# Database UI
npm run docker:studio        # Open Supabase Studio at localhost:54323
```

### Service URLs

When Docker is running, you'll have access to:

- **App:** http://localhost:3000
- **Supabase Studio:** http://localhost:54323 (database admin UI)
- **API:** http://localhost:54321
- **PostgreSQL:** localhost:54322

### Database Schema

The database schema is defined in `/supabase/migrations/`:

- **`20250123_02_functions_fixed.sql`** - Database functions with RLS fixes
- **`20250123_03_views.sql`** - Analytics views
- **`20250123_04_rls_policies_fixed.sql`** - Row Level Security policies
- **`20250123_05_triggers.sql`** - Auto-triggers (user creation, timestamps)

Migrations run automatically when you start Supabase.

### Seed Data

Test data is loaded from `/supabase/seed.sql`:

- **5 Departments** (Leadership, Marketing, Design, Development, Operations)
- **15 Roles** with permissions (Superadmin, Executive, PM, Designer, etc.)
- **8 Test Users** with realistic profiles and availability
- **3 Client Accounts** (Acme Corp, StartupXYZ, Local Business)
- **6 Projects** with varying statuses
- **20 Tasks** with dependencies and assignments
- **2 Workflow Templates** (Blog Post Approval, Video Production)
- **2 Form Templates** (Client Intake, Project Feedback)
- **Sample time entries** and newsletters

### Troubleshooting

**Docker not running?**
```bash
# Check Docker status
docker info

# If not running, start Docker Desktop
# Then: npm run docker:start
```

**Database connection failed?**
```bash
# Reset everything
npm run docker:stop
npm run docker:start
npm run docker:health
```

**Migrations not applied?**
```bash
npm run docker:reset
npx tsx scripts/create-seed-users.ts
```

**Still having issues?**
- Run the health check: `npm run docker:health`
- Check logs: `supabase status`
- Ask for help in our [Discord](https://discord.gg/99SpYzNbcu)

## Database Migrations (Advanced)

If you need to add new tables or modify the schema:

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

### Database Structure Overview

The schema includes these main areas:

| Area | Tables | Description |
|------|--------|-------------|
| **Users & Auth** | `user_profiles`, `user_roles`, `roles` | User management and RBAC |
| **Accounts** | `accounts`, `account_members` | Client account management |
| **Projects** | `projects`, `project_assignments`, `tasks` | Project and task tracking |
| **Time Tracking** | `time_entries`, `clock_sessions`, `user_availability` | Capacity and time management |
| **Workflows** | `workflow_templates`, `workflow_nodes`, `workflow_instances` | Visual workflow automation |
| **Forms** | `form_templates`, `form_responses` | Dynamic form builder |

### Important Notes

- **RLS is mandatory** - All tables have Row Level Security policies
- **Don't disable RLS** - This protects data isolation between users
- **Test with real auth** - Many features require authenticated users
- **136 permissions** - The RBAC system has granular permission controls

## Code Style

- **TypeScript**: All code should be written in TypeScript with proper types
- **Formatting**: Follow existing code patterns in the codebase
- **Components**: Use functional components with hooks
- **Naming**: Use descriptive names for variables, functions, and components

## Pull Request Process

1. **Create a branch** for your changes
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** with clear, focused commits

3. **Test your changes** locally

4. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Open a Pull Request** against the `main` branch

6. **Describe your changes** clearly in the PR description

### PR Requirements

- Provide a clear description of what changed and why
- Ensure the build passes (`npm run build`)
- Test your changes thoroughly
- Keep PRs focused on a single change when possible

## Reporting Issues

When reporting bugs, please include:

- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Browser/OS information if relevant
- Screenshots if applicable

## Feature Requests

When requesting features:

- Describe the problem you're trying to solve
- Explain your proposed solution
- Consider alternatives you've thought about
- Provide context on how it would be used

## Questions?

- Open a GitHub Discussion for general questions
- Check existing issues before creating new ones
- Be patient - maintainers are volunteers

## License

By contributing, you agree that your contributions will be licensed under the Sustainable Use License. This means:

- You can use and modify the software for internal business purposes or personal use
- You cannot host MovaLab as a commercial service or resell it
- Your contributions help improve a product used by agencies worldwide
- MovaLab remains source-available while protecting against commercial exploitation

This is not an OSI-approved open source license. MovaLab uses a "fair-code" model similar to n8n, Sentry, and other commercial source-available projects. If you have questions about what the license permits, please open an issue before contributing.

See the [LICENSE](LICENSE) file for complete details.

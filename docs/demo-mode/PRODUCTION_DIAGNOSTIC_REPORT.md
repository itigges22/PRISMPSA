# Production Diagnostic Report - demo.movalab.dev

**Date:** December 28, 2025
**Status:** Issues Identified - Action Required

---

## Executive Summary

The production demo site at demo.movalab.dev has **platform-wide data issues** affecting all users. These issues are NOT permission-related but stem from the **daily cron job failing to populate seed data**.

---

## Diagnostic Findings

### 1. Cron Job Status: FAILING

**Endpoint:** `https://demo.movalab.dev/api/cron/reset-demo-data`
**Response:** `401 Unauthorized` - `{"error":"Unauthorized"}`

**Root Cause:** The `CRON_SECRET` environment variable is either:
- Not set in the Vercel project
- Set incorrectly (doesn't match what's in the cron request)

**Required Environment Variables for Cron:**
| Variable | Status | Description |
|----------|--------|-------------|
| `DEMO_MODE` or `NEXT_PUBLIC_DEMO_MODE` | ✅ Set | Demo login form is showing |
| `CRON_SECRET` | ❌ Missing/Wrong | Causes 401 Unauthorized |
| `DEMO_SUPABASE_SERVICE_ROLE_KEY` | ❓ Unknown | Can't test until CRON_SECRET works |

### 2. Demo Mode: WORKING

The demo login form is correctly displaying with all 7 demo users:
- Alex Executive (Executive Director)
- Morgan Manager (Account Manager)
- Pat ProjectManager (Project Manager)
- Andy Admin (Admin)
- Dana Designer (Senior Designer)
- Dev Developer (Senior Developer)
- Chris Client (Client)

### 3. Build Status: SUCCESS

Latest deployment `dpl_6VtoqjsnkveNgFFinrJfTF4LMY5g` built successfully:
- Next.js 15.5.9
- 69 pages generated
- No build errors

### 4. Route Protection: WORKING CORRECTLY

The `/departments` route returning 307 redirect is **expected behavior** - the middleware correctly redirects unauthenticated users to `/login?redirectTo=%2Fdepartments`.

---

## Data Status on Production

Based on Playwright tests against demo.movalab.dev:

| Data Type | Expected | Found | Status |
|-----------|----------|-------|--------|
| Projects | 8 | 7 | PARTIAL |
| Accounts | 5 | 5+ | OK |
| Departments | 5 | 1+ | PARTIAL |
| Roles | 15 | 7 cards | PARTIAL |
| Workflow Templates | 2 | 0 specific | MISSING |
| Newsletters | 2 | 0 | MISSING |
| Project Updates | 6 | 0 | MISSING |
| Time Entries | 27 | 0 | MISSING |
| Milestones | 4 | 0 | MISSING |
| Project Issues | 5 | 0 | MISSING |
| Capacity Data | N/A | Charts render | OK |

**Conclusion:** Base schema data (roles, departments, accounts) exists from initial setup, but cron-generated seed data (newsletters, updates, time entries) is missing.

---

## Required Fixes

### Fix 1: Set CRON_SECRET in Vercel

1. Go to Vercel Dashboard → movalab-demo project
2. Settings → Environment Variables
3. Add: `CRON_SECRET` = (generate a secure random string, e.g., 32+ characters)
4. Redeploy the project

### Fix 2: Set DEMO_SUPABASE_SERVICE_ROLE_KEY

1. Go to Supabase Dashboard → Your demo project
2. Settings → API → Find "service_role" key (NOT the anon key)
3. In Vercel: Add `DEMO_SUPABASE_SERVICE_ROLE_KEY` = (paste service role key)
4. Redeploy

### Fix 3: Manually Trigger Cron Job

After setting environment variables:

```bash
curl -X GET "https://demo.movalab.dev/api/cron/reset-demo-data" \
  -H "Authorization: Bearer YOUR_CRON_SECRET_HERE"
```

Expected response on success:
```json
{
  "success": true,
  "message": "Demo data reset successfully",
  "timestamp": "2025-12-28T..."
}
```

---

## Verification Steps

After applying fixes:

1. **Test cron endpoint:**
   ```bash
   curl -s "https://demo.movalab.dev/api/cron/reset-demo-data" \
     -H "Authorization: Bearer YOUR_SECRET"
   ```

2. **Run Playwright verification:**
   ```bash
   npx playwright test e2e/production-data-verification.spec.ts
   ```

3. **Manual spot checks:**
   - Login as Alex Executive
   - Check Welcome page for newsletters
   - Check Dashboard for capacity charts with data
   - Check /projects for 8 projects
   - Check /admin/workflows for 2 templates

---

## Environment Variable Checklist

Ensure these are set in Vercel for `movalab-demo`:

```
NEXT_PUBLIC_DEMO_MODE=true
DEMO_MODE=true
CRON_SECRET=<your-secure-random-string>
DEMO_SUPABASE_SERVICE_ROLE_KEY=<from-supabase-dashboard>
NEXT_PUBLIC_SUPABASE_URL=https://xxtelrazoeuirsnvdoml.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=<publishable-key>
```

---

## Technical Details

### Cron Job Schedule
- **File:** `vercel.json`
- **Schedule:** `0 0 * * *` (midnight UTC daily)
- **Endpoint:** `/api/cron/reset-demo-data`

### Cron Job Data Generation
The cron job generates:
- 8 projects with realistic dates
- 13 tasks assigned to team members
- 21 project assignments
- 19 account members
- 27 time entries (for Alex, Morgan, Pat, Dana, Dev)
- 6 project updates
- 4 milestones
- 10 user availability records
- 2 workflow templates
- 11 workflow nodes
- 9 workflow connections
- 6 workflow instances
- 2 newsletters
- 5 project issues
- 11 task week allocations
- 6 project stakeholders

### Database RPC Requirement
The cron job uses `supabase.rpc('exec_sql', { query })` for DELETE operations. Ensure this function exists in the database or the deletes will fail silently.

---

## Contact

If issues persist after applying fixes, check:
1. Vercel function logs for the cron endpoint
2. Supabase logs for any database errors
3. Run `e2e/production-data-verification.spec.ts` to verify data population

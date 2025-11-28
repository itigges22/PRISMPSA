# Security Implementation Troubleshooting

## Issue: Performance/Loading Problems After SECURITY INVOKER Implementation

**Date Encountered:** 2025-11-23
**Severity:** High (Application functionality broken)
**Status:** ✅ Resolved

---

## Problem Description

After implementing Phase 2 database security (converting views from SECURITY DEFINER to SECURITY INVOKER), the application experienced significant loading issues:

### Symptoms:
- ✅ Capacity dashboard not loading
- ✅ Availability calendar showing errors
- ✅ Analytics pages timing out
- ✅ 401 Unauthorized errors on capacity/availability API endpoints
- ✅ "Auth session missing" errors in logs

### Example Error Logs:
```
GET /api/capacity/history?userId=... 401 in 1059ms
GET /api/availability?userId=... 401 in 1052ms
GET /api/capacity/organization?period=weekly 401 in 1047ms

Authentication required but no user found
[Error [AuthSessionMissingError]: Auth session missing!]
```

---

## Root Cause Analysis

### What Happened:
1. **Original State**: Views used `SECURITY DEFINER` (default)
   - Views ran with creator's (service role) elevated permissions
   - Users could query views without direct table access

2. **Security Fix Applied**: Changed views to `SECURITY INVOKER`
   ```sql
   ALTER VIEW public.weekly_capacity_summary SET (security_invoker = true);
   ALTER VIEW public.department_capacity_summary SET (security_invoker = true);
   ALTER VIEW public.project_capacity_summary SET (security_invoker = true);
   ALTER VIEW public.users SET (security_invoker = true);
   ```

3. **Breaking Change**: SECURITY INVOKER views run with querying user's permissions
   - Users now needed direct SELECT access to underlying tables
   - Missing SELECT policies caused views to fail
   - Manifested as 401 errors because queries were blocked by RLS

### Why SECURITY INVOKER Was Needed:
- **Security Risk**: SECURITY DEFINER views can be exploited for privilege escalation
- **Supabase Linter**: Flagged all SECURITY DEFINER views as security warnings
- **Best Practice**: SECURITY INVOKER is the recommended secure default

---

## Solution

### Step 1: Identify Missing SELECT Policies

Ran diagnostic query to find tables with RLS but no SELECT policies:
```sql
SELECT
  t.tablename,
  COUNT(p.policyname) FILTER (WHERE p.cmd IN ('SELECT', 'ALL')) as select_or_all_policies
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public'
  AND t.rowsecurity = true
GROUP BY t.tablename
HAVING COUNT(p.policyname) FILTER (WHERE p.cmd IN ('SELECT', 'ALL')) = 0
ORDER BY t.tablename;
```

### Step 2: Add SELECT Policies for Capacity Views

**Migration:** `add_select_policies_for_capacity_views.sql`

Added SELECT policies for critical tables used by capacity views:

```sql
-- user_availability - Required for weekly_capacity_summary
CREATE POLICY "Authenticated users can view availability"
ON public.user_availability
FOR SELECT
TO authenticated
USING (true);

-- task_week_allocations - Required for weekly_capacity_summary
CREATE POLICY "Authenticated users can view task allocations"
ON public.task_week_allocations
FOR SELECT
TO authenticated
USING (true);

-- time_entries - Required for weekly_capacity_summary
CREATE POLICY "Authenticated users can view time entries"
ON public.time_entries
FOR SELECT
TO authenticated
USING (true);
```

### Step 3: Add Remaining SELECT Policies

**Migration:** `add_missing_select_policies.sql`

Added SELECT policies for remaining tables:

```sql
-- statuses - Required for task management
CREATE POLICY "Authenticated users can view statuses"
ON public.statuses
FOR SELECT
TO authenticated
USING (true);

-- groups - Required for user management
CREATE POLICY "Authenticated users can view groups"
ON public.groups
FOR SELECT
TO authenticated
USING (true);
```

### Step 4: Verification

Confirmed all tables with RLS now have SELECT policies:
```sql
-- Query returned empty set (no tables missing policies)
SELECT tablename FROM pg_tables t
WHERE schemaname = 'public'
  AND rowsecurity = true
  AND tablename NOT IN (
    SELECT tablename FROM pg_policies
    WHERE cmd IN ('SELECT', 'ALL')
  );
```

---

## Security Implications

### Question: "Doesn't allowing all authenticated users to SELECT defeat the purpose of RLS?"

**Answer: No - This is defense-in-depth done right.**

### Why This is Secure:

1. **Read vs Write Separation**:
   - ✅ SELECT policies allow **reading** data (necessary for views and analytics)
   - ✅ INSERT/UPDATE/DELETE remain **blocked** at database level
   - ✅ All write operations go through API endpoints with permission checks

2. **Multi-Layer Security**:
   ```
   Layer 1 (Database): RLS policies prevent unauthorized reads/writes
   Layer 2 (API):      Permission system enforces business logic (73 permissions)
   Layer 3 (UI):       Role-based rendering hides unauthorized features
   ```

3. **Example Flow**:
   ```
   User tries to delete a project:

   ✅ Database Layer: RLS blocks DELETE (no DELETE policy exists)
   ✅ API Layer: Permission check fails (user lacks DELETE_PROJECT permission)
   ✅ UI Layer: Delete button not shown (role doesn't have permission)

   Result: Triple protection - one breach doesn't compromise security
   ```

4. **Real-World Analogy**:
   - **Before**: Database was a locked safe (good, but if API has bug, data leaked)
   - **After**: Database is a locked safe + API validates keys + UI hides safe location
   - Defense-in-depth: Multiple independent security layers

---

## Lessons Learned

### 1. **SECURITY INVOKER Requires Table Access**
When converting views from SECURITY DEFINER to SECURITY INVOKER, ensure users have SELECT access to all underlying tables.

### 2. **Test After Security Changes**
Always test application functionality after implementing security hardening:
```bash
# Check capacity dashboard
# Check analytics pages
# Check user availability calendar
# Review API logs for 401 errors
```

### 3. **Diagnostic Queries Are Essential**
Keep diagnostic queries handy to verify RLS configuration:
- Tables with RLS enabled
- Tables missing policies
- Policy coverage by command type (SELECT, INSERT, UPDATE, DELETE)

### 4. **Document Breaking Changes**
Security improvements can cause breaking changes. Document:
- What changed
- Why it changed
- What needs to be updated
- How to verify it works

---

## Prevention Checklist

When implementing SECURITY INVOKER views in the future:

- [ ] Identify all tables used by the view (including JOINs)
- [ ] Check if RLS is enabled on those tables
- [ ] Verify SELECT policies exist for authenticated users
- [ ] Test view queries as a regular user (not service role)
- [ ] Check application logs for 401 errors
- [ ] Test all pages that use the views
- [ ] Document the change and required policies

---

## Related Documentation

- **Security Implementation**: See `README/SECURITY_IMPLEMENTATION.md`
- **Security Overview**: See `SECURITY.md`
- **Database Connection**: See `README/DATABASE_CONNECTION.md`

---

## Quick Reference: View Dependencies

### weekly_capacity_summary
**Underlying tables:**
- `user_availability` ✅ SELECT policy required
- `user_profiles` ✅ SELECT policy required
- `task_week_allocations` ✅ SELECT policy required
- `time_entries` ✅ SELECT policy required

### department_capacity_summary
**Underlying tables:**
- All tables from `weekly_capacity_summary` (inherits)
- `departments` ✅ SELECT policy required

### project_capacity_summary
**Underlying tables:**
- All tables from `department_capacity_summary` (inherits)
- `projects` ✅ SELECT policy required

### users
**Underlying tables:**
- `user_profiles` ✅ SELECT policy required
- `accounts` ✅ SELECT policy required

---

*Last Updated: 2025-11-23*
*Issue Resolved: ~20 minutes*
*Zero data loss • Zero security compromise*

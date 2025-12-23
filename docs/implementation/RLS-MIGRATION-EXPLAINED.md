# RLS Migration NOTICE Messages - Explained

**Date:** December 23, 2025
**Status:** ✅ NORMAL BEHAVIOR - NOT ERRORS

---

## What You're Seeing

When running `npx supabase start` or `npx supabase db reset`, you'll see ~50 NOTICE messages like:

```
NOTICE (00000): policy "user_roles_select_policy" for relation "user_roles" does not exist, skipping
NOTICE (00000): policy "allow_authenticated_select" for relation "user_profiles" does not exist, skipping
...
```

## ✅ This is COMPLETELY NORMAL

These are **informational messages, NOT errors**. They indicate the migration is working correctly.

---

## Why This Happens

### Migration File Structure

The RLS policies migration (`20250123030000_rls_policies_fixed.sql`) is designed to be **idempotent** (safe to run multiple times). It follows this pattern:

```sql
-- 1. Drop old/incorrect policies (defensive cleanup)
DROP POLICY IF EXISTS "old_policy_name" ON table_name;
DROP POLICY IF EXISTS "another_old_policy" ON table_name;

-- 2. Create new correct policies
CREATE POLICY "new_correct_policy" ON table_name ...
```

### On a Fresh Database

When you run the migration on a **fresh database** (like first-time setup):

1. **DROP POLICY IF EXISTS** tries to remove old policies
2. Those policies **never existed** (because it's a fresh database)
3. PostgreSQL correctly responds: `"policy does not exist, skipping"`
4. Migration continues and **creates the correct 52 policies**
5. ✅ **Setup succeeds**

### On an Existing Database

When you run the migration on a database with old policies:

1. **DROP POLICY IF EXISTS** removes the old policies
2. Those policies **did exist** (from previous development)
3. PostgreSQL silently drops them
4. Migration continues and **creates the correct 52 policies**
5. ✅ **Database upgraded**

---

## What Gets Dropped vs Created

### Dropped (50 old policies from development iterations)

**Most common old policies:**
- `allow_authenticated_select` - 12 occurrences
- `allow_authenticated_insert` - 10 occurrences
- `allow_authenticated_delete` - 10 occurrences
- `allow_authenticated_update` - 9 occurrences

**Specific deprecated policies:**
- `user_roles_select_policy`
- `Users can view their own roles`
- `Superadmins can view all user roles`
- `Superadmins can manage all user roles`
- `authenticated_users_can_read_user_roles`
- `authenticated_users_can_insert_user_roles`
- `authenticated_users_can_delete_user_roles`
- `workflow_instances_view_assigned`
- `workflow_history_view_assigned`

### Created (52 new correct policies)

**Pattern for most tables (4 policies each):**
1. SELECT policy (who can read)
2. INSERT policy (who can create)
3. UPDATE policy (who can modify)
4. DELETE policy (who can remove)

**Tables with RLS enabled (15 total):**
1. `user_roles` (4 policies)
2. `user_profiles` (4 policies)
3. `roles` (4 policies)
4. `departments` (4 policies)
5. `accounts` (4 policies)
6. `account_members` (4 policies)
7. `projects` (4 policies)
8. `project_assignments` (4 policies)
9. `tasks` (4 policies)
10. `workflow_instances` (4 policies)
11. `workflow_history` (4 policies)
12. `time_entries` (4 policies)
13. `workflow_templates` (4 policies)
14. `workflow_nodes` (4 policies)
15. `workflow_connections` (4 policies)

---

## How to Verify Setup Succeeded

### ✅ Success Indicators

Look for these messages at the end of startup:

```bash
✅ Supabase started successfully

API URL: http://localhost:54321
GraphQL URL: http://localhost:54321/graphql/v1
DB URL: postgresql://postgres:postgres@localhost:54322/postgres
Studio URL: http://localhost:54323
Inbucket URL: http://localhost:54324
```

### ❌ Actual Errors Look Different

Real errors have **ERROR** prefix and stop the migration:

```bash
ERROR: relation "table_name" does not exist
ERROR: invalid input syntax for type uuid: "invalid-uuid-format"
ERROR: permission denied for table table_name
```

If you see `NOTICE` messages but setup completes successfully, **everything is working correctly**.

---

## Why This Design is Good

### 1. Idempotent Migrations

The migration can run multiple times safely:
- First run: Skips drops, creates policies ✅
- Second run: Drops policies, recreates them ✅
- Rollback/retry: Always safe ✅

### 2. Handles Development to Production

Same migration works in both environments:
- **Development database** (has old policies): Drops old, creates new ✅
- **Production database** (fresh): Skips drops, creates new ✅

### 3. Defensive Programming

Using `IF EXISTS` prevents migration failures:
- Policy exists: Drop it ✅
- Policy doesn't exist: Skip it (NOTICE message) ✅
- Migration continues either way ✅

---

## PostgreSQL NOTICE vs ERROR

### NOTICE (Informational)

```sql
NOTICE (00000): policy "xyz" does not exist, skipping
```
- **Code 00000** = Successful completion
- Migration continues normally
- No action required

### ERROR (Failure)

```sql
ERROR: syntax error at or near "..."
ERROR: relation "table_name" does not exist
```
- Migration stops
- Requires fixing
- Database rolls back

---

## What to Do

### If You See NOTICE Messages

✅ **Do nothing** - this is expected behavior

### If You See ERROR Messages

1. Read the error message carefully
2. Check `supabase/seed.sql` for invalid UUID formats
3. Check migration files for SQL syntax errors
4. Run `npx supabase db reset` to retry
5. Check GitHub Issues or Discord for help

---

## Summary

**The NOTICE messages about "policy does not exist" are:**

✅ **EXPECTED** - Part of normal migration behavior
✅ **HARMLESS** - Don't prevent setup from succeeding
✅ **INFORMATIONAL** - PostgreSQL telling you it's handling `IF EXISTS`
✅ **GOOD DESIGN** - Allows safe idempotent migrations

**If your setup completes successfully, you can safely ignore these messages.**

---

## References

- PostgreSQL Documentation: [DROP POLICY](https://www.postgresql.org/docs/current/sql-droppolicy.html)
- Supabase Documentation: [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- Migration Best Practices: [Idempotent Migrations](https://supabase.com/docs/guides/local-development/declarative-database-schemas)

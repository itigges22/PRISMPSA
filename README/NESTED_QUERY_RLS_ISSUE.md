# Nested Query RLS Issue

## Problem

When using Supabase PostgREST with Row Level Security (RLS), deeply nested queries with multiple foreign keys to the same table cause errors:

```
Error: relation "user_profiles" does not exist (code: 42P01)
```

## Root Causes

### 1. Foreign Key Ambiguity
Tables with multiple foreign keys to the same table require explicit hints:
- `user_roles` has 2 FKs to `user_profiles` (`user_id`, `assigned_by`)
- `project_assignments` has 2 FKs to `user_profiles` (`user_id`, `assigned_by`)
- `projects` has 3 FKs to `user_profiles` (`assigned_user_id`, `created_by`, etc.)

### 2. RLS Policy Function Issues
RLS policies call functions like `can_view_project()` which internally call other functions. When these functions have `SET search_path = ''`, they MUST use fully qualified table names (`public.user_profiles`), but some may be missing the schema prefix.

### 3. Nested PostgREST Queries
When PostgREST builds complex nested SELECT queries through foreign keys, it generates SQL that triggers RLS checks at multiple levels. If any function in the chain has a schema qualification bug, the entire query fails.

## Solutions Applied

### 1. Split Complex Nested Queries
**Before (broken):**
```typescript
const { data } = await supabase
  .from('account_members')
  .select(`
    id,
    user_profiles(
      id,
      name,
      user_roles(
        roles(
          name
        )
      )
    )
  `)
```

**After (working):**
```typescript
// Query 1: Get member IDs
const { data: members } = await supabase
  .from('account_members')
  .select('id, user_id');

// Query 2: Get user profiles separately
const { data: profiles } = await supabase
  .from('user_profiles')
  .select('id, name')
  .in('id', userIds);

// Query 3: Get roles separately
const { data: roles } = await supabase
  .from('user_roles')
  .select('id, user_id, roles(name)')
  .in('user_id', userIds);

// Combine in application code
```

### 2. Add Foreign Key Hints
For tables with multiple FKs, always specify which relationship:
```typescript
// Explicit FK hint prevents ambiguity
user_roles!user_roles_user_id_fkey(...)
```

### 3. Fetch All and Filter Client-Side
For aggregation queries where RLS policies cause issues:
```typescript
// Fetch all (RLS still applies at row level)
const { data: all } = await supabase
  .from('project_assignments')
  .select('project_id, user_id');

// Filter in application
const filtered = all.filter(a => userIds.includes(a.user_id));
```

## Files Fixed

1. `/lib/department-service.ts` - Split project_assignments query
2. `/app/api/accounts/[accountId]/members/route.ts` - Split nested user query

## Resolution

**FIXED on 2025-11-23**

The root cause was identified and resolved: All SECURITY DEFINER functions and trigger functions with `SET search_path = ''` were missing schema qualifications on table references.

### Migrations Applied

1. **`fix_security_definer_schema_qualifications`** - Fixed 15+ SECURITY DEFINER functions:
   - `user_assigned_to_project()` - Added `public.` prefix to `project_assignments`
   - `user_is_superadmin()` - Added `public.` prefix to `user_profiles`, `user_roles`, `roles`
   - `user_has_permission()` - Added `public.` prefix to `user_roles`, `roles`
   - And 12 other permission/helper functions

2. **`fix_trigger_function_schema_qualifications`** - Fixed 3 trigger functions:
   - `update_role_hierarchy()` - Added `public.` prefix to `roles`
   - `log_role_hierarchy_change()` - Added `public.` prefix to `role_hierarchy_audit`
   - `prevent_last_role_removal()` - Added `public.` prefix to `user_roles`

### Verification

After applying the migrations:
- ✅ Department pages load without errors
- ✅ Dashboard capacity trends chart displays data
- ✅ All API endpoints (`/api/capacity/*`, `/api/projects`, etc.) return 200 status
- ✅ Zero RLS errors in server logs
- ✅ Project assignments queries work correctly
- ✅ Internal Affairs department shows correct metrics (1 project, 1 team member)
- ✅ System department shows correct capacity (21.25%)

The issue was completely resolved by ensuring all table references in SECURITY DEFINER functions use fully qualified names (`public.table_name`) when `search_path = ''`.

## Date
2025-11-23

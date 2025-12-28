# Demo Troubleshooting Guide

This document covers common issues encountered in the demo environment and their solutions.

## Common Issues

### 1. Empty Dashboard Widgets

**Symptoms**:
- Dashboard widgets show "No data" or zeros
- Capacity chart is empty
- Time entries show nothing

**Causes**:
- Demo data hasn't been seeded yet
- User doesn't have project assignments
- RLS policies blocking data access

**Solutions**:
1. Wait for the daily cron to run, or trigger manually
2. Check that the user has project assignments in `project_assignments` table
3. Verify the user has appropriate role permissions

### 2. Can't Clock In/Out

**Symptoms**:
- Clock button is not visible
- "Permission denied" when clicking clock

**Causes**:
- User's role is missing `manage_time` permission
- Demo data seed didn't update role permissions

**Solution**:
Ensure the role has `manage_time: true` in its permissions JSONB:
```sql
UPDATE roles SET permissions = permissions || '{"manage_time": true}'::jsonb
WHERE name IN ('Executive', 'Account Manager', 'Project Manager', 'Designer', 'Developer');
```

### 3. Can't Edit Availability

**Symptoms**:
- Availability section is read-only
- "Permission denied" error

**Causes**:
- Missing `edit_own_availability` permission

**Solution**:
```sql
UPDATE roles SET permissions = permissions || '{"edit_own_availability": true}'::jsonb
WHERE name IN ('Executive', 'Account Manager', 'Project Manager', 'Designer', 'Developer');
```

### 4. Newsletters Not Visible

**Symptoms**:
- Newsletter page is empty
- "No newsletters" message

**Causes**:
- Missing `view_newsletters` permission
- Newsletter seed data not inserted

**Solution**:
1. Check permission:
```sql
UPDATE roles SET permissions = permissions || '{"view_newsletters": true}'::jsonb
WHERE name IN ('Executive', 'Account Manager', 'Project Manager', 'Designer', 'Developer');
```
2. Check newsletter data exists:
```sql
SELECT * FROM newsletters WHERE id::text LIKE 'eeeeeeee%';
```

### 5. Admin Pages Show "Access Denied"

**Symptoms**:
- Non-superadmin users see Access Denied page on admin routes
- This is EXPECTED BEHAVIOR

**Explanation**:
Admin pages (`/admin/rbac-diagnostics`, `/admin/database`) are intentionally restricted to superadmin users only. This is not a bug.

**If you need access**:
Log in as `superadmin@movalab.dev`

### 6. Workflows Not Attached to Projects

**Symptoms**:
- Projects show "No workflow" status
- Workflow step indicator is missing

**Causes**:
- Workflow instances not created for projects
- Workflow templates/nodes not seeded

**Solution**:
Check workflow data exists:
```sql
SELECT * FROM workflow_templates WHERE id::text LIKE 'aaaaaaaa-bbbb%';
SELECT * FROM workflow_instances WHERE id::text LIKE 'cccccccc%';
```

### 7. Slow Navigation Loading

**Symptoms**:
- Navbar takes 1+ seconds to show menu items
- Menu items appear one by one

**Causes**:
- Sequential permission checks (pre-fix)
- Network latency

**Solution**:
This was fixed by parallelizing permission checks in `components/client-navigation.tsx`. After the fix, navigation should load in under 100ms.

### 8. Dashboard Customization Shows No Widgets

**Symptoms**:
- "Customize Dashboard" modal is empty
- No widgets to drag/toggle

**Causes**:
- User has no saved preferences
- Default widget fallback wasn't working

**Solution**:
This was fixed by adding `DEFAULT_WIDGETS` fallback in `components/dashboard/customize-modal.tsx`. The modal now shows all widgets even for first-time users.

### 9. Account Data Loading Slowly

**Symptoms**:
- Account list shows "0 accounts" initially
- Data appears after 5-10 seconds

**Causes**:
- Slow database query
- Complex RLS policy evaluation
- Network latency

**Investigation**:
1. Check Supabase logs for slow queries
2. Verify RLS policies aren't overly complex
3. Consider adding database indexes

### 10. Time Entries Missing for Leadership

**Symptoms**:
- Alex, Morgan, Pat show zero time logged
- Only Dana and Dev have time entries

**Causes**:
- Time entries weren't seeded for leadership roles

**Solution**:
This was fixed in the seed data. Leadership users now have time entries for executive oversight, account management, and project coordination activities.

## Manual Data Reset

If you need to reset demo data manually:

1. **Via API** (requires CRON_SECRET):
```bash
curl -X GET https://demo.movalab.dev/api/cron/reset-demo-data \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

2. **Via Supabase** (direct SQL):
```sql
-- Delete all seeded data
DELETE FROM time_entries WHERE id::text LIKE '66666666%';
DELETE FROM project_assignments WHERE id::text LIKE '44444444%';
-- ... continue for all tables with seed patterns
```

## Checking Demo Mode Status

To verify demo mode is enabled:

```javascript
// In browser console
console.log(process.env.NEXT_PUBLIC_DEMO_MODE);
```

Or check the environment:
- `NEXT_PUBLIC_DEMO_MODE=true`
- `DEMO_MODE=true`

## Database Connectivity

If database operations fail:

1. Check Supabase project status
2. Verify `NEXT_PUBLIC_SUPABASE_URL` is correct
3. Ensure `DEMO_SUPABASE_SERVICE_ROLE_KEY` is set for cron job
4. Check Supabase RLS policies aren't blocking

## Getting Help

If issues persist:
1. Check Vercel function logs for errors
2. Check Supabase logs for database errors
3. Review the `DEMO_DATA_REFERENCE.md` for expected data
4. Consult the `DEMO_USER_GUIDE.md` for expected permissions

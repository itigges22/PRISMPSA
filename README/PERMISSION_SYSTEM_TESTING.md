# Permission System Testing & Debugging Guide

## Overview

This document provides comprehensive testing and debugging procedures for the PRISM PSA RBAC (Role-Based Access Control) system.

## Dynamic Permission System

**IMPORTANT**: Roles in PRISM PSA have **dynamic permissions**. This means:
- Any role (including "Founder", "Superadmin", etc.) can have zero permissions if configured that way
- Permissions are determined by the `role_permissions` table, not by role name
- Only the `is_superadmin` flag bypasses permission checks entirely

## Testing Tools

### 1. Unit Tests

Location: `__tests__/lib/permission-checker.test.ts`

**Run Tests:**
```bash
npm test -- permission-checker.test.ts
```

**What It Tests:**
- Base permission checks
- Override permission logic
- Context-aware permissions
- Multiple role scenarios
- Edge cases (null users, empty roles, etc.)

### 2. Integration Tests

Location: `__tests__/integration/permissions-integration.test.ts`

**Run Tests:**
```bash
npm test -- permissions-integration.test.ts
```

**What It Tests:**
- Dashboard access control
- Account page permissions
- Department page permissions
- Admin page access
- Role management permissions
- Override permission scenarios

### 3. Permission Debugger Script

Location: `scripts/debug-permissions.ts`

**Usage:**
```bash
npx tsx scripts/debug-permissions.ts <user-email>
```

**Example:**
```bash
npx tsx scripts/debug-permissions.ts itigges22@gmail.com
```

**Output:**
- User's assigned roles
- All permissions with grant status
- Permission sources (which role grants what)
- Categorized permission breakdown
- Detailed role analysis

## Common Test Scenarios

### Scenario 1: User with No Permissions

**Setup:**
1. Create a role with ZERO permissions
2. Assign user to only this role
3. Test access to all pages

**Expected Behavior:**
- ✅ Welcome page accessible
- ✅ Profile page accessible (VIEW_OWN_PROFILE)
- ❌ Dashboard - Access Denied
- ❌ Accounts - Access Denied
- ❌ Departments - Access Denied
- ❌ Admin - Access Denied
- ❌ All other pages - Access Denied

**Debug Command:**
```bash
npx tsx scripts/debug-permissions.ts user@example.com
```

Should show: `0/XX permissions granted (0%)`

### Scenario 2: View-Only User

**Setup:**
1. Create role with only VIEW permissions:
   - VIEW_PROJECTS
   - VIEW_ACCOUNTS
   - VIEW_DEPARTMENTS
   - VIEW_OWN_PROFILE
2. Assign user to this role

**Expected Behavior:**
- ✅ Can view dashboards, accounts, departments
- ❌ Cannot create, edit, or delete anything
- ❌ No "Create" buttons visible
- ❌ No "Edit" buttons visible
- ❌ No "Delete" buttons visible
- ✅ "Read-Only Access" badge shown

### Scenario 3: Full Access User (Non-Superadmin)

**Setup:**
1. Create role with ALL permissions enabled
2. Assign user to this role

**Expected Behavior:**
- ✅ All pages accessible
- ✅ All CRUD operations available
- ✅ Can manage roles (if MANAGE_ROLES granted)
- ✅ Can view analytics (if VIEW_ALL_ANALYTICS granted)
- ❌ Cannot access superadmin-specific features unless `is_superadmin` is true

### Scenario 4: Superadmin

**Setup:**
1. Assign user to a role with `is_superadmin = true`
2. Permissions in `role_permissions` don't matter

**Expected Behavior:**
- ✅ **ALL** permissions automatically granted
- ✅ Access to all pages
- ✅ All operations available
- ✅ Special superadmin features visible

### Scenario 5: Multiple Roles

**Setup:**
1. Assign user to multiple roles:
   - Role A: VIEW_PROJECTS
   - Role B: EDIT_ACCOUNTS
   - Role C: No permissions

**Expected Behavior:**
- ✅ User gets **union** of all permissions
- ✅ Can view projects (from Role A)
- ✅ Can edit accounts (from Role B)
- ❌ Other permissions still denied

## Override Permissions

### Understanding Overrides

Override permissions grant broader access:

| Base Permission | Override Permission | Effect |
|----------------|-------------------|--------|
| VIEW_PROJECTS | VIEW_ALL_PROJECTS | View all projects, not just assigned |
| EDIT_PROJECT | EDIT_ALL_PROJECTS | Edit any project |
| DELETE_PROJECT | DELETE_ALL_PROJECTS | Delete any project |
| VIEW_ACCOUNTS | VIEW_ALL_ACCOUNTS | View all accounts |
| EDIT_ACCOUNT | VIEW_ALL_ACCOUNTS | Edit any account |
| DELETE_ACCOUNT | VIEW_ALL_ACCOUNTS | Delete any account |
| VIEW_DEPARTMENTS | VIEW_ALL_DEPARTMENTS | View all departments |
| EDIT_DEPARTMENT | VIEW_ALL_DEPARTMENTS | Edit any department |
| DELETE_DEPARTMENT | VIEW_ALL_DEPARTMENTS | Delete any department |
| VIEW_ANALYTICS | VIEW_ALL_ANALYTICS | View all analytics |

### Testing Overrides

**Test Case: VIEW_ALL_ACCOUNTS allows editing**
```bash
# User has VIEW_ALL_ACCOUNTS but NOT EDIT_ACCOUNT
# Expected: User can still edit accounts
```

**Verify with debugger:**
```bash
npx tsx scripts/debug-permissions.ts user@example.com
# Look for: "Override: VIEW_ALL_ACCOUNTS" next to EDIT_ACCOUNT
```

## Testing Checklist

### Before Deployment

- [ ] Run all unit tests: `npm test`
- [ ] Test no-permission user scenario
- [ ] Test view-only user scenario
- [ ] Test full-access user scenario
- [ ] Test superadmin user scenario
- [ ] Test multiple roles scenario
- [ ] Verify override permissions work
- [ ] Check all page access controls
- [ ] Verify UI elements (buttons) show/hide correctly
- [ ] Test database status page access
- [ ] Test role management page access

### Manual Testing Steps

1. **Create Test Roles:**
   ```sql
   -- In Supabase SQL Editor
   INSERT INTO roles (name, department_id, is_superadmin) 
   VALUES ('Test No Perms', NULL, false);
   
   INSERT INTO roles (name, department_id, is_superadmin) 
   VALUES ('Test View Only', NULL, false);
   
   INSERT INTO roles (name, department_id, is_superadmin) 
   VALUES ('Test Full Access', NULL, false);
   ```

2. **Configure Permissions via UI:**
   - Log in as admin
   - Go to Role Management
   - Edit each test role
   - Set appropriate permissions

3. **Assign Test Users:**
   - Create test user accounts
   - Assign appropriate roles
   - Log in as each user
   - Test functionality

4. **Run Debugger:**
   ```bash
   npx tsx scripts/debug-permissions.ts test-noperms@example.com
   npx tsx scripts/debug-permissions.ts test-viewonly@example.com
   npx tsx scripts/debug-permissions.ts test-fullaccess@example.com
   ```

5. **Verify Results:**
   - Compare debugger output with expected permissions
   - Test actual page access
   - Verify UI elements match permissions

## Debugging Common Issues

### Issue: User has role but no permissions showing

**Possible Causes:**
1. Role has no permissions in `role_permissions` table
2. All permissions have `granted = false`
3. User not properly assigned to role in `user_roles` table

**Debug Steps:**
```bash
# Run debugger
npx tsx scripts/debug-permissions.ts user@example.com

# Check output:
# - Are roles listed?
# - Are permissions listed for each role?
# - Are permissions marked as granted?
```

### Issue: User can access pages they shouldn't

**Possible Causes:**
1. User has multiple roles (check all roles)
2. User has override permission
3. User is superadmin
4. Page permission check is missing or incorrect

**Debug Steps:**
```bash
# Run debugger
npx tsx scripts/debug-permissions.ts user@example.com

# Look for:
# - "Superadmin" status
# - Multiple roles
# - Override permissions
# - Permission source column
```

### Issue: Permission changes not taking effect

**Possible Causes:**
1. Permission cache (currently no cache in implementation)
2. User session not refreshed
3. Database changes not committed

**Solutions:**
1. Have user log out and log back in
2. Check Supabase directly:
   ```sql
   SELECT * FROM role_permissions WHERE role_id = 'role-id';
   SELECT * FROM user_roles WHERE user_id = 'user-id';
   ```

### Issue: Override permission not working

**Debug Steps:**
```bash
# Run debugger
npx tsx scripts/debug-permissions.ts user@example.com

# Look for override permissions in output
# Verify the override map in lib/permission-checker.ts
```

**Check Override Map:**
```typescript
// lib/permission-checker.ts
const overridePermissions: Record<Permission, Permission[]> = {
  [Permission.EDIT_ACCOUNT]: [Permission.VIEW_ALL_ACCOUNTS],
  // ... etc
};
```

## Database Validation

### Check Role Permissions

```sql
-- View all permissions for a role
SELECT r.name as role_name, rp.permission, rp.granted
FROM roles r
JOIN role_permissions rp ON r.id = rp.role_id
WHERE r.id = 'role-id'
ORDER BY rp.permission;
```

### Check User Roles

```sql
-- View all roles for a user
SELECT up.email, r.name as role_name, r.is_superadmin
FROM user_profiles up
JOIN user_roles ur ON up.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE up.email = 'user@example.com';
```

### Check User Permissions (Full Query)

```sql
-- View all permissions a user has
SELECT 
  up.email,
  r.name as role_name,
  rp.permission,
  rp.granted,
  r.is_superadmin
FROM user_profiles up
JOIN user_roles ur ON up.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
LEFT JOIN role_permissions rp ON r.id = rp.role_id
WHERE up.email = 'user@example.com'
ORDER BY r.name, rp.permission;
```

## Performance Testing

### Permission Check Performance

```typescript
// Test permission check speed
const start = performance.now();
await hasPermission(userProfile, Permission.VIEW_PROJECTS);
const end = performance.now();
console.log(`Permission check took: ${end - start}ms`);
```

**Expected Performance:**
- First check: < 50ms (database query)
- Cached checks: < 1ms
- Page load with multiple checks: < 200ms total

## Continuous Integration

### Add to CI Pipeline

```yaml
# .github/workflows/test.yml
- name: Run Permission Tests
  run: |
    npm test -- permission-checker.test.ts
    npm test -- permissions-integration.test.ts
```

### Pre-commit Hook

```bash
# .husky/pre-commit
npm test -- permission-checker.test.ts
```

## Conclusion

Always use these testing tools and procedures when:
- Adding new permissions
- Modifying permission logic
- Debugging access issues
- Before deploying to production
- After database migrations affecting roles/permissions

For urgent permission issues, start with the debugger script - it provides the fastest diagnosis.


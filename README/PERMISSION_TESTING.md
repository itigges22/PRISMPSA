# Permission Testing Guide

## Overview
This guide helps you test permissions across the platform with two user scenarios:
1. **User with NO permissions** (all permissions disabled)
2. **User with ALL permissions** (all permissions enabled)

## Fixed Issues

### Department Permissions ✅
- Fixed: Users with `VIEW_ALL_DEPARTMENTS` can now see all departments
- Fixed: Users with `EDIT_DEPARTMENT` can edit any department (no context restriction)
- Fixed: Users with `DELETE_DEPARTMENT` can delete any department (no context restriction)

### Account Permissions ✅
- Fixed: Users with `VIEW_ALL_ACCOUNTS` can see all accounts
- Fixed: Users with `EDIT_ACCOUNT` can edit any account (no context restriction)
- Fixed: Users with `DELETE_ACCOUNT` can delete any account (no context restriction)

## Testing Steps

### 1. Create Test Users

#### User 1: No Permissions
1. Go to `/admin/roles`
2. Create a new role called "Test - No Permissions"
3. Leave ALL permissions unchecked (all disabled)
4. Assign this role to a test user

#### User 2: All Permissions
1. Go to `/admin/roles`
2. Create a new role called "Test - All Permissions"
3. Check ALL permissions (enable everything)
4. Assign this role to a test user

### 2. Test Each Page

#### Pages to Test:
- `/dashboard` - Should show projects/accounts user has access to
- `/departments` - Should show all departments if VIEW_ALL_DEPARTMENTS, otherwise only assigned
- `/departments/[id]` - Should be accessible if VIEW_ALL_DEPARTMENTS or assigned to department
- `/accounts` - Should show all accounts if VIEW_ALL_ACCOUNTS, otherwise only assigned
- `/accounts/[id]` - Should be accessible if VIEW_ALL_ACCOUNTS or has account access
- `/accounts/[id]` - Should show "Edit Account" button if EDIT_ACCOUNT permission
- `/projects` - Should show all projects if VIEW_ALL_PROJECTS, otherwise only assigned
- `/projects/[id]` - Should be accessible if VIEW_ALL_PROJECTS or assigned to project
- `/admin` - Should be accessible if has any admin permission
- `/admin/database` - Should be accessible if VIEW_ALL_ANALYTICS
- `/admin/roles` - Should be accessible if has role management permissions
- `/analytics` - Should be accessible if VIEW_ANALYTICS or VIEW_ALL_ANALYTICS
- `/kanban` - Should be accessible if VIEW_KANBAN
- `/gantt` - Should be accessible if VIEW_GANTT
- `/profile` - Should be accessible if VIEW_OWN_PROFILE

### 3. Use Browser Console Testing

Open Chrome DevTools Console and run:

```javascript
// Load the test script
const script = document.createElement('script');
script.src = '/scripts/e2e-permission-test.js';
document.head.appendChild(script);

// Wait a moment, then run tests
setTimeout(async () => {
  await testAllPermissions();
}, 1000);
```

Or manually test current page:
```javascript
await checkCurrentPageAccess();
```

### 4. Expected Behaviors

#### User with NO Permissions:
- ✅ Can access `/welcome` page
- ✅ Can access `/profile` page (if VIEW_OWN_PROFILE is enabled - it should be by default)
- ❌ Should NOT access `/dashboard`, `/departments`, `/accounts`, `/projects`, `/admin`, `/analytics`
- ❌ Should see "Access Denied" or be redirected to `/welcome`

#### User with ALL Permissions:
- ✅ Can access ALL pages listed above
- ✅ Can see ALL departments on `/departments` page
- ✅ Can see ALL accounts on `/accounts` page
- ✅ Can see "Edit Account" button on account detail pages
- ✅ Can see "Edit Department" button on department detail pages
- ✅ Can access `/admin/database` page
- ✅ Can create/edit/delete roles, departments, accounts, projects
- ✅ Can move items on Kanban boards
- ✅ Can configure Kanban layouts

### 5. Common Issues to Check

1. **Access Denied when should have access:**
   - Check browser console for permission check errors
   - Verify user's role has the correct permissions enabled
   - Check if override permissions are properly set (VIEW_ALL_*)

2. **Can't see items that should be visible:**
   - Verify override permissions (VIEW_ALL_DEPARTMENTS, VIEW_ALL_ACCOUNTS, etc.)
   - Check if filtering logic respects override permissions
   - Verify base permissions are enabled

3. **Edit buttons not showing:**
   - Check if EDIT_* permissions are enabled
   - Verify override permissions grant edit access (VIEW_ALL_* grants EDIT_*)

## Permission Override Map

The following override permissions grant broader access:

- `VIEW_ALL_DEPARTMENTS` → Grants: VIEW_DEPARTMENTS, EDIT_DEPARTMENT, DELETE_DEPARTMENT
- `VIEW_ALL_ACCOUNTS` → Grants: VIEW_ACCOUNTS, EDIT_ACCOUNT, DELETE_ACCOUNT
- `VIEW_ALL_PROJECTS` → Grants: VIEW_PROJECTS
- `EDIT_ALL_PROJECTS` → Grants: EDIT_PROJECT
- `DELETE_ALL_PROJECTS` → Grants: DELETE_PROJECT
- `VIEW_ALL_ANALYTICS` → Grants: VIEW_ANALYTICS, access to `/admin/database`

## Debugging Tips

1. **Check Permission Checks:**
   - Open browser DevTools → Network tab
   - Filter by "permission" or "rbac"
   - Look for failed permission checks

2. **Check Console Logs:**
   - Permission checks log to console with `permissionCheck` prefix
   - Look for `reason: 'override_permission'` or `reason: 'no_base_permission'`

3. **Verify Role Permissions:**
   - Go to `/admin/roles`
   - Edit the test role
   - Verify all permissions are checked/unchecked as expected

4. **Check User Profile:**
   - Go to `/profile`
   - Verify user has the correct role assigned
   - Check if role has the expected permissions

## Automated Testing

For automated E2E testing, use the script at `/scripts/e2e-permission-test.js`:

```bash
# In Chrome DevTools Console
await testAllPermissions()
```

This will test all major pages and report access status.


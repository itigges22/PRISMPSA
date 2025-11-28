# Permission System - Quick Reference

## Quick Commands

```bash
# Debug a user's permissions
npx tsx scripts/debug-permissions.ts user@example.com

# Validate all permission checks in codebase
npx tsx scripts/validate-permissions.ts

# Run unit tests
npm test -- permission-checker.test.ts

# Run integration tests
npm test -- permissions-integration.test.ts
```

## Common Permission Patterns

### Check Permission in Server Component

```typescript
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';
import { getCurrentUserProfileServer } from '@/lib/auth-server';

const userProfile = await getCurrentUserProfileServer();

// Simple check
const canView = await hasPermission(userProfile, Permission.VIEW_PROJECTS);

// With context
const canEdit = await hasPermission(
  userProfile, 
  Permission.EDIT_ACCOUNT,
  { accountId: 'account-123' }
);

if (!canView) {
  // Show access denied
}
```

### Check Permission in Client Component

```typescript
'use client';
import { useAuth } from '@/lib/hooks/useAuth';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';
import { useEffect, useState } from 'react';

export function MyComponent() {
  const { userProfile } = useAuth();
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    if (!userProfile) return;
    
    async function checkPermission() {
      const result = await hasPermission(
        userProfile, 
        Permission.EDIT_ACCOUNT
      );
      setCanEdit(result);
    }
    
    checkPermission();
  }, [userProfile]);

  return (
    <div>
      {canEdit && (
        <Button onClick={handleEdit}>Edit</Button>
      )}
    </div>
  );
}
```

### Conditional UI Elements

```typescript
{canCreateAccount && (
  <Button onClick={handleCreate}>
    Create Account
  </Button>
)}

{!hasFullAccess && (
  <Badge variant="secondary">Read-Only Access</Badge>
)}
```

## Permission Hierarchy

### Override Permissions (Most Powerful)

```typescript
VIEW_ALL_PROJECTS    → grants VIEW_PROJECTS everywhere
EDIT_ALL_PROJECTS    → grants EDIT_PROJECT everywhere  
DELETE_ALL_PROJECTS  → grants DELETE_PROJECT everywhere
VIEW_ALL_ACCOUNTS    → grants VIEW/EDIT/DELETE ACCOUNT everywhere
VIEW_ALL_DEPARTMENTS → grants VIEW/EDIT/DELETE DEPARTMENT everywhere
VIEW_ALL_ANALYTICS   → grants VIEW_ANALYTICS everywhere
```

### Base Permissions

```typescript
VIEW_PROJECTS     → can view assigned projects only
EDIT_PROJECT      → can edit specific project (with context)
DELETE_PROJECT    → can delete specific project (with context)
VIEW_ACCOUNTS     → can view assigned accounts only
EDIT_ACCOUNT      → can edit specific account (with context)
DELETE_ACCOUNT    → can delete specific account (with context)
```

### Special Permissions

```typescript
MANAGE_ROLES       → can create/edit/delete roles
MANAGE_USERS       → can manage user assignments
VIEW_OWN_PROFILE   → can view own profile (usually always granted)
```

## Permission Testing Checklist

When adding new features:

- [ ] Add permission constant to `lib/permissions.ts`
- [ ] Add permission to database migration
- [ ] Add permission check to page/component
- [ ] Add UI conditional rendering
- [ ] Add test cases to `permission-checker.test.ts`
- [ ] Run `npx tsx scripts/validate-permissions.ts`
- [ ] Test with no-permission user
- [ ] Test with full-permission user
- [ ] Document in this guide

## Common Issues & Fixes

### Issue: Permission not working

```bash
# 1. Debug the user
npx tsx scripts/debug-permissions.ts user@example.com

# 2. Check if permission is granted
# 3. Check if role is assigned
# 4. Check if override permission exists
```

### Issue: UI element shows but action fails

**Problem**: Permission check missing on server action
**Fix**: Add permission check in API route/server action

```typescript
// In server action
const canEdit = await hasPermission(userProfile, Permission.EDIT_ACCOUNT);
if (!canEdit) {
  return { error: 'Permission denied' };
}
```

### Issue: User has role but no access

**Problem**: Role has no permissions configured
**Fix**: Check `role_permissions` table

```sql
SELECT * FROM role_permissions WHERE role_id = 'role-id';
```

## Database Queries

### Check User's Roles

```sql
SELECT 
  up.email,
  r.name as role_name,
  r.is_superadmin
FROM user_profiles up
JOIN user_roles ur ON up.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE up.email = 'user@example.com';
```

### Check Role's Permissions

```sql
SELECT 
  r.name,
  rp.permission,
  rp.granted
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.role_id
WHERE r.name = 'Role Name'
ORDER BY rp.permission;
```

### Grant All Permissions to Role

```sql
-- Get role ID first
SELECT id FROM roles WHERE name = 'Role Name';

-- Insert all permissions
INSERT INTO role_permissions (role_id, permission, granted)
SELECT 
  'role-id-here',
  unnest(ARRAY[
    'VIEW_PROJECTS', 'EDIT_PROJECT', 'DELETE_PROJECT',
    'VIEW_ACCOUNTS', 'EDIT_ACCOUNT', 'DELETE_ACCOUNT',
    -- ... add all permissions
  ]),
  true
ON CONFLICT (role_id, permission) 
DO UPDATE SET granted = true;
```

## Architecture Diagram

```
User Login
    ↓
Load User Profile with Roles
    ↓
Page/Component Request
    ↓
Permission Check
    ├─ Superadmin? → YES → Grant Access
    ├─ Base Permission? → YES → Grant Access
    ├─ Override Permission? → YES → Grant Access
    └─ Context Check? → Check Context → Grant/Deny
    ↓
Render UI / Execute Action
```

## Permission Flow

1. **User loads page**
2. **Server checks permission** (or client for dynamic UI)
3. **If denied** → Show "Access Denied" or redirect
4. **If granted** → Render content
5. **User clicks button**
6. **Server action checks permission** (again, for security)
7. **If denied** → Return error
8. **If granted** → Execute action

## Best Practices

1. **Always check permissions on the server**, even if checked on client
2. **Use Permission enum**, never hardcode strings
3. **Provide context** for context-aware permissions
4. **Handle async properly** - always `await hasPermission()`
5. **Show meaningful errors** - tell users why they can't access something
6. **Test with multiple user types** - no-perms, view-only, full-access, superadmin
7. **Use override permissions** for admin-level access
8. **Cache wisely** - permission checks can be expensive

## Support

For issues or questions:
1. Check `README/PERMISSION_SYSTEM_TESTING.md`
2. Run debugger: `npx tsx scripts/debug-permissions.ts`
3. Run validator: `npx tsx scripts/validate-permissions.ts`
4. Check console logs for permission check failures


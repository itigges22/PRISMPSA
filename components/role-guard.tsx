'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { isSuperadmin, isUnassigned, hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';

interface RoleGuardProps {
  children: React.ReactNode;
  fallbackPath?: string;
  requirePermission?: Permission;
  requireAnyPermission?: Permission[];
  allowUnassigned?: boolean;
}

/**
 * RoleGuard component - Permission-based route protection
 * 
 * Protects routes based on permissions rather than role names.
 * 
 * @param children - Content to render if access allowed
 * @param fallbackPath - Redirect path if access denied (default: '/welcome')
 * @param requirePermission - Single required permission
 * @param requireAnyPermission - User needs any of these permissions
 * @param allowUnassigned - Allow unassigned users (default: false)
 */
export function RoleGuard({ 
  children, 
  fallbackPath = '/welcome', 
  requirePermission,
  requireAnyPermission,
  allowUnassigned = false
}: RoleGuardProps) {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const [permissionCheck, setPermissionCheck] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading) return;

    async function checkAccess() {
      // No user = redirect to login
      if (!user) {
        router.push('/login');
        return;
      }

      // Wait for profile to load before making permission decisions
      if (!userProfile) {
        return;
      }

      // Superadmin bypasses all checks
      if (isSuperadmin(userProfile)) {
        setPermissionCheck(true);
        return;
      }

      // Check if user is unassigned
      const userIsUnassigned = isUnassigned(userProfile);

      if (userIsUnassigned && !allowUnassigned) {
        router.push(fallbackPath);
        return;
      }

      // If user is unassigned and allowUnassigned is true, allow access without permission checks
      if (userIsUnassigned && allowUnassigned) {
        setPermissionCheck(true);
        return;
      }

      // If no permission required, allow access
      if (!requirePermission && !requireAnyPermission) {
        setPermissionCheck(true);
        return;
      }

      // Check specific permission
      if (requirePermission) {
        const hasAccess = await hasPermission(userProfile, requirePermission);
        if (!hasAccess) {
          router.push(fallbackPath);
          return;
        }
        setPermissionCheck(true);
        return;
      }

      // Check any of multiple permissions
      if (requireAnyPermission && requireAnyPermission.length > 0) {
        let hasAnyAccess = false;
        for (const perm of requireAnyPermission) {
          if (await hasPermission(userProfile, perm)) {
            hasAnyAccess = true;
            break;
          }
        }
        
        if (!hasAnyAccess) {
          router.push(fallbackPath);
          return;
        }
        setPermissionCheck(true);
        return;
      }

      setPermissionCheck(true);
    }

    checkAccess();
  }, [user, userProfile, loading, router, fallbackPath, requirePermission, requireAnyPermission, allowUnassigned]);

  // Show loading state
  if (loading || !user || !userProfile || permissionCheck === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Permission check passed, render children
  if (permissionCheck) {
    return <>{children}</>;
  }

  // Permission check failed (will redirect)
  return null;
}

/**
 * Hook to check if user has a specific permission
 * @param permission - Permission to check
 * @returns Object with hasPermission boolean and loading state
 */
export function usePermissionCheck(permission?: Permission) {
  const { userProfile, loading } = useAuth();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  
  useEffect(() => {
    if (loading || !userProfile) {
      setHasAccess(null);
      return;
    }

    async function check() {
      if (!permission) {
        setHasAccess(true);
        return;
      }

      if (isSuperadmin(userProfile)) {
        setHasAccess(true);
        return;
      }

      const access = await hasPermission(userProfile, permission);
      setHasAccess(access);
    }

    check();
  }, [userProfile, loading, permission]);
  
  return {
    hasPermission: hasAccess,
    loading: loading || hasAccess === null,
    userProfile
  };
}

/**
 * Hook to check user's role status
 * @returns Object with role status flags
 */
export function useRoleCheck() {
  const { userProfile, loading } = useAuth();
  
  return {
    isSuperadmin: isSuperadmin(userProfile),
    isUnassigned: isUnassigned(userProfile),
    hasRoles: !isUnassigned(userProfile),
    loading,
    userProfile
  };
}

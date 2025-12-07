'use client'

import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useState, useEffect, memo, Suspense } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RoleGuard } from "@/components/role-guard"
import { hasPermission } from '@/lib/rbac'
import { Permission } from '@/lib/permissions'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Skeleton } from "@/components/ui/skeleton"
import dynamic from 'next/dynamic'

// Loading skeleton for components - must be defined before dynamic imports
const ComponentSkeleton = () => (
  <div className="space-y-3">
    <Skeleton className="h-8 w-full" />
    <Skeleton className="h-32 w-full" />
    <Skeleton className="h-8 w-full" />
  </div>
)

// Code Splitting: Use Next.js dynamic() instead of React lazy() for better stability
const CapacityDashboard = dynamic(() => import('@/components/capacity-dashboard'), {
  loading: () => <ComponentSkeleton />,
  ssr: false
})
const DragAvailabilityCalendar = dynamic(() => import('@/components/drag-availability-calendar'), {
  loading: () => <ComponentSkeleton />,
  ssr: false
})
const UnifiedProjectsSection = dynamic(
  () => import('@/components/unified-projects-section').then(mod => mod.UnifiedProjectsSection),
  { loading: () => <ComponentSkeleton />, ssr: false }
)

// Memoized Profile Card to prevent unnecessary re-renders
const ProfileCard = memo(({ userProfile }: { userProfile: any }) => (
  <Card>
    <CardHeader>
      <CardTitle>Profile Information</CardTitle>
      <CardDescription>Your account details</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        <p><strong>Name:</strong> {userProfile?.name || 'N/A'}</p>
        <p><strong>Email:</strong> {userProfile?.email || 'N/A'}</p>
        <p><strong>Roles:</strong> {userProfile?.user_roles?.map((ur: any) => ur.roles.name).join(', ') || 'None assigned'}</p>
        <p><strong>Departments:</strong> {userProfile?.user_roles?.map((ur: any) => ur.roles.departments?.name).filter((name: any): name is string => Boolean(name)).join(', ') || 'None assigned'}</p>
      </div>
    </CardContent>
  </Card>
))
ProfileCard.displayName = 'ProfileCard'

// Memoized Quick Actions Card to prevent unnecessary re-renders
const QuickActionsCard = memo(({
  canViewAccounts,
  canViewDepartments,
  canAccessAdmin,
  canAccessAnalytics,
  onNavigate
}: {
  canViewAccounts: boolean
  canViewDepartments: boolean
  canAccessAdmin: boolean
  canAccessAnalytics: boolean
  onNavigate: (path: string) => void
}) => (
  <Card>
    <CardHeader>
      <CardTitle>Quick Actions</CardTitle>
      <CardDescription>Common tasks</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        {canViewAccounts && (
          <Button className="w-full" variant="outline" onClick={() => { onNavigate('/accounts'); }}>
            View My Accounts
          </Button>
        )}
        {canViewDepartments && (
          <Button className="w-full" variant="outline" onClick={() => { onNavigate('/departments'); }}>
            View My Departments
          </Button>
        )}
        {canAccessAdmin && (
          <Button className="w-full" variant="outline" onClick={() => { onNavigate('/admin'); }}>
            View Admin Page
          </Button>
        )}
        {canAccessAnalytics && (
          <Button className="w-full" variant="outline" onClick={() => { onNavigate('/analytics'); }}>
            View Org Analytics
          </Button>
        )}
      </div>
    </CardContent>
  </Card>
))
QuickActionsCard.displayName = 'QuickActionsCard'

export default function DashboardPage() {
  const { userProfile, loading } = useAuth()
  const router = useRouter()
  const [canAccessAdmin, setCanAccessAdmin] = useState(false)
  const [canAccessAnalytics, setCanAccessAnalytics] = useState(false)
  const [canViewAccounts, setCanViewAccounts] = useState(false)
  const [canViewDepartments, setCanViewDepartments] = useState(false)
  const [permissionsLoading, setPermissionsLoading] = useState(true)
  const [showAvailabilityDialog, setShowAvailabilityDialog] = useState(false)
  const [capacityRefreshKey, setCapacityRefreshKey] = useState(0)

  useEffect(() => {
    if (loading || !userProfile) {
      setPermissionsLoading(true);
      setCanAccessAdmin(false);
      setCanAccessAnalytics(false);
      setCanViewAccounts(false);
      setCanViewDepartments(false);
      return;
    }

    async function checkPermissions() {
      try {
        setPermissionsLoading(true);
        
        // OPTIMIZED: Batch all permission checks in parallel instead of sequential
        const [
          viewRoles, createRole, editRole, deleteRole, viewAccountsTab,
          assignUsers, removeUsers, createDept, createAccount, manageUsers,
          viewAllAnalytics, viewAnalytics, viewDeptAnalytics,
          viewAccounts, viewAllAccounts,
          viewDepartments, viewAllDepartments
        ] = await Promise.all([
          hasPermission(userProfile, Permission.VIEW_ROLES),
          hasPermission(userProfile, Permission.CREATE_ROLE),
          hasPermission(userProfile, Permission.EDIT_ROLE),
          hasPermission(userProfile, Permission.DELETE_ROLE),
          hasPermission(userProfile, Permission.VIEW_ACCOUNTS_TAB),
          hasPermission(userProfile, Permission.ASSIGN_USERS_TO_ROLES),
          hasPermission(userProfile, Permission.REMOVE_USERS_FROM_ROLES),
          hasPermission(userProfile, Permission.CREATE_DEPARTMENT),
          hasPermission(userProfile, Permission.CREATE_ACCOUNT),
          hasPermission(userProfile, Permission.MANAGE_USERS),
          hasPermission(userProfile, Permission.VIEW_ALL_ANALYTICS),
          hasPermission(userProfile, Permission.VIEW_ANALYTICS),
          hasPermission(userProfile, Permission.VIEW_DEPARTMENT_ANALYTICS),
          hasPermission(userProfile, Permission.VIEW_ACCOUNTS),
          hasPermission(userProfile, Permission.VIEW_ALL_ACCOUNTS),
          hasPermission(userProfile, Permission.VIEW_DEPARTMENTS),
          hasPermission(userProfile, Permission.VIEW_ALL_DEPARTMENTS),
        ]);
        
        const hasRoleManagementAccess = viewRoles || createRole || editRole || deleteRole || 
                                       viewAccountsTab || assignUsers || removeUsers || 
                                       createDept || createAccount || manageUsers;
        
        // Admin page access: role management permissions OR VIEW_ALL_ANALYTICS
        const hasAdminAccess = hasRoleManagementAccess || viewAllAnalytics;
        
        // Analytics page access: any analytics permission
        const canViewAnalytics = viewAnalytics || viewAllAnalytics || viewDeptAnalytics;
        
        // Check accounts and departments permissions
        const canViewAccts = viewAccounts || viewAllAccounts;
        const canViewDepts = viewDepartments || viewAllDepartments;
        
        setCanAccessAdmin(hasAdminAccess);
        setCanAccessAnalytics(canViewAnalytics);
        setCanViewAccounts(canViewAccts);
        setCanViewDepartments(canViewDepts);
      } catch (error) {
        console.error('Error checking permissions:', error);
        setCanAccessAdmin(false);
        setCanAccessAnalytics(false);
        setCanViewAccounts(false);
        setCanViewDepartments(false);
      } finally {
        setPermissionsLoading(false);
      }
    }

    void checkPermissions();
  }, [userProfile, loading])

  return (
    <RoleGuard>
      <div>
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
            <p className="text-gray-600">Welcome to your PRISM PSA dashboard</p>
          </div>

        {/* Unified Projects Section - combines workflow inbox and assigned projects */}
        <div className="mb-8">
          <Suspense fallback={<ComponentSkeleton />}>
            <UnifiedProjectsSection userProfile={userProfile} />
          </Suspense>
        </div>

        {/* Capacity Dashboard - Current Week Utilization */}
        {userProfile && (
          <div className="mb-8 mt-8">
            <Suspense fallback={<ComponentSkeleton />}>
              <CapacityDashboard
                key={capacityRefreshKey}
                userProfile={userProfile}
                onOpenAvailability={() => { setShowAvailabilityDialog(true); }}
              />
            </Suspense>
          </div>
        )}

        {/* Work Availability Dialog - Lazy loaded only when opened */}
        <Dialog open={showAvailabilityDialog} onOpenChange={setShowAvailabilityDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Set Work Availability</DialogTitle>
              <DialogDescription>
                Drag to mark unavailable times. Gray blocks indicate times you cannot work.
              </DialogDescription>
            </DialogHeader>
            {userProfile && (
              <Suspense fallback={<ComponentSkeleton />}>
                <DragAvailabilityCalendar
                  userProfile={userProfile}
                  onSave={() => {
                    // Refresh the capacity chart after saving
                    setCapacityRefreshKey(prev => prev + 1)
                  }}
                />
              </Suspense>
            )}
          </DialogContent>
        </Dialog>

        {/* User Info and Quick Actions - Memoized to prevent unnecessary re-renders */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 mt-8">
          {userProfile && <ProfileCard userProfile={userProfile} />}
          <QuickActionsCard
            canViewAccounts={canViewAccounts}
            canViewDepartments={canViewDepartments}
            canAccessAdmin={canAccessAdmin}
            canAccessAnalytics={canAccessAnalytics}
            onNavigate={(path) => { router.push(path); }}
          />
        </div>

      </div>
    </RoleGuard>
  )
}

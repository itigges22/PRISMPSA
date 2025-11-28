'use client'

import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RoleGuard } from "@/components/role-guard"
import { hasPermission } from '@/lib/rbac'
import { Permission } from '@/lib/permissions'
import dynamic from 'next/dynamic'
import CapacityDashboard from '@/components/capacity-dashboard'
import DragAvailabilityCalendar from '@/components/drag-availability-calendar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

// Dynamically import AssignedProjectsSection to reduce initial bundle size
const AssignedProjectsSection = dynamic(
  () => import('@/components/assigned-projects-section').then(mod => ({ default: mod.AssignedProjectsSection })),
  { 
    loading: () => (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Loading projects...</p>
          </div>
        </CardContent>
      </Card>
    ),
    ssr: false
  }
)

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

    checkPermissions();
  }, [userProfile, loading])

  return (
    <RoleGuard>
      <div>
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
            <p className="text-gray-600">Welcome to your PRISM PSA dashboard</p>
          </div>

        {/* Assigned Projects Section */}
        <AssignedProjectsSection userProfile={userProfile} />

        {/* Capacity Dashboard - Current Week Utilization */}
        {userProfile && (
          <div className="mb-8 mt-8">
            <CapacityDashboard
              key={capacityRefreshKey}
              userProfile={userProfile}
              onOpenAvailability={() => setShowAvailabilityDialog(true)}
            />
          </div>
        )}

        {/* Work Availability Dialog */}
        <Dialog open={showAvailabilityDialog} onOpenChange={setShowAvailabilityDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Set Work Availability</DialogTitle>
              <DialogDescription>
                Drag to mark unavailable times. Gray blocks indicate times you cannot work.
              </DialogDescription>
            </DialogHeader>
            {userProfile && (
              <DragAvailabilityCalendar
                userProfile={userProfile}
                onSave={() => {
                  // Refresh the capacity chart after saving
                  setCapacityRefreshKey(prev => prev + 1)
                }}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* User Info and Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Your account details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p><strong>Name:</strong> {userProfile?.name || 'N/A'}</p>
                <p><strong>Email:</strong> {userProfile?.email || 'N/A'}</p>
                <p><strong>Roles:</strong> {userProfile?.user_roles?.map(ur => ur.roles.name).join(', ') || 'None assigned'}</p>
                <p><strong>Departments:</strong> {userProfile?.user_roles?.map(ur => ur.roles.departments?.name).filter((name): name is string => Boolean(name)).join(', ') || 'None assigned'}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {canViewAccounts && (
                  <Button className="w-full" variant="outline" onClick={() => router.push('/accounts')}>
                    View My Accounts
                  </Button>
                )}
                {canViewDepartments && (
                  <Button className="w-full" variant="outline" onClick={() => router.push('/departments')}>
                    View My Departments
                  </Button>
                )}
                {canAccessAdmin && (
                  <Button className="w-full" variant="outline" onClick={() => router.push('/admin')}>
                    View Admin Page
                  </Button>
                )}
                {canAccessAnalytics && (
                  <Button className="w-full" variant="outline" onClick={() => router.push('/analytics')}>
                    View Org Analytics
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </RoleGuard>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Database, Shield, BarChart3, Clock } from 'lucide-react'
import { RoleGuard } from '@/components/role-guard'
import { Permission } from '@/lib/permissions'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { isSuperadmin, hasPermission } from '@/lib/rbac'

export default function AdminPage() {
  const router = useRouter()
  const { userProfile } = useAuth()
  const [canManageRoles, setCanManageRoles] = useState(false)
  const [canViewAnalytics, setCanViewAnalytics] = useState(false)
  const [canViewTimeTracking, setCanViewTimeTracking] = useState(false)
  const [isUserSuperadmin, setIsUserSuperadmin] = useState(false)

  useEffect(() => {
    if (!userProfile) return

    async function checkPermissions() {
      const isSuper = isSuperadmin(userProfile)
      setIsUserSuperadmin(isSuper)

      // Check if user has any role management permissions
      const hasRolePerms = await Promise.all([
        hasPermission(userProfile, Permission.VIEW_ROLES),
        hasPermission(userProfile, Permission.CREATE_ROLE),
        hasPermission(userProfile, Permission.EDIT_ROLE),
        hasPermission(userProfile, Permission.DELETE_ROLE),
        hasPermission(userProfile, Permission.ASSIGN_USERS_TO_ROLES),
        hasPermission(userProfile, Permission.VIEW_ACCOUNTS_TAB),
      ])
      setCanManageRoles(hasRolePerms.some(Boolean) || isSuper)

      // Check analytics permissions - only VIEW_ALL_ANALYTICS grants access to admin page analytics cards
      const hasAllAnalytics = await hasPermission(userProfile, Permission.VIEW_ALL_ANALYTICS)
      setCanViewAnalytics(hasAllAnalytics || isSuper)

      // Check time tracking permissions
      const hasTimeTracking = await hasPermission(userProfile, Permission.VIEW_TEAM_TIME_ENTRIES)
      setCanViewTimeTracking(hasTimeTracking || isSuper)
    }

    checkPermissions()
  }, [userProfile])

  return (
    <RoleGuard requireAnyPermission={[
      Permission.MANAGE_USERS,
      Permission.CREATE_ROLE,
      Permission.EDIT_ROLE,
      Permission.DELETE_ROLE,
      Permission.VIEW_ROLES,
      Permission.CREATE_DEPARTMENT,
      Permission.CREATE_ACCOUNT,
      Permission.VIEW_ACCOUNTS_TAB,
      Permission.ASSIGN_USERS_TO_ROLES,
      Permission.REMOVE_USERS_FROM_ROLES,
      Permission.VIEW_ALL_ANALYTICS,
      Permission.VIEW_TEAM_TIME_ENTRIES,
    ]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Administration</h1>
          <p className="text-gray-600 mt-2">Manage your PRISM PSA system settings and configurations</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Database Status Card - Only show if user has analytics permissions */}
          {canViewAnalytics && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Database className="w-5 h-5" />
                  <span>Database Status</span>
                </CardTitle>
                <CardDescription>Monitor database health and performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Connection Status</span>
                    <span className="text-sm font-medium text-green-600">Connected</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Response Time</span>
                    <span className="text-sm font-medium">~50ms</span>
                  </div>
                </div>
                <Button 
                  className="w-full mt-4" 
                  onClick={() => router.push('/admin/database')}
                >
                  View Details
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Role Management Card - Show if user has any role management permissions */}
          {canManageRoles && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="w-5 h-5" />
                  <span>Role Management</span>
                </CardTitle>
                <CardDescription>Manage user roles and permissions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Total Roles</span>
                    <span className="text-sm font-medium">8</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Active Users</span>
                    <span className="text-sm font-medium">1</span>
                  </div>
                </div>
                <Button
                  className="w-full mt-4"
                  onClick={() => router.push('/admin/roles')}
                >
                  Manage Roles
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Time Tracking Card - Show if user has time tracking permissions */}
          {canViewTimeTracking && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="w-5 h-5" />
                  <span>Time Tracking</span>
                </CardTitle>
                <CardDescription>View and manage team time entries</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">View Entries</span>
                    <span className="text-sm font-medium text-green-600">Available</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Export Data</span>
                    <span className="text-sm font-medium text-green-600">Available</span>
                  </div>
                </div>
                <Button
                  className="w-full mt-4"
                  onClick={() => router.push('/admin/time-tracking')}
                >
                  View Time Entries
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Superadmin Management Card - Only show to Superadmins */}
          {isUserSuperadmin && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="w-5 h-5" />
                  <span>Superadmin Management</span>
                </CardTitle>
                <CardDescription>Manage superadmin roles and permissions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Superadmin Users</span>
                    <span className="text-sm font-medium">1</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Role Assignments</span>
                    <span className="text-sm font-medium">Active</span>
                  </div>
                </div>
                <Button 
                  className="w-full mt-4" 
                  onClick={() => router.push('/admin/superadmin-setup')}
                >
                  Manage Superadmins
                </Button>
              </CardContent>
            </Card>
          )}

          {/* System Analytics Card - Only show if user has analytics permissions */}
          {canViewAnalytics && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5" />
                  <span>System Analytics</span>
                </CardTitle>
                <CardDescription>View system usage and performance metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Page Views</span>
                    <span className="text-sm font-medium">1,234</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">API Calls</span>
                    <span className="text-sm font-medium">5,678</span>
                  </div>
                </div>
                <Button 
                  className="w-full mt-4" 
                  variant="outline"
                  disabled
                >
                  View Analytics (Coming Soon)
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </RoleGuard>
  )
}

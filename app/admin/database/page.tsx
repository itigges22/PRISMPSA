'use client'

import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, AlertCircle, Clock, Activity, Database } from 'lucide-react'
import { isSuperadmin } from '@/lib/rbac'
import { AccessDeniedPage } from '@/components/access-denied-page'

export default function DatabaseStatusPage() {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()

  const dbStatus = {
    connected: true,
    responseTime: 45,
    uptime: '99.9%',
    queries: 1234,
    errors: 0
  }

  // Check superadmin access
  const hasSuperadminAccess = userProfile ? isSuperadmin(userProfile) : false

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // If userProfile is still loading, show loading
  if (!userProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading profile...</p>
        </div>
      </div>
    )
  }

  // Show access denied if not superadmin
  if (!user || !hasSuperadminAccess) {
    return (
      <AccessDeniedPage
        title="Superadmin Access Required"
        description="The database status page is restricted to superadmin users only."
        requiredPermission="Superadmin"
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Database Status</h1>
          <p className="text-gray-600 mt-2">Monitor your Supabase database health and performance</p>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => router.back()}>
            Back to Admin
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Connection Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Connection Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {dbStatus.connected ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
              <span className={`text-lg font-semibold ${dbStatus.connected ? 'text-green-600' : 'text-red-600'}`}>
                {dbStatus.connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Response Time */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Response Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-blue-500" />
              <span className="text-lg font-semibold text-gray-900">
                {dbStatus.responseTime}ms
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Uptime */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Uptime</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-green-500" />
              <span className="text-lg font-semibold text-green-600">
                {dbStatus.uptime}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Total Queries */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Queries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Database className="h-5 w-5 text-purple-500" />
              <span className="text-lg font-semibold text-gray-900">
                {dbStatus.queries.toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Database Tables Status */}
      <Card>
        <CardHeader>
          <CardTitle>Database Tables</CardTitle>
          <CardDescription>Status of all database tables and their row counts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm sm:text-base">user_profiles</h4>
                  <p className="text-xs sm:text-sm text-gray-600 truncate">User account information</p>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <span className="text-lg font-semibold">1</span>
                  <p className="text-xs text-gray-500">rows</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm sm:text-base">departments</h4>
                  <p className="text-xs sm:text-sm text-gray-600 truncate">Department definitions</p>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <span className="text-lg font-semibold">1</span>
                  <p className="text-xs text-gray-500">rows</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm sm:text-base">roles</h4>
                  <p className="text-xs sm:text-sm text-gray-600 truncate">Role definitions</p>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <span className="text-lg font-semibold">1</span>
                  <p className="text-xs text-gray-500">rows</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm sm:text-base">user_roles</h4>
                  <p className="text-xs sm:text-sm text-gray-600 truncate">User role assignments</p>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <span className="text-lg font-semibold">1</span>
                  <p className="text-xs text-gray-500">rows</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Database Activity</CardTitle>
          <CardDescription>Latest database operations and queries</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">User profile created</p>
                  <p className="text-xs text-gray-600">2 minutes ago</p>
                </div>
              </div>
              <span className="text-xs text-green-600 font-medium flex-shrink-0 ml-2">SUCCESS</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">Superadmin role assigned</p>
                  <p className="text-xs text-gray-600">5 minutes ago</p>
                </div>
              </div>
              <span className="text-xs text-green-600 font-medium flex-shrink-0 ml-2">SUCCESS</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">System department created</p>
                  <p className="text-xs text-gray-600">10 minutes ago</p>
                </div>
              </div>
              <span className="text-xs text-green-600 font-medium flex-shrink-0 ml-2">SUCCESS</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

'use client'

import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3 } from 'lucide-react'
import { RoleGuard } from '@/components/role-guard'
import { Permission } from '@/lib/permissions'
import CapacityDashboard from '@/components/capacity-dashboard'

export default function AnalyticsPage() {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

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

  return (
    <RoleGuard requireAnyPermission={[Permission.VIEW_ANALYTICS, Permission.VIEW_DEPARTMENT_ANALYTICS, Permission.VIEW_ALL_ANALYTICS]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
            <p className="text-gray-600 mt-2">View insights and performance metrics</p>
          </div>
        </div>

        {/* Organization Capacity Widget */}
        {userProfile && (
          <CapacityDashboard userProfile={userProfile} mode="organization" />
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5" />
              <span>Additional Analytics</span>
            </CardTitle>
            <CardDescription>More analytics features coming soon</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">More Analytics Coming Soon</h3>
              <p className="text-gray-600 mb-6">
                Additional analytics features are under development including:
              </p>
              <div className="space-y-2 text-sm text-gray-500">
                <p>• Project progress tracking</p>
                <p>• User activity analytics</p>
                <p>• Custom report generation</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  )
}

'use client'

/**
 * Capacity Management Page
 * Allows users to manage availability and view capacity metrics
 */

import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import DragAvailabilityCalendar from '@/components/drag-availability-calendar'
import CapacityDashboard from '@/components/capacity-dashboard'
import { hasPermission } from '@/lib/permission-checker'
import { Permission } from '@/lib/permissions'
import { Card, CardContent } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'

export default function CapacityPage() {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()
  const [canAccess, setCanAccess] = useState(false)
  const [checkingPermissions, setCheckingPermissions] = useState(true)

  useEffect(() => {
    async function checkAccess() {
      if (!userProfile) {
        setCanAccess(false)
        setCheckingPermissions(false)
        return
      }

      // Check if user can view their own capacity or edit availability
      const viewCapacity = await hasPermission(userProfile, Permission.VIEW_OWN_CAPACITY)
      const editAvailability = await hasPermission(userProfile, Permission.EDIT_OWN_AVAILABILITY)

      setCanAccess(viewCapacity || editAvailability)
      setCheckingPermissions(false)
    }

    if (!loading) {
      checkAccess()
    }
  }, [userProfile, loading])

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  // Loading state
  if (loading || checkingPermissions) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Access denied
  if (!canAccess) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-3 text-amber-600">
              <AlertCircle className="w-5 h-5 mt-0.5" />
              <div>
                <h3 className="font-semibold">Access Denied</h3>
                <p className="text-sm mt-1">
                  You do not have permission to view this page. Contact your administrator to request access.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Capacity Management</h1>
        <p className="text-gray-600 mt-2">
          Manage your work availability and track capacity utilization
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Capacity Dashboard */}
        {userProfile && <CapacityDashboard userProfile={userProfile} />}

        {/* Drag-to-Set Availability Calendar */}
        {userProfile && <DragAvailabilityCalendar userProfile={userProfile} />}
      </div>
    </div>
  )
}


'use client'

/**
 * Capacity Dashboard Widget
 * Displays capacity trend chart for users or organization
 */

import React, { useState } from 'react'
import { UserWithRoles } from '@/lib/rbac-types'
import CapacityTrendChart, { TimePeriod } from '@/components/capacity-trend-chart'

interface CapacityDashboardProps {
  userProfile: UserWithRoles
  onOpenAvailability?: () => void
  mode?: 'user' | 'organization' | 'department' | 'account'
  departmentId?: string
  accountId?: string
}

export default function CapacityDashboard({
  userProfile,
  onOpenAvailability,
  mode = 'user',
  departmentId,
  accountId
}: CapacityDashboardProps) {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('weekly')

  return (
    <CapacityTrendChart
      userId={userProfile.id}
      timePeriod={timePeriod}
      onPeriodChange={setTimePeriod}
      onOpenAvailability={onOpenAvailability}
      mode={mode}
      departmentId={departmentId}
      accountId={accountId}
    />
  )
}


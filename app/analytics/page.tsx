'use client'

import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { RoleGuard } from '@/components/role-guard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Building2,
  Clock,
  GitBranch,
  Activity,
  Network,
} from 'lucide-react'

// Import widgets
import { ProjectAnalyticsWidget } from '@/components/analytics/widgets/project-analytics-widget'
import { TeamPerformanceWidget } from '@/components/analytics/widgets/team-performance-widget'
import { CapacityUtilizationWidget } from '@/components/analytics/widgets/capacity-utilization-widget'
import { NetworkGraphWidget } from '@/components/analytics/widgets/network-graph-widget'
import { AccountInsightsWidget } from '@/components/analytics/widgets/account-insights-widget'
import { TimeDistributionWidget } from '@/components/analytics/widgets/time-distribution-widget'
import { WorkflowAnalyticsWidget } from '@/components/analytics/widgets/workflow-analytics-widget'

// Import layout components
import { DashboardGrid, DashboardSection, SummaryStats, SummaryStatCard } from '@/components/analytics/layout/dashboard-grid'

interface OverviewData {
  projects: {
    total: number
    active: number
    completedThisMonth: number
    onTimeRate: number
  }
  team: {
    totalUsers: number
    activeUsers: number
    avgUtilization: number
    hoursLoggedThisWeek: number
  }
  accounts: {
    total: number
    active: number
  }
  workflows: {
    active: number
    completedThisMonth: number
    avgCompletionDays: number
  }
  tasks: {
    total: number
    completed: number
    inProgress: number
    overdue: number
    completionRate: number
  }
  insights: string[]
}

const fetcher = (url: string) => fetch(url).then(res => res.json())

export default function AnalyticsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('overview')

  // Fetch overview data for summary stats
  const { data: overviewData } = useSWR<{ success: boolean; data: OverviewData }>(
    '/api/analytics/overview',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  )

  const overview = overviewData?.data

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
    <RoleGuard allowUnassigned={false}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
            <p className="text-gray-600 mt-2">
              Comprehensive insights across your organization
            </p>
          </div>
        </div>

        {/* Summary Stats */}
        {overview && (
          <SummaryStats>
            <SummaryStatCard
              title="Active Projects"
              value={overview.projects.active}
              subtitle={`${overview.projects.total} total`}
              trend={{ value: overview.projects.onTimeRate, isPositive: overview.projects.onTimeRate >= 80 }}
              icon={<FolderKanban className="h-4 w-4" />}
            />
            <SummaryStatCard
              title="Team Utilization"
              value={`${overview.team.avgUtilization}%`}
              subtitle={`${overview.team.activeUsers} active users`}
              trend={{ value: overview.team.avgUtilization >= 70 ? 5 : -5, isPositive: overview.team.avgUtilization >= 70 }}
              icon={<Users className="h-4 w-4" />}
            />
            <SummaryStatCard
              title="Active Accounts"
              value={overview.accounts.active}
              subtitle={`${overview.accounts.total} total`}
              icon={<Building2 className="h-4 w-4" />}
            />
            <SummaryStatCard
              title="Tasks Completed"
              value={`${overview.tasks.completionRate}%`}
              subtitle={`${overview.tasks.overdue} overdue`}
              trend={{ value: overview.tasks.completionRate, isPositive: overview.tasks.completionRate >= 75 }}
              icon={<Activity className="h-4 w-4" />}
            />
          </SummaryStats>
        )}

        {/* AI Insights Banner */}
        {overview && overview.insights.length > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 border rounded-lg p-4">
            <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Key Insights
            </h3>
            <div className="flex flex-wrap gap-2">
              {overview.insights.map((insight, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-white dark:bg-gray-800 shadow-sm"
                >
                  {insight}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Main Dashboard Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-7 mb-6">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="projects" className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4" />
              <span className="hidden sm:inline">Projects</span>
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Team</span>
            </TabsTrigger>
            <TabsTrigger value="accounts" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Accounts</span>
            </TabsTrigger>
            <TabsTrigger value="time" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Time</span>
            </TabsTrigger>
            <TabsTrigger value="workflows" className="flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              <span className="hidden sm:inline">Workflows</span>
            </TabsTrigger>
            <TabsTrigger value="network" className="flex items-center gap-2">
              <Network className="h-4 w-4" />
              <span className="hidden sm:inline">Network</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab - Multiple widgets */}
          <TabsContent value="overview" className="space-y-6">
            <DashboardSection
              title="Capacity & Utilization"
              description="Organization-wide resource allocation"
            >
              <CapacityUtilizationWidget />
            </DashboardSection>

            <DashboardGrid columns={2}>
              <ProjectAnalyticsWidget />
              <TeamPerformanceWidget />
            </DashboardGrid>
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="projects">
            <ProjectAnalyticsWidget />
          </TabsContent>

          {/* Team Tab */}
          <TabsContent value="team" className="space-y-6">
            <TeamPerformanceWidget />
            <CapacityUtilizationWidget />
          </TabsContent>

          {/* Accounts Tab */}
          <TabsContent value="accounts">
            <AccountInsightsWidget />
          </TabsContent>

          {/* Time Tab */}
          <TabsContent value="time">
            <TimeDistributionWidget />
          </TabsContent>

          {/* Workflows Tab */}
          <TabsContent value="workflows">
            <WorkflowAnalyticsWidget />
          </TabsContent>

          {/* Network Tab */}
          <TabsContent value="network">
            <NetworkGraphWidget />
          </TabsContent>
        </Tabs>
      </div>
    </RoleGuard>
  )
}

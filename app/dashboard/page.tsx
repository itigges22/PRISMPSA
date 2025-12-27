'use client'

import { useAuth } from '@/lib/hooks/useAuth'
import { useState, Suspense } from 'react'
import { RoleGuard } from "@/components/role-guard"
import { Button } from '@/components/ui/button'
import { Skeleton } from "@/components/ui/skeleton"
import { Settings2 } from 'lucide-react'
import dynamic from 'next/dynamic'
import useSWR from 'swr'

// Loading skeleton for components
const ComponentSkeleton = () => (
  <div className="space-y-3">
    <Skeleton className="h-8 w-full" />
    <Skeleton className="h-32 w-full" />
    <Skeleton className="h-8 w-full" />
  </div>
)

// Code Splitting with dynamic imports
const CapacityDashboard = dynamic(() => import('@/components/capacity-dashboard'), {
  loading: () => <ComponentSkeleton />,
  ssr: false
})
const UnifiedProjectsSection = dynamic(
  () => import('@/components/unified-projects-section').then(mod => mod.UnifiedProjectsSection),
  { loading: () => <ComponentSkeleton />, ssr: false }
)
const CustomizeModal = dynamic(
  () => import('@/components/dashboard/customize-modal'),
  { ssr: false }
)
const MyTimeWidget = dynamic(
  () => import('@/components/dashboard/my-time-widget'),
  { loading: () => <ComponentSkeleton />, ssr: false }
)
const MyTasksWidget = dynamic(
  () => import('@/components/dashboard/my-tasks-widget'),
  { loading: () => <ComponentSkeleton />, ssr: false }
)
const MyWorkflowsWidget = dynamic(
  () => import('@/components/dashboard/my-workflows-widget'),
  { loading: () => <ComponentSkeleton />, ssr: false }
)
const MyAccountsWidget = dynamic(
  () => import('@/components/dashboard/my-accounts-widget'),
  { loading: () => <ComponentSkeleton />, ssr: false }
)
const MyCollaboratorsWidget = dynamic(
  () => import('@/components/dashboard/my-collaborators-widget'),
  { loading: () => <ComponentSkeleton />, ssr: false }
)
const TimeByProjectWidget = dynamic(
  () => import('@/components/dashboard/time-by-project-widget'),
  { loading: () => <ComponentSkeleton />, ssr: false }
)
const TaskCompletionTrendWidget = dynamic(
  () => import('@/components/dashboard/task-completion-trend-widget'),
  { loading: () => <ComponentSkeleton />, ssr: false }
)
const UpcomingDeadlinesWidget = dynamic(
  () => import('@/components/dashboard/upcoming-deadlines-widget'),
  { loading: () => <ComponentSkeleton />, ssr: false }
)
const RecentActivityWidget = dynamic(
  () => import('@/components/dashboard/recent-activity-widget'),
  { loading: () => <ComponentSkeleton />, ssr: false }
)

// Types
interface WidgetConfig {
  id: string;
  type: string;
  visible: boolean;
  order: number;
  size: string;
}

interface DashboardPreferences {
  widgets: WidgetConfig[];
  theme?: 'compact' | 'comfortable';
}

interface PreferencesResponse {
  success: boolean;
  data: {
    widgetConfig: DashboardPreferences;
    isDefault: boolean;
    updatedAt?: string;
  };
}

interface MyAnalyticsData {
  time: {
    hoursToday: number;
    hoursThisWeek: number;
    hoursThisMonth: number;
    weeklyTarget: number;
    dailyAverage: number;
  };
  tasks: {
    inProgress: number;
    dueThisWeek: number;
    overdue: number;
    completedThisWeek: number;
    urgent: { id: string; name: string; projectName: string; dueDate: string; status: string }[];
  };
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function DashboardPage() {
  const { userProfile } = useAuth()
  const [showCustomizeModal, setShowCustomizeModal] = useState(false)
  const [capacityRefreshKey, _setCapacityRefreshKey] = useState(0)

  // Fetch dashboard preferences
  const { data: preferencesData, mutate: mutatePreferences } = useSWR<PreferencesResponse>(
    '/api/dashboard/preferences',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  )

  // Fetch analytics data for widgets
  const { data: analyticsData, isLoading: analyticsLoading } = useSWR<{ success: boolean; data: MyAnalyticsData }>(
    '/api/dashboard/my-analytics',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  )

  const preferences = preferencesData?.data?.widgetConfig
  const analytics = analyticsData?.data

  // Get user's first name for greeting
  const firstName = (userProfile as any)?.name?.split(' ')[0] || 'there'

  // Helper to check if widget is visible
  const isWidgetVisible = (type: string): boolean => {
    if (!preferences?.widgets) return true; // Show all by default
    const widget = preferences.widgets.find(w => w.type === type);
    return widget ? widget.visible : true;
  }

  // Handle preference save
  const handleSavePreferences = async (newPreferences: DashboardPreferences) => {
    try {
      const response = await fetch('/api/dashboard/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgetConfig: newPreferences }),
      });

      if (response.ok) {
        await mutatePreferences();
      }
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  }

  // Handle preference reset
  const handleResetPreferences = async () => {
    try {
      const response = await fetch('/api/dashboard/preferences', {
        method: 'DELETE',
      });

      if (response.ok) {
        await mutatePreferences();
      }
    } catch (error) {
      console.error('Failed to reset preferences:', error);
    }
  }

  return (
    <RoleGuard>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Welcome back, {firstName}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Here&apos;s what&apos;s happening with your projects
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCustomizeModal(true)}
          >
            <Settings2 className="h-4 w-4 mr-1.5" />
            Customize
          </Button>
        </div>

        {/* SECTION 1: My Projects - Primary Focus */}
        {isWidgetVisible('projects') && (
          <section>
            <Suspense fallback={<ComponentSkeleton />}>
              <UnifiedProjectsSection userProfile={userProfile as any} />
            </Suspense>
          </section>
        )}

        {/* SECTION 2: Capacity Trend - Full Width */}
        {isWidgetVisible('capacity') && userProfile && (
          <section>
            <Suspense fallback={<ComponentSkeleton />}>
              <CapacityDashboard
                key={capacityRefreshKey}
                userProfile={userProfile}
              />
            </Suspense>
          </section>
        )}

        {/* SECTION 3: Three Column Widgets - Time, Tasks, Workflows */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isWidgetVisible('time') && (
            <Suspense fallback={<ComponentSkeleton />}>
              <MyTimeWidget
                data={analytics?.time || null}
                isLoading={analyticsLoading}
              />
            </Suspense>
          )}

          {isWidgetVisible('tasks') && (
            <Suspense fallback={<ComponentSkeleton />}>
              <MyTasksWidget
                data={analytics?.tasks || null}
                isLoading={analyticsLoading}
              />
            </Suspense>
          )}

          {isWidgetVisible('workflows') && (
            <Suspense fallback={<ComponentSkeleton />}>
              <MyWorkflowsWidget />
            </Suspense>
          )}
        </section>

        {/* SECTION 4: Two Column Widgets - Accounts, Collaborators */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {isWidgetVisible('accounts') && (
            <Suspense fallback={<ComponentSkeleton />}>
              <MyAccountsWidget />
            </Suspense>
          )}

          {isWidgetVisible('collaborators') && (
            <Suspense fallback={<ComponentSkeleton />}>
              <MyCollaboratorsWidget />
            </Suspense>
          )}
        </section>

        {/* SECTION 5: Charts and Analytics */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isWidgetVisible('time-by-project') && (
            <Suspense fallback={<ComponentSkeleton />}>
              <TimeByProjectWidget />
            </Suspense>
          )}

          {isWidgetVisible('task-trend') && (
            <Suspense fallback={<ComponentSkeleton />}>
              <TaskCompletionTrendWidget />
            </Suspense>
          )}

          {isWidgetVisible('deadlines') && (
            <Suspense fallback={<ComponentSkeleton />}>
              <UpcomingDeadlinesWidget />
            </Suspense>
          )}
        </section>

        {/* SECTION 6: Activity Feed */}
        {isWidgetVisible('activity') && (
          <section>
            <Suspense fallback={<ComponentSkeleton />}>
              <RecentActivityWidget />
            </Suspense>
          </section>
        )}

        {/* Customize Dashboard Modal */}
        <CustomizeModal
          open={showCustomizeModal}
          onOpenChange={setShowCustomizeModal}
          preferences={preferences || null}
          onSave={handleSavePreferences}
          onReset={handleResetPreferences}
        />
      </div>
    </RoleGuard>
  )
}

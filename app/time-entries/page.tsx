'use client';

import { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, List, BarChart3, Calendar } from 'lucide-react';
import { TimeEntriesList } from '@/components/time-entries-list';
import { TimeEntriesSummary } from '@/components/time-entries-summary';
import { TimeEntriesChart } from '@/components/time-entries-chart';
import { RoleGuard } from '@/components/role-guard';

// Lazy load the availability calendar
const DragAvailabilityCalendar = dynamic(() => import('@/components/drag-availability-calendar'), {
  loading: () => <Skeleton className="h-32 w-full" />,
  ssr: false
});

export default function TimeEntriesPage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('list');
  const [showAvailabilityDialog, setShowAvailabilityDialog] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !userProfile) {
    return null; // Will redirect to login
  }

  return (
    <RoleGuard allowUnassigned={true}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Time Entries</h1>
            <p className="text-gray-600 mt-2">
              View and manage your logged work hours across all projects
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowAvailabilityDialog(true)}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Set Availability
          </Button>
        </div>

        {/* Summary Statistics Card */}
        <TimeEntriesSummary userProfile={userProfile} />

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="list" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">List View</span>
            </TabsTrigger>
            <TabsTrigger value="chart" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Charts</span>
            </TabsTrigger>
          </TabsList>

          {/* List View Tab */}
          <TabsContent value="list" className="space-y-6">
            <TimeEntriesList userProfile={userProfile} />
          </TabsContent>

          {/* Charts Tab */}
          <TabsContent value="chart" className="space-y-6">
            <TimeEntriesChart userProfile={userProfile} />
          </TabsContent>
        </Tabs>

        {/* Quick Stats Footer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Quick Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-gray-600">
              <p>• You can edit or delete time entries within 14 days of logging them</p>
              <p>• Time entries are automatically associated with projects and tasks</p>
              <p>• Use the clock widget to easily log time as you work</p>
              <p>• Filter and export your time data using the controls above</p>
            </div>
          </CardContent>
        </Card>

        {/* Work Availability Dialog */}
        <Dialog open={showAvailabilityDialog} onOpenChange={setShowAvailabilityDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Set Work Availability</DialogTitle>
              <DialogDescription>
                Drag to mark unavailable times. Gray blocks indicate times you cannot work.
              </DialogDescription>
            </DialogHeader>
            {userProfile && (
              <Suspense fallback={<Skeleton className="h-32 w-full" />}>
                <DragAvailabilityCalendar
                  userProfile={userProfile}
                  onSave={() => {}}
                />
              </Suspense>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  );
}

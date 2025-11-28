'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ClientOnly from '@/components/client-only';
import GanttChart from '@/components/gantt-chart';
import TaskCreationDialog from '@/components/task-creation-dialog';
import GroupManagementDialog from '@/components/group-management-dialog';
import PeopleManagementDialog from '@/components/people-management-dialog';
import { Button } from '@/components/ui/button';
import { PlusIcon, ZoomIn, ZoomOut, Calendar, Clock, CalendarDays, CalendarRange } from 'lucide-react';
import { Task } from '@/lib/supabase-task-service';
import { RoleGuard } from '@/components/role-guard';
import { Permission } from '@/lib/permissions';
import { useAuth } from '@/lib/hooks/useAuth';
import { hasPermission } from '@/lib/rbac';

// Sample statuses for the legend
const statuses = [
  { id: 'todo', name: 'To Do', color: '#94a3b8' },
  { id: 'in-progress', name: 'In Progress', color: '#3b82f6' },
  { id: 'review', name: 'Review', color: '#f59e0b' },
  { id: 'done', name: 'Done', color: '#10b981' },
  { id: 'blocked', name: 'Blocked', color: '#ef4444' },
];

type ZoomRange = 'daily' | 'monthly' | 'quarterly' | 'yearly';
type ZoomLevel = 25 | 50 | 75 | 100 | 125 | 150 | 200;

export default function GanttPage() {
  const { userProfile } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [zoomRange, setZoomRange] = useState<ZoomRange>('monthly');
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(100);
  const [isClient, setIsClient] = useState(false);
  const [canCreateTask, setCanCreateTask] = useState(false);
  const [canViewKanban, setCanViewKanban] = useState(false);
  const [canEditGantt, setCanEditGantt] = useState(false);

  // Check permissions
  useEffect(() => {
    if (!userProfile) return;
    
    async function checkPermissions() {
      const canCreate = await hasPermission(userProfile, Permission.CREATE_TASK);
      const canView = await hasPermission(userProfile, Permission.VIEW_KANBAN);
      const canEdit = await hasPermission(userProfile, Permission.EDIT_GANTT);
      setCanCreateTask(canCreate);
      setCanViewKanban(canView);
      setCanEditGantt(canEdit);
    }
    
    checkPermissions();
  }, [userProfile]);

  // Load settings from localStorage after hydration
  useEffect(() => {
    setIsClient(true);
    const savedRange = localStorage.getItem('gantt-zoom-range') as ZoomRange;
    const savedLevel = localStorage.getItem('gantt-zoom-level');
    
    if (savedRange) {
      setZoomRange(savedRange);
    }
    if (savedLevel) {
      setZoomLevel(parseInt(savedLevel) as ZoomLevel);
    }
  }, []);
  
  const handleTaskCreated = (newTask: Task) => {
    console.log('GanttPage: Task created:', newTask);
    // Force a re-render of the GanttChart component
    setRefreshKey(prev => prev + 1);
  };

  const handleZoomRangeChange = (range: ZoomRange) => {
    setZoomRange(range);
    if (typeof window !== 'undefined') {
      localStorage.setItem('gantt-zoom-range', range);
    }
    setRefreshKey(prev => prev + 1);
  };

  const handleZoomLevelChange = (level: ZoomLevel) => {
    setZoomLevel(level);
    if (typeof window !== 'undefined') {
      localStorage.setItem('gantt-zoom-level', level.toString());
    }
    setRefreshKey(prev => prev + 1);
  };

  const zoomRangeOptions = [
    { value: 'daily' as const, label: 'Daily', icon: Clock, description: 'View by days' },
    { value: 'monthly' as const, label: 'Monthly', icon: Calendar, description: 'View by months' },
    { value: 'quarterly' as const, label: 'Quarterly', icon: CalendarDays, description: 'View by quarters' },
    { value: 'yearly' as const, label: 'Yearly', icon: CalendarRange, description: 'View by years' },
  ];

  const zoomLevelOptions: ZoomLevel[] = [25, 50, 75, 100, 125, 150, 200];


  return (
    <RoleGuard requirePermission={Permission.VIEW_GANTT}>
      <div className="min-h-screen bg-background">
        {/* Header - Responsive */}
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 max-w-screen-2xl items-center px-4">
            <div className="mr-4 flex">
              <Link className="mr-6 flex items-center space-x-2" href="/">
                <span className="hidden font-bold sm:inline-block">
                  Project Gantt Chart
                </span>
                <span className="font-bold sm:hidden">Gantt</span>
              </Link>
            </div>
            
            {/* Mobile-first responsive layout */}
            <div className="flex flex-1 items-center justify-between space-x-2">
              <div className="w-full flex-1 md:w-auto md:flex-none">
                <h1 className="text-lg font-semibold truncate">Project Timeline</h1>
              </div>
              
              {/* Desktop controls - hidden on mobile */}
              <div className="hidden lg:flex items-center space-x-4">
                {/* Zoom Controls */}
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1">
                    <span className="text-sm text-muted-foreground">View:</span>
                    <div className="flex rounded-md border">
                      {zoomRangeOptions.map((option) => {
                        const Icon = option.icon;
                        return (
                          <Button
                            key={option.value}
                            variant={zoomRange === option.value ? "default" : "ghost"}
                            size="sm"
                            onClick={() => handleZoomRangeChange(option.value)}
                            className="h-8 px-2 text-xs"
                            title={option.description}
                          >
                            <Icon className="h-3 w-3 mr-1" />
                            {option.label}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    <span className="text-sm text-muted-foreground">Zoom:</span>
                    <div className="flex rounded-md border">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const currentIndex = zoomLevelOptions.indexOf(zoomLevel);
                          if (currentIndex > 0) {
                            handleZoomLevelChange(zoomLevelOptions[currentIndex - 1]);
                          }
                        }}
                        disabled={zoomLevel === 25}
                        className="h-8 px-2"
                        title="Zoom out"
                      >
                        <ZoomOut className="h-3 w-3" />
                      </Button>
                      <div className="flex items-center px-2 text-xs text-muted-foreground border-x">
                        {zoomLevel}%
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const currentIndex = zoomLevelOptions.indexOf(zoomLevel);
                          if (currentIndex < zoomLevelOptions.length - 1) {
                            handleZoomLevelChange(zoomLevelOptions[currentIndex + 1]);
                          }
                        }}
                        disabled={zoomLevel === 200}
                        className="h-8 px-2"
                        title="Zoom in"
                      >
                        <ZoomIn className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {canCreateTask && (
                  <TaskCreationDialog onTaskCreated={handleTaskCreated}>
                    <Button size="sm" className="flex items-center gap-2">
                      <PlusIcon className="h-4 w-4" />
                      Add Task
                    </Button>
                  </TaskCreationDialog>
                  )}
                  <GroupManagementDialog />
                  <PeopleManagementDialog />
                  {canViewKanban && (
                  <a
                    href="/kanban"
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    View Kanban Board
                  </a>
                  )}
                </div>
              </div>
              
              {/* Mobile controls - visible on mobile/tablet */}
              <div className="flex lg:hidden items-center space-x-2">
                {canCreateTask && (
                <TaskCreationDialog onTaskCreated={handleTaskCreated}>
                  <Button size="sm" className="flex items-center gap-1 px-2">
                    <PlusIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">Add Task</span>
                  </Button>
                </TaskCreationDialog>
                )}
                {canViewKanban && (
                <a
                  href="/kanban"
                  className="text-sm text-muted-foreground hover:text-foreground px-2"
                >
                  Kanban
                </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Zoom Controls - Collapsible */}
        <div className="lg:hidden border-b bg-muted/30">
          <div className="container px-4 py-3">
            <div className="flex flex-col space-y-3">
              {/* View Range Controls */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">View Range:</span>
                <div className="flex rounded-md border">
                  {zoomRangeOptions.map((option) => {
                    const Icon = option.icon;
                    return (
                      <Button
                        key={option.value}
                        variant={zoomRange === option.value ? "default" : "ghost"}
                        size="sm"
                        onClick={() => handleZoomRangeChange(option.value)}
                        className="h-8 px-2 text-xs"
                        title={option.description}
                      >
                        <Icon className="h-3 w-3 sm:mr-1" />
                        <span className="hidden sm:inline">{option.label}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>
              
              {/* Zoom Level Controls */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Zoom Level:</span>
                <div className="flex rounded-md border">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const currentIndex = zoomLevelOptions.indexOf(zoomLevel);
                      if (currentIndex > 0) {
                        handleZoomLevelChange(zoomLevelOptions[currentIndex - 1]);
                      }
                    }}
                    disabled={zoomLevel === 25}
                    className="h-8 px-2"
                    title="Zoom out"
                  >
                    <ZoomOut className="h-3 w-3" />
                  </Button>
                  <div className="flex items-center px-2 text-xs text-muted-foreground border-x min-w-[3rem] justify-center">
                    {zoomLevel}%
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const currentIndex = zoomLevelOptions.indexOf(zoomLevel);
                      if (currentIndex < zoomLevelOptions.length - 1) {
                        handleZoomLevelChange(zoomLevelOptions[currentIndex + 1]);
                      }
                    }}
                    disabled={zoomLevel === 200}
                    className="h-8 px-2"
                    title="Zoom in"
                  >
                    <ZoomIn className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              
              {/* Additional Mobile Actions */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Actions:</span>
                <div className="flex items-center space-x-2">
                  <GroupManagementDialog />
                  <PeopleManagementDialog />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - Responsive */}
        <div className="container mx-auto p-4 lg:p-6">
          <ClientOnly fallback={<div className="h-[calc(100vh-12rem)] lg:h-[calc(100vh-8rem)] flex items-center justify-center">Loading Gantt Chart...</div>}>
            <GanttChart 
              key={refreshKey} 
              range={zoomRange} 
              zoom={zoomLevel} 
            />
          </ClientOnly>

          {/* Legend - Responsive */}
          <div className="mt-4 lg:mt-6 rounded-lg border bg-card p-4">
            <h3 className="mb-4 text-lg font-semibold">Legend</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 lg:flex lg:flex-wrap lg:gap-4">
              {statuses.map(status => (
                <div key={status.id} className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: status.color }}
                  />
                  <span className="text-sm truncate">{status.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}

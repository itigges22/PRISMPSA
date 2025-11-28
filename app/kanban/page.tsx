'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  KanbanBoard,
  KanbanCard,
  KanbanCards,
  KanbanHeader,
  KanbanProvider,
} from '@/components/ui/shadcn-io/kanban';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PlusIcon, Clock } from 'lucide-react';
import { supabaseTaskService, kanbanColumns, type Task } from '@/lib/supabase-task-service';
import ClientOnly from '@/components/client-only';
import TaskCreationDialog from '@/components/task-creation-dialog';
import GroupManagementDialog from '@/components/group-management-dialog';
import PeopleManagementDialog from '@/components/people-management-dialog';
import { RoleGuard } from '@/components/role-guard';
import { Permission } from '@/lib/permissions';
import { useAuth } from '@/lib/hooks/useAuth';
import { hasPermission } from '@/lib/rbac';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

export default function KanbanPage() {
  const { userProfile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [canCreateTask, setCanCreateTask] = useState(false);
  const [canViewGantt, setCanViewGantt] = useState(false);
  const [canEditKanban, setCanEditKanban] = useState(false);
  const [canMoveAllKanbanItems, setCanMoveAllKanbanItems] = useState(false);

  // Check permissions
  useEffect(() => {
    if (!userProfile) return;
    
    async function checkPermissions() {
      const canCreate = await hasPermission(userProfile, Permission.CREATE_TASK);
      const canView = await hasPermission(userProfile, Permission.VIEW_GANTT);
      const canEdit = await hasPermission(userProfile, Permission.EDIT_KANBAN_LAYOUT);
      const moveAll = await hasPermission(userProfile, Permission.MOVE_ALL_KANBAN_ITEMS);
      setCanCreateTask(canCreate);
      setCanViewGantt(canView);
      setCanEditKanban(canEdit);
      setCanMoveAllKanbanItems(moveAll);
    }
    
    checkPermissions();
  }, [userProfile]);

  // Load tasks on component mount
  useEffect(() => {
    const loadTasks = async () => {
      try {
        setLoading(true);
        const tasksData = await supabaseTaskService.getAllTasks();
        setTasks(tasksData);
      } catch (error) {
        console.error('Error loading tasks:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTasks();
  }, []);

  const handleDataChange = async (newTasks: Task[]) => {
    setTasks(newTasks);
    // Update tasks in Supabase - handle status changes
    for (const task of newTasks) {
      try {
        const result = await supabaseTaskService.updateTask({
          id: task.id,
          statusId: task.column,
        });
        
        if (!result) {
          // Task update failed (likely not in database yet)
        }
      } catch (error) {
        console.error('Error updating task:', error);
      }
    }
  };

  const handleTaskCreated = (newTask: Task) => {
    setTasks(prev => [...prev, newTask]);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (await supabaseTaskService.deleteTask(taskId)) {
      setTasks(tasks.filter(task => task.id !== taskId));
    }
  };

  return (
    <RoleGuard requirePermission={Permission.VIEW_KANBAN}>
      <div className="min-h-screen bg-background">
        {/* Header - Responsive */}
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 max-w-screen-2xl items-center px-4">
            <div className="mr-4 flex">
              <Link className="mr-6 flex items-center space-x-2" href="/">
                <span className="hidden font-bold sm:inline-block">Project Kanban Board</span>
                <span className="font-bold sm:hidden">Kanban</span>
              </Link>
            </div>
            <div className="flex flex-1 items-center justify-between space-x-2">
              <div className="w-full flex-1 md:w-auto md:flex-none">
                <h1 className="text-lg font-semibold truncate">Project Management</h1>
              </div>
              <div className="flex items-center space-x-2">
                {canViewGantt && (
                <a
                  href="/gantt"
                  className="text-sm text-muted-foreground hover:text-foreground px-2"
                >
                  <span className="hidden sm:inline">View Gantt Chart</span>
                  <span className="sm:hidden">Gantt</span>
                </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - Responsive */}
        <div className="container mx-auto p-4 lg:p-6">
          {/* Header Section - Responsive */}
          <div className="mb-4 lg:mb-6">
            <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
              <div className="flex-1">
                <h2 className="text-xl lg:text-2xl font-bold">Project Tasks</h2>
                <p className="text-sm lg:text-base text-muted-foreground mt-1">
                  Manage your project tasks with drag-and-drop functionality
                </p>
              </div>
              <div className="flex items-center space-x-2 flex-wrap gap-2">
                {canCreateTask && (
                <TaskCreationDialog onTaskCreated={handleTaskCreated}>
                  <Button size="sm" className="flex items-center gap-2 w-full sm:w-auto">
                    <PlusIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">Add Task</span>
                    <span className="sm:hidden">Add</span>
                  </Button>
                </TaskCreationDialog>
                )}
                <div className="flex items-center space-x-1">
                  <GroupManagementDialog />
                  <PeopleManagementDialog />
                </div>
              </div>
            </div>
          </div>

          {/* Kanban Board - Responsive */}
          <div className="h-[calc(100vh-16rem)] lg:h-[calc(100vh-12rem)] overflow-hidden">
            <ClientOnly fallback={<div className="h-full flex items-center justify-center">Loading Kanban Board...</div>}>
              <KanbanProvider
                columns={kanbanColumns}
                data={tasks as any}
                onDataChange={canEditKanban ? handleDataChange as any : undefined}
                className="h-full overflow-x-auto"
              >
                {(column) => (
                  <KanbanBoard id={column.id} key={column.id} className="min-w-[280px] lg:min-w-[320px]">
                    <KanbanHeader className="p-3 lg:p-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: column.color }}
                        />
                        <span className="font-medium text-sm lg:text-base truncate">{column.name}</span>
                        <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                          {tasks.filter(task => task.column === column.id).length}
                        </span>
                      </div>
                    </KanbanHeader>
                    <KanbanCards id={column.id} className="p-2 lg:p-3 space-y-2">
                      {(task: any) => {
                        // Check if user can move this task
                        // If canMoveAllKanbanItems is true, user can move all tasks
                        // Otherwise, user can only move tasks assigned to them
                        const isTaskAssignedToUser = task.assigned_to === userProfile?.id;
                        const canMoveThisTask = canMoveAllKanbanItems || isTaskAssignedToUser;
                        const isDisabled = !canEditKanban || !canMoveThisTask;
                        
                        return (
                        <KanbanCard
                          column={column.id}
                          id={task.id}
                          key={task.id}
                          name={task.name}
                          className={`p-3 lg:p-4 touch-manipulation select-none ${!canMoveThisTask ? 'opacity-50' : ''}`}
                          disabled={isDisabled}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-col gap-2 flex-1 min-w-0">
                              <p className="m-0 font-medium text-sm lg:text-base line-clamp-2">
                                {task.name}
                              </p>
                              {task.description && (
                                <p className="m-0 text-xs text-muted-foreground line-clamp-2">
                                  {task.description}
                                </p>
                              )}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                    task.priority === 'high'
                                      ? 'bg-red-100 text-red-800'
                                      : task.priority === 'medium'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-green-100 text-green-800'
                                  }`}
                                >
                                  {task.priority}
                                </span>
                                <span className="text-xs text-muted-foreground truncate">
                                  {task.group.name}
                                </span>
                              </div>
                              {/* Estimated & Remaining Hours */}
                              {(task.estimated_hours || task.remaining_hours) && (
                                <div className="flex items-center gap-2 text-xs">
                                  <Clock className="h-3 w-3 text-muted-foreground" />
                                  {task.estimated_hours && (
                                    <span className="text-muted-foreground">
                                      {task.estimated_hours}h est
                                    </span>
                                  )}
                                  {task.remaining_hours !== null && task.remaining_hours !== undefined && (
                                    <span className="text-blue-600 font-medium">
                                      {task.remaining_hours}h left
                                      {task.estimated_hours && task.estimated_hours > 0 && (
                                        <span className="text-muted-foreground font-normal ml-1">
                                          ({Math.round((1 - task.remaining_hours / task.estimated_hours) * 100)}%)
                                        </span>
                                      )}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            {task.owner && (
                              <Avatar className="h-6 w-6 lg:h-8 lg:w-8 shrink-0">
                                <AvatarImage src={task.owner.image} />
                                <AvatarFallback className="text-xs">
                                  {task.owner.name?.slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                            )}
                          </div>
                          <p className="m-0 text-muted-foreground text-xs mt-2">
                            <span className="hidden sm:inline">
                              {shortDateFormatter.format(task.startAt)} - {dateFormatter.format(task.endAt)}
                            </span>
                            <span className="sm:hidden">
                              {shortDateFormatter.format(task.startAt)} - {shortDateFormatter.format(task.endAt)}
                            </span>
                          </p>
                          {task.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {task.tags.slice(0, 2).map((tag: any, index: number) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800"
                                >
                                  {tag}
                                </span>
                              ))}
                              {task.tags.length > 2 && (
                                <span className="text-xs text-muted-foreground">
                                  +{task.tags.length - 2}
                                </span>
                              )}
                            </div>
                          )}
                        </KanbanCard>
                        );
                      }}
                    </KanbanCards>
                  </KanbanBoard>
                )}
              </KanbanProvider>
            </ClientOnly>
          </div>

          {/* Statistics - Responsive */}
          <div className="mt-4 lg:mt-6 rounded-lg border bg-card p-4">
            <h3 className="mb-4 text-lg font-semibold">Task Statistics</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4">
              {kanbanColumns.map((column) => {
                const count = tasks.filter(task => task.column === column.id).length;
                return (
                  <div key={column.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                    <div
                      className="h-3 w-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: column.color }}
                    />
                    <span className="text-sm truncate">{column.name}</span>
                    <span className="ml-auto text-sm font-medium">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}

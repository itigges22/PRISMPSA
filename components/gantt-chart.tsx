'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { addDays } from 'date-fns';
import {
  GanttProvider,
  GanttHeader,
  GanttSidebar,
  GanttSidebarGroup,
  GanttSidebarItem,
  GanttTimeline,
  GanttFeatureList,
  GanttFeatureListGroup,
  GanttFeatureItem,
  GanttToday,
  GanttMarker,
  GanttCreateMarkerTrigger,
  type GanttFeature,
  type GanttStatus,
  type GanttMarkerProps,
} from '@/components/ui/shadcn-io/gantt';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { EyeIcon, LinkIcon, TrashIcon, Calendar, User, Tag, AlertCircle, Edit, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { supabaseTaskService, type Task, type Milestone } from '@/lib/supabase-task-service';
import TaskCreationDialog from '@/components/task-creation-dialog';
import MilestoneCreationDialog from '@/components/milestone-creation-dialog';
import TaskEditDialog from '@/components/task-edit-dialog';

// Convert Task to GanttFeature
const convertTaskToGanttFeature = (task: Task): GanttFeature => ({
  id: task.id,
  name: task.name,
  startAt: task.startAt,
  endAt: task.endAt,
  status: task.status,
  lane: task.lane,
});

// Create expandable task detail component for sidebar
const TaskDetailExpansion = ({ task, isExpanded, onEdit, onRemove }: { task: Task; isExpanded: boolean; onEdit: (task: Task) => void; onRemove: (taskId: string) => void }) => {
  return (
    <div 
      className={`ml-4 mt-1 p-3 bg-muted/30 rounded border-l-2 text-xs transition-all duration-300 ease-in-out overflow-hidden ${
        isExpanded 
          ? 'max-h-96 opacity-100 transform translate-y-0' 
          : 'max-h-0 opacity-0 transform -translate-y-2'
      }`} 
      style={{ borderLeftColor: task.status.color }}
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-medium text-xs">{task.name}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit(task)}
              className="flex items-center gap-1 px-1.5 py-0.5 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
            >
              <Edit className="w-2.5 h-2.5" />
              Edit
            </button>
            <button
              onClick={() => onRemove(task.id)}
              className="flex items-center gap-1 px-1.5 py-0.5 text-xs bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 transition-colors"
            >
              <TrashIcon className="w-2.5 h-2.5" />
              Remove
            </button>
          </div>
        </div>
        
        {task.description && (
          <div className="text-xs text-muted-foreground line-clamp-2">
            {task.description}
          </div>
        )}
        
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <div 
              className="w-1.5 h-1.5 rounded-full" 
              style={{ backgroundColor: task.status.color }}
            />
            <span className="text-xs">{task.status.name}</span>
          </div>
          
          <div className="flex items-center gap-1.5">
            <User className="w-2.5 h-2.5" />
            <span className="text-xs">{task.owner.name}</span>
          </div>
          
          <div className="flex items-center gap-1.5">
            <Calendar className="w-2.5 h-2.5" />
            <span className="text-xs">
              {task.startAt.toLocaleDateString()} - {task.endAt.toLocaleDateString()}
            </span>
          </div>
          
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-2.5 h-2.5" />
            <span className="text-xs capitalize">{task.priority} priority</span>
          </div>

          {/* Estimated & Remaining Hours */}
          {(task.estimated_hours || task.remaining_hours) && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-2.5 h-2.5" />
              <span className="text-xs">
                {task.estimated_hours && `${task.estimated_hours}h est`}
                {task.estimated_hours && task.remaining_hours !== null && task.remaining_hours !== undefined && ' | '}
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
              </span>
            </div>
          )}
        </div>

        {task.tags && task.tags.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Tag className="w-2.5 h-2.5" />
            <div className="flex flex-wrap gap-0.5">
              {task.tags.slice(0, 3).map((tag, index) => (
                <span 
                  key={index}
                  className="bg-secondary text-secondary-foreground px-1 py-0.5 rounded text-xs"
                >
                  {tag}
                </span>
              ))}
              {task.tags.length > 3 && (
                <span className="text-xs text-muted-foreground">+{task.tags.length - 3}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


// Sample markers
const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth();

const initialMarkers: GanttMarkerProps[] = [
  {
    id: 'milestone-1',
    date: new Date(currentYear, currentMonth, 15),
    label: 'Phase 1 Complete',
  },
  {
    id: 'milestone-2',
    date: new Date(currentYear, currentMonth + 1, 15),
    label: 'Phase 2 Complete',
  },
  {
    id: 'milestone-3',
    date: new Date(currentYear, currentMonth + 1, 25),
    label: 'Release Candidate',
  },
];

type GanttChartProps = {
  range?: 'daily' | 'monthly' | 'quarterly' | 'yearly';
  zoom?: number;
};

export default function GanttChart({ range = 'monthly', zoom = 100 }: GanttChartProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [markers, setMarkers] = useState<GanttMarkerProps[]>(initialMarkers);
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);
  const [milestoneDate, setMilestoneDate] = useState<Date>(new Date());
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);

  // Load tasks and milestones on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [tasksData, milestonesData] = await Promise.all([
          supabaseTaskService.getAllTasks(),
          supabaseTaskService.getAllMilestones()
        ]);
        setTasks(tasksData);
        setMilestones(milestonesData);
        console.log('Loaded milestones for rendering:', milestonesData);
        console.log('Number of milestones loaded:', milestonesData.length);
        console.log('Milestone details:', milestonesData.map(m => ({ name: m.name, date: m.date, color: m.color })));
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);


  // Convert tasks to Gantt features (milestones will be handled as markers)
  const features: GanttFeature[] = tasks.map(convertTaskToGanttFeature);
  
  // Debug logging for features
  useEffect(() => {
    console.log('Features updated:', features.length, 'features');
    console.log('Feature details:', features.map(f => ({ id: f.id, name: f.name, startAt: f.startAt })));
  }, [features]);


  // Group features by lane (which corresponds to group name from tasks)
  const groupedFeatures = features.reduce((acc, feature) => {
    const groupName = feature.lane || 'General';
    if (!acc[groupName]) {
      acc[groupName] = [];
    }
    acc[groupName].push(feature);
    return acc;
  }, {} as Record<string, GanttFeature[]>);

  // Sort groups alphabetically
  const sortedGroupedFeatures = Object.fromEntries(
    Object.entries(groupedFeatures).sort(([nameA], [nameB]) =>
      nameA.localeCompare(nameB)
    )
  );

  const handleViewFeature = (id: string) => {
    console.log(`Feature selected: ${id}`);
    setSelectedFeature(selectedFeature === id ? null : id);
  };

  const handleTaskHover = (id: string | null) => {
    setHoveredTask(id);
  };

  const handleEditTask = (task: Task) => {
    setTaskToEdit(task);
    setEditDialogOpen(true);
  };

  const handleTaskUpdated = async (updatedTask: Task) => {
    setTasks(prev => prev.map(task => task.id === updatedTask.id ? updatedTask : task));
    setEditDialogOpen(false);
    setTaskToEdit(null);
  };

  const handleCopyLink = (id: string) => {
    console.log(`Copy link: ${id}`);
    navigator.clipboard.writeText(`${window.location.origin}/gantt#${id}`);
  };


  const handleRemoveMarker = async (id: string) => {
    // Check if it's a milestone marker
    if (id.startsWith('milestone-')) {
      const milestoneId = id.replace('milestone-', '');
      try {
        await supabaseTaskService.deleteMilestone(milestoneId);
        // Reload milestones to update the display
        const milestonesData = await supabaseTaskService.getAllMilestones();
        setMilestones(milestonesData);
      } catch (error) {
        console.error('Error deleting milestone:', error);
      }
    } else {
      // Handle regular markers
      setMarkers(prev => prev.filter(marker => marker.id !== id));
    }
  };

  const handleRemoveFeature = async (id: string) => {
    // Handle regular tasks only (milestones are handled by handleRemoveMarker)
    if (await supabaseTaskService.deleteTask(id)) {
      setTasks(prev => prev.filter(task => task.id !== id));
    }
  };

  const handleCreateMarker = (date: Date) => {
    // Open the milestone creation dialog with the selected date
    setMilestoneDate(date);
    setMilestoneDialogOpen(true);
  };

  const handleMilestoneCreated = async (newMilestone: Milestone) => {
    console.log('Milestone created:', newMilestone);
    // Add the new milestone to the current state immediately for instant UI update
    setMilestones(prev => [...prev, newMilestone]);
    
    // Also reload from database to ensure we have the latest data
    try {
      const milestonesData = await supabaseTaskService.getAllMilestones();
      setMilestones(milestonesData);
    } catch (error) {
      console.error('Error reloading milestones after creation:', error);
    }
  };

  const handleMoveFeature = async (id: string, startAt: Date, endAt: Date | null) => {
    if (!endAt) {
      return;
    }
    
    const updatedTask = await supabaseTaskService.updateTaskDates(id, startAt, endAt);
    if (updatedTask) {
      setTasks(prev =>
        prev.map(task => task.id === id ? updatedTask : task)
      );
    }
  };

  const handleTaskCreated = (newTask: Task) => {
    console.log('Task created:', newTask);
    console.log('Current tasks before adding:', tasks.length);
    
    // Add the new task to the current state immediately for instant UI update
    setTasks(prev => {
      console.log('Adding task to state, previous count:', prev.length);
      const updated = [...prev, newTask];
      console.log('New task count:', updated.length);
      return updated;
    });
    
    // Also reload from database to ensure we have the latest data
    const loadTasks = async () => {
      try {
        const tasksData = await supabaseTaskService.getAllTasks();
        console.log('Reloaded tasks from database:', tasksData.length);
        setTasks(tasksData);
      } catch (error) {
        console.error('Error reloading tasks after creation:', error);
      }
    };
    loadTasks();
  };

  // Function to scroll to today's date using the same mechanism as task clicking
  const scrollToToday = useCallback(() => {
    const today = new Date();
    
    // Create a temporary feature at today's date to use the existing scrollToFeature function
    const todayFeature: GanttFeature = {
      id: 'today-marker',
      name: 'Today',
      startAt: today,
      endAt: today,
      status: { id: 'today', name: 'Today', color: '#10b981' },
      lane: 'Today'
    };

    // Use the scrollToFeature function by simulating a click on a task
    // Find the Gantt container and trigger a click on a sidebar item
    const ganttContainer = document.querySelector('.gantt');
    if (ganttContainer) {
      const sidebarItems = ganttContainer.querySelectorAll('[data-roadmap-ui="gantt-sidebar"] [role="button"]');
      if (sidebarItems.length > 0) {
        // Simulate a click on the first sidebar item to trigger scrollToFeature
        (sidebarItems[0] as HTMLElement).click();
        console.log('Triggered scroll to today via sidebar click simulation');
      }
    }
    
    console.log('Scrolling to today using task scroll mechanism:', {
      today: today.toDateString(),
      range,
      zoom,
      feature: todayFeature
    });
  }, [range, zoom]);

  // Scroll to today when component loads
  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        scrollToToday();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [loading, scrollToToday]);

  // Scroll to today when range or zoom changes
  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        // Check if the Gantt container exists and has content
        const ganttContainer = document.querySelector('.gantt');
        if (ganttContainer && ganttContainer.scrollWidth > 0) {
          scrollToToday();
        } else {
          // If not ready, try again after a longer delay
          setTimeout(() => {
            scrollToToday();
          }, 200);
        }
      }, 300); // Longer delay to ensure the chart has fully re-rendered
      
      return () => clearTimeout(timer);
    }
  }, [range, zoom, scrollToToday]);

  return (
    <div className="h-[calc(100vh-12rem)] lg:h-[calc(100vh-8rem)] overflow-hidden">
      <GanttProvider
        range={range}
        zoom={zoom}
        className="h-full border rounded-lg overflow-x-auto"
      >
        <GanttSidebar className="min-w-[200px] lg:min-w-[250px] max-w-[300px]">
          {Object.entries(sortedGroupedFeatures).map(([group, groupFeatures]) => (
            <GanttSidebarGroup key={group} name={group}>
              {groupFeatures.map(feature => {
                const task = tasks.find(t => t.id === feature.id);
                const isHovered = hoveredTask === feature.id;
                
                return (
                  <div 
                    key={feature.id}
                    onMouseEnter={() => handleTaskHover(feature.id)}
                    onMouseLeave={() => handleTaskHover(null)}
                    className="transition-all duration-200 ease-in-out"
                  >
                    <GanttSidebarItem
                      feature={feature}
                      onSelectItem={handleViewFeature}
                      className={`transition-all duration-200 ease-in-out hover:bg-muted/50 ${
                        selectedFeature === feature.id
                          ? 'bg-accent'
                          : undefined
                      }`}
                    />
                    {/* Expandable task details in sidebar - hidden on mobile for better UX */}
                    {task && isHovered && (
                      <div className="hidden lg:block">
                        <TaskDetailExpansion
                          task={task}
                          isExpanded={true}
                          onEdit={handleEditTask}
                          onRemove={handleRemoveFeature}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </GanttSidebarGroup>
          ))}
        </GanttSidebar>
        <GanttTimeline className="overflow-x-auto">
          <GanttHeader />
          <GanttFeatureList>
            {Object.entries(sortedGroupedFeatures).map(([group, groupFeatures]) => (
              <GanttFeatureListGroup key={`feature-group-${group}`}>
                {groupFeatures.map(feature => {
                  // Find the corresponding task to get owner info
                  const task = tasks.find(t => t.id === feature.id);
                  
                  return (
                    <div className="flex" key={feature.id}>
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <button
                            onClick={() => handleViewFeature(feature.id)}
                            type="button"
                            className="w-full"
                          >
                            <GanttFeatureItem
                              onMove={handleMoveFeature}
                              {...feature}
                            >
                              <div 
                                className="flex-1 truncate text-xs rounded-md p-1 text-white transition-all duration-200 ease-in-out hover:shadow-md hover:scale-[1.02] min-w-[100px]"
                                style={{
                                  backgroundColor: feature.status.color,
                                }}
                              >
                                <span className="block truncate">{feature.name}</span>
                              </div>
                              {task?.owner && (
                                <Avatar className="h-4 w-4 flex-shrink-0 hidden sm:block">
                                  <AvatarImage src={task.owner.image} />
                                  <AvatarFallback>
                                    {task.owner.name?.slice(0, 2)}
                                  </AvatarFallback>
                                </Avatar>
                              )}
                            </GanttFeatureItem>
                          </button>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem
                            className="flex items-center gap-2"
                            onClick={() => handleViewFeature(feature.id)}
                          >
                            <EyeIcon className="text-muted-foreground" size={16} />
                            View feature
                          </ContextMenuItem>
                          <ContextMenuItem
                            className="flex items-center gap-2"
                            onClick={() => handleCopyLink(feature.id)}
                          >
                            <LinkIcon className="text-muted-foreground" size={16} />
                            Copy link
                          </ContextMenuItem>
                          <ContextMenuItem
                            className="flex items-center gap-2 text-destructive"
                            onClick={() => handleRemoveFeature(feature.id)}
                          >
                            <TrashIcon size={16} />
                            Remove from roadmap
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    </div>
                  );
                })}
              </GanttFeatureListGroup>
            ))}
          </GanttFeatureList>
          {/* Regular markers */}
          {markers.map(marker => (
            <div
              key={marker.id}
              className="absolute top-0 h-full w-0.5 bg-blue-500 z-10 cursor-pointer hover:bg-blue-600"
              style={{
                left: `calc(var(--gantt-column-width) * ${Math.floor((marker.date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))}px)`,
              }}
              onClick={() => handleRemoveMarker(marker.id)}
            >
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap hover:bg-blue-600">
                {marker.label}
              </div>
            </div>
          ))}


          {/* Milestone markers */}
          {milestones.map((milestone, index) => {
            console.log('Rendering milestone marker:', milestone.name, 'at date:', milestone.date, 'with color:', milestone.color);
            return (
              <div
                key={`milestone-${milestone.id}`}
                style={{
                  '--milestone-bg': milestone.color,
                  '--milestone-border': milestone.color
                } as React.CSSProperties}
              >
                <GanttMarker
                  id={`milestone-${milestone.id}`}
                  date={milestone.date}
                  label={milestone.name}
                  className="milestone-marker"
                  onRemove={handleRemoveMarker}
                />
              </div>
            );
          })}
          <GanttToday 
            className="bg-green-200 text-green-800 border-green-300" 
            data-gantt-today="true"
          />
          <GanttCreateMarkerTrigger onCreateMarker={handleCreateMarker} />
        </GanttTimeline>
      </GanttProvider>
      
      <MilestoneCreationDialog
        open={milestoneDialogOpen}
        onOpenChange={setMilestoneDialogOpen}
        date={milestoneDate}
        onMilestoneCreated={handleMilestoneCreated}
      />
      
      <TaskEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        task={taskToEdit}
        onTaskUpdated={handleTaskUpdated}
      />
    </div>
  );
}
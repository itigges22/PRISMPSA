'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Clock,
  CheckSquare,
  Workflow,
  Building2,
  Users,
  BarChart3,
  FolderKanban,
  Loader2,
  RotateCcw,
  PieChart,
  TrendingUp,
  CalendarClock,
  Activity,
} from 'lucide-react';

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

interface CustomizeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preferences: DashboardPreferences | null;
  onSave: (preferences: DashboardPreferences) => Promise<void>;
  onReset: () => Promise<void>;
}

const WIDGET_INFO: Record<string, { label: string; icon: React.ElementType; description: string }> = {
  'projects': {
    label: 'My Projects',
    icon: FolderKanban,
    description: 'View and manage your assigned projects',
  },
  'capacity': {
    label: 'Capacity Chart',
    icon: BarChart3,
    description: 'Visual capacity trend over time',
  },
  'time': {
    label: 'My Time',
    icon: Clock,
    description: 'Track your logged hours this week',
  },
  'tasks': {
    label: 'My Tasks',
    icon: CheckSquare,
    description: 'View upcoming tasks and deadlines',
  },
  'workflows': {
    label: 'My Workflows',
    icon: Workflow,
    description: 'Track workflow approvals and progress',
  },
  'accounts': {
    label: 'My Accounts',
    icon: Building2,
    description: 'View accounts you are working with',
  },
  'collaborators': {
    label: 'My Collaborators',
    icon: Users,
    description: 'See who you are working with',
  },
  'time-by-project': {
    label: 'Time by Project',
    icon: PieChart,
    description: 'Pie chart of hours per project this week',
  },
  'task-trend': {
    label: 'Task Trend',
    icon: TrendingUp,
    description: 'Task completion trend over 4 weeks',
  },
  'deadlines': {
    label: 'Upcoming Deadlines',
    icon: CalendarClock,
    description: 'Tasks with upcoming due dates',
  },
  'activity': {
    label: 'Recent Activity',
    icon: Activity,
    description: 'Your recent activity feed',
  },
};

// Default widget configuration - used when no preferences exist
const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'projects', type: 'projects', visible: true, order: 0, size: 'full' },
  { id: 'capacity', type: 'capacity', visible: true, order: 1, size: 'full' },
  { id: 'time', type: 'time', visible: true, order: 2, size: 'small' },
  { id: 'tasks', type: 'tasks', visible: true, order: 3, size: 'small' },
  { id: 'workflows', type: 'workflows', visible: true, order: 4, size: 'small' },
  { id: 'accounts', type: 'accounts', visible: true, order: 5, size: 'medium' },
  { id: 'collaborators', type: 'collaborators', visible: true, order: 6, size: 'medium' },
  { id: 'time-by-project', type: 'time-by-project', visible: true, order: 7, size: 'small' },
  { id: 'task-trend', type: 'task-trend', visible: true, order: 8, size: 'small' },
  { id: 'deadlines', type: 'deadlines', visible: true, order: 9, size: 'small' },
  { id: 'activity', type: 'activity', visible: true, order: 10, size: 'full' },
];

// Sortable Widget Item
function SortableWidgetItem({
  widget,
  onToggle,
}: {
  widget: WidgetConfig;
  onToggle: (id: string, visible: boolean) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const info = WIDGET_INFO[widget.type] || {
    label: widget.type,
    icon: FolderKanban,
    description: '',
  };
  const Icon = info.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid="widget-option"
      className={`flex items-center gap-3 p-3 rounded-lg border ${
        widget.visible ? 'bg-background border-border' : 'bg-muted/50 border-muted'
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none p-1 hover:bg-muted rounded"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>

      <div className={`p-2 rounded-md ${widget.visible ? 'bg-primary/10' : 'bg-muted'}`}>
        <Icon className={`h-4 w-4 ${widget.visible ? 'text-primary' : 'text-muted-foreground'}`} />
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${!widget.visible && 'text-muted-foreground'}`}>
          {info.label}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {info.description}
        </p>
      </div>

      <Switch
        checked={widget.visible}
        onCheckedChange={(checked) => onToggle(widget.id, checked)}
      />
    </div>
  );
}

export function CustomizeModal({
  open,
  onOpenChange,
  preferences,
  onSave,
  onReset,
}: CustomizeModalProps) {
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Initialize widgets from preferences or use defaults
  useEffect(() => {
    // Use preferences widgets if available, otherwise use defaults
    const widgetSource = preferences?.widgets && preferences.widgets.length > 0
      ? preferences.widgets
      : DEFAULT_WIDGETS;

    // Sort by order
    const sorted = [...widgetSource].sort((a, b) => a.order - b.order);
    setWidgets(sorted);
  }, [preferences]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px drag before activation
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setWidgets((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);

        const newItems = arrayMove(items, oldIndex, newIndex);
        // Update order values
        return newItems.map((item, index) => ({
          ...item,
          order: index,
        }));
      });
    }
  };

  const handleToggle = (id: string, visible: boolean) => {
    setWidgets((items) =>
      items.map((item) =>
        item.id === id ? { ...item, visible } : item
      )
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        widgets,
        theme: preferences?.theme || 'comfortable',
      });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await onReset();
      onOpenChange(false);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Customize Dashboard</DialogTitle>
          <DialogDescription>
            Drag to reorder widgets and toggle visibility. Changes are saved immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 -mx-6 px-6">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={widgets.map((w) => w.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {widgets.map((widget) => (
                  <SortableWidgetItem
                    key={widget.id}
                    widget={widget}
                    onToggle={handleToggle}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        <DialogFooter className="flex-shrink-0 gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={isSaving || isResetting}
            className="mr-auto"
          >
            {isResetting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4 mr-2" />
            )}
            Reset to Defaults
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isResetting}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CustomizeModal;

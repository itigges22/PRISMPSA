'use client';

import type {
  Announcements,
  DndContextProps,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  closestCenter,
  closestCorners,
  rectIntersection,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import React, {
  createContext,
  type HTMLAttributes,
  type ReactNode,
  useContext,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import tunnel from 'tunnel-rat';
import { Card } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const t = tunnel();

export type { DragEndEvent } from '@dnd-kit/core';

type KanbanItemProps = {
  id: string;
  name: string;
  column: string;
} & Record<string, unknown>;

type KanbanColumnProps = {
  id: string;
  name: string;
} & Record<string, unknown>;

type KanbanContextProps<
  T extends KanbanItemProps = KanbanItemProps,
  C extends KanbanColumnProps = KanbanColumnProps,
> = {
  columns: C[];
  data: T[];
  activeCardId: string | null;
};

const KanbanContext = createContext<KanbanContextProps>({
  columns: [],
  data: [],
  activeCardId: null,
});

export type KanbanBoardProps = {
  id: string;
  children: ReactNode;
  className?: string;
};

export const KanbanBoard = ({ id, children, className }: KanbanBoardProps) => {
  const { isOver, setNodeRef } = useDroppable({
    id,
  });

  // Debug logging for droppable areas (can be removed in production)
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[KANBAN BOARD] ${id} - isOver:`, isOver);
    }
  }, [id, isOver]);

  return (
    <div
      className={cn(
        'flex size-full min-h-40 flex-col divide-y overflow-hidden rounded-md border bg-secondary text-xs shadow-sm ring-2 transition-all',
        isOver ? 'ring-primary' : 'ring-transparent',
        className
      )}
      ref={setNodeRef}
      onMouseEnter={() => process.env.NODE_ENV === 'development' && console.log(`[KANBAN BOARD] ${id} - mouse enter`)}
      onMouseLeave={() => process.env.NODE_ENV === 'development' && console.log(`[KANBAN BOARD] ${id} - mouse leave`)}
    >
      {children}
    </div>
  );
};

export type KanbanCardProps<T extends KanbanItemProps = KanbanItemProps> = T & {
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
};

export const KanbanCard = <T extends KanbanItemProps = KanbanItemProps>({
  id,
  name,
  children,
  className,
  disabled = false,
}: KanbanCardProps<T>) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transition,
    transform,
    isDragging,
  } = useSortable({
    id,
    disabled: disabled,
  });

  const { activeCardId } = useContext(KanbanContext) as KanbanContextProps;

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  };

  // Debug logging for drag listeners (can be removed in production)
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[KANBAN CARD] ${id} - listeners:`, listeners);
      console.log(`[KANBAN CARD] ${id} - disabled:`, disabled);
      console.log(`[KANBAN CARD] ${id} - attributes:`, attributes);
    }
  }, [id, listeners, disabled, attributes]);

  return (
    <>
      <div 
        style={style} 
        {...(disabled ? {} : listeners)} 
        {...attributes} 
        ref={setNodeRef}
        onMouseDown={(e) => {
          process.env.NODE_ENV === 'development' && console.log(`[KANBAN CARD] ${id} - mouse down event`);
          if (listeners?.onMouseDown) {
            listeners.onMouseDown(e);
          }
        }}
        onTouchStart={(e) => {
          process.env.NODE_ENV === 'development' && console.log(`[KANBAN CARD] ${id} - touch start event`);
          if (listeners?.onTouchStart) {
            listeners.onTouchStart(e);
          }
        }}
      >
        <Card
          className={cn(
            disabled ? 'cursor-not-allowed' : 'cursor-grab',
            'gap-4 rounded-md p-3 shadow-sm',
            isDragging && 'pointer-events-none cursor-grabbing opacity-30',
            disabled && 'opacity-60',
            className
          )}
        >
          {children ?? <p className="m-0 font-medium text-sm">{name}</p>}
        </Card>
      </div>
      {activeCardId === id && !disabled && (
        <t.In>
          <Card
            className={cn(
              'cursor-grab gap-4 rounded-md p-3 shadow-sm ring-2 ring-primary',
              isDragging && 'cursor-grabbing',
              className
            )}
          >
            {children ?? <p className="m-0 font-medium text-sm">{name}</p>}
          </Card>
        </t.In>
      )}
    </>
  );
};

export type KanbanCardsProps<T extends KanbanItemProps = KanbanItemProps> =
  Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'id'> & {
    children: (item: T) => ReactNode;
    id: string;
  };

export const KanbanCards = <T extends KanbanItemProps = KanbanItemProps>({
  children,
  className,
  ...props
}: KanbanCardsProps<T>) => {
  const { data } = useContext(KanbanContext) as KanbanContextProps<T>;
  const filteredData = data.filter((item) => item.column === props.id);

  return (
    <ScrollArea className="overflow-hidden">
      <div
        className={cn('flex flex-grow flex-col gap-2 p-2', className)}
        {...props}
      >
        {filteredData.map(children)}
      </div>
      <ScrollBar orientation="vertical" />
    </ScrollArea>
  );
};

export type KanbanHeaderProps = HTMLAttributes<HTMLDivElement>;

export const KanbanHeader = ({ className, ...props }: KanbanHeaderProps) => (
  <div className={cn('m-0 p-2 font-semibold text-sm', className)} {...props} />
);

export type KanbanProviderProps<
  T extends KanbanItemProps = KanbanItemProps,
  C extends KanbanColumnProps = KanbanColumnProps,
> = Omit<DndContextProps, 'children'> & {
  children: (column: C) => ReactNode;
  className?: string;
  columns: C[];
  data: T[];
  onDataChange?: (data: T[]) => void;
  onDragStart?: (event: DragStartEvent) => void;
  onDragEnd?: (event: DragEndEvent) => void;
  onDragOver?: (event: DragOverEvent) => void;
};

export const KanbanProvider = <
  T extends KanbanItemProps = KanbanItemProps,
  C extends KanbanColumnProps = KanbanColumnProps,
>({
  children,
  onDragStart,
  onDragEnd,
  onDragOver,
  className,
  columns,
  data,
  onDataChange,
  ...props
}: KanbanProviderProps<T, C>) => {
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  // Custom collision detection for Kanban
  const customCollisionDetection = (args: any) => {
    // First, try to find collisions with items
    const itemCollisions = closestCenter(args);
    
    // If we found item collisions, return them
    if (itemCollisions.length > 0) {
      return itemCollisions;
    }
    
    // Otherwise, try to find collisions with columns
    const columnCollisions = rectIntersection({
      ...args,
      droppableContainers: args.droppableContainers.filter((container: any) => 
        columns.some(col => col.id === container.id)
      )
    });
    
    return columnCollisions;
  };

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
    console.log('[KANBAN] Drag started:', {
      activeId: event.active.id,
      activeData: data.find((item) => item.id === event.active.id),
      allData: data,
      columns: columns
    });
    const card = data.find((item) => item.id === event.active.id);
    if (card) {
      setActiveCardId(event.active.id as string);
    }
    onDragStart?.(event);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    console.log('[KANBAN] Drag over:', {
      activeId: active.id,
      overId: over?.id,
      overData: over ? data.find((item) => item.id === over.id) : null,
      isColumn: over ? columns.find((col) => col.id === over.id) : null
    });
    
    onDragOver?.(event);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    console.log('[KANBAN] handleDragEnd called');
    setActiveCardId(null);
    onDragEnd?.(event);

    const { active, over } = event;
    console.log('[KANBAN] Drag ended:', {
      activeId: active.id,
      overId: over?.id,
      hasOver: !!over,
      overData: over ? data.find((item) => item.id === over.id) : null,
      isColumn: over ? columns.find((col) => col.id === over.id) : null,
      allColumns: columns.map(col => col.id)
    });

    if (!over) {
      console.log('[KANBAN] No target, skipping');
      return;
    }

    const activeItem = data.find((item) => item.id === active.id);
    const overItem = data.find((item) => item.id === over.id);
    
    if (!activeItem) {
      console.log('[KANBAN] Active item not found, skipping');
      return;
    }

    // If dropping on the same item, skip
    if (active.id === over.id) {
      console.log('[KANBAN] Same position, skipping');
      return;
    }

    const activeColumn = activeItem.column;
    const overColumn = overItem?.column || columns.find((col) => col.id === over.id)?.id;

    console.log('[KANBAN] Column analysis:', {
      activeColumn,
      overColumn,
      isColumnDrop: !overItem,
      isItemDrop: !!overItem,
      overId: over.id,
      columnIds: columns.map(col => col.id)
    });

    if (!overColumn) {
      console.log('[KANBAN] No valid target column found, skipping');
      return;
    }

    // If dropping on a column (not another item), handle column change
    if (!overItem) {
      if (activeColumn !== overColumn) {
        console.log('[KANBAN] Column drop detected, updating column');
        let newData = [...data];
        const activeIndex = newData.findIndex((item) => item.id === active.id);
        newData[activeIndex].column = overColumn;
        console.log('[KANBAN] Calling onDataChange from handleDragEnd (column drop)');
        onDataChange?.(newData);
      } else {
        console.log('[KANBAN] Column drop but same column, no change needed');
      }
      return;
    }

    // If dropping on another item, handle reordering
    if (activeColumn !== overColumn) {
      console.log('[KANBAN] Cross-column item drop detected');
      let newData = [...data];
      const activeIndex = newData.findIndex((item) => item.id === active.id);
      newData[activeIndex].column = overColumn;
      console.log('[KANBAN] Calling onDataChange from handleDragEnd (cross-column)');
      onDataChange?.(newData);
    } else {
      console.log('[KANBAN] Same column reorder detected');
      let newData = [...data];
      const oldIndex = newData.findIndex((item) => item.id === active.id);
      const newIndex = newData.findIndex((item) => item.id === over.id);
      newData = arrayMove(newData, oldIndex, newIndex);
      console.log('[KANBAN] Calling onDataChange from handleDragEnd (reorder)');
      onDataChange?.(newData);
    }
  };

  const announcements: Announcements = {
    onDragStart({ active }) {
      const { name, column } = data.find((item) => item.id === active.id) ?? {};
      return `Picked up the card "${name}" from the "${column}" column`;
    },
    onDragOver({ active, over }) {
      const { name } = data.find((item) => item.id === active.id) ?? {};
      const newColumn = columns.find((column) => column.id === over?.id)?.name;
      return `Dragged the card "${name}" over the "${newColumn}" column`;
    },
    onDragEnd({ active, over }) {
      const { name } = data.find((item) => item.id === active.id) ?? {};
      const newColumn = columns.find((column) => column.id === over?.id)?.name;
      return `Dropped the card "${name}" into the "${newColumn}" column`;
    },
    onDragCancel({ active }) {
      const { name } = data.find((item) => item.id === active.id) ?? {};
      return `Cancelled dragging the card "${name}"`;
    },
  };

  // Debug logging for DndContext initialization
  React.useEffect(() => {
    console.log('[KANBAN PROVIDER] Initialized with:', {
      columns: columns.map(col => ({ id: col.id, name: col.name })),
      data: data.map(item => ({ id: item.id, name: item.name, column: item.column })),
      sensorsCount: sensors.length
    });
  }, [columns, data, sensors]);

  return (
    <KanbanContext.Provider value={{ columns, data, activeCardId }}>
      <DndContext
        id="kanban-dnd-context"
        accessibility={{ announcements }}
        collisionDetection={customCollisionDetection}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragStart={handleDragStart}
        sensors={sensors}
        {...props}
      >
        <SortableContext items={data.map(item => item.id)}>
          <div
            className={cn(
              'grid size-full auto-cols-fr grid-flow-col gap-4',
              className
            )}
          >
            {columns.map((column) => children(column))}
          </div>
        </SortableContext>
        {typeof window !== 'undefined' &&
          createPortal(
            <DragOverlay>
              <t.Out />
            </DragOverlay>,
            document.body
          )}
      </DndContext>
    </KanbanContext.Provider>
  );
};
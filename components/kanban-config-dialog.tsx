'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { accountKanbanConfigService, KanbanColumn } from '@/lib/account-kanban-config';
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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
// import { toast } from 'sonner';

interface KanbanConfigDialogProps {
  accountId: string;
  currentColumns: KanbanColumn[];
  onColumnsUpdated: (columns: KanbanColumn[]) => void;
  children?: React.ReactNode;
}

interface SortableColumnItemProps {
  column: KanbanColumn;
  onUpdate: (columnId: string, field: keyof KanbanColumn, value: string | number) => void;
  onRemove: (columnId: string) => void;
  canRemove: boolean;
}

function SortableColumnItem({ column, onUpdate, onRemove, canRemove }: SortableColumnItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card 
      ref={setNodeRef} 
      style={style}
      className={`p-3 ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center gap-3">
        <div 
          {...attributes}
          {...listeners}
          className="cursor-grab hover:cursor-grabbing p-1 hover:bg-gray-100 rounded"
          title="Drag to reorder"
        >
          <GripVertical className="h-4 w-4 text-gray-400" />
        </div>
        <div className="flex items-center gap-2 flex-1">
          <div 
            className="w-4 h-4 rounded flex-shrink-0"
            style={{ backgroundColor: column.color }}
          />
          <Input
            value={column.name}
            onChange={(e) => onUpdate(column.id, 'name', e.target.value)}
            className="flex-1 min-w-0"
            placeholder="Column name"
          />
        </div>
        <Input
          type="color"
          value={column.color}
          onChange={(e) => onUpdate(column.id, 'color', e.target.value)}
          className="w-10 h-8 flex-shrink-0"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(column.id)}
          disabled={!canRemove}
          className="h-8 w-8 p-0 flex-shrink-0"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

export function KanbanConfigDialog({ 
  accountId, 
  currentColumns, 
  onColumnsUpdated,
  children 
}: KanbanConfigDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [columns, setColumns] = useState<KanbanColumn[]>(currentColumns);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnColor, setNewColumnColor] = useState('#6B7280');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    setColumns(currentColumns);
  }, [currentColumns]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setColumns((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        const newItems = arrayMove(items, oldIndex, newIndex);
        
        // Update the order property for each column
        return newItems.map((item, index) => ({
          ...item,
          order: index + 1,
        }));
      });
    }
  };

  const handleAddColumn = () => {
    if (!newColumnName.trim()) {
      return;
    }

    const newColumn: KanbanColumn = {
      id: newColumnName.toLowerCase().replace(/\s+/g, '-'),
      name: newColumnName.trim(),
      color: newColumnColor,
      order: columns.length + 1,
    };

    setColumns(prev => [...prev, newColumn]);
    setNewColumnName('');
    setNewColumnColor('#6B7280');
  };

  const handleRemoveColumn = (columnId: string) => {
    if (columns.length <= 1) {
      return;
    }
    setColumns(prev => {
      const filtered = prev.filter(col => col.id !== columnId);
      // Update the order property for remaining columns
      return filtered.map((item, index) => ({
        ...item,
        order: index + 1,
      }));
    });
  };

  const handleUpdateColumn = (columnId: string, field: keyof KanbanColumn, value: string | number) => {
    setColumns(prev => prev.map(col => 
      col.id === columnId ? { ...col, [field]: value } : col
    ));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      console.log('Attempting to save kanban config...');

      const response = await fetch(`/api/accounts/${accountId}/kanban-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columns })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        onColumnsUpdated(columns);
        setOpen(false);
        console.log('Kanban configuration updated successfully');
      } else {
        console.error('Failed to update kanban configuration:', result.error);
        alert(result.error || 'Failed to update kanban configuration');
      }
    } catch (error) {
      console.error('Error saving kanban config:', error);
      alert('An error occurred while saving kanban configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setColumns(currentColumns);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <GripVertical className="h-4 w-4 mr-2" />
            Configure Kanban
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Kanban Board</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Current Columns */}
          <div>
            <Label className="text-base font-medium">Current Columns</Label>
            <p className="text-sm text-muted-foreground mt-1">Drag and drop to reorder columns</p>
            <div className="space-y-2 mt-2 max-h-60 overflow-y-auto">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={columns.map(col => col.id)} strategy={verticalListSortingStrategy}>
                  {columns.map((column) => (
                    <SortableColumnItem
                      key={column.id}
                      column={column}
                      onUpdate={handleUpdateColumn}
                      onRemove={handleRemoveColumn}
                      canRemove={columns.length > 1}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          </div>

          {/* Add New Column */}
          <div>
            <Label className="text-base font-medium">Add New Column</Label>
            <div className="flex items-center gap-2 mt-2">
              <Input
                placeholder="Column name (e.g., Approval, Testing)"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                className="flex-1"
              />
              <Input
                type="color"
                value={newColumnColor}
                onChange={(e) => setNewColumnColor(e.target.value)}
                className="w-10 h-8"
              />
              <Button onClick={handleAddColumn} disabled={!newColumnName.trim()} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          </div>

          {/* Preview */}
          <div>
            <Label className="text-base font-medium">Preview</Label>
            <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
              {columns.map((column) => (
                <Badge
                  key={column.id}
                  variant="outline"
                  className="flex-shrink-0"
                  style={{
                    backgroundColor: column.color + '20',
                    color: column.color,
                    borderColor: column.color,
                  }}
                >
                  {column.name}
                </Badge>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={handleReset} size="sm">
              Reset
            </Button>
            <Button onClick={handleSave} disabled={loading} size="sm">
              {loading ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

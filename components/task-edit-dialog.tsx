'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabaseTaskService, type Task, type User, type TaskGroup, type TaskStatus } from '@/lib/supabase-task-service';

interface TaskEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  onTaskUpdated: (updatedTask: Task) => void;
}

export default function TaskEditDialog({ open, onOpenChange, task, onTaskUpdated }: TaskEditDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startAt: '',
    endAt: '',
    statusId: '',
    groupId: '',
    ownerId: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    tags: [] as string[],
  });
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [tagInput, setTagInput] = useState('');

  // Load data when dialog opens
  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  // Populate form when task changes
  useEffect(() => {
    if (task) {
      setFormData({
        name: task.name,
        description: task.description || '',
        startAt: task.startAt.toISOString().split('T')[0],
        endAt: task.endAt.toISOString().split('T')[0],
        statusId: task.status.id,
        groupId: task.group.id,
        ownerId: task.owner.id,
        priority: task.priority,
        tags: task.tags || [],
      });
    }
  }, [task]);

  const loadData = async () => {
    try {
      const [usersData, groupsData, statusesData] = await Promise.all([
        supabaseTaskService.getUsers(),
        supabaseTaskService.getGroups(),
        supabaseTaskService.getStatuses(),
      ]);
      setUsers(usersData);
      setGroups(groupsData);
      setStatuses(statusesData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;

    setLoading(true);
    try {
      const updatedTask = await supabaseTaskService.updateTask({
        id: task.id,
        name: formData.name,
        description: formData.description,
        startAt: new Date(formData.startAt),
        endAt: new Date(formData.endAt),
        statusId: formData.statusId,
        groupId: formData.groupId,
        ownerId: formData.ownerId,
        priority: formData.priority,
        tags: formData.tags,
      });

      if (updatedTask) {
        onTaskUpdated(updatedTask);
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Error updating task:', error);
    } finally {
      setLoading(false);
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()],
      }));
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove),
    }));
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Task Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value: 'low' | 'medium' | 'high') => 
                  setFormData(prev => ({ ...prev, priority: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startAt">Start Date</Label>
              <Input
                id="startAt"
                type="date"
                value={formData.startAt}
                onChange={(e) => setFormData(prev => ({ ...prev, startAt: e.target.value }))}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="endAt">End Date</Label>
              <Input
                id="endAt"
                type="date"
                value={formData.endAt}
                onChange={(e) => setFormData(prev => ({ ...prev, endAt: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.statusId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, statusId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statuses
                    .filter(status => status && status.id && status.id !== '')
                    .map(status => (
                      <SelectItem key={status.id} value={status.id}>
                        {status.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="group">Group</Label>
              <Select
                value={formData.groupId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, groupId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select group" />
                </SelectTrigger>
                <SelectContent>
                  {groups
                    .filter(group => group && group.id && group.id !== '')
                    .map(group => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="owner">Owner</Label>
              <Select
                value={formData.ownerId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, ownerId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select owner" />
                </SelectTrigger>
                <SelectContent>
                  {users
                    .filter(user => user && user.id && user.id !== '')
                    .map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Add a tag"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              />
              <Button type="button" onClick={addTag} size="sm">
                Add
              </Button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {formData.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="bg-secondary text-secondary-foreground px-2 py-1 rounded text-xs flex items-center gap-1"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-1 hover:text-destructive"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update Task'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

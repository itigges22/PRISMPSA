'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { createClientSupabase } from '@/lib/supabase';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Clock, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface Project {
  id: string;
  name: string;
}

interface Task {
  id: string;
  name: string;
  project_id: string;
}

interface LogTimeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function LogTimeDialog({ open, onOpenChange, onSuccess }: LogTimeDialogProps) {
  const { userProfile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [hours, setHours] = useState<string>('');
  const [entryDate, setEntryDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [description, setDescription] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClientSupabase();

  // Load user's assigned projects
  useEffect(() => {
    async function loadProjects() {
      if (!userProfile || !supabase || !open) return;

      setIsLoadingProjects(true);
      try {
        // Get projects user is assigned to
        const { data: assignments, error: assignmentError } = await supabase
          .from('project_assignments')
          .select('project_id, projects(id, name)')
          .eq('user_id', (userProfile as any).id)
          .is('removed_at', null);

        if (assignmentError) {
          console.error('Error loading projects:', assignmentError);
          return;
        }

        const projectList: Project[] = [];
        assignments?.forEach((a: any) => {
          if (a.projects) {
            // Handle both array and single object cases
            const projectData = Array.isArray(a.projects) ? a.projects[0] : a.projects;
            if (projectData && !projectList.find(p => p.id === projectData.id)) {
              projectList.push({ id: projectData.id, name: projectData.name });
            }
          }
        });

        // Also check tasks assigned to user for projects
        const { data: taskAssignments, error: taskError } = await supabase
          .from('tasks')
          .select('project_id, projects(id, name)')
          .eq('assigned_to', (userProfile as any).id);

        if (!taskError && taskAssignments) {
          taskAssignments.forEach((t: any) => {
            if (t.projects) {
              const projectData = Array.isArray(t.projects) ? t.projects[0] : t.projects;
              if (projectData && !projectList.find(p => p.id === projectData.id)) {
                projectList.push({ id: projectData.id, name: projectData.name });
              }
            }
          });
        }

        setProjects(projectList.sort((a, b) => a.name.localeCompare(b.name)));
      } finally {
        setIsLoadingProjects(false);
      }
    }

    loadProjects();
  }, [userProfile, supabase, open]);

  // Load tasks when project changes
  useEffect(() => {
    async function loadTasks() {
      if (!selectedProjectId || !supabase) {
        setTasks([]);
        setSelectedTaskId('');
        return;
      }

      setIsLoadingTasks(true);
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('id, name, project_id')
          .eq('project_id', selectedProjectId)
          .neq('status', 'done')
          .order('name');

        if (error) {
          console.error('Error loading tasks:', error);
          return;
        }

        setTasks(data || []);
        setSelectedTaskId('');
      } finally {
        setIsLoadingTasks(false);
      }
    }

    loadTasks();
  }, [selectedProjectId, supabase]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedProjectId('');
      setSelectedTaskId('');
      setHours('');
      setEntryDate(format(new Date(), 'yyyy-MM-dd'));
      setDescription('');
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    const hoursNum = parseFloat(hours);
    if (!selectedProjectId) {
      setError('Please select a project');
      return;
    }
    if (!selectedTaskId) {
      setError('Please select a task');
      return;
    }
    if (!hours || isNaN(hoursNum) || hoursNum <= 0 || hoursNum > 24) {
      setError('Hours must be between 0 and 24');
      return;
    }
    if (!entryDate) {
      setError('Please select a date');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: selectedTaskId,
          projectId: selectedProjectId,
          hoursLogged: hoursNum,
          entryDate,
          description: description.trim() || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to log time');
        return;
      }

      // Success
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      console.error('Error logging time:', err);
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Log Time
          </DialogTitle>
          <DialogDescription>
            Record time spent on a task. All fields are required except description.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Project Selection */}
          <div className="space-y-2">
            <Label htmlFor="project">Project</Label>
            <Select
              value={selectedProjectId}
              onValueChange={setSelectedProjectId}
              disabled={isLoadingProjects}
            >
              <SelectTrigger id="project">
                <SelectValue placeholder={isLoadingProjects ? 'Loading...' : 'Select a project'} />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {projects.length === 0 && !isLoadingProjects && (
              <p className="text-xs text-muted-foreground">
                No projects found. You need to be assigned to a project first.
              </p>
            )}
          </div>

          {/* Task Selection */}
          <div className="space-y-2">
            <Label htmlFor="task">Task</Label>
            <Select
              value={selectedTaskId}
              onValueChange={setSelectedTaskId}
              disabled={!selectedProjectId || isLoadingTasks}
            >
              <SelectTrigger id="task">
                <SelectValue
                  placeholder={
                    !selectedProjectId
                      ? 'Select a project first'
                      : isLoadingTasks
                        ? 'Loading...'
                        : 'Select a task'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {tasks.map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProjectId && tasks.length === 0 && !isLoadingTasks && (
              <p className="text-xs text-muted-foreground">
                No active tasks found in this project.
              </p>
            )}
          </div>

          {/* Hours & Date Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hours">Hours</Label>
              <Input
                id="hours"
                type="number"
                step="0.25"
                min="0.25"
                max="24"
                placeholder="e.g., 2.5"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                max={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="What did you work on?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-md p-2">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Log Time
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default LogTimeDialog;

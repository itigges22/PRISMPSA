'use client';


import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Clock, Edit, Trash2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { UserWithRoles } from '@/lib/rbac';
import { createClientSupabase } from '@/lib/supabase';
import { format, subDays, differenceInDays, parseISO } from 'date-fns';
import { toast } from 'sonner';

interface TimeEntriesListProps {
  userProfile: UserWithRoles;
}

interface TimeEntry {
  id: string;
  task_id: string;
  user_id: string;
  project_id: string;
  hours_logged: number;
  entry_date: string;
  description: string | null;
  clock_session_id: string | null;
  is_auto_clock_out: boolean;
  created_at: string;
  tasks: {
    id: string;
    name: string;
  } | null;
  projects: {
    id: string;
    name: string;
  } | null;
}

const ENTRIES_PER_PAGE = 20;
const EDIT_WINDOW_DAYS = 14;

export function TimeEntriesList({ userProfile }: TimeEntriesListProps) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);

  // Filters
  // Use tomorrow's date for end date to handle timezone differences
  // (entries created in UTC may appear as "tomorrow" in local time)
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return format(tomorrow, 'yyyy-MM-dd');
  });
  const [projectFilter, setProjectFilter] = useState('all');
  const [taskFilter, setTaskFilter] = useState('all');
  const [sortBy, _setSortBy] = useState<'date' | 'hours' | 'project'>('date');
  const [sortOrder, _setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Projects and Tasks for filters
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [tasks, setTasks] = useState<Array<{ id: string; name: string }>>([]);

  // Edit Dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [editHours, setEditHours] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete Dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingEntry, setDeletingEntry] = useState<TimeEntry | null>(null);

  const fetchFiltersData = useCallback(async () => {
    try {
      const supabase = createClientSupabase() as any;
      if (!supabase) return;

      // Fetch distinct projects
      const { data: projectsData } = await supabase
        .from('time_entries')
        .select('project_id, projects(id, name)')
        .eq('user_id', (userProfile as any).id)
        .not('project_id', 'is', null);

      const uniqueProjects = Array.from(
        new Map(
          projectsData
            ?.filter((entry: { projects?: { id: string; name: string } }) => entry.projects)
            .map((entry: { projects: { id: string; name: string } }) => [entry.projects.id, entry.projects])
        ).values()
      );

      setProjects(uniqueProjects as Array<{ id: string; name: string }>);

      // Fetch distinct tasks
      const { data: tasksData } = await supabase
        .from('time_entries')
        .select('task_id, tasks(id, name)')
        .eq('user_id', (userProfile as any).id)
        .not('task_id', 'is', null);

      const uniqueTasks = Array.from(
        new Map(
          tasksData
            ?.filter((entry: { tasks?: { id: string; name: string } }) => entry.tasks)
            .map((entry: { tasks: { id: string; name: string } }) => [entry.tasks.id, entry.tasks])
        ).values()
      );

      setTasks(uniqueTasks as Array<{ id: string; name: string }>);
    } catch (error: unknown) {
      console.error('Error fetching filters data:', error);
    }
  }, [userProfile]);

  const fetchEntries = useCallback(async () => {
    const userId = (userProfile as any).id;
    setLoading(true);
    try {
      const supabase = createClientSupabase() as any;
      if (!supabase) return;

      const offset = (currentPage - 1) * ENTRIES_PER_PAGE;

      // Build query
      let query = supabase
        .from('time_entries')
        .select('*, tasks(id, name), projects(id, name)', { count: 'exact' })
        .eq('user_id', userId)
        .gte('entry_date', startDate)
        .lte('entry_date', endDate);

      // Apply filters
      if (projectFilter !== 'all') {
        query = query.eq('project_id', projectFilter);
      }

      if (taskFilter !== 'all') {
        query = query.eq('task_id', taskFilter);
      }

      // Apply sorting
      const sortColumn = sortBy === 'date' ? 'entry_date' : sortBy === 'hours' ? 'hours_logged' : 'project_id';
      query = query.order(sortColumn, { ascending: sortOrder === 'asc' });

      // Apply pagination
      query = query.range(offset, offset + ENTRIES_PER_PAGE - 1);

      const { data, error, count } = await query;

      if (error) {
        console.error('Error fetching entries:', error);
        toast.error('Failed to load time entries');
        return;
      }

      setEntries(data || []);
      setTotalEntries(count || 0);
    } catch (error: unknown) {
      console.error('Error fetching time entries:', error);
      toast.error('Error loading time entries');
    } finally {
      setLoading(false);
    }
  }, [userProfile, currentPage, startDate, endDate, projectFilter, taskFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchFiltersData();
  }, [fetchFiltersData]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const canEditEntry = (entry: TimeEntry): boolean => {
    const entryDate = parseISO(entry.entry_date);
    const daysSinceEntry = differenceInDays(new Date(), entryDate);
    return daysSinceEntry <= EDIT_WINDOW_DAYS;
  };

  const handleEditClick = (entry: TimeEntry) => {
    setEditingEntry(entry);
    setEditHours(entry.hours_logged.toString());
    setEditDescription(entry.description || '');
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;

    const hours = parseFloat(editHours);
    if (isNaN(hours) || hours <= 0 || hours > 24) {
      toast.error('Please enter valid hours between 0 and 24');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/time-entries/${editingEntry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hours_logged: hours,
          description: editDescription || null,
        }),
      });

      if (response.ok) {
        toast.success('Time entry updated successfully');
        setEditDialogOpen(false);
        setEditingEntry(null);
        fetchEntries();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to update time entry');
      }
    } catch (error: unknown) {
      console.error('Error updating entry:', error);
      toast.error('Error updating time entry');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (entry: TimeEntry) => {
    setDeletingEntry(entry);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingEntry) return;

    try {
      const response = await fetch(`/api/time-entries/${deletingEntry.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Time entry deleted successfully');
        setDeleteDialogOpen(false);
        setDeletingEntry(null);
        fetchEntries();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to delete time entry');
      }
    } catch (error: unknown) {
      console.error('Error deleting entry:', error);
      toast.error('Error deleting time entry');
    }
  };

  const clearFilters = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setStartDate(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
    setEndDate(format(tomorrow, 'yyyy-MM-dd'));
    setProjectFilter('all');
    setTaskFilter('all');
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalEntries / ENTRIES_PER_PAGE);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Time Entries
            </CardTitle>
            <CardDescription>
              Showing {entries.length} of {totalEntries} entries
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-2" />
            Clear Filters
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="projectFilter">Project</Label>
            <Select value={projectFilter} onValueChange={(value) => {
              setProjectFilter(value);
              setCurrentPage(1);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map((project: any) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="taskFilter">Task</Label>
            <Select value={taskFilter} onValueChange={(value) => {
              setTaskFilter(value);
              setCurrentPage(1);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="All Tasks" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tasks</SelectItem>
                {tasks.map((task: any) => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-sm text-gray-500 mt-2">Loading entries...</p>
                  </TableCell>
                </TableRow>
              ) : entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Clock className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No time entries found</p>
                    <p className="text-xs text-gray-400 mt-1">Try adjusting your filters</p>
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry:any) => {
                  const editable = canEditEntry(entry);
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">
                        {format(parseISO(entry.entry_date), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {entry.projects?.name || 'No project'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {entry.tasks?.name || 'No task'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {entry.hours_logged}h
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600">
                          {entry.description || '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {entry.clock_session_id && (
                          <Badge variant="outline" className="text-xs">
                            {entry.is_auto_clock_out ? 'Auto Clock-Out' : 'Clock Session'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditClick(entry)}
                            disabled={!editable}
                            title={!editable ? 'Cannot edit entries older than 14 days' : 'Edit entry'}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(entry)}
                            disabled={!editable}
                            title={!editable ? 'Cannot delete entries older than 14 days' : 'Delete entry'}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Time Entry</DialogTitle>
            <DialogDescription>
              Update the hours logged and description for this entry
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editHours">Hours Logged</Label>
              <Input
                id="editHours"
                type="number"
                step="0.25"
                min="0"
                max="24"
                value={editHours}
                onChange={(e) => setEditHours(e.target.value)}
                placeholder="8.0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editDescription">Description</Label>
              <Textarea
                id="editDescription"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="What did you work on?"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Time Entry?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this time entry? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

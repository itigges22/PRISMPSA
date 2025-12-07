'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { createClientSupabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Clock, Download, Filter, AlertTriangle, Edit, Trash2 } from 'lucide-react'
import { hasPermission } from '@/lib/permission-checker'
import { Permission } from '@/lib/permissions'
import { toast } from 'sonner'

interface TimeEntry {
  id: string
  hours_logged: number
  entry_date: string
  description: string | null
  clock_in_time: string | null
  clock_out_time: string | null
  is_auto_clock_out: boolean
  created_at: string
  user: {
    id: string
    name: string
    email: string
  }
  project: {
    id: string
    name: string
  } | null
  task: {
    id: string
    name: string
  } | null
}

interface Summary {
  totalEntries: number
  totalHours: number
  uniqueUsers: number
  uniqueProjects: number
  autoClockOuts: number
}

export default function AdminTimeTrackingPage() {
  const { userProfile } = useAuth()
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkingAccess, setCheckingAccess] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)

  // Filters
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedUser, setSelectedUser] = useState('')
  const [users, setUsers] = useState<{ id: string; name: string }[]>([])
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])

  // Edit dialog state
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null)
  const [editHours, setEditHours] = useState('')
  const [editProject, setEditProject] = useState('none')
  const [editDescription, setEditDescription] = useState('')
  const [saving, setSaving] = useState(false)

  // Delete dialog state
  const [deletingEntry, setDeletingEntry] = useState<TimeEntry | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Check permissions
  useEffect(() => {
    const checkAccess = async () => {
      if (userProfile) {
        const canView = await hasPermission(userProfile, Permission.VIEW_TEAM_TIME_ENTRIES)
        setHasAccess(canView)
        setCheckingAccess(false)
        if (canView) {
          loadTimeEntries()
          loadUsers()
          loadProjects()
        }
      }
    }
    checkAccess()
  }, [userProfile])

  const loadUsers = async () => {
    try {
      const supabase = createClientSupabase()
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, name')
        .order('name')

      if (error) {
        console.error('Error loading users:', error)
        return
      }

      if (data) {
        setUsers(data)
      }
    } catch (error) {
      console.error('Error loading users:', error)
    }
  }

  const loadProjects = async () => {
    try {
      const supabase = createClientSupabase()
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .order('name')

      if (error) {
        console.error('Error loading projects:', error)
        return
      }

      if (data) {
        setProjects(data)
      }
    } catch (error) {
      console.error('Error loading projects:', error)
    }
  }

  const loadTimeEntries = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      if (selectedUser && selectedUser !== 'all') params.set('userId', selectedUser)

      const response = await fetch(`/api/admin/time-entries?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        setTimeEntries(data.timeEntries)
        setSummary(data.summary)
      } else {
        toast.error(data.error || 'Failed to load time entries')
      }
    } catch (error) {
      console.error('Error loading time entries:', error)
      toast.error('Failed to load time entries')
    } finally {
      setLoading(false)
    }
  }

  // Apply filters
  const handleApplyFilters = () => {
    loadTimeEntries()
  }

  // Clear filters
  const handleClearFilters = () => {
    setStartDate('')
    setEndDate('')
    setSelectedUser('')
    setTimeout(loadTimeEntries, 0)
  }

  // Format time
  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '-'
    return new Date(timeStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })
  }

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Date', 'User', 'Project', 'Task', 'Hours', 'Clock In', 'Clock Out', 'Auto Clock Out', 'Description']
    const rows = timeEntries.map(entry => [
      entry.entry_date,
      entry.user?.name || 'Unknown',
      entry.project?.name || 'N/A',
      entry.task?.name || 'N/A',
      entry.hours_logged.toFixed(2),
      entry.clock_in_time ? new Date(entry.clock_in_time).toISOString() : '',
      entry.clock_out_time ? new Date(entry.clock_out_time).toISOString() : '',
      entry.is_auto_clock_out ? 'Yes' : 'No',
      entry.description || ''
    ])

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `time-entries-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Open edit dialog
  const handleEditEntry = (entry: TimeEntry) => {
    setEditingEntry(entry)
    setEditHours(entry.hours_logged.toString())
    setEditProject(entry.project?.id || 'none')
    setEditDescription(entry.description || '')
  }

  // Save edited entry
  const handleSaveEdit = async () => {
    if (!editingEntry) return

    setSaving(true)
    try {
      const response = await fetch(`/api/admin/time-entries/${editingEntry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hours_logged: parseFloat(editHours),
          project_id: editProject === 'none' ? null : editProject || null,
          description: editDescription || null,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Time entry updated successfully')
        setEditingEntry(null)
        loadTimeEntries()
      } else {
        toast.error(data.error || 'Failed to update time entry')
      }
    } catch (error) {
      console.error('Error updating time entry:', error)
      toast.error('Failed to update time entry')
    } finally {
      setSaving(false)
    }
  }

  // Delete time entry
  const handleDeleteEntry = async () => {
    if (!deletingEntry) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/admin/time-entries/${deletingEntry.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Time entry deleted successfully')
        setDeletingEntry(null)
        loadTimeEntries()
      } else {
        toast.error(data.error || 'Failed to delete time entry')
      }
    } catch (error) {
      console.error('Error deleting time entry:', error)
      toast.error('Failed to delete time entry')
    } finally {
      setDeleting(false)
    }
  }

  // Show loading while checking access
  if (checkingAccess) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-gray-500">You don&apos;t have permission to view team time entries.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="w-6 h-6" />
            Time Tracking
          </h1>
          <p className="text-gray-500">View and manage team time entries</p>
        </div>
        <Button onClick={exportToCSV} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{summary.totalEntries}</div>
              <div className="text-xs text-gray-500">Total Entries</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{summary.totalHours.toFixed(1)}h</div>
              <div className="text-xs text-gray-500">Total Hours</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{summary.uniqueUsers}</div>
              <div className="text-xs text-gray-500">Active Users</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{summary.uniqueProjects}</div>
              <div className="text-xs text-gray-500">Projects</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-yellow-600">{summary.autoClockOuts}</div>
              <div className="text-xs text-gray-500">Auto Clock-Outs</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">User</label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {users.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleApplyFilters} size="sm">
              Apply
            </Button>
            <Button onClick={handleClearFilters} variant="outline" size="sm">
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Time Entries Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : timeEntries.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-gray-500">
              No time entries found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timeEntries.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      {formatDate(entry.entry_date)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{entry.user?.name || 'Unknown'}</div>
                        <div className="text-xs text-gray-500">{entry.user?.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {entry.project?.name || (
                        <span className="text-gray-400 italic">No project</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {entry.task?.name || (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {entry.hours_logged.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatTime(entry.clock_in_time)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatTime(entry.clock_out_time)}
                    </TableCell>
                    <TableCell>
                      {entry.is_auto_clock_out ? (
                        <Badge variant="destructive" className="text-xs">
                          Auto
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Normal
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditEntry(entry)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingEntry(entry)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingEntry} onOpenChange={(open) => !open && setEditingEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Time Entry</DialogTitle>
            <DialogDescription>
              Update hours, project, or description for this time entry
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-hours">Hours Logged</Label>
              <Input
                id="edit-hours"
                type="number"
                step="0.25"
                min="0"
                value={editHours}
                onChange={(e) => setEditHours(e.target.value)}
                placeholder="Enter hours"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-project">Project</Label>
              <Select value={editProject} onValueChange={setEditProject}>
                <SelectTrigger id="edit-project">
                  <SelectValue placeholder="Select project (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Project</SelectItem>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Enter description (optional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingEntry(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving || !editHours}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingEntry} onOpenChange={(open) => !open && setDeletingEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Time Entry</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this time entry? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deletingEntry && (
            <div className="py-4 space-y-2">
              <div className="text-sm">
                <span className="font-medium">Date:</span> {formatDate(deletingEntry.entry_date)}
              </div>
              <div className="text-sm">
                <span className="font-medium">User:</span> {deletingEntry.user?.name}
              </div>
              <div className="text-sm">
                <span className="font-medium">Hours:</span> {deletingEntry.hours_logged.toFixed(2)}
              </div>
              {deletingEntry.project && (
                <div className="text-sm">
                  <span className="font-medium">Project:</span> {deletingEntry.project.name}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingEntry(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteEntry} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete Entry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { createClientSupabase } from '@/lib/supabase'
import { handleApiPermissionError } from '@/lib/permission-toast'

interface ClockSession {
  id: string
  user_id: string
  clock_in_time: string
  clock_out_time: string | null
  is_active: boolean
}

interface TimeAllocation {
  id: string
  projectId: string
  taskId: string
  hours: number
  description: string
}

interface Project {
  id: string
  name: string
  tasks?: Task[]
}

interface Task {
  id: string
  name: string
  project_id: string
}

interface ClockOutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  session: ClockSession | null
  elapsedSeconds: number
  onComplete: () => void
}

export function ClockOutDialog({
  open,
  onOpenChange,
  elapsedSeconds,
  onComplete
}: ClockOutDialogProps) {
  const [allocations, setAllocations] = useState<TimeAllocation[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Format elapsed time
  const elapsedHours = elapsedSeconds / 3600
  const formattedElapsed = `${Math.floor(elapsedSeconds / 3600)}h ${Math.floor((elapsedSeconds % 3600) / 60)}m`

  // Calculate total allocated
  const totalAllocated = allocations.reduce((sum, a) => sum + (a.hours || 0), 0)
  const difference = Math.abs(elapsedHours - totalAllocated)
  const isBalanced = difference < 0.1 // Allow 6 min difference

  // Load projects when dialog opens
  useEffect(() => {
    if (open) {
      void loadProjects()
      // Initialize with one empty allocation
      if (allocations.length === 0) {
        setAllocations([{
          id: crypto.randomUUID(),
          projectId: '',
          taskId: '',
          hours: Math.round(elapsedHours * 100) / 100,
          description: ''
        }])
      }
    }
  }, [open, allocations.length, elapsedHours])

  const loadProjects = async () => {
    setLoading(true)
    try {
      const supabase = createClientSupabase() as any as any
      if (!supabase) return

      // Get user's assigned projects
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const projectMap = new Map<string, { id: string; name: string }>()
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000) // 1 hour grace period

      // 1. Get projects user is currently assigned to (active assignments)
      const { data: assignments, error: assignmentsError } = await supabase
        .from('project_assignments')
        .select(`
          project_id,
          projects (
            id,
            name,
            status
          )
        `)
        .eq('user_id', (user as any).id)
        .is('removed_at', null)

      if (assignmentsError) {
        console.error('Error fetching project assignments:', assignmentsError)
      }

      if (assignments && assignments.length > 0) {
        assignments.forEach((a: any) => {
          const project = a.projects as Record<string, unknown> | null | undefined
          if (project && (project.status as string) !== 'complete') {
            projectMap.set(project.id as string, {
              id: project.id as string,
              name: project.name as string
            })
          }
        })
      }

      // 2. Also check for recently completed projects the user was assigned to (within 1-hour grace period)
      // This allows logging time to projects that just completed
      const { data: recentCompleted, error: recentError } = await supabase
        .from('project_assignments')
        .select(`
          project_id,
          projects (
            id,
            name,
            status,
            updated_at
          )
        `)
        .eq('user_id', (user as any).id)
        .is('removed_at', null) // Only check current assignments for completed projects

      if (recentError) {
        console.error('Error fetching recent completed projects:', recentError)
      }

      if (recentCompleted && recentCompleted.length > 0) {
        recentCompleted.forEach((c: any) => {
          const project = c.projects as Record<string, unknown> | null | undefined
          if (project && (project.status as string) === 'complete' && project.updated_at) {
            const updatedAt = new Date(project.updated_at as string)
            if (updatedAt > oneHourAgo) {
              projectMap.set(project.id as string, {
                id: project.id as string,
                name: `${project.name as string} (Completed - grace period)`
              })
            }
          }
        })
      }

      const projectList = Array.from(projectMap.values())

      // Add "Other" option for unassigned work
      projectList.push({ id: 'other', name: 'Other (Unassigned)' })
      setProjects(projectList)

      // Get ALL tasks from projects the user can log time to
      const projectIds = projectList
        .filter((p: any) => p.id !== 'other')
        .map((p: any) => p.id)

      if (projectIds.length > 0) {
        const { data: projectTasks, error: tasksError } = await supabase
          .from('tasks')
          .select('id, name, project_id')
          .in('project_id', projectIds)
          .order('name')

        if (tasksError) {
          console.error('Error fetching tasks:', tasksError)
        }

        if (projectTasks) {
          setTasks(projectTasks)
        }
      }
    } catch (error: unknown) {
      console.error('Error loading projects:', error)
    } finally {
      setLoading(false)
    }
  }

  // Add new allocation
  const addAllocation = () => {
    setAllocations([
      ...allocations,
      {
        id: crypto.randomUUID(),
        projectId: '',
        taskId: '',
        hours: 0,
        description: ''
      }
    ])
  }

  // Remove allocation
  const removeAllocation = (id: string) => {
    if (allocations.length === 1) {
      toast.error('At least one allocation is required')
      return
    }
    setAllocations(allocations.filter((a: any) => a.id !== id))
  }

  // Update allocation
  const updateAllocation = (id: string, field: keyof TimeAllocation, value: string | number) => {
    setAllocations(allocations.map((a: any) => {
      if (a.id === id) {
        const updated = { ...a, [field]: value }
        // Reset task if project changes
        if (field === 'projectId') {
          updated.taskId = ''
        }
        return updated
      }
      return a
    }))
  }

  // Get tasks for a specific project
  const getProjectTasks = (projectId: string) => {
    return tasks.filter((t: any) => t.project_id === projectId)
  }

  // Handle submit
  const handleSubmit = async () => {
    // Validate allocations
    const validAllocations = allocations.filter((a: any) => a.projectId && a.hours > 0)
    if (validAllocations.length === 0) {
      toast.error('Please add at least one time allocation')
      return
    }

    // Check for unassigned projects without description
    for (const alloc of validAllocations) {
      if (alloc.projectId === 'other' && !alloc.description) {
        toast.error('Please add a description for "Other" allocations')
        return
      }
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/clock/out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allocations: validAllocations.map((a: any) => ({
            projectId: a.projectId === 'other' ? null : a.projectId,
            taskId: (a.taskId && a.taskId !== 'none') ? a.taskId : null,
            hours: a.hours,
            description: a.description || notes
          })),
          notes
        })
      })

      const data = await response.json()

      if (data.success) {
        toast.success(`Clocked out! Logged ${data.summary.allocatedHours.toFixed(2)} hours`)
        onComplete()
      } else {
        // Check for permission error and show specific toast
        if (!handleApiPermissionError(response, 'time tracking')) {
          toast.error(data.error || 'Failed to clock out')
        }
      }
    } catch (error: unknown) {
      console.error('Error clocking out:', error)
      toast.error('Failed to clock out')
    } finally {
      setSubmitting(false)
    }
  }

  // Handle clock out without saving
  const handleDiscardAndClockOut = async () => {
    setSubmitting(true)
    try {
      const response = await fetch('/api/clock/discard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Clocked out without saving time')
        onComplete()
      } else {
        toast.error(data.error || 'Failed to clock out')
      }
    } catch (error: unknown) {
      console.error('Error clocking out:', error)
      toast.error('Failed to clock out')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Clock Out - Allocate Time
          </DialogTitle>
          <DialogDescription>
            You&apos;ve been clocked in for <strong>{formattedElapsed}</strong> ({elapsedHours.toFixed(2)} hours).
            Allocate your time to projects and tasks.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Allocations */}
          {allocations.map((allocation:any, index:any) => (
            <div key={allocation.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Allocation {index + 1}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { removeAllocation(allocation.id); }}
                  className="text-red-500 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Project Select */}
                <div className="space-y-1">
                  <Label className="text-xs">Project *</Label>
                  <Select
                    value={allocation.projectId}
                    onValueChange={(value) => { updateAllocation(allocation.id, 'projectId', value); }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project: any) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Task Select */}
                <div className="space-y-1">
                  <Label className="text-xs">Task (Optional)</Label>
                  <Select
                    value={allocation.taskId}
                    onValueChange={(value) => { updateAllocation(allocation.id, 'taskId', value); }}
                    disabled={!allocation.projectId || allocation.projectId === 'other'}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select task" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No specific task</SelectItem>
                      {getProjectTasks(allocation.projectId).map((task: any) => (
                        <SelectItem key={task.id} value={task.id}>
                          {task.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Hours */}
                <div className="space-y-1">
                  <Label className="text-xs">Hours *</Label>
                  <Input
                    type="number"
                    step="0.25"
                    min="0"
                    value={allocation.hours || ''}
                    onChange={(e) => { updateAllocation(allocation.id, 'hours', parseFloat(e.target.value) || 0); }}
                    placeholder="0.00"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <Label className="text-xs">
                    Description {allocation.projectId === 'other' && '*'}
                  </Label>
                  <Input
                    value={allocation.description}
                    onChange={(e) => { updateAllocation(allocation.id, 'description', e.target.value); }}
                    placeholder="What did you work on?"
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Add Allocation Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={addAllocation}
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Another Allocation
          </Button>

          {/* Notes */}
          <div className="space-y-1">
            <Label className="text-xs">General Notes (Optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => { setNotes(e.target.value); }}
              placeholder="Any additional notes about this work session..."
              rows={2}
            />
          </div>

          {/* Summary */}
          <div className={`p-3 rounded-lg ${isBalanced ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
            <div className="flex justify-between items-center">
              <span className="text-sm">Total Allocated:</span>
              <span className={`font-bold ${isBalanced ? 'text-green-600' : 'text-yellow-600'}`}>
                {totalAllocated.toFixed(2)} / {elapsedHours.toFixed(2)} hours
              </span>
            </div>
            {!isBalanced && (
              <p className="text-xs text-yellow-600 mt-1">
                Allocated time differs from clocked time by {(difference * 60).toFixed(0)} minutes
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { onOpenChange(false); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDiscardAndClockOut}
              disabled={submitting || loading}
            >
              Discard & Clock Out
            </Button>
          </div>
          <Button onClick={handleSubmit} disabled={submitting || loading}>
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Saving...
              </>
            ) : (
              'Clock Out & Save'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

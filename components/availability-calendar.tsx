'use client'

/**
 * Weekly Availability Calendar Component
 * Allows users to set their work capacity for each day of the week
 */

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Calendar, Save, Copy, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { hasPermission } from '@/lib/permission-checker'
import { Permission } from '@/lib/permissions'
import { UserWithRoles } from '@/lib/rbac-types'

interface WeeklySchedule {
  monday: number
  tuesday: number
  wednesday: number
  thursday: number
  friday: number
  saturday: number
  sunday: number
}

interface AvailabilityCalendarProps {
  userProfile: UserWithRoles
  userId?: string // If viewing another user's availability
}

export default function AvailabilityCalendar({ userProfile, userId }: AvailabilityCalendarProps) {
  const targetUserId = userId ?? userProfile.id
  const isOwnData = targetUserId === userProfile.id

  const [canEdit, setCanEdit] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Week navigation
  const [currentWeekStart, setCurrentWeekStart] = useState<string>('')

  // Availability data
  const [schedule, setSchedule] = useState<WeeklySchedule>({
    monday: 8,
    tuesday: 8,
    wednesday: 8,
    thursday: 8,
    friday: 8,
    saturday: 0,
    sunday: 0,
  })
  const [notes, setNotes] = useState('')

  // Calculate total hours
  const totalHours = Object.values(schedule).reduce((sum, hours) => sum + hours, 0)

  // Get Monday of current week
  const getWeekStartDate = (date: Date = new Date()): string => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(d.setDate(diff))
    return monday.toISOString().split('T')[0]
  }

  // Format date for display
  const formatWeekDisplay = (weekStart: string): string => {
    const start = new Date(weekStart)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)

    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}, ${start.getFullYear()}`
  }

  // Navigate weeks
  const navigateWeek = (direction: 'prev' | 'next') => {
    const current = new Date(currentWeekStart)
    const daysToAdd = direction === 'next' ? 7 : -7
    current.setDate(current.getDate() + daysToAdd)
    setCurrentWeekStart(getWeekStartDate(current))
  }

  // Go to current week
  const goToCurrentWeek = () => {
    setCurrentWeekStart(getWeekStartDate())
  }

  // Check permissions
  useEffect(() => {
    async function checkPermissions() {
      if (!isOwnData) {
        // Can only view, not edit other users
        setCanEdit(false)
      } else {
        const canEditAvailability = await hasPermission(userProfile, Permission.EDIT_OWN_AVAILABILITY)
        setCanEdit(canEditAvailability)
      }
    }
    void checkPermissions()
  }, [userProfile, isOwnData])

  // Initialize week
  useEffect(() => {
    setCurrentWeekStart(getWeekStartDate())
  }, [])

  // Load availability data
  useEffect(() => {
    if (!currentWeekStart) return

    async function loadAvailability() {
      setLoading(true)
      try {
        const response = await fetch(
          `/api/availability?userId=${targetUserId}&weekStartDate=${currentWeekStart}`
        )
        const data = await response.json()

        if (data.success && data.availability) {
          const scheduleData = data.availability.schedule_data || {}
          setSchedule({
            monday: scheduleData.monday || 0,
            tuesday: scheduleData.tuesday || 0,
            wednesday: scheduleData.wednesday || 0,
            thursday: scheduleData.thursday || 0,
            friday: scheduleData.friday || 0,
            saturday: scheduleData.saturday || 0,
            sunday: scheduleData.sunday || 0,
          })
          setNotes(data.availability.notes || '')
        } else {
          // No data for this week, use default
          setSchedule({
            monday: 8,
            tuesday: 8,
            wednesday: 8,
            thursday: 8,
            friday: 8,
            saturday: 0,
            sunday: 0,
          })
          setNotes('')
        }
      } catch (error) {
        console.error('Error loading availability:', error)
        toast.error('Failed to load availability')
      } finally {
        setLoading(false)
      }
    }

    void loadAvailability()
  }, [currentWeekStart, targetUserId])

  // Save availability
  const handleSave = async () => {
    if (!canEdit) {
      toast.error('You do not have permission to edit availability')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: targetUserId,
          weekStartDate: currentWeekStart,
          availableHours: totalHours,
          scheduleData: schedule,
          notes,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success(`Availability saved for week of ${formatWeekDisplay(currentWeekStart)}`)
      } else {
        toast.error(data.error || 'Failed to save availability')
      }
    } catch (error) {
      console.error('Error saving availability:', error)
      toast.error('Failed to save availability')
    } finally {
      setSaving(false)
    }
  }

  // Copy to next week
  const handleCopyToNextWeek = async () => {
    if (!canEdit) return

    try {
      // Save current week first
      await handleSave()

      // Navigate to next week
      const nextWeek = new Date(currentWeekStart)
      nextWeek.setDate(nextWeek.getDate() + 7)
      setCurrentWeekStart(getWeekStartDate(nextWeek))

      toast.success('Copied to next week. Click Save to confirm.')
    } catch (error) {
      console.error('Error copying to next week:', error)
      toast.error('Failed to copy to next week')
    }
  }

  // Update day hours
  const handleDayChange = (day: keyof WeeklySchedule, value: string) => {
    const hours = parseFloat(value) || 0
    if (hours >= 0 && hours <= 24) {
      setSchedule(prev => ({ ...prev, [day]: hours }))
    }
  }

  const days: Array<{ key: keyof WeeklySchedule; label: string }> = [
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' },
    { key: 'sunday', label: 'Sunday' },
  ]

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Weekly Availability
            </CardTitle>
            <CardDescription>
              {isOwnData ? 'Set your work capacity for each day' : `Viewing availability for this user`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="font-semibold text-blue-600">{totalHours}h</span>
            <span className="text-gray-500">total</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Week Navigation */}
        <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { navigateWeek('prev'); }}
            className="gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>
          
          <div className="flex items-center gap-2">
            <span className="font-semibold">{formatWeekDisplay(currentWeekStart)}</span>
            <Button variant="ghost" size="sm" onClick={goToCurrentWeek}>
              Today
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => { navigateWeek('next'); }}
            className="gap-1"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Day-by-Day Schedule */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {days.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-3">
              <Label htmlFor={key} className="w-28 font-medium text-gray-700">
                {label}
              </Label>
              <Input
                id={key}
                type="number"
                min="0"
                max="24"
                step="0.5"
                value={schedule[key]}
                onChange={(e) => { handleDayChange(key, e.target.value); }}
                disabled={!canEdit}
                className="w-24"
              />
              <span className="text-sm text-gray-500">hours</span>
            </div>
          ))}
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            placeholder="e.g., PTO on Friday, Half day on Wednesday..."
            value={notes}
            onChange={(e) => { setNotes(e.target.value); }}
            disabled={!canEdit}
            rows={3}
          />
        </div>

        {/* Actions */}
        {canEdit && (
          <div className="flex items-center gap-3 pt-4 border-t">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Availability'}
            </Button>

            <Button
              variant="outline"
              onClick={handleCopyToNextWeek}
              disabled={saving}
              className="gap-2"
            >
              <Copy className="w-4 h-4" />
              Copy to Next Week
            </Button>
          </div>
        )}

        {!canEdit && isOwnData && (
          <div className="text-sm text-amber-600 bg-amber-50 rounded-lg p-3">
            You do not have permission to edit your availability. Contact your administrator.
          </div>
        )}
      </CardContent>
    </Card>
  )
}


'use client'

/**
 * Drag-to-Set Availability Calendar
 * Motion/Akiflow-style calendar for setting work availability
 */

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, Save, Copy, ChevronLeft, ChevronRight, Clock, Info } from 'lucide-react'
import { toast } from 'sonner'
import { hasPermission } from '@/lib/permission-checker'
import { Permission } from '@/lib/permissions'
import { UserWithRoles } from '@/lib/rbac-types'

interface TimeBlock {
  day: string
  startHour: number
  endHour: number
}

interface DragAvailabilityCalendarProps {
  userProfile: UserWithRoles
  userId?: string
  onSave?: () => void
}

export default function DragAvailabilityCalendar({ userProfile, userId, onSave }: DragAvailabilityCalendarProps) {
  const targetUserId = userId || userProfile.id
  const isOwnData = targetUserId === userProfile.id

  const [canEdit, setCanEdit] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Week navigation
  const [currentWeekStart, setCurrentWeekStart] = useState<string>('')

  // Availability blocks (unavailable time = user can't work)
  const [unavailableBlocks, setUnavailableBlocks] = useState<TimeBlock[]>([])
  
  // Dragging state
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ day: string; hour: number } | null>(null)
  const [dragEnd, setDragEnd] = useState<{ day: string; hour: number } | null>(null)

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const hours = Array.from({ length: 24 }, (_, i) => i) // 0-23

  // Get actual dates for each day of the week
  const getWeekDates = (): Date[] => {
    if (!currentWeekStart) return []
    const dates: Date[] = []
    // Parse date string properly to avoid timezone issues
    const [year, month, day] = currentWeekStart.split('-').map(Number)
    const startDate = new Date(year, month - 1, day)
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + i)
      dates.push(date)
    }
    return dates
  }

  const weekDates = getWeekDates()

  // Get Monday of current week (using local time to match capacity chart)
  const getWeekStartDate = (date: Date = new Date()): string => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(d.setDate(diff))
    // Use local date format (YYYY-MM-DD) instead of UTC to match capacity chart
    const year = monday.getFullYear()
    const month = String(monday.getMonth() + 1).padStart(2, '0')
    const dayOfMonth = String(monday.getDate()).padStart(2, '0')
    return `${year}-${month}-${dayOfMonth}`
  }

  // Format date for display
  const formatWeekDisplay = (weekStart: string): string => {
    // Parse date string properly to avoid timezone issues
    const [year, month, day] = weekStart.split('-').map(Number)
    const start = new Date(year, month - 1, day)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)

    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}, ${start.getFullYear()}`
  }

  // Navigate weeks
  const navigateWeek = (direction: 'prev' | 'next') => {
    // Parse the date string properly to avoid timezone issues
    const [year, month, day] = currentWeekStart.split('-').map(Number)
    const current = new Date(year, month - 1, day) // month is 0-indexed
    const daysToAdd = direction === 'next' ? 7 : -7
    current.setDate(current.getDate() + daysToAdd)
    setCurrentWeekStart(getWeekStartDate(current))
  }

  // Go to current week
  const goToCurrentWeek = () => {
    setCurrentWeekStart(getWeekStartDate())
  }

  // Check if a time slot is unavailable
  const isSlotUnavailable = (day: string, hour: number): boolean => {
    return unavailableBlocks.some(block => 
      block.day === day && hour >= block.startHour && hour < block.endHour
    )
  }

  // Calculate available hours
  const calculateAvailableHours = (): Record<string, number> => {
    const hoursPerDay: Record<string, number> = {}
    days.forEach(day => {
      // Get all unavailable blocks for this day
      const dayBlocks = unavailableBlocks.filter(block => block.day === day)

      // Merge overlapping blocks to avoid double-counting
      const mergedBlocks: TimeBlock[] = []
      dayBlocks
        .sort((a, b) => a.startHour - b.startHour)
        .forEach(block => {
          if (mergedBlocks.length === 0) {
            mergedBlocks.push(block)
          } else {
            const lastBlock = mergedBlocks[mergedBlocks.length - 1]
            if (block.startHour <= lastBlock.endHour) {
              // Overlapping or adjacent - merge
              lastBlock.endHour = Math.max(lastBlock.endHour, block.endHour)
            } else {
              // Separate block
              mergedBlocks.push(block)
            }
          }
        })

      // Calculate total unavailable hours from merged blocks
      const unavailableHours = mergedBlocks.reduce(
        (sum, block) => sum + (block.endHour - block.startHour),
        0
      )

      // Cap at 24 hours
      hoursPerDay[day] = Math.max(0, 24 - Math.min(24, unavailableHours))
    })
    return hoursPerDay
  }

  const availableHours = calculateAvailableHours()
  const totalHours = Object.values(availableHours).reduce((sum, h) => sum + h, 0)

  // Format hour to 12-hour AM/PM format
  const formatHour = (hour: number): string => {
    if (hour === 0) return '12 AM'
    if (hour < 12) return `${hour} AM`
    if (hour === 12) return '12 PM'
    return `${hour - 12} PM`
  }

  // Mouse down - start dragging
  const handleMouseDown = (day: string, hour: number) => {
    if (!canEdit) return
    setIsDragging(true)
    setDragStart({ day, hour })
    setDragEnd({ day, hour })
  }

  // Mouse move - update drag end
  const handleMouseMove = (day: string, hour: number) => {
    if (!isDragging || !dragStart) return
    // Only allow dragging within the same day
    if (day === dragStart.day) {
      setDragEnd({ day, hour })
    }
  }

  // Mouse up - finalize block
  const handleMouseUp = () => {
    if (!isDragging || !dragStart || !dragEnd) {
      setIsDragging(false)
      return
    }

    const day = dragStart.day
    const startHour = Math.min(dragStart.hour, dragEnd.hour)
    const endHour = Math.max(dragStart.hour, dragEnd.hour) + 1

    // Toggle: If the block is already unavailable, make it available
    const existingBlock = unavailableBlocks.find(
      block => block.day === day &&
      ((startHour >= block.startHour && startHour < block.endHour) ||
       (endHour > block.startHour && endHour <= block.endHour))
    )

    if (existingBlock) {
      // Remove overlapping blocks
      setUnavailableBlocks(prev =>
        prev.filter(block =>
          !(block.day === day &&
            ((startHour >= block.startHour && startHour < block.endHour) ||
             (endHour > block.startHour && endHour <= block.endHour) ||
             (startHour <= block.startHour && endHour >= block.endHour)))
        )
      )
    } else {
      // Add new unavailable block
      setUnavailableBlocks(prev => [...prev, { day, startHour, endHour }])
    }

    setIsDragging(false)
    setDragStart(null)
    setDragEnd(null)
  }

  // Check permissions
  useEffect(() => {
    async function checkPermissions() {
      if (!isOwnData) {
        setCanEdit(false)
      } else {
        const canEditAvailability = await hasPermission(userProfile, Permission.EDIT_OWN_AVAILABILITY)
        setCanEdit(canEditAvailability)
      }
    }
    checkPermissions()
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

        if (data.success && data.availability && data.availability.schedule_data) {
          const scheduleData = data.availability.schedule_data

          // Check if we have the new format with unavailableBlocks
          if (scheduleData.unavailableBlocks && Array.isArray(scheduleData.unavailableBlocks)) {
            // Use saved block positions directly
            setUnavailableBlocks(scheduleData.unavailableBlocks)
          } else {
            // Legacy format: convert hours per day to blocks (approximate)
            const blocks: TimeBlock[] = []

            days.forEach(day => {
              const hoursAvailable = scheduleData.hoursPerDay?.[day] ?? scheduleData[day] ?? 0
              const unavailableHours = 24 - hoursAvailable
              const isWeekend = day === 'saturday' || day === 'sunday'

              if (unavailableHours >= 24 || (isWeekend && hoursAvailable === 0)) {
                // Fully unavailable - block entire day
                blocks.push({ day, startHour: 0, endHour: 24 })
              } else if (unavailableHours > 0) {
                // Partially available - create blocks before and after work hours
                if (hoursAvailable >= 8) {
                  // Standard workday or more: 9am-5pm available
                  blocks.push({ day, startHour: 0, endHour: 9 })
                  blocks.push({ day, startHour: 17, endHour: 24 })
                } else if (hoursAvailable > 0) {
                  // Shorter day: center available hours around midday
                  const workStart = Math.floor(12 - hoursAvailable / 2)
                  const workEnd = Math.ceil(12 + hoursAvailable / 2)
                  blocks.push({ day, startHour: 0, endHour: workStart })
                  blocks.push({ day, startHour: workEnd, endHour: 24 })
                } else {
                  // No hours available - block entire day
                  blocks.push({ day, startHour: 0, endHour: 24 })
                }
              }
            })

            setUnavailableBlocks(blocks)
          }
        } else {
          // Default: All time unavailable (0 hours available) - user can add their open times
          const defaultBlocks: TimeBlock[] = []
          days.forEach(day => {
            defaultBlocks.push({ day, startHour: 0, endHour: 24 })
          })
          setUnavailableBlocks(defaultBlocks)
        }
      } catch (error) {
        console.error('Error loading availability:', error)
        toast.error('Failed to load availability')
      } finally {
        setLoading(false)
      }
    }

    loadAvailability()
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
          // Save both hours per day and the actual block positions
          scheduleData: {
            hoursPerDay: availableHours,
            unavailableBlocks: unavailableBlocks,
          },
          notes: '',
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success(`Availability saved for week of ${formatWeekDisplay(currentWeekStart)}`)
        if (onSave) onSave()
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
              Work Availability
            </CardTitle>
            <CardDescription>
              Drag to toggle time slots (gray = unavailable, white = available)
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="font-semibold text-blue-600">{totalHours}h</span>
            <span className="text-gray-500">available</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Week Navigation */}
        <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateWeek('prev')}
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
            onClick={() => navigateWeek('next')}
            className="gap-1"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Instructions */}
        <div className="flex items-start gap-2 text-sm text-blue-600 bg-blue-50 rounded-lg p-3">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <strong>How to use:</strong> Drag across time slots to toggle availability.
            Gray blocks = unavailable (you can't work). White blocks = available (you can work).
            Click and drag on gray to make time available, or drag on white to make time unavailable.
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="border rounded-lg overflow-hidden">
          <div className="grid grid-cols-8 border-b bg-gray-50">
            <div className="p-2 text-xs font-medium text-gray-600 border-r">Time</div>
            {dayLabels.map((label, idx) => (
              <div key={label} className="p-2 text-center text-xs font-medium text-gray-600 border-r last:border-r-0">
                <div className="text-gray-800 font-bold">
                  {weekDates[idx] ? weekDates[idx].getDate() : ''}
                </div>
                <div className="text-gray-600">{label}</div>
                <div className="text-blue-600 font-semibold">{availableHours[days[idx]]}h</div>
              </div>
            ))}
          </div>

          {/* Hour rows - show all 24 hours so users can mark any time unavailable */}
          <div>
            {hours.map(hour => (
              <div key={hour} className="grid grid-cols-8 border-b last:border-b-0">
                <div className="p-1 text-xs text-gray-600 border-r bg-gray-50">
                  {formatHour(hour)}
                </div>
                {days.map(day => {
                  const isUnavailable = isSlotUnavailable(day, hour)
                  const isInDragSelection = isDragging && dragStart && dragEnd &&
                    day === dragStart.day &&
                    hour >= Math.min(dragStart.hour, dragEnd.hour) &&
                    hour <= Math.max(dragStart.hour, dragEnd.hour)

                  return (
                    <div
                      key={`${day}-${hour}`}
                      className={`
                        h-6 border-r last:border-r-0 cursor-pointer transition-colors
                        ${isUnavailable ? 'bg-gray-300' : 'bg-white hover:bg-blue-50'}
                        ${isInDragSelection ? 'bg-blue-200' : ''}
                        ${!canEdit ? 'cursor-not-allowed opacity-60' : ''}
                      `}
                      onMouseDown={() => handleMouseDown(day, hour)}
                      onMouseMove={() => handleMouseMove(day, hour)}
                      onMouseUp={handleMouseUp}
                    />
                  )
                })}
              </div>
            ))}
          </div>
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
              onClick={() => {
                // Clear all blocks (make all time available)
                setUnavailableBlocks([])
              }}
              disabled={saving}
            >
              Clear All
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                // Set default: weekdays 9-5
                const defaultBlocks: TimeBlock[] = []
                days.forEach(day => {
                  if (day === 'saturday' || day === 'sunday') {
                    defaultBlocks.push({ day, startHour: 0, endHour: 24 })
                  } else {
                    defaultBlocks.push({ day, startHour: 0, endHour: 9 })
                    defaultBlocks.push({ day, startHour: 17, endHour: 24 })
                  }
                })
                setUnavailableBlocks(defaultBlocks)
              }}
              disabled={saving}
            >
              Reset to 9-5
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


'use client'

import { useState, useEffect, Suspense, useRef, useCallback } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Clock, Play, Square, Timer, List, Calendar, GripVertical } from 'lucide-react'
import { ClockOutDialog } from './clock-out-dialog'
import { toast } from 'sonner'
import { useAuth } from '@/lib/hooks/useAuth'
import { isUnassigned } from '@/lib/rbac'
import { useClockStatus } from '@/lib/hooks/use-data'
import { Skeleton } from '@/components/ui/skeleton'

// Lazy load the availability calendar
const DragAvailabilityCalendar = dynamic(() => import('@/components/drag-availability-calendar'), {
  loading: () => (
    <div className="space-y-3">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  ),
  ssr: false
})

export function ClockWidget() {
  const { userProfile, loading: authLoading } = useAuth()
  // Only fetch clock status when authenticated (prevents 404 on login pages)
  const isAuthenticated = !authLoading && !!userProfile
  // Use SWR hook for automatic caching and revalidation
  const { clockedIn, currentSession, isLoading, mutate } = useClockStatus(isAuthenticated)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [clockingIn, setClockingIn] = useState(false)
  const [showClockOutDialog, setShowClockOutDialog] = useState(false)
  const [showAvailabilityDialog, setShowAvailabilityDialog] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)

  // Drag functionality
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const widgetRef = useRef<HTMLDivElement>(null)

  // Load saved position from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('clockWidgetPosition')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setPosition(parsed)
      } catch {
        // Invalid JSON, use default position
      }
    }
  }, [])

  // Save position to localStorage when it changes
  useEffect(() => {
    if (position) {
      localStorage.setItem('clockWidgetPosition', JSON.stringify(position))
    }
  }, [position])

  // Handle mouse down for drag start
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (!widgetRef.current) return
    e.preventDefault()
    setIsDragging(true)

    const rect = widgetRef.current.getBoundingClientRect()
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }, [])

  // Handle mouse move during drag
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragOffset.current.x
      const newY = e.clientY - dragOffset.current.y

      // Keep within viewport bounds
      const maxX = window.innerWidth - (widgetRef.current?.offsetWidth || 200)
      const maxY = window.innerHeight - (widgetRef.current?.offsetHeight || 150)

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  // Reset position to default
  const resetPosition = useCallback(() => {
    setPosition(null)
    localStorage.removeItem('clockWidgetPosition')
  }, [])

  // Format elapsed time as HH:MM:SS
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Format elapsed time as hours with decimals
  const formatHours = (seconds: number) => {
    const hours = seconds / 3600
    return hours.toFixed(2)
  }

  // Calculate elapsed time when clock status loads
  useEffect(() => {
    if (currentSession && clockedIn) {
      const clockInTime = new Date(currentSession.clock_in_time)
      const elapsed = Math.floor((Date.now() - clockInTime.getTime()) / 1000)
      setElapsedTime(elapsed)
    }
  }, [currentSession, clockedIn])

  // Update timer every second when clocked in (pause when dialog is open)
  useEffect(() => {
    // Don't run timer if not clocked in or dialog is open
    if (!clockedIn) return
    if (showClockOutDialog) return

    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1)
    }, 1000)

    return () => { clearInterval(interval); }
  }, [clockedIn, showClockOutDialog])

  // Handle clock in
  const handleClockIn = async () => {
    setClockingIn(true)
    try {
      const response = await fetch('/api/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await response.json()

      if (data.success) {
        // Revalidate SWR cache to update clock status
        mutate()
        setElapsedTime(0)
        toast.success('Clocked in successfully')
      } else {
        toast.error(data.error || 'Failed to clock in')
      }
    } catch (error: unknown) {
      console.error('Error clocking in:', error)
      toast.error('Failed to clock in')
    } finally {
      setClockingIn(false)
    }
  }

  // Handle clock out dialog close
  const handleClockOutComplete = () => {
    setShowClockOutDialog(false)
    setElapsedTime(0)
    // Revalidate SWR cache to update clock status
    mutate()
  }

  // Don't render if not authenticated, still loading, or user is unassigned
  if (authLoading || !userProfile || isLoading || isUnassigned(userProfile)) {
    return null
  }

  // Compute position styles
  const positionStyles = position
    ? { left: `${position.x}px`, top: `${position.y}px`, bottom: 'auto', right: 'auto' }
    : {}

  return (
    <>
      {/* Floating Widget */}
      <div
        ref={widgetRef}
        className={`fixed z-50 ${isDragging ? 'cursor-grabbing' : ''}`}
        style={{
          bottom: position ? 'auto' : '1rem',
          left: position ? 'auto' : '1rem',
          ...positionStyles,
        }}
      >
        <Card className={`shadow-lg border-2 transition-all duration-200 ${
          clockedIn ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'
        }`}>
          {isMinimized ? (
            // Minimized view - just an icon with drag handle
            <div className="flex items-center">
              <div
                onMouseDown={handleDragStart}
                className="p-2 cursor-grab hover:bg-gray-100 rounded-l-lg"
                title="Drag to move"
              >
                <GripVertical className="w-4 h-4 text-gray-400" />
              </div>
              <button
                onClick={() => { setIsMinimized(false); }}
                className="p-3 flex items-center gap-2"
              >
                <Clock className={`w-5 h-5 ${clockedIn ? 'text-green-600' : 'text-gray-600'}`} />
                {clockedIn && (
                  <span className="text-sm font-mono font-bold text-green-600">
                    {formatTime(elapsedTime)}
                  </span>
                )}
              </button>
            </div>
          ) : (
            // Expanded view
            <div className="p-4 min-w-[200px]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    onMouseDown={handleDragStart}
                    className="cursor-grab hover:bg-gray-100 p-1 rounded -ml-1"
                    title="Drag to move"
                  >
                    <GripVertical className="w-4 h-4 text-gray-400" />
                  </div>
                  <Timer className={`w-4 h-4 ${clockedIn ? 'text-green-600' : 'text-gray-500'}`} />
                  <span className="text-sm font-medium">
                    {clockedIn ? 'Clocked In' : 'Time Tracking'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {position && (
                    <button
                      onClick={resetPosition}
                      className="text-gray-400 hover:text-gray-600 text-xs"
                      title="Reset position"
                    >
                      reset
                    </button>
                  )}
                  <button
                    onClick={() => { setIsMinimized(true); }}
                    className="text-gray-400 hover:text-gray-600 text-xs"
                  >
                    minimize
                  </button>
                </div>
              </div>

              {clockedIn ? (
                // Clocked in state
                <div className="space-y-3">
                  <div className="text-center">
                    <div className="text-2xl font-mono font-bold text-green-600">
                      {formatTime(elapsedTime)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatHours(elapsedTime)} hours
                    </div>
                  </div>
                  <Button
                    onClick={() => { setShowClockOutDialog(true); }}
                    className="w-full bg-red-500 hover:bg-red-600"
                    size="sm"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    Clock Out
                  </Button>
                  <div className="grid grid-cols-2 gap-1">
                    <Link href="/time-entries">
                      <Button
                        variant="outline"
                        className="w-full text-xs py-1 h-7"
                        size="sm"
                      >
                        <List className="w-3 h-3 mr-1" />
                        Entries
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      className="w-full text-xs py-1 h-7"
                      size="sm"
                      onClick={() => setShowAvailabilityDialog(true)}
                    >
                      <Calendar className="w-3 h-3 mr-1" />
                      Availability
                    </Button>
                  </div>
                </div>
              ) : (
                // Clocked out state
                <div className="space-y-3">
                  <p className="text-xs text-gray-500 text-center">
                    Click to start tracking time
                  </p>
                  <Button
                    onClick={handleClockIn}
                    className="w-full bg-green-500 hover:bg-green-600"
                    size="sm"
                    disabled={clockingIn}
                  >
                    {clockingIn ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Clock In
                      </>
                    )}
                  </Button>
                  <div className="grid grid-cols-2 gap-1">
                    <Link href="/time-entries">
                      <Button
                        variant="outline"
                        className="w-full text-xs py-1 h-7"
                        size="sm"
                      >
                        <List className="w-3 h-3 mr-1" />
                        Entries
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      className="w-full text-xs py-1 h-7"
                      size="sm"
                      onClick={() => setShowAvailabilityDialog(true)}
                    >
                      <Calendar className="w-3 h-3 mr-1" />
                      Availability
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Clock Out Dialog */}
      <ClockOutDialog
        open={showClockOutDialog}
        onOpenChange={setShowClockOutDialog}
        session={currentSession}
        elapsedSeconds={elapsedTime}
        onComplete={handleClockOutComplete}
      />

      {/* Work Availability Dialog */}
      <Dialog open={showAvailabilityDialog} onOpenChange={setShowAvailabilityDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Set Work Availability</DialogTitle>
            <DialogDescription>
              Drag to mark unavailable times. Gray blocks indicate times you cannot work.
            </DialogDescription>
          </DialogHeader>
          {userProfile && (
            <Suspense fallback={<Skeleton className="h-32 w-full" />}>
              <DragAvailabilityCalendar
                userProfile={userProfile}
                onSave={() => {
                  toast.success('Availability saved')
                }}
              />
            </Suspense>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

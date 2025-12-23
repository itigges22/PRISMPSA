'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Clock, Play, Square, Timer, List } from 'lucide-react'
import { ClockOutDialog } from './clock-out-dialog'
import { toast } from 'sonner'
import { useAuth } from '@/lib/hooks/useAuth'
import { isUnassigned } from '@/lib/rbac'
import { useClockStatus } from '@/lib/hooks/use-data'

export function ClockWidget() {
  const { userProfile, loading: authLoading } = useAuth()
  // Only fetch clock status when authenticated (prevents 404 on login pages)
  const isAuthenticated = !authLoading && !!userProfile
  // Use SWR hook for automatic caching and revalidation
  const { clockedIn, currentSession, isLoading, mutate } = useClockStatus(isAuthenticated)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [clockingIn, setClockingIn] = useState(false)
  const [showClockOutDialog, setShowClockOutDialog] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)

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

  return (
    <>
      {/* Floating Widget */}
      <div className="fixed bottom-4 left-4 z-50">
        <Card className={`shadow-lg border-2 transition-all duration-200 ${
          clockedIn ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'
        }`}>
          {isMinimized ? (
            // Minimized view - just an icon
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
          ) : (
            // Expanded view
            <div className="p-4 min-w-[200px]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Timer className={`w-4 h-4 ${clockedIn ? 'text-green-600' : 'text-gray-500'}`} />
                  <span className="text-sm font-medium">
                    {clockedIn ? 'Clocked In' : 'Time Tracking'}
                  </span>
                </div>
                <button
                  onClick={() => { setIsMinimized(true); }}
                  className="text-gray-400 hover:text-gray-600 text-xs"
                >
                  minimize
                </button>
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
                  <Link href="/time-entries" className="block">
                    <Button
                      variant="outline"
                      className="w-full text-xs py-1 h-7"
                      size="sm"
                    >
                      <List className="w-3 h-3 mr-1" />
                      View Entries
                    </Button>
                  </Link>
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
                  <Link href="/time-entries" className="block">
                    <Button
                      variant="outline"
                      className="w-full text-xs py-1 h-7"
                      size="sm"
                    >
                      <List className="w-3 h-3 mr-1" />
                      View Entries
                    </Button>
                  </Link>
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
    </>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { AllProjectUpdate } from '@/lib/all-project-updates-service'
import { formatDistanceToNow } from 'date-fns'
import { Activity, Clock, User } from 'lucide-react'

interface ProjectUpdatesCardProps {
  className?: string;
}

// Helper function to render simple markdown (bold text) as React elements
function renderMarkdownContent(content: string): React.ReactNode {
  if (!content) return null

  // Split by **text** pattern and render bold parts
  const parts = content.split(/(\*\*[^*]+\*\*)/g)

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      // Remove the ** markers and render as bold
      return <strong key={index}>{part.slice(2, -2)}</strong>
    }
    return <span key={index}>{part}</span>
  })
}

export default function ProjectUpdatesCard({ className }: ProjectUpdatesCardProps) {
  const [updates, setUpdates] = useState<AllProjectUpdate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadUpdates()
  }, [])

  const loadUpdates = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Use API endpoint that filters based on permissions
      const response = await fetch('/api/project-updates')
      
      if (!response.ok) {
        // If 401/403, user might not be authenticated yet - return empty array
        if (response.status === 401 || response.status === 403) {
          setUpdates([])
          return
        }
        throw new Error(`Failed to fetch project updates: ${response.statusText}`)
      }
      
      const data = await response.json()
      setUpdates(data || [])
    } catch (err) {
      // Handle network errors gracefully (server not running, CORS, etc.)
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        // Network error - likely server not running or connection issue
        console.log('Network error - server may not be running, showing empty state')
        setUpdates([])
        setError(null) // Don't show error for network issues
        return
      }
      
      console.error('Error loading project updates:', err)
      // Don't show error for auth failures - just show empty state
      if (err instanceof Error && (err.message.includes('401') || err.message.includes('403'))) {
        setUpdates([])
      } else {
        setError('Failed to load project updates')
      }
    } finally {
      setLoading(false)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-blue-600" />
            <span>Project Updates</span>
          </CardTitle>
          <CardDescription>Latest updates from all projects</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-blue-600" />
            <span>Project Updates</span>
          </CardTitle>
          <CardDescription>Latest updates from all projects</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={loadUpdates} variant="outline">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={`w-full ${className ?? ''}`}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Activity className="w-5 h-5 text-blue-600" />
          <span>Project Updates</span>
        </CardTitle>
        <CardDescription>Latest updates from all projects across the organization</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-96 px-6 py-4">
          {updates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Activity className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No project updates yet</p>
              <p className="text-sm">Updates will appear here as team members post them</p>
            </div>
          ) : (
            <div className="space-y-4">
              {updates.map((update) => (
                <div key={update.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start space-x-3">
                    <Avatar className="w-8 h-8 flex-shrink-0">
                      <AvatarImage src={update.user_profiles?.image || ''} />
                      <AvatarFallback className="text-xs">
                        {getInitials(update.user_profiles?.name || 'U')}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2 mb-2">
                        <span className="font-medium text-sm">
                          {update.user_profiles?.name || 'Unknown User'}
                        </span>
                        <span className="hidden sm:inline text-gray-400">•</span>
                        <span className="text-xs text-gray-500 flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatDistanceToNow(new Date(update.created_at), { addSuffix: true })}</span>
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-700 mb-3 break-words">{renderMarkdownContent(update.content)}</p>
                      
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span className="font-medium">{update.projects?.name || 'Unknown Project'}</span>
                        <span className="hidden sm:inline">•</span>
                        <span className="break-all sm:break-normal">{update.projects?.accounts?.name || 'Unknown Account'}</span>
                        <span className="hidden sm:inline">•</span>
                        {(update as any).workflow_history?.workflow_nodes?.label ? (
                          <Badge className="text-xs whitespace-nowrap border bg-blue-100 text-blue-800 border-blue-300">
                            {(update as any).workflow_history.workflow_nodes.label}
                            {(update as any).workflow_history.approval_decision && (
                              <span className="ml-1">
                                ({(update as any).workflow_history.approval_decision})
                              </span>
                            )}
                          </Badge>
                        ) : (
                          <span className="text-xs text-gray-400">Manual update</span>
                        )}
                        <Badge variant="outline" className={`${getPriorityColor(update.projects?.priority || '')} text-xs whitespace-nowrap`}>
                          {update.projects?.priority || 'Unknown'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

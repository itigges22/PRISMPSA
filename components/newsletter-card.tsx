'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { newsletterService, Newsletter } from '@/lib/newsletter-service'
import { formatDistanceToNow } from 'date-fns'
import { Mail, Plus, Send, Clock, User, Edit, Trash2 } from 'lucide-react'
import NewsletterCreationDialog from './newsletter-creation-dialog'
import NewsletterEditDialog from './newsletter-edit-dialog'
import NewsletterDeleteDialog from './newsletter-delete-dialog'
import { useAuth } from '@/lib/hooks/useAuth'
import { hasPermission } from '@/lib/rbac'
import { Permission } from '@/lib/permissions'

interface NewsletterCardProps {
  className?: string;
  canCreate?: boolean;
}

export default function NewsletterCard({ className, canCreate = false }: NewsletterCardProps) {
  const [newsletters, setNewsletters] = useState<Newsletter[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingNewsletter, setEditingNewsletter] = useState<Newsletter | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [deletingNewsletter, setDeletingNewsletter] = useState<Newsletter | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const { userProfile } = useAuth()
  const [canViewNewsletters, setCanViewNewsletters] = useState(false)
  const [canCreateNewsletter, setCanCreateNewsletter] = useState(false)
  const [canEditNewsletter, setCanEditNewsletter] = useState(false)
  const [canDeleteNewsletter, setCanDeleteNewsletter] = useState(false)

  // Check permissions
  useEffect(() => {
    if (!userProfile) return
    
    async function checkPermissions() {
      const view = await hasPermission(userProfile, Permission.VIEW_NEWSLETTERS)
      const create = await hasPermission(userProfile, Permission.CREATE_NEWSLETTER)
      const edit = await hasPermission(userProfile, Permission.EDIT_NEWSLETTER)
      const del = await hasPermission(userProfile, Permission.DELETE_NEWSLETTER)
      
      setCanViewNewsletters(view)
      setCanCreateNewsletter(create)
      setCanEditNewsletter(edit)
      setCanDeleteNewsletter(del)
      
      // Only load newsletters if user can view them
      if (view) {
    loadNewsletters()
      }
    }
    
    checkPermissions()
  }, [userProfile])

  const loadNewsletters = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await newsletterService.getPublishedNewsletters()
      setNewsletters(data)
    } catch (err) {
      console.error('Error loading newsletters:', err)
      setError('Failed to load newsletters')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (newsletter: Newsletter) => {
    setDeletingNewsletter(newsletter)
    setIsDeleteDialogOpen(true)
  }

  const handleNewsletterDeleted = () => {
    loadNewsletters() // Refresh the list
  }

  const handleEdit = (newsletter: Newsletter) => {
    setEditingNewsletter(newsletter)
    setIsEditDialogOpen(true)
  }

  const handleNewsletterUpdated = () => {
    loadNewsletters() // Refresh the list
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  // Don't render if user can't view newsletters
  if (!canViewNewsletters && !loading) {
    return null
  }

  if (loading) {
    return (
      <Card className={`w-full ${className || ''}`}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Mail className="w-5 h-5 text-purple-600" />
            <span>Newsletters</span>
          </CardTitle>
          <CardDescription>Latest company-wide announcements</CardDescription>
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
      <Card className={`w-full ${className || ''}`}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Mail className="w-5 h-5 text-purple-600" />
            <span>Newsletters</span>
          </CardTitle>
          <CardDescription>Latest company-wide announcements</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-600 mb-4 break-words">{error}</p>
            <Button onClick={loadNewsletters} variant="outline" className="w-full sm:w-auto">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={`w-full ${className || ''}`}>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0">
          <div className="flex items-center space-x-2">
            <Mail className="w-5 h-5 text-purple-600" />
            <div>
            <CardTitle>Newsletters</CardTitle>
            <CardDescription>Latest company-wide announcements</CardDescription>
            </div>
          </div>
          {canCreateNewsletter && (
            <NewsletterCreationDialog onNewsletterCreated={loadNewsletters}>
              <Button size="sm" className="inline-flex items-center space-x-2 w-full sm:w-auto">
                <Plus className="w-4 h-4" />
                <span>Create</span>
              </Button>
            </NewsletterCreationDialog>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {newsletters.length === 0 ? (
          <div className="text-center py-8 text-gray-500 px-6">
            <Mail className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No newsletters yet</p>
            <p className="text-sm">
              {canCreate 
                ? 'Create the first company newsletter to keep everyone informed'
                : 'Newsletters will appear here when published by leadership'
              }
            </p>
          </div>
        ) : newsletters.length === 1 ? (
          <div className="px-6 py-4">
            <div className="space-y-4">
              {newsletters.map((newsletter) => (
                <div key={newsletter.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start space-x-3">
                    <Avatar className="w-8 h-8 flex-shrink-0">
                      <AvatarImage src={newsletter.user_profiles?.image || ''} />
                      <AvatarFallback className="text-xs">
                        {getInitials(newsletter.user_profiles?.name || 'L')}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 space-y-2 sm:space-y-0">
                        <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2">
                          <h4 className="font-semibold text-sm break-words">{newsletter.title}</h4>
                          {canViewNewsletters && newsletter.published_at && (
                            <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200 text-xs w-fit">
                              Published
                            </Badge>
                          )}
                        </div>
                        {(canEditNewsletter || canDeleteNewsletter) && (
                          <div className="flex items-center space-x-1">
                            {canEditNewsletter && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(newsletter)}
                              className="h-6 w-6 p-0 text-gray-500 hover:text-blue-600"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            )}
                            {canDeleteNewsletter && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(newsletter)}
                              className="h-6 w-6 p-0 text-gray-500 hover:text-red-600"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2 mb-3 text-xs text-gray-500">
                        <span className="flex items-center space-x-1">
                          <User className="w-3 h-3" />
                          <span className="break-words">{newsletter.user_profiles?.name || 'Leadership'}</span>
                        </span>
                        <span className="hidden sm:inline">•</span>
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>
                            {newsletter.published_at 
                              ? formatDistanceToNow(new Date(newsletter.published_at), { addSuffix: true })
                              : formatDistanceToNow(new Date(newsletter.created_at), { addSuffix: true })
                            }
                          </span>
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-700 line-clamp-3 break-words">
                        {newsletter.content}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <ScrollArea className="h-96 px-6 py-4">
            <div className="space-y-4">
              {newsletters.map((newsletter) => (
                <div key={newsletter.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start space-x-3">
                    <Avatar className="w-8 h-8 flex-shrink-0">
                      <AvatarImage src={newsletter.user_profiles?.image || ''} />
                      <AvatarFallback className="text-xs">
                        {getInitials(newsletter.user_profiles?.name || 'L')}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 space-y-2 sm:space-y-0">
                        <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2">
                          <h4 className="font-semibold text-sm break-words">{newsletter.title}</h4>
                          {canViewNewsletters && newsletter.published_at && (
                            <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200 text-xs w-fit">
                              Published
                            </Badge>
                          )}
                        </div>
                        {(canEditNewsletter || canDeleteNewsletter) && (
                          <div className="flex items-center space-x-1">
                            {canEditNewsletter && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(newsletter)}
                              className="h-6 w-6 p-0 text-gray-500 hover:text-blue-600"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            )}
                            {canDeleteNewsletter && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(newsletter)}
                              className="h-6 w-6 p-0 text-gray-500 hover:text-red-600"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2 mb-3 text-xs text-gray-500">
                        <span className="flex items-center space-x-1">
                          <User className="w-3 h-3" />
                          <span className="break-words">{newsletter.user_profiles?.name || 'Leadership'}</span>
                        </span>
                        <span className="hidden sm:inline">•</span>
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>
                            {newsletter.published_at 
                              ? formatDistanceToNow(new Date(newsletter.published_at), { addSuffix: true })
                              : formatDistanceToNow(new Date(newsletter.created_at), { addSuffix: true })
                            }
                          </span>
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-700 line-clamp-3 break-words">
                        {newsletter.content}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
      
      {/* Edit Dialog */}
      <NewsletterEditDialog
        newsletter={editingNewsletter}
        open={isEditDialogOpen}
        setOpen={setIsEditDialogOpen}
        onNewsletterUpdated={handleNewsletterUpdated}
      />
      
      {/* Delete Dialog */}
      <NewsletterDeleteDialog
        newsletter={deletingNewsletter}
        open={isDeleteDialogOpen}
        setOpen={setIsDeleteDialogOpen}
        onNewsletterDeleted={handleNewsletterDeleted}
      />
    </Card>
  )
}

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { newsletterService, NewsletterInput } from '@/lib/newsletter-service'
import { Plus, Send } from 'lucide-react'

interface NewsletterCreationDialogProps {
  onNewsletterCreated?: () => void;
  children?: React.ReactNode;
}

export default function NewsletterCreationDialog({ 
  onNewsletterCreated,
  children 
}: NewsletterCreationDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<NewsletterInput>({
    title: '',
    content: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title.trim() || !formData.content.trim()) {
      return
    }

    setLoading(true)
    try {
      await newsletterService.createNewsletter(formData)
      setFormData({ title: '', content: '' })
      setOpen(false)
      onNewsletterCreated?.()
    } catch (error) {
      console.error('Error creating newsletter:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: keyof NewsletterInput, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button className="inline-flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>Create Newsletter</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Send className="w-5 h-5" />
            <span>Create Newsletter</span>
          </DialogTitle>
          <DialogDescription>
            Create a company-wide newsletter that will be displayed on the welcome page.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Enter newsletter title..."
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => handleInputChange('content', e.target.value)}
              placeholder="Enter newsletter content..."
              rows={8}
              required
            />
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.title.trim() || !formData.content.trim()}>
              {loading ? 'Creating...' : 'Create Newsletter'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

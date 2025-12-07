'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { newsletterService, Newsletter } from '@/lib/newsletter-service'
import { toast } from 'sonner'

interface NewsletterEditDialogProps {
  newsletter: Newsletter | null
  open: boolean
  setOpen: (open: boolean) => void
  onNewsletterUpdated?: () => void
}

export default function NewsletterEditDialog({ 
  newsletter, 
  open, 
  setOpen, 
  onNewsletterUpdated 
}: NewsletterEditDialogProps) {
  const [formData, setFormData] = useState({ title: '', content: '' })
  const [loading, setLoading] = useState(false)

  // Update form data when newsletter changes
  useEffect(() => {
    if (newsletter) {
      setFormData({
        title: newsletter.title,
        content: newsletter.content
      })
    }
  }, [newsletter])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target
    setFormData(prev => ({ ...prev, [id]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newsletter) return

    setLoading(true)
    try {
      await newsletterService.updateNewsletter(newsletter.id, formData)
      setOpen(false)
      onNewsletterUpdated?.()
      toast.success('Newsletter updated successfully!')
    } catch (error) {
      console.error('Error updating newsletter:', error)
      toast.error(`Failed to update newsletter: ${(error as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  if (!newsletter) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Newsletter</DialogTitle>
          <DialogDescription>
            Update the newsletter content and title.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">
              Title
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={handleChange}
              className="col-span-3"
              required
            />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="content" className="text-right">
              Content
            </Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={handleChange}
              className="col-span-3 min-h-[150px]"
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setOpen(false); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update Newsletter'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

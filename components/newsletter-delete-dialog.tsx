'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { newsletterService, Newsletter } from '@/lib/newsletter-service'
import { toast } from 'sonner'
import { AlertTriangle, Trash2 } from 'lucide-react'

interface NewsletterDeleteDialogProps {
  newsletter: Newsletter | null
  open: boolean
  setOpen: (open: boolean) => void
  onNewsletterDeleted?: () => void
}

export default function NewsletterDeleteDialog({ 
  newsletter, 
  open, 
  setOpen, 
  onNewsletterDeleted 
}: NewsletterDeleteDialogProps) {
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!newsletter) return

    setLoading(true)
    try {
      await newsletterService.deleteNewsletter(newsletter.id)
      setOpen(false)
      onNewsletterDeleted?.()
      toast.success('Newsletter deleted successfully!')
    } catch (error) {
      console.error('Error deleting newsletter:', error)
      toast.error(`Failed to delete newsletter: ${(error as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  if (!newsletter) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <DialogTitle>Delete Newsletter</DialogTitle>
          </div>
          <DialogDescription>
            Are you sure you want to delete "{newsletter.title}"? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Trash2 className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-red-800">Warning</h4>
                <p className="text-sm text-red-700 mt-1">
                  This newsletter will be permanently removed and cannot be recovered.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            type="button" 
            variant="destructive" 
            onClick={handleDelete}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700"
          >
            {loading ? 'Deleting...' : 'Delete Newsletter'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

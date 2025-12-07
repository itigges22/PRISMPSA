'use client'

import { toast } from 'sonner';
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { departmentClientService } from '@/lib/department-client-service'
import { Trash2, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { hasPermission } from '@/lib/rbac'
import { Permission } from '@/lib/permissions'

interface DepartmentDeleteDialogProps {
  departmentId: string
  departmentName: string
  onDepartmentDeleted?: () => void
  children?: React.ReactNode
}

export default function DepartmentDeleteDialog({ 
  departmentId,
  departmentName,
  onDepartmentDeleted,
  children 
}: DepartmentDeleteDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const { userProfile } = useAuth()
  const [canDeleteDepartment, setCanDeleteDepartment] = useState(false)

  // Check permissions
  useEffect(() => {
    if (!userProfile) return;
    
    async function checkPermissions() {
      const canDelete = await hasPermission(userProfile, Permission.DELETE_DEPARTMENT, { departmentId });
      setCanDeleteDepartment(canDelete);
    }
    
    checkPermissions();
  }, [userProfile, departmentId]);

  const handleDelete = async () => {
    if (!canDeleteDepartment) {
      toast.error('You do not have permission to delete departments.');
      setOpen(false);
      return;
    }
    
    setLoading(true)
    try {
      const success = await departmentClientService.deleteDepartment(departmentId)
      
      if (success) {
        setOpen(false)
        onDepartmentDeleted?.()
        toast.error('Department deleted successfully!')
      } else {
        toast.error('Failed to delete department. Please try again.')
      }
    } catch (error) {
      console.error('Error deleting department:', error)
      toast.error('An error occurred while deleting the department.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Delete Department?
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the department and all associated data.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 pt-2">
          <p className="text-sm text-muted-foreground">
            You are about to delete <span className="font-semibold text-gray-900">&quot;{departmentName}&quot;</span>.
          </p>
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-800">
              ⚠️ <strong>Warning:</strong> This action cannot be undone. All department data, including:
            </p>
            <ul className="text-sm text-red-800 mt-2 ml-4 list-disc">
              <li>Department settings and configuration</li>
              <li>All roles and permissions</li>
              <li>User assignments to this department</li>
              <li>All projects assigned to this department</li>
              <li>Department analytics and metrics</li>
            </ul>
            <p className="text-sm text-red-800 mt-2">
              <strong>This data will be permanently removed.</strong>
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700"
          >
            {loading ? 'Deleting...' : 'Delete Department'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

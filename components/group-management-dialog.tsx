'use client';
import { toast } from 'sonner';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { UsersIcon, PlusIcon, TrashIcon } from 'lucide-react';
import { supabaseTaskService, type TaskGroup } from '@/lib/supabase-task-service';

interface GroupManagementDialogProps {
  children?: React.ReactNode;
  onGroupCreated?: (group: TaskGroup) => void;
  onGroupDeleted?: (groupId: string) => void;
}

export default function GroupManagementDialog({ 
  children, 
  onGroupCreated,
  onGroupDeleted 
}: GroupManagementDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<string | null>(null);

  // Load groups when dialog opens
  useEffect(() => {
    if (open) {
      loadGroups();
    }
  }, [open]);

  const loadGroups = async () => {
    try {
      const groupsData = await supabaseTaskService.getGroups();
      setGroups(groupsData);
    } catch (error: unknown) {
      console.error('Error loading groups:', error);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    setLoading(true);
    try {
      const newGroup = await supabaseTaskService.createGroup({
        name: newGroupName.trim(),
      });
      
      if (newGroup) {
        // Add to local state immediately for instant UI update
        setGroups(prev => [...prev, newGroup]);
        onGroupCreated?.(newGroup);
        setNewGroupName('');
      }
    } catch (error: unknown) {
      console.error('Error creating group:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = (groupId: string) => {
    // Prevent deletion of the default "General" group
    if (groupId === 'general') {
      toast.error('Cannot delete the default "General" group. This group is required for the system to function properly.');
      return;
    }

    setGroupToDelete(groupId);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteGroup = async () => {
    if (!groupToDelete) return;

    try {
      const success = await supabaseTaskService.deleteGroup(groupToDelete);
      if (success) {
        setGroups(prev => prev.filter((group: any) => group.id !== groupToDelete));
        onGroupDeleted?.(groupToDelete);
      }
    } catch (error: unknown) {
      console.error('Error deleting group:', error);
    } finally {
      setDeleteDialogOpen(false);
      setGroupToDelete(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <UsersIcon className="h-4 w-4" />
            Manage Groups
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UsersIcon className="h-5 w-5" />
            Manage Groups & Teams
          </DialogTitle>
          <DialogDescription>
            Create new groups/teams or manage existing ones. Groups help organize your tasks by department or project.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Create new group form */}
          <form onSubmit={handleCreateGroup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="groupName">Group/Team Name</Label>
              <div className="flex gap-2">
                <Input
                  id="groupName"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g., Frontend Team, Marketing, Engineering"
                  required
                />
                <Button type="submit" disabled={loading || !newGroupName.trim()}>
                  <PlusIcon className="h-4 w-4" />
                  Add
                </Button>
              </div>
            </div>
          </form>

          {/* Existing groups list */}
          <div className="space-y-2">
            <Label>Existing Groups & Teams</Label>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {groups.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  No groups created yet. Create your first group above.
                </div>
              ) : (
                groups.map((group:any) => {
                  const isDefaultGroup = group.id === 'general';
                  return (
                    <div
                      key={group.id}
                      className={`flex items-center justify-between p-3 border rounded-lg ${
                        isDefaultGroup ? 'bg-muted/50' : 'bg-card'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <UsersIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{group.name}</span>
                        {isDefaultGroup && (
                          <span className="text-xs text-muted-foreground">(Default)</span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteGroup(group.id)}
                        disabled={isDefaultGroup}
                        className={`${
                          isDefaultGroup
                            ? 'text-muted-foreground cursor-not-allowed'
                            : 'text-destructive hover:text-destructive hover:bg-destructive/10'
                        }`}
                        title={isDefaultGroup ? 'Cannot delete default group' : 'Delete group'}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this group? Any tasks in this group will be moved to the &quot;General&quot; group. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteGroup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

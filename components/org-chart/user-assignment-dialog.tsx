'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, UserPlus, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { RoleWithUsers } from './role-hierarchy-dnd';

interface User {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

interface UserAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: RoleWithUsers | null;
  onSuccess: () => void;
  isEditMode?: boolean; // NEW: Indicates if parent is in Edit Mode
  onLocalAssign?: (roleId: string, userId: string, userName: string) => void; // NEW: For local assignment in Edit Mode
}

export function UserAssignmentDialog({ 
  open, 
  onOpenChange, 
  role, 
  onSuccess,
  isEditMode = false,
  onLocalAssign
}: UserAssignmentDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [assignedUserIds, setAssignedUserIds] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (open && role) {
      loadUsers();
      loadAssignedUsers();
    } else {
      setSearchQuery('');
      setUsers([]);
      setAssignedUserIds(new Set());
    }
  }, [open, role]);

  async function loadUsers() {
    try {
      setLoading(true);
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to load users');
      const data = await response.json();
      // API returns { users: [...] }, so extract the users array
      setUsers(Array.isArray(data.users) ? data.users : (Array.isArray(data) ? data : []));
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Failed to load users');
      setUsers([]); // Ensure users is always an array
    } finally {
      setLoading(false);
    }
  }

  async function loadAssignedUsers() {
    if (!role) return;
    
    try {
      const response = await fetch(`/api/roles/${role.id}/users`);
      if (!response.ok) throw new Error('Failed to load assigned users');
      const data = await response.json();
      // Ensure data is an array before mapping
      const usersArray = Array.isArray(data) ? data : [];
      setAssignedUserIds(new Set(usersArray.map((u: User) => u.id)));
    } catch (error) {
      console.error('Error loading assigned users:', error);
      setAssignedUserIds(new Set()); // Ensure it's always a Set
    }
  }

  async function assignUser(userId: string) {
    if (!role) return;

    const user = users.find(u => u.id === userId);
    if (!user) return;

    // If in Edit Mode, just queue the assignment locally
    if (isEditMode && onLocalAssign) {
      console.log('🎯 Edit Mode: Queueing user assignment locally', { roleId: role.id, userId, userName: user.name });
      onLocalAssign(role.id, userId, user.name);
      setAssignedUserIds(prev => new Set([...prev, userId]));
      toast.success('Assignment queued. Click "Save Changes" to apply.', {
        description: `${user.name} will be assigned to "${role.name}" when you save.`
      });
      return;
    }

    // Otherwise, assign immediately to the database
    try {
      setAssigning(true);
      const response = await fetch(`/api/roles/${role.id}/assign-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to assign user');
      }

      toast.success('User assigned successfully');
      setAssignedUserIds(prev => new Set([...prev, userId]));
      onSuccess();
    } catch (error: any) {
      console.error('Error assigning user:', error);
      toast.error(error.message || 'Failed to assign user');
    } finally {
      setAssigning(false);
    }
  }

  async function removeUser(userId: string) {
    if (!role) return;

    try {
      setAssigning(true);
      const response = await fetch(`/api/roles/${role.id}/remove-user/${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove user');
      }

      toast.success('User removed successfully');
      setAssignedUserIds(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
      onSuccess();
    } catch (error: any) {
      console.error('Error removing user:', error);
      toast.error(error.message || 'Failed to remove user');
    } finally {
      setAssigning(false);
    }
  }

  // Safety check: ensure users is always an array
  const usersArray = Array.isArray(users) ? users : [];
  const filteredUsers = usersArray.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const assignedUsers = filteredUsers.filter(u => assignedUserIds.has(u.id));
  const unassignedUsers = filteredUsers.filter(u => !assignedUserIds.has(u.id));

  if (!role) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Users - {role.name}</DialogTitle>
          <DialogDescription>
            Assign or remove users from this role
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Assigned Users */}
              {assignedUsers.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                    Assigned Users
                    <Badge variant="secondary">{assignedUsers.length}</Badge>
                  </h3>
                  <ScrollArea className="h-48 border rounded-lg">
                    <div className="p-2 space-y-1">
                      {assignedUsers.map(user => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-2 rounded hover:bg-gray-50"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              {user.image ? (
                                <img src={user.image} alt={user.name} />
                              ) : (
                                <div className="flex items-center justify-center h-full w-full bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm font-medium">
                                  {user.name.charAt(0)}
                                </div>
                              )}
                            </Avatar>
                            <div>
                              <div className="text-sm font-medium">{user.name}</div>
                              <div className="text-xs text-gray-500">{user.email}</div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeUser(user.id)}
                            disabled={assigning}
                            className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Unassigned Users */}
              {unassignedUsers.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                    Available Users
                    <Badge variant="outline">{unassignedUsers.length}</Badge>
                  </h3>
                  <ScrollArea className="h-48 border rounded-lg">
                    <div className="p-2 space-y-1">
                      {unassignedUsers.map(user => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-2 rounded hover:bg-gray-50"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              {user.image ? (
                                <img src={user.image} alt={user.name} />
                              ) : (
                                <div className="flex items-center justify-center h-full w-full bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm font-medium">
                                  {user.name.charAt(0)}
                                </div>
                              )}
                            </Avatar>
                            <div>
                              <div className="text-sm font-medium">{user.name}</div>
                              <div className="text-xs text-gray-500">{user.email}</div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => assignUser(user.id)}
                            disabled={assigning}
                            className="h-7"
                          >
                            <UserPlus className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {filteredUsers.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p>No users found</p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


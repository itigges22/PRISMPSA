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
import { UserIcon, PlusIcon, TrashIcon } from 'lucide-react';
import { supabaseTaskService, type User } from '@/lib/supabase-task-service';

interface PeopleManagementDialogProps {
  children?: React.ReactNode;
  onPersonCreated?: (person: User) => void;
  onPersonDeleted?: (personId: string) => void;
}

export default function PeopleManagementDialog({ 
  children, 
  onPersonCreated,
  onPersonDeleted 
}: PeopleManagementDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [people, setPeople] = useState<User[]>([]);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonImage, setNewPersonImage] = useState('');

  // Load people when dialog opens
  useEffect(() => {
    if (open) {
      loadPeople();
    }
  }, [open]);

  const loadPeople = async () => {
    try {
      const peopleData = await supabaseTaskService.getUsers();
      setPeople(peopleData);
    } catch (error) {
      console.error('Error loading people:', error);
    }
  };

  const handleCreatePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPersonName.trim()) return;

    setLoading(true);
    try {
      const newPerson = await supabaseTaskService.createUser({
        name: newPersonName.trim(),
        image: newPersonImage.trim() || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face',
      });
      
      if (newPerson) {
        // Add to local state immediately for instant UI update
        setPeople(prev => [...prev, newPerson]);
        onPersonCreated?.(newPerson);
        setNewPersonName('');
        setNewPersonImage('');
      }
    } catch (error) {
      console.error('Error creating person:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePerson = async (personId: string) => {
    // Prevent deletion of the default "Unassigned" user
    if (personId === 'default-user') {
      toast.error('Cannot delete the default "Unassigned" user. This user is required for the system to function properly.');
      return;
    }

    if (!confirm('Are you sure you want to delete this person? Any tasks assigned to this person will be reassigned to "Unassigned". This action cannot be undone.')) {
      return;
    }

    try {
      const success = await supabaseTaskService.deleteUser(personId);
      if (success) {
        setPeople(prev => prev.filter(person => person.id !== personId));
        onPersonDeleted?.(personId);
      }
    } catch (error) {
      console.error('Error deleting person:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <UserIcon className="h-4 w-4" />
            Manage People
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            Manage People
          </DialogTitle>
          <DialogDescription>
            Add new team members or manage existing ones. People can be assigned to tasks and projects.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Create new person form */}
          <form onSubmit={handleCreatePerson} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="personName">Name</Label>
                <Input
                  id="personName"
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  placeholder="e.g., John Doe"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="personImage">Profile Image URL (Optional)</Label>
                <Input
                  id="personImage"
                  value={newPersonImage}
                  onChange={(e) => setNewPersonImage(e.target.value)}
                  placeholder="https://example.com/photo.jpg"
                />
              </div>
            </div>
            <Button type="submit" disabled={loading || !newPersonName.trim()} className="w-full">
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Person
            </Button>
          </form>

          {/* Existing people list */}
          <div className="space-y-2">
            <Label>Existing People</Label>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {people.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  No people added yet. Add your first team member above.
                </div>
              ) : (
                people.map((person) => {
                  const isDefaultUser = person.id === 'default-user';
                  return (
                    <div
                      key={person.id}
                      className={`flex items-center justify-between p-3 border rounded-lg ${
                        isDefaultUser ? 'bg-muted/50' : 'bg-card'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-muted">
                          <img
                            src={person.image}
                            alt={person.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face';
                            }}
                          />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium">{person.name}</span>
                          {isDefaultUser && (
                            <span className="text-xs text-muted-foreground">(Default)</span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeletePerson(person.id)}
                        disabled={isDefaultUser}
                        className={`${
                          isDefaultUser
                            ? 'text-muted-foreground cursor-not-allowed'
                            : 'text-destructive hover:text-destructive hover:bg-destructive/10'
                        }`}
                        title={isDefaultUser ? 'Cannot delete default user' : 'Delete person'}
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
    </Dialog>
  );
}

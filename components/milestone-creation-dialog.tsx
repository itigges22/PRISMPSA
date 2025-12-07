'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FlagIcon } from 'lucide-react';
import { supabaseTaskService, type Milestone } from '@/lib/supabase-task-service';

interface MilestoneCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  onMilestoneCreated?: (milestone: Milestone) => void;
}

const milestoneColors = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#10b981' },
  { name: 'Yellow', value: '#f59e0b' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Orange', value: '#f97316' },
];

export default function MilestoneCreationDialog({ 
  open,
  onOpenChange,
  date,
  onMilestoneCreated 
}: MilestoneCreationDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3b82f6',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const createData = {
        name: formData.name,
        description: formData.description || undefined,
        date: date,
        color: formData.color,
      };

      console.log('Creating milestone with data:', createData);
      const newMilestone = await supabaseTaskService.createMilestone(createData);
      console.log('Milestone creation result:', newMilestone);
      
      if (newMilestone) {
        onMilestoneCreated?.(newMilestone);
        onOpenChange(false);
        setFormData({
          name: '',
          description: '',
          color: '#3b82f6',
        });
      } else {
        console.error('Failed to create milestone - no result returned');
      }
    } catch (error) {
      console.error('Error creating milestone:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlagIcon className="h-5 w-5" />
            Create Milestone
          </DialogTitle>
          <DialogDescription>
            Add a milestone for {date.toLocaleDateString()}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Milestone Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => { handleInputChange('name', e.target.value); }}
                placeholder="e.g., Project Launch"
                required
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => { handleInputChange('description', e.target.value); }}
                placeholder="Describe what this milestone represents..."
                rows={3}
              />
            </div>

            <div className="grid gap-2">
              <Label>Color</Label>
              <div className="grid grid-cols-4 gap-2">
                {milestoneColors.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    className={`w-full h-8 rounded border-2 ${
                      formData.color === color.value 
                        ? 'border-gray-900' 
                        : 'border-gray-200'
                    }`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => { handleInputChange('color', color.value); }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { onOpenChange(false); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Milestone'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
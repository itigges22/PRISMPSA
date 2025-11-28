'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from 'lucide-react';
import { format } from 'date-fns';

type MilestoneDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateMilestone: (data: {
    name: string;
    description: string;
    date: Date;
    color: string;
  }) => Promise<void>;
  initialDate?: Date;
};

const PRESET_COLORS = [
  { name: 'Blue', value: '#3b82f6', className: 'bg-blue-500' },
  { name: 'Green', value: '#10b981', className: 'bg-green-500' },
  { name: 'Yellow', value: '#f59e0b', className: 'bg-yellow-500' },
  { name: 'Red', value: '#ef4444', className: 'bg-red-500' },
  { name: 'Purple', value: '#a855f7', className: 'bg-purple-500' },
  { name: 'Pink', value: '#ec4899', className: 'bg-pink-500' },
  { name: 'Indigo', value: '#6366f1', className: 'bg-indigo-500' },
  { name: 'Teal', value: '#14b8a6', className: 'bg-teal-500' },
];

export function MilestoneDialog({
  open,
  onOpenChange,
  onCreateMilestone,
  initialDate,
}: MilestoneDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(
    initialDate ? format(initialDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
  );
  const [color, setColor] = useState('#3b82f6');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update date when initialDate changes (when user clicks on timeline)
  useEffect(() => {
    if (initialDate) {
      setDate(format(initialDate, 'yyyy-MM-dd'));
    }
  }, [initialDate]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      // Reset form when dialog closes
      setName('');
      setDescription('');
      setColor('#3b82f6');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreateMilestone({
        name: name.trim(),
        description: description.trim(),
        date: new Date(date),
        color,
      });

      // Close dialog (form will be reset by useEffect)
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create milestone:', error);
      alert('Failed to create milestone. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Create Milestone
            </DialogTitle>
            <DialogDescription>
              Add a milestone marker to your Gantt chart timeline.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">
                Milestone Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g., Project Kickoff, Design Review..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Add additional details about this milestone..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="date">
                Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((presetColor) => (
                  <button
                    key={presetColor.value}
                    type="button"
                    className={`h-8 w-8 rounded-md border-2 transition-all ${
                      presetColor.className
                    } ${
                      color === presetColor.value
                        ? 'border-foreground scale-110'
                        : 'border-border hover:scale-105'
                    }`}
                    onClick={() => setColor(presetColor.value)}
                    title={presetColor.name}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? 'Creating...' : 'Create Milestone'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


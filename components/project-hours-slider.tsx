'use client';

import { useState, useEffect } from 'react';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Clock, AlertTriangle } from 'lucide-react';
import { createClientSupabase } from '@/lib/supabase';

interface ProjectHoursSliderProps {
  projectId: string;
  initialHours: number; // This is the REMAINING hours
  estimatedHours: number; // This is the total estimated hours (max for slider)
  taskHoursSum?: number; // Sum of all task estimated hours
  onHoursChange?: (newHours: number) => void;
  compact?: boolean; // For inline display
}

export default function ProjectHoursSlider({
  projectId,
  initialHours,
  estimatedHours,
  taskHoursSum = 0,
  onHoursChange,
  compact = false,
}: ProjectHoursSliderProps) {
  // Use the higher of estimated hours or task sum as max
  const maxHours = Math.max(estimatedHours || 0, taskHoursSum || 0);

  const [hours, setHours] = useState(initialHours || maxHours);
  const [saving, setSaving] = useState(false);
  const [inputValue, setInputValue] = useState(String(initialHours || maxHours));

  // Update local state when props change
  useEffect(() => {
    const remaining = initialHours || maxHours;
    setHours(remaining);
    setInputValue(String(remaining));
  }, [initialHours, maxHours]);

  // Don't render if no estimated hours are set
  if (!maxHours || maxHours <= 0) {
    if (compact) {
      return (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          <span>No est.</span>
        </div>
      );
    }
    return (
      <div className="text-sm text-muted-foreground">
        No estimated hours set. Edit project to add estimate.
      </div>
    );
  }

  // Calculate progress percentage
  const progressPercent = maxHours > 0 ? Math.round(((maxHours - hours) / maxHours) * 100) : 0;

  const handleSliderChange = async (value: number[]) => {
    const newHours = value[0];
    setHours(newHours);
    setInputValue(String(newHours));
    await saveHours(newHours);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = async () => {
    let newHours = parseFloat(inputValue) || 0;
    if (newHours < 0) newHours = 0;
    if (newHours > maxHours) newHours = maxHours;

    setHours(newHours);
    setInputValue(String(newHours));
    await saveHours(newHours);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  const saveHours = async (newHours: number) => {
    setSaving(true);
    try {
      const supabase = createClientSupabase();

      // Clamp to valid range
      const finalHours = Math.max(0, Math.min(newHours, maxHours));

      const { error } = await supabase
        .from('projects')
        .update({
          remaining_hours: finalHours,
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId);

      if (error) {
        console.error('Error updating project remaining hours:', error.message || error.code || JSON.stringify(error));
      } else {
        if (finalHours !== newHours) {
          setHours(finalHours);
          setInputValue(String(finalHours));
        }
        onHoursChange?.(finalHours);
      }
    } catch (error) {
      console.error('Error saving project remaining hours:', error);
    } finally {
      setSaving(false);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <Slider
            value={[hours]}
            onValueChange={handleSliderChange}
            max={maxHours}
            step={0.5}
            className="flex-1"
          />
          <Input
            type="number"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            className="w-16 h-6 text-xs px-1.5"
            min={0}
            max={maxHours}
            step={0.5}
          />
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            / {maxHours}h
          </span>
        </div>
        <span className={`text-xs font-medium ${progressPercent >= 100 ? 'text-green-600' : progressPercent >= 75 ? 'text-blue-600' : 'text-gray-600'}`}>
          {progressPercent}%
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Remaining Hours</span>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            className="w-20 h-8 text-sm"
            min={0}
            max={maxHours}
            step={0.5}
          />
          <span className="text-sm text-muted-foreground">/ {maxHours}h</span>
        </div>
      </div>

      <Slider
        value={[hours]}
        onValueChange={handleSliderChange}
        max={maxHours}
        step={0.5}
        className="w-full"
      />

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>0h (Complete)</span>
        <span>{maxHours}h (Not Started)</span>
      </div>

      <div className={`text-xs p-2 rounded ${progressPercent >= 100 ? 'bg-green-50 text-green-800' : progressPercent >= 75 ? 'bg-blue-50 text-blue-800' : 'bg-gray-50 text-gray-800'}`}>
        <span className="font-medium">{progressPercent}% complete</span>
        <span className="ml-2">({(maxHours - hours).toFixed(1)}h worked)</span>
      </div>

      {saving && (
        <div className="text-xs text-muted-foreground">Saving...</div>
      )}
    </div>
  );
}

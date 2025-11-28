import { createClientSupabase } from '@/lib/supabase';

export type Milestone = {
  id: string;
  name: string;
  description?: string | null;
  date: string; // ISO timestamp
  color?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type MilestoneInput = {
  name: string;
  description?: string;
  date: Date;
  color?: string;
};

/**
 * Fetch all milestones from the database
 */
export async function getMilestones(): Promise<Milestone[]> {
  const supabase = createClientSupabase();
  
  const { data, error } = await supabase
    .from('milestones')
    .select('*')
    .order('date', { ascending: true });

  if (error) {
    console.error('Error fetching milestones:', error);
    throw new Error(`Failed to fetch milestones: ${error.message}`);
  }

  return data || [];
}

/**
 * Create a new milestone
 */
export async function createMilestone(input: MilestoneInput): Promise<Milestone> {
  const supabase = createClientSupabase();

  const { data, error } = await supabase
    .from('milestones')
    .insert({
      name: input.name,
      description: input.description,
      date: input.date.toISOString(),
      color: input.color || '#3b82f6',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating milestone:', error);
    throw new Error(`Failed to create milestone: ${error.message}`);
  }

  return data;
}

/**
 * Update an existing milestone
 */
export async function updateMilestone(
  id: string,
  input: Partial<MilestoneInput>
): Promise<Milestone> {
  const supabase = createClientSupabase();

  const updateData: any = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.date !== undefined) updateData.date = input.date.toISOString();
  if (input.color !== undefined) updateData.color = input.color;

  const { data, error } = await supabase
    .from('milestones')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating milestone:', error);
    throw new Error(`Failed to update milestone: ${error.message}`);
  }

  return data;
}

/**
 * Delete a milestone
 */
export async function deleteMilestone(id: string): Promise<void> {
  const supabase = createClientSupabase();

  const { error } = await supabase
    .from('milestones')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting milestone:', error);
    throw new Error(`Failed to delete milestone: ${error.message}`);
  }
}


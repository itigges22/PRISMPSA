/**
 * Time Entry Service
 * Manages time logging on tasks and projects
 */

import { createClientSupabase } from '../supabase';
import { Database } from '../supabase';

type TimeEntry = Database['public']['Tables']['time_entries']['Row'];
type TimeEntryInsert = Database['public']['Tables']['time_entries']['Insert'];
type TimeEntryUpdate = Database['public']['Tables']['time_entries']['Update'];

export interface TimeEntryWithDetails extends TimeEntry {
  task?: {
    id: string;
    name: string;
  };
  project?: {
    id: string;
    name: string;
  };
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

class TimeEntryService {
  /**
   * Get Monday of the week for a given date
   */
  getWeekStartDate(date: Date = new Date()): string {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split('T')[0];
  }

  /**
   * Log time on a task
   */
  async logTime(
    taskId: string,
    userId: string,
    projectId: string,
    hoursLogged: number,
    entryDate: string,
    description?: string
  ): Promise<TimeEntry | null> {
    const supabase = createClientSupabase();
    if (!supabase) return null;

    const weekStartDate = this.getWeekStartDate(new Date(entryDate));

    const insertData: TimeEntryInsert = {
      task_id: taskId,
      user_id: userId,
      project_id: projectId,
      hours_logged: hoursLogged,
      entry_date: entryDate,
      week_start_date: weekStartDate,
      description: description || null,
    };

    const { data, error } = await supabase
      .from('time_entries')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error logging time:', error);
      return null;
    }

    return data;
  }

  /**
   * Get time entries for a user
   */
  async getUserTimeEntries(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<TimeEntryWithDetails[]> {
    const supabase = createClientSupabase();
    if (!supabase) return [];

    let query = supabase
      .from('time_entries')
      .select(`
        *,
        task:tasks(id, name),
        project:projects(id, name),
        user:user_profiles(id, name, email)
      `)
      .eq('user_id', userId)
      .order('entry_date', { ascending: false });

    if (startDate) {
      query = query.gte('entry_date', startDate);
    }

    if (endDate) {
      query = query.lte('entry_date', endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching user time entries:', error);
      return [];
    }

    return (data as unknown as TimeEntryWithDetails[]) || [];
  }

  /**
   * Get time entries for a task
   */
  async getTaskTimeEntries(taskId: string): Promise<TimeEntryWithDetails[]> {
    const supabase = createClientSupabase();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('time_entries')
      .select(`
        *,
        task:tasks(id, name),
        project:projects(id, name),
        user:user_profiles(id, name, email)
      `)
      .eq('task_id', taskId)
      .order('entry_date', { ascending: false });

    if (error) {
      console.error('Error fetching task time entries:', error);
      return [];
    }

    return (data as unknown as TimeEntryWithDetails[]) || [];
  }

  /**
   * Get time entries for a project
   */
  async getProjectTimeEntries(
    projectId: string,
    weekStartDate?: string
  ): Promise<TimeEntryWithDetails[]> {
    const supabase = createClientSupabase();
    if (!supabase) return [];

    let query = supabase
      .from('time_entries')
      .select(`
        *,
        task:tasks(id, name),
        project:projects(id, name),
        user:user_profiles(id, name, email)
      `)
      .eq('project_id', projectId)
      .order('entry_date', { ascending: false });

    if (weekStartDate) {
      query = query.eq('week_start_date', weekStartDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching project time entries:', error);
      return [];
    }

    return (data as unknown as TimeEntryWithDetails[]) || [];
  }

  /**
   * Get weekly time summary for a user
   */
  async getUserWeeklySummary(
    userId: string,
    weekStartDate: string
  ): Promise<{ totalHours: number; entriesCount: number }> {
    const supabase = createClientSupabase();
    if (!supabase) return { totalHours: 0, entriesCount: 0 };

    const { data, error } = await supabase
      .from('time_entries')
      .select('hours_logged')
      .eq('user_id', userId)
      .eq('week_start_date', weekStartDate);

    if (error) {
      console.error('Error fetching weekly summary:', error);
      return { totalHours: 0, entriesCount: 0 };
    }

    const totalHours = data.reduce((sum: number, entry: any) => sum + (entry.hours_logged || 0), 0);

    return {
      totalHours,
      entriesCount: data.length,
    };
  }

  /**
   * Update a time entry
   */
  async updateTimeEntry(
    entryId: string,
    updates: {
      hours_logged?: number;
      entry_date?: string;
      description?: string;
    }
  ): Promise<TimeEntry | null> {
    const supabase = createClientSupabase();
    if (!supabase) return null;

    const updateData: TimeEntryUpdate = {};

    if (updates.hours_logged !== undefined) {
      updateData.hours_logged = updates.hours_logged;
    }

    if (updates.entry_date) {
      updateData.entry_date = updates.entry_date;
      updateData.week_start_date = this.getWeekStartDate(new Date(updates.entry_date));
    }

    if (updates.description !== undefined) {
      updateData.description = updates.description;
    }

    const { data, error } = await supabase
      .from('time_entries')
      .update(updateData)
      .eq('id', entryId)
      .select()
      .single();

    if (error) {
      console.error('Error updating time entry:', error);
      return null;
    }

    return data;
  }

  /**
   * Delete a time entry
   */
  async deleteTimeEntry(entryId: string): Promise<boolean> {
    const supabase = createClientSupabase();
    if (!supabase) return false;

    const { error } = await supabase
      .from('time_entries')
      .delete()
      .eq('id', entryId);

    if (error) {
      console.error('Error deleting time entry:', error);
      return false;
    }

    return true;
  }

  /**
   * Get time entries for multiple weeks (for charts/trends)
   */
  async getUserTimeEntriesByWeek(
    userId: string,
    numberOfWeeks: number = 8
  ): Promise<Record<string, number>> {
    const supabase = createClientSupabase();
    if (!supabase) return {};

    // Calculate start date (X weeks ago)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (numberOfWeeks * 7));

    const { data, error } = await supabase
      .from('time_entries')
      .select('week_start_date, hours_logged')
      .eq('user_id', userId)
      .gte('entry_date', startDate.toISOString().split('T')[0])
      .lte('entry_date', endDate.toISOString().split('T')[0]);

    if (error) {
      console.error('Error fetching time entries by week:', error);
      return {};
    }

    // Aggregate by week
    const weeklyHours: Record<string, number> = {};
    data.forEach((entry: any) => {
      const week = entry.week_start_date;
      weeklyHours[week] = (weeklyHours[week] || 0) + (entry.hours_logged || 0);
    });

    return weeklyHours;
  }
}

// Export singleton instance
export const timeEntryService = new TimeEntryService();


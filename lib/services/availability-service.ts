/**
 * User Availability Service
 * Manages weekly user work capacity and availability schedules
 */

import { createClientSupabase } from '../supabase';
import { Database } from '../supabase';

type UserAvailability = Database['public']['Tables']['user_availability']['Row'];
type UserAvailabilityInsert = Database['public']['Tables']['user_availability']['Insert'];
type UserAvailabilityUpdate = Database['public']['Tables']['user_availability']['Update'];

export interface WeeklySchedule {
  monday?: number;
  tuesday?: number;
  wednesday?: number;
  thursday?: number;
  friday?: number;
  saturday?: number;
  sunday?: number;
}

export interface AvailabilityWithSchedule extends UserAvailability {
  schedule_data: WeeklySchedule | null;
}

class AvailabilityService {
  /**
   * Get Monday of the week for a given date
   */
  getWeekStartDate(date: Date = new Date()): string {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split('T')[0];
  }

  /**
   * Get user availability for a specific week
   */
  async getUserAvailability(
    userId: string,
    weekStartDate?: string,
    supabaseClient?: any
  ): Promise<AvailabilityWithSchedule | null> {
    const supabase = supabaseClient || createClientSupabase();
    if (!supabase) return null;

    const targetWeek = weekStartDate || this.getWeekStartDate();

    const { data, error } = await supabase
      .from('user_availability')
      .select('*')
      .eq('user_id', userId)
      .eq('week_start_date', targetWeek)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No record found - return default
        return null;
      }
      console.error('Error fetching user availability:', error);
      return null;
    }

    return data as AvailabilityWithSchedule;
  }

  /**
   * Get user availability for multiple weeks
   */
  async getUserAvailabilityRange(
    userId: string,
    startWeek: string,
    endWeek: string
  ): Promise<AvailabilityWithSchedule[]> {
    const supabase = createClientSupabase();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('user_availability')
      .select('*')
      .eq('user_id', userId)
      .gte('week_start_date', startWeek)
      .lte('week_start_date', endWeek)
      .order('week_start_date', { ascending: true });

    if (error) {
      console.error('Error fetching user availability range:', error);
      return [];
    }

    return (data as AvailabilityWithSchedule[]) || [];
  }

  /**
   * Set or update user availability for a week
   */
  async setUserAvailability(
    userId: string,
    weekStartDate: string,
    availableHours: number,
    scheduleData?: WeeklySchedule,
    notes?: string,
    supabaseClient?: any
  ): Promise<AvailabilityWithSchedule | null> {
    const supabase = supabaseClient || createClientSupabase();
    if (!supabase) return null;

    // Check if record exists
    const existing = await this.getUserAvailability(userId, weekStartDate, supabase);

    if (existing) {
      // Update existing record
      const { data, error } = await supabase
        .from('user_availability')
        .update({
          available_hours: availableHours,
          schedule_data: scheduleData || existing.schedule_data,
          notes: notes !== undefined ? notes : existing.notes,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating user availability:', error);
        return null;
      }

      return data as AvailabilityWithSchedule;
    } else {
      // Insert new record
      const insertData: UserAvailabilityInsert = {
        user_id: userId,
        week_start_date: weekStartDate,
        available_hours: availableHours,
        schedule_data: scheduleData || null,
        notes: notes || null,
      };

      const { data, error } = await supabase
        .from('user_availability')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Error inserting user availability:', error);
        return null;
      }

      return data as AvailabilityWithSchedule;
    }
  }

  /**
   * Delete user availability for a week
   */
  async deleteUserAvailability(
    userId: string,
    weekStartDate: string
  ): Promise<boolean> {
    const supabase = createClientSupabase();
    if (!supabase) return false;

    const { error } = await supabase
      .from('user_availability')
      .delete()
      .eq('user_id', userId)
      .eq('week_start_date', weekStartDate);

    if (error) {
      console.error('Error deleting user availability:', error);
      return false;
    }

    return true;
  }

  /**
   * Copy availability to multiple weeks (for recurring patterns)
   */
  async copyAvailabilityToWeeks(
    userId: string,
    sourceWeek: string,
    targetWeeks: string[]
  ): Promise<boolean> {
    const source = await this.getUserAvailability(userId, sourceWeek);
    if (!source) return false;

    const supabase = createClientSupabase();
    if (!supabase) return false;

    const insertData: UserAvailabilityInsert[] = targetWeeks.map(week => ({
      user_id: userId,
      week_start_date: week,
      available_hours: source.available_hours,
      schedule_data: source.schedule_data,
      notes: source.notes,
    }));

    const { error } = await supabase
      .from('user_availability')
      .upsert(insertData, {
        onConflict: 'user_id,week_start_date',
      });

    if (error) {
      console.error('Error copying availability:', error);
      return false;
    }

    return true;
  }

  /**
   * Calculate total hours from schedule data
   */
  calculateTotalHours(schedule: WeeklySchedule): number {
    return Object.values(schedule).reduce((sum, hours) => sum + (hours || 0), 0);
  }

  /**
   * Get team availability for a department
   */
  async getDepartmentAvailability(
    departmentId: string,
    weekStartDate: string
  ): Promise<AvailabilityWithSchedule[]> {
    const supabase = createClientSupabase();
    if (!supabase) return [];

    // Get all users in the department
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, roles!inner(department_id)')
      .eq('roles.department_id', departmentId);

    if (rolesError || !userRoles) {
      console.error('Error fetching department users:', rolesError);
      return [];
    }

    const userIds = [...new Set(userRoles.map((ur: any) => ur.user_id))];

    const { data, error } = await supabase
      .from('user_availability')
      .select('*')
      .in('user_id', userIds)
      .eq('week_start_date', weekStartDate);

    if (error) {
      console.error('Error fetching department availability:', error);
      return [];
    }

    return (data as AvailabilityWithSchedule[]) || [];
  }
}

// Export singleton instance
export const availabilityService = new AvailabilityService();


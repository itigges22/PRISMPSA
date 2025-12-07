import { createBrowserClient } from '@supabase/ssr';

// Check if Supabase is configured (runtime check)
const isSupabaseConfigured = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return supabaseUrl && supabaseAnonKey && 
    supabaseUrl !== 'your-supabase-url' && 
    supabaseAnonKey !== 'your-anon-key';
};

// Singleton client instance to avoid multiple GoTrueClient instances
let clientInstance: any = null;

// Client component Supabase client (for use in client components)
export const createClientSupabase = () => {
  if (!isSupabaseConfigured()) return null;
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  // Check if we're in a browser environment (not SSR)
  if (typeof window === 'undefined') {
    // Server-side rendering - return null, should use createServerSupabase instead
    return null;
  }
  
  // Return existing instance if available
  if (clientInstance) {
    return clientInstance;
  }
  
  // Create new instance only if none exists (browser only)
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Supabase environment variables are not set');
      return null;
    }
    clientInstance = createBrowserClient(supabaseUrl, supabaseAnonKey);
    
    // Set up automatic session refresh on token expiry
    // This prevents "Auth session missing!" errors when idle
    // Supabase automatically refreshes tokens, but we listen for events
    if (typeof window !== 'undefined') {
      clientInstance.auth.onAuthStateChange((event: any, session: any) => {
        if (process.env.NODE_ENV === 'development') {
          if (event === 'TOKEN_REFRESHED') {
            console.log('Session token refreshed automatically');
          } else if (event === 'SIGNED_OUT') {
            console.log('User signed out');
          }
        }
      });
    }
    
    return clientInstance;
  } catch (error) {
    console.error('Error creating Supabase client:', error);
    return null;
  }
};

// Legacy export for backward compatibility
// Don't create at module level - let components create on demand
// export const supabase = createClientSupabase();

// Database types for PSA Platform
export interface Database {
  public: {
    Tables: {
      departments: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      roles: {
        Row: {
          id: string;
          name: string;
          department_id: string;
          description: string | null;
          permissions: any;
          is_system_role: boolean;
          hierarchy_level: number;
          display_order: number;
          reporting_role_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          department_id: string;
          description?: string | null;
          permissions?: any;
          is_system_role?: boolean;
          hierarchy_level?: number;
          display_order?: number;
          reporting_role_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          department_id?: string;
          description?: string | null;
          permissions?: any;
          is_system_role?: boolean;
          hierarchy_level?: number;
          display_order?: number;
          reporting_role_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_profiles: {
        Row: {
          id: string;
          email: string;
          name: string;
          image: string | null;
          bio: string | null;
          skills: string[] | null;
          workload_sentiment: 'comfortable' | 'stretched' | 'overwhelmed' | null;
          is_superadmin: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name: string;
          image?: string | null;
          bio?: string | null;
          skills?: string[] | null;
          workload_sentiment?: 'comfortable' | 'stretched' | 'overwhelmed' | null;
          is_superadmin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          image?: string | null;
          bio?: string | null;
          skills?: string[] | null;
          workload_sentiment?: 'comfortable' | 'stretched' | 'overwhelmed' | null;
          is_superadmin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role_id: string;
          assigned_at: string;
          assigned_by: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          role_id: string;
          assigned_at?: string;
          assigned_by?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          role_id?: string;
          assigned_at?: string;
          assigned_by?: string | null;
        };
      };
      accounts: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          primary_contact_email: string | null;
          primary_contact_name: string | null;
          account_manager_id: string | null;
          service_tier: 'basic' | 'premium' | 'enterprise' | null;
          status: 'active' | 'inactive' | 'suspended';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          primary_contact_email?: string | null;
          primary_contact_name?: string | null;
          account_manager_id?: string | null;
          service_tier?: 'basic' | 'premium' | 'enterprise' | null;
          status?: 'active' | 'inactive' | 'suspended';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          primary_contact_email?: string | null;
          primary_contact_name?: string | null;
          account_manager_id?: string | null;
          service_tier?: 'basic' | 'premium' | 'enterprise' | null;
          status?: 'active' | 'inactive' | 'suspended';
          created_at?: string;
          updated_at?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          account_id: string;
          status: 'planning' | 'in_progress' | 'review' | 'complete' | 'on_hold';
          priority: 'low' | 'medium' | 'high' | 'urgent';
          start_date: string | null;
          end_date: string | null;
          estimated_hours: number | null;
          actual_hours: number;
          created_by: string;
          assigned_user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          account_id: string;
          status?: 'planning' | 'in_progress' | 'review' | 'complete' | 'on_hold';
          priority?: 'low' | 'medium' | 'high' | 'urgent';
          start_date?: string | null;
          end_date?: string | null;
          estimated_hours?: number | null;
          actual_hours?: number;
          created_by: string;
          assigned_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          account_id?: string;
          status?: 'planning' | 'in_progress' | 'review' | 'complete' | 'on_hold';
          priority?: 'low' | 'medium' | 'high' | 'urgent';
          start_date?: string | null;
          end_date?: string | null;
          estimated_hours?: number | null;
          actual_hours?: number;
          created_by?: string;
          assigned_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      tasks: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          project_id: string;
          status: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';
          priority: 'low' | 'medium' | 'high' | 'urgent';
          start_date: string | null;
          due_date: string | null;
          estimated_hours: number | null;
          remaining_hours: number | null;
          actual_hours: number;
          created_by: string;
          assigned_to: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          project_id: string;
          status?: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';
          priority?: 'low' | 'medium' | 'high' | 'urgent';
          start_date?: string | null;
          due_date?: string | null;
          estimated_hours?: number | null;
          remaining_hours?: number | null;
          actual_hours?: number;
          created_by: string;
          assigned_to?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          project_id?: string;
          status?: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';
          priority?: 'low' | 'medium' | 'high' | 'urgent';
          start_date?: string | null;
          due_date?: string | null;
          estimated_hours?: number | null;
          remaining_hours?: number | null;
          actual_hours?: number;
          created_by?: string;
          assigned_to?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      deliverables: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          project_id: string;
          task_id: string | null;
          status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'revised';
          submitted_by: string;
          approved_by: string | null;
          submitted_at: string | null;
          approved_at: string | null;
          feedback: string | null;
          file_url: string | null;
          version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          project_id: string;
          task_id?: string | null;
          status?: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'revised';
          submitted_by: string;
          approved_by?: string | null;
          submitted_at?: string | null;
          approved_at?: string | null;
          feedback?: string | null;
          file_url?: string | null;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          project_id?: string;
          task_id?: string | null;
          status?: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'revised';
          submitted_by?: string;
          approved_by?: string | null;
          submitted_at?: string | null;
          approved_at?: string | null;
          feedback?: string | null;
          file_url?: string | null;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          message: string;
          type: 'assignment' | 'deadline' | 'approval' | 'general';
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          message: string;
          type: 'assignment' | 'deadline' | 'approval' | 'general';
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          message?: string;
          type?: 'assignment' | 'deadline' | 'approval' | 'general';
          read_at?: string | null;
          created_at?: string;
        };
      };
      project_assignments: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          role_in_project: string | null;
          assigned_at: string;
          assigned_by: string | null;
          removed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          role_in_project?: string | null;
          assigned_at?: string;
          assigned_by?: string | null;
          removed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_id?: string;
          role_in_project?: string | null;
          assigned_at?: string;
          assigned_by?: string | null;
          removed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_availability: {
        Row: {
          id: string;
          user_id: string;
          week_start_date: string;
          available_hours: number;
          schedule_data: any | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          week_start_date: string;
          available_hours?: number;
          schedule_data?: any | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          week_start_date?: string;
          available_hours?: number;
          schedule_data?: any | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      time_entries: {
        Row: {
          id: string;
          task_id: string;
          user_id: string;
          project_id: string;
          hours_logged: number;
          entry_date: string;
          week_start_date: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          user_id: string;
          project_id: string;
          hours_logged: number;
          entry_date: string;
          week_start_date: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          user_id?: string;
          project_id?: string;
          hours_logged?: number;
          entry_date?: string;
          week_start_date?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      task_week_allocations: {
        Row: {
          id: string;
          task_id: string;
          week_start_date: string;
          allocated_hours: number;
          assigned_user_id: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          week_start_date: string;
          allocated_hours: number;
          assigned_user_id?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          week_start_date?: string;
          allocated_hours?: number;
          assigned_user_id?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}

// Type definitions for better type safety
export type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
export type Department = Database['public']['Tables']['departments']['Row'];
export type Role = Database['public']['Tables']['roles']['Row'];
export type UserRole = Database['public']['Tables']['user_roles']['Row'];
export type Account = Database['public']['Tables']['accounts']['Row'];
export type Project = Database['public']['Tables']['projects']['Row'];
export type Task = Database['public']['Tables']['tasks']['Row'];
export type Deliverable = Database['public']['Tables']['deliverables']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];
export type ProjectAssignment = Database['public']['Tables']['project_assignments']['Row'];
export type UserAvailability = Database['public']['Tables']['user_availability']['Row'];
export type TimeEntry = Database['public']['Tables']['time_entries']['Row'];
export type TaskWeekAllocation = Database['public']['Tables']['task_week_allocations']['Row'];

import { createClientSupabase } from '@/lib/supabase';

export type AllProjectUpdate = {
  id: string;
  project_id: string;
  content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  user_profiles?: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
  projects?: {
    id: string;
    name: string;
    status: string;
    priority: string;
    accounts?: {
      id: string;
      name: string;
    };
  };
};

export const allProjectUpdatesService = {
  /**
   * Get all project updates across all projects (for welcome page)
   * Only shows updates from projects the user has access to
   */
  async getAllProjectUpdates(): Promise<AllProjectUpdate[]> {
    const supabase = createClientSupabase();
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('You must be logged in to view project updates');
    }

    // Get all project updates with project and account information
    const { data, error } = await supabase
      .from('project_updates')
      .select(`
        *,
        user_profiles:user_profiles(id, name, email, image),
        projects:projects(
          id,
          name,
          status,
          priority,
          accounts:accounts(id, name)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(50); // Limit to most recent 50 updates

    if (error) {
      console.error('Error fetching all project updates:', error);
      throw error;
    }

    return data || [];
  },

  /**
   * Get project updates for a specific user's projects only
   */
  async getUserProjectUpdates(): Promise<AllProjectUpdate[]> {
    const supabase = createClientSupabase();
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('You must be logged in to view project updates');
    }

    // First get projects the user has access to
    const { data: userProjects, error: projectsError } = await supabase
      .from('projects')
      .select('id')
      .or(`created_by.eq.${session.user.id},assigned_user_id.eq.${session.user.id}`);

    if (projectsError) {
      console.error('Error fetching user projects:', projectsError);
      throw projectsError;
    }

    if (!userProjects || userProjects.length === 0) {
      return [];
    }

    const projectIds = userProjects.map((p: any) => p.id);

    // Get updates for user's projects
    const { data, error } = await supabase
      .from('project_updates')
      .select(`
        *,
        user_profiles:user_profiles(id, name, email, image),
        projects:projects(
          id,
          name,
          status,
          priority,
          accounts:accounts(id, name)
        )
      `)
      .in('project_id', projectIds)
      .order('created_at', { ascending: false })
      .limit(30); // Limit to most recent 30 updates

    if (error) {
      console.error('Error fetching user project updates:', error);
      throw error;
    }

    return data || [];
  }
};

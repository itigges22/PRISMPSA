import { createClientSupabase } from '@/lib/supabase';

export type ProjectUpdate = {
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
};

export type ProjectUpdateInput = {
  project_id: string;
  content: string;
};

export const projectUpdatesService = {
  /**
   * Get all updates for a project
   */
  async getProjectUpdates(projectId: string): Promise<ProjectUpdate[]> {
    const supabase = createClientSupabase();
    
    const { data, error } = await supabase
      .from('project_updates')
      .select(`
        *,
        user_profiles:user_profiles(id, name, email, image)
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching project updates:', error);
      throw error;
    }

    return data || [];
  },

  /**
   * Create a new project update
   */
  async createProjectUpdate(input: ProjectUpdateInput): Promise<ProjectUpdate> {
    const supabase = createClientSupabase();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('You must be logged in to create an update');
    }

    const { data, error } = await supabase
      .from('project_updates')
      .insert({
        project_id: input.project_id,
        content: input.content,
        created_by: session.user.id,
      })
      .select(`
        *,
        user_profiles:user_profiles(id, name, email, image)
      `)
      .single();

    if (error) {
      console.error('Error creating project update:', error);
      throw error;
    }

    return data;
  },

  /**
   * Update an existing project update
   */
  async updateProjectUpdate(updateId: string, content: string): Promise<ProjectUpdate> {
    const supabase = createClientSupabase();

    const { data, error } = await supabase
      .from('project_updates')
      .update({
        content,
        updated_at: new Date().toISOString(),
      })
      .eq('id', updateId)
      .select(`
        *,
        user_profiles:user_profiles(id, name, email, image)
      `)
      .single();

    if (error) {
      console.error('Error updating project update:', error);
      throw error;
    }

    return data;
  },

  /**
   * Delete a project update
   */
  async deleteProjectUpdate(updateId: string): Promise<void> {
    const supabase = createClientSupabase();

    const { error } = await supabase
      .from('project_updates')
      .delete()
      .eq('id', updateId);

    if (error) {
      console.error('Error deleting project update:', error);
      throw error;
    }
  },
};


import { createClientSupabase } from '@/lib/supabase';

export type ProjectIssue = {
  id: string;
  project_id: string;
  content: string;
  status: 'open' | 'in_progress' | 'resolved';
  created_by: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
  resolved_by?: string | null;
  user_profiles?: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
  resolver_profiles?: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
};

export type ProjectIssueInput = {
  project_id: string;
  content: string;
};

export const projectIssuesService = {
  /**
   * Get all issues for a project
   */
  async getProjectIssues(projectId: string): Promise<ProjectIssue[]> {
    const supabase = createClientSupabase();
    
    const { data, error } = await supabase
      .from('project_issues')
      .select(`
        *,
        user_profiles:created_by(id, name, email, image),
        resolver_profiles:resolved_by(id, name, email, image)
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching project issues:', error);
      throw error;
    }

    return data || [];
  },

  /**
   * Get all active (open or in_progress) issues for a department
   */
  async getDepartmentActiveIssues(departmentId: string): Promise<(ProjectIssue & { project?: { id: string; name: string } })[]> {
    const supabase = createClientSupabase();
    
    // Get all roles for this department
    const { data: departmentRoles, error: rolesError } = await supabase
      .from('roles')
      .select('id')
      .eq('department_id', departmentId);

    if (rolesError) {
      console.error('Error fetching department roles:', rolesError);
      throw rolesError;
    }

    const roleIds = departmentRoles?.map((role: any) => role.id) || [];

    if (roleIds.length === 0) {
      return [];
    }

    // Get user IDs who have roles in this department
    const { data: usersInDept, error: userRolesError } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role_id', roleIds);

    if (userRolesError) {
      console.error('Error fetching users for department:', userRolesError);
      throw userRolesError;
    }

    const userIds = Array.from(new Set(usersInDept?.map((ur: any) => ur.user_id) || []));

    if (userIds.length === 0) {
      return [];
    }

    // Get project IDs where users from this department are assigned
    const { data: projectAssignments, error: assignmentsError } = await supabase
      .from('project_assignments')
      .select(`
        project_id,
        projects (
          id,
          name
        )
      `)
      .in('user_id', userIds)
      .is('removed_at', null);

    if (assignmentsError) {
      console.error('Error fetching project assignments:', assignmentsError);
      throw assignmentsError;
    }

    if (!projectAssignments || projectAssignments.length === 0) {
      return [];
    }

    // Extract unique projects
    const projectsMap = new Map();
    projectAssignments.forEach((assignment: any) => {
      if (assignment.projects && !projectsMap.has(assignment.projects.id)) {
        projectsMap.set(assignment.projects.id, assignment.projects);
      }
    });
    const projects = Array.from(projectsMap.values());
    const projectIds = projects.map((p: { id: string; name: string }) => p.id);

    if (projectIds.length === 0) {
      return [];
    }

    // Get all active issues for these projects
    const { data: issues, error: issuesError } = await supabase
      .from('project_issues')
      .select(`
        *,
        user_profiles:created_by(id, name, email, image),
        resolver_profiles:resolved_by(id, name, email, image)
      `)
      .in('project_id', projectIds)
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false });

    if (issuesError) {
      console.error('Error fetching department issues:', issuesError);
      throw issuesError;
    }

    // Add project information to each issue
    const issuesWithProjects = (issues || []).map((issue: any) => {
      const project = projects.find((p: { id: string; name: string }) => p.id === issue.project_id);
      return {
        ...issue,
        project: project ? { id: project.id, name: project.name } : undefined
      };
    });

    return issuesWithProjects;
  },

  /**
   * Get all active (open or in_progress) issues for an account
   */
  async getAccountActiveIssues(accountId: string): Promise<(ProjectIssue & { project?: { id: string; name: string } })[]> {
    const supabase = createClientSupabase();
    
    // First, get all project IDs for this account
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, name')
      .eq('account_id', accountId);

    if (projectsError) {
      console.error('Error fetching projects:', projectsError);
      throw projectsError;
    }

    if (!projects || projects.length === 0) {
      return [];
    }

    const projectIds = projects.map((p: { id: string; name: string }) => p.id);

    // Get all active issues for these projects
    const { data, error } = await supabase
      .from('project_issues')
      .select(`
        *,
        user_profiles:created_by(id, name, email, image),
        resolver_profiles:resolved_by(id, name, email, image)
      `)
      .in('project_id', projectIds)
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching account issues:', error);
      throw error;
    }

    // Add project info to each issue
    const issuesWithProjects = (data || []).map((issue: any) => ({
      ...issue,
      project: projects.find((p: { id: string; name: string }) => p.id === issue.project_id)
    }));

    return issuesWithProjects;
  },

  /**
   * Create a new project issue
   */
  async createProjectIssue(input: ProjectIssueInput): Promise<ProjectIssue> {
    const supabase = createClientSupabase();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('You must be logged in to create an issue');
    }

    const { data, error } = await supabase
      .from('project_issues')
      .insert({
        project_id: input.project_id,
        content: input.content,
        created_by: session.user.id,
        status: 'open',
      })
      .select(`
        *,
        user_profiles:created_by(id, name, email, image)
      `)
      .single();

    if (error) {
      console.error('Error creating project issue:', error);
      throw error;
    }

    return data;
  },

  /**
   * Update issue status
   */
  async updateIssueStatus(
    issueId: string, 
    status: 'open' | 'in_progress' | 'resolved'
  ): Promise<ProjectIssue> {
    const supabase = createClientSupabase();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('You must be logged in to update an issue');
    }

    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    // If marking as resolved, set resolved metadata
    if (status === 'resolved') {
      updateData.resolved_at = new Date().toISOString();
      updateData.resolved_by = session.user.id;
    } else {
      // If changing from resolved to another status, clear resolved metadata
      updateData.resolved_at = null;
      updateData.resolved_by = null;
    }

    const { data, error } = await supabase
      .from('project_issues')
      .update(updateData)
      .eq('id', issueId)
      .select(`
        *,
        user_profiles:created_by(id, name, email, image),
        resolver_profiles:resolved_by(id, name, email, image)
      `)
      .single();

    if (error) {
      console.error('Error updating issue status:', error);
      throw error;
    }

    return data;
  },

  /**
   * Update issue content
   */
  async updateIssueContent(issueId: string, content: string): Promise<ProjectIssue> {
    const supabase = createClientSupabase();

    const { data, error } = await supabase
      .from('project_issues')
      .update({
        content,
        updated_at: new Date().toISOString(),
      })
      .eq('id', issueId)
      .select(`
        *,
        user_profiles:created_by(id, name, email, image),
        resolver_profiles:resolved_by(id, name, email, image)
      `)
      .single();

    if (error) {
      console.error('Error updating issue content:', error);
      throw error;
    }

    return data;
  },

  /**
   * Delete a project issue
   */
  async deleteProjectIssue(issueId: string): Promise<void> {
    const supabase = createClientSupabase();

    const { error } = await supabase
      .from('project_issues')
      .delete()
      .eq('id', issueId);

    if (error) {
      console.error('Error deleting project issue:', error);
      throw error;
    }
  },
};


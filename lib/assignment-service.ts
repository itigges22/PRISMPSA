/**
 * Assignment Service
 * 
 * Manages user assignments to projects, accounts, and other resources.
 * This service handles the many-to-many relationships between users and projects
 * and provides context-aware access control checks.
 */

import { createClientSupabase } from './supabase';
import { logger, databaseQuery, databaseError, performance } from './debug-logger';

// ================================================================================
// TYPES
// ================================================================================

export interface ProjectAssignment {
  id: string;
  project_id: string;
  user_id: string;
  role_in_project: string | null;
  assigned_at: string;
  assigned_by: string | null;
  removed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectAssignmentWithDetails extends ProjectAssignment {
  project: {
    id: string;
    name: string;
    account_id: string;
    status: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
  assigned_by_user?: {
    id: string;
    name: string;
  } | null;
}

export interface CreateProjectAssignmentData {
  project_id: string;
  user_id: string;
  role_in_project?: string; // e.g., 'lead', 'member', 'contributor'
  assigned_by: string;
}

export interface UserProjectSummary {
  user_id: string;
  user_name: string;
  user_email: string;
  projects: Array<{
    project_id: string;
    project_name: string;
    account_id: string;
    account_name: string;
    role_in_project: string | null;
    assigned_at: string;
  }>;
  accounts_accessible: Set<string>; // Account IDs user has access to
}

// ================================================================================
// ASSIGNMENT SERVICE CLASS
// ================================================================================

class AssignmentService {
  private async getSupabase() {
    return createClientSupabase();
  }

  // ============================================================================
  // PROJECT ASSIGNMENT OPERATIONS
  // ============================================================================

  /**
   * Assign a user to a project
   * Automatically grants view access to the project's account
   */
  async assignUserToProject(data: CreateProjectAssignmentData): Promise<ProjectAssignment | null> {
    const startTime = Date.now();
    
    try {
      const supabase = await this.getSupabase();
      if (!supabase) {
        logger.error('Supabase client not available', { action: 'assignUserToProject' });
        return null;
      }

      logger.info('Assigning user to project', {
        action: 'assignUserToProject',
        userId: data.user_id,
        projectId: data.project_id,
        roleInProject: data.role_in_project
      });

      databaseQuery('INSERT', 'project_assignments', { 
        action: 'assignUserToProject',
        userId: data.user_id,
        projectId: data.project_id
      });

      const { data: assignment, error } = await supabase
        .from('project_assignments')
        .insert({
          project_id: data.project_id,
          user_id: data.user_id,
          role_in_project: data.role_in_project || null,
          assigned_by: data.assigned_by,
          assigned_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        databaseError('INSERT', 'project_assignments', error, { 
          action: 'assignUserToProject',
          userId: data.user_id,
          projectId: data.project_id
        });
        logger.error('Error assigning user to project', {
          action: 'assignUserToProject',
          userId: data.user_id,
          projectId: data.project_id,
          error: error.message
        }, error);
        return null;
      }

      const duration = Date.now() - startTime;
      performance('assignUserToProject', duration, {
        userId: data.user_id,
        projectId: data.project_id
      });

      logger.info('User assigned to project successfully', {
        action: 'assignUserToProject',
        assignmentId: assignment.id,
        userId: data.user_id,
        projectId: data.project_id,
        duration
      });

      return assignment;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Exception in assignUserToProject', {
        action: 'assignUserToProject',
        userId: data.user_id,
        projectId: data.project_id,
        duration
      }, error as Error);
      return null;
    }
  }

  /**
   * Remove a user from a project (soft delete - sets removed_at)
   */
  async removeUserFromProject(userId: string, projectId: string, removedBy: string): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      const supabase = await this.getSupabase();
      if (!supabase) {
        logger.error('Supabase client not available', { action: 'removeUserFromProject' });
        return false;
      }

      logger.info('Removing user from project', {
        action: 'removeUserFromProject',
        userId,
        projectId
      });

      const { error } = await supabase
        .from('project_assignments')
        .update({
          removed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('project_id', projectId)
        .is('removed_at', null);

      if (error) {
        databaseError('UPDATE', 'project_assignments', error, {
          action: 'removeUserFromProject',
          userId,
          projectId
        });
        logger.error('Error removing user from project', {
          action: 'removeUserFromProject',
          userId,
          projectId,
          error: error.message
        }, error);
        return false;
      }

      const duration = Date.now() - startTime;
      performance('removeUserFromProject', duration, { userId, projectId });

      logger.info('User removed from project successfully', {
        action: 'removeUserFromProject',
        userId,
        projectId,
        duration
      });

      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Exception in removeUserFromProject', {
        action: 'removeUserFromProject',
        userId,
        projectId,
        duration
      }, error as Error);
      return false;
    }
  }

  /**
   * Get all projects a user is assigned to
   */
  async getUserProjects(userId: string): Promise<ProjectAssignmentWithDetails[]> {
    const startTime = Date.now();
    
    try {
      const supabase = await this.getSupabase();
      if (!supabase) {
        logger.error('Supabase client not available', { action: 'getUserProjects' });
        return [];
      }

      logger.debug('Fetching user projects', { action: 'getUserProjects', userId });

      databaseQuery('SELECT', 'project_assignments', { action: 'getUserProjects', userId });

      const { data: assignments, error } = await supabase
        .from('project_assignments')
        .select(`
          *,
          project:projects!project_assignments_project_id_fkey(id, name, account_id, status),
          user:user_profiles!project_assignments_user_id_fkey(id, name, email, image),
          assigned_by_user:user_profiles!project_assignments_assigned_by_fkey(id, name)
        `)
        .eq('user_id', userId)
        .is('removed_at', null)
        .order('assigned_at', { ascending: false });

      if (error) {
        databaseError('SELECT', 'project_assignments', error, {
          action: 'getUserProjects',
          userId
        });
        logger.error('Error fetching user projects', {
          action: 'getUserProjects',
          userId
        }, error);
        return [];
      }

      const duration = Date.now() - startTime;
      performance('getUserProjects', duration, { userId, count: assignments?.length || 0 });

      logger.debug('User projects fetched successfully', {
        action: 'getUserProjects',
        userId,
        projectCount: assignments?.length || 0,
        duration
      });

      return assignments || [];
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Exception in getUserProjects', {
        action: 'getUserProjects',
        userId,
        duration
      }, error as Error);
      return [];
    }
  }

  /**
   * Get all users assigned to a project
   */
  async getProjectUsers(projectId: string): Promise<ProjectAssignmentWithDetails[]> {
    const startTime = Date.now();
    
    try {
      const supabase = await this.getSupabase();
      if (!supabase) {
        logger.error('Supabase client not available', { action: 'getProjectUsers' });
        return [];
      }

      logger.debug('Fetching project users', { action: 'getProjectUsers', projectId });

      databaseQuery('SELECT', 'project_assignments', { action: 'getProjectUsers', projectId });

      const { data: assignments, error } = await supabase
        .from('project_assignments')
        .select(`
          *,
          project:projects!project_assignments_project_id_fkey(id, name, account_id, status),
          user:user_profiles!project_assignments_user_id_fkey(id, name, email, image),
          assigned_by_user:user_profiles!project_assignments_assigned_by_fkey(id, name)
        `)
        .eq('project_id', projectId)
        .is('removed_at', null)
        .order('assigned_at', { ascending: false });

      if (error) {
        databaseError('SELECT', 'project_assignments', error, {
          action: 'getProjectUsers',
          projectId
        });
        logger.error('Error fetching project users', {
          action: 'getProjectUsers',
          projectId
        }, error);
        return [];
      }

      const duration = Date.now() - startTime;
      performance('getProjectUsers', duration, { projectId, count: assignments?.length || 0 });

      logger.debug('Project users fetched successfully', {
        action: 'getProjectUsers',
        projectId,
        userCount: assignments?.length || 0,
        duration
      });

      return assignments || [];
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Exception in getProjectUsers', {
        action: 'getProjectUsers',
        projectId,
        duration
      }, error as Error);
      return [];
    }
  }

  /**
   * Check if a user is assigned to a specific project
   */
  async isUserAssignedToProject(userId: string, projectId: string): Promise<boolean> {
    try {
      const supabase = await this.getSupabase();
      if (!supabase) return false;

      const { data, error } = await supabase
        .from('project_assignments')
        .select('id')
        .eq('user_id', userId)
        .eq('project_id', projectId)
        .is('removed_at', null)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        logger.error('Error checking project assignment', { userId, projectId }, error);
        return false;
      }

      return !!data;
    } catch (error) {
      logger.error('Exception in isUserAssignedToProject', { userId, projectId }, error as Error);
      return false;
    }
  }

  /**
   * Update user's role in a project
   */
  async updateProjectRole(userId: string, projectId: string, newRole: string): Promise<boolean> {
    try {
      const supabase = await this.getSupabase();
      if (!supabase) return false;

      const { error } = await supabase
        .from('project_assignments')
        .update({
          role_in_project: newRole,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('project_id', projectId)
        .is('removed_at', null);

      if (error) {
        logger.error('Error updating project role', { userId, projectId, newRole }, error);
        return false;
      }

      logger.info('Project role updated successfully', { userId, projectId, newRole });
      return true;
    } catch (error) {
      logger.error('Exception in updateProjectRole', { userId, projectId, newRole }, error as Error);
      return false;
    }
  }

  // ============================================================================
  // ACCOUNT ACCESS OPERATIONS
  // ============================================================================

  /**
   * Get all accounts a user has access to (via project assignments)
   */
  async getUserAccessibleAccounts(userId: string): Promise<string[]> {
    try {
      const supabase = await this.getSupabase();
      if (!supabase) return [];

      const { data: assignments, error } = await supabase
        .from('project_assignments')
        .select('projects!inner(account_id)')
        .eq('user_id', userId)
        .is('removed_at', null);

      if (error) {
        logger.error('Error fetching user accessible accounts', { userId }, error);
        return [];
      }

      // Extract unique account IDs
      const accountIds = new Set<string>();
      assignments?.forEach((assignment: any) => {
        if (assignment.projects?.account_id) {
          accountIds.add(assignment.projects.account_id);
        }
      });

      return Array.from(accountIds);
    } catch (error) {
      logger.error('Exception in getUserAccessibleAccounts', { userId }, error as Error);
      return [];
    }
  }

  /**
   * Check if user has access to an account (assigned to any project in that account)
   */
  async hasAccountAccess(userId: string, accountId: string): Promise<boolean> {
    try {
      const supabase = await this.getSupabase();
      if (!supabase) return false;

      // Get all projects in this account
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id')
        .eq('account_id', accountId);

      if (projectsError || !projects || projects.length === 0) {
        return false;
      }

      const projectIds = projects.map((p: { id: string }) => p.id);

      // Check if user is assigned to any of these projects
      const { data, error } = await supabase
        .from('project_assignments')
        .select('id')
        .eq('user_id', userId)
        .in('project_id', projectIds)
        .is('removed_at', null)
        .limit(1);

      if (error) {
        logger.error('Error checking account access', { userId, accountId }, error);
        return false;
      }

      return (data?.length || 0) > 0;
    } catch (error) {
      logger.error('Exception in hasAccountAccess', { userId, accountId }, error as Error);
      return false;
    }
  }

  // ============================================================================
  // BULK OPERATIONS
  // ============================================================================

  /**
   * Assign multiple users to a project at once
   */
  async bulkAssignUsersToProject(
    projectId: string,
    userIds: string[],
    assignedBy: string,
    roleInProject?: string
  ): Promise<{ success: string[]; failed: string[] }> {
    const success: string[] = [];
    const failed: string[] = [];

    for (const userId of userIds) {
      const result = await this.assignUserToProject({
        project_id: projectId,
        user_id: userId,
        role_in_project: roleInProject,
        assigned_by: assignedBy,
      });

      if (result) {
        success.push(userId);
      } else {
        failed.push(userId);
      }
    }

    logger.info('Bulk assignment completed', {
      action: 'bulkAssignUsersToProject',
      projectId,
      totalUsers: userIds.length,
      successCount: success.length,
      failedCount: failed.length
    });

    return { success, failed };
  }

  /**
   * Get summary of all users and their project assignments
   */
  async getAllUserProjectSummaries(): Promise<UserProjectSummary[]> {
    try {
      const supabase = await this.getSupabase();
      if (!supabase) return [];

      const { data: assignments, error } = await supabase
        .from('project_assignments')
        .select(`
          user_id,
          user:user_profiles!project_assignments_user_id_fkey(id, name, email),
          project:projects!project_assignments_project_id_fkey(id, name, account_id, accounts(name)),
          role_in_project,
          assigned_at
        `)
        .is('removed_at', null)
        .order('user_id', { ascending: true })
        .order('assigned_at', { ascending: false });

      if (error) {
        logger.error('Error fetching all user project summaries', {}, error);
        return [];
      }

      // Group by user
      const userMap = new Map<string, UserProjectSummary>();

      assignments?.forEach((assignment: any) => {
        const userId = assignment.user_id;
        const user = assignment.user;
        const project = assignment.project;

        if (!userMap.has(userId)) {
          userMap.set(userId, {
            user_id: userId,
            user_name: user.name,
            user_email: user.email,
            projects: [],
            accounts_accessible: new Set<string>(),
          });
        }

        const summary = userMap.get(userId)!;
        summary.projects.push({
          project_id: project.id,
          project_name: project.name,
          account_id: project.account_id,
          account_name: project.accounts?.name || 'Unknown',
          role_in_project: assignment.role_in_project,
          assigned_at: assignment.assigned_at,
        });
        summary.accounts_accessible.add(project.account_id);
      });

      return Array.from(userMap.values());
    } catch (error) {
      logger.error('Exception in getAllUserProjectSummaries', {}, error as Error);
      return [];
    }
  }
}

// Export singleton instance
export const assignmentService = new AssignmentService();


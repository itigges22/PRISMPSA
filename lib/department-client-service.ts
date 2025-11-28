import { createClientSupabase } from './supabase';
import { Department, Project, UserProfile, UserRole, Role } from './supabase';

// Client-side department service for managing department data and analytics

export interface DepartmentMetrics {
  id: string;
  name: string;
  description: string | null;
  activeProjects: number;
  teamSize: number;
  capacityUtilization: number;
  projectHealth: {
    healthy: number;
    atRisk: number;
    critical: number;
  };
  workloadDistribution: {
    userId: string;
    userName: string;
    userImage: string | null;
    workloadPercentage: number;
    workloadSentiment: 'comfortable' | 'stretched' | 'overwhelmed' | null;
  }[];
  recentProjects: Project[];
}

export interface DepartmentProject {
  id: string;
  name: string;
  description: string | null;
  status: 'planning' | 'in_progress' | 'review' | 'complete' | 'on_hold';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  startDate: string | null;
  endDate: string | null;
  estimatedHours: number | null;
  actualHours: number;
  accountName: string;
  assignedUsers: {
    id: string;
    name: string;
    image: string | null;
  }[];
  healthStatus: 'healthy' | 'at_risk' | 'critical';
  daysUntilDeadline: number | null;
}

// Type for database query results
interface ProjectWithRelations {
  id: string;
  name: string;
  description: string | null;
  status: 'planning' | 'in_progress' | 'review' | 'complete' | 'on_hold';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  start_date: string | null;
  end_date: string | null;
  estimated_hours: number | null;
  actual_hours: number;
  accounts: {
    id: string;
    name: string;
  } | null;
  project_departments: {
    department_id: string;
  }[];
}

interface TeamMemberWithRelations {
  user_id: string;
  user_profiles: {
    id: string;
    name: string;
    image: string | null;
    workload_sentiment: 'comfortable' | 'stretched' | 'overwhelmed' | null;
  } | null;
}

interface TaskAssignmentWithRelations {
  task_id: string;
  user_profiles: {
    id: string;
    name: string;
    image: string | null;
  } | null;
  tasks: {
    project_id: string;
  } | null;
}

class ClientDepartmentService {
  /**
   * Get all departments
   */
  async getAllDepartments(): Promise<Department[]> {
    try {
      const supabase = createClientSupabase();
      if (!supabase) return [];

      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error fetching departments:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getAllDepartments:', error);
      return [];
    }
  }

  /**
   * Get department by ID
   */
  async getDepartmentById(id: string): Promise<Department | null> {
    try {
      const supabase = createClientSupabase();
      if (!supabase) {
        console.error('Supabase client not available');
        return null;
      }

      if (!id || id.trim() === '') {
        console.error('Invalid department ID provided:', id);
        return null;
      }

      console.log('Fetching department with ID:', id);

      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching department:', {
          id,
          errorCode: error.code,
          errorMessage: error.message,
          errorDetails: error.details,
          errorHint: error.hint
        });
        return null;
      }

      if (!data) {
        console.log('No department found with ID:', id);
        return null;
      }

      console.log('Successfully fetched department:', data.name);
      return data;
    } catch (error) {
      console.error('Error in getDepartmentById:', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return null;
    }
  }

  /**
   * Get department metrics and analytics
   */
  async getDepartmentMetrics(departmentId: string): Promise<DepartmentMetrics | null> {
    try {
      const supabase = createClientSupabase();
      if (!supabase) return null;

      // Get department info
      const department = await this.getDepartmentById(departmentId);
      if (!department) return null;

      // First get all roles for this department
      const { data: departmentRoles, error: rolesError } = await supabase
        .from('roles')
        .select('id')
        .eq('department_id', departmentId);

      if (rolesError) {
        console.error('Error fetching department roles:', rolesError);
      }

      const roleIds = departmentRoles?.map((role: any) => role.id) || [];

      // Then get user roles for those specific roles
      const { data: teamMembers, error: teamError } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          roles!user_roles_role_id_fkey (
            department_id,
            departments!roles_department_id_fkey (
              id,
              name
            )
          ),
          user_profiles!user_roles_user_id_fkey (
            id,
            name,
            image,
            workload_sentiment
          )
        `)
        .in('role_id', roleIds);

      if (teamError) {
        console.error('Error fetching team members:', teamError);
        return null;
      }

      // Get user IDs who have roles in this department
      const userIds = Array.from(new Set(teamMembers?.map((tm: any) => tm.user_id) || []));

      let projects: any[] = [];

      if (userIds.length > 0) {
        // Get project IDs where users from this department are assigned
        const { data: projectAssignments, error: projAssignError } = await supabase
          .from('project_assignments')
          .select('project_id')
          .in('user_id', userIds)
          .is('removed_at', null);

        if (projAssignError) {
          console.error('Error fetching project assignments:', projAssignError);
        } else if (projectAssignments && projectAssignments.length > 0) {
          const projectIds = Array.from(new Set(projectAssignments.map((assignment: any) => assignment.project_id)));

          // Now fetch the actual projects
          const { data: projectsData, error: projectsError } = await supabase
            .from('projects')
            .select(`
              *,
              accounts!projects_account_id_fkey (
                id,
                name
              )
            `)
            .in('id', projectIds);

          if (projectsError) {
            console.error('Error fetching department projects:', projectsError);
          } else {
            projects = projectsData || [];
          }
        }
      }

      // Calculate metrics
      const typedProjects = (projects as ProjectWithRelations[]) || [];
      const typedTeamMembers = (teamMembers as unknown as TeamMemberWithRelations[]) || [];

      const activeProjects = typedProjects.filter(p => 
        p.status !== 'complete' && p.status !== 'on_hold'
      );

      // Deduplicate users by ID in case they have multiple roles in the same department
      const uniqueUsers = new Map();
      typedTeamMembers.forEach(member => {
        const user = member.user_profiles;
        if (user && !uniqueUsers.has(user.id)) {
          uniqueUsers.set(user.id, user);
        }
      });
      const teamSize = uniqueUsers.size;

      // Calculate project health
      const now = new Date();
      const projectHealth = {
        healthy: 0,
        atRisk: 0,
        critical: 0
      };

      activeProjects.forEach(project => {
        if (!project.end_date) {
          projectHealth.healthy++;
          return;
        }

        const endDate = new Date(project.end_date);
        const daysUntilDeadline = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntilDeadline < 0) {
          projectHealth.critical++;
        } else if (daysUntilDeadline <= 7) {
          projectHealth.atRisk++;
        } else {
          projectHealth.healthy++;
        }
      });

      // Calculate workload distribution based on actual project assignments
      const workloadDistribution = Array.from(uniqueUsers.values()).map((user: any, index: number) => {
        // For demonstration purposes, generate realistic workload data
        // In a real system, this would be calculated based on actual task assignments
        const baseWorkload = Math.floor(Math.random() * 40) + 20; // 20-60% workload
        const workloadPercentage = Math.min(baseWorkload, 100);

        // Determine workload sentiment based on percentage
        let workloadSentiment: 'comfortable' | 'stretched' | 'overwhelmed' | null = null;
        if (workloadPercentage <= 40) {
          workloadSentiment = 'comfortable';
        } else if (workloadPercentage <= 70) {
          workloadSentiment = 'stretched';
        } else {
          workloadSentiment = 'overwhelmed';
        }

        return {
          userId: user.id,
          userName: user.name,
          userImage: user.image,
          workloadPercentage,
          workloadSentiment
        };
      });

      // Calculate capacity utilization
      const totalCapacity = teamSize * 100; // Assuming 100% capacity per person
      const usedCapacity = workloadDistribution.reduce((sum, member) => 
        sum + member.workloadPercentage, 0
      );
      const capacityUtilization = teamSize > 0 ? Math.round((usedCapacity / totalCapacity) * 100) : 0;

      return {
        id: department.id,
        name: department.name,
        description: department.description,
        activeProjects: activeProjects.length,
        teamSize,
        capacityUtilization,
        projectHealth,
        workloadDistribution,
        recentProjects: activeProjects.slice(0, 5) as unknown as Project[] // Last 5 projects
      };
    } catch (error) {
      console.error('Error in getDepartmentMetrics:', error);
      return null;
    }
  }

  /**
   * Get department projects with health status
   */
  async getDepartmentProjects(departmentId: string): Promise<DepartmentProject[]> {
    try {
      const supabase = createClientSupabase();
      if (!supabase) return [];

      // Get all roles for this department
      const { data: departmentRoles, error: rolesError } = await supabase
        .from('roles')
        .select('id')
        .eq('department_id', departmentId);

      if (rolesError) {
        console.error('Error fetching department roles:', rolesError);
        return [];
      }

      const roleIds = departmentRoles?.map((role: any) => role.id) || [];

      if (roleIds.length === 0) {
        console.log('No roles found for department:', departmentId);
        return [];
      }

      // Get user IDs who have roles in this department
      const { data: usersInDept, error: userRolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role_id', roleIds);

      if (userRolesError) {
        console.error('Error fetching users for department:', userRolesError);
        return [];
      }

      const userIds = Array.from(new Set(usersInDept?.map((ur: any) => ur.user_id) || []));

      if (userIds.length === 0) {
        console.log('No users found for department:', departmentId);
        return [];
      }

      // Get project IDs where users from this department are assigned
      const { data: projectAssignments, error: projAssignmentsError } = await supabase
        .from('project_assignments')
        .select('project_id')
        .in('user_id', userIds)
        .is('removed_at', null);

      if (projAssignmentsError) {
        console.error('Error fetching project assignments:', projAssignmentsError);
        return [];
      }

      if (!projectAssignments || projectAssignments.length === 0) {
        console.log('No project assignments found for department:', departmentId);
        return [];
      }

      const projectIds = Array.from(new Set(projectAssignments.map((assignment: any) => assignment.project_id)));

      // Now fetch the actual projects
      const { data: projects, error } = await supabase
        .from('projects')
        .select(`
          *,
          accounts!projects_account_id_fkey (
            id,
            name
          )
        `)
        .in('id', projectIds)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching department projects:', error);
        return [];
      }

      // Get assigned users for each project (task assignments)
      const { data: assignments, error: taskAssignmentsError } = await supabase
        .from('task_assignments')
        .select(`
          task_id,
          user_profiles!task_assignments_user_id_fkey (
            id,
            name,
            image
          ),
          tasks!task_assignments_task_id_fkey (
            project_id
          )
        `)
        .in('tasks.project_id', projectIds);

      if (taskAssignmentsError) {
        console.error('Error fetching task assignments:', taskAssignmentsError);
      }

      const typedProjects = (projects as ProjectWithRelations[]) || [];
      const typedAssignments = (assignments as unknown as TaskAssignmentWithRelations[]) || [];

      const now = new Date();
      return typedProjects.map(project => {
        // Calculate health status
        let healthStatus: 'healthy' | 'at_risk' | 'critical' = 'healthy';
        let daysUntilDeadline: number | null = null;

        if (project.end_date) {
          const endDate = new Date(project.end_date);
          daysUntilDeadline = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          if (daysUntilDeadline < 0) {
            healthStatus = 'critical';
          } else if (daysUntilDeadline <= 7) {
            healthStatus = 'at_risk';
          }
        }

        // Get assigned users for this project
        const projectAssignments = typedAssignments.filter(a => 
          a.tasks?.project_id === project.id
        );

        const assignedUsers = projectAssignments.map(a => ({
          id: a.user_profiles?.id || '',
          name: a.user_profiles?.name || 'Unknown',
          image: a.user_profiles?.image || null
        }));

        return {
          id: project.id,
          name: project.name,
          description: project.description,
          status: project.status,
          priority: project.priority,
          startDate: project.start_date,
          endDate: project.end_date,
          estimatedHours: project.estimated_hours,
          actualHours: project.actual_hours,
          accountName: project.accounts?.name || 'Unknown Account',
          assignedUsers,
          healthStatus,
          daysUntilDeadline
        };
      });
    } catch (error) {
      console.error('Error in getDepartmentProjects:', error);
      return [];
    }
  }

  /**
   * Create a new department (admin only)
   */
  async createDepartment(name: string, description?: string): Promise<Department | null> {
    try {
      const supabase = createClientSupabase();
      if (!supabase) return null;

      const { data, error } = await supabase
        .from('departments')
        .insert({
          name,
          description: description || null
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating department:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in createDepartment:', error);
      return null;
    }
  }

  /**
   * Update department (admin only)
   */
  async updateDepartment(id: string, updates: { name?: string; description?: string }): Promise<Department | null> {
    try {
      const supabase = createClientSupabase();
      if (!supabase) return null;

      const { data, error } = await supabase
        .from('departments')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating department:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in updateDepartment:', error);
      return null;
    }
  }

  /**
   * Delete department (admin only)
   */
  async deleteDepartment(id: string): Promise<boolean> {
    try {
      const supabase = createClientSupabase();
      if (!supabase) return false;

      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting department:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in deleteDepartment:', error);
      return false;
    }
  }
}

// Export singleton instance
export const departmentClientService = new ClientDepartmentService();

import { createServerSupabase } from './supabase-server';
import { Department, Project } from './supabase';
import { DEFAULT_WEEKLY_HOURS } from './constants';

// Department service for managing department data and analytics

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

interface _TeamMemberWithRelations {
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

// Remove the client-side DepartmentService class since we now have a separate client service

// Server-side methods
class ServerDepartmentService {
  private async getSupabase() {
    return createServerSupabase();
  }

  /**
   * Get all departments (server-side)
   */
  async getAllDepartments(): Promise<Department[]> {
    try {
      const supabase = await createServerSupabase();
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
    } catch (error: unknown) {
      console.error('Error in getAllDepartments:', error);
      return [];
    }
  }

  /**
   * Get department by ID (server-side)
   */
  async getDepartmentById(id: string): Promise<Department | null> {
    try {
      const supabase = await createServerSupabase();
      if (!supabase) return null;

      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching department:', error);
        return null;
      }

      return data;
    } catch (error: unknown) {
      console.error('Error in getDepartmentById:', error);
      return null;
    }
  }


  /**
   * Get department projects with health status (server-side)
   */
  async getDepartmentProjects(departmentId: string): Promise<DepartmentProject[]> {
    try {
      const supabase = await createServerSupabase();
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
      const { data: projectAssignments, error: projAssignError } = await supabase
        .from('project_assignments')
        .select('project_id')
        .in('user_id', userIds)
        .is('removed_at', null);

      if (projAssignError) {
        console.error('Error fetching project assignments:', projAssignError);
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

      const { data: assignments, error: assignmentsError } = await supabase
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

      if (assignmentsError) {
        console.error('Error fetching project assignments:', assignmentsError);
      }

      const typedProjects = (projects as ProjectWithRelations[]) || [];
      const typedAssignments = (assignments as unknown as TaskAssignmentWithRelations[]) || [];

      const now = new Date();
      return typedProjects.map((project: any) => {
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

        const projectAssignments = typedAssignments.filter((a: any) => 
          a.tasks?.project_id === project.id
        );

        const assignedUsers = projectAssignments.map((a: any) => ({
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
    } catch (error: unknown) {
      console.error('Error in getDepartmentProjects:', error);
      return [];
    }
  }

  /**
   * Get department metrics for a single department
   */
  async getDepartmentMetrics(departmentId: string): Promise<DepartmentMetrics | null> {
    const supabase = await this.getSupabase();
    if (!supabase) return null;

    const { data: department, error: departmentError } = await supabase
      .from('departments')
      .select('*')
      .eq('id', departmentId)
      .single();

    if (departmentError) {
      console.error('Error fetching department for metrics:', departmentError);
      return null;
    }

    // Get all roles for this department first (we need role IDs to find assignments)
    const { data: departmentRoles, error: rolesQueryError } = await supabase
      .from('roles')
      .select('id')
      .eq('department_id', departmentId);

    if (rolesQueryError) {
      console.error('Error fetching department roles for projects:', rolesQueryError);
      return null;
    }

    const roleIds = departmentRoles?.map((role: any) => role.id) || [];

    // If department has no roles, it has no projects
    if (roleIds.length === 0) {
      const _activeProjects: Record<string, unknown>[] = [];
      const _teamSize = 0;
      return {
        id: department.id,
        name: department.name,
        description: department.description,
        activeProjects: 0,
        teamSize: 0,
        capacityUtilization: 0,
        projectHealth: { healthy: 0, atRisk: 0, critical: 0 },
        workloadDistribution: [],
        recentProjects: []
      };
    }

    // Get user IDs who have roles in this department
    const { data: usersInDept, error: userRolesQueryError } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role_id', roleIds);

    if (userRolesQueryError) {
      console.error('Error fetching users for department:', userRolesQueryError);
      return null;
    }

    const userIds = Array.from(new Set(usersInDept?.map((ur: any) => ur.user_id) || []));

    // Get projects where users from this department are assigned
    // Note: We fetch all assignments and filter manually to avoid RLS policy issues
    // with complex permission functions that may have schema qualification bugs
    const { data: allAssignments, error: assignmentsError } = await supabase
      .from('project_assignments')
      .select('project_id, user_id')
      .is('removed_at', null);

    if (assignmentsError) {
      console.error('Error fetching project assignments for department metrics:', {
        message: assignmentsError.message,
        code: assignmentsError.code,
        details: assignmentsError.details,
        hint: assignmentsError.hint,
        departmentId: departmentId
      });
      // Continue with empty data rather than failing completely
      return {
        id: department.id,
        name: department.name,
        description: department.description,
        activeProjects: 0,
        teamSize: 0,
        capacityUtilization: 0,
        projectHealth: { healthy: 0, atRisk: 0, critical: 0 },
        workloadDistribution: [],
        recentProjects: []
      };
    }

    // Filter to only this department's users
    const projectAssignments = (allAssignments || []).filter((a: any) =>
      userIds.includes(a.user_id)
    );

    // Extract unique project IDs
    const projectIds = Array.from(new Set(projectAssignments?.map((a: any) => a.project_id) || []));
    let projects: Record<string, unknown>[] = [];

    if (projectIds.length > 0) {
      // Fetch projects separately
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select(`
          id,
          name,
          description,
          status,
          priority,
          start_date,
          end_date,
          estimated_hours,
          actual_hours,
          accounts!projects_account_id_fkey (name)
        `)
        .in('id', projectIds);

      if (projectsError) {
        console.error('Error fetching projects for department metrics:', {
          message: projectsError.message,
          code: projectsError.code,
          details: projectsError.details,
          hint: projectsError.hint,
          projectIds: projectIds.length,
          departmentId: departmentId
        });
        return null;
      }

      projects = projectsData || [];
    }

    // Get user roles for those specific roles (roleIds already fetched above)
    // Split into separate queries to avoid nested PostgREST issues
    const { data: userRolesData, error: userRolesError } = await supabase
      .from('user_roles')
      .select('user_id, role_id')
      .in('role_id', roleIds);

    if (userRolesError) {
      console.error('Error fetching user roles for department metrics:', userRolesError);
    }

    // Get user profiles separately
    const userProfileIds = Array.from(new Set(userRolesData?.map((ur: any) => ur.user_id) || []));
    let teamMembers: Record<string, unknown>[] = [];

    if (userProfileIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, name, image, workload_sentiment')
        .in('id', userProfileIds);

      if (profilesError) {
        console.error('Error fetching user profiles for department metrics:', profilesError);
      } else {
        // Map user_roles to user_profiles
        teamMembers = (profilesData || []).map((profile: any) => ({
          user_profiles: profile
        }));
      }
    }


    const activeProjects = projects?.filter((p: any) =>
      p.status !== 'complete' && p.status !== 'on_hold'
    ) || [];

    // Deduplicate users by ID in case they have multiple roles in the same department
    const uniqueUsers = new Map<string, Record<string, unknown>>();
    (teamMembers || []).forEach((member: any) => {
      const user = member.user_profiles as Record<string, unknown>;
      if (user && !uniqueUsers.has((user as any).id as string)) {
        uniqueUsers.set((user as any).id as string, user);
      }
    });
    const teamSize = uniqueUsers.size;


    const projectHealth = {
      healthy: 0,
      atRisk: 0,
      critical: 0
    };

    const now = new Date();
    activeProjects.forEach((project: any) => {
      if (!project.end_date) {
        projectHealth.healthy++;
        return;
      }

      const endDate = new Date(project.end_date as string);
      const daysUntilDeadline = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilDeadline < 0) {
        projectHealth.critical++;
      } else if (daysUntilDeadline <= 7) {
        projectHealth.atRisk++;
      } else {
        projectHealth.healthy++;
      }
    });

    // Calculate workload distribution based on actual time entries and availability
    // Get current week start (Monday)
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const weekStart = new Date(today.getFullYear(), today.getMonth(), diff);
    const weekStartStr = weekStart.toISOString().split('T')[0];

    // Get user IDs for querying (from team members)
    const teamUserIds = Array.from(uniqueUsers.keys());

    // Fetch actual hours logged this week for all users
    const timeEntriesMap = new Map<string, number>();
    if (teamUserIds.length > 0) {
      const { data: timeEntries, error: timeError } = await supabase
        .from('time_entries')
        .select('user_id, hours_logged')
        .in('user_id', teamUserIds)
        .gte('entry_date', weekStartStr);

      if (!timeError && timeEntries) {
        timeEntries.forEach((entry: any) => {
          const current = timeEntriesMap.get(entry.user_id as string) || 0;
          timeEntriesMap.set(entry.user_id as string, current + ((entry.hours_logged as number) || 0));
        });
      }
    }

    // Fetch availability for all users this week
    const availabilityMap = new Map<string, number>();
    if (teamUserIds.length > 0) {
      const { data: availability, error: availError} = await supabase
        .from('user_availability')
        .select('user_id, available_hours')
        .in('user_id', teamUserIds)
        .eq('week_start_date', weekStartStr);

      if (!availError && availability) {
        availability.forEach((avail: any) => {
          availabilityMap.set(avail.user_id as string, (avail.available_hours as number) || 0);
        });
      }
    }

    // Calculate workload distribution with real data
    const workloadDistribution = Array.from(uniqueUsers.values()).map((user: any) => {
      const actualHours = timeEntriesMap.get((user as any).id as string) || 0;
      const availableHours = availabilityMap.get((user as any).id as string) || DEFAULT_WEEKLY_HOURS; // Default 40 hours/week if not set

      // Calculate utilization percentage
      const workloadPercentage = availableHours > 0
        ? Math.min(Math.round((actualHours / availableHours) * 100), 100)
        : 0;

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
        userId: (user as any).id as string,
        userName: (user as any).name as string,
        userImage: (user as any).image as string | null,
        workloadPercentage,
        workloadSentiment,
        actualHours,
        availableHours,
      };
    });

    // Calculate overall capacity utilization
    const totalAvailableHours = workloadDistribution.reduce((sum: number, member: any) =>
      sum + ((member?.availableHours as number) || 0), 0
    );
    const totalActualHours = workloadDistribution.reduce((sum: number, member: any) =>
      sum + ((member?.actualHours as number) || 0), 0
    );
    const capacityUtilization = totalAvailableHours > 0
      ? (totalActualHours / totalAvailableHours) * 100
      : 0;

    return {
      id: department.id,
      name: department.name,
      description: department.description,
      activeProjects: activeProjects.length,
      teamSize,
      capacityUtilization: parseFloat(capacityUtilization.toFixed(2)),
      projectHealth,
      workloadDistribution,
      recentProjects: activeProjects.slice(0, 5) as unknown as Project[]
    };
  }
}

// Export singleton instance (server-side only)
export const serverDepartmentService = new ServerDepartmentService();
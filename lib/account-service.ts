import { createClientSupabase } from './supabase';
import { Database } from './supabase';

// Helper functions for status mapping
const getStatusDisplayName = (status: string) => {
  const statusMap: { [key: string]: string } = {
    'planning': 'Planning',
    'in_progress': 'In Progress',
    'review': 'Review',
    'complete': 'Complete',
    'on_hold': 'On Hold'
  };
  return statusMap[status] || 'Planning';
};

const getStatusColor = (status: string) => {
  const colorMap: { [key: string]: string } = {
    'planning': '#6B7280',
    'in_progress': '#3B82F6',
    'review': '#F59E0B',
    'complete': '#10B981',
    'on_hold': '#EF4444'
  };
  return colorMap[status] || '#6B7280';
};

export type Account = Database['public']['Tables']['accounts']['Row'];
export type Project = Database['public']['Tables']['projects']['Row'];
export type User = Database['public']['Tables']['user_profiles']['Row'];

export interface AccountWithProjects extends Account {
  projects: ProjectWithDetails[];
  account_manager?: User;
}

export interface ProjectWithDetails {
  id: string;
  name: string;
  description: string | null;
  account_id: string;
  status: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimated_hours: number | null;
  actual_hours: number | null;
  remaining_hours?: number | null;
  task_hours_sum?: number;
  start_date: string | null;
  end_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  assigned_user_id?: string | null;
  departments: {
    id: string;
    name: string;
  }[];
  assigned_users: {
    id: string;
    name: string;
    image: string;
  }[];
  stakeholders?: {
    id: string;
    user_id: string;
    role: string;
    user_profiles?: {
      id: string;
      name: string;
      email: string;
      image: string | null;
    };
  }[];
  status_info: {
    id: string;
    name: string;
    color: string;
  };
  workflow_step?: string | null;  // Current workflow step name from workflow_instances
}

export interface AccountMetrics {
  activeProjects: number;
  completedProjects: number;
  totalProjects: number;
  upcomingDeadlines: number;
  overdueProjects: number;
  pendingApprovals: number;
  healthScore: number; // 0-100
}

export interface UrgentItem {
  id: string;
  type: 'project' | 'task' | 'approval';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  dueDate: Date;
  projectId?: string;
  assigneeId?: string;
}

class AccountService {
  // Get account by ID with related data
  async getAccountById(accountId: string, userMap?: { [key: string]: any }, supabaseClient?: any): Promise<AccountWithProjects | null> {
    try {
      const supabase = supabaseClient || createClientSupabase();
      if (!supabase) {
        console.error('Supabase client not available');
        return null;
      }

      const { data: account, error: accountError } = await supabase
        .from('accounts')
        .select(`
          *,
          user_profiles!accounts_account_manager_id_fkey(*)
        `)
        .eq('id', accountId)
        .single();

      if (accountError) {
        console.error('Error fetching account:', accountError);
        return null;
      }

      if (!account) return null;

      // Get projects for this account
      console.log('getAccountById: About to call getAccountProjects for accountId:', accountId);
      const projects = await this.getAccountProjects(accountId, userMap, supabase);
      console.log('getAccountById: getAccountProjects returned:', projects.length, 'projects');

      return {
        ...account,
        projects,
        account_manager: account.user_profiles as User,
      };
    } catch (error) {
      console.error('Error in getAccountById:', error);
      return null;
    }
  }

  // Get all accounts
  async getAllAccounts(supabaseClient?: any): Promise<Account[]> {
    try {
      const supabase = supabaseClient || createClientSupabase();
      if (!supabase) {
        console.error('Supabase client not available');
        return [];
      }

      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('name');

      console.log('📊 getAllAccounts result:', {
        count: data?.length,
        hasError: !!error,
        error: error ? { message: error.message, code: error.code } : null
      });

      if (error) {
        console.error('❌ Error fetching accounts:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ Error in getAllAccounts:', error);
      return [];
    }
  }

  // Check if a user can edit a specific project
  async canUserEditProject(userId: string, projectId: string, supabaseClient?: any): Promise<boolean> {
    try {
      const supabase = supabaseClient || createClientSupabase();
      if (!supabase) {
        console.error('Supabase client not available');
        return false;
      }

      // First, check if user has EDIT_ALL_PROJECTS permission (override)
      // Get user's roles and permissions
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select(`
          role_id,
          roles(id, name, permissions, is_system_role)
        `)
        .eq('user_id', userId);

      if (!rolesError && userRoles) {
        for (const ur of userRoles) {
          const role = ur.roles as any;
          if (!role?.permissions) continue;

          // Check for EDIT_ALL_PROJECTS permission (permission-based, not role name based)
          if (role.permissions.edit_all_projects === true) {
            return true;
          }
        }
      }

      // Get project details
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select(`
          id,
          created_by,
          assigned_user_id,
          account_id,
          accounts!inner(
            account_manager_id
          )
        `)
        .eq('id', projectId)
        .single();

      if (projectError || !project) {
        console.error('Error fetching project:', projectError);
        return false;
      }

      // Check if user is the project creator
      if (project.created_by === userId) {
        return true;
      }

      // Check if user is the assigned user
      if (project.assigned_user_id === userId) {
        return true;
      }

      // Check if user is the account manager
      if (project.accounts?.account_manager_id === userId) {
        return true;
      }

      // Check if user has EDIT_PROJECT permission AND is assigned to this project
      if (userRoles) {
        for (const ur of userRoles) {
          const role = ur.roles as any;
          if (role?.permissions?.edit_project === true) {
            // Check if user is assigned to this project via project_assignments
            const { data: assignment } = await supabase
              .from('project_assignments')
              .select('id')
              .eq('project_id', projectId)
              .eq('user_id', userId)
              .maybeSingle();

            if (assignment) {
              return true;
            }
          }
        }
      }

      // Stakeholders have read-only access, not edit access
      return false;
    } catch (error) {
      console.error('Error in canUserEditProject:', error);
      return false;
    }
  }

  // Check if a user can access a specific account
  async canUserAccessAccount(userId: string, accountId: string, supabaseClient?: any): Promise<boolean> {
    try {
      const supabase = supabaseClient || createClientSupabase();
      if (!supabase) {
        console.error('Supabase client not available');
        return false;
      }

      // Check if user is the account manager
      const { data: managedAccount, error: managedError } = await supabase
        .from('accounts')
        .select('id')
        .eq('id', accountId)
        .eq('account_manager_id', userId)
        .single();

      if (managedError && managedError.code !== 'PGRST116') {
        console.error('Error checking managed account:', managedError);
        return false;
      }

      if (managedAccount) {
        return true;
      }

      // Check if user is a member of this account (via account_members table)
      const { data: accountMember, error: memberError } = await supabase
        .from('account_members')
        .select('id')
        .eq('account_id', accountId)
        .eq('user_id', userId)
        .single();

      if (memberError && memberError.code !== 'PGRST116' && memberError.code !== '42P01') {
        console.error('Error checking account membership:', memberError);
        // Continue checking other access methods
      }

      if (accountMember) {
        return true;
      }

      // Check if user has projects in this account (as creator or assignee)
      const { data: projectAccess, error: projectError } = await supabase
        .from('projects')
        .select('id')
        .eq('account_id', accountId)
        .or(`created_by.eq.${userId},assigned_user_id.eq.${userId}`)
        .limit(1);

      if (projectError) {
        console.error('Error checking project access:', projectError);
        return false;
      }

      // Also check if user is a stakeholder on any project in this account
      if (!projectAccess || projectAccess.length === 0) {
        const { data: stakeholderAccess, error: stakeholderError } = await supabase
          .from('project_stakeholders')
          .select('project_id, projects!inner(account_id)')
          .eq('user_id', userId)
          .eq('projects.account_id', accountId)
          .limit(1);

        if (stakeholderError) {
          console.error('Error checking stakeholder access:', stakeholderError);
          return false;
        }

        return (stakeholderAccess && stakeholderAccess.length > 0);
      }

      return (projectAccess && projectAccess.length > 0);
    } catch (error) {
      console.error('Error in canUserAccessAccount:', error);
      return false;
    }
  }

  // Check if user has FULL (edit) access to account (not just read-only via project stakeholder)
  async hasFullAccountAccess(userId: string, accountId: string, supabaseClient?: any): Promise<boolean> {
    try {
      const supabase = supabaseClient || createClientSupabase();
      if (!supabase) {
        console.error('Supabase client not available');
        return false;
      }

      // Check if user is the account manager
      const { data: managedAccount, error: managedError } = await supabase
        .from('accounts')
        .select('id')
        .eq('id', accountId)
        .eq('account_manager_id', userId)
        .single();

      if (managedError && managedError.code !== 'PGRST116') {
        console.error('Error checking managed account:', managedError);
        return false;
      }

      if (managedAccount) {
        return true;
      }

      // Check if user is a member of this account (via account_members table)
      // Account members have full access to their assigned accounts
      const { data: accountMember, error: memberError } = await supabase
        .from('account_members')
        .select('id')
        .eq('account_id', accountId)
        .eq('user_id', userId)
        .single();

      if (memberError && memberError.code !== 'PGRST116' && memberError.code !== '42P01') {
        console.error('Error checking account membership:', memberError);
        // Continue - don't fail the check
      }

      if (accountMember) {
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error in hasFullAccountAccess:', error);
      return false;
    }
  }

  // Get accounts that a user has access to (through projects, membership, or as account manager)
  async getUserAccounts(userId: string, supabaseClient?: any): Promise<Account[]> {
    try {
      const supabase = supabaseClient || createClientSupabase();
      if (!supabase) {
        console.error('Supabase client not available');
        return [];
      }

      // Get accounts where user is the account manager
      const { data: managedAccounts, error: managedError } = await supabase
        .from('accounts')
        .select('*')
        .eq('account_manager_id', userId)
        .order('name');

      if (managedError) {
        console.error('Error fetching managed accounts:', managedError);
        return [];
      }

      // Get accounts where user is a member (via account_members table)
      let memberAccounts: any[] = [];
      const { data: accountMemberships, error: membershipError } = await supabase
        .from('account_members')
        .select('account_id')
        .eq('user_id', userId);

      if (membershipError && membershipError.code !== '42P01') {
        console.error('Error fetching account memberships:', membershipError);
        // Continue - don't fail the whole query
      } else if (accountMemberships && accountMemberships.length > 0) {
        const memberAccountIds = accountMemberships.map((am: any) => am.account_id);

        // Fetch the actual account data
        const { data: memberAccountData, error: memberAccountDataError } = await supabase
          .from('accounts')
          .select('*')
          .in('id', memberAccountIds);

        if (memberAccountDataError) {
          console.error('Error fetching member account data:', memberAccountDataError);
        } else if (memberAccountData) {
          memberAccounts = memberAccountData;
        }
      }

      // Get accounts where user has projects assigned (as creator)
      let createdProjectAccountIds: string[] = [];
      const { data: createdProjects, error: createdProjectError } = await supabase
        .from('projects')
        .select('account_id')
        .eq('created_by', userId);

      if (createdProjectError) {
        console.error('Error fetching created projects:', createdProjectError);
      } else if (createdProjects) {
        createdProjectAccountIds = createdProjects.map((p: any) => p.account_id).filter(Boolean);
      }

      // Get accounts where user is assigned to projects (as assignee)
      let assignedProjectAccountIds: string[] = [];
      const { data: assignedProjects, error: assignedProjectError } = await supabase
        .from('projects')
        .select('account_id')
        .eq('assigned_user_id', userId);

      if (assignedProjectError) {
        console.error('Error fetching assigned projects:', assignedProjectError);
      } else if (assignedProjects) {
        assignedProjectAccountIds = assignedProjects.map((p: any) => p.account_id).filter(Boolean);
      }

      // Combine all account IDs and deduplicate
      const allAccountIds = [
        ...(managedAccounts?.map((a: any) => a.id) || []),
        ...(memberAccounts?.map((a: any) => a.id) || []),
        ...createdProjectAccountIds,
        ...assignedProjectAccountIds
      ];

      // Remove duplicates
      const uniqueAccountIds = Array.from(new Set(allAccountIds));

      // Fetch all accounts in one query
      const { data: allAccounts, error: allAccountsError } = await supabase
        .from('accounts')
        .select('*')
        .in('id', uniqueAccountIds);

      if (allAccountsError) {
        console.error('Error fetching all accounts:', allAccountsError);
        // Return the managed accounts as fallback
        return managedAccounts || [];
      }

      // Remove duplicates based on account ID
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const uniqueAccounts = (allAccounts || []).filter((account: any, index: number, self: any[]) =>
        index === self.findIndex((a: any) => a.id === account.id)
      );

      return uniqueAccounts;
    } catch (error) {
      console.error('Error in getUserAccounts:', error);
      return [];
    }
  }

  // Get projects for a specific account
  // Pass a supabase client to ensure proper auth context (server or client)
  async getAccountProjects(accountId: string, userMap?: { [key: string]: any }, supabaseClient?: any): Promise<ProjectWithDetails[]> {
    console.log('getAccountProjects: Starting for accountId:', accountId);
    try {
      // Use provided client, or fall back to singleton (less reliable)
      const supabase = supabaseClient || createClientSupabase();
      
      if (!supabase) {
        console.error('Supabase client not available');
        return [];
      }

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false });

      console.log('📊 Projects query result:', {
        accountId,
        dataLength: data?.length,
        hasError: !!error,
        error: error ? {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        } : null
      });

      if (error) {
        console.error('❌ Error fetching account projects:', error);
        return [];
      }
      
      if (!data || data.length === 0) {
        console.warn('⚠️ NO PROJECTS RETURNED for account:', accountId);
      }


      // Fetch assigned user data separately for projects that have assigned users
      const projectsWithAssignedUsers = (data || []).filter((p: any) => p.assigned_user_id);
      const assignedUserIds = projectsWithAssignedUsers.map((p: any) => p.assigned_user_id);
      
      console.log('Projects with assigned users:', projectsWithAssignedUsers.length);
      console.log('Assigned user IDs:', assignedUserIds);
      
      let assignedUsersMap: { [key: string]: any } = {};
      if (assignedUserIds.length > 0) {
        console.log('Looking up users with IDs:', assignedUserIds);
        
        // If userMap is provided, use it instead of querying the database
        if (userMap) {
          console.log('Using provided userMap');
          assignedUsersMap = assignedUserIds.reduce((acc: any, userId: string) => {
            if (userMap[userId]) {
              acc[userId] = userMap[userId];
            }
            return acc;
          }, {} as { [key: string]: any });
          console.log('Assigned users from userMap:', assignedUsersMap);
        } else {
          console.log('No userMap provided, querying database...');
          // Use the same authenticated supabase client that was passed in
          if (!supabase) {
            console.error('Supabase client not available');
            return [];
          }

          // Try the same approach as auth system
          console.log('Testing single user lookup (like auth system)...');
          const { data: singleUserData, error: singleUserError } = await supabase
            .from('user_profiles')
            .select('id, name, email, image')
            .eq('id', assignedUserIds[0])
            .single();
          
          console.log('Single user query result:', singleUserData);
          console.log('Single user query error:', singleUserError);

          // Try the original approach
          console.log('Testing multiple user lookup...');
          const { data: usersData, error: usersError } = await supabase
            .from('user_profiles')
            .select('id, name, email, image')
            .in('id', assignedUserIds);
          
          console.log('Users data from database:', usersData);
          console.log('Users error:', usersError);
          
          // Prefer multiple user lookup (gets all users), fall back to single user lookup
          if (!usersError && usersData && usersData.length > 0) {
            console.log('Using multiple user lookup result (preferred)');
            assignedUsersMap = usersData.reduce((acc: any, user: any) => {
              acc[user.id] = user;
              return acc;
            }, {} as { [key: string]: any });
          } else if (!singleUserError && singleUserData) {
            console.log('Using single user lookup result (fallback)');
            assignedUsersMap[assignedUserIds[0]] = singleUserData;
          } else {
            console.log('No user data found from any query');
          }
        }
      }
      
      console.log('Assigned users map:', assignedUsersMap);

      // Get departments for each project via project_assignments
      const projectIds = (data || []).map((p: any) => p.id);
      const departmentsByProject: { [key: string]: any[] } = {};

      // Fetch workflow steps for projects
      const workflowSteps: { [key: string]: string | null } = {};
      if (projectIds.length > 0) {
        const { data: workflowData, error: workflowError } = await supabase
          .from('workflow_instances')
          .select(`
            project_id,
            current_node_id,
            workflow_nodes!workflow_instances_current_node_id_fkey (
              label
            )
          `)
          .in('project_id', projectIds)
          .eq('status', 'active');

        if (!workflowError && workflowData) {
          workflowData.forEach((instance: any) => {
            if (instance.project_id && instance.workflow_nodes?.label) {
              workflowSteps[instance.project_id] = instance.workflow_nodes.label;
            }
          });
        }
      }

      if (projectIds.length > 0) {
        const { data: assignments, error: assignmentsError } = await supabase
          .from('project_assignments')
          .select(`
            project_id,
            user_id,
            user_roles!user_roles_user_id_fkey (
              role_id,
              roles!user_roles_role_id_fkey (
                department_id,
                departments!roles_department_id_fkey (
                  id,
                  name
                )
              )
            )
          `)
          .in('project_id', projectIds)
          .is('removed_at', null);

        if (!assignmentsError && assignments) {
          // Build a map of project_id -> unique departments
          assignments.forEach((assignment: any) => {
            const projectId = assignment.project_id;
            if (!departmentsByProject[projectId]) {
              departmentsByProject[projectId] = [];
            }

            // Extract departments from user roles
            const userRoles = assignment.user_roles || [];
            userRoles.forEach((userRole: any) => {
              const role = userRole.roles;
              if (role && role.departments) {
                const dept = role.departments;
                // Check if department already exists for this project
                const exists = departmentsByProject[projectId].some((d: any) => d.id === dept.id);
                if (!exists) {
                  departmentsByProject[projectId].push(dept);
                }
              }
            });
          });
        }
      }

      const mappedProjects = (data || []).map((project: any) => {
        const assignedUsers = project.assigned_user_id && assignedUsersMap[project.assigned_user_id] 
          ? [assignedUsersMap[project.assigned_user_id]] 
          : [];
        
        // Debug: Log if a project has an assigned_user_id but no assigned user data
        if (project.assigned_user_id && assignedUsers.length === 0) {
          console.warn(`⚠️ Project "${project.name}" has assigned_user_id "${project.assigned_user_id}" but no user data found in map`);
          console.log('Available user IDs in map:', Object.keys(assignedUsersMap));
        }
        
        console.log(`Project ${project.name}:`, {
          assigned_user_id: project.assigned_user_id,
          assigned_users: assignedUsers,
          user_in_map: assignedUsersMap[project.assigned_user_id]
        });
        
        return {
          ...project,
          departments: departmentsByProject[project.id] || [],
          assigned_users: assignedUsers,
          status_info: {
            id: project.status,
            name: getStatusDisplayName(project.status),
            color: getStatusColor(project.status)
          },
          workflow_step: workflowSteps[project.id] || null,
        };
      });
      
      console.log('Final mapped projects:', mappedProjects);
      return mappedProjects;
    } catch (error) {
      console.error('Error in getAccountProjects:', error);
      return [];
    }
  }

  // Get account metrics
  async getAccountMetrics(accountId: string, supabaseClient?: any): Promise<AccountMetrics> {
    try {
      const projects = await this.getAccountProjects(accountId, undefined, supabaseClient);
      const now = new Date();

      const activeProjects = projects.filter(p =>
        p.status_info.name !== 'Complete' && p.status_info.name !== 'Cancelled'
      ).length;

      const completedProjects = projects.filter(p =>
        p.status_info.name === 'Complete'
      ).length;

      const totalProjects = projects.length;

      // Upcoming deadlines - only count non-completed projects with deadlines in next 7 days
      const upcomingDeadlines = projects.filter(p => {
        if (!p.end_date) return false;
        // IMPORTANT: Exclude completed projects from deadline counts
        if (p.status_info.name === 'Complete' || p.status_info.name === 'Cancelled') return false;
        const endDate = new Date(p.end_date);
        const daysUntilDeadline = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntilDeadline > 0 && daysUntilDeadline <= 7;
      }).length;

      // Overdue projects - only count non-completed projects that are past due
      const overdueProjects = projects.filter(p => {
        if (!p.end_date) return false;
        // IMPORTANT: Exclude completed projects from overdue counts
        if (p.status_info.name === 'Complete' || p.status_info.name === 'Cancelled') return false;
        const endDate = new Date(p.end_date);
        return endDate < now;
      }).length;

      // Count actual pending approvals from workflow instances for this account's projects
      let pendingApprovals = 0;
      if (supabaseClient && projects.length > 0) {
        const projectIds = projects.map(p => p.id);

        // Query workflow instances for account's projects that are waiting on approval/form nodes
        const { data: workflowInstances, error: workflowError } = await supabaseClient
          .from('workflow_instances')
          .select(`
            id,
            project_id,
            workflow_nodes!workflow_instances_current_node_id_fkey(node_type)
          `)
          .in('project_id', projectIds)
          .eq('status', 'active');

        if (!workflowError && workflowInstances) {
          // Count instances where current node is an approval or form type
          pendingApprovals = workflowInstances.filter((instance: any) => {
            const nodeType = instance.workflow_nodes?.node_type;
            return nodeType === 'approval' || nodeType === 'form';
          }).length;
        }
      }

      // Calculate health score based on various factors
      let healthScore = 100;
      if (overdueProjects > 0) healthScore -= overdueProjects * 20;
      if (upcomingDeadlines > 3) healthScore -= (upcomingDeadlines - 3) * 5;
      if (pendingApprovals > 3) healthScore -= (pendingApprovals - 3) * 10;
      healthScore = Math.max(0, healthScore);

      return {
        activeProjects,
        completedProjects,
        totalProjects,
        upcomingDeadlines,
        overdueProjects,
        pendingApprovals,
        healthScore,
      };
    } catch (error) {
      console.error('Error in getAccountMetrics:', error);
      return {
        activeProjects: 0,
        completedProjects: 0,
        totalProjects: 0,
        upcomingDeadlines: 0,
        overdueProjects: 0,
        pendingApprovals: 0,
        healthScore: 0,
      };
    }
  }

  // Get urgent items for an account
  async getUrgentItems(accountId: string, supabaseClient?: any): Promise<UrgentItem[]> {
    try {
      const projects = await this.getAccountProjects(accountId, undefined, supabaseClient);
      const now = new Date();
      const urgentItems: UrgentItem[] = [];

      projects.forEach(project => {
        // Check for projects marked as URGENT priority
        if (project.priority === 'urgent' && project.status_info.name !== 'Complete') {
          urgentItems.push({
            id: `urgent-${project.id}`,
            type: 'project',
            title: `URGENT: ${project.name}`,
            description: project.description || 'High priority project requiring immediate attention',
            priority: 'high',
            dueDate: project.end_date ? new Date(project.end_date) : new Date(),
            projectId: project.id,
          });
        }

        // Check for overdue projects
        if (project.end_date) {
          const endDate = new Date(project.end_date);
          const daysOverdue = Math.ceil((now.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysOverdue > 0 && project.status_info.name !== 'Complete') {
            urgentItems.push({
              id: `overdue-${project.id}`,
              type: 'project',
              title: `Overdue: ${project.name}`,
              description: `Project is ${daysOverdue} days overdue`,
              priority: 'high',
              dueDate: endDate,
              projectId: project.id,
            });
          }
        }

        // Check for projects due soon
        if (project.end_date) {
          const endDate = new Date(project.end_date);
          const daysUntilDeadline = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysUntilDeadline > 0 && daysUntilDeadline <= 3 && project.status_info.name !== 'Complete') {
            urgentItems.push({
              id: `due-soon-${project.id}`,
              type: 'project',
              title: `Due Soon: ${project.name}`,
              description: `Project due in ${daysUntilDeadline} days`,
              priority: daysUntilDeadline === 1 ? 'high' : 'medium',
              dueDate: endDate,
              projectId: project.id,
            });
          }
        }
      });

      // Sort by priority and due date
      return urgentItems.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return a.dueDate.getTime() - b.dueDate.getTime();
      });
    } catch (error) {
      console.error('Error in getUrgentItems:', error);
      return [];
    }
  }

  // Create a new project for an account
  async createProject(accountId: string, projectData: {
    name: string;
    description?: string;
    start_date?: string;
    end_date?: string;
    status?: string;
    assigned_user_id?: string;
  }, createdBy?: string): Promise<Project | null> {
    try {
      const supabase = createClientSupabase();
      if (!supabase) {
        console.error('Supabase client not available');
        return null;
      }


      console.log('Creating project with assigned_user_id:', projectData.assigned_user_id);

      const { data, error } = await supabase
        .from('projects')
        .insert({
          ...projectData,
          account_id: accountId,
          priority: 'medium', // Default priority
          created_by: createdBy || null,
          assigned_user_id: projectData.assigned_user_id || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating project:', error);
        return null;
      }

      console.log('Project created successfully with assigned_user_id:', data?.assigned_user_id);
      return data;
    } catch (error) {
      console.error('Error in createProject:', error);
      return null;
    }
  }

  // Update project
  async updateProject(projectId: string, updates: Partial<Project>): Promise<Project | null> {
    try {
      const supabase = createClientSupabase();
      if (!supabase) {
        console.error('Supabase client not available');
        return null;
      }

      console.log('Updating project:', projectId, 'with updates:', updates);
      
      // First, let's check if the project exists and what its current state is
      const { data: currentProject, error: fetchError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (fetchError) {
        console.error('Error fetching current project:', fetchError);
        return null;
      }

      console.log('Current project state:', currentProject);
      
      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId)
        .select()
        .single();

      if (error) {
        console.error('Error updating project:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          fullError: error
        });
        return null;
      }

      console.log('Project updated successfully:', data);
      return data;
    } catch (error) {
      console.error('Error in updateProject:', error);
      return null;
    }
  }

  // Delete project
  async deleteProject(projectId: string): Promise<boolean> {
    try {
      console.log('deleteProject called with ID:', projectId);
      const supabase = createClientSupabase();
      if (!supabase) {
        console.error('Supabase client not available');
        return false;
      }

      console.log('Attempting to delete project from database...');
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) {
        console.error('Error deleting project:', error);
        return false;
      }

      console.log('Project deleted from database successfully');
      return true;
    } catch (error) {
      console.error('Error in deleteProject:', error);
      return false;
    }
  }

  // Get all users for assignment
  async getAllUsers(): Promise<User[]> {
    try {
      const supabase = createClientSupabase();
      if (!supabase) {
        console.error('Supabase client not available');
        return [];
      }

      // Get all users with their roles, account memberships, and department memberships
      const { data: users, error: usersError } = await supabase
        .from('user_profiles')
        .select(`
          *,
          user_roles!user_roles_user_id_fkey(
            role_id,
            roles!user_roles_role_id_fkey(
              id,
              name,
              department_id
            )
          ),
          account_members(
            account_id
          )
        `)
        .order('name');

      console.log('Database query result:', { users, usersError });
      
      // If the complex query fails, fall back to a simpler approach with manual filtering
      if (usersError || !users) {
        console.log('Complex query failed, trying simpler approach with manual filtering...');
        const { data: simpleUsers, error: simpleError } = await supabase
          .from('user_profiles')
          .select('*')
          .order('name');
        
        if (simpleError) {
          console.error('Simple query also failed:', simpleError);
          return [];
        }
        
        console.log('Using simple query result:', simpleUsers);
        
        // Now manually check each user for roles, account memberships, and department memberships
        const filteredUsers = [];
        
        for (const user of simpleUsers || []) {
          // Check if user has any roles
          const { data: userRoles } = await supabase
            .from('user_roles')
            .select('role_id, roles:role_id(id, name, department_id)')
            .eq('user_id', user.id);
          
          // Check if user has any account memberships
          const { data: accountMembers } = await supabase
            .from('account_members')
            .select('account_id')
            .eq('user_id', user.id);
          
          const hasRoles = userRoles && userRoles.length > 0;
          const hasAccountMemberships = accountMembers && accountMembers.length > 0;
          const hasDepartmentMemberships = userRoles?.some((ur: any) => 
            ur.roles && ur.roles.department_id
          ) || false;
          
          const hasAnyMembership = hasRoles || hasAccountMemberships || hasDepartmentMemberships;
          
          if (hasAnyMembership) {
            filteredUsers.push(user);
          } else {
            console.log(`Filtering out user ${user.name} (${user.email}) - no roles, accounts, or departments`);
          }
        }
        
        console.log(`Manual filtering result: ${filteredUsers.length} out of ${simpleUsers?.length || 0} users have roles/accounts/departments`);
        return filteredUsers;
      }

      if (usersError) {
        console.error('Error fetching users with roles and memberships:', usersError);
        console.error('Full error details:', JSON.stringify(usersError, null, 2));
        return [];
      }

      if (!users || users.length === 0) {
        return [];
      }

      console.log('Raw users before filtering:', users.map((u: any) => ({ 
        name: u.name, 
        email: u.email, 
        hasRoles: u.user_roles?.length > 0,
        hasAccountMembers: u.account_members?.length > 0,
        roles: u.user_roles?.map((ur: any) => ur.roles?.name).filter(Boolean),
        departments: u.user_roles?.map((ur: any) => ur.roles?.department_id).filter(Boolean),
        user_roles: u.user_roles,
        account_members: u.account_members
      })));

      // Filter users who have at least one role, account membership, or department membership
      const filteredUsers = users.filter((user: any) => {
        // Check if user has any roles
        const hasRoles = user.user_roles && user.user_roles.length > 0;
        
        // Check if user has any account memberships
        const hasAccountMemberships = user.account_members && user.account_members.length > 0;
        
        // Check if user has any department memberships through roles (simplified check)
        const hasDepartmentMemberships = user.user_roles?.some((ur: any) => 
          ur.roles && ur.roles.department_id
        ) || false;

        // User must have at least one of: roles, account memberships, or department memberships
        const hasAnyMembership = hasRoles || hasAccountMemberships || hasDepartmentMemberships;
        
        if (!hasAnyMembership) {
          console.log(`Filtering out user ${user.name} (${user.email}) - no roles, accounts, or departments`);
        }
        
        return hasAnyMembership;
      });

      // Clean up the data structure to match the expected User interface
      const cleanedUsers = filteredUsers.map((user: any) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        created_at: user.created_at,
        updated_at: user.updated_at
      }));

      console.log(`Filtered users: ${cleanedUsers.length} out of ${users.length} users have roles/accounts/departments`);
      console.log('Filtered user details:', cleanedUsers.map((u: any) => ({ name: u.name, email: u.email })));
      return cleanedUsers;
    } catch (error) {
      console.error('Error in getAllUsers:', error);
      return [];
    }
  }
}

// Export singleton instance
export const accountService = new AccountService();

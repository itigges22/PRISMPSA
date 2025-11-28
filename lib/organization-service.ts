import { createClientSupabase } from './supabase';
import { roleManagementService, RoleHierarchyNode } from './role-management-service';
import { logger, databaseQuery, databaseError, performance } from './debug-logger';

// Types for organization structure
export interface Department {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  image: string | null;
  bio: string | null;
  skills: string[] | null;
  workload_sentiment: 'comfortable' | 'stretched' | 'overwhelmed' | null;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  department_id: string;
  permissions: Record<string, boolean>;
  reporting_role_id: string | null;
  hierarchy_level: number;
  is_system_role: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserWithRoles extends User {
  user_roles: {
    id: string;
    role_id: string;
    assigned_at: string;
    assigned_by: string | null;
    roles: Role & {
      departments: Department;
    };
  }[];
}

export interface DepartmentWithRoles extends Department {
  roles: (Role & {
    user_count: number;
    users: User[];
  })[];
}

export interface OrganizationStructure {
  departments: DepartmentWithRoles[];
  hierarchy: RoleHierarchyNode[];
  total_users: number;
  total_roles: number;
  total_departments: number;
}

export interface HierarchyView {
  nodes: RoleHierarchyNode[];
  total_users: number;
  max_depth: number;
}

class OrganizationService {
  private async getSupabase() {
    return createClientSupabase();
  }

  // Get complete organization structure
  async getOrganizationStructure(): Promise<OrganizationStructure | null> {
    const startTime = Date.now();
    
    try {
      const supabase = await this.getSupabase();
      if (!supabase) {
        logger.error('Supabase client not available', { action: 'getOrganizationStructure' });
        return null;
      }

      logger.debug('Fetching organization structure', { action: 'getOrganizationStructure' });

      // Fix the nested select syntax - use proper Supabase syntax
      databaseQuery('SELECT', 'departments', { action: 'getOrganizationStructure' });

      // First, get departments
      const { data: departments, error: deptError } = await supabase
        .from('departments')
        .select('*')
        .order('name');

      if (deptError) {
        databaseError('SELECT', 'departments', deptError, { action: 'getOrganizationStructure' });
        logger.error('Error fetching departments', { action: 'getOrganizationStructure' }, deptError);
        return null;
      }

      if (!departments || departments.length === 0) {
        logger.warn('No departments found', { action: 'getOrganizationStructure' });
        return {
          departments: [],
          hierarchy: [],
          total_users: 0,
          total_roles: 0,
          total_departments: 0,
        };
      }

      // Get hierarchy view
      const hierarchy = await roleManagementService.getRoleHierarchy();

      // Get roles for each department separately
      const processedDepartments: DepartmentWithRoles[] = [];
      
      for (const dept of departments || []) {
        if (!dept) {
          logger.warn('Null department found', { action: 'getOrganizationStructure' });
          continue;
        }

        // Get roles for this department
        const { data: roles, error: rolesError } = await supabase
          .from('roles')
          .select('*')
          .eq('department_id', dept.id);

        if (rolesError) {
          logger.warn('Error fetching roles for department', { 
            action: 'getOrganizationStructure', 
            departmentId: dept.id 
          });
        }

        // Get user counts for each role
        const rolesWithUserCounts = [];
        for (const role of roles || []) {
          const { count: userCount } = await supabase
            .from('user_roles')
            .select('*', { count: 'exact', head: true })
            .eq('role_id', role.id);

          rolesWithUserCounts.push({
            ...role,
            user_count: userCount || 0,
            users: [], // We'll populate this if needed
          });
        }

        processedDepartments.push({
          ...dept,
          roles: rolesWithUserCounts,
        });
      }

      // Calculate totals with null checks
      const allUserIds = new Set<string>();
      let totalRoles = 0;

      processedDepartments.forEach((dept: any) => {
        if (dept?.roles) {
          totalRoles += dept.roles.length;
          dept.roles.forEach((role: any) => {
            if (role?.users) {
              role.users.forEach((user: any) => {
                if (user?.id) {
                  allUserIds.add(user.id);
                }
              });
            }
          });
        }
      });

      const totalUsers = allUserIds.size;
      const totalDepartments = processedDepartments.length;

      const duration = Date.now() - startTime;
      performance('getOrganizationStructure', duration, { 
        action: 'getOrganizationStructure',
        departmentCount: totalDepartments,
        roleCount: totalRoles,
        userCount: totalUsers
      });

      logger.info('Organization structure fetched successfully', { 
        action: 'getOrganizationStructure',
        departmentCount: totalDepartments,
        roleCount: totalRoles,
        userCount: totalUsers,
        duration
      });

      return {
        departments: processedDepartments,
        hierarchy,
        total_users: totalUsers,
        total_roles: totalRoles,
        total_departments: totalDepartments,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Exception in getOrganizationStructure', { action: 'getOrganizationStructure', duration }, error as Error);
      return null;
    }
  }

  // Get hierarchy view (tree structure)
  async getHierarchyView(): Promise<HierarchyView | null> {
    try {
      const hierarchy = await roleManagementService.getRoleHierarchy();
      
      if (!hierarchy) return null;

      // Calculate total users and max depth
      const totalUsers = this.calculateTotalUsers(hierarchy);
      const maxDepth = this.calculateMaxDepth(hierarchy);

      return {
        nodes: hierarchy,
        total_users: totalUsers,
        max_depth: maxDepth,
      };
    } catch (error) {
      console.error('Error in getHierarchyView:', error);
      return null;
    }
  }

  // Get department-centric view
  async getDepartmentView(): Promise<DepartmentWithRoles[] | null> {
    try {
      const supabase = await this.getSupabase();
      if (!supabase) return null;

      const { data: departments, error } = await supabase
        .from('departments')
        .select(`
          *,
          roles!roles_department_id_fkey(
            *,
            user_roles!user_roles_role_id_fkey(
              user_profiles!user_roles_user_id_fkey(*)
            )
          )
        `)
        .order('name');

      if (error) {
        console.error('Error fetching department view:', error);
        return null;
      }

      return departments.map((dept: any) => ({
        ...dept,
        roles: dept.roles.map((role: any) => ({
          ...role,
          user_count: role.user_roles.length,
          users: role.user_roles.map((ur: any) => ur.user_profiles).filter(Boolean),
        })),
      }));
    } catch (error) {
      console.error('Error in getDepartmentView:', error);
      return null;
    }
  }

  // Get users by department
  async getUsersByDepartment(departmentId: string): Promise<UserWithRoles[]> {
    try {
      const supabase = await this.getSupabase();
      if (!supabase) return [];

      const { data: users, error } = await supabase
        .from('user_profiles')
        .select(`
          *,
          user_roles!user_roles_user_id_fkey(
            *,
            roles!user_roles_role_id_fkey(
              *,
              departments!roles_department_id_fkey(*)
            )
          )
        `)
        .eq('user_roles.roles.department_id', departmentId);

      if (error) {
        console.error('Error fetching users by department:', error);
        return [];
      }

      return users || [];
    } catch (error) {
      console.error('Error in getUsersByDepartment:', error);
      return [];
    }
  }

  // Get users by role
  async getUsersByRole(roleId: string): Promise<User[]> {
    try {
      const supabase = await this.getSupabase();
      if (!supabase) return [];

      const { data: userRoles, error } = await supabase
        .from('user_roles')
        .select(`
          user_profiles!user_roles_user_id_fkey(*)
        `)
        .eq('role_id', roleId);

      if (error) {
        console.error('Error fetching users by role:', error);
        return [];
      }

      return userRoles.map((ur: any) => ur.user_profiles).filter(Boolean);
    } catch (error) {
      console.error('Error in getUsersByRole:', error);
      return [];
    }
  }

  // Get role statistics
  async getRoleStatistics(): Promise<{
    total_roles: number;
    roles_by_department: Record<string, number>;
    roles_by_level: Record<number, number>;
    system_roles: number;
    custom_roles: number;
  }> {
    try {
      const supabase = await this.getSupabase();
      if (!supabase) return {
        total_roles: 0,
        roles_by_department: {},
        roles_by_level: {},
        system_roles: 0,
        custom_roles: 0,
      };

      const { data: roles, error } = await supabase
        .from('roles')
        .select(`
          id,
          department_id,
          hierarchy_level,
          is_system_role,
          departments!roles_department_id_fkey(name)
        `);

      if (error) {
        console.error('Error fetching role statistics:', error);
        return {
          total_roles: 0,
          roles_by_department: {},
          roles_by_level: {},
          system_roles: 0,
          custom_roles: 0,
        };
      }

      const rolesByDepartment: Record<string, number> = {};
      const rolesByLevel: Record<number, number> = {};
      let systemRoles = 0;
      let customRoles = 0;

      roles.forEach((role: any) => {
        // Count by department
        const deptName = role.departments?.name || 'Unknown';
        rolesByDepartment[deptName] = (rolesByDepartment[deptName] || 0) + 1;

        // Count by hierarchy level
        rolesByLevel[role.hierarchy_level] = (rolesByLevel[role.hierarchy_level] || 0) + 1;

        // Count system vs custom roles
        if (role.is_system_role) {
          systemRoles++;
        } else {
          customRoles++;
        }
      });

      return {
        total_roles: roles.length,
        roles_by_department: rolesByDepartment,
        roles_by_level: rolesByLevel,
        system_roles: systemRoles,
        custom_roles: customRoles,
      };
    } catch (error) {
      console.error('Error in getRoleStatistics:', error);
      return {
        total_roles: 0,
        roles_by_department: {},
        roles_by_level: {},
        system_roles: 0,
        custom_roles: 0,
      };
    }
  }

  // Get user statistics
  async getUserStatistics(): Promise<{
    total_users: number;
    users_by_department: Record<string, number>;
    users_by_role: Record<string, number>;
    users_with_multiple_roles: number;
  }> {
    try {
      const supabase = await this.getSupabase();
      if (!supabase) return {
        total_users: 0,
        users_by_department: {},
        users_by_role: {},
        users_with_multiple_roles: 0,
      };

      const { data: userRoles, error } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          roles!user_roles_role_id_fkey(
            name,
            departments!roles_department_id_fkey(name)
          )
        `);

      if (error) {
        console.error('Error fetching user statistics:', error);
        return {
          total_users: 0,
          users_by_department: {},
          users_by_role: {},
          users_with_multiple_roles: 0,
        };
      }

      const usersByDepartment: Record<string, number> = {};
      const usersByRole: Record<string, number> = {};
      const userRoleCounts: Record<string, number> = {};

      userRoles.forEach((ur: any) => {
        const userId = ur.user_id;
        const roleName = ur.roles?.name || 'Unknown';
        const deptName = ur.roles?.departments?.name || 'Unknown';

        // Count users by department
        usersByDepartment[deptName] = (usersByDepartment[deptName] || 0) + 1;

        // Count users by role
        usersByRole[roleName] = (usersByRole[roleName] || 0) + 1;

        // Count roles per user
        userRoleCounts[userId] = (userRoleCounts[userId] || 0) + 1;
      });

      const totalUsers = Object.keys(userRoleCounts).length;
      const usersWithMultipleRoles = Object.values(userRoleCounts).filter(count => count > 1).length;

      return {
        total_users: totalUsers,
        users_by_department: usersByDepartment,
        users_by_role: usersByRole,
        users_with_multiple_roles: usersWithMultipleRoles,
      };
    } catch (error) {
      console.error('Error in getUserStatistics:', error);
      return {
        total_users: 0,
        users_by_department: {},
        users_by_role: {},
        users_with_multiple_roles: 0,
      };
    }
  }

  // Validation methods
  async validateRoleAssignment(userId: string, roleId: string): Promise<{ valid: boolean; message?: string }> {
    return roleManagementService.validateRoleAssignment(userId, roleId);
  }

  async validateRoleHierarchy(roleId: string, reportingRoleId: string | null): Promise<{ valid: boolean; message?: string }> {
    return roleManagementService.validateRoleHierarchy(roleId, reportingRoleId);
  }

  // Search and filter methods
  async searchUsers(query: string): Promise<UserWithRoles[]> {
    try {
      const supabase = await this.getSupabase();
      if (!supabase) return [];

      const { data: users, error } = await supabase
        .from('user_profiles')
        .select(`
          *,
          user_roles!user_roles_user_id_fkey(
            *,
            roles!user_roles_role_id_fkey(
              *,
              departments!roles_department_id_fkey(*)
            )
          )
        `)
        .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(50);

      if (error) {
        console.error('Error searching users:', error);
        return [];
      }

      return users || [];
    } catch (error) {
      console.error('Error in searchUsers:', error);
      return [];
    }
  }

  async searchRoles(query: string): Promise<Role[]> {
    try {
      const supabase = await this.getSupabase();
      if (!supabase) return [];

      const { data: roles, error } = await supabase
        .from('roles')
        .select('*')
        .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
        .limit(50);

      if (error) {
        console.error('Error searching roles:', error);
        return [];
      }

      return roles || [];
    } catch (error) {
      console.error('Error in searchRoles:', error);
      return [];
    }
  }

  // Helper methods
  private calculateTotalUsers(nodes: RoleHierarchyNode[]): number {
    let total = 0;
    for (const node of nodes) {
      total += node.user_count;
      total += this.calculateTotalUsers(node.children);
    }
    return total;
  }

  private calculateMaxDepth(nodes: RoleHierarchyNode[]): number {
    if (nodes.length === 0) return 0;
    
    let maxDepth = 0;
    for (const node of nodes) {
      const childDepth = this.calculateMaxDepth(node.children);
      maxDepth = Math.max(maxDepth, childDepth + 1);
    }
    return maxDepth;
  }
}

// Export singleton instance
export const organizationService = new OrganizationService();

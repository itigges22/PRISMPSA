import { createClientSupabase } from './supabase';
import { Permission } from './permissions';
import { logger, databaseQuery, databaseError, roleManagement, performance } from './debug-logger';
import { validateRole, ValidationResult } from './validation';

// Types for role management
export interface Role {
  id: string;
  name: string;
  description: string | null;
  department_id: string;
  permissions: Record<Permission, boolean>;
  reporting_role_id: string | null;
  hierarchy_level: number;
  is_system_role: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoleWithDetails extends Role {
  department: {
    id: string;
    name: string;
  };
  reporting_role?: {
    id: string;
    name: string;
  } | null;
  user_count: number;
}

export interface RoleHierarchyNode {
  id: string;
  name: string;
  department_id: string;
  department_name: string;
  hierarchy_level: number;
  is_system_role: boolean;
  user_count: number;
  children: RoleHierarchyNode[];
  permissions: Permission[];
}

export interface CreateRoleData {
  name: string;
  description?: string;
  department_id: string;
  permissions: Record<Permission, boolean>;
  reporting_role_id?: string;
}

export interface UpdateRoleData {
  name?: string;
  description?: string;
  permissions?: Record<Permission, boolean>;
  reporting_role_id?: string;
  hierarchy_level?: number; // 1-100 scale
}

export interface UserRoleAssignment {
  user_id: string;
  role_id: string;
  assigned_by: string;
  assigned_at: string;
}

class RoleManagementService {
  private async getSupabase() {
    return createClientSupabase();
  }

  // CRUD operations
  async createRole(data: CreateRoleData): Promise<Role | null> {
    const startTime = Date.now();
    
    try {
      // Validate input data
      const validation = validateRole(data);
      if (!validation.isValid) {
        logger.error('Role validation failed', { 
          action: 'createRole',
          errors: validation.errors,
          warnings: validation.warnings
        });
        return null;
      }

      const supabase = await this.getSupabase();
      if (!supabase) {
        logger.error('Supabase client not available', { action: 'createRole' });
        return null;
      }

      logger.info('Creating role', { 
        action: 'createRole',
        name: data.name,
        department_id: data.department_id,
        hasReportingRole: !!data.reporting_role_id
      });

      databaseQuery('INSERT', 'roles', { action: 'createRole', name: data.name });

      const { data: role, error } = await supabase
        .from('roles')
        .insert({
          name: data.name,
          description: data.description || null,
          department_id: data.department_id,
          permissions: data.permissions || {},
          reporting_role_id: data.reporting_role_id || null,
        })
        .select()
        .single();

      if (error) {
        databaseError('INSERT', 'roles', error, { action: 'createRole', name: data.name });
        logger.error('Error creating role', { 
          action: 'createRole',
          name: data.name,
          error: error.message,
          code: error.code
        }, error);
        return null;
      }

      const duration = Date.now() - startTime;
      performance('createRole', duration, { action: 'createRole', name: data.name });

      roleManagement('created', role.id, undefined, { 
        action: 'createRole',
        name: data.name,
        department_id: data.department_id
      });

      logger.info('Role created successfully', { 
        action: 'createRole',
        roleId: role.id,
        name: role.name,
        duration
      });

      return role;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Exception in createRole', { 
        action: 'createRole',
        name: data.name,
        duration
      }, error as Error);
      return null;
    }
  }

  async updateRole(roleId: string, updates: UpdateRoleData): Promise<Role | null> {
    try {
      const supabase = await this.getSupabase();
      if (!supabase) return null;

      // Check if role is system role (cannot be updated)
      const { data: existingRole } = await supabase
        .from('roles')
        .select('is_system_role')
        .eq('id', roleId)
        .single();

      if (existingRole?.is_system_role) {
        throw new Error('Cannot update system roles');
      }

      const { data: role, error } = await supabase
        .from('roles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', roleId)
        .select()
        .single();

      if (error) {
        console.error('Error updating role:', error);
        return null;
      }

      return role;
    } catch (error) {
      console.error('Error in updateRole:', error);
      return null;
    }
  }

  async deleteRole(roleId: string): Promise<boolean> {
    try {
      const supabase = await this.getSupabase();
      if (!supabase) return false;

      // Check if role is system role (cannot be deleted)
      const { data: existingRole } = await supabase
        .from('roles')
        .select('is_system_role')
        .eq('id', roleId)
        .single();

      if (existingRole?.is_system_role) {
        throw new Error('Cannot delete system roles');
      }

      // Check if role has users assigned
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('id')
        .eq('role_id', roleId)
        .limit(1);

      if (userRoles && userRoles.length > 0) {
        throw new Error('Cannot delete role with assigned users');
      }

      const { error } = await supabase
        .from('roles')
        .delete()
        .eq('id', roleId);

      if (error) {
        console.error('Error deleting role:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in deleteRole:', error);
      return false;
    }
  }

  async getRoleById(roleId: string): Promise<RoleWithDetails | null> {
    const startTime = Date.now();
    
    try {
      if (!roleId || typeof roleId !== 'string') {
        logger.error('Invalid roleId provided', { action: 'getRoleById', roleId });
        return null;
      }

      const supabase = await this.getSupabase();
      if (!supabase) {
        logger.error('Supabase client not available', { action: 'getRoleById', roleId });
        return null;
      }

      logger.debug('Fetching role by ID', { action: 'getRoleById', roleId });

      databaseQuery('SELECT', 'roles', { action: 'getRoleById', roleId });

      // Fix the nested select syntax - use proper Supabase syntax
      const { data: role, error } = await supabase
        .from('roles')
        .select(`
          *,
          department:departments!roles_department_id_fkey(id, name),
          reporting_role:roles!roles_reporting_role_id_fkey(id, name)
        `)
        .eq('id', roleId)
        .single();

      if (error) {
        databaseError('SELECT', 'roles', error, { action: 'getRoleById', roleId });
        logger.error('Error fetching role', { action: 'getRoleById', roleId }, error);
        return null;
      }

      if (!role) {
        logger.warn('Role not found', { action: 'getRoleById', roleId });
        return null;
      }

      // Get user count separately to avoid complex joins
      const { count: userCount } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role_id', roleId);

      const duration = Date.now() - startTime;
      performance('getRoleById', duration, { action: 'getRoleById', roleId });

      const result: RoleWithDetails = {
        ...role,
        department: role.department || { id: '', name: 'Unknown' },
        reporting_role: role.reporting_role || null,
        user_count: userCount || 0,
      };

      logger.debug('Role fetched successfully', { 
        action: 'getRoleById', 
        roleId,
        name: role.name,
        userCount: result.user_count,
        duration
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Exception in getRoleById', { action: 'getRoleById', roleId, duration }, error as Error);
      return null;
    }
  }

  async getAllRoles(): Promise<RoleWithDetails[]> {
    try {
      const supabase = await this.getSupabase();
      if (!supabase) return [];

      const { data: roles, error } = await supabase
        .from('roles')
        .select(`
          *,
          department:departments!roles_department_id_fkey(id, name),
          reporting_role:roles!roles_reporting_role_id_fkey(id, name),
          user_roles!user_roles_role_id_fkey(count)
        `)
        .order('hierarchy_level', { ascending: false });

      if (error) {
        console.error('Error fetching roles:', error);
        return [];
      }

      return roles.map((role: any) => ({
        ...role,
        department: role.department,
        reporting_role: role.reporting_role,
        user_count: role.user_roles?.[0]?.count || 0,
      }));
    } catch (error) {
      console.error('Error in getAllRoles:', error);
      return [];
    }
  }

  async getRolesByDepartment(departmentId: string): Promise<RoleWithDetails[]> {
    try {
      const supabase = await this.getSupabase();
      if (!supabase) return [];

      const { data: roles, error } = await supabase
        .from('roles')
        .select(`
          *,
          department:departments!roles_department_id_fkey(id, name),
          reporting_role:roles!roles_reporting_role_id_fkey(id, name),
          user_roles!user_roles_role_id_fkey(count)
        `)
        .eq('department_id', departmentId)
        .order('hierarchy_level', { ascending: false });

      if (error) {
        console.error('Error fetching roles by department:', error);
        return [];
      }

      return roles.map((role: any) => ({
        ...role,
        department: role.department,
        reporting_role: role.reporting_role,
        user_count: role.user_roles?.[0]?.count || 0,
      }));
    } catch (error) {
      console.error('Error in getRolesByDepartment:', error);
      return [];
    }
  }

  // Hierarchy operations
  async getRoleHierarchy(): Promise<RoleHierarchyNode[]> {
    const startTime = Date.now();
    
    try {
      const supabase = await this.getSupabase();
      if (!supabase) {
        logger.error('Supabase client not available', { action: 'getRoleHierarchy' });
        return [];
      }

      logger.debug('Fetching role hierarchy', { action: 'getRoleHierarchy' });

      databaseQuery('SELECT', 'roles', { action: 'getRoleHierarchy' });

      const { data: roles, error } = await supabase
        .from('roles')
        .select(`
          *,
          department:departments!roles_department_id_fkey(id, name)
        `)
        .order('hierarchy_level', { ascending: false });

      if (error) {
        databaseError('SELECT', 'roles', error, { action: 'getRoleHierarchy' });
        logger.error('Error fetching role hierarchy', { action: 'getRoleHierarchy' }, error);
        return [];
      }

      if (!roles || roles.length === 0) {
        logger.warn('No roles found for hierarchy', { action: 'getRoleHierarchy' });
        return [];
      }

      // Get user counts separately to avoid complex joins
      const roleIds = roles.map((role: any) => role.id);
      const { data: userCounts } = await supabase
        .from('user_roles')
        .select('role_id')
        .in('role_id', roleIds);

      // Count users per role
      const userCountMap = new Map<string, number>();
      userCounts?.forEach((ur: any) => {
        const count = userCountMap.get(ur.role_id) || 0;
        userCountMap.set(ur.role_id, count + 1);
      });

      // Build hierarchy tree
      const roleMap = new Map<string, RoleHierarchyNode>();
      const rootRoles: RoleHierarchyNode[] = [];

      // Create nodes with null checks
      roles.forEach((role: any) => {
        // Handle null departments
        const departmentName = role.department?.name || 'Unknown Department';
        const departmentId = role.department?.id || role.department_id;

        // Safely parse permissions
        let permissions: Permission[] = [];
        try {
          if (role.permissions && typeof role.permissions === 'object') {
            permissions = Object.entries(role.permissions as Record<string, boolean> || {})
              .filter(([_, hasPermission]) => hasPermission)
              .map(([permission, _]) => permission as Permission)
              .filter(permission => Object.values(Permission).includes(permission));
          }
        } catch (permError) {
          logger.warn('Error parsing permissions', { 
            action: 'getRoleHierarchy', 
            roleId: role.id,
            error: permError
          });
        }

        const node: RoleHierarchyNode = {
          id: role.id,
          name: role.name || 'Unnamed Role',
          department_id: departmentId,
          department_name: departmentName,
          hierarchy_level: role.hierarchy_level || 0,
          is_system_role: role.is_system_role || false,
          user_count: userCountMap.get(role.id) || 0,
          children: [],
          permissions,
        };

        roleMap.set(role.id, node);
      });

      // Build tree structure with null checks
      roles.forEach((role: any) => {
        const node = roleMap.get(role.id);
        if (!node) {
          logger.warn('Node not found in map', { action: 'getRoleHierarchy', roleId: role.id });
          return;
        }

        if (role.reporting_role_id) {
          const parent = roleMap.get(role.reporting_role_id);
          if (parent) {
            parent.children.push(node);
          } else {
            // Parent not found, treat as root
            logger.debug('Parent role not found, treating as root', { 
              action: 'getRoleHierarchy', 
              roleId: role.id,
              reportingRoleId: role.reporting_role_id
            });
            rootRoles.push(node);
          }
        } else {
          rootRoles.push(node);
        }
      });

      const duration = Date.now() - startTime;
      performance('getRoleHierarchy', duration, { 
        action: 'getRoleHierarchy',
        roleCount: roles.length,
        rootCount: rootRoles.length
      });

      logger.info('Role hierarchy built successfully', { 
        action: 'getRoleHierarchy',
        roleCount: roles.length,
        rootCount: rootRoles.length,
        duration
      });

      return rootRoles;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Exception in getRoleHierarchy', { action: 'getRoleHierarchy', duration }, error as Error);
      return [];
    }
  }

  async updateRoleReporting(roleId: string, newReportingRoleId: string | null): Promise<boolean> {
    try {
      const supabase = await this.getSupabase();
      if (!supabase) return false;

      // Check for circular reference
      if (newReportingRoleId) {
        const isCircular = await this.checkCircularReference(roleId, newReportingRoleId);
        if (isCircular) {
          throw new Error('Circular reference detected');
        }
      }

      const { error } = await supabase
        .from('roles')
        .update({
          reporting_role_id: newReportingRoleId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', roleId);

      if (error) {
        console.error('Error updating role reporting:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in updateRoleReporting:', error);
      return false;
    }
  }

  // User-role operations
  async assignUserToRole(userId: string, roleId: string, assignedBy: string): Promise<boolean> {
    try {
      const supabase = await this.getSupabase();
      if (!supabase) return false;

      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role_id: roleId,
          assigned_by: assignedBy,
          assigned_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Error assigning user to role:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in assignUserToRole:', error);
      return false;
    }
  }

  async removeUserFromRole(userId: string, roleId: string): Promise<boolean> {
    try {
      const supabase = await this.getSupabase();
      if (!supabase) return false;

      // Check if this is the user's last role
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId);

      if (userRoles && userRoles.length <= 1) {
        throw new Error('Cannot remove last role from user');
      }

      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role_id', roleId);

      if (error) {
        console.error('Error removing user from role:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in removeUserFromRole:', error);
      return false;
    }
  }

  async getUserRoles(userId: string): Promise<Role[]> {
    try {
      const supabase = await this.getSupabase();
      if (!supabase) return [];

      const { data: userRoles, error } = await supabase
        .from('user_roles')
        .select(`
          roles!user_roles_role_id_fkey(*)
        `)
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching user roles:', error);
        return [];
      }

      return userRoles.map((ur: any) => ur.roles).filter(Boolean);
    } catch (error) {
      console.error('Error in getUserRoles:', error);
      return [];
    }
  }

  async getRoleUsers(roleId: string): Promise<any[]> {
    try {
      const supabase = await this.getSupabase();
      if (!supabase) return [];

      const { data: userRoles, error } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          assigned_at,
          assigned_by,
          user_profiles!user_roles_user_id_fkey(id, name, email, image)
        `)
        .eq('role_id', roleId);

      if (error) {
        console.error('Error fetching role users:', error);
        return [];
      }

      return userRoles.map((ur: any) => ({
        user_id: ur.user_id,
        assigned_at: ur.assigned_at,
        assigned_by: ur.assigned_by,
        user: ur.user_profiles,
      }));
    } catch (error) {
      console.error('Error in getRoleUsers:', error);
      return [];
    }
  }

  // Permission operations
  async updateRolePermissions(roleId: string, permissions: Record<Permission, boolean>): Promise<boolean> {
    try {
      const supabase = await this.getSupabase();
      if (!supabase) return false;

      // Check if role is system role (cannot update permissions)
      const { data: existingRole } = await supabase
        .from('roles')
        .select('is_system_role')
        .eq('id', roleId)
        .single();

      if (existingRole?.is_system_role) {
        throw new Error('Cannot update permissions for system roles');
      }

      const { error } = await supabase
        .from('roles')
        .update({
          permissions,
          updated_at: new Date().toISOString(),
        })
        .eq('id', roleId);

      if (error) {
        console.error('Error updating role permissions:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in updateRolePermissions:', error);
      return false;
    }
  }

  async getRolePermissions(roleId: string): Promise<Permission[]> {
    try {
      const supabase = await this.getSupabase();
      if (!supabase) return [];

      const { data: role, error } = await supabase
        .from('roles')
        .select('permissions')
        .eq('id', roleId)
        .single();

      if (error || !role) {
        console.error('Error fetching role permissions:', error);
        return [];
      }

      const permissions = role.permissions as Record<string, boolean> || {};
      return Object.entries(permissions)
        .filter(([_, hasPermission]) => hasPermission)
        .map(([permission, _]) => permission as Permission)
        .filter(permission => Object.values(Permission).includes(permission));
    } catch (error) {
      console.error('Error in getRolePermissions:', error);
      return [];
    }
  }

  // Validation helpers
  private async checkCircularReference(roleId: string, reportingRoleId: string): Promise<boolean> {
    try {
      const supabase = await this.getSupabase();
      if (!supabase) return true;

      let currentRoleId = reportingRoleId;
      const visited = new Set<string>();

      while (currentRoleId && !visited.has(currentRoleId)) {
        if (currentRoleId === roleId) {
          return true; // Circular reference detected
        }

        visited.add(currentRoleId);

        const { data: role } = await supabase
          .from('roles')
          .select('reporting_role_id')
          .eq('id', currentRoleId)
          .single();

        currentRoleId = role?.reporting_role_id || null;
      }

      return false;
    } catch (error) {
      console.error('Error checking circular reference:', error);
      return true; // Assume circular to be safe
    }
  }

  async validateRoleAssignment(userId: string, roleId: string): Promise<{ valid: boolean; message?: string }> {
    try {
      const supabase = await this.getSupabase();
      if (!supabase) return { valid: false, message: 'Database connection failed' };

      // Check if user exists
      const { data: user } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (!user) {
        return { valid: false, message: 'User not found' };
      }

      // Check if role exists
      const { data: role } = await supabase
        .from('roles')
        .select('id')
        .eq('id', roleId)
        .single();

      if (!role) {
        return { valid: false, message: 'Role not found' };
      }

      // Check if user already has this role
      const { data: existingAssignment } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('role_id', roleId)
        .single();

      if (existingAssignment) {
        return { valid: false, message: 'User already has this role' };
      }

      return { valid: true };
    } catch (error) {
      console.error('Error validating role assignment:', error);
      return { valid: false, message: 'Validation failed' };
    }
  }

  async validateRoleHierarchy(roleId: string, reportingRoleId: string | null): Promise<{ valid: boolean; message?: string }> {
    try {
      if (!reportingRoleId) {
        return { valid: true }; // No reporting role is valid
      }

      const isCircular = await this.checkCircularReference(roleId, reportingRoleId);
      if (isCircular) {
        return { valid: false, message: 'Circular reference detected' };
      }

      return { valid: true };
    } catch (error) {
      console.error('Error validating role hierarchy:', error);
      return { valid: false, message: 'Validation failed' };
    }
  }
}

// Export singleton instance
export const roleManagementService = new RoleManagementService();

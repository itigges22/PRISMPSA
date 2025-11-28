// Simple types for organization structure
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
  workload_sentiment: string;
  created_at: string;
  updated_at: string;
  user_roles: any[];
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  department_id: string;
  hierarchy_level: number;
  is_system_role: boolean;
  permissions: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface RoleHierarchyNode {
  id: string;
  name: string;
  department_name: string;
  hierarchy_level: number;
  is_system_role: boolean;
  user_count: number;
  children: RoleHierarchyNode[];
}

export interface DepartmentWithRoles extends Department {
  roles: Role[];
  user_count: number;
}

export interface OrganizationStructure {
  departments: Department[];
  roles: Role[];
  users: User[];
  hierarchy: RoleHierarchyNode[];
  total_departments: number;
  total_roles: number;
  total_users: number;
}

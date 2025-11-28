'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Users, 
  Shield, 
  Building2, 
  UserPlus, 
  ChevronDown,
  ChevronRight
} from 'lucide-react';

// Type definitions (copied from organization-service to avoid import issues)
interface DepartmentWithRoles {
  id: string;
  name: string;
  description: string | null;
  roles: Array<{
    id: string;
    name: string;
    description: string | null;
    department_id: string;
    reporting_role_id: string | null;
    hierarchy_level: number;
    is_system_role: boolean;
    user_count?: number;
    users: Array<{
      id: string;
      name: string;
      email: string;
      image: string | null;
    }>;
  }>;
  user_count: number;
}

interface DepartmentViewProps {
  searchQuery?: string;
  selectedDepartment?: string;
  onRoleSelect?: (role: any) => void;
  onUserAssign?: (userId: string, roleId: string) => void;
  onRoleUpdate?: (roleId: string) => void;
  isReadOnly?: boolean;
}

interface DepartmentCardProps {
  department: DepartmentWithRoles;
  searchQuery?: string;
  onRoleSelect?: (role: any) => void;
  onUserAssign?: (userId: string, roleId: string) => void;
  onRoleUpdate?: (roleId: string) => void;
  isReadOnly?: boolean;
}

function DepartmentCard({
  department,
  searchQuery = '',
  onRoleSelect,
  onUserAssign,
  onRoleUpdate,
  isReadOnly = false,
}: DepartmentCardProps) {
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());
  const [roleUsers, setRoleUsers] = useState<Record<string, any[]>>({});

  // Filter roles by search query
  const filteredRoles = department.roles.filter(role =>
    !searchQuery || 
    role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    department.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRoleToggle = (roleId: string) => {
    const newExpanded = new Set(expandedRoles);
    if (newExpanded.has(roleId)) {
      newExpanded.delete(roleId);
    } else {
      newExpanded.add(roleId);
    }
    setExpandedRoles(newExpanded);
  };

  const loadRoleUsers = async (roleId: string) => {
    if (roleUsers[roleId]) return;

    try {
      const response = await fetch(`/api/roles/${roleId}/users`);
      if (!response.ok) throw new Error('Failed to load role users');
      const users = await response.json();
      
      // Transform the response to match the expected format
      const formattedUsers = users.map((user: any) => ({
        user_id: user.id,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image
        }
      }));
      
      setRoleUsers(prev => ({ ...prev, [roleId]: formattedUsers }));
    } catch (error) {
      console.error('Error loading role users:', error);
      setRoleUsers(prev => ({ ...prev, [roleId]: [] }));
    }
  };

  const handleRoleClick = (role: any) => {
    onRoleSelect?.(role);
  };

  const handleUserAssign = (userId: string, roleId: string) => {
    onUserAssign?.(userId, roleId);
  };

  const handleRoleUpdate = (roleId: string) => {
    onRoleUpdate?.(roleId);
  };

  const getRoleIcon = (role: any) => {
    if (role.is_system_role) {
      return <Shield className="h-4 w-4 text-red-500" />;
    }
    if (role.hierarchy_level >= 100) {
      return <Users className="h-4 w-4 text-blue-500" />;
    }
    return <Users className="h-4 w-4 text-gray-500" />;
  };

  const getRoleColor = (role: any) => {
    if (role.is_system_role) return 'border-red-200 bg-red-50';
    if (role.hierarchy_level >= 100) return 'border-blue-200 bg-blue-50';
    if (role.hierarchy_level >= 80) return 'border-green-200 bg-green-50';
    return 'border-gray-200 bg-gray-50';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-blue-500" />
          {department.name}
        </CardTitle>
        <CardDescription>{department.description}</CardDescription>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            <Users className="h-3 w-3 mr-1" />
            {department.roles.reduce((sum, role) => sum + (role.user_count || 0), 0)} total users
          </Badge>
          <Badge variant="outline">
            {department.roles.length} roles
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {filteredRoles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {searchQuery ? 'No roles match your search' : 'No roles in this department'}
            </p>
          ) : (
            filteredRoles.map((role) => (
              <div key={role.id} className="space-y-2">
                <div
                  className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${getRoleColor(role)}`}
                  onClick={() => handleRoleClick(role)}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRoleToggle(role.id);
                      if (!expandedRoles.has(role.id)) {
                        loadRoleUsers(role.id);
                      }
                    }}
                  >
                    {expandedRoles.has(role.id) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>

                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {getRoleIcon(role)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm truncate">{role.name}</h4>
                        {role.is_system_role && (
                          <Badge variant="destructive" className="text-xs">
                            System
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Level {role.hierarchy_level}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {role.user_count} users
                    </Badge>
                  </div>
                </div>

                {/* Users List */}
                {expandedRoles.has(role.id) && (
                  <div className="ml-8 space-y-2">
                    {roleUsers[role.id] ? (
                      roleUsers[role.id].length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-2">
                          No users assigned to this role
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {roleUsers[role.id].map((userRole) => (
                            <div
                              key={userRole.user_id}
                              className="flex items-center justify-between p-2 bg-muted/30 rounded border"
                            >
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={userRole.user?.image || undefined} />
                                  <AvatarFallback>
                                     {userRole.user?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-medium">{userRole.user?.name}</p>
                                  <p className="text-xs text-muted-foreground">{userRole.user?.email}</p>
                                </div>
                              </div>
                              {!isReadOnly && onUserAssign && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => handleUserAssign(userRole.user_id, role.id)}
                                >
                                  <UserPlus className="h-3 w-3 mr-1" />
                                  Reassign
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )
                    ) : (
                      <div className="flex items-center justify-center py-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function DepartmentView({
  searchQuery = '',
  selectedDepartment,
  onRoleSelect,
  onUserAssign,
  onRoleUpdate,
  isReadOnly = false,
}: DepartmentViewProps) {
  const [departments, setDepartments] = useState<DepartmentWithRoles[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      setLoading(true);
      
      console.log('🏢 Loading departments and roles...');
      
      // Fetch departments and roles from API
      const [deptsResponse, rolesResponse] = await Promise.all([
        fetch('/api/departments'),
        fetch('/api/roles')
      ]);
      
      console.log('📡 Departments response:', deptsResponse.status, deptsResponse.statusText);
      console.log('📡 Roles response:', rolesResponse.status, rolesResponse.statusText);
      
      if (!deptsResponse.ok || !rolesResponse.ok) {
        const deptsError = await deptsResponse.text().catch(() => 'Unknown error');
        const rolesError = await rolesResponse.text().catch(() => 'Unknown error');
        console.error('❌ API Error - Departments:', deptsError);
        console.error('❌ API Error - Roles:', rolesError);
        throw new Error('Failed to load data');
      }
      
      const departments = await deptsResponse.json();
      const rolesResponseData = await rolesResponse.json();
      
      // Extract roles array from the API response
      const roles = rolesResponseData.roles || rolesResponseData;
      
      console.log('📊 Departments data:', departments);
      console.log('📊 Roles data (count):', roles.length);
      
      // Group roles by department
      const departmentsWithRoles = departments.map((dept: any) => ({
        ...dept,
        roles: roles.filter((role: any) => role.department_id === dept.id),
        user_count: roles
          .filter((role: any) => role.department_id === dept.id)
          .reduce((sum: number, role: any) => sum + (role.user_count || 0), 0)
      }));
      
      console.log('✅ Departments with roles:', departmentsWithRoles);
      
      setDepartments(departmentsWithRoles);
    } catch (error) {
      console.error('💥 Error loading departments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSelect = (role: any) => {
    onRoleSelect?.(role);
  };

  const handleUserAssign = (userId: string, roleId: string) => {
    onUserAssign?.(userId, roleId);
  };

  const handleRoleUpdate = (roleId: string) => {
    onRoleUpdate?.(roleId);
  };

  // Filter departments by selected department
  // Treat 'all' or empty string as "show all departments"
  const filteredDepartments = (selectedDepartment && selectedDepartment !== 'all')
    ? departments.filter(dept => dept.id === selectedDepartment)
    : departments;
  
  console.log('🔍 Filtering departments:', {
    selectedDepartment,
    totalDepartments: departments.length,
    filteredDepartments: filteredDepartments.length
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading departments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Departments</h2>
          <p className="text-muted-foreground">
            View roles and users organized by department
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {departments.length} departments
          </Badge>
          <Badge variant="outline">
            {departments.reduce((sum, dept) => sum + dept.roles.length, 0)} total roles
          </Badge>
        </div>
      </div>

      {filteredDepartments.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Departments Found</h3>
              <p className="text-muted-foreground">
                {selectedDepartment 
                  ? 'No departments match the selected filter'
                  : 'No departments have been created yet'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {filteredDepartments.map((department) => (
            <DepartmentCard
              key={department.id}
              department={department}
              searchQuery={searchQuery}
              onRoleSelect={handleRoleSelect}
              onUserAssign={handleUserAssign}
              onRoleUpdate={handleRoleUpdate}
              isReadOnly={isReadOnly}
            />
          ))}
        </div>
      )}
    </div>
  );
}

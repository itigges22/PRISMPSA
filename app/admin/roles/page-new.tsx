'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  RefreshCw, 
  Download, 
  Search, 
  Filter,
  Building2,
  Network
} from 'lucide-react';
import { toast } from 'sonner';
import { RoleHierarchyDnd, RoleWithUsers } from '@/components/org-chart/role-hierarchy-dnd';
// import { D3OrgChart, OrgChartNode } from '@/components/org-chart/d3-org-chart';
import { RoleCreationDialog } from '@/components/org-chart/role-creation-dialog';
import { RoleEditDialog } from '@/components/org-chart/role-edit-dialog';
import { UserAssignmentDialog } from '@/components/org-chart/user-assignment-dialog';
import { DepartmentView } from '@/components/org-chart/department-view';
import { ReportingRoleDialog } from '@/components/org-chart/reporting-role-dialog';

interface Department {
  id: string;
  name: string;
  description: string | null;
}

export default function RoleManagementPage() {
  // State
  const [roles, setRoles] = useState<RoleWithUsers[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewType, setViewType] = useState<'hierarchy' | 'department'>('hierarchy');
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  
  // Dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [reportingDialogOpen, setReportingDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleWithUsers | null>(null);
  
  // Permissions
  const [isReadOnly, setIsReadOnly] = useState(false);

  useEffect(() => {
    loadData();
    checkPermissions();
  }, []);

  async function checkPermissions() {
    try {
      const response = await fetch('/api/auth/permissions');
      if (response.ok) {
        const data = await response.json();
        setIsReadOnly(!data.can_manage_roles);
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
    }
  }

  async function loadData() {
    try {
      setLoading(true);
      
      // Load roles
      const rolesResponse = await fetch('/api/roles');
      if (!rolesResponse.ok) throw new Error('Failed to load roles');
      const rolesApiData = await rolesResponse.json();
      
      // Extract roles from the API response
      const rolesData = rolesApiData.roles || rolesApiData;
      
      // Load departments
      const deptsResponse = await fetch('/api/departments');
      if (!deptsResponse.ok) throw new Error('Failed to load departments');
      const deptsData = await deptsResponse.json();
      
      setRoles(rolesData);
      setDepartments(deptsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteRole(roleId: string) {
    if (!confirm('Are you sure you want to delete this role?')) {
      return;
    }

    try {
      const response = await fetch(`/api/roles/${roleId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete role');
      }

      toast.success('Role deleted successfully');
      loadData();
    } catch (error: any) {
      console.error('Error deleting role:', error);
      toast.error(error.message || 'Failed to delete role');
    }
  }

  function handleEditRole(role: RoleWithUsers) {
    setSelectedRole(role);
    setEditDialogOpen(true);
  }

  function handleSetReportingRole(role: RoleWithUsers) {
    console.log('🔄 Opening reporting role dialog for:', {
      roleId: role.id,
      roleName: role.name,
      reportingRoleId: role.reporting_role_id,
      reportingRoleName: role.reporting_role?.name,
      allRolesCount: roles.length
    });
    setSelectedRole(role);
    setReportingDialogOpen(true);
  }

  async function handleSaveReportingRole(roleId: string, reportingRoleId: string | null) {
    try {
      console.log('🔄 Updating reporting role:', { roleId, reportingRoleId });
      
      // Calculate new hierarchy level
      let newHierarchyLevel: number;
      if (reportingRoleId) {
        const reportingRole = roles.find(r => r.id === reportingRoleId);
        newHierarchyLevel = (reportingRole?.hierarchy_level || 1) - 1;
        console.log(`📊 Role will report to ${reportingRole?.name} (level ${reportingRole?.hierarchy_level}), so new level will be ${newHierarchyLevel}`);
      } else {
        // No reporting role - make it a top-level role
        newHierarchyLevel = roles.length > 0 ? Math.max(...roles.map(r => r.hierarchy_level)) + 1 : 10;
        console.log(`📊 Role will be top-level with hierarchy level ${newHierarchyLevel}`);
      }
      
      const response = await fetch('/api/roles/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roleId,
          newReportingRoleId: reportingRoleId,
          newHierarchyLevel: newHierarchyLevel,
          newDisplayOrder: 1 // Will be recalculated
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ API Error:', errorData);
        throw new Error(errorData.error || 'Failed to update reporting role');
      }

      console.log('✅ Reporting role updated successfully');
      
      // Reload data to get updated hierarchy
      console.log('🔄 Reloading data...');
      await loadData();
      console.log('✅ Data reloaded');
    } catch (error) {
      console.error('Error updating reporting role:', error);
      throw error;
    }
  }

  function handleAssignUser(role: RoleWithUsers) {
    setSelectedRole(role);
    setAssignDialogOpen(true);
  }

  function exportOrgChart() {
    if ((window as any).exportOrgChart) {
      (window as any).exportOrgChart();
      toast.success('Org chart exported');
    }
  }

  // Convert roles to org chart nodes
  const orgChartNodes: any[] = roles
    .filter(role => {
      if (selectedDepartment !== 'all' && role.department_id !== selectedDepartment) {
        return false;
      }
      if (searchQuery && !role.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      return true;
    })
    .map(role => ({
      id: role.id,
      name: role.name,
      title: role.description || '',
      department: role.department_name || undefined,
      parentId: role.reporting_role_id,
      userCount: role.user_count,
    }));

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Role Management</h1>
          <p className="text-gray-500 mt-1">
            Manage organizational roles and hierarchy
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={loadData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={exportOrgChart} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          {!isReadOnly && (
            <Button onClick={() => setCreateDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Create Role
            </Button>
          )}
        </div>
      </div>

      {/* View Toggle */}
      <Tabs value={viewType} onValueChange={(v) => setViewType(v as any)} className="w-full">
        <TabsList>
          <TabsTrigger value="hierarchy" className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            Hierarchy View
          </TabsTrigger>
          <TabsTrigger value="department" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Department View
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hierarchy" className="space-y-6 mt-6">
          {/* Role Hierarchy Card - Top of Page */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Role Hierarchy
              </CardTitle>
              <CardDescription>
                Drag and drop roles to reorganize the hierarchy. Changes are saved automatically.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-gray-500">Loading...</div>
              ) : roles.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No roles found. Create your first role to get started.
                </div>
              ) : (
                <RoleHierarchyDnd
                  roles={roles}
                  onRoleUpdate={loadData}
                  onEdit={handleEditRole}
                  onDelete={handleDeleteRole}
                  onAssignUser={handleAssignUser}
                  onSetReportingRole={handleSetReportingRole}
                  isReadOnly={isReadOnly}
                />
              )}
            </CardContent>
          </Card>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search roles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Interactive Org Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Interactive Organization Chart
              </CardTitle>
              <CardDescription>
                Visual representation of your organizational structure
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {/* <D3OrgChart 
                data={orgChartNodes}
                onNodeClick={(node) => {
                  const role = roles.find(r => r.id === node.id);
                  if (role) {
                    handleEditRole(role);
                  }
                }}
              /> */}
              <div className="p-8 text-center text-gray-500">
                D3 Org Chart component temporarily disabled
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="department" className="space-y-6 mt-6">
          <DepartmentView
            onRoleSelect={handleEditRole}
            isReadOnly={isReadOnly}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <RoleCreationDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={loadData}
        departments={departments}
      />

      <RoleEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        role={selectedRole}
        onSuccess={loadData}
        departments={departments}
      />

      <UserAssignmentDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        role={selectedRole}
        onSuccess={loadData}
      />

      <ReportingRoleDialog
        open={reportingDialogOpen}
        onOpenChange={setReportingDialogOpen}
        role={selectedRole}
        allRoles={roles}
        onSave={handleSaveReportingRole}
      />
    </div>
  );
}


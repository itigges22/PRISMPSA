'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { canManageRoles } from '@/lib/rbac';
import { OrganizationStructure } from '@/lib/organization-service';
import { organizationService } from '@/lib/organization-service';
import { OrgChartToolbar } from '@/components/org-chart/org-chart-toolbar';
import { OrgChartCanvasWrapper } from '@/components/org-chart/org-chart-canvas';
import { HierarchyView } from '@/components/org-chart/hierarchy-view';
import { DepartmentView } from '@/components/org-chart/department-view';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Settings, 
  Building2, 
  Shield, 
  AlertTriangle,
  Loader2
} from 'lucide-react';

export default function RoleManagementPage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  
  // State
  const [orgData, setOrgData] = useState<OrganizationStructure | null>(null);
  const [viewType, setViewType] = useState<'hierarchy' | 'department'>('hierarchy');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string | undefined>();
  const [dataLoading, setDataLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReadOnly, setIsReadOnly] = useState(false);

  // Check permissions and load data
  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    if (!userProfile) {
      return;
    }

    // Check if user can manage roles
    if (!canManageRoles(userProfile)) {
      router.push('/welcome');
      return;
    }

    // Check if user is on mobile/tablet (read-only mode)
    const checkIsReadOnly = () => {
      const isMobile = window.innerWidth < 768;
      const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
      setIsReadOnly(isMobile || isTablet);
    };

    checkIsReadOnly();
    window.addEventListener('resize', checkIsReadOnly);

    loadOrganizationData();

    return () => {
      window.removeEventListener('resize', checkIsReadOnly);
    };
  }, [user, userProfile, loading, router]);

  const loadOrganizationData = async () => {
    try {
      setDataLoading(true);
      setError(null);
      
      const data = await organizationService.getOrganizationStructure();
      if (data) {
        setOrgData(data);
      } else {
        setError('Failed to load organization data');
      }
    } catch (err) {
      console.error('Error loading organization data:', err);
      setError('An error occurred while loading the organization data');
    } finally {
      setDataLoading(false);
    }
  };

  const handleRefresh = () => {
    loadOrganizationData();
  };

  const handleExport = () => {
    if (!orgData) return;
    
    try {
      // Create CSV data
      const csvData = [];
      
      // Add header
      csvData.push(['Role Name', 'Department', 'Hierarchy Level', 'User Count', 'Is System Role', 'Description']);
      
      // Add role data
      orgData.departments.forEach(dept => {
        dept.roles.forEach(role => {
          csvData.push([
            role.name,
            dept.name,
            role.hierarchy_level?.toString() || '0',
            role.user_count?.toString() || '0',
            role.is_system_role ? 'Yes' : 'No',
            role.description || ''
          ]);
        });
      });
      
      // Convert to CSV string
      const csvContent = csvData.map(row => 
        row.map(field => `"${field}"`).join(',')
      ).join('\n');
      
      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `organization-roles-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('Export completed successfully');
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleRoleCreated = (role: any) => {
    // Refresh data to show new role
    loadOrganizationData();
  };

  const handleToggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleUserAssign = async (userId: string, roleId: string) => {
    try {
      // TODO: Implement user assignment
      console.log('User assignment not yet implemented', { userId, roleId });
    } catch (error) {
      console.error('Error assigning user to role:', error);
    }
  };

  const handleRoleUpdate = (roleId: string) => {
    // Refresh data to show updated role
    loadOrganizationData();
  };

  const handleRoleDelete = async (roleId: string) => {
    try {
      const response = await fetch(`/api/roles/${roleId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // Refresh data to show updated roles
        loadOrganizationData();
        console.log('Role deleted successfully');
      } else {
        const errorData = await response.json();
        console.error('Error deleting role:', errorData.message);
        alert(`Error deleting role: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Error deleting role:', error);
      alert('Error deleting role. Please try again.');
    }
  };

  if (loading || dataLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading organization chart...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Error Loading Organization Chart
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleRefresh} className="flex items-center gap-2">
              <Loader2 className="h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!userProfile || !canManageRoles(userProfile)) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <Shield className="h-5 w-5" />
              Access Denied
            </CardTitle>
            <CardDescription>
              You don't have permission to manage roles and permissions.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {!isFullscreen && (
        <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Organization Management</h1>
            <p className="text-muted-foreground">
              Manage roles, permissions, and organizational structure
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isReadOnly && (
              <Badge variant="outline" className="text-amber-600 border-amber-200">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Read-only mode (Mobile/Tablet)
              </Badge>
            )}
            <Badge variant="secondary">
              {orgData?.total_users || 0} users
            </Badge>
            <Badge variant="secondary">
              {orgData?.total_roles || 0} roles
            </Badge>
            <Badge variant="secondary">
              {orgData?.total_departments || 0} departments
            </Badge>
          </div>
        </div>

        {/* Toolbar */}
        <OrgChartToolbar
          viewType={viewType}
          onViewTypeChange={setViewType}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedDepartment={selectedDepartment}
          onDepartmentChange={setSelectedDepartment}
          onRefresh={handleRefresh}
          onExport={handleExport}
          onRoleCreated={handleRoleCreated}
          isReadOnly={isReadOnly}
          totalUsers={orgData?.total_users || 0}
          totalRoles={orgData?.total_roles || 0}
          totalDepartments={orgData?.total_departments || 0}
        />

        {/* Main Content */}
        <div className="space-y-32">
          {viewType === 'hierarchy' ? (
            <div className="space-y-32">
              {/* Interactive Canvas - Full Width */}
              <div className="mb-32 pb-8">
                <Card className="h-[500px] lg:h-[600px] shadow-lg border-2 bg-white dark:bg-gray-900">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
                      <Settings className="h-4 w-4 lg:h-5 lg:w-5" />
                      Interactive Organization Chart
                    </CardTitle>
                    <CardDescription>
                      {isReadOnly 
                        ? 'View-only mode on mobile/tablet devices'
                        : 'Drag and drop to assign users to roles'
                      }
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 h-full">
                    {orgData ? (
                      <OrgChartCanvasWrapper
                        data={orgData}
                        viewType="hierarchy"
                        onUserAssign={handleUserAssign}
                        onRoleUpdate={handleRoleUpdate}
                        searchQuery={searchQuery}
                        selectedDepartment={selectedDepartment}
                        isReadOnly={isReadOnly}
                        isFullscreen={isFullscreen}
                        onToggleFullscreen={handleToggleFullscreen}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                          <p className="mt-2 text-sm text-muted-foreground">Loading chart...</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Role Hierarchy - Below Org Chart with proper spacing (Desktop Only) */}
              <div className="mt-32 pt-8">
                <Card className="h-[400px] overflow-y-auto hidden lg:block shadow-lg border-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Role Hierarchy
                    </CardTitle>
                    <CardDescription>
                      Tree view of organizational structure
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <HierarchyView
                      searchQuery={searchQuery}
                      selectedDepartment={selectedDepartment}
                      onRoleSelect={(role) => console.log('Role selected:', role)}
                      onUserAssign={handleUserAssign}
                      onRoleUpdate={handleRoleUpdate}
                      onRoleDelete={handleRoleDelete}
                      isReadOnly={isReadOnly}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            /* Department View */
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Department View
                </CardTitle>
                <CardDescription>
                  Roles and users organized by department
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DepartmentView
                  searchQuery={searchQuery}
                  selectedDepartment={selectedDepartment}
                  onRoleSelect={(role) => console.log('Role selected:', role)}
                  onUserAssign={handleUserAssign}
                  onRoleUpdate={handleRoleUpdate}
                  isReadOnly={isReadOnly}
                />
              </CardContent>
            </Card>
          )}

          {/* Mobile/Tablet: Show only list view */}
          <div className="lg:hidden">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Mobile View
                </CardTitle>
                <CardDescription>
                  Interactive features are not available on mobile devices. 
                  Use a desktop computer for full functionality.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {viewType === 'hierarchy' ? (
                  <HierarchyView
                    searchQuery={searchQuery}
                    selectedDepartment={selectedDepartment}
                    onRoleSelect={(role) => console.log('Role selected:', role)}
                    onUserAssign={handleUserAssign}
                    onRoleUpdate={handleRoleUpdate}
                    onRoleDelete={handleRoleDelete}
                    isReadOnly={isReadOnly}
                  />
                ) : (
                  <DepartmentView
                    searchQuery={searchQuery}
                    selectedDepartment={selectedDepartment}
                    onRoleSelect={(role) => console.log('Role selected:', role)}
                    onUserAssign={handleUserAssign}
                    onRoleUpdate={handleRoleUpdate}
                    isReadOnly={isReadOnly}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      )}
      
      {/* Fullscreen Org Chart */}
      {isFullscreen && orgData && (
        <OrgChartCanvasWrapper
          data={orgData}
          viewType="hierarchy"
          onUserAssign={handleUserAssign}
          onRoleUpdate={handleRoleUpdate}
          searchQuery={searchQuery}
          selectedDepartment={selectedDepartment}
          isReadOnly={isReadOnly}
          isFullscreen={isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
        />
      )}
    </div>
  );
}
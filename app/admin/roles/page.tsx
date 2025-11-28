'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  RefreshCw, 
  Building2,
  Network,
  Briefcase
} from 'lucide-react';
import { toast } from 'sonner';
import { RoleHierarchyDnd, RoleWithUsers } from '@/components/org-chart/role-hierarchy-dnd';
import { RoleCreationDialog } from '@/components/org-chart/role-creation-dialog';
import { RoleEditDialog } from '@/components/org-chart/role-edit-dialog';
import { UserAssignmentDialog } from '@/components/org-chart/user-assignment-dialog';
import { ReportingRoleDialog } from '@/components/org-chart/reporting-role-dialog';
import { DepartmentView } from '@/components/org-chart/department-view';
import { AccountView } from '@/components/org-chart/account-view';
import { RoleGuard } from '@/components/role-guard';
import { Permission } from '@/lib/permissions';
import { useAuth } from '@/lib/hooks/useAuth';
import { isUnassigned, hasPermission } from '@/lib/rbac';

interface Department {
  id: string;
  name: string;
  description: string | null;
}

export default function RoleManagementPage() {
  const { userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  
  // State
  const [roles, setRoles] = useState<RoleWithUsers[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewType, setViewType] = useState<'hierarchy' | 'department' | 'accounts'>('hierarchy');
  
  
  // Dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [reportingDialogOpen, setReportingDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleWithUsers | null>(null);
  
  // Permissions
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [canCreateRole, setCanCreateRole] = useState(false);
  const [canEditRole, setCanEditRole] = useState(false);
  const [canDeleteRole, setCanDeleteRole] = useState(false);
  const [canAssignUsers, setCanAssignUsers] = useState(false);
  const [canViewAccountsTab, setCanViewAccountsTab] = useState(false);
  
  // Edit Mode (from RoleHierarchyDnd component)
  const [inEditMode, setInEditMode] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Queued operations for Edit Mode (managed by parent, executed on save)
  const [pendingRoleEdits, setPendingRoleEdits] = useState<Map<string, any>>(new Map());
  const [pendingUserAssignments, setPendingUserAssignments] = useState<Array<{roleId: string, userId: string, userName: string}>>([])

  // Check if user is unassigned and redirect
  useEffect(() => {
    if (!authLoading && userProfile) {
      if (isUnassigned(userProfile)) {
        router.push('/welcome');
        return;
      }
    }
  }, [authLoading, userProfile, router]);

  useEffect(() => {
    if (!authLoading && userProfile && !isUnassigned(userProfile)) {
      loadData();
      checkPermissions();
    }
  }, [authLoading, userProfile]);

  // Debug: Log when roles state changes
  useEffect(() => {
    console.log('🔍 PAGE: Roles state changed:', {
      count: roles.length,
      roles: roles.map(r => ({ id: r.id, name: r.name }))
    });
  }, [roles]);

  // Redirect away from accounts tab if user doesn't have permission
  useEffect(() => {
    if (!authLoading && viewType === 'accounts' && !canViewAccountsTab) {
      setViewType('hierarchy');
    }
  }, [authLoading, viewType, canViewAccountsTab]);

  async function checkPermissions() {
    if (!userProfile) return;
    
    try {
      const canCreate = await hasPermission(userProfile, Permission.CREATE_ROLE);
      const canEdit = await hasPermission(userProfile, Permission.EDIT_ROLE);
      const canDelete = await hasPermission(userProfile, Permission.DELETE_ROLE);
      const canAssign = await hasPermission(userProfile, Permission.ASSIGN_USERS_TO_ROLES);
      const canViewAccounts = await hasPermission(userProfile, Permission.VIEW_ACCOUNTS_TAB);
      
      setCanCreateRole(canCreate);
      setCanEditRole(canEdit);
      setCanDeleteRole(canDelete);
      setCanAssignUsers(canAssign);
      setCanViewAccountsTab(canViewAccounts);
      
      // User is read-only if they can't create, edit, or delete roles
      setIsReadOnly(!canCreate && !canEdit && !canDelete);
    } catch (error) {
      console.error('Error checking permissions:', error);
    }
  }

  async function loadData() {
    try {
      console.log('🔄 PAGE: Starting loadData()...');
      setLoading(true);
      
      // Add cache-busting headers to ensure fresh data
      const cacheHeaders = {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      };
      
      console.log('🔄 PAGE: Fetching roles from API...');
      // Load roles with container data
      const rolesResponse = await fetch('/api/roles', {
        headers: cacheHeaders,
        cache: 'no-store', // Next.js fetch cache option
        credentials: 'include' // Include cookies for authentication
      });
      
      const rolesApiData = await rolesResponse.json();
      
      if (!rolesResponse.ok) {
        // Handle permission errors gracefully (403) - these are expected for users without permissions
        if (rolesResponse.status === 403 || rolesApiData.code === 'PERMISSION_DENIED') {
          console.log('ℹ️ PAGE: User does not have permission to view roles - this is expected');
          // Set empty state and return early - RoleGuard should handle redirect
          setRoles([]);
          setDepartments([]);
          setLoading(false);
          // Redirect to welcome page after a brief delay to allow RoleGuard to handle it
          setTimeout(() => {
            router.push('/welcome');
          }, 100);
          return;
        }
        
        // Log other errors as actual errors
        console.error('❌ PAGE: Roles API error:', {
          status: rolesResponse.status,
          statusText: rolesResponse.statusText,
          error: rolesApiData
        });
        throw new Error(rolesApiData.error || `Failed to load roles: ${rolesResponse.status} ${rolesResponse.statusText}`);
      }
      
      // Check if response contains an error
      if (rolesApiData.error) {
        // Handle permission errors gracefully
        if (rolesApiData.code === 'PERMISSION_DENIED') {
          console.log('ℹ️ PAGE: User does not have permission to view roles - this is expected');
          setRoles([]);
          setDepartments([]);
          setLoading(false);
          setTimeout(() => {
            router.push('/welcome');
          }, 100);
          return;
        }
        
        console.error('❌ PAGE: API returned error:', rolesApiData);
        throw new Error(rolesApiData.error || 'Failed to load roles');
      }
      
      console.log('✅ PAGE: Roles API response received:', {
        rolesCount: rolesApiData.roles?.length || 0,
        rolesData: rolesApiData.roles?.map((r: any) => `${r.name} (Level ${r.hierarchy_level}, Order ${r.display_order}, System: ${r.is_system_role})`)
      });
      
      // Extract roles from the new API response structure
      const rolesData = rolesApiData.roles || []; // Handle both old and new formats, default to empty array
      
      if (!Array.isArray(rolesData)) {
        console.error('❌ PAGE: Roles data is not an array:', rolesData);
        throw new Error('Invalid roles data format received from API');
      }
      
      console.log('🔄 PAGE: Fetching departments from API...');
      // Load departments
      const deptsResponse = await fetch('/api/departments', {
        headers: cacheHeaders,
        cache: 'no-store',
        credentials: 'include' // Include cookies for authentication
      });
      if (!deptsResponse.ok) throw new Error('Failed to load departments');
      const deptsData = await deptsResponse.json();
      
      console.log('✅ PAGE: Setting roles and departments state...');
      console.log('📊 PAGE: Roles data to set:', {
        count: rolesData.length,
        roles: rolesData.map((r: any) => ({ id: r.id, name: r.name, hierarchy_level: r.hierarchy_level }))
      });
      
      setRoles(rolesData);
      setDepartments(deptsData);
      
      // Log container information for debugging
      if (rolesApiData.containers) {
        console.log('📊 PAGE: Role containers loaded:', rolesApiData.containers);
        console.log(`📊 PAGE: Total levels: ${rolesApiData.totalLevels}, Total roles: ${rolesApiData.totalRoles}`);
      }
      
      console.log('✅ PAGE: loadData() completed successfully');
    } catch (error: any) {
      // Check if this is a permission error (expected for users without permissions)
      const isPermissionError = error?.message?.includes('permission') || 
                                error?.message?.includes('Permission denied') ||
                                error?.message?.includes('You don\'t have permission');
      
      if (isPermissionError) {
        // Handle permission errors gracefully - don't log as error or show toast
        console.log('ℹ️ PAGE: Permission denied - this is expected for users without VIEW_ROLES permission');
        setRoles([]);
        setDepartments([]);
        setLoading(false);
        // RoleGuard should handle redirect, but add a fallback
        setTimeout(() => {
          router.push('/welcome');
        }, 100);
        return;
      }
      
      // Log other errors as actual errors
      console.error('❌ PAGE: Error loading data:', error);
      const errorMessage = error?.message || 'Failed to load data';
      toast.error(errorMessage);
      
      // Set empty arrays to prevent undefined errors
      setRoles([]);
      setDepartments([]);
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
    console.log('🔄 Opening edit dialog for role:', role);
    setSelectedRole(role);
    setEditDialogOpen(true);
  }

  function handleAssignUser(role: RoleWithUsers) {
    setSelectedRole(role);
    setAssignDialogOpen(true);
  }

  // Handler for queuing role edits in Edit Mode
  function handleLocalRoleUpdate(roleId: string, updates: any) {
    console.log('📝 Parent: Queuing role edit', { roleId, updates });
    setPendingRoleEdits(prev => new Map(prev).set(roleId, updates));
    
    // Update local UI immediately for better UX
    setRoles(prevRoles => prevRoles.map(role => {
      if (role.id === roleId) {
        return { ...role, ...updates };
      }
      return role;
    }));
  }

  // Handler for queuing user assignments in Edit Mode
  function handleLocalUserAssignment(roleId: string, userId: string, userName: string) {
    console.log('👤 Parent: Queuing user assignment', { roleId, userId, userName });
    setPendingUserAssignments(prev => [...prev, { roleId, userId, userName }]);
    
    // Update local UI immediately for better UX
    setRoles(prevRoles => prevRoles.map(role => {
      if (role.id === roleId) {
        // Check if user is already in the list to avoid duplicates
        const userExists = role.users.some(u => u.id === userId);
        
        if (userExists) {
          console.log('⚠️ User already assigned to this role, skipping UI update');
          return role; // User already exists, don't add again
        }
        
        return {
          ...role,
          user_count: role.user_count + 1,
          users: [...role.users, { id: userId, name: userName, email: '', image: null }]
        };
      }
      return role;
    }));
  }

  // Handler for Edit Mode changes - clear pending operations when exiting Edit Mode
  function handleEditModeChange(isEditMode: boolean) {
    setInEditMode(isEditMode);
    
    if (!isEditMode) {
      // Clear pending operations when exiting Edit Mode
      setPendingRoleEdits(new Map());
      setPendingUserAssignments([]);
      setHasUnsavedChanges(false);
    }
  }

  // Handler for unsaved changes notification from RoleHierarchyDnd
  function handleUnsavedChanges(hasChanges: boolean) {
    setHasUnsavedChanges(hasChanges);
  }

  // Handler for setting reporting role
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

  // Handler for saving reporting role
  async function handleSaveReportingRole(roleId: string, reportingRoleId: string | null) {
    try {
      console.log('🔄 Updating reporting role:', { roleId, reportingRoleId });
      
      // Get current maximum hierarchy level to ensure Superadmin stays at top
      const maxLevel = Math.max(...roles.map(r => r.hierarchy_level));
      
    // Calculate new hierarchy level
    let newHierarchyLevel: number;
    if (reportingRoleId) {
      const reportingRole = roles.find(r => r.id === reportingRoleId);
      // Child role should be one level BELOW parent (lower number = deeper in hierarchy)
      newHierarchyLevel = (reportingRole?.hierarchy_level || 1) - 1;
      console.log(`📊 Role will report to ${reportingRole?.name} (level ${reportingRole?.hierarchy_level}), so new level will be ${newHierarchyLevel}`);
    } else {
      // No reporting role - make it a top-level role (Level 1, or Level 0 for "No Assigned Role")
      const role = roles.find(r => r.id === roleId);
      if (role?.name === 'No Assigned Role') {
        newHierarchyLevel = 0; // Special case for fallback role
      } else if (role?.name === 'Superadmin') {
        newHierarchyLevel = maxLevel + 1; // Superadmin is always at the highest level + 1
      } else {
        newHierarchyLevel = 1; // All other top-level roles
      }
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



  // Show loading or redirect if unassigned
  if (authLoading || !userProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (isUnassigned(userProfile)) {
    return null; // Will redirect via useEffect
  }

  return (
    <RoleGuard requirePermission={Permission.VIEW_ROLES}>
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
          {canCreateRole && (
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
          {canViewAccountsTab && (
            <TabsTrigger value="accounts" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Accounts View
            </TabsTrigger>
          )}
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
                  isReadOnly={isReadOnly || (!canEditRole && !canDeleteRole && !canAssignUsers)}
                  onEditModeChange={handleEditModeChange}
                  pendingRoleEdits={pendingRoleEdits}
                  pendingUserAssignments={pendingUserAssignments}
                  onHasUnsavedChanges={handleUnsavedChanges}
                />
              )}
            </CardContent>
          </Card>


        </TabsContent>

        <TabsContent value="department" className="space-y-6 mt-6">
          <DepartmentView
            onRoleSelect={handleEditRole}
            isReadOnly={isReadOnly}
          />
        </TabsContent>

        {canViewAccountsTab && (
          <TabsContent value="accounts" className="space-y-6 mt-6">
            <AccountView
              isReadOnly={isReadOnly}
              userProfile={userProfile}
            />
          </TabsContent>
        )}
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
        onSuccess={inEditMode ? () => {} : loadData} // Skip reload when in Edit Mode
        departments={departments}
        isEditMode={inEditMode}
        onLocalUpdate={handleLocalRoleUpdate}
      />

      <UserAssignmentDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        role={selectedRole}
        onSuccess={inEditMode ? () => {} : loadData} // Skip reload when in Edit Mode
        isEditMode={inEditMode}
        onLocalAssign={handleLocalUserAssignment}
      />

      <ReportingRoleDialog
        open={reportingDialogOpen}
        onOpenChange={setReportingDialogOpen}
        role={selectedRole}
        allRoles={roles}
        onSave={handleSaveReportingRole}
      />
    </div>
    </RoleGuard>
  );
}


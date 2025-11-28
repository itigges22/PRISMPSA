import { getCurrentUserProfileServer } from '@/lib/auth-server';
import { serverDepartmentService, DepartmentMetrics } from '@/lib/department-service';
import { canViewDepartment, hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';
import { DepartmentList } from '@/components/department-list';

export const dynamic = 'force-dynamic';

export default async function DepartmentsPage() {
  // Get current user and check permissions
  const userProfile = await getCurrentUserProfileServer();
  if (!userProfile) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
          <p className="text-gray-600 mt-2">Please log in to view departments.</p>
        </div>
      </div>
    );
  }

  // Check if user has permission to view any departments
  const canViewAnyDepartments = await hasPermission(userProfile, Permission.VIEW_DEPARTMENTS) ||
                                 await hasPermission(userProfile, Permission.VIEW_ALL_DEPARTMENTS);

  if (!canViewAnyDepartments) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
          <p className="text-gray-600 mt-2">You don&apos;t have permission to view departments.</p>
        </div>
      </div>
    );
  }

  // Get all departments
  const allDepartments = await serverDepartmentService.getAllDepartments();

  // Check if user has VIEW_ALL_DEPARTMENTS override - if so, show all departments
  const hasViewAllDepartments = await hasPermission(userProfile, Permission.VIEW_ALL_DEPARTMENTS);
  
  // Filter departments based on user access
  // If user has VIEW_ALL_DEPARTMENTS, show all departments
  // Otherwise, filter by department assignment
  const departments = hasViewAllDepartments 
    ? allDepartments 
    : allDepartments.filter(dept => 
    canViewDepartment(userProfile, dept.id)
  );

  // Fetch metrics for all visible departments (in parallel for performance)
  const metricsPromises = departments.map(dept =>
    serverDepartmentService.getDepartmentMetrics(dept.id)
  );
  const metricsResults = await Promise.all(metricsPromises);

  // Build the metrics map
  const departmentMetrics = new Map<string, DepartmentMetrics>();
  metricsResults.forEach((metrics, index) => {
    if (metrics) {
      departmentMetrics.set(departments[index].id, metrics);
    }
  });

  // Check if user can create departments - specifically check CREATE_DEPARTMENT permission
  const canCreateDepartments = await hasPermission(userProfile, Permission.CREATE_DEPARTMENT);
  
  // Check if user can manage departments (edit/delete) - separate from create
  const canManageDepartments = await hasPermission(userProfile, Permission.EDIT_DEPARTMENT) ||
                                await hasPermission(userProfile, Permission.DELETE_DEPARTMENT);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">Departments</h1>
            <p className="text-gray-600">
              Manage and view department performance across the organization
            </p>
            {canManageDepartments && (
              <p className="text-sm text-gray-500">
                You have administrative access to manage departments
              </p>
            )}
          </div>
        </div>
      </div>

      <DepartmentList 
        departments={departments} 
        canCreateDepartments={canCreateDepartments}
        canManageDepartments={canManageDepartments}
        userProfile={userProfile}
        initialDepartmentMetrics={departmentMetrics}
      />
    </div>
  );
}
import { notFound } from 'next/navigation';
import { getCurrentUserProfileServer } from '@/lib/auth-server';
import { serverDepartmentService } from '@/lib/department-service';
import { isAdminLevel, canViewDepartment, canManageDepartment, hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';
import { DepartmentOverview } from '@/components/department-overview';

interface DepartmentPageProps {
  params: Promise<{
    departmentId: string;
  }>;
}

export default async function DepartmentPage({ params }: DepartmentPageProps) {
  const { departmentId } = await params;

  // Get current user and check permissions
  const userProfile = await getCurrentUserProfileServer();
  if (!userProfile) {
    notFound();
  }

  // Check if user can view this department
  // Allow access if user has VIEW_ALL_DEPARTMENTS override OR can view this specific department
  const hasViewAllDepartments = await hasPermission(userProfile, Permission.VIEW_ALL_DEPARTMENTS);
  const canViewThisDepartment = await canViewDepartment(userProfile, departmentId);
  
  if (!hasViewAllDepartments && !canViewThisDepartment) {
    notFound();
  }

  // Get department data
  const department = await serverDepartmentService.getDepartmentById(departmentId);
  if (!department) {
    notFound();
  }

  // Get department metrics
  const metrics = await serverDepartmentService.getDepartmentMetrics(departmentId);
  if (!metrics) {
    notFound();
  }

  // Get department projects
  const projects = await serverDepartmentService.getDepartmentProjects(departmentId);

  // Check if user can manage this specific department
  const canManageDepartments = await canManageDepartment(userProfile, departmentId);

  return (
    <div className="space-y-6">
      <DepartmentOverview
        department={department}
        metrics={metrics}
        projects={projects}
        canManageDepartments={canManageDepartments}
        userProfile={userProfile}
      />
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Users, 
  FolderOpen, 
  Settings,
  ArrowRight,
  Building2,
  Trash2
} from 'lucide-react';
import { Department } from '@/lib/supabase';
import { DepartmentMetrics } from '@/lib/department-client-service';
import { hasPermission, canViewDepartment, UserWithRoles } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';
// Permission check is handled server-side via canManageDepartments prop
import DepartmentCreateDialog from './department-create-dialog';
import DepartmentDeleteDialog from './department-delete-dialog';

interface DepartmentListProps {
  departments: Department[];
  canCreateDepartments: boolean;
  canManageDepartments: boolean;
  userProfile: UserWithRoles | null;
  initialDepartmentMetrics?: Map<string, DepartmentMetrics>;
}

export function DepartmentList({ 
  departments, 
  canCreateDepartments,
  canManageDepartments, 
  userProfile,
  initialDepartmentMetrics
}: DepartmentListProps) {
  const [visibleDepartments, setVisibleDepartments] = useState<Department[]>([]);

  // Filter departments based on permissions
  useEffect(() => {
    if (!userProfile || departments.length === 0) {
      setVisibleDepartments([]);
      return;
    }

    async function filterDepartments() {
      const filtered: Department[] = [];
      
      for (const dept of departments) {
        // Check if user can view this specific department
        const canView = await canViewDepartment(userProfile, dept.id);
        // Also check for VIEW_ALL_DEPARTMENTS permission
        const hasViewAll = await hasPermission(userProfile, Permission.VIEW_ALL_DEPARTMENTS);
        // Or check VIEW_DEPARTMENTS permission (general permission)
        const hasViewDepartments = await hasPermission(userProfile, Permission.VIEW_DEPARTMENTS);
        
        if (canView || hasViewAll || hasViewDepartments) {
          filtered.push(dept);
        }
      }
      
      setVisibleDepartments(filtered);
    }

    filterDepartments();
  }, [departments, userProfile]);

  // Note: Capacity and project metrics are now provided by server-side rendering
  // via initialDepartmentMetrics prop, so we don't need to fetch them client-side

  // Use server-side metrics - all departments should have metrics from server
  const getMetrics = (departmentId: string): DepartmentMetrics => {
    // Always prefer server-side metrics
    if (initialDepartmentMetrics?.has(departmentId)) {
      return initialDepartmentMetrics.get(departmentId)!;
    }

    // Fallback for departments without metrics (shouldn't happen in normal operation)
    return {
      id: departmentId,
      name: departments.find(d => d.id === departmentId)?.name || 'Unknown',
      description: departments.find(d => d.id === departmentId)?.description || null,
      activeProjects: 0,
      teamSize: 0,
      capacityUtilization: 0,
      projectHealth: {
        healthy: 0,
        atRisk: 0,
        critical: 0
      },
      workloadDistribution: [],
      recentProjects: []
    };
  };

  const getHealthScore = (metrics: DepartmentMetrics): number => {
    const total = metrics.projectHealth.healthy + metrics.projectHealth.atRisk + metrics.projectHealth.critical;
    if (total === 0) return 100;
    return Math.round((metrics.projectHealth.healthy / total) * 100);
  };

  const getHealthColor = (score: number): string => {
    if (score >= 80) return 'text-green-600 bg-green-100 hover:!bg-green-200 hover:!text-green-700';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100 hover:!bg-yellow-200 hover:!text-yellow-700';
    return 'text-red-600 bg-red-100 hover:!bg-red-200 hover:!text-red-700';
  };

  const getHealthLabel = (score: number): string => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Needs Attention';
    return 'Critical';
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      {canCreateDepartments && (
        <div className="flex justify-end">
          <DepartmentCreateDialog
            onDepartmentCreated={() => {
              // Refresh the page to show the new department
              window.location.reload();
            }}
          >
            <Button className="inline-flex items-center space-x-2">
              <Plus className="w-4 h-4" />
              <span>Create Department</span>
            </Button>
          </DepartmentCreateDialog>
        </div>
      )}

      {/* Departments Grid */}
      {visibleDepartments.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Departments Found</h3>
            <p className="text-gray-600 mb-6">
              {canCreateDepartments 
                ? 'Get started by creating your first department.'
                : 'No departments have been created yet.'
              }
            </p>
            {canCreateDepartments && (
              <DepartmentCreateDialog
                onDepartmentCreated={() => {
                  // Refresh the page to show the new department
                  window.location.reload();
                }}
              >
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Department
                </Button>
              </DepartmentCreateDialog>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleDepartments.map((department) => {
            const metrics = getMetrics(department.id);
            const healthScore = getHealthScore(metrics);
            
            return (
              <Card key={department.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{department.name}</CardTitle>
                      {department.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {department.description}
                        </p>
                      )}
                    </div>
                    {canManageDepartments && (
                      <div className="flex items-center space-x-1">
                        <Link href={`/departments/${department.id}/admin`}>
                          <button 
                            className="inline-flex items-center justify-center h-8 w-8 rounded-md text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300"
                            title="Manage Department"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                        </Link>
                        <DepartmentDeleteDialog
                          departmentId={department.id}
                          departmentName={department.name}
                          onDepartmentDeleted={() => {
                            // Refresh the page to show updated department list
                            window.location.reload();
                          }}
                        >
                          <button 
                            className="inline-flex items-center justify-center h-8 w-8 rounded-md text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-300"
                            title="Delete Department"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </DepartmentDeleteDialog>
                      </div>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Health Score */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Health Score</span>
                    <Badge className={getHealthColor(healthScore)}>
                      {getHealthLabel(healthScore)} ({healthScore}%)
                    </Badge>
                  </div>

                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <FolderOpen className="w-4 h-4 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{metrics.activeProjects}</p>
                        <p className="text-xs text-gray-600">Projects</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Users className="w-4 h-4 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{metrics.teamSize}</p>
                        <p className="text-xs text-gray-600">Team Size</p>
                      </div>
                    </div>
                  </div>

                  {/* Capacity Utilization */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">Capacity</span>
                      <span className="text-sm font-medium text-gray-900">{metrics.capacityUtilization}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          metrics.capacityUtilization >= 90 
                            ? 'bg-red-500' 
                            : metrics.capacityUtilization >= 75 
                              ? 'bg-yellow-500' 
                              : 'bg-green-500'
                        }`}
                        style={{ width: `${metrics.capacityUtilization}%` }}
                      />
                    </div>
                  </div>

                  {/* Project Health Breakdown */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-600">Project Status</p>
                    <div className="flex space-x-2">
                      <Badge className="bg-green-100 text-green-800 border-green-200 hover:!bg-green-200 hover:!text-green-900">
                        {metrics.projectHealth.healthy} Healthy
                      </Badge>
                      {metrics.projectHealth.atRisk > 0 && (
                        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:!bg-yellow-200 hover:!text-yellow-900">
                          {metrics.projectHealth.atRisk} At Risk
                        </Badge>
                      )}
                      {metrics.projectHealth.critical > 0 && (
                        <Badge className="bg-red-100 text-red-800 border-red-200 hover:!bg-red-200 hover:!text-red-900">
                          {metrics.projectHealth.critical} Critical
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="pt-2">
                    <Link href={`/departments/${department.id}`}>
                      <Button variant="outline" className="w-full">
                        View Details
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

    </div>
  );
}

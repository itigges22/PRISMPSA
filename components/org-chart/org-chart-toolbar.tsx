'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Filter, 
  Grid3X3, 
  List, 
  Plus, 
  Download,
  RefreshCw,
  Settings,
  Users,
  Building2
} from 'lucide-react';
import { RoleCreationDialog } from './role-creation-dialog';
import { organizationService } from '@/lib/organization-service';

interface OrgChartToolbarProps {
  viewType: 'hierarchy' | 'department';
  onViewTypeChange: (viewType: 'hierarchy' | 'department') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedDepartment?: string;
  onDepartmentChange: (departmentId: string | undefined) => void;
  onRefresh: () => void;
  onExport: () => void;
  onRoleCreated?: (role: any) => void;
  isReadOnly?: boolean;
  totalUsers?: number;
  totalRoles?: number;
  totalDepartments?: number;
}

export function OrgChartToolbar({
  viewType,
  onViewTypeChange,
  searchQuery,
  onSearchChange,
  selectedDepartment,
  onDepartmentChange,
  onRefresh,
  onExport,
  onRoleCreated,
  isReadOnly = false,
  totalUsers = 0,
  totalRoles = 0,
  totalDepartments = 0,
}: OrgChartToolbarProps) {
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [showFilters, setShowFilters] = useState(false);

  const loadDepartments = async () => {
    try {
      const orgStructure = await organizationService.getOrganizationStructure();
      if (orgStructure) {
        setDepartments(orgStructure.departments.map(dept => ({
          id: dept.id,
          name: dept.name
        })));
      }
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  };

  // Load departments when component mounts
  useEffect(() => {
    void loadDepartments();
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.target.value);
  };

  const handleDepartmentChange = (departmentId: string) => {
    onDepartmentChange(departmentId === 'all' ? undefined : departmentId);
  };

  const handleViewTypeChange = (newViewType: 'hierarchy' | 'department') => {
    onViewTypeChange(newViewType);
  };

  const handleRefresh = () => {
    onRefresh();
  };

  const handleExport = () => {
    onExport();
  };

  const clearFilters = () => {
    onSearchChange('');
    onDepartmentChange(undefined);
  };

  const hasActiveFilters = searchQuery || selectedDepartment;

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search and View Controls */}
          <div className="flex flex-1 gap-4">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search roles, users, or departments..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant={viewType === 'hierarchy' ? 'default' : 'outline'}
                size="sm"
                onClick={() => { handleViewTypeChange('hierarchy'); }}
                className="flex items-center gap-2"
              >
                <Grid3X3 className="h-4 w-4" />
                Hierarchy
              </Button>
              <Button
                variant={viewType === 'department' ? 'default' : 'outline'}
                size="sm"
                onClick={() => { handleViewTypeChange('department'); }}
                className="flex items-center gap-2"
              >
                <Building2 className="h-4 w-4" />
                Departments
              </Button>
            </div>
          </div>

          {/* Filters and Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowFilters(!showFilters); }}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {[searchQuery, selectedDepartment].filter(Boolean).length}
                </Badge>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>

            {!isReadOnly && (
              <RoleCreationDialog 
                open={false}
                onOpenChange={() => {}}
                 onSuccess={() => {}}
              >
                <Button size="sm" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create Role
                </Button>
              </RoleCreationDialog>
            )}
          </div>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="department-filter">Department</Label>
                <Select
                  value={selectedDepartment ?? 'all'}
                  onValueChange={handleDepartmentChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All departments</SelectItem>
                    {departments
                      .filter((dept) => dept?.id && dept.id !== '')
                      .map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>View Options</Label>
                <div className="flex gap-2">
                  <Button
                    variant={viewType === 'hierarchy' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleViewTypeChange('hierarchy')}
                    className="flex-1"
                  >
                    <Grid3X3 className="h-4 w-4 mr-2" />
                    Tree View
                  </Button>
                  <Button
                    variant={viewType === 'department' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleViewTypeChange('department')}
                    className="flex-1"
                  >
                    <Building2 className="h-4 w-4 mr-2" />
                    Department View
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Quick Actions</Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearFilters}
                    disabled={!hasActiveFilters}
                    className="flex-1"
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Statistics */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{totalUsers} users</span>
            </div>
            <div className="flex items-center gap-1">
              <Settings className="h-4 w-4" />
              <span>{totalRoles} roles</span>
            </div>
            <div className="flex items-center gap-1">
              <Building2 className="h-4 w-4" />
              <span>{totalDepartments} departments</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

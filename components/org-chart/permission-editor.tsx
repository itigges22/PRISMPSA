'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Permission, PermissionDefinitions, PermissionCategories } from '@/lib/permissions';
import { Save, RotateCcw, Info } from 'lucide-react';

interface PermissionEditorProps {
  roleId: string;
  roleName: string;
  currentPermissions: Record<Permission, boolean>;
  onPermissionsChange: (permissions: Record<Permission, boolean>) => void;
  onSave: (permissions: Record<Permission, boolean>) => Promise<boolean>;
  isSystemRole?: boolean;
  disabled?: boolean;
  hideSaveButton?: boolean; // Hide the "Save Changes" button (used when parent form handles saving)
}

export function PermissionEditor({
  roleName,
  currentPermissions,
  onPermissionsChange,
  onSave,
  isSystemRole = false,
  disabled = false,
  hideSaveButton = false
}: PermissionEditorProps) {
  const [permissions, setPermissions] = useState<Record<Permission, boolean>>(currentPermissions);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['System']));

  useEffect(() => {
    setPermissions(currentPermissions);
    setHasChanges(false);
  }, [currentPermissions]);

  const handlePermissionChange = (permission: Permission, checked: boolean) => {
    if (disabled || isSystemRole) return;

    const newPermissions = {
      ...permissions,
      [permission]: checked
    };
    
    setPermissions(newPermissions);
    onPermissionsChange(newPermissions);
    setHasChanges(true);
  };

  const handleCategoryToggle = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const handleSave = async () => {
    if (disabled || isSystemRole || !hasChanges) return;

    setSaving(true);
    try {
      const success = await onSave(permissions);
      if (success) {
        setHasChanges(false);
      }
    } catch (error: unknown) {
      console.error('Error saving permissions:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setPermissions(currentPermissions);
    onPermissionsChange(currentPermissions);
    setHasChanges(false);
  };

  const getCategoryStats = (categoryPermissions: Permission[]) => {
    const total = categoryPermissions.length;
    const enabled = categoryPermissions.filter((p: any) => (permissions as any)[p]).length;
    return { total, enabled, percentage: total > 0 ? Math.round((enabled / total) * 100) : 0 };
  };

  const getPermissionDescription = (permission: Permission) => {
    return (PermissionDefinitions as any)[permission]?.description || '';
  };

  const getPermissionName = (permission: Permission) => {
    return (PermissionDefinitions as any)[permission]?.name || permission;
  };

  if (isSystemRole) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-500" />
            System Role Permissions
          </CardTitle>
          <CardDescription>
            System roles have all permissions and cannot be modified.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">All Permissions</span>
              <Badge variant="secondary">Enabled</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              The {roleName} role has full system access and all permissions are automatically enabled.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Role Permissions</CardTitle>
            <CardDescription>
              Configure permissions for the {roleName} role
            </CardDescription>
          </div>
          {!hideSaveButton && (
            <div className="flex items-center gap-2">
              {hasChanges && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  disabled={saving}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!hasChanges || saving || disabled}
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(PermissionCategories).map(([categoryName, categoryPermissions]) => {
          const stats = getCategoryStats(categoryPermissions);
          const isExpanded = expandedCategories.has(categoryName);
          
          return (
            <div key={categoryName} className="space-y-3">
              <div
                className="flex items-center justify-between cursor-pointer hover:bg-muted/50 p-2 rounded-md transition-colors"
                onClick={() => handleCategoryToggle(categoryName)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-sm border-2 border-primary/20 bg-primary/10" />
                  <span className="font-medium">{categoryName}</span>
                  <Badge variant="outline" className="text-xs">
                    {stats.enabled}/{stats.total} ({stats.percentage}%)
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {isExpanded ? '▼' : '▶'}
                </div>
              </div>
              
              {isExpanded && (
                <div className="ml-6 space-y-3">
                  {categoryPermissions.map((permission:any) => {
                    const isOverridePermission = (PermissionDefinitions as any)[permission]?.isOverride === true;
                    return (
                      <div
                        key={permission}
                        className={`flex items-start space-x-3 ${
                          isOverridePermission
                            ? 'bg-red-50 border border-red-200 rounded-md p-2 -ml-2'
                            : ''
                        }`}
                      >
                        <Checkbox
                          id={permission}
                          checked={(permissions as any)[permission] || false}
                          onCheckedChange={(checked) =>
                            { handlePermissionChange(permission, checked as boolean); }
                          }
                          disabled={disabled}
                          className={`mt-1 ${isOverridePermission ? 'border-red-400' : ''}`}
                        />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <Label
                              htmlFor={permission}
                              className="text-sm font-medium cursor-pointer"
                            >
                              {getPermissionName(permission)}
                            </Label>
                            {isOverridePermission && (
                              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                Override
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {getPermissionDescription(permission)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {categoryName !== 'Department' && <Separator />}
            </div>
          );
        })}
        
        {hasChanges && (
          <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
            <div className="flex items-center gap-2 text-amber-800">
              <Info className="h-4 w-4" />
              <span className="text-sm font-medium">Unsaved Changes</span>
            </div>
            <p className="text-sm text-amber-700 mt-1">
              You have unsaved permission changes. Click &quot;Save Changes&quot; to apply them.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

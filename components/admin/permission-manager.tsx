'use client';

/**
 * Permission Manager Component
 * 
 * Provides a UI for managing permissions on roles.
 * Shows all available permissions grouped by category.
 * Highlights override permissions.
 */

import React, { useState, useEffect } from 'react';
import { Permission, PermissionDefinitions, PermissionCategories, OverridePermissions } from '@/lib/permissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
// Alert component not available, using Card instead
import { Shield, AlertTriangle, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PermissionManagerProps {
  roleId: string;
  roleName: string;
  currentPermissions: Record<Permission, boolean>;
  onSave: (permissions: Record<Permission, boolean>) => Promise<boolean>;
  readOnly?: boolean;
  isSystemRole?: boolean;
}

export function PermissionManager({
  roleId,
  roleName,
  currentPermissions,
  onSave,
  readOnly = false,
  isSystemRole = false,
}: PermissionManagerProps) {
  const [permissions, setPermissions] = useState<Record<Permission, boolean>>(currentPermissions);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    setPermissions(currentPermissions);
  }, [currentPermissions]);

  const handlePermissionChange = (permission: Permission, checked: boolean) => {
    if (readOnly || isSystemRole) return;

    setPermissions(prev => ({
      ...prev,
      [permission]: checked,
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const success = await onSave(permissions);
      if (success) {
        setHasChanges(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setPermissions(currentPermissions);
    setHasChanges(false);
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const toggleAllInCategory = (category: string, checked: boolean) => {
    if (readOnly || isSystemRole) return;

    const categoryPermissions = PermissionCategories[category as keyof typeof PermissionCategories] || [];
    
    setPermissions(prev => {
      const next = { ...prev };
      categoryPermissions.forEach(permission => {
        next[permission] = checked;
      });
      return next;
    });
    setHasChanges(true);
  };

  const getCheckedCount = (category: string) => {
    const categoryPermissions = PermissionCategories[category as keyof typeof PermissionCategories] || [];
    return categoryPermissions.filter(p => permissions[p]).length;
  };

  const getTotalCount = (category: string) => {
    const categoryPermissions = PermissionCategories[category as keyof typeof PermissionCategories] || [];
    return categoryPermissions.length;
  };

  if (isSystemRole) {
    return (
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900">
                System Role Protection
              </p>
              <p className="text-sm text-blue-700 mt-1">
                This is a system role. Permissions cannot be modified through the UI for security reasons.
                {roleName === 'Superadmin' && ' Superadmin has all permissions by default.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Manage Permissions for {roleName}</h3>
          <p className="text-sm text-muted-foreground">
            Select which permissions this role should have
          </p>
        </div>
        {hasChanges && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel} disabled={saving}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Check className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        )}
      </div>

      {/* Warning for Override Permissions */}
      {Object.entries(permissions).some(([perm, enabled]) => 
        enabled && OverridePermissions.includes(perm as Permission)
      ) && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-orange-900">
                  Warning: Override Permissions Detected
                </p>
                <p className="text-sm text-orange-700 mt-1">
                  This role has override permissions that grant access to ALL resources of that type, 
                  regardless of assignment. Use with caution.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Permission Categories */}
      <div className="space-y-4">
        {Object.entries(PermissionCategories).map(([category, categoryPermissions]) => {
          const isExpanded = expandedCategories.has(category);
          const checkedCount = getCheckedCount(category);
          const totalCount = getTotalCount(category);
          const allChecked = checkedCount === totalCount && totalCount > 0;
          const someChecked = checkedCount > 0 && checkedCount < totalCount;

          return (
            <Card key={category}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1 cursor-pointer" onClick={() => toggleCategory(category)}>
                    <CardTitle className="text-base flex items-center gap-2">
                      {category}
                      <Badge variant={checkedCount > 0 ? "default" : "secondary"}>
                        {checkedCount} / {totalCount}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      {isExpanded ? 'Click to collapse' : 'Click to expand'}
                    </CardDescription>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`category-${category}`}
                      checked={allChecked}
                      className={cn(someChecked && "data-[state=checked]:bg-orange-500")}
                      onCheckedChange={(checked) => toggleAllInCategory(category, checked as boolean)}
                      disabled={readOnly}
                    />
                    <Label htmlFor={`category-${category}`} className="text-sm font-normal cursor-pointer">
                      Select All
                    </Label>
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent>
                  <div className="space-y-3">
                    {categoryPermissions.map((permission) => {
                      const def = PermissionDefinitions[permission];
                      const isOverride = def.isOverride === true;

                      return (
                        <div
                          key={permission}
                          className={cn(
                            "flex items-start space-x-3 p-3 rounded-lg border",
                            isOverride && "border-orange-300 bg-orange-50 dark:bg-orange-950",
                            permissions[permission] && !isOverride && "bg-blue-50 dark:bg-blue-950"
                          )}
                        >
                          <Checkbox
                            id={permission}
                            checked={permissions[permission] || false}
                            onCheckedChange={(checked) => handlePermissionChange(permission, checked as boolean)}
                            disabled={readOnly}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <Label
                              htmlFor={permission}
                              className="text-sm font-medium cursor-pointer flex items-center gap-2"
                            >
                              {def.name}
                              {isOverride && (
                                <Badge variant="destructive" className="text-xs">
                                  Override
                                </Badge>
                              )}
                            </Label>
                            <p className="text-xs text-muted-foreground mt-1">
                              {def.description}
                            </p>
                            <code className="text-xs text-muted-foreground mt-1 block">
                              {permission}
                            </code>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Footer Actions */}
      {hasChanges && (
        <div className="flex items-center justify-end gap-2 p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground mr-auto">
            You have unsaved changes
          </p>
          <Button variant="outline" onClick={handleCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      )}

      {/* Permission Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Permission Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Total Permissions</p>
              <p className="text-2xl font-bold">{Object.values(Permission).length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Enabled</p>
              <p className="text-2xl font-bold text-green-600">
                {Object.values(permissions).filter(Boolean).length}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Override Permissions</p>
              <p className="text-2xl font-bold text-orange-600">
                {Object.entries(permissions).filter(([perm, enabled]) => 
                  enabled && OverridePermissions.includes(perm as Permission)
                ).length}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Categories</p>
              <p className="text-2xl font-bold">{Object.keys(PermissionCategories).length}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default PermissionManager;


'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Workflow,
  UserCheck,
  ArrowRight,
  Shield,
  Crown,
  Clock,
  Database,
  Activity,
  Loader2,
  BarChart3
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { isSuperadmin } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';
import { useMemo } from 'react';

export default function AdminHubPage() {
  const { userProfile, loading } = useAuth();

  // Get user permissions from their roles
  const userPermissions = useMemo(() => {
    if (!userProfile?.user_roles) return new Set<string>();
    const perms = new Set<string>();
    for (const ur of userProfile.user_roles) {
      const rolePerms = ur.roles?.permissions as Record<string, boolean> | undefined;
      if (rolePerms) {
        Object.entries(rolePerms).forEach(([perm, enabled]) => {
          if (enabled) perms.add(perm);
        });
      }
    }
    return perms;
  }, [userProfile]);

  const hasPermission = (perm: Permission) => userPermissions.has(perm);
  const hasAnyPermission = (perms: Permission[]) => perms.some(p => userPermissions.has(p));
  const isSuperadminUser = userProfile ? isSuperadmin(userProfile) : false;
  const userManagementFeatures = [
    {
      title: 'Role Management',
      description: 'Manage organizational roles, permissions, and hierarchies. Assign users to roles and define reporting structures.',
      icon: Shield,
      href: '/admin/roles',
      color: 'text-red-600 bg-red-50',
      borderColor: 'border-red-200',
      features: [
        'Role hierarchy & org chart',
        'Permission management',
        'User role assignments',
        'Department-based roles',
      ],
      requiredPermission: Permission.MANAGE_USER_ROLES,
      anyPermission: null,
      superadminOnly: false,
    },
    {
      title: 'Superadmin Setup',
      description: 'Configure superadmin access and platform-wide settings. Manage system administrators and global permissions.',
      icon: Crown,
      href: '/admin/superadmin-setup',
      color: 'text-amber-600 bg-amber-50',
      borderColor: 'border-amber-200',
      features: [
        'Superadmin configuration',
        'System-level access',
        'Global settings',
        'Platform administration',
      ],
      requiredPermission: null,
      anyPermission: null,
      superadminOnly: true,
    },
    {
      title: 'Time Tracking Admin',
      description: 'Administrative oversight of time tracking data, approvals, and reporting across the organization.',
      icon: Clock,
      href: '/admin/time-tracking',
      color: 'text-cyan-600 bg-cyan-50',
      borderColor: 'border-cyan-200',
      features: [
        'Time entry oversight',
        'Approval workflows',
        'Reporting & analytics',
        'Policy management',
      ],
      requiredPermission: Permission.VIEW_ALL_TIME_ENTRIES,
      anyPermission: null,
      superadminOnly: false,
    },
  ];

  const workflowClientFeatures = [
    {
      title: 'Workflow Management',
      description: 'Create and manage workflow templates with visual node-based workflows. Define handoff paths and track project progression.',
      icon: Workflow,
      href: '/admin/workflows',
      color: 'text-blue-600 bg-blue-50',
      borderColor: 'border-blue-200',
      features: [
        'Visual workflow builder',
        'Department & role nodes',
        'Client approval nodes',
        'Conditional branching',
      ],
      requiredPermission: null,
      anyPermission: [Permission.MANAGE_WORKFLOWS, Permission.MANAGE_ALL_WORKFLOWS],
      superadminOnly: false,
    },
    {
      title: 'Client Portal',
      description: 'Manage client invitations, access, and feedback. Enable clients to view projects, provide feedback, and approve workflow steps.',
      icon: UserCheck,
      href: '/admin/client-portal',
      color: 'text-purple-600 bg-purple-50',
      borderColor: 'border-purple-200',
      features: [
        'Secure client invitations',
        'Project visibility controls',
        'Client approval workflows',
        'Satisfaction ratings & feedback',
      ],
      requiredPermission: Permission.MANAGE_CLIENT_INVITES,
      anyPermission: null,
      superadminOnly: false,
    },
    {
      title: 'Organization Analytics',
      description: 'View organization-wide analytics including project performance, team utilization, and workflow metrics.',
      icon: BarChart3,
      href: '/analytics',
      color: 'text-emerald-600 bg-emerald-50',
      borderColor: 'border-emerald-200',
      features: [
        'Project performance metrics',
        'Team utilization reports',
        'Time tracking analytics',
        'Workflow efficiency data',
      ],
      requiredPermission: null,
      anyPermission: [Permission.VIEW_ALL_ANALYTICS, Permission.VIEW_ALL_DEPARTMENT_ANALYTICS, Permission.VIEW_ALL_ACCOUNT_ANALYTICS],
      superadminOnly: false,
    },
  ];

  const systemSettingsFeatures = [
    {
      title: 'Database Management',
      description: 'Direct database access and management tools for advanced administration and troubleshooting.',
      icon: Database,
      href: '/admin/database',
      color: 'text-slate-600 bg-slate-50',
      borderColor: 'border-slate-200',
      features: [
        'Database queries',
        'Schema management',
        'Data operations',
        'System diagnostics',
      ],
      requiredPermission: null,
      anyPermission: null,
      superadminOnly: true,
    },
    {
      title: 'RBAC Diagnostics',
      description: 'Diagnose and troubleshoot role-based access control issues. View permission assignments and access patterns.',
      icon: Activity,
      href: '/admin/rbac-diagnostics',
      color: 'text-pink-600 bg-pink-50',
      borderColor: 'border-pink-200',
      features: [
        'Permission diagnostics',
        'Access troubleshooting',
        'Role analysis',
        'Security auditing',
      ],
      requiredPermission: null,
      anyPermission: null,
      superadminOnly: true,
    },
  ];

  // Helper function to check if user can access a feature
  const canAccessFeature = (feature: { requiredPermission: Permission | null; anyPermission?: Permission[] | null; superadminOnly: boolean }) => {
    if (feature.superadminOnly) {
      return isSuperadminUser;
    }
    // Check anyPermission array first (like nav dropdown)
    if (feature.anyPermission && feature.anyPermission.length > 0) {
      return isSuperadminUser || hasAnyPermission(feature.anyPermission);
    }
    // Fall back to single permission check
    if (feature.requiredPermission) {
      return isSuperadminUser || hasPermission(feature.requiredPermission);
    }
    return true;
  };

  // Filter features based on permissions
  const visibleUserManagement = userManagementFeatures.filter(canAccessFeature);
  const visibleWorkflowClient = workflowClientFeatures.filter(canAccessFeature);
  const visibleSystemSettings = systemSettingsFeatures.filter(canAccessFeature);

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Administration</h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Manage platform settings, users, workflows, and operations
        </p>
      </div>

      {/* User Management */}
      {visibleUserManagement.length > 0 && (
      <div>
        <h2 className="text-2xl font-semibold mb-4">User Management</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visibleUserManagement.map((feature:any) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} className={`hover:shadow-lg transition-shadow ${feature.borderColor}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className={`p-3 rounded-lg ${feature.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <Link href={feature.href}>
                      <Button variant="ghost" size="sm">
                        Open
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                  <CardTitle className="mt-4">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {feature.features.map((item:any, idx:any) => (
                      <li key={idx} className="text-sm flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-current" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
      )}

      {/* Workflow & Client Management */}
      {visibleWorkflowClient.length > 0 && (
      <div>
        <h2 className="text-2xl font-semibold mb-4">Workflow & Client Management</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visibleWorkflowClient.map((feature:any) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} className={`hover:shadow-lg transition-shadow ${feature.borderColor}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className={`p-3 rounded-lg ${feature.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <Link href={feature.href}>
                      <Button variant="ghost" size="sm">
                        Open
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                  <CardTitle className="mt-4">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {feature.features.map((item:any, idx:any) => (
                      <li key={idx} className="text-sm flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-current" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
      )}

      {/* System Settings - Superadmin Only */}
      {visibleSystemSettings.length > 0 && (
      <div>
        <h2 className="text-2xl font-semibold mb-4">System Settings</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visibleSystemSettings.map((feature:any) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} className={`hover:shadow-lg transition-shadow ${feature.borderColor}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className={`p-3 rounded-lg ${feature.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <Link href={feature.href}>
                      <Button variant="ghost" size="sm">
                        Open
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                  <CardTitle className="mt-4">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {feature.features.map((item:any, idx:any) => (
                      <li key={idx} className="text-sm flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-current" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
      )}
    </div>
  );
}

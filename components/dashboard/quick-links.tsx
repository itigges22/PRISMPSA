'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';
import { useState, useEffect } from 'react';
import { createClientSupabase } from '@/lib/supabase';
import {
  Building2,
  Users,
  Clock,
  BarChart3,
  Settings,
  Workflow,
  FolderKanban,
  UserCog
} from 'lucide-react';

interface QuickLink {
  href: string;
  label: string;
  icon: React.ElementType;
  permission?: Permission;
  requiresSuperadmin?: boolean;
}

const ALL_LINKS: QuickLink[] = [
  {
    href: '/accounts',
    label: 'Accounts',
    icon: Building2,
    permission: Permission.VIEW_ACCOUNTS,
  },
  {
    href: '/projects',
    label: 'Projects',
    icon: FolderKanban,
    permission: Permission.VIEW_PROJECTS,
  },
  {
    href: '/departments',
    label: 'Departments',
    icon: Users,
    permission: Permission.VIEW_DEPARTMENTS,
  },
  {
    href: '/time-entries',
    label: 'Time Entries',
    icon: Clock,
    // No permission required - all users can view their own time
  },
  {
    href: '/workflows',
    label: 'Workflows',
    icon: Workflow,
    permission: Permission.MANAGE_WORKFLOWS,
  },
  {
    href: '/analytics',
    label: 'Analytics',
    icon: BarChart3,
    permission: Permission.VIEW_ALL_ANALYTICS,
  },
  {
    href: '/admin/roles',
    label: 'Roles',
    icon: UserCog,
    permission: Permission.MANAGE_USER_ROLES,
  },
  {
    href: '/admin',
    label: 'Admin',
    icon: Settings,
    requiresSuperadmin: true,
  },
];

export function QuickLinks() {
  const { userProfile } = useAuth();
  const [visibleLinks, setVisibleLinks] = useState<QuickLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClientSupabase();

  useEffect(() => {
    async function checkPermissions() {
      if (!userProfile || !supabase) {
        setVisibleLinks([]);
        setIsLoading(false);
        return;
      }

      const isSuperadmin = (userProfile as any)?.is_superadmin === true;
      const links: QuickLink[] = [];

      for (const link of ALL_LINKS) {
        // Superadmin-only links
        if (link.requiresSuperadmin) {
          if (isSuperadmin) {
            links.push(link);
          }
          continue;
        }

        // Links without permission requirement
        if (!link.permission) {
          links.push(link);
          continue;
        }

        // Check permission
        const hasAccess = await hasPermission(
          userProfile as any,
          link.permission,
          {},
          supabase
        );

        if (hasAccess) {
          links.push(link);
        }
      }

      setVisibleLinks(links);
      setIsLoading(false);
    }

    checkPermissions();
  }, [userProfile, supabase]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-8 w-24 bg-muted animate-pulse rounded-md"
          />
        ))}
      </div>
    );
  }

  if (visibleLinks.length === 0) {
    return null;
  }

  return (
    <nav className="flex items-center gap-2 flex-wrap">
      {visibleLinks.map((link) => {
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
          >
            <Icon className="h-4 w-4" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default QuickLinks;

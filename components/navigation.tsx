'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  LayoutDashboard,
  Building2,
  Users,
  User,
  Menu,
  X,
  LogOut,
  Settings,
  BarChart3,
  ChevronDown,
  UserPlus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Permission } from '@/lib/permissions';
import { isSuperadmin, isUnassigned, hasPermission } from '@/lib/rbac';

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: Permission;
  anyPermission?: Permission[];
  allowUnassigned?: boolean | undefined; // true = allow, false = disallow, undefined = default behavior
}

const navigationItems: NavigationItem[] = [
  {
    name: 'Welcome',
    href: '/welcome',
    icon: User,
    allowUnassigned: true,
  },
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    anyPermission: [Permission.VIEW_PROJECTS, Permission.VIEW_ACCOUNTS, Permission.VIEW_DEPARTMENTS],
    allowUnassigned: false, // Explicitly disallow for unassigned users
  },
  {
    name: 'Department',
    href: '/departments',
    icon: Building2,
    anyPermission: [Permission.VIEW_DEPARTMENTS, Permission.VIEW_ALL_DEPARTMENTS],
    allowUnassigned: false, // Explicitly disallow for unassigned users
  },
  {
    name: 'Accounts',
    href: '/accounts',
    icon: Users,
    anyPermission: [Permission.VIEW_ACCOUNTS, Permission.VIEW_ALL_ACCOUNTS],
    allowUnassigned: false, // Explicitly disallow for unassigned users
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    anyPermission: [Permission.VIEW_ANALYTICS, Permission.VIEW_ALL_ANALYTICS],
    allowUnassigned: false, // Explicitly disallow for unassigned users
  },
  {
    name: 'Profile',
    href: '/profile',
    icon: User,
    permission: Permission.VIEW_OWN_PROFILE,
    // Profile should NOT be shown in nav for unassigned users - only in dropdown
    allowUnassigned: false,
  },
  {
    name: 'Admin',
    href: '/admin',
    icon: Settings,
    anyPermission: [
      // Role management permissions
      Permission.VIEW_ROLES,
      Permission.CREATE_ROLE,
      Permission.EDIT_ROLE,
      Permission.DELETE_ROLE,
      Permission.ASSIGN_USERS_TO_ROLES,
      Permission.REMOVE_USERS_FROM_ROLES,
      Permission.VIEW_ACCOUNTS_TAB,
      // Other admin permissions
      Permission.MANAGE_USERS,
      Permission.CREATE_DEPARTMENT,
      Permission.CREATE_ACCOUNT,
      // Analytics permission that grants admin access
      Permission.VIEW_ALL_ANALYTICS,
    ],
    allowUnassigned: false, // Explicitly disallow for unassigned users
  },
  {
    name: 'Pending Users',
    href: '/pending-approval',
    icon: UserPlus,
    permission: Permission.MANAGE_USERS,
    allowUnassigned: false, // Explicitly disallow for unassigned users
  },
];

export function Navigation() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  // Initialize with Welcome only to prevent showing unauthorized items
  const [visibleItems, setVisibleItems] = useState<NavigationItem[]>(
    navigationItems.filter(item => item.allowUnassigned === true)
  );
  const [permissionsChecked, setPermissionsChecked] = useState(false);
  const { userProfile, signOut, loading } = useAuth();
  const pathname = usePathname();
  // Use ref to track cancellation and prevent race conditions
  const filterOperationRef = useRef<{ cancelled: boolean; userId?: string }>({ cancelled: false });

  // Handle hydration
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Check permissions for each navigation item
  useEffect(() => {
    console.log('🎯 Navigation useEffect triggered:', {
      isMounted,
      loading,
      hasUserProfile: !!userProfile,
      userId: userProfile?.id
    });

    if (!isMounted || loading || !userProfile) {
      // Show minimal items during loading
      console.log('⏸️ Navigation: Showing loading state (minimal items)');
      setVisibleItems(navigationItems.filter(item => item.allowUnassigned));
      setPermissionsChecked(false);
      // Cancel any pending operations
      filterOperationRef.current.cancelled = true;
      return;
    }

    // Cancel previous operation and start new one
    const currentUserId = userProfile.id;
    filterOperationRef.current.cancelled = true;
    filterOperationRef.current = { cancelled: false, userId: currentUserId };

    async function filterItems() {
      const operationId = currentUserId;
      setPermissionsChecked(false);
      
      // IMPORTANT: Always check isUnassigned FIRST before any other checks
      const isActuallyUnassigned = isUnassigned(userProfile);
      const userIsSuperadmin = isSuperadmin(userProfile);

      // Debug logging
      console.log('🔍 Navigation Debug:', {
        userEmail: userProfile?.email,
        userId: userProfile?.id,
        userRoles: userProfile?.user_roles?.map(ur => ({
          name: ur.roles?.name,
          isSystem: ur.roles?.is_system_role,
          roleNameLower: ur.roles?.name?.toLowerCase()
        })),
        isActuallyUnassigned,
        userIsSuperadmin,
        userRolesLength: userProfile?.user_roles?.length || 0
      });

      // Check if this operation was cancelled
      if (filterOperationRef.current.cancelled || filterOperationRef.current.userId !== operationId) {
        console.log('⚠️ Navigation filter cancelled - newer operation in progress');
        return;
      }

      // Superadmin sees everything
      if (userIsSuperadmin) {
        if (filterOperationRef.current.cancelled || filterOperationRef.current.userId !== operationId) return;
        setVisibleItems(navigationItems);
        setPermissionsChecked(true);
        return;
      }

      // Unassigned users ONLY see items with allowUnassigned === true
      if (isActuallyUnassigned) {
        if (filterOperationRef.current.cancelled || filterOperationRef.current.userId !== operationId) return;
        const allowedItems = navigationItems.filter(item => item.allowUnassigned === true);
        console.log('✅ Unassigned user detected - filtering navigation');
        console.log('   Allowed items:', allowedItems.map(i => i.name));
        setVisibleItems(allowedItems);
        setPermissionsChecked(true);
        return;
      }

      // Check permissions for each item (only for assigned users)
      const filtered: NavigationItem[] = [];
      
      for (const item of navigationItems) {
        // Check if cancelled before each permission check
        if (filterOperationRef.current.cancelled || filterOperationRef.current.userId !== operationId) {
          console.log('⚠️ Navigation filter cancelled during permission checks');
          return;
        }

        // Items with no permission requirement should not be shown unless explicitly allowed
        if (!item.permission && (!item.anyPermission || item.anyPermission.length === 0)) {
          // Only Welcome page has no permission requirement and allowUnassigned=true
          if (item.allowUnassigned === true) {
            filtered.push(item);
          }
          continue;
        }

        // Check single permission
        if (item.permission) {
          const hasPerm = await hasPermission(userProfile, item.permission);
          // Check cancellation after async operation
          if (filterOperationRef.current.cancelled || filterOperationRef.current.userId !== operationId) {
            console.log('⚠️ Navigation filter cancelled after permission check');
            return;
          }
          if (hasPerm) {
            filtered.push(item);
            continue;
          }
        }

        // Check any of multiple permissions
        if (item.anyPermission && item.anyPermission.length > 0) {
          let hasAnyPerm = false;
          for (const perm of item.anyPermission) {
            const hasPerm = await hasPermission(userProfile, perm);
            // Check cancellation after each async operation
            if (filterOperationRef.current.cancelled || filterOperationRef.current.userId !== operationId) {
              console.log('⚠️ Navigation filter cancelled during permission checks');
              return;
            }
            if (hasPerm) {
              hasAnyPerm = true;
              break;
            }
          }
          if (hasAnyPerm) {
            filtered.push(item);
          }
        }
      }

      // Final cancellation check before updating state
      if (filterOperationRef.current.cancelled || filterOperationRef.current.userId !== operationId) {
        console.log('⚠️ Navigation filter cancelled before state update');
        return;
      }

      // Ensure Welcome is always included if no other items are visible
      if (filtered.length === 0) {
        const welcomeItem = navigationItems.find(item => item.allowUnassigned === true);
        if (welcomeItem) {
          filtered.push(welcomeItem);
        }
      }

      console.log('✅ Navigation filter complete:', {
        userId: operationId,
        visibleItems: filtered.map(i => i.name),
        totalItems: navigationItems.length,
        filteredCount: filtered.length
      });

      setVisibleItems(filtered);
      setPermissionsChecked(true);
    }

    // Ensure filterItems runs
    console.log('🚀 Starting navigation filterItems for user:', currentUserId);
    filterItems().catch(err => {
      // Only update state if this operation wasn't cancelled
      if (!filterOperationRef.current.cancelled && filterOperationRef.current.userId === currentUserId) {
        console.error('Error filtering navigation items:', err);
        // On error, show only Welcome to be safe
        setVisibleItems(navigationItems.filter(item => item.allowUnassigned === true));
        setPermissionsChecked(true);
      }
    });
  }, [isMounted, loading, userProfile]);


  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.href = '/';
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getUserDepartments = () => {
    if (!userProfile?.user_roles) return [];
    return userProfile.user_roles
      .map(ur => {
        const dept = ur.roles?.departments;
        if (!dept) return null;
        return {
          id: dept.id,
          name: dept.name
        };
      })
      .filter((dept): dept is { id: string; name: string } => dept !== null);
  };

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link 
              href={isMounted && !loading && userProfile && !isUnassigned(userProfile) ? "/dashboard" : "/welcome"} 
              className="flex items-center space-x-3"
            >
              <div className="w-10 h-10 relative">
                <Image
                  src="/prism-logo.png"
                  alt="PRISM PSA Logo"
                  width={40}
                  height={40}
                  className="object-contain"
                  priority
                />
              </div>
              <span className="text-xl font-semibold text-gray-900">PRISM PSA</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {/* Only render items after permissions are checked (for assigned users) */}
            {(!isMounted || loading || (!permissionsChecked && userProfile && !isUnassigned(userProfile))) ? (
              // Show minimal loading state
              navigationItems.filter(item => item.allowUnassigned === true).map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-normal text-gray-600"
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </Link>
                );
              })
            ) : (
              visibleItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || 
                  (item.href !== '/dashboard' && pathname.startsWith(item.href));
              
              // Special handling for Department dropdown
              if (item.name === 'Department') {
                const userDepartments = getUserDepartments();
                return (
                  <DropdownMenu key={item.name}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className={cn(
                          'flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-normal transition-colors',
                          isActive
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.name}</span>
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      <DropdownMenuLabel>Your Departments</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {userDepartments.length > 0 ? (
                        userDepartments.map((dept) => (
                          <DropdownMenuItem key={dept.id} asChild>
                            <Link href={`/departments/${dept.id}`} className="flex items-center">
                              <Building2 className="mr-2 h-4 w-4" />
                              <span>{dept.name}</span>
                            </Link>
                          </DropdownMenuItem>
                        ))
                      ) : (
                        <DropdownMenuItem disabled>
                          <span className="text-gray-500">No departments assigned</span>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/departments" className="flex items-center">
                          <Building2 className="mr-2 h-4 w-4" />
                          <span>View All Departments</span>
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              }
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-normal transition-colors',
                    isActive
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Link>
              );
              })
            )}
          </div>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            {userProfile && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={userProfile.image || ''} alt={userProfile.name} />
                      <AvatarFallback className="bg-blue-100 text-blue-700">
                        {getUserInitials(userProfile.name)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{userProfile.name}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {userProfile.email}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {userProfile.user_roles?.map(ur => ur.roles.name).join(', ') || 'No roles'}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="flex items-center">
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="flex items-center">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Mobile menu button */}
            <button
              type="button"
              className="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {(!isMounted || loading || (!permissionsChecked && userProfile && !isUnassigned(userProfile))) ? (
              // Show minimal loading state
              navigationItems.filter(item => item.allowUnassigned === true).map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium text-gray-600"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </Link>
                );
              })
            ) : (
              visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium transition-colors',
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  )}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </Link>
              );
              })
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './ui/dropdown-menu'
import {
  LayoutDashboard,
  Building2,
  Users,
  User,
  Menu,
  X,
  LogOut,
  ChevronDown,
  Settings,
  GitBranch,
  Shield,
  Clock,
  BarChart3
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { isSuperadmin, isUnassigned, hasPermission } from '@/lib/rbac'
import { Permission } from '@/lib/permissions'

interface NavigationItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  permission?: Permission
  anyPermission?: Permission[]
  allowUnassigned?: boolean
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
    allowUnassigned: false,
  },
  {
    name: 'Department',
    href: '/departments',
    icon: Building2,
    anyPermission: [Permission.VIEW_DEPARTMENTS, Permission.VIEW_ALL_DEPARTMENTS],
    allowUnassigned: false,
  },
  {
    name: 'Accounts',
    href: '/accounts',
    icon: Users,
    anyPermission: [Permission.VIEW_ACCOUNTS, Permission.VIEW_ALL_ACCOUNTS],
    allowUnassigned: false,
  },
  // Profile removed from main nav - accessible via dropdown menu
]

export function ClientNavigation() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [visibleItems, setVisibleItems] = useState<NavigationItem[]>(
    navigationItems.filter((item: any) => item.allowUnassigned === true)
  )
  const [permissionsChecked, setPermissionsChecked] = useState(false)
  const [hasAdminAccess, setHasAdminAccess] = useState(false)
  const { userProfile, signOut, loading } = useAuth()
  const pathname = usePathname()

  // Handle hydration
  useEffect(() => {
    setIsMounted(true)
  }, [])

  const handleSignOut = async () => {
    try {
      await signOut()
      // Redirect to home page after logout
      window.location.href = '/'
    } catch (error: unknown) {
      console.error('Error signing out:', error)
    }
  }

  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map((word: any) => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getUserDepartments = () => {
    if (!userProfile?.user_roles) return []
    try {
      // Use a Map to deduplicate departments by ID
      const deptMap = new Map<string, { id: string; name: string }>();

      userProfile.user_roles.forEach((ur: any) => {
        const dept = ur.roles?.departments;
        if (dept?.id && !deptMap.has(dept.id)) {
          deptMap.set(dept.id, {
            id: dept.id,
            name: dept.name
          });
        }
      });

      return Array.from(deptMap.values());
    } catch (error: unknown) {
      console.error('Error getting user departments:', error)
      return []
    }
  }

  // Check permissions for navigation items
  useEffect(() => {
    if (!isMounted || loading || !userProfile) {
      setVisibleItems(navigationItems.filter((item: any) => item.allowUnassigned === true))
      setPermissionsChecked(false)
      setHasAdminAccess(false)
      return
    }

    async function filterItems() {
      setPermissionsChecked(false)

      const isActuallyUnassigned = isUnassigned(userProfile)
      const userIsSuperadmin = isSuperadmin(userProfile)

      console.log('🔍 ClientNavigation Debug:', {
        userEmail: (userProfile as any)?.email,
        userId: (userProfile as any)?.id,
        isActuallyUnassigned,
        userIsSuperadmin,
      })

      // Superadmin sees everything including admin
      if (userIsSuperadmin) {
        setVisibleItems(navigationItems)
        setHasAdminAccess(true)
        setPermissionsChecked(true)
        return
      }

      // Unassigned users ONLY see items with allowUnassigned === true
      if (isActuallyUnassigned) {
        const allowedItems = navigationItems.filter((item: any) => item.allowUnassigned === true)
        console.log('✅ ClientNavigation: Unassigned user - showing only Welcome')
        setVisibleItems(allowedItems)
        setHasAdminAccess(false)
        setPermissionsChecked(true)
        return
      }

      // Check permissions for each item
      const filtered: NavigationItem[] = []
      
      for (const item of navigationItems) {
        // Items with no permission requirement should not be shown unless explicitly allowed
        if (!item.permission && (!item.anyPermission || item.anyPermission.length === 0)) {
          if (item.allowUnassigned === true) {
            filtered.push(item)
          }
          continue
        }

        // Check single permission
        if (item.permission) {
          const hasPerm = await hasPermission(userProfile, item.permission)
          if (hasPerm) {
            filtered.push(item)
            continue
          }
        }

        // Check any of multiple permissions
        if (item.anyPermission && item.anyPermission.length > 0) {
          let hasAnyPerm = false
          for (const perm of item.anyPermission) {
            const hasPerm = await hasPermission(userProfile, perm)
            if (hasPerm) {
              hasAnyPerm = true
              break
            }
          }
          if (hasAnyPerm) {
            filtered.push(item)
          }
        }
      }

      // Ensure Welcome is always included if no other items are visible
      if (filtered.length === 0) {
        const welcomeItem = navigationItems.find((item: any) => item.allowUnassigned === true)
        if (welcomeItem) {
          filtered.push(welcomeItem)
        }
      }

      // Check if user has any admin-level permissions
      const adminPermissions = [
        Permission.MANAGE_USER_ROLES,
        Permission.MANAGE_USERS_IN_ACCOUNTS,
        Permission.MANAGE_USERS_IN_DEPARTMENTS,
        Permission.MANAGE_USERS,
        Permission.MANAGE_DEPARTMENTS,
        Permission.MANAGE_ACCOUNTS,
        Permission.VIEW_ALL_ANALYTICS,
        Permission.MANAGE_WORKFLOWS,
        Permission.MANAGE_ALL_WORKFLOWS,
      ]

      let userHasAdminAccess = false
      for (const perm of adminPermissions) {
        if (await hasPermission(userProfile, perm)) {
          userHasAdminAccess = true
          break
        }
      }

      console.log('✅ ClientNavigation filter complete:', {
        userId: (userProfile as any)?.id,
        visibleItems: filtered.map((i: any) => i.name),
        filteredCount: filtered.length,
        hasAdminAccess: userHasAdminAccess
      })

      setVisibleItems(filtered)
      setHasAdminAccess(userHasAdminAccess)
      setPermissionsChecked(true)
    }

    filterItems().catch((err: any) => {
      console.error('Error filtering ClientNavigation items:', err)
      setVisibleItems(navigationItems.filter((item: any) => item.allowUnassigned === true))
      setPermissionsChecked(true)
    })
  }, [isMounted, loading, userProfile])

  // Show loading state during hydration
  if (!isMounted) {
    return (
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo - use same as mounted state */}
            <div className="flex items-center">
              <Link href="/welcome" className="flex items-center">
                <div className="h-12 relative" style={{ width: 'auto' }}>
                  <Image
                    src="/logo-optimized.svg"
                    alt="MovaLab Logo"
                    width={310}
                    height={120}
                    className="object-contain h-12 w-auto"
                    priority
                  />
                </div>
              </Link>
            </div>
            {/* Loading placeholder */}
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
      </nav>
    )
  }

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link
              href={userProfile?.user_roles && userProfile.user_roles.length > 0 ? "/dashboard" : "/welcome"}
              className="flex items-center"
            >
              <div className="h-12 relative" style={{ width: 'auto' }}>
                <Image
                  src="/logo-optimized.svg"
                  alt="MovaLab Logo"
                  width={310}
                  height={120}
                  className="object-contain h-12 w-auto"
                  priority
                />
              </div>
            </Link>
          </div>

              {/* Desktop Navigation */}
              <div className="hidden lg:flex items-center space-x-4">
                {(!isMounted || loading || !userProfile || !permissionsChecked) ? (
                  // Show loading state
                  navigationItems.filter((item: any) => item.allowUnassigned === true).map((item: NavigationItem) => {
                    const Icon = item.icon
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-gray-600"
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.name}</span>
                      </Link>
                    )
                  })
                ) : (
                  visibleItems.slice(0, 6).map((item: NavigationItem) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href ||
                      (item.href !== '/dashboard' && pathname.startsWith(item.href))

                    // Special handling for Department dropdown
                    if (item.name === 'Department') {
                      const userDepartments = getUserDepartments()
                      return (
                        <DropdownMenu key={item.name}>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              className={cn(
                                'flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
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
                              userDepartments.map((dept:any) => (
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
                      )
                    }

                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={cn(
                          'flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.name}</span>
                      </Link>
                    )
                  })
                )}
                
                {/* Admin dropdown for users with admin access */}
                {userProfile && hasAdminAccess && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className={cn(
                          'flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                          pathname.startsWith('/admin')
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        )}
                      >
                        <Settings className="w-4 h-4" />
                        <span>Admin</span>
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      <DropdownMenuLabel>Administration</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="flex items-center">
                          <Settings className="mr-2 h-4 w-4" />
                          <span>Admin Dashboard</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/admin/workflows" className="flex items-center">
                          <GitBranch className="mr-2 h-4 w-4" />
                          <span>Workflows</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/admin/roles" className="flex items-center">
                          <Shield className="mr-2 h-4 w-4" />
                          <span>Role Management</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/admin/time-tracking" className="flex items-center">
                          <Clock className="mr-2 h-4 w-4" />
                          <span>Time Tracking</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/analytics" className="flex items-center">
                          <BarChart3 className="mr-2 h-4 w-4" />
                          <span>Analytics</span>
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {/* Medium screen navigation (shows fewer items) */}
              <div className="hidden md:flex lg:hidden items-center space-x-3">
                {(!isMounted || loading || !userProfile || !permissionsChecked) ? (
                  // Show loading state
                  navigationItems.filter((item: any) => item.allowUnassigned === true).map((item: NavigationItem) => {
                    const Icon = item.icon
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className="flex items-center space-x-1 px-2 py-2 rounded-md text-sm font-medium text-gray-600"
                      >
                        <Icon className="w-4 h-4" />
                        <span className="hidden sm:inline">{item.name}</span>
                      </Link>
                    )
                  })
                ) : (
                  visibleItems.slice(0, 4).map((item: NavigationItem) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href ||
                      (item.href !== '/dashboard' && pathname.startsWith(item.href))

                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={cn(
                          'flex items-center space-x-1 px-2 py-2 rounded-md text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="hidden sm:inline">{item.name}</span>
                      </Link>
                    )
                  })
                )}
                
                {/* More items dropdown for medium screens - only show if there are items */}
                {visibleItems.length > 4 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="flex items-center space-x-1 px-2 py-2 text-sm font-medium">
                        <Menu className="w-4 h-4" />
                        <span className="hidden sm:inline">More</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {visibleItems.slice(4).map((item: NavigationItem) => {
                        const Icon = item.icon
                        return (
                          <DropdownMenuItem key={item.name} asChild>
                            <Link href={item.href} className="flex items-center">
                              <Icon className="mr-2 h-4 w-4" />
                              <span>{item.name}</span>
                            </Link>
                          </DropdownMenuItem>
                        )
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            {userProfile && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={(userProfile as any).image || ''} alt={(userProfile as any).name} />
                      <AvatarFallback className="bg-blue-100 text-blue-700">
                        {getUserInitials((userProfile as any).name)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{(userProfile as any).name}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {(userProfile as any).email}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {userProfile.user_roles?.map((ur: any) => ur.roles.name).join(', ') || 'No roles'}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="flex items-center">
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile & Settings</span>
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
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => { setIsMobileMenuOpen(!isMobileMenuOpen); }}
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

            {/* Mobile Navigation */}
            {isMobileMenuOpen && (
              <div className="md:hidden">
                <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t">
                  <div className="grid grid-cols-2 gap-2">
                    {(!isMounted || loading || !userProfile || !permissionsChecked) ? (
                      // Show loading state
                      navigationItems.filter((item: any) => item.allowUnassigned === true).map((item: NavigationItem) => {
                        const Icon = item.icon
                        return (
                          <Link
                            key={item.name}
                            href={item.href}
                            className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-gray-600"
                            onClick={() => { setIsMobileMenuOpen(false); }}
                          >
                            <Icon className="w-4 h-4" />
                            <span>{item.name}</span>
                          </Link>
                        )
                      })
                    ) : (
                      visibleItems.slice(0, 6).map((item: NavigationItem) => {
                        const Icon = item.icon
                        const isActive = pathname === item.href ||
                          (item.href !== '/dashboard' && pathname.startsWith(item.href))

                      // Special handling for Department dropdown in mobile
                      if (item.name === 'Department') {
                        const userDepartments = getUserDepartments()
                        return (
                          <div key={item.name} className="col-span-2 space-y-1">
                            <Link
                              href={item.href}
                              className={cn(
                                'flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                                isActive
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                              )}
                              onClick={() => setIsMobileMenuOpen(false)}
                            >
                              <Icon className="w-4 h-4" />
                              <span>{item.name}</span>
                            </Link>
                            {userDepartments.length > 0 && (
                              <div className="ml-4 space-y-1">
                                {userDepartments.map((dept:any) => (
                                  <Link
                                    key={dept.id}
                                    href={`/departments/${dept.id}`}
                                    className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                  >
                                    <Building2 className="w-4 h-4" />
                                    <span>{dept.name}</span>
                                  </Link>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      }

                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          className={cn(
                            'flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                            isActive
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                          )}
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{item.name}</span>
                        </Link>
                      )
                      })
                    )}
                  </div>
                  
                  {/* Additional items for mobile */}
                  {permissionsChecked && visibleItems.length > 6 && (
                    <div className="pt-2 border-t">
                      <p className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">More</p>
                      {visibleItems.slice(6).map((item: NavigationItem) => {
                        const Icon = item.icon
                        const isActive = pathname === item.href ||
                          (item.href !== '/dashboard' && pathname.startsWith(item.href))

                        return (
                          <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                              'flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                              isActive
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                            )}
                            onClick={() => setIsMobileMenuOpen(false)}
                          >
                            <Icon className="w-4 h-4" />
                            <span>{item.name}</span>
                          </Link>
                        )
                      })}
                    </div>
                  )}

                  {/* Admin section for mobile */}
                  {userProfile && hasAdminAccess && (
                    <div className="pt-2 border-t">
                      <p className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Admin</p>
                      <Link
                        href="/admin"
                        className={cn(
                          'flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                          pathname === '/admin'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        )}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <Settings className="w-4 h-4" />
                        <span>Admin Dashboard</span>
                      </Link>
                      <Link
                        href="/admin/workflows"
                        className={cn(
                          'flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                          pathname.startsWith('/admin/workflows')
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        )}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <GitBranch className="w-4 h-4" />
                        <span>Workflows</span>
                      </Link>
                      <Link
                        href="/admin/roles"
                        className={cn(
                          'flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                          pathname.startsWith('/admin/roles')
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        )}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <Shield className="w-4 h-4" />
                        <span>Role Management</span>
                      </Link>
                      <Link
                        href="/admin/time-tracking"
                        className={cn(
                          'flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                          pathname.startsWith('/admin/time-tracking')
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        )}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <Clock className="w-4 h-4" />
                        <span>Time Tracking</span>
                      </Link>
                      <Link
                        href="/analytics"
                        className={cn(
                          'flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                          pathname === '/analytics'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        )}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <BarChart3 className="w-4 h-4" />
                        <span>Analytics</span>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}
      </div>
    </nav>
  )
}

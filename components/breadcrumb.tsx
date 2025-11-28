'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { departmentClientService } from '@/lib/department-client-service'

interface BreadcrumbItem {
  label: string
  href?: string
  current?: boolean
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[]
  className?: string
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  const pathname = usePathname()
  const [departmentNames, setDepartmentNames] = useState<Map<string, string>>(new Map())

  // Check if a segment is a UUID (department ID, account ID, or project ID)
  const isUUID = (str: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    return uuidRegex.test(str)
  }

  // Fetch entity names for UUIDs
  useEffect(() => {
    const pathSegments = pathname.split('/').filter(Boolean)
    const fetchEntityNames = async () => {
      const names = new Map<string, string>()
      
      // Fetch department names if in department path
      if (pathname.includes('/departments/')) {
        const departmentIds = pathSegments.filter(segment => isUUID(segment))
        console.log('Breadcrumb: Processing department IDs:', departmentIds)
        for (const id of departmentIds) {
          try {
            console.log('Breadcrumb: Fetching department for ID:', id)
            const department = await departmentClientService.getDepartmentById(id)
            if (department) {
              names.set(id, department.name)
              console.log('Breadcrumb: Successfully fetched department:', department.name)
            } else {
              console.warn(`Department not found for ID: ${id}`)
            }
          } catch (error) {
            console.error(`Error fetching department ${id}:`, error)
            // Continue with other departments instead of failing completely
          }
        }
      }
      
      // Fetch project names if in project path
      if (pathname.includes('/projects/')) {
        const projectIndex = pathSegments.indexOf('projects')
        if (projectIndex !== -1 && projectIndex + 1 < pathSegments.length) {
          const projectId = pathSegments[projectIndex + 1]
          if (isUUID(projectId)) {
            // Fetch project name from database
            const { createClientSupabase } = await import('@/lib/supabase')
            const supabase = createClientSupabase()
            if (supabase) {
              const { data } = await supabase
                .from('projects')
                .select('name')
                .eq('id', projectId)
                .single()
              if (data) {
                names.set(projectId, data.name)
              }
            }
          }
        }
      }
      
      // Fetch account names if in account path
      if (pathname.includes('/accounts/')) {
        const accountIndex = pathSegments.indexOf('accounts')
        if (accountIndex !== -1 && accountIndex + 1 < pathSegments.length) {
          const accountId = pathSegments[accountIndex + 1]
          if (isUUID(accountId)) {
            // Fetch account name from database
            const { createClientSupabase } = await import('@/lib/supabase')
            const supabase = createClientSupabase()
            if (supabase) {
              const { data } = await supabase
                .from('accounts')
                .select('name')
                .eq('id', accountId)
                .single()
              if (data) {
                names.set(accountId, data.name)
              }
            }
          }
        }
      }
      
      setDepartmentNames(names)
    }
    
    fetchEntityNames()
  }, [pathname])

  // Generate breadcrumb items from pathname if not provided
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    if (items) return items

    const pathSegments = pathname.split('/').filter(Boolean)
    const breadcrumbs: BreadcrumbItem[] = []

    // Always start with home/dashboard
    breadcrumbs.push({
      label: 'Dashboard',
      href: '/dashboard',
    })

    // Build breadcrumbs from path segments
    let currentPath = ''
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`
      
      // Skip if it's the dashboard segment (already added)
      if (segment === 'dashboard') return

      const isLast = index === pathSegments.length - 1
      let label: string

      // Check if this is a UUID and we have the name from database
      if (isUUID(segment) && departmentNames.has(segment)) {
        label = departmentNames.get(segment)!
      } else if (isUUID(segment)) {
        // If it's a UUID but we don't have the name yet, show loading or generic label
        label = 'Loading...'
      } else {
        label = segment
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
      }

      breadcrumbs.push({
        label,
        href: isLast ? undefined : currentPath,
        current: isLast,
      })
    })

    return breadcrumbs
  }

  const breadcrumbItems = generateBreadcrumbs()

  if (breadcrumbItems.length <= 1) {
    return null // Don't show breadcrumbs if only on dashboard
  }

  return (
    <nav className={cn('flex items-center space-x-1 text-sm text-gray-500', className)}>
      <Link
        href="/dashboard"
        className="flex items-center hover:text-gray-700 transition-colors"
      >
        <Home className="w-4 h-4" />
        <span className="sr-only">Home</span>
      </Link>
      
      {breadcrumbItems.slice(1).map((item, index) => (
        <div key={index} className="flex items-center space-x-1">
          <ChevronRight className="w-4 h-4 text-gray-400" />
          {item.current ? (
            <span className="font-medium text-gray-900">
              {item.label}
            </span>
          ) : item.href ? (
            <Link
              href={item.href}
              className="hover:text-gray-700 transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-gray-500">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  )
}

// Utility function to create breadcrumb items programmatically
export function createBreadcrumbs(
  basePath: string,
  segments: Array<{ label: string; href?: string }>
): BreadcrumbItem[] {
  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Dashboard', href: '/dashboard' }
  ]

  let currentPath = basePath
  segments.forEach((segment, index) => {
    if (segment.href) {
      currentPath = segment.href
    } else {
      currentPath += `/${segment.label.toLowerCase().replace(/\s+/g, '-')}`
    }

    const isLast = index === segments.length - 1
    breadcrumbs.push({
      label: segment.label,
      href: isLast ? undefined : currentPath,
      current: isLast,
    })
  })

  return breadcrumbs
}

'use client'

import { useAuth } from '@/lib/hooks/useAuth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function TestNavigationPage() {
  const { userProfile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!userProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Please log in to test navigation</p>
        </div>
      </div>
    )
  }

  const userRoles = userProfile.user_roles?.map(ur => ur.roles.name) || []
  const userDepartments = userProfile.user_roles
    ?.map(ur => ur.roles.departments?.name)
    .filter((name): name is string => name !== undefined && name !== null) || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Navigation Test Page</h1>
        <p className="text-gray-600">Test the role-based navigation system</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>User Profile</CardTitle>
            <CardDescription>Current user information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p><strong>Name:</strong> {userProfile.name}</p>
              <p><strong>Email:</strong> {userProfile.email}</p>
              <p><strong>Roles:</strong> {userRoles.join(', ') || 'None'}</p>
              <p><strong>Departments:</strong> {userDepartments.join(', ') || 'None'}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Navigation Visibility</CardTitle>
            <CardDescription>Which navigation items should be visible</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Dashboard</span>
                <span className="text-green-600">✓ Always visible</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Departments</span>
                <span className={userRoles.some(role => 
                  ['Executive', 'Director', 'Content Manager', 'Analytics Manager', 'Social Media Manager'].includes(role)
                ) ? 'text-green-600' : 'text-red-600'}>
                  {userRoles.some(role => 
                    ['Executive', 'Director', 'Content Manager', 'Analytics Manager', 'Social Media Manager'].includes(role)
                  ) ? '✓ Visible' : '✗ Hidden'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Accounts</span>
                <span className={userRoles.some(role => 
                  ['Executive', 'Director', 'Account Manager', 'Account Executive'].includes(role)
                ) ? 'text-green-600' : 'text-red-600'}>
                  {userRoles.some(role => 
                    ['Executive', 'Director', 'Account Manager', 'Account Executive'].includes(role)
                  ) ? '✓ Visible' : '✗ Hidden'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Analytics</span>
                <span className={userRoles.some(role => 
                  ['Executive', 'Director', 'Account Manager', 'Data Analyst', 'Analytics Manager'].includes(role)
                ) ? 'text-green-600' : 'text-red-600'}>
                  {userRoles.some(role => 
                    ['Executive', 'Director', 'Account Manager', 'Data Analyst', 'Analytics Manager'].includes(role)
                  ) ? '✓ Visible' : '✗ Hidden'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Profile</span>
                <span className="text-green-600">✓ Always visible</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Navigation Test Instructions</CardTitle>
          <CardDescription>How to test the role-based navigation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">1. Check Current Navigation</h4>
              <p className="text-sm text-gray-600">
                Look at the navigation bar above. You should only see navigation items that match your current roles.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">2. Test Role Changes</h4>
              <p className="text-sm text-gray-600">
                To test different role scenarios, you would need to:
              </p>
              <ul className="text-sm text-gray-600 mt-2 space-y-1">
                <li>• Log out and log in as a different user with different roles</li>
                <li>• Or modify your user roles in the Supabase database</li>
                <li>• The navigation should update automatically based on your roles</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">3. Test Mobile Navigation</h4>
              <p className="text-sm text-gray-600">
                Resize your browser window to mobile size and click the hamburger menu to test mobile navigation.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

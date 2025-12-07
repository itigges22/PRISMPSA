'use client'

import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from '@/components/ui/badge'
import { isAdminLevel, isUnassigned, isSuperadmin, hasPermission } from '@/lib/rbac'
import { Permission } from '@/lib/permissions'
import dynamic from 'next/dynamic'
import { 
  CheckCircle,
  Users,
  Building2,
  Mail,
  Phone,
  MapPin,
  ArrowRight
} from 'lucide-react'

// Dynamically import heavy components to reduce initial bundle size and improve load time
const ProjectUpdatesCard = dynamic(
  () => import('@/components/project-updates-card'),
  { 
    loading: () => (
      <Card className="w-full">
        <CardContent className="py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Loading updates...</p>
          </div>
        </CardContent>
      </Card>
    ),
    ssr: false
  }
)

const NewsletterCard = dynamic(
  () => import('@/components/newsletter-card'),
  { 
    loading: () => null, // Don't show loading for newsletter card
    ssr: false
  }
)

export default function WelcomePage() {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()

  // Calculate roles using new RBAC system
  // IMPORTANT: Only check if userProfile is loaded, otherwise default to false to prevent showing restricted content
  const userIsUnassigned = userProfile ? isUnassigned(userProfile) : false
  const isSuperadminUser = userProfile ? isSuperadmin(userProfile) : false
  const hasRoles = userProfile ? !userIsUnassigned : false
  const [canViewNewsletters, setCanViewNewsletters] = useState(false)

  // Check newsletter permission
  useEffect(() => {
    if (!userProfile) {
      setCanViewNewsletters(false)
      return
    }
    
    async function checkNewsletterPermission() {
      const canView = await hasPermission(userProfile, Permission.VIEW_NEWSLETTERS)
      setCanViewNewsletters(canView)
    }
    
    checkNewsletterPermission()
  }, [userProfile])

  // Debug logging
  useEffect(() => {
    if (userProfile) {
      const computedUnassigned = isUnassigned(userProfile);
      console.log('🔍 WelcomePage Debug:', {
        userEmail: userProfile.email,
        userRoles: userProfile.user_roles?.map(ur => ({
          name: ur.roles?.name,
          isSystem: ur.roles?.is_system_role,
          permissions: Object.keys(ur.roles?.permissions || {}).length
        })),
        computedUnassigned,
        userIsUnassigned,
        isSuperadminUser,
        hasRoles,
        userProfileRolesLength: userProfile.user_roles?.length || 0
      });
    }
  }, [userProfile]);

  // Check if all three status items are completed
  const isAccountCreated = !!user
  const isEmailVerified = !!user?.email_confirmed_at
  const isRoleAssigned = hasRoles
  const isSetupComplete = isAccountCreated && isEmailVerified && isRoleAssigned


  // All useEffect hooks must be at the top level
  useEffect(() => {
    if (!loading && !user) {
      console.log('WelcomePage: No user, redirecting to login')
      router.push('/login')
    }
  }, [user, loading, router])


  // Helper functions for project display



  // Removed automatic redirect - let users choose where to go
  // useEffect(() => {
  //   // Only redirect if user has roles but is NOT superadmin
  //   // Also ensure userProfile is loaded before making the decision
  //   if (hasRoles && !loading && userProfile && !isSuperadminUser) {
  //     console.log('WelcomePage: User has roles (not superadmin), redirecting to dashboard')
  //     router.push('/dashboard')
  //   } else if (hasRoles && !loading && userProfile && isSuperadminUser) {
  //     console.log('WelcomePage: User is superadmin, staying on welcome page')
  //   }
  // }, [hasRoles, loading, userProfile, isSuperadminUser, router])

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

  if (!user) {
    console.log('WelcomePage: No user detected, showing login prompt')
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to PRISM PSA</h1>
            <p className="text-gray-600">Please log in to access your account</p>
          </div>
          <div className="space-y-4">
            <Button 
              onClick={() => router.push('/login')}
              className="w-full max-w-xs"
            >
              Sign In
            </Button>
            <p className="text-sm text-gray-500">
              Don&apos;t have an account?{' '}
              <button 
                onClick={() => router.push('/signup')}
                className="text-blue-600 hover:text-blue-700 underline"
              >
                Sign up here
              </button>
            </p>
          </div>
        </div>
      </div>
    )
  }

  // For unassigned users, show minimal welcome page with only profile access
  // IMPORTANT: Check this BEFORE rendering anything else
  // Re-check isUnassigned here to ensure we have the latest value
  const isActuallyUnassigned = userProfile ? isUnassigned(userProfile) : false;
  
  // Early return for unassigned users - show minimal page
  if (!loading && userProfile && isActuallyUnassigned) {
    console.log('✅ Showing unassigned user version of welcome page');
    return (
      <div className="space-y-8 mt-8 px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-gray-900">
            {userProfile?.name ? `Hello ${userProfile.name}! Welcome Back!` : 'Welcome to PRISM PSA!'}
          </h1>
        </div>

        {/* Status Card */}
        <Card className="max-w-2xl mx-auto w-full">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <span>Account Status</span>
            </CardTitle>
            <CardDescription>Your account setup progress</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Account Created</span>
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Email Verified</span>
              {isEmailVerified ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <div className="text-sm text-yellow-600 font-medium">Pending</div>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Role Assignment</span>
              <div className="text-sm text-yellow-600 font-medium">Pending</div>
            </div>
          </CardContent>
        </Card>

        {/* Unassigned User Notice */}
        <Card className="max-w-2xl mx-auto w-full border-yellow-300 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-yellow-800">Role Assignment Pending</CardTitle>
            <CardDescription className="text-yellow-700">
              Your account is awaiting role assignment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-yellow-800">
              Welcome to PRISM! Your account has been created successfully, but you haven&apos;t been assigned a role yet.
              An administrator will review your account and assign you to the appropriate role and department.
            </p>
            <div className="p-4 bg-white rounded-md border border-yellow-200">
              <p className="text-sm font-medium text-yellow-900 mb-2">While you wait:</p>
              <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                <li>You can view and edit your profile</li>
                <li>Check back later for updates</li>
                <li>Contact an administrator if you need immediate access</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Action Button - Only Profile for unassigned users */}
        <div className="text-center space-y-4">
          <Button 
            onClick={() => router.push('/profile')}
            variant="outline"
            className="inline-flex items-center space-x-2"
          >
            <span>View Profile</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    )
  }

  // Removed automatic redirect - let users choose where to go
  // if (hasRoles && !isSuperadminUser) {
  //   return null // Will redirect to dashboard
  // }

  return (
    <div className="space-y-8 mt-8 px-4 sm:px-6 lg:px-8">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-gray-900">
          {userProfile?.name ? `Hello ${userProfile.name}! Welcome Back!` : 'Welcome to PRISM PSA!'}
        </h1>
      </div>

      {/* Status Card */}
      {!isSetupComplete && (
        <Card className="max-w-2xl mx-auto w-full">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <span>Account Status</span>
            </CardTitle>
            <CardDescription>Your account setup progress</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Account Created</span>
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Email Verified</span>
              {isEmailVerified ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <div className="text-sm text-yellow-600 font-medium">Pending</div>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Role Assignment</span>
              {hasRoles ? (
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm text-green-600 font-medium">
                    {isSuperadminUser ? 'Superadmin' : 'Assigned'}
                  </span>
                </div>
              ) : (
                <div className="text-sm text-yellow-600 font-medium">Pending</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}


      {/* Project Updates and Newsletters Section - Only for assigned users */}
      {isSetupComplete && !isActuallyUnassigned && (
        <div className="max-w-6xl mx-auto w-full">
          <div className={`flex flex-col ${canViewNewsletters ? 'lg:grid lg:grid-cols-2' : ''} gap-6`}>
            <div className="w-full">
              <ProjectUpdatesCard className="w-full" />
            </div>
            {canViewNewsletters && (
              <div className="w-full">
                <NewsletterCard canCreate={isSuperadminUser} className="w-full" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* What's Next Section - Only show if setup is not complete AND user is not unassigned */}
      {!isSetupComplete && !isActuallyUnassigned && (
        <div className="max-w-4xl mx-auto w-full">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
            What&apos;s Next?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <span>Role Assignment</span>
                </CardTitle>
                <CardDescription>Get assigned to your department and role</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  An administrator will assign you to the appropriate department and role based on your position at PRISM. 
                  Roles are created dynamically by administrators to match your team structure.
                </p>
                <div className="space-y-2 text-sm">
                  <p className="font-medium">What to Expect:</p>
                  <ul className="text-gray-600 space-y-1">
                    <li>• Custom role tailored to your responsibilities</li>
                    <li>• Specific permissions for your job function</li>
                    <li>• Access to relevant projects and accounts</li>
                    <li>• Department-specific tools and features</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Building2 className="w-5 h-5 text-green-600" />
                  <span>Department Access</span>
                </CardTitle>
                <CardDescription>Access your department&apos;s tools and projects</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Once assigned, you&apos;ll have access to department-specific features and projects.
                </p>
                <div className="space-y-2 text-sm">
                  <p className="font-medium">Department Features:</p>
                  <ul className="text-gray-600 space-y-1">
                    <li>• Department-specific project access</li>
                    <li>• Collaboration with team members</li>
                    <li>• Role-based permissions</li>
                    <li>• Custom workflows and tools</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Contact Information - Only for assigned users */}
      {!isActuallyUnassigned && (
        <div className="max-w-6xl mx-auto w-full">
          <Card>
          <CardHeader>
            <CardTitle>Need IT Support?</CardTitle>
            <CardDescription>Contact the PRISM team for assistance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-center space-x-3">
                <Mail className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="text-sm font-medium">Email Support</p>
                  <p className="text-sm text-gray-600">prismexec@gmail.com</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Phone className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="text-sm font-medium">Phone Support</p>
                  <p className="text-sm text-gray-600">(919)-793-3536</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <MapPin className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="text-sm font-medium">Office</p>
                  <p className="text-sm text-gray-600">880 W Campus Dr, Blacksburg, VA 24061</p>
                </div>
              </div>
            </div>
          </CardContent>
          </Card>
        </div>
      )}

      {/* Action Buttons */}
      <div className="text-center space-y-4">
        {isActuallyUnassigned ? (
          // Unassigned users can only go to profile
          <Button 
            onClick={() => router.push('/profile')}
            variant="outline"
            className="inline-flex items-center space-x-2"
          >
            <span>View Profile</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        ) : (
          // Assigned users can go to dashboard and profile
          <>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                onClick={() => router.push('/dashboard')}
                className="inline-flex items-center space-x-2"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button 
                onClick={() => router.push('/profile')}
                variant="outline"
                className="inline-flex items-center space-x-2"
              >
                <span>View Profile</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
            {hasRoles && (
              <p className="text-sm text-gray-500">
                You have been assigned roles and can access the dashboard
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

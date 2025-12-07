'use client'

import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Shield, UserPlus, UserMinus, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react'
import { isSuperadmin } from '@/lib/rbac'
import { assignSuperadminRoleByEmail, checkSuperadminRoleByEmail, removeSuperadminRoleByEmail } from '@/lib/superadmin-utils'
import { testDatabaseConnection } from '@/lib/test-database'

interface Message {
  type: 'success' | 'error' | 'info'
  text: string
}

export default function SuperadminSetupPage() {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (!loading && user && userProfile && !isSuperadmin(userProfile)) {
      console.log('SuperadminSetupPage: User is not superadmin, redirecting to welcome')
      router.push('/welcome')
    }
  }, [user, userProfile, loading, router])

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

  // If userProfile is still loading, show loading
  if (!userProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading profile...</p>
        </div>
      </div>
    )
  }

  if (!user || !isSuperadmin(userProfile)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don&apos;t have permission to access this page.</p>
        </div>
      </div>
    )
  }

  const handleAssignSuperadmin = async () => {
    if (!email.trim()) {
      setMessage({ type: 'error', text: 'Please enter an email address' })
      return
    }

    setIsLoading(true)
    setMessage(null)

    try {
      const result = await assignSuperadminRoleByEmail(email.trim())
      if (result.success) {
        setMessage({ type: 'success', text: result.message })
        setEmail('')
      } else {
        setMessage({ type: 'error', text: result.message })
      }
    } catch (error) {
      console.error('Error assigning superadmin role:', error)
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to assign superadmin role' 
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCheckStatus = async () => {
    if (!email.trim()) {
      setMessage({ type: 'error', text: 'Please enter an email address' })
      return
    }

    setIsLoading(true)
    setMessage(null)

    try {
      const result = await checkSuperadminRoleByEmail(email.trim())
      if (result.success) {
        setMessage({ type: 'info', text: result.message })
      } else {
        setMessage({ type: 'error', text: result.message })
      }
    } catch (error) {
      console.error('Error checking superadmin status:', error)
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to check superadmin status' 
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveSuperadmin = async () => {
    if (!email.trim()) {
      setMessage({ type: 'error', text: 'Please enter an email address' })
      return
    }

    setIsLoading(true)
    setMessage(null)

    try {
      const result = await removeSuperadminRoleByEmail(email.trim())
      if (result.success) {
        setMessage({ type: 'success', text: result.message })
        setEmail('')
      } else {
        setMessage({ type: 'error', text: result.message })
      }
    } catch (error) {
      console.error('Error removing superadmin role:', error)
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to remove superadmin role' 
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleTestDatabase = async () => {
    setIsLoading(true)
    setMessage(null)

    try {
      const result = await testDatabaseConnection()
      if (result.success) {
        setMessage({ type: 'success', text: 'Database connection successful! All systems operational.' })
      } else {
        setMessage({ type: 'error', text: result.error || 'Database test failed' })
      }
    } catch (error) {
      console.error('Error testing database:', error)
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to test database connection' 
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Superadmin Management</h1>
          <p className="text-gray-600 mt-2">Manage superadmin roles and permissions</p>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => { router.back(); }}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Admin
          </Button>
        </div>
      </div>

      {/* Assign Superadmin Role */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <UserPlus className="w-5 h-5" />
            <span>Assign Superadmin Role</span>
          </CardTitle>
          <CardDescription>
            Add superadmin privileges to an existing user by email address
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">User Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); }}
              disabled={isLoading}
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button 
              onClick={handleAssignSuperadmin}
              disabled={isLoading || !email.trim()}
              className="flex-1"
            >
              {isLoading ? 'Processing...' : 'Assign Superadmin Role'}
            </Button>
            <Button 
              onClick={handleCheckStatus}
              disabled={isLoading || !email.trim()}
              variant="outline"
              className="flex-1 sm:flex-none"
            >
              Check Status
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Remove Superadmin Role */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <UserMinus className="w-5 h-5" />
            <span>Remove Superadmin Role</span>
          </CardTitle>
          <CardDescription>
            Remove superadmin privileges from a user
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="remove-email">User Email</Label>
            <Input
              id="remove-email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <Button 
            onClick={handleRemoveSuperadmin}
            disabled={isLoading || !email.trim()}
            variant="destructive"
            className="w-full"
          >
            {isLoading ? 'Processing...' : 'Remove Superadmin Role'}
          </Button>
        </CardContent>
      </Card>

      {/* Database Test */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="w-5 h-5" />
            <span>Database Status</span>
          </CardTitle>
          <CardDescription>
            Test database connection and verify superadmin setup
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleTestDatabase}
            disabled={isLoading}
            variant="outline"
            className="w-full"
          >
            {isLoading ? 'Testing...' : 'Test Database Connection'}
          </Button>
        </CardContent>
      </Card>

      {/* Message Display */}
      {message && (
        <Card className={message.type === 'error' ? 'border-red-200 bg-red-50' : 
                         message.type === 'success' ? 'border-green-200 bg-green-50' : 
                         'border-blue-200 bg-blue-50'}>
          <CardContent className="pt-6">
            <div className="flex items-start space-x-2">
              {message.type === 'error' ? (
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              ) : message.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              ) : (
                <Shield className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              )}
              <p className={`text-sm font-medium break-words ${
                message.type === 'error' ? 'text-red-800' : 
                message.type === 'success' ? 'text-green-800' : 
                'text-blue-800'
              }`}>
                {message.text}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

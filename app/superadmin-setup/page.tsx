'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, CheckCircle, Shield, Database, User } from 'lucide-react'
import { assignSuperadminRole, checkSuperadminRole, removeSuperadminRole } from '@/lib/superadmin-utils'
import { testDatabaseConnection } from '@/lib/test-database'

export default function SuperadminSetupPage() {
  const { user, userProfile, refreshProfile } = useAuth()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)
  const [isSuperadmin, setIsSuperadmin] = useState<boolean | null>(null)

  const handleAssignSuperadmin = async () => {
    try {
      setIsLoading(true)
      setMessage(null)
      
      const result = await assignSuperadminRole()
      
      if (result.success) {
        setMessage({ type: 'success', text: result.message })
        await refreshProfile() // Refresh profile to get updated roles
        setIsSuperadmin(true)
        
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          router.push('/dashboard')
        }, 2000)
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

  const handleRemoveSuperadmin = async () => {
    try {
      setIsLoading(true)
      setMessage(null)
      
      const result = await removeSuperadminRole()
      
      if (result.success) {
        setMessage({ type: 'success', text: result.message })
        await refreshProfile() // Refresh profile to get updated roles
        setIsSuperadmin(false)
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

  const handleCheckStatus = async () => {
    try {
      setIsLoading(true)
      setMessage(null)
      
      const isSuperadminStatus = await checkSuperadminRole()
      setIsSuperadmin(isSuperadminStatus)
      
      setMessage({ 
        type: 'info', 
        text: isSuperadminStatus ? 'You have superadmin role' : 'You do not have superadmin role' 
      })
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

  const handleTestDatabase = async () => {
    try {
      setIsLoading(true)
      setMessage(null)
      
      const result = await testDatabaseConnection()
      
      if (result.success) {
        setMessage({ 
          type: 'success', 
          text: `Database test successful! Found ${result.data?.departments?.length || 0} departments, system dept: ${result.data?.systemDepartment ? 'Yes' : 'No'}, superadmin role: ${result.data?.superadminRole ? 'Yes' : 'No'}` 
        })
      } else {
        setMessage({ 
          type: 'error', 
          text: `Database test failed: ${result.error}` 
        })
      }
    } catch (error) {
      console.error('Error testing database:', error)
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to test database' 
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">Superadmin Setup</h1>
        <p className="text-gray-600 mt-2">
          Assign superadmin role to gain full access to all system features
        </p>
      </div>

      {/* Current User Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="w-5 h-5" />
            <span>Current User</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p><strong>Name:</strong> {userProfile?.name || 'N/A'}</p>
            <p><strong>Email:</strong> {userProfile?.email || user.email}</p>
            <p><strong>User ID:</strong> {user.id}</p>
            <p><strong>Current Roles:</strong> {userProfile?.user_roles?.map(ur => ur.roles.name).join(', ') || 'None'}</p>
          </div>
        </CardContent>
      </Card>

      {/* Status Check */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="w-5 h-5" />
            <span>Superadmin Status</span>
          </CardTitle>
          <CardDescription>Check your current superadmin status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <Button 
              onClick={handleCheckStatus} 
              disabled={isLoading}
              variant="outline"
            >
              Check Status
            </Button>
            
            <Button 
              onClick={handleTestDatabase} 
              disabled={isLoading}
              variant="outline"
            >
              Test Database
            </Button>
            {isSuperadmin !== null && (
              <div className="flex items-center space-x-2">
                {isSuperadmin ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-green-600 font-medium">You have superadmin role</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                    <span className="text-yellow-600 font-medium">You do not have superadmin role</span>
                  </>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Role Assignment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="w-5 h-5" />
            <span>Role Assignment</span>
          </CardTitle>
          <CardDescription>Assign or remove superadmin role</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button 
              onClick={handleAssignSuperadmin} 
              disabled={isLoading || isSuperadmin === true}
              className="w-full"
            >
              {isLoading ? 'Processing...' : 'Assign Superadmin Role'}
            </Button>
            
            <Button 
              onClick={handleRemoveSuperadmin} 
              disabled={isLoading || isSuperadmin === false}
              variant="outline"
              className="w-full"
            >
              {isLoading ? 'Processing...' : 'Remove Superadmin Role'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Message Display */}
      {message && (
        <Card>
          <CardContent className="pt-6">
            <div className={`flex items-center space-x-3 p-4 rounded-md ${
              message.type === 'success' ? 'bg-green-50 border border-green-200' :
              message.type === 'error' ? 'bg-red-50 border border-red-200' :
              'bg-blue-50 border border-blue-200'
            }`}>
              <div className="flex-shrink-0">
                {message.type === 'success' ? (
                  <CheckCircle className="h-5 w-5 text-green-400" />
                ) : message.type === 'error' ? (
                  <AlertCircle className="h-5 w-5 text-red-400" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-blue-400" />
                )}
              </div>
              <div>
                <p className={`text-sm font-medium ${
                  message.type === 'success' ? 'text-green-800' :
                  message.type === 'error' ? 'text-red-800' :
                  'text-blue-800'
                }`}>
                  {message.text}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Instructions</CardTitle>
          <CardDescription>How to use this superadmin setup</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">Step 1: Check Status</h4>
            <p className="text-sm text-gray-600">Click &quot;Check Status&quot; to see if you already have superadmin role.</p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Step 2: Assign Role</h4>
            <p className="text-sm text-gray-600">Click &quot;Assign Superadmin Role&quot; to give yourself full system access.</p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Step 3: Access All Features</h4>
            <p className="text-sm text-gray-600">Once assigned, you&apos;ll have access to all pages, navigation items, and debugging tools.</p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Step 4: Remove When Done</h4>
            <p className="text-sm text-gray-600">Click &quot;Remove Superadmin Role&quot; when you&apos;re done debugging to return to normal access.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

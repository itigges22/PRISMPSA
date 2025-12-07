'use client'

import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { User, Mail, Building2, Shield, Save, Edit3, AlertCircle, Lock, Bell, Palette } from 'lucide-react'
import { updateUserProfile, updatePassword } from '@/lib/auth'
import { RoleGuard } from '@/components/role-guard'
import { Permission } from '@/lib/permissions'

export default function ProfilePage() {
  const { user, userProfile, loading, refreshProfile } = useAuth()
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [canViewProfile, setCanViewProfile] = useState(true)
  const [canEditProfile, setCanEditProfile] = useState(true)
  const [permissionsLoading, setPermissionsLoading] = useState(true)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    bio: '',
    skills: [] as string[],
  })
  const [newSkill, setNewSkill] = useState('')
  
  // Password change state
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  // Check permissions
  useEffect(() => {
    if (loading || !userProfile) {
      setPermissionsLoading(true)
      return
    }

    async function checkPermissions() {
      try {
        // Everyone can view and edit their own profile, regardless of role status
        // This ensures unassigned users can still access their profile
        setCanViewProfile(true)
        setCanEditProfile(true)
      } catch (error) {
        console.error('Error checking permissions:', error)
        setCanViewProfile(true)
        setCanEditProfile(true)
      } finally {
        setPermissionsLoading(false)
      }
    }

    void checkPermissions()
  }, [userProfile, loading, router])

  useEffect(() => {
    if (userProfile) {
      setFormData({
        name: userProfile.name || '',
        email: userProfile.email || '',
        bio: userProfile.bio || '',
        skills: userProfile.skills || [],
      })
    }
  }, [userProfile])

  if (loading || permissionsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user || !userProfile || !canViewProfile) {
    return null // Will redirect to login or welcome
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      setSaveError(null)
      setSaveSuccess(false)
      
      console.log('Saving profile:', formData)
      
      // Update the profile in the database
      await updateUserProfile({
        name: formData.name,
        bio: formData.bio,
        skills: formData.skills,
      })
      
      // Refresh the profile data
      await refreshProfile()
      
      setSaveSuccess(true)
      setIsEditing(false)
      
      // Clear success message after 3 seconds
      setTimeout(() => { setSaveSuccess(false); }, 3000)
      
    } catch (error) {
      console.error('Error saving profile:', error)
      setSaveError(error instanceof Error ? error.message : 'Failed to save profile')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddSkill = () => {
    if (newSkill.trim() && !formData.skills.includes(newSkill.trim())) {
      setFormData(prev => ({
        ...prev,
        skills: [...prev.skills, newSkill.trim()]
      }))
      setNewSkill('')
    }
  }

  const handleRemoveSkill = (skillToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter(skill => skill !== skillToRemove)
    }))
  }

  const handlePasswordChange = async () => {
    try {
      setIsSaving(true)
      setPasswordError(null)
      setPasswordSuccess(false)
      
      // Validate passwords match
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        setPasswordError('New passwords do not match')
        return
      }
      
      // Validate password length
      if (passwordData.newPassword.length < 6) {
        setPasswordError('New password must be at least 6 characters long')
        return
      }
      
      // Update password
      await updatePassword(passwordData.newPassword)
      
      setPasswordSuccess(true)
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
      setIsChangingPassword(false)
      
      // Clear success message after 3 seconds
      setTimeout(() => { setPasswordSuccess(false); }, 3000)
      
    } catch (error) {
      console.error('Error changing password:', error)
      setPasswordError(error instanceof Error ? error.message : 'Failed to change password')
    } finally {
      setIsSaving(false)
    }
  }

  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <RoleGuard requirePermission={Permission.VIEW_OWN_PROFILE} allowUnassigned={true}>
      <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
        <p className="text-gray-600">Manage your account information and preferences</p>
        <div className="mt-4">
          <Button
            onClick={() => { setIsEditing(!isEditing); }}
            variant={isEditing ? "outline" : "default"}
            disabled={isSaving}
          >
            {isEditing ? (
              <>
                <Edit3 className="w-4 h-4 mr-2" />
                Cancel
              </>
            ) : (
              <>
                <Edit3 className="w-4 h-4 mr-2" />
                Edit Profile
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {saveSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">
                Profile updated successfully!
              </p>
            </div>
          </div>
        </div>
      )}

      {saveError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">
                {saveError}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Overview */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Profile Overview</CardTitle>
              <CardDescription>Your basic information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center space-y-4">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={userProfile.image || ''} alt={userProfile.name} />
                  <AvatarFallback className="bg-blue-100 text-blue-700 text-xl">
                    {getUserInitials(userProfile.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center">
                  <h3 className="text-lg font-semibold">{userProfile.name}</h3>
                  <p className="text-sm text-gray-600">{userProfile.email}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium">Roles</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {userProfile.user_roles?.map((userRole, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      {userRole.roles.name}
                    </span>
                  )) || (
                    <span className="text-sm text-gray-500">No roles assigned</span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Building2 className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium">Departments</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {userProfile.user_roles?.map((userRole, index) => (
                    userRole.roles.departments && (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"
                      >
                        {userRole.roles.departments.name}
                      </span>
                    )
                  )) || (
                    <span className="text-sm text-gray-500">No departments assigned</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Profile Details */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Profile Details</CardTitle>
              <CardDescription>Update your personal information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => { setFormData(prev => ({ ...prev, name: e.target.value })); }}
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => { setFormData(prev => ({ ...prev, email: e.target.value })); }}
                    disabled={!isEditing}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => { setFormData(prev => ({ ...prev, bio: e.target.value })); }}
                  disabled={!isEditing}
                  placeholder="Tell us about yourself..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>Skills</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.skills.map((skill, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800"
                    >
                      {skill}
                      {isEditing && (
                        <button
                          onClick={() => { handleRemoveSkill(skill); }}
                          className="ml-2 text-gray-500 hover:text-red-500"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                </div>
                {isEditing && (
                  <div className="flex space-x-2">
                    <Input
                      value={newSkill}
                      onChange={(e) => { setNewSkill(e.target.value); }}
                      placeholder="Add a skill..."
                      onKeyPress={(e) => e.key === 'Enter' && handleAddSkill()}
                    />
                    <Button onClick={handleAddSkill} size="sm">
                      Add
                    </Button>
                  </div>
                )}
              </div>

              {isEditing && (
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false)
                      setSaveError(null)
                      setSaveSuccess(false)
                    }}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={isSaving}>
                    <Save className="w-4 h-4 mr-2" />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Your account details and settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <User className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="text-sm font-medium">User ID</p>
                  <p className="text-sm text-gray-600">{user.id}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Mail className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="text-sm font-medium">Email Verified</p>
                  <p className="text-sm text-gray-600">
                    {user.email_confirmed_at ? 'Yes' : 'No'}
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <Shield className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="text-sm font-medium">Account Created</p>
                  <p className="text-sm text-gray-600">
                    {new Date(user.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Building2 className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="text-sm font-medium">Last Sign In</p>
                  <p className="text-sm text-gray-600">
                    {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : 'Never'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Lock className="w-5 h-5" />
            <span>Security Settings</span>
          </CardTitle>
          <CardDescription>Manage your password and security preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Password Change Success/Error Messages */}
          {passwordSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-800">
                    Password updated successfully!
                  </p>
                </div>
              </div>
            </div>
          )}

          {passwordError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-red-800">
                    {passwordError}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium">Password</h4>
                <p className="text-sm text-gray-600">Change your account password</p>
              </div>
              <Button
                variant="outline"
                onClick={() => { setIsChangingPassword(!isChangingPassword); }}
                disabled={isSaving}
              >
                {isChangingPassword ? 'Cancel' : 'Change Password'}
              </Button>
            </div>

            {isChangingPassword && (
              <div className="space-y-4 border-t pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => { setPasswordData(prev => ({ ...prev, newPassword: e.target.value })); }}
                      placeholder="Enter new password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => { setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value })); }}
                      placeholder="Confirm new password"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsChangingPassword(false)
                      setPasswordError(null)
                      setPasswordSuccess(false)
                      setPasswordData({
                        currentPassword: '',
                        newPassword: '',
                        confirmPassword: '',
                      })
                    }}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handlePasswordChange} disabled={isSaving}>
                    <Lock className="w-4 h-4 mr-2" />
                    {isSaving ? 'Updating...' : 'Update Password'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Palette className="w-5 h-5" />
            <span>Preferences</span>
          </CardTitle>
          <CardDescription>Customize your experience</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium">Notifications</h4>
                <p className="text-sm text-gray-600">Manage your notification preferences</p>
              </div>
              <Button variant="outline" disabled>
                <Bell className="w-4 h-4 mr-2" />
                Coming Soon
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </RoleGuard>
  )
}

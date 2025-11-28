'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { Button } from "@/components/ui/button"
import { LoginForm } from "@/components/login-form"

export default function Home() {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      // User is authenticated, check if they have roles
      const hasRoles = userProfile?.user_roles && userProfile.user_roles.length > 0
      if (hasRoles) {
        router.push('/dashboard')
      } else {
        router.push('/welcome')
      }
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

  if (user && userProfile) {
    // User is authenticated, show loading while redirecting
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Redirecting...</p>
        </div>
      </div>
    )
  }

  // User is not authenticated, show login form
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome to PRISM PSA
          </h1>
          <p className="text-gray-600">
            Professional Service Automation Platform
          </p>
        </div>
        
        <LoginForm />
      </div>
    </div>
  )
}

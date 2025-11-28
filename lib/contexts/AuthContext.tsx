'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { createClientSupabase } from '../supabase'
import { getCurrentUserProfile, signOut } from '../auth'
import { UserWithRoles } from '../rbac'

interface AuthContextType {
  user: User | null
  userProfile: UserWithRoles | null
  loading: boolean
  error: string | null
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserWithRoles | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClientSupabase()
    if (!supabase) {
      setLoading(false)
      return
    }

    let currentProfileRequest: Promise<UserWithRoles | null> | null = null
    let isMounted = true

    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (!isMounted) return

        if (error) {
          console.error('Error getting session:', error)
          setError(error.message)
          setLoading(false)
          return
        }

        if (session?.user) {
          setUser(session.user)

          const initialProfileRequest = getCurrentUserProfile()
          currentProfileRequest = initialProfileRequest
          initialProfileRequest
            .then(profile => {
              if (isMounted && currentProfileRequest === initialProfileRequest) {
                setUserProfile(profile)
                setLoading(false)
              }
            })
            .catch(error => {
              if (isMounted) {
                console.error('Error loading initial user profile:', error)
                setUserProfile(null)
                setLoading(false)
              }
            })
        } else {
          setUser(null)
          setUserProfile(null)
          setLoading(false)
        }
      } catch (error) {
        if (isMounted) {
          console.error('Error in getInitialSession:', error)
          setError('Failed to load user session')
          setUser(null)
          setUserProfile(null)
          setLoading(false)
        }
      }
    }

    getInitialSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: string, session: any) => {
        if (!isMounted) return

        if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && userProfile) {
          return
        }

        if (event === 'INITIAL_SESSION') {
          return
        }

        currentProfileRequest = null

        if (event === 'TOKEN_REFRESHED' && session?.user) {
          setUser(session.user)
          return
        }

        if (event === 'SIGNED_OUT') {
          setUser(null)
          setUserProfile(null)
          setLoading(false)
          return
        }

        if (session?.user) {
          setUser(session.user)
          setLoading(true)

          const profileRequest = getCurrentUserProfile()
          currentProfileRequest = profileRequest

          profileRequest
            .then(profile => {
              if (isMounted && currentProfileRequest === profileRequest) {
                setUserProfile(profile)
                setLoading(false)
              }
            })
            .catch(error => {
              if (isMounted && currentProfileRequest === profileRequest) {
                console.error('Error loading user profile:', error)
                setUserProfile(null)
                setLoading(false)
              }
            })
        } else {
          setUser(currentUser => {
            if (currentUser) {
              supabase.auth.refreshSession()
                .then(({ data: { session: refreshedSession }, error: refreshError }: { data: { session: any }, error: any }) => {
                  if (refreshError || !refreshedSession) {
                    setUser(null)
                    setUserProfile(null)
                    setLoading(false)
                  } else {
                    setUser(refreshedSession.user)
                    setLoading(false)
                  }
                })
                .catch((refreshErr: any) => {
                  console.error('Error refreshing session:', refreshErr)
                  setUser(null)
                  setUserProfile(null)
                  setLoading(false)
                })
              return currentUser
            } else {
              setUserProfile(null)
              setLoading(false)
              return null
            }
          })
        }
      }
    )

    return () => {
      isMounted = false
      currentProfileRequest = null
      subscription.unsubscribe()
    }
  }, [])

  const handleSignOut = async () => {
    try {
      setLoading(true)
      await signOut()
      setUser(null)
      setUserProfile(null)
    } catch (error) {
      console.error('Error signing out:', error)
      setError('Failed to sign out')
    } finally {
      setLoading(false)
    }
  }

  const refreshProfile = async () => {
    try {
      setLoading(true)
      const profile = await getCurrentUserProfile()
      setUserProfile(profile)
    } catch (error) {
      console.error('Error refreshing profile:', error)
      setError('Failed to refresh profile')
    } finally {
      setLoading(false)
    }
  }

  const value = {
    user,
    userProfile,
    loading,
    error,
    signOut: handleSignOut,
    refreshProfile,
    isAuthenticated: !!user,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

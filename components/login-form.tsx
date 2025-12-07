'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { signInWithEmail, signUpWithEmail } from "@/lib/auth"

interface LoginFormProps extends React.ComponentProps<"div"> {
  mode?: 'login' | 'signup'
}

export function LoginForm({
  className,
  mode = 'login',
  ...props
}: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [isSignUp, setIsSignUp] = useState(mode === 'signup')
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') ?? '/'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setMessage('')

    try {
      if (isSignUp) {
        const result = await signUpWithEmail(email, password, name)
        if (result.user) {
          if (result.needsEmailConfirmation) {
            setMessage('Account created successfully! Please check your email to verify your account before logging in.')
          } else {
            setMessage('Account created successfully! Redirecting...')
            setTimeout(() => {
              window.location.href = redirectTo
            }, 1500)
          }
        }
      } else {
        const { user } = await signInWithEmail(email, password)
        if (user) {
          setMessage('Login successful! Redirecting...')
          // Use window.location.href for a full page reload to ensure auth state is properly updated
          setTimeout(() => {
            window.location.href = redirectTo
          }, 1500)
        }
      }
    } catch (error: any) {
      let errorMessage = 'An error occurred. Please try again.'
      
      // Handle specific Supabase auth errors with user-friendly messages
      if (error.message?.includes('User already registered') || error.message?.includes('already been registered')) {
        errorMessage = 'Email already in use. Please try logging in instead.'
      } else if (error.message?.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password. Please check your credentials and try again.'
      } else if (error.message?.includes('Email not confirmed')) {
        errorMessage = 'Please check your email and click the confirmation link before logging in.'
      } else if (error.message?.includes('Password should be at least')) {
        errorMessage = 'Password should be at least 6 characters long.'
      } else if (error.message?.includes('Invalid email')) {
        errorMessage = 'Please enter a valid email address.'
      } else if (error.message) {
        // For other known errors, use the error message
        errorMessage = error.message
      }
      
      // Only log unexpected errors, not user-friendly validation errors
      if (!error.message?.includes('User already registered') && 
          !error.message?.includes('Invalid login credentials') &&
          !error.message?.includes('Email not confirmed') &&
          !error.message?.includes('Password should be at least') &&
          !error.message?.includes('Invalid email')) {
        console.error('Unexpected auth error:', error)
      }
      
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>
            {isSignUp ? 'Create your account' : 'Login to your account'}
          </CardTitle>
          <CardDescription>
            {isSignUp 
              ? 'Enter your details below to create your account'
              : 'Enter your email below to login to your account'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              {isSignUp && (
                <Field>
                  <FieldLabel htmlFor="name">Full Name</FieldLabel>
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => { setName(e.target.value); }}
                    required
                    disabled={isLoading}
                  />
                </Field>
              )}
              
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); }}
                  required
                  disabled={isLoading}
                />
              </Field>
              
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  {!isSignUp && (
                    <a
                      href="/forgot-password"
                      className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                    >
                      Forgot your password?
                    </a>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); }}
                  required
                  disabled={isLoading}
                />
              </Field>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                  {error}
                </div>
              )}

              {message && (
                <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md">
                  {message}
                </div>
              )}
              
              <Field>
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Login')}
                </Button>
                
                <FieldDescription className="text-center">
                  {isSignUp ? (
                    <>
                      Already have an account?{' '}
                      <button
                        type="button"
                        onClick={() => { setIsSignUp(false); }}
                        className="underline-offset-4 hover:underline"
                        disabled={isLoading}
                      >
                        Sign in
                      </button>
                    </>
                  ) : (
                    <>
                      Don&apos;t have an account?{' '}
                      <button
                        type="button"
                        onClick={() => { setIsSignUp(true); }}
                        className="underline-offset-4 hover:underline"
                        disabled={isLoading}
                      >
                        Sign up
                      </button>
                    </>
                  )}
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

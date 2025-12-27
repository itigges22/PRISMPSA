'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Shield,
  CheckCircle,
  AlertCircle,
  Loader2,
  Lock,
  Database,
  Key,
  UserPlus,
} from 'lucide-react';
import Link from 'next/link';

interface SetupStatus {
  setupAvailable: boolean;
  hasSuperadmin: boolean;
  setupSecretConfigured: boolean;
  message: string;
}

// Wrapper component that uses useSearchParams
function SetupPageContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [setupSecret, setSetupSecret] = useState(searchParams.get('key') || '');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Check setup status
  useEffect(() => {
    async function checkStatus() {
      try {
        const response = await fetch('/api/setup');
        const data = await response.json();
        setSetupStatus(data);
      } catch (error) {
        console.error('Error checking setup status:', error);
        setMessage({ type: 'error', text: 'Failed to check setup status' });
      } finally {
        setLoading(false);
      }
    }

    checkStatus();
  }, []);

  const handleSetup = async () => {
    if (!setupSecret.trim()) {
      setMessage({ type: 'error', text: 'Please enter the setup secret key' });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setupSecret: setupSecret.trim() }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setMessage({
          type: 'success',
          text: data.message || 'You are now a superadmin! Redirecting...',
        });
        // Redirect to admin after a short delay
        setTimeout(() => {
          router.push('/admin');
        }, 2000);
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Setup failed. Please check your secret key.',
        });
      }
    } catch (error) {
      console.error('Error during setup:', error);
      setMessage({ type: 'error', text: 'Setup failed. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
          <p className="mt-2 text-sm text-gray-600">Checking setup status...</p>
        </div>
      </div>
    );
  }

  // Setup already completed
  if (setupStatus?.hasSuperadmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle>Setup Complete</CardTitle>
            <CardDescription>
              A superadmin has already been configured for this installation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600 text-center">
              If you need to access the admin panel, please contact your system administrator.
            </p>
            <div className="flex flex-col gap-2">
              <Button asChild>
                <Link href="/login">Go to Login</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/">Go to Home</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Setup secret not configured
  if (!setupStatus?.setupSecretConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-6 w-6 text-yellow-600" />
            </div>
            <CardTitle>Configuration Required</CardTitle>
            <CardDescription>
              The setup secret has not been configured.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">To complete setup:</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
                <li>Add <code className="bg-gray-200 px-1 rounded">SETUP_SECRET=your-secret-key</code> to your environment variables</li>
                <li>Restart your application</li>
                <li>Return to this page and enter your secret key</li>
              </ol>
            </div>
            <Button variant="outline" asChild className="w-full">
              <Link href="/">Go to Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User not logged in
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <UserPlus className="h-6 w-6 text-blue-600" />
            </div>
            <CardTitle>Create Your Account First</CardTitle>
            <CardDescription>
              You need to sign up for an account before becoming a superadmin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Setup Steps:</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
                <li>Run the SQL setup script in Supabase (if not done)</li>
                <li>Sign up for an account</li>
                <li>Return to this page with your setup secret</li>
              </ol>
            </div>
            <div className="flex flex-col gap-2">
              <Button asChild>
                <Link href={`/login?redirectTo=/setup${setupSecret ? `?key=${setupSecret}` : ''}`}>
                  Sign Up / Login
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Ready for setup
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Shield className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle>First-Time Setup</CardTitle>
          <CardDescription>
            Configure your superadmin account to get started.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Prerequisites */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-3">
            <h3 className="font-medium text-gray-900">Prerequisites:</h3>
            <div className="flex items-center gap-2 text-sm">
              <Database className="h-4 w-4 text-green-600" />
              <span className="text-gray-600">SQL schema setup script executed</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Key className="h-4 w-4 text-green-600" />
              <span className="text-gray-600">SETUP_SECRET configured</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <UserPlus className="h-4 w-4 text-green-600" />
              <span className="text-gray-600">Logged in as: {user.email}</span>
            </div>
          </div>

          {/* Setup Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="setupSecret">Setup Secret Key</Label>
              <Input
                id="setupSecret"
                type="password"
                placeholder="Enter your SETUP_SECRET"
                value={setupSecret}
                onChange={(e) => setSetupSecret(e.target.value)}
                disabled={submitting}
              />
              <p className="text-xs text-gray-500">
                This is the value of your SETUP_SECRET environment variable.
              </p>
            </div>

            <Button
              onClick={handleSetup}
              disabled={submitting || !setupSecret.trim()}
              className="w-full"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting up...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Become Superadmin
                </>
              )}
            </Button>
          </div>

          {/* Message Display */}
          {message && (
            <div
              className={`p-4 rounded-lg flex items-start gap-2 ${
                message.type === 'error'
                  ? 'bg-red-50 text-red-800'
                  : message.type === 'success'
                    ? 'bg-green-50 text-green-800'
                    : 'bg-blue-50 text-blue-800'
              }`}
            >
              {message.type === 'error' ? (
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              ) : message.type === 'success' ? (
                <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              ) : (
                <Lock className="h-5 w-5 flex-shrink-0 mt-0.5" />
              )}
              <p className="text-sm">{message.text}</p>
            </div>
          )}

          {/* Security Note */}
          <div className="border-t pt-4">
            <p className="text-xs text-gray-500 text-center">
              This page is only available when no superadmin exists.
              After setup, it will be permanently disabled.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Loading fallback for Suspense
function SetupPageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
        <p className="mt-2 text-sm text-gray-600">Loading setup...</p>
      </div>
    </div>
  );
}

// Main export wrapped in Suspense for useSearchParams
export default function SetupPage() {
  return (
    <Suspense fallback={<SetupPageLoading />}>
      <SetupPageContent />
    </Suspense>
  );
}

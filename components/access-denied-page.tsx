'use client';

import { AlertCircle, ArrowLeft, Home, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';

interface AccessDeniedPageProps {
  title?: string;
  description?: string;
  requiredPermission?: string;
  showBackButton?: boolean;
  showHomeButton?: boolean;
}

export function AccessDeniedPage({
  title = 'Access Denied',
  description = "You don't have permission to access this page.",
  requiredPermission,
  showBackButton = true,
  showHomeButton = true,
}: AccessDeniedPageProps) {
  const router = useRouter();

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <Shield className="h-8 w-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">{title}</CardTitle>
          <CardDescription className="text-gray-600">{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {requiredPermission && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Required Permission</p>
                  <p className="text-sm text-amber-700 font-mono">{requiredPermission}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            {showHomeButton && (
              <Button
                onClick={() => router.push('/dashboard')}
                className="w-full"
              >
                <Home className="h-4 w-4 mr-2" />
                Go to Dashboard
              </Button>
            )}
            {showBackButton && (
              <Button
                variant="outline"
                onClick={() => router.back()}
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
            )}
          </div>

          <p className="text-xs text-center text-gray-500 pt-2">
            If you believe this is an error, please contact your administrator.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DEMO_USERS, DemoUser } from '@/lib/demo-mode';
import { signInWithEmail } from '@/lib/auth';
import {
  User,
  Briefcase,
  Code,
  Palette,
  Users,
  Building2,
  Loader2,
  Shield,
} from 'lucide-react';

// Icon mapping for visual distinction
const roleIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  'Executive Director': Building2,
  'Account Manager': Briefcase,
  'Project Manager': Users,
  Admin: Shield,
  'Senior Designer': Palette,
  'Senior Developer': Code,
  Client: User,
};

export function DemoLoginForm() {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') ?? '/welcome';

  const handleDemoLogin = async (user: DemoUser) => {
    setIsLoading(user.email);
    setError('');
    setMessage('');

    try {
      const { user: authUser } = await signInWithEmail(user.email, user.password);
      if (authUser) {
        setMessage(`Logged in as ${user.name}! Redirecting...`);
        setTimeout(() => {
          window.location.href = redirectTo;
        }, 1000);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      setIsLoading(null);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Welcome to MovaLab Demo</CardTitle>
        <CardDescription className="text-base">
          Select a user role to explore the platform. Each role has different
          permissions and views.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Demo user grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {DEMO_USERS.map((user) => {
            const Icon = roleIcons[user.role] || User;
            const isCurrentLoading = isLoading === user.email;

            return (
              <Button
                key={user.email}
                variant="outline"
                className={`h-auto p-4 flex flex-col items-start text-left hover:border-primary transition-all ${
                  isCurrentLoading ? 'opacity-70' : ''
                }`}
                onClick={() => handleDemoLogin(user)}
                disabled={isLoading !== null}
              >
                <div className="flex items-center gap-3 w-full">
                  <div className={`p-2 rounded-lg ${user.color} text-white`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{user.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {user.role}
                    </div>
                  </div>
                  {isCurrentLoading && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                  {user.description}
                </p>
              </Button>
            );
          })}
        </div>

        {/* Error/success messages */}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md text-center">
            {error}
          </div>
        )}
        {message && (
          <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md text-center">
            {message}
          </div>
        )}

        {/* Demo mode notice */}
        <div className="text-center text-xs text-muted-foreground pt-4 border-t">
          <p>This is a demo environment. Changes may be reset periodically.</p>
          <p className="mt-1">
            All demo accounts use password:{' '}
            <code className="bg-muted px-1 rounded">Test1234!</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

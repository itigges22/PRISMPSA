'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { userApprovalService } from '@/lib/user-approval-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Clock, 
  Mail, 
  LogOut, 
  CheckCircle,
  AlertTriangle,
  Loader2,
  User,
  Calendar
} from 'lucide-react';
import { logger, userAction } from '@/lib/debug-logger';

export default function PendingApprovalPage() {
  const { user, userProfile, loading, signOut } = useAuth();
  const router = useRouter();
  
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [checkingApproval, setCheckingApproval] = useState(true);
  const [approvalRequested, setApprovalRequested] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    if (!userProfile) {
      return;
    }

    checkApprovalStatus();
  }, [user, userProfile, loading, router]);

  const checkApprovalStatus = async () => {
    if (!userProfile) return;

    try {
      setCheckingApproval(true);
      
      logger.debug('Checking user approval status', { 
        action: 'checkApprovalStatus', 
        userId: userProfile.id 
      });

      const approved = await userApprovalService.isUserApproved(userProfile.id);
      setIsApproved(approved);
      
      if (approved) {
        logger.info('User is approved, redirecting to dashboard', { 
          action: 'checkApprovalStatus', 
          userId: userProfile.id 
        });
        router.push('/dashboard');
      } else {
        logger.info('User is not approved, showing pending screen', { 
          action: 'checkApprovalStatus', 
          userId: userProfile.id 
        });
      }
    } catch (error) {
      logger.error('Error checking approval status', { 
        action: 'checkApprovalStatus', 
        userId: userProfile?.id 
      }, error as Error);
    } finally {
      setCheckingApproval(false);
    }
  };

  const handleRequestApproval = async () => {
    if (!userProfile) return;

    try {
      setApprovalRequested(true);
      
      logger.info('User requesting approval', { 
        action: 'handleRequestApproval', 
        userId: userProfile.id 
      });

      const success = await userApprovalService.requestApproval(userProfile.id);
      
      if (success) {
        userAction('approval_requested', userProfile.id, { action: 'handleRequestApproval' });
        logger.info('Approval request submitted successfully', { 
          action: 'handleRequestApproval', 
          userId: userProfile.id 
        });
      } else {
        logger.error('Failed to submit approval request', { 
          action: 'handleRequestApproval', 
          userId: userProfile.id 
        });
      }
    } catch (error) {
      logger.error('Error requesting approval', { 
        action: 'handleRequestApproval', 
        userId: userProfile.id 
      }, error as Error);
    } finally {
      setApprovalRequested(false);
    }
  };

  const handleSignOut = async () => {
    try {
      userAction('signed_out', userProfile?.id || '', { action: 'handleSignOut' });
      await signOut();
      router.push('/login');
    } catch (error) {
      logger.error('Error signing out', { action: 'handleSignOut' }, error as Error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading || checkingApproval) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Checking approval status...</p>
        </div>
      </div>
    );
  }

  if (isApproved === true) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-green-600 mb-2">Account Approved!</h1>
          <p className="text-muted-foreground mb-4">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-amber-100 rounded-full w-fit">
              <Clock className="h-8 w-8 text-amber-600" />
            </div>
            <CardTitle className="text-2xl text-amber-600">
              Account Pending Approval
            </CardTitle>
            <CardDescription className="text-lg">
              Your account is currently under review by our administrators.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* User Info */}
            {userProfile && (
              <div className="flex items-center gap-4 p-4 bg-muted/20 rounded-lg">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={userProfile.image || undefined} />
                  <AvatarFallback>
                    {userProfile.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="font-semibold">{userProfile.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>{userProfile.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <Calendar className="h-4 w-4" />
                    <span>Joined: {formatDate(userProfile.created_at)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Status Message */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-800">What happens next?</h4>
                  <ul className="text-sm text-amber-700 mt-2 space-y-1">
                    <li>• An administrator will review your account</li>
                    <li>• You'll receive an email notification when approved</li>
                    <li>• Once approved, you can access all features</li>
                    <li>• This process typically takes 1-2 business days</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">Need Help?</h4>
              <p className="text-sm text-blue-700">
                If you have questions or need to expedite your approval, please contact:
              </p>
              <div className="mt-2 text-sm text-blue-700">
                <p><strong>Email:</strong> admin@company.com</p>
                <p><strong>Phone:</strong> (555) 123-4567</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleRequestApproval}
                disabled={approvalRequested}
                className="flex items-center gap-2"
              >
                {approvalRequested ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <User className="h-4 w-4" />
                )}
                {approvalRequested ? 'Requesting...' : 'Request Approval'}
              </Button>
              
              <Button
                onClick={handleSignOut}
                variant="outline"
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>

            {/* Additional Info */}
            <div className="text-center text-sm text-muted-foreground">
              <p>
                You can check back later or contact support if you have any questions.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

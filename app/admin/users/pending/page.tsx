'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';
import { userApprovalService, PendingUser } from '@/lib/user-approval-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Users, 
  UserCheck, 
  UserX, 
  Clock, 
  Mail, 
  Calendar,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { logger, userAction, batchStart, batchComplete, batchError } from '@/lib/debug-logger';

export default function PendingUsersPage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  
  // State
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [processingUsers, setProcessingUsers] = useState<Set<string>>(new Set());
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total_pending: 0,
    total_approved: 0,
    total_rejected: 0,
    pending_by_date: {} as Record<string, number>,
  });

  // Check permissions and load data
  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    if (!userProfile) {
      return;
    }

    async function checkPermissions() {
      // Check if user has permission to approve users (via ASSIGN_USERS_TO_ROLES)
      const canApprove = await hasPermission(userProfile, Permission.ASSIGN_USERS_TO_ROLES);
      if (!canApprove) {
        router.push('/welcome');
        return;
      }

      loadPendingUsers();
      loadStats();
    }

    checkPermissions();
  }, [user, userProfile, loading, router]);

  const loadPendingUsers = async () => {
    try {
      setLoadingUsers(true);
      setError(null);
      
      logger.info('Loading pending users', { action: 'loadPendingUsers' });
      
      const users = await userApprovalService.getPendingUsers();
      setPendingUsers(users);
      
      logger.info(`Loaded ${users.length} pending users`, { 
        action: 'loadPendingUsers',
        count: users.length
      });
    } catch (err) {
      logger.error('Error loading pending users', { action: 'loadPendingUsers' }, err as Error);
      setError('Failed to load pending users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await userApprovalService.getApprovalStats();
      setStats(statsData);
      
      logger.info('Loaded approval stats', { 
        action: 'loadStats',
        ...statsData
      });
    } catch (err) {
      logger.error('Error loading approval stats', { action: 'loadStats' }, err as Error);
    }
  };

  const handleApproveUser = async (userId: string) => {
    if (!userProfile) return;

    try {
      setProcessingUsers(prev => new Set(prev).add(userId));
      
      logger.info('Approving user', { action: 'handleApproveUser', userId, approvedBy: userProfile.id });
      
      const success = await userApprovalService.approveUser(userId, userProfile.id, 'Approved via admin panel');
      
      if (success) {
        // Remove from pending list
        setPendingUsers(prev => prev.filter(user => user.id !== userId));
        setSelectedUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          return newSet;
        });
        
        // Reload stats
        await loadStats();
        
        userAction('approved', userId, { action: 'handleApproveUser', approvedBy: userProfile.id });
        logger.info('User approved successfully', { action: 'handleApproveUser', userId });
      } else {
        setError('Failed to approve user');
      }
    } catch (err) {
      logger.error('Error approving user', { action: 'handleApproveUser', userId }, err as Error);
      setError('Failed to approve user');
    } finally {
      setProcessingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const handleRejectUser = async (userId: string) => {
    if (!userProfile) return;

    try {
      setProcessingUsers(prev => new Set(prev).add(userId));
      
      logger.info('Rejecting user', { action: 'handleRejectUser', userId, rejectedBy: userProfile.id });
      
      const success = await userApprovalService.rejectUser(userId, userProfile.id, 'Rejected via admin panel');
      
      if (success) {
        // Remove from pending list
        setPendingUsers(prev => prev.filter(user => user.id !== userId));
        setSelectedUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          return newSet;
        });
        
        // Reload stats
        await loadStats();
        
        userAction('rejected', userId, { action: 'handleRejectUser', rejectedBy: userProfile.id });
        logger.info('User rejected successfully', { action: 'handleRejectUser', userId });
      } else {
        setError('Failed to reject user');
      }
    } catch (err) {
      logger.error('Error rejecting user', { action: 'handleRejectUser', userId }, err as Error);
      setError('Failed to reject user');
    } finally {
      setProcessingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const handleBulkApprove = async () => {
    if (!userProfile || selectedUsers.size === 0) return;

    try {
      const userIds = Array.from(selectedUsers);
      
      batchStart('bulk_approve', userIds.length, { action: 'handleBulkApprove', approvedBy: userProfile.id });
      
      logger.info('Starting bulk approval', { 
        action: 'handleBulkApprove', 
        count: userIds.length,
        approvedBy: userProfile.id
      });
      
      const results = await userApprovalService.bulkApproveUsers(
        userIds, 
        userProfile.id, 
        'Bulk approved via admin panel'
      );
      
      if (results.successful.length > 0) {
        // Remove successful approvals from pending list
        setPendingUsers(prev => prev.filter(user => !results.successful.includes(user.id)));
        setSelectedUsers(new Set());
        await loadStats();
        
        batchComplete('bulk_approve', results.successful.length, Date.now(), { 
          action: 'handleBulkApprove',
          successful: results.successful.length,
          failed: results.failed.length
        });
        
        logger.info('Bulk approval completed', { 
          action: 'handleBulkApprove',
          successful: results.successful.length,
          failed: results.failed.length
        });
      }
      
      if (results.failed.length > 0) {
        batchError('bulk_approve', new Error('Some users failed to approve'), { 
          action: 'handleBulkApprove',
          failedCount: results.failed.length
        });
        setError(`Failed to approve ${results.failed.length} users`);
      }
    } catch (err) {
      batchError('bulk_approve', err as Error, { action: 'handleBulkApprove' });
      logger.error('Error in bulk approval', { action: 'handleBulkApprove' }, err as Error);
      setError('Failed to approve users');
    }
  };

  const handleSelectUser = (userId: string) => {
    setSelectedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedUsers.size === pendingUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(pendingUsers.map(user => user.id)));
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading || loadingUsers) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading pending users...</p>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Access Denied
            </CardTitle>
            <CardDescription>
              You don&apos;t have permission to manage user approvals.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">User Approval</h1>
          <p className="text-muted-foreground">
            Review and approve new user registrations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={loadPendingUsers} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">{stats.total_pending}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats.total_approved}</p>
                <p className="text-sm text-muted-foreground">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{stats.total_rejected}</p>
                <p className="text-sm text-muted-foreground">Rejected</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{pendingUsers.length}</p>
                <p className="text-sm text-muted-foreground">Current</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk Actions */}
      {pendingUsers.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedUsers.size === pendingUsers.length && pendingUsers.length > 0}
                  onChange={handleSelectAll}
                  className="rounded"
                />
                <span className="text-sm font-medium">
                  Select All ({selectedUsers.size} selected)
                </span>
              </div>
              {selectedUsers.size > 0 && (
                <Button 
                  onClick={handleBulkApprove}
                  className="flex items-center gap-2"
                >
                  <UserCheck className="h-4 w-4" />
                  Approve Selected ({selectedUsers.size})
                </Button>
              )}
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Pending Users List */}
      {pendingUsers.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Pending Users</h3>
            <p className="text-muted-foreground">
              All users have been reviewed and approved.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingUsers.map((user) => (
            <Card key={user.id}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={user.image || undefined} />
                    <AvatarFallback>
                      {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-lg">{user.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">{user.email}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            Requested: {formatDate(user.approval_requested_at)}
                          </span>
                        </div>
                        
                        {user.bio && (
                          <p className="text-sm text-muted-foreground mt-2">{user.bio}</p>
                        )}
                        
                        {user.skills && user.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {user.skills.map((skill, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <input
                          type="checkbox"
                          checked={selectedUsers.has(user.id)}
                          onChange={() => handleSelectUser(user.id)}
                          className="rounded"
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-4">
                      <Button
                        onClick={() => handleApproveUser(user.id)}
                        disabled={processingUsers.has(user.id)}
                        className="flex items-center gap-2"
                        size="sm"
                      >
                        {processingUsers.has(user.id) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UserCheck className="h-4 w-4" />
                        )}
                        Approve
                      </Button>
                      
                      <Button
                        onClick={() => handleRejectUser(user.id)}
                        disabled={processingUsers.has(user.id)}
                        variant="destructive"
                        className="flex items-center gap-2"
                        size="sm"
                      >
                        {processingUsers.has(user.id) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UserX className="h-4 w-4" />
                        )}
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

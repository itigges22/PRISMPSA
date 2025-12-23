'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Users,
  UserPlus,
  ChevronDown,
  ChevronRight,
  X,
  Briefcase,
  UserCog,
  RefreshCw
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { UserWithRoles } from '@/lib/rbac-types';
import { Permission } from '@/lib/permissions';
import { hasPermission } from '@/lib/rbac';

interface AccountMember {
  id: string;
  user_id: string;
  account_id: string;
  created_at: string;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    roles: Array<{
      id: string;
      name: string;
      department: {
        id: string;
        name: string;
      } | null;
    }>;
  } | null;
}

interface AccountWithMembers {
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'inactive' | 'suspended';
  account_manager_id: string | null;
  account_manager?: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  } | null;
  members: AccountMember[];
  member_count: number;
}

interface AccountViewProps {
  searchQuery?: string;
  selectedAccount?: string;
  onAccountSelect?: (account: AccountWithMembers) => void;
  onUserAssign?: (userId: string, accountId: string) => void;
  isReadOnly?: boolean;
  userProfile?: UserWithRoles | null;
}

interface AccountCardProps {
  account: AccountWithMembers;
  searchQuery?: string;
  onAccountSelect?: (account: AccountWithMembers) => void;
  onUserAssign?: (userId: string, accountId: string) => void;
  isReadOnly?: boolean;
  userProfile?: UserWithRoles | null;
}

function AccountCard({
  account,
  searchQuery = '',
  onUserAssign,
  isReadOnly = false,
  userProfile,
}: AccountCardProps) {
  // Store expanded state in localStorage to persist across reloads
  const [expanded, setExpanded] = useState(() => {
    if (typeof window !== 'undefined' && account?.id) {
      const stored = localStorage.getItem(`account-card-expanded-${account.id}`);
      return stored === 'true';
    }
    return false;
  });
  const [allUsers, setAllUsers] = useState<Array<{
    id: string;
    name: string;
    email: string;
    image: string | null;
    user_roles?: Array<{
      id: string;
      roles: {
        id: string;
        name: string;
        department_id: string;
        departments?: {
          id: string;
          name: string;
        } | null;
      } | null;
    }>;
  }>>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [canViewTab, setCanViewTab] = useState(false);
  const [canAssignUsers, setCanAssignUsers] = useState(false);
  const [canRemoveUsers, setCanRemoveUsers] = useState(false);
  const [canManageAccountManager, setCanManageAccountManager] = useState(false);
  const [updatingManager, setUpdatingManager] = useState(false);
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  // Check permissions
  useEffect(() => {
    async function checkPermissions() {
      if (!userProfile) {
        setCanViewTab(false);
        setCanAssignUsers(false);
        setCanRemoveUsers(false);
        return;
      }

      try {
        // MANAGE_USERS_IN_ACCOUNTS consolidates VIEW_ACCOUNTS_TAB, ASSIGN_ACCOUNT_USERS, REMOVE_ACCOUNT_USERS
        const canManageAccountUsers = await hasPermission(userProfile, Permission.MANAGE_USERS_IN_ACCOUNTS);

        setCanViewTab(canManageAccountUsers);
        setCanAssignUsers(canManageAccountUsers);
        setCanRemoveUsers(canManageAccountUsers);
        setCanManageAccountManager(canManageAccountUsers);
      } catch (error: unknown) {
        console.error('Error checking permissions:', error);
        setCanViewTab(false);
        setCanAssignUsers(false);
        setCanRemoveUsers(false);
        setCanManageAccountManager(false);
      }
    }

    void checkPermissions();
  }, [userProfile]);

  // Filter account by search query
  const matchesSearch = !searchQuery || 
    account.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    account.description?.toLowerCase().includes(searchQuery.toLowerCase());

  if (!matchesSearch) return null;

  const handleToggle = () => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    // Persist expanded state
    if (typeof window !== 'undefined' && account?.id) {
      localStorage.setItem(`account-card-expanded-${account.id}`, String(newExpanded));
    }
    if (newExpanded && allUsers.length === 0) {
      void loadAllUsers();
    }
  };

  const loadAllUsers = async () => {
    try {
      setLoadingUsers(true);
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to load users');
      const data = await response.json();
      setAllUsers(data.users || []);
    } catch (error: unknown) {
      console.error('Error loading users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleAssignUser = async (userId: string) => {
    if (isReadOnly || !canAssignUsers) {
      toast.error('You do not have permission to assign users to accounts');
      return;
    }

    setAssigningUserId(userId);
    try {
      const response = await fetch(`/api/accounts/${account.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('API Error:', errorData);

        // Provide more specific error messages
        let errorMessage = errorData.error || 'Failed to assign user';
        if (errorData.details) {
          errorMessage += `: ${errorData.details}`;
        }

        // Check if it's a table doesn't exist error
        if (errorMessage.includes('does not exist') || errorMessage.includes('relation') || errorMessage.includes('account_members')) {
          errorMessage = 'The account_members table does not exist. Please create it in your database first.';
        }

        throw new Error(errorMessage);
      }

      toast.success('User assigned to account successfully');
      // Trigger parent reload - this will update the UI properly
      onUserAssign?.(userId, account.id);
    } catch (error: unknown) {
      console.error('Error assigning user:', error);
      const err = error as { message?: string };
      toast.error(err.message || 'Failed to assign user to account');
    } finally {
      setAssigningUserId(null);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (isReadOnly || !canRemoveUsers) {
      toast.error('You do not have permission to remove users from accounts');
      return;
    }

    if (!confirm('Are you sure you want to remove this user from the account?')) {
      return;
    }

    setRemovingUserId(userId);
    try {
      const response = await fetch(`/api/accounts/${account.id}/members/${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove user');
      }

      toast.success('User removed from account successfully');
      // Trigger parent reload - this will update the UI properly
      onUserAssign?.(userId, account.id);
    } catch (error: unknown) {
      console.error('Error removing user:', error);
      const err = error as { message?: string };
      toast.error(err.message || 'Failed to remove user from account');
    } finally {
      setRemovingUserId(null);
    }
  };

  const handleUpdateAccountManager = async (managerId: string) => {
    if (isReadOnly || !canManageAccountManager) {
      toast.error('You do not have permission to manage account managers');
      return;
    }

    setUpdatingManager(true);
    try {
      const response = await fetch(`/api/accounts/${account.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_manager_id: managerId === 'none' ? null : managerId
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update account manager');
      }

      toast.success('Account manager updated successfully');
      // Trigger parent reload - this will update the UI properly
      onUserAssign?.(managerId, account.id);
    } catch (error: unknown) {
      console.error('Error updating account manager:', error);
      const err = error as { message?: string };
      toast.error(err.message || 'Failed to update account manager');
    } finally {
      setUpdatingManager(false);
    }
  };

  // Get users not yet assigned to this account
  const assignedUserIds = new Set(account.members.map((m: any) => m.user_id));
  const availableUsers = allUsers.filter((u: any) => !assignedUserIds.has(u.id));

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'inactive':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'suspended':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-blue-500" />
          {account.name}
        </CardTitle>
        <CardDescription>{account.description ?? 'No description'}</CardDescription>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={getStatusColor(account.status)}>
            {account.status}
          </Badge>
          <Badge variant="outline">
            <Users className="h-3 w-3 mr-1" />
            {account.member_count} {account.member_count === 1 ? 'member' : 'members'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Account Manager Section */}
          {canManageAccountManager && !isReadOnly && (
            <div className="pb-3 border-b">
              <div className="flex items-center gap-2 mb-2">
                <UserCog className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Account Manager</span>
              </div>
              <Select
                value={account.account_manager_id ?? 'none'}
                onValueChange={handleUpdateAccountManager}
                disabled={updatingManager || loadingUsers}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={loadingUsers ? "Loading..." : "Select account manager"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Account Manager</SelectItem>
                  {allUsers.map((user:any) => {
                    const roles = user.user_roles?.map((ur: any) => ur.roles?.name).filter(Boolean).join(', ') ?? 'No Role';
                    return (
                      <SelectItem key={(user as any).id} value={(user as any).id}>
                        {roles} - {(user as any).name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {account.account_manager && (
                <div className="flex items-center gap-2 mt-2 p-2 bg-muted/30 rounded">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={account.account_manager.image ?? undefined} />
                    <AvatarFallback className="text-xs">
                      {account.account_manager.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{account.account_manager.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{account.account_manager.email}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Expandable Members List */}
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={handleToggle}
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4 mr-2" />
              ) : (
                <ChevronRight className="h-4 w-4 mr-2" />
              )}
              <Users className="h-4 w-4 mr-2" />
              View Members ({account.member_count})
            </Button>

            {expanded && (
              <div className="mt-3 space-y-2">
                {!canViewTab ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    You do not have permission to view account users
                  </p>
                ) : account.members.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No members assigned to this account
                  </p>
                ) : (
                  account.members.map((member:any) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded border"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage src={member.user?.image ?? undefined} />
                          <AvatarFallback>
                            {member.user?.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{member.user?.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{member.user?.email}</p>
                          {/* Show user roles */}
                          {member.user?.roles && member.user.roles.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {member.user.roles.map((role:any) => (
                                <Badge 
                                  key={role.id} 
                                  variant="secondary" 
                                  className="text-xs"
                                >
                                  {role.name}
                                  {role.department && (
                                    <span className="text-muted-foreground ml-1">
                                      ({role.department.name})
                                    </span>
                                  )}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {!isReadOnly && canRemoveUsers && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0"
                          onClick={() => handleRemoveUser(member.user_id)}
                          disabled={removingUserId === member.user_id || assigningUserId !== null}
                        >
                          {removingUserId === member.user_id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  ))
                )}

                {/* Add User Section */}
                {!isReadOnly && canAssignUsers && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm font-medium mb-2">Add Member</p>
                    {loadingUsers ? (
                      <div className="flex items-center justify-center py-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      </div>
                    ) : availableUsers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">All users are already assigned</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {availableUsers.map((user:any) => {
                          // Extract roles from user_roles array
                          const roles = (user.user_roles as Array<Record<string, unknown>> | undefined)
                            ?.map((ur: any) => ur.roles as Record<string, unknown>)
                            .filter((r): r is Record<string, unknown> => r !== null) || [];
                          
                          return (
                            <div
                              key={(user as any).id}
                              className="flex items-center justify-between p-2 bg-background rounded border hover:bg-muted/50"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Avatar className="h-6 w-6 shrink-0">
                                  <AvatarImage src={(user as any).image ?? undefined} />
                                  <AvatarFallback className="text-xs">
                                    {(user as any).name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm truncate">{(user as any).name}</p>
                                  <p className="text-xs text-muted-foreground truncate">{(user as any).email}</p>
                                  {/* Show user roles */}
                                  {roles.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {roles.map((role: any) => (
                                        <Badge
                                          key={role.id as string}
                                          variant="secondary"
                                          className="text-xs"
                                        >
                                          {String(role.name)}
                                          {(role.departments as Record<string, unknown> | null | undefined) && (
                                            <span className="text-muted-foreground ml-1">
                                              ({String((role.departments as Record<string, unknown>).name)})
                                            </span>
                                          )}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs shrink-0"
                                onClick={() => handleAssignUser((user as any).id)}
                                disabled={assigningUserId === (user as any).id || removingUserId !== null}
                              >
                                {assigningUserId === (user as any).id ? (
                                  <>
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary mr-1"></div>
                                    Adding...
                                  </>
                                ) : (
                                  <>
                                    <UserPlus className="h-3 w-3 mr-1" />
                                    Add
                                  </>
                                )}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AccountView({
  searchQuery = '',
  selectedAccount,
  onAccountSelect,
  onUserAssign,
  isReadOnly = false,
  userProfile,
}: AccountViewProps) {
  const [accounts, setAccounts] = useState<AccountWithMembers[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      
      console.log('🏢 Loading accounts and members...');
      
      const response = await fetch('/api/accounts/members');
      
      if (!response.ok) {
        const error = await response.text().catch(() => 'Unknown error');
        console.error('❌ API Error:', error);
        throw new Error('Failed to load data');
      }
      
      const data = await response.json();
      console.log('📊 Accounts data:', data);
      
      setAccounts(data.accounts || []);
    } catch (error: unknown) {
      console.error('💥 Error loading accounts:', error);
      toast.error('Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleAccountSelect = (account: AccountWithMembers) => {
    onAccountSelect?.(account);
  };

  const handleUserAssign = (userId: string, accountId: string) => {
    onUserAssign?.(userId, accountId);
    // Reload accounts after assignment to update the UI
    void loadAccounts();
  };

  // Filter accounts by selected account
  const filteredAccounts = (selectedAccount && selectedAccount !== 'all')
    ? accounts.filter((acc: any) => acc.id === selectedAccount)
    : accounts;
  
  console.log('🔍 Filtering accounts:', {
    selectedAccount,
    totalAccounts: accounts.length,
    filteredAccounts: filteredAccounts.length
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading accounts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Accounts</h2>
          <p className="text-muted-foreground">
            View accounts and their assigned members with roles
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadAccounts()}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Badge variant="outline">
            {accounts.length} accounts
          </Badge>
          <Badge variant="outline">
            {accounts.reduce((sum, acc) => sum + acc.member_count, 0)} total members
          </Badge>
        </div>
      </div>

      {filteredAccounts.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Accounts Found</h3>
              <p className="text-muted-foreground">
                {selectedAccount 
                  ? 'No accounts match the selected filter'
                  : 'No accounts have been created yet'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {filteredAccounts.map((account:any) => (
            <AccountCard
              key={account.id}
              account={account}
              searchQuery={searchQuery}
              onAccountSelect={handleAccountSelect}
              onUserAssign={handleUserAssign}
              isReadOnly={isReadOnly}
              userProfile={userProfile}
            />
          ))}
        </div>
      )}
    </div>
  );
}


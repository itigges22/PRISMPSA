'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Users, 
  Building2, 
  UserPlus, 
  ChevronDown,
  ChevronRight,
  X,
  Briefcase
} from 'lucide-react';
import { toast } from 'sonner';

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
  members: AccountMember[];
  member_count: number;
}

interface AccountViewProps {
  searchQuery?: string;
  selectedAccount?: string;
  onAccountSelect?: (account: any) => void;
  onUserAssign?: (userId: string, accountId: string) => void;
  isReadOnly?: boolean;
}

interface AccountCardProps {
  account: AccountWithMembers;
  searchQuery?: string;
  onAccountSelect?: (account: any) => void;
  onUserAssign?: (userId: string, accountId: string) => void;
  isReadOnly?: boolean;
}

function AccountCard({
  account,
  searchQuery = '',
  onAccountSelect,
  onUserAssign,
  isReadOnly = false,
}: AccountCardProps) {
  const [expanded, setExpanded] = useState(false);
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

  // Filter account by search query
  const matchesSearch = !searchQuery || 
    account.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    account.description?.toLowerCase().includes(searchQuery.toLowerCase());

  if (!matchesSearch) return null;

  const handleToggle = () => {
    setExpanded(!expanded);
    if (!expanded && allUsers.length === 0) {
      loadAllUsers();
    }
  };

  const loadAllUsers = async () => {
    try {
      setLoadingUsers(true);
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to load users');
      const data = await response.json();
      setAllUsers(data.users || []);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleAssignUser = async (userId: string) => {
    if (isReadOnly) return;
    
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
      onUserAssign?.(userId, account.id);
      // Reload the page data would be handled by parent component
      window.location.reload(); // Simple reload for now
    } catch (error: any) {
      console.error('Error assigning user:', error);
      toast.error(error.message || 'Failed to assign user to account');
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (isReadOnly) return;
    
    if (!confirm('Are you sure you want to remove this user from the account?')) {
      return;
    }

    try {
      const response = await fetch(`/api/accounts/${account.id}/members/${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove user');
      }

      toast.success('User removed from account successfully');
      window.location.reload(); // Simple reload for now
    } catch (error: any) {
      console.error('Error removing user:', error);
      toast.error(error.message || 'Failed to remove user from account');
    }
  };

  // Get users not yet assigned to this account
  const assignedUserIds = new Set(account.members.map(m => m.user_id));
  const availableUsers = allUsers.filter(u => !assignedUserIds.has(u.id));

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
        <CardDescription>{account.description || 'No description'}</CardDescription>
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
                {account.members.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No members assigned to this account
                  </p>
                ) : (
                  account.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded border"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage src={member.user?.image || undefined} />
                          <AvatarFallback>
                            {member.user?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{member.user?.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{member.user?.email}</p>
                          {/* Show user roles */}
                          {member.user?.roles && member.user.roles.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {member.user.roles.map((role) => (
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
                      {!isReadOnly && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0"
                          onClick={() => handleRemoveUser(member.user_id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))
                )}

                {/* Add User Section */}
                {!isReadOnly && (
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
                        {availableUsers.map((user) => {
                          // Extract roles from user_roles array
                          const roles = user.user_roles
                            ?.map((ur: any) => ur.roles)
                            .filter((r: any) => r !== null) || [];
                          
                          return (
                            <div
                              key={user.id}
                              className="flex items-center justify-between p-2 bg-background rounded border hover:bg-muted/50"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Avatar className="h-6 w-6 shrink-0">
                                  <AvatarImage src={user.image || undefined} />
                                  <AvatarFallback className="text-xs">
                                    {user.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm truncate">{user.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                                  {/* Show user roles */}
                                  {roles.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {roles.map((role: any) => (
                                        <Badge 
                                          key={role.id} 
                                          variant="secondary" 
                                          className="text-xs"
                                        >
                                          {role.name}
                                          {role.departments && (
                                            <span className="text-muted-foreground ml-1">
                                              ({role.departments.name})
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
                                onClick={() => handleAssignUser(user.id)}
                              >
                                <UserPlus className="h-3 w-3 mr-1" />
                                Add
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
}: AccountViewProps) {
  const [accounts, setAccounts] = useState<AccountWithMembers[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAccounts();
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
    } catch (error) {
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
    // Reload accounts after assignment
    loadAccounts();
  };

  // Filter accounts by selected account
  const filteredAccounts = (selectedAccount && selectedAccount !== 'all')
    ? accounts.filter(acc => acc.id === selectedAccount)
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
          {filteredAccounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              searchQuery={searchQuery}
              onAccountSelect={handleAccountSelect}
              onUserAssign={handleUserAssign}
              isReadOnly={isReadOnly}
            />
          ))}
        </div>
      )}
    </div>
  );
}


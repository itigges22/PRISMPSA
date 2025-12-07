'use client';

// Account list component for displaying user-accessible accounts
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Users, 
  Plus, 
  Building2, 
  Calendar, 
  ArrowRight,
  Mail,
  Phone
} from 'lucide-react';
import { Account } from '@/lib/account-service';
import { UserWithRoles, isSuperadmin, hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';
import { hasAccountAccess } from '@/lib/permission-checker';
import { format } from 'date-fns';
import { AccountCreateDialog } from '@/components/account-create-dialog';

interface AccountListProps {
  accounts: Account[];
  userProfile: UserWithRoles;
  onAccountCreated?: () => void;
}

export function AccountList({ accounts, userProfile, onAccountCreated }: AccountListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [canCreateAccount, setCanCreateAccount] = useState(false);
  const [visibleAccounts, setVisibleAccounts] = useState<Account[]>([]);

  // Check permissions and filter accounts
  useEffect(() => {
    if (!userProfile) {
      setVisibleAccounts([]);
      return;
    }
    
    async function checkPermissionsAndFilter() {
      const canCreate = await hasPermission(userProfile, Permission.CREATE_ACCOUNT);
      setCanCreateAccount(canCreate);
      
      // Filter accounts based on permissions
      const filtered: Account[] = [];
      const hasViewAllAccounts = await hasPermission(userProfile, Permission.VIEW_ALL_ACCOUNTS);
      const hasViewAccounts = await hasPermission(userProfile, Permission.VIEW_ACCOUNTS);
      
      for (const account of accounts) {
        // If user has VIEW_ALL_ACCOUNTS, they can see all accounts
        if (hasViewAllAccounts) {
          filtered.push(account);
          continue;
        }
        
        // If user has VIEW_ACCOUNTS, check if they have access to this specific account
        if (hasViewAccounts) {
          // Check if user has account access (via project assignments)
          const hasAccess = await hasAccountAccess(userProfile.id, account.id);
          if (hasAccess) {
            filtered.push(account);
          }
        }
      }
      
      setVisibleAccounts(filtered);
    }
    
    void checkPermissionsAndFilter();
  }, [userProfile, accounts]);

  const filteredAccounts = visibleAccounts.filter(account =>
    account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.primary_contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'suspended':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };


  if (visibleAccounts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>No Accounts Found</span>
          </CardTitle>
          <CardDescription>
            {isSuperadmin(userProfile)
              ? "Get started by creating your first client account"
              : userProfile.user_roles?.some(ur => 
                  ['Executive', 'Director', 'Account Manager', 'Account Executive'].includes(ur.roles.name)
                ) 
                ? "No accounts have been created yet. Contact a superadmin to create accounts."
                : "You don't have access to any accounts yet. Contact your administrator to be assigned to an account."
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {isSuperadmin(userProfile)
                ? "No accounts yet"
                : userProfile.user_roles?.some(ur => 
                    ['Executive', 'Director', 'Account Manager', 'Account Executive'].includes(ur.roles.name)
                  ) 
                  ? "No accounts available"
                  : "No account access"
              }
            </h3>
            <p className="text-gray-600 mb-6">
              {isSuperadmin(userProfile)
                ? "Create your first client account to start managing projects and relationships."
                : userProfile.user_roles?.some(ur => 
                    ['Executive', 'Director', 'Account Manager', 'Account Executive'].includes(ur.roles.name)
                  ) 
                  ? "No accounts have been created yet. Contact a superadmin to create accounts."
                  : "You need to be assigned to an account to view and manage projects. Please contact your administrator."
              }
            </p>
            {canCreateAccount && (
              <AccountCreateDialog 
                userProfile={userProfile} 
                onAccountCreated={onAccountCreated}
              />
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters - Responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <input
              type="text"
              placeholder="Search accounts..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); }}
              className="w-full pl-10 pr-4 py-2 border border-input rounded-md focus:ring-2 focus:ring-ring focus:border-transparent bg-background text-foreground"
            />
            <Users className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        {canCreateAccount && (
          <div className="w-full sm:w-auto">
            <AccountCreateDialog 
              userProfile={userProfile} 
              onAccountCreated={onAccountCreated}
            />
          </div>
        )}
      </div>

      {/* Accounts Grid - Responsive */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredAccounts.map((account) => (
          <Card key={account.id} className="hover:shadow-lg transition-shadow h-full">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg font-bold text-foreground truncate">{account.name}</CardTitle>
                  <CardDescription className="mt-1 text-sm text-muted-foreground line-clamp-2">
                    {account.description || 'No description provided'}
                  </CardDescription>
                </div>
                <Badge className={`${getStatusColor(account.status)} text-xs whitespace-nowrap shrink-0`}>
                  {account.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Contact Information */}
              {account.primary_contact_name && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">Primary Contact</span>
                  </div>
                  <div className="ml-6 space-y-1">
                    <p className="text-sm font-medium text-foreground">{account.primary_contact_name}</p>
                    {account.primary_contact_email && (
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground break-all">
                          {account.primary_contact_email}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}


              {/* Created Date */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Created</span>
                </div>
                <div className="ml-6">
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(account.created_at), 'MMM dd, yyyy')}
                  </p>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4 border-t">
                <Link href={`/accounts/${account.id}`}>
                  <Button variant="outline" className="w-full">
                    View Details
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* No Results */}
      {filteredAccounts.length === 0 && searchTerm && (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No accounts found</h3>
            <p className="text-gray-600 mb-4">
              No accounts match your search for "{searchTerm}"
            </p>
            <Button variant="outline" onClick={() => { setSearchTerm(''); }}>
              Clear Search
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

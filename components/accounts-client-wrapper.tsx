'use client';

import { useState } from 'react';
import { AccountList } from '@/components/account-list';
import { AccountCreateDialog } from '@/components/account-create-dialog';
import { Account } from '@/lib/account-service';
import { UserWithRoles, isSuperadmin } from '@/lib/rbac';

interface AccountsClientWrapperProps {
  initialAccounts: Account[];
  userProfile: UserWithRoles;
  isAdminLevel: boolean;
}

export function AccountsClientWrapper({ 
  initialAccounts, 
  userProfile, 
  isAdminLevel 
}: AccountsClientWrapperProps) {
  const [accounts, setAccounts] = useState(initialAccounts);

  const handleAccountCreated = () => {
    // Refresh the page to get updated accounts
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
          <div className="space-y-3">
            <h1 className="text-4xl font-bold text-foreground">Accounts</h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {isAdminLevel 
                ? "Manage client accounts and their associated projects"
                : "View accounts you have access to and their associated projects"
              }
            </p>
          </div>
        </div>
      </div>

      <AccountList 
        accounts={accounts} 
        userProfile={userProfile} 
        onAccountCreated={handleAccountCreated}
      />
    </div>
  );
}

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, FolderKanban, ExternalLink } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import useSWR from 'swr';

interface AccountData {
  id: string;
  name: string;
  status: string;
  projectCount: number;
  activeProjectCount: number;
  lastActivity?: string;
}

interface AccountsResponse {
  success: boolean;
  data: {
    accounts: AccountData[];
    totalAccounts: number;
  };
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

function getStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400';
    case 'inactive':
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
    case 'suspended':
      return 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

export function MyAccountsWidget() {
  const { data, error, isLoading } = useSWR<AccountsResponse>(
    '/api/dashboard/my-accounts',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Building2 className="h-4 w-4 text-emerald-500" />
            My Accounts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Failed to load account data</p>
        </CardContent>
      </Card>
    );
  }

  const accounts = data?.data?.accounts || [];
  const totalAccounts = data?.data?.totalAccounts || 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-emerald-500" />
            My Accounts
            {totalAccounts > 0 && (
              <span className="text-xs font-normal text-muted-foreground">
                ({totalAccounts})
              </span>
            )}
          </div>
          <Link href="/accounts" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            View All <ExternalLink className="h-3 w-3" />
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {accounts.length === 0 ? (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No accounts assigned
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.slice(0, 5).map((account) => (
              <Link
                key={account.id}
                href={`/accounts/${account.id}`}
                className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors group border border-transparent hover:border-border"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate group-hover:text-primary">
                      {account.name}
                    </p>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded capitalize ${getStatusColor(account.status)}`}>
                      {account.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <FolderKanban className="h-3 w-3" />
                      {account.projectCount} project{account.projectCount !== 1 ? 's' : ''}
                    </span>
                    {account.activeProjectCount > 0 && (
                      <span className="text-xs text-blue-600 dark:text-blue-400">
                        {account.activeProjectCount} active
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}

            {accounts.length > 5 && (
              <Link
                href="/accounts"
                className="block text-center text-xs text-muted-foreground hover:text-foreground py-2"
              >
                +{accounts.length - 5} more accounts
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default MyAccountsWidget;

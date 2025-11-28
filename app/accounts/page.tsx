import { getCurrentUserProfileServer } from '@/lib/auth-server';
import { accountService } from '@/lib/account-service';
import { AccountsClientWrapper } from '@/components/accounts-client-wrapper';
import { isSuperadmin, canManageAccounts } from '@/lib/rbac';
import { createServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
  // Get current user and check permissions
  const userProfile = await getCurrentUserProfileServer();
  if (!userProfile) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
          <p className="text-gray-600 mt-2">Please log in to view accounts.</p>
        </div>
      </div>
    );
  }

  // Check if user has admin-level access
  const isAdminLevel = isSuperadmin(userProfile) || await canManageAccounts(userProfile);

  // Create server-side Supabase client with auth
  const supabase = await createServerSupabase();

  // Fetch accounts based on user role - pass supabase client for proper auth
  const accounts = isAdminLevel 
    ? await accountService.getAllAccounts(supabase)
    : await accountService.getUserAccounts(userProfile.id, supabase);

  return (
    <div className="min-h-screen bg-background">
      <div className="space-y-4 sm:space-y-6">
        <AccountsClientWrapper 
          initialAccounts={accounts}
          userProfile={userProfile}
          isAdminLevel={isAdminLevel}
        />
      </div>
    </div>
  );
}


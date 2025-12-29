import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { checkPermissionHybrid, isSuperadmin } from '@/lib/permission-checker';
import { Permission } from '@/lib/permissions';
import { UserWithRoles } from '@/lib/rbac';
import { AccessDeniedPage } from '@/components/access-denied-page';
import WorkflowsClient from './workflows-client';

async function getUserWithRoles(): Promise<UserWithRoles | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select(`
      *,
      user_roles!user_roles_user_id_fkey(
        id,
        role_id,
        assigned_at,
        assigned_by,
        roles!user_roles_role_id_fkey(
          *,
          departments!roles_department_id_fkey(*)
        )
      )
    `)
    .eq('id', user.id)
    .single();

  return userProfile as unknown as UserWithRoles;
}

export default async function WorkflowsPage() {
  const userProfile = await getUserWithRoles();

  // Not authenticated - redirect to login
  if (!userProfile) {
    redirect('/login?redirectTo=/admin/workflows');
  }

  // Check permission server-side
  const supabase = await createServerSupabase();
  const canManageWorkflows = isSuperadmin(userProfile) ||
    await checkPermissionHybrid(userProfile, Permission.MANAGE_WORKFLOWS, undefined, supabase);
  const canManageAllWorkflows = isSuperadmin(userProfile) ||
    await checkPermissionHybrid(userProfile, Permission.MANAGE_ALL_WORKFLOWS, undefined, supabase);

  // No permission - show access denied
  if (!canManageWorkflows && !canManageAllWorkflows) {
    return (
      <AccessDeniedPage
        title="Access Denied"
        description="You don't have permission to access the Workflow Builder."
        requiredPermission="MANAGE_WORKFLOWS"
      />
    );
  }

  // User has permission - render the client component
  return <WorkflowsClient canManageWorkflows={canManageWorkflows || canManageAllWorkflows} />;
}

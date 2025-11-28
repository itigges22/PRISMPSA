import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { requireAuthentication, handleGuardError } from '@/lib/server-guards';
import { Permission } from '@/lib/permissions';
import { checkPermissionHybrid } from '@/lib/permission-checker';
import { logger } from '@/lib/debug-logger';

export async function GET(request: NextRequest) {
  try {
    // Check authentication - return empty array if not authenticated instead of throwing
    let userProfile;
    try {
      userProfile = await requireAuthentication(request);
    } catch (error) {
      // If authentication fails, return empty array (user will see no updates)
      logger.debug('User not authenticated, returning empty project updates', { action: 'getProjectUpdates' });
      return NextResponse.json([]);
    }
    
    if (!userProfile) {
      logger.debug('User profile is null, returning empty project updates', { action: 'getProjectUpdates' });
      return NextResponse.json([]);
    }
    
    const supabase = await createServerSupabase();
    if (!supabase) {
      logger.error('Supabase not configured', { action: 'getProjectUpdates' });
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const userId = userProfile.id;

    // Check which permission the user has (in priority order: most permissive first)
    const hasViewAll = await checkPermissionHybrid(userProfile, Permission.VIEW_ALL_PROJECT_UPDATES);
    const hasViewAccount = await checkPermissionHybrid(userProfile, Permission.VIEW_ACCOUNT_PROJECTS_UPDATES);
    const hasViewDepartment = await checkPermissionHybrid(userProfile, Permission.VIEW_DEPARTMENT_PROJECTS_UPDATES);
    const hasViewAssigned = await checkPermissionHybrid(userProfile, Permission.VIEW_ASSIGNED_PROJECTS_UPDATES);
    
    // IMPORTANT: If user doesn't have ANY of the welcome page update viewing permissions, return empty array
    // VIEW_UPDATES permission is for viewing updates in project pages, not the welcome page
    if (!hasViewAll && !hasViewAccount && !hasViewDepartment && !hasViewAssigned) {
      logger.debug('User has no welcome page project update permissions, returning empty array', { userId });
      return NextResponse.json([]);
    }

    // Build query based on permissions
    let query = supabase
      .from('project_updates')
      .select(`
        *,
        user_profiles:user_profiles(id, name, email, image),
        projects:projects(
          id,
          name,
          status,
          priority,
          accounts!projects_account_id_fkey(id, name)
        )
      `);

    // If user has VIEW_ALL_PROJECT_UPDATES, return all updates
    if (hasViewAll) {
      logger.debug('User has VIEW_ALL_PROJECT_UPDATES permission', { userId });
      // No filter needed - return all updates
    } 
    // If user has VIEW_ACCOUNT_PROJECTS_UPDATES, filter by accounts they're assigned to
    else if (hasViewAccount) {
      logger.debug('User has VIEW_ACCOUNT_PROJECTS_UPDATES permission', { userId });

      // OPTIMIZATION: Parallelize account queries
      const [
        { data: userAccounts },
        { data: userProjects },
        { data: projectAssignments }
      ] = await Promise.all([
        supabase
          .from('accounts')
          .select('id')
          .eq('account_manager_id', userId),
        supabase
          .from('projects')
          .select('account_id')
          .or(`created_by.eq.${userId},assigned_user_id.eq.${userId}`),
        supabase
          .from('project_assignments')
          .select('project:projects(account_id)')
          .eq('user_id', userId)
          .is('removed_at', null)
      ]);

      const accountIds = new Set<string>();
      
      // Add account manager accounts
      userAccounts?.forEach(acc => accountIds.add(acc.id));
      
      // Add accounts from projects
      userProjects?.forEach((p: any) => {
        if (p.account_id) accountIds.add(p.account_id);
      });
      
      // Add accounts from project assignments
      projectAssignments?.forEach((pa: any) => {
        if (pa.project?.account_id) accountIds.add(pa.project.account_id);
      });

      if (accountIds.size > 0) {
        // Get projects in these accounts
        const { data: accountProjects } = await supabase
          .from('projects')
          .select('id')
          .in('account_id', Array.from(accountIds));

        const projectIds = accountProjects?.map((p: any) => p.id) || [];
        
        if (projectIds.length > 0) {
          query = query.in('project_id', projectIds);
        } else {
          // No accessible projects - return empty result
          query = query.eq('project_id', '00000000-0000-0000-0000-000000000000');
        }
      } else {
        // No accessible accounts - return empty result
        query = query.eq('project_id', '00000000-0000-0000-0000-000000000000');
      }
    }
    // If user has VIEW_DEPARTMENT_PROJECTS_UPDATES, filter by department projects
    else if (hasViewDepartment) {
      logger.debug('User has VIEW_DEPARTMENT_PROJECTS_UPDATES permission', { userId });
      
      // Get user's departments from their roles
      const userDepartmentIds = userProfile.user_roles
        ?.map(ur => ur.roles.departments?.id)
        .filter((id): id is string => id !== undefined && id !== null) || [];

      if (userDepartmentIds.length > 0) {
        // Get roles for these departments
        const { data: departmentRoles } = await supabase
          .from('roles')
          .select('id')
          .in('department_id', userDepartmentIds);

        const roleIds = departmentRoles?.map((r: any) => r.id) || [];

        if (roleIds.length > 0) {
          // Get users who have these roles
          const { data: deptUsers } = await supabase
            .from('user_roles')
            .select('user_id')
            .in('role_id', roleIds);

          const deptUserIds = Array.from(new Set(deptUsers?.map((ur: any) => ur.user_id) || []));

          if (deptUserIds.length > 0) {
            // Get projects assigned to these users
            const { data: projectAssignments } = await supabase
              .from('project_assignments')
              .select('project_id')
              .in('user_id', deptUserIds)
              .is('removed_at', null);

            const projectIds = Array.from(new Set(projectAssignments?.map((pa: any) => pa.project_id) || []));

            if (projectIds.length > 0) {
              query = query.in('project_id', projectIds);
            } else {
              // No accessible projects - return empty result
              query = query.eq('project_id', '00000000-0000-0000-0000-000000000000');
            }
          } else {
            // No users in departments - return empty result
            query = query.eq('project_id', '00000000-0000-0000-0000-000000000000');
          }
        } else {
          // No roles in departments - return empty result
          query = query.eq('project_id', '00000000-0000-0000-0000-000000000000');
        }
      } else {
        // No departments - return empty result
        query = query.eq('project_id', '00000000-0000-0000-0000-000000000000');
      }
    }
    // If user has VIEW_ASSIGNED_PROJECTS_UPDATES, filter by assigned projects only
    else if (hasViewAssigned) {
      logger.debug('User has VIEW_ASSIGNED_PROJECTS_UPDATES permission', { userId });

      // OPTIMIZATION: Parallelize project queries
      const [
        { data: assignedProjects },
        { data: directProjects }
      ] = await Promise.all([
        supabase
          .from('project_assignments')
          .select('project_id')
          .eq('user_id', userId)
          .is('removed_at', null),
        supabase
          .from('projects')
          .select('id')
          .or(`created_by.eq.${userId},assigned_user_id.eq.${userId}`)
      ]);

      const projectIds = new Set<string>();
      
      assignedProjects?.forEach(ap => projectIds.add(ap.project_id));
      directProjects?.forEach((p: any) => projectIds.add(p.id));

      if (projectIds.size > 0) {
        query = query.in('project_id', Array.from(projectIds));
      } else {
        // No assigned projects - return empty result
        query = query.eq('project_id', '00000000-0000-0000-0000-000000000000');
      }
    }
    // This block should never be reached due to the check above, but kept as safety net
    else {
      logger.warn('Unexpected permission state - user has no update viewing permissions but reached filter logic', { userId });
      // Return empty result - user should not see any updates
      query = query.eq('project_id', '00000000-0000-0000-0000-000000000000');
    }

    // Execute query
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      logger.error('Error fetching project updates', { 
        action: 'getProjectUpdates', 
        userId,
        errorMessage: error.message,
        errorCode: error.code,
        errorDetails: error.details
      }, error);
      return NextResponse.json({ 
        error: 'Failed to fetch project updates',
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    logger.error('Unexpected error in project-updates API', { 
      action: 'getProjectUpdates',
      errorMessage: error instanceof Error ? error.message : String(error)
    }, error instanceof Error ? error : new Error(String(error)));
    return handleGuardError(error);
  }
}


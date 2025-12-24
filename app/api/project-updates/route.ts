import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
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
    } catch (_error: unknown) {
      // If authentication fails, return empty array (user will see no updates)
      logger.debug('User not authenticated, returning empty project updates', { action: 'getProjectUpdates' });
      return NextResponse.json([]);
    }
    
    if (!userProfile) {
      logger.debug('User profile is null, returning empty project updates', { action: 'getProjectUpdates' });
      return NextResponse.json([]);
    }
    
    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      logger.error('Supabase not configured', { action: 'getProjectUpdates' });
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const userId = (userProfile as any).id;

    // Phase 9: Simplified permission check - VIEW_UPDATES (context-aware) or VIEW_ALL_UPDATES (override)
    const hasViewAll = await checkPermissionHybrid(userProfile, Permission.VIEW_ALL_UPDATES);
    const hasViewUpdates = await checkPermissionHybrid(userProfile, Permission.VIEW_UPDATES);

    // IMPORTANT: If user doesn't have update viewing permissions, return empty array
    if (!hasViewAll && !hasViewUpdates) {
      logger.debug('User has no project update permissions, returning empty array', { userId });
      return NextResponse.json([]);
    }

    // Build query based on permissions
    // Simplified query - workflow_history relationship is optional
    let query = supabase
      .from('project_updates')
      .select(`
        id,
        project_id,
        content,
        created_by,
        workflow_history_id,
        created_at,
        updated_at,
        user_profiles:created_by(id, name, email, image),
        projects:project_id(
          id,
          name,
          status,
          priority,
          accounts:account_id(id, name)
        )
      `);

    // If user has VIEW_ALL_UPDATES override, return all updates
    if (hasViewAll) {
      logger.debug('User has VIEW_ALL_UPDATES permission', { userId });
      // No filter needed - return all updates
    }
    // Phase 9: Simplified - filter to projects user has access to
    else {
      logger.debug('User has VIEW_UPDATES permission, filtering to accessible projects', { userId });

      // Get ALL projects user has access to (assigned + account + department)
      const [
        { data: assignedProjects },
        { data: directProjects },
        { data: accountProjects }
      ] = await Promise.all([
        // Direct project assignments
        supabase
          .from('project_assignments')
          .select('project_id')
          .eq('user_id', userId)
          .is('removed_at', null),
        // Projects created by or assigned to user
        supabase
          .from('projects')
          .select('id')
          .or(`created_by.eq.${userId},assigned_user_id.eq.${userId}`),
        // Projects in accounts user manages or is member of
        supabase
          .from('account_members')
          .select('account:accounts!inner(projects(id))')
          .eq('user_id', userId)
      ]);

      const projectIds = new Set<string>();

      // Add directly assigned projects
      assignedProjects?.forEach((ap: any) => projectIds.add(ap.project_id));
      // Add created/assigned projects
      directProjects?.forEach((p: { id: string }) => projectIds.add(p.id));
      // Add account projects
      (accountProjects as unknown as { account?: { projects?: { id: string }[] } }[] | null)?.forEach((am: { account?: { projects?: { id: string }[] } }) => {
        am.account?.projects?.forEach((p: { id: string }) => projectIds.add(p.id));
      });

      if (projectIds.size > 0) {
        query = query.in('project_id', Array.from(projectIds));
      } else {
        // No accessible projects - return empty result
        query = query.eq('project_id', '00000000-0000-0000-0000-000000000000');
      }
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
  } catch (error: unknown) {
logger.error('Unexpected error in project-updates API', {
      action: 'getProjectUpdates',
      errorMessage: error instanceof Error ? error.message : String(error)
    }, error instanceof Error ? error : new Error(String(error)));
    return handleGuardError(error);
  }
}


import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabaseClient } from '@/lib/supabase-server'
import { hasPermission, isSuperadmin } from '@/lib/rbac'
import { Permission } from '@/lib/permissions'

/**
 * POST /api/projects/[projectId]/complete
 * Manually complete a project that doesn't have an active workflow
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params

    const supabase = createApiSupabaseClient(request)
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile with roles
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select(`
        *,
        user_roles!user_roles_user_id_fkey (
          roles (
            id,
            name,
            permissions,
            department_id
          )
        )
      `)
      .eq('id', (user as any).id)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Check permissions FIRST before fetching project (to avoid RLS blocking legitimate access checks)
    const userIsSuperadmin = isSuperadmin(userProfile)
    const hasManageAllProjects = await hasPermission(userProfile, Permission.MANAGE_ALL_PROJECTS, undefined, supabase)

    // Check if user has project access via assignment (before RLS-protected project query)
    const { data: userAssignment } = await supabase
      .from('project_assignments')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', (user as any).id)
      .is('removed_at', null)
      .maybeSingle()

    const hasProjectAssignment = !!userAssignment

    // If user has no access at all (not superadmin, no MANAGE_ALL_PROJECTS, not assigned), deny
    if (!userIsSuperadmin && !hasManageAllProjects && !hasProjectAssignment) {
      return NextResponse.json({ error: 'Access denied to this project' }, { status: 403 })
    }

    // Now fetch project - RLS should allow access since we verified permissions above
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, status, account_id, created_by')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Verify project is not already complete
    if (project.status === 'complete') {
      return NextResponse.json({ error: 'Project is already completed' }, { status: 400 })
    }

    // Check if project has an active workflow - only allow manual completion for non-workflow projects
    const { data: activeWorkflow } = await supabase
      .from('workflow_instances')
      .select('id, status')
      .eq('project_id', projectId)
      .eq('status', 'active')
      .maybeSingle()

    if (activeWorkflow) {
      return NextResponse.json({
        error: 'Cannot manually complete a project with an active workflow. Use the workflow progression instead.'
      }, { status: 400 })
    }

    // Final permission check - must be superadmin, have MANAGE_ALL_PROJECTS, project creator,
    // or be assigned to the project with manage_projects permission
    const isProjectCreator = project.created_by === (user as any).id
    const hasManageProjects = await hasPermission(userProfile, Permission.MANAGE_PROJECTS, undefined, supabase)
    const canCompleteAsAssignedPM = hasProjectAssignment && hasManageProjects

    if (!userIsSuperadmin && !hasManageAllProjects && !isProjectCreator && !canCompleteAsAssignedPM) {
      return NextResponse.json({
        error: 'Only project creators, assigned project managers, or administrators can complete projects'
      }, { status: 403 })
    }

    // Complete the project:
    // 1. Set status to 'complete'
    // 2. Update timestamp
    const { error: updateError } = await supabase
      .from('projects')
      .update({
        status: 'complete',
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId)

    if (updateError) {
      console.error('Error completing project:', updateError)
      return NextResponse.json({ error: 'Failed to complete project' }, { status: 500 })
    }

    // Soft-delete all project assignments (set removed_at)
    const { error: assignmentError } = await supabase
      .from('project_assignments')
      .update({ removed_at: new Date().toISOString() })
      .eq('project_id', projectId)
      .is('removed_at', null)

    if (assignmentError) {
      console.error('Error updating project assignments:', assignmentError)
      // Don't fail the request, just log the error
    }

    return NextResponse.json({
      success: true,
      message: 'Project completed successfully'
    })

  } catch (error: unknown) {
    console.error('Error in POST /api/projects/[projectId]/complete:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

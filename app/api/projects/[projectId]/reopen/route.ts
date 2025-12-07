import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabaseClient } from '@/lib/supabase-server'
import { hasPermission, isSuperadmin } from '@/lib/rbac'
import { Permission } from '@/lib/permissions'

/**
 * POST /api/projects/[projectId]/reopen
 * Reopen a completed project - removes workflow and sets status back to in_progress
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
      .eq('id', user.id)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Check if project exists and is completed
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, status, account_id, created_by')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (project.status !== 'complete') {
      return NextResponse.json({ error: 'Project is not completed' }, { status: 400 })
    }

    // Check permissions - must be superadmin, have EDIT_ALL_PROJECTS, or be the project creator
    const userIsSuperadmin = isSuperadmin(userProfile)
    const hasEditAllProjects = await hasPermission(userProfile, Permission.EDIT_ALL_PROJECTS, undefined, supabase)
    const isProjectCreator = project.created_by === user.id

    if (!userIsSuperadmin && !hasEditAllProjects && !isProjectCreator) {
      return NextResponse.json({
        error: 'Only project creators or administrators can reopen completed projects'
      }, { status: 403 })
    }

    // Reopen the project:
    // 1. Clear workflow_instance_id (project now operates without workflow)
    // 2. Set status to 'in_progress'
    // 3. Clear completed_at timestamp
    // 4. Set reopened_at timestamp for badge display
    const { error: updateError } = await supabase
      .from('projects')
      .update({
        workflow_instance_id: null,
        status: 'in_progress',
        completed_at: null,
        reopened_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId)

    if (updateError) {
      console.error('Error reopening project:', updateError)
      return NextResponse.json({ error: 'Failed to reopen project' }, { status: 500 })
    }

    // Reactivate ALL previously assigned team members
    // This preserves the team that was working on the project when it was completed
    const { error: reactivateError } = await supabase
      .from('project_assignments')
      .update({ removed_at: null })
      .eq('project_id', projectId)
      .not('removed_at', 'is', null)

    if (reactivateError) {
      console.error('Error reactivating team assignments:', reactivateError)
      // Continue anyway - this is not a critical failure
    }

    // Ensure project creator is assigned with 'creator' role
    const { data: creatorAssignment } = await supabase
      .from('project_assignments')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', project.created_by)
      .single()

    if (creatorAssignment) {
      // Update role to creator if needed (and ensure not removed)
      await supabase
        .from('project_assignments')
        .update({ role_in_project: 'creator', removed_at: null })
        .eq('id', creatorAssignment.id)
    } else {
      // Create new assignment for creator
      await supabase
        .from('project_assignments')
        .insert({
          project_id: projectId,
          user_id: project.created_by,
          role_in_project: 'creator',
          assigned_by: user.id
        })
    }

    return NextResponse.json({
      success: true,
      message: 'Project reopened successfully. The project now operates without a workflow.'
    })

  } catch (error) {
    console.error('Error in POST /api/projects/[projectId]/reopen:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

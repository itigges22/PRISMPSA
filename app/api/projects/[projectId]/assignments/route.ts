import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabaseClient } from '@/lib/supabase-server'
import { hasPermission, isSuperadmin } from '@/lib/rbac'
import { Permission } from '@/lib/permissions'

/**
 * GET /api/projects/[projectId]/assignments
 * Get all active project assignments (team members) with workflow step info
 * Returns memberType: 'collaborator' | 'workflow' | 'both' for each member
 */
export async function GET(
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

    // PARALLEL QUERY 1: Get assignments and workflow instance concurrently
    const [assignmentsResult, workflowResult] = await Promise.all([
      supabase
        .from('project_assignments')
        .select(`
          id,
          user_id,
          role_in_project,
          assigned_at,
          assigned_by,
          user_profiles:user_id (
            id,
            name,
            email,
            image
          )
        `)
        .eq('project_id', projectId)
        .is('removed_at', null)
        .order('assigned_at', { ascending: false }),
      supabase
        .from('workflow_instances')
        .select('id, status, workflow_template_id, started_snapshot')
        .eq('project_id', projectId)
        .in('status', ['active', 'completed'])
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    ])

    const { data: assignments, error } = assignmentsResult
    const workflowInstance = workflowResult.data

    if (error) {
      console.error('Error fetching project assignments:', error)
      return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 })
    }

    // Get user IDs from collaborators
    const collaboratorUserIds = (assignments || []).map((a: any) => a.user_id).filter(Boolean)

    // PARALLEL QUERY 2: Get user roles, node assignments, and active steps concurrently
    const [userRolesResult, nodeAssignmentsResult, activeStepsResult] = await Promise.all([
      collaboratorUserIds.length > 0
        ? supabase
            .from('user_roles')
            .select(`user_id, roles (name)`)
            .in('user_id', collaboratorUserIds)
        : Promise.resolve({ data: [] }),
      workflowInstance
        ? supabase
            .from('workflow_node_assignments')
            .select('node_id, user_id')
            .eq('workflow_instance_id', workflowInstance.id)
        : Promise.resolve({ data: [] }),
      workflowInstance
        ? supabase
            .from('workflow_active_steps')
            .select('node_id, assigned_user_id, status')
            .eq('workflow_instance_id', workflowInstance.id)
            .not('assigned_user_id', 'is', null)
        : Promise.resolve({ data: [] })
    ])

    // Build user roles map
    const userRolesMap: Record<string, string> = {}
    if (userRolesResult.data) {
      for (const ur of userRolesResult.data) {
        const roles = (ur as any).roles as Record<string, unknown> | Record<string, unknown>[];
        const roleName = Array.isArray(roles)
          ? (roles[0]?.name as string)
          : (roles?.name as string);
        if (!userRolesMap[(ur as any).user_id] && roleName) {
          userRolesMap[(ur as any).user_id] = roleName;
        }
      }
    }

    // Helper to get node label from snapshot
    const getNodeLabel = (nodeId: string): string => {
      if (!workflowInstance) return 'Unknown Step';
      const snapshot = (workflowInstance as Record<string, unknown>).started_snapshot as Record<string, unknown>;
      const nodes = snapshot?.nodes as Record<string, unknown>[] | undefined;
      const node = nodes?.find((n: any) => n.id === nodeId);
      return (node?.label as string) || 'Unknown Step';
    };

    // Build node assignments map from both sources
    const nodeAssignmentsMap: Record<string, Array<{ stepId: string; stepName: string; isActive?: boolean }>> = {}
    const workflowUserIds = new Set<string>()

    // From workflow_node_assignments
    if (nodeAssignmentsResult.data) {
      for (const na of nodeAssignmentsResult.data) {
        const userId = (na as any).user_id as string
        workflowUserIds.add(userId)
        if (!nodeAssignmentsMap[userId]) {
          nodeAssignmentsMap[userId] = []
        }
        nodeAssignmentsMap[userId].push({
          stepId: (na as any).node_id,
          stepName: getNodeLabel((na as any).node_id)
        })
      }
    }

    // From workflow_active_steps
    if (activeStepsResult.data) {
      for (const step of activeStepsResult.data) {
        const userId = (step as any).assigned_user_id as string
        if (!userId) continue
        workflowUserIds.add(userId)

        const stepInfo = {
          stepId: (step as any).node_id,
          stepName: getNodeLabel((step as any).node_id),
          isActive: (step as any).status === 'active'
        }

        if (!nodeAssignmentsMap[userId]) {
          nodeAssignmentsMap[userId] = []
        }

        // Only add if not already present for this node
        if (!nodeAssignmentsMap[userId].some((s: any) => s.stepId === stepInfo.stepId)) {
          nodeAssignmentsMap[userId].push(stepInfo)
        }
      }
    }

    // Find workflow-only users (not in project_assignments)
    const collaboratorSet = new Set(collaboratorUserIds)
    const workflowOnlyUserIds = [...workflowUserIds].filter(id => !collaboratorSet.has(id))

    // PARALLEL QUERY 3: Get profiles and roles for workflow-only users
    let missingUserProfiles: any[] = []
    const missingRolesMap: Record<string, string> = {}

    if (workflowOnlyUserIds.length > 0) {
      const [profilesResult, rolesResult] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('id, name, email, image')
          .in('id', workflowOnlyUserIds),
        supabase
          .from('user_roles')
          .select(`user_id, roles (name)`)
          .in('user_id', workflowOnlyUserIds)
      ])

      missingUserProfiles = profilesResult.data || []

      if (rolesResult.data) {
        for (const ur of rolesResult.data) {
          const roles = (ur as any).roles as Record<string, unknown> | Record<string, unknown>[];
          const roleName = Array.isArray(roles)
            ? (roles[0]?.name as string)
            : (roles?.name as string);
          if (!missingRolesMap[(ur as any).user_id] && roleName) {
            missingRolesMap[(ur as any).user_id] = roleName;
          }
        }
      }
    }

    // Enrich collaborator assignments with workflow info and memberType
    const enrichedAssignments = (assignments || []).map((assignment: any) => {
      const userId = assignment.user_id as string;
      const nodeAssignments = nodeAssignmentsMap[userId] || []
      const primaryRole = userRolesMap[userId] || null
      const hasWorkflowSteps = nodeAssignments.length > 0

      return {
        ...assignment,
        workflow_step: hasWorkflowSteps ? nodeAssignments[0] : null,
        workflow_steps: nodeAssignments,
        primary_role: primaryRole,
        // New field: memberType indicates how user is part of the team
        memberType: hasWorkflowSteps ? 'both' : 'collaborator'
      }
    })

    // Create workflow-only team members
    const virtualTeamMembers = missingUserProfiles.map((profile: any) => {
      const nodeAssignments = nodeAssignmentsMap[profile.id] || []
      return {
        id: `virtual-${profile.id}`,
        user_id: profile.id,
        role_in_project: 'workflow_step',
        assigned_at: null,
        assigned_by: null,
        user_profiles: profile,
        workflow_step: nodeAssignments.length > 0 ? nodeAssignments[0] : null,
        workflow_steps: nodeAssignments,
        primary_role: missingRolesMap[profile.id] || null,
        is_virtual: true,
        // New field: workflow-only members
        memberType: 'workflow'
      }
    })

    // Combine all members
    const allAssignments = [...enrichedAssignments, ...virtualTeamMembers]

    return NextResponse.json({
      assignments: allAssignments,
      has_active_workflow: workflowInstance?.status === 'active'
    })

  } catch (error: unknown) {
    console.error('Error in GET /api/projects/[projectId]/assignments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/projects/[projectId]/assignments
 * Add a new team member to the project
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const body = await request.json()
    const { userId, roleInProject } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

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

    // Get project details
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, status, created_by')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Can't add members to completed projects
    if (project.status === 'complete') {
      return NextResponse.json({ error: 'Cannot add members to a completed project' }, { status: 400 })
    }

    // Check permissions
    const userIsSuperadmin = isSuperadmin(userProfile)
    const hasEditAllProjects = await hasPermission(userProfile, Permission.MANAGE_ALL_PROJECTS, undefined, supabase)
    const isProjectCreator = project.created_by === (user as any).id

    if (!userIsSuperadmin && !hasEditAllProjects && !isProjectCreator) {
      return NextResponse.json({
        error: 'Only project creators or administrators can add team members'
      }, { status: 403 })
    }

    // Check if user is already assigned (including soft-deleted)
    const { data: existingAssignment } = await supabase
      .from('project_assignments')
      .select('id, removed_at')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single()

    if (existingAssignment) {
      if (existingAssignment.removed_at === null) {
        return NextResponse.json({ error: 'User is already assigned to this project' }, { status: 400 })
      }

      // Reactivate the existing assignment
      const { error: updateError } = await supabase
        .from('project_assignments')
        .update({
          removed_at: null,
          role_in_project: roleInProject || 'member'
        })
        .eq('id', existingAssignment.id)

      if (updateError) {
        console.error('Error reactivating assignment:', updateError)
        return NextResponse.json({ error: 'Failed to add team member' }, { status: 500 })
      }
    } else {
      // Create new assignment
      const { error: insertError } = await supabase
        .from('project_assignments')
        .insert({
          project_id: projectId,
          user_id: userId,
          role_in_project: roleInProject || 'member',
          assigned_by: (user as any).id
        })

      if (insertError) {
        console.error('Error creating assignment:', insertError)
        return NextResponse.json({ error: 'Failed to add team member' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, message: 'Team member added successfully' })

  } catch (error: unknown) {
    console.error('Error in POST /api/projects/[projectId]/assignments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/projects/[projectId]/assignments
 * Remove a team member from the project (soft delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

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

    // Get project details
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, status, created_by')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Can't remove members from completed projects
    if (project.status === 'complete') {
      return NextResponse.json({ error: 'Cannot remove members from a completed project' }, { status: 400 })
    }

    // Check permissions
    const userIsSuperadmin = isSuperadmin(userProfile)
    const hasEditAllProjects = await hasPermission(userProfile, Permission.MANAGE_ALL_PROJECTS, undefined, supabase)
    const isProjectCreator = project.created_by === (user as any).id

    if (!userIsSuperadmin && !hasEditAllProjects && !isProjectCreator) {
      return NextResponse.json({
        error: 'Only project creators or administrators can remove team members'
      }, { status: 403 })
    }

    // Soft delete the assignment
    const { error: updateError } = await supabase
      .from('project_assignments')
      .update({ removed_at: new Date().toISOString() })
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .is('removed_at', null)

    if (updateError) {
      console.error('Error removing assignment:', updateError)
      return NextResponse.json({ error: 'Failed to remove team member' }, { status: 500 })
    }

    // Also remove any workflow node assignments for this user in this project's workflows
    const { data: workflowInstances } = await supabase
      .from('workflow_instances')
      .select('id')
      .eq('project_id', projectId)

    if (workflowInstances && workflowInstances.length > 0) {
      const instanceIds = workflowInstances.map((wi: any) => wi.id)
      const { error: nodeAssignmentError } = await supabase
        .from('workflow_node_assignments')
        .delete()
        .in('workflow_instance_id', instanceIds)
        .eq('user_id', userId)

      if (nodeAssignmentError) {
        console.error('Error removing workflow node assignments:', nodeAssignmentError)
        // Don't fail the whole operation, just log the error
      }
    }

    return NextResponse.json({ success: true, message: 'Team member removed successfully' })

  } catch (error: unknown) {
    console.error('Error in DELETE /api/projects/[projectId]/assignments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

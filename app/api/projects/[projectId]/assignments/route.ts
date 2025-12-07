import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabaseClient } from '@/lib/supabase-server'
import { hasPermission, isSuperadmin } from '@/lib/rbac'
import { Permission } from '@/lib/permissions'

/**
 * GET /api/projects/[projectId]/assignments
 * Get all active project assignments (team members) with workflow step info
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

    // Get active assignments with user details
    const { data: assignments, error } = await supabase
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
      .order('assigned_at', { ascending: false })

    if (error) {
      console.error('Error fetching project assignments:', error)
      return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 })
    }

    // Get user roles for all assigned users (separate query to avoid nested relation issues)
    const userIds = (assignments || []).map((a: any) => a.user_id).filter(Boolean)
    let userRolesMap: Record<string, string> = {}

    if (userIds.length > 0) {
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          roles (
            name
          )
        `)
        .in('user_id', userIds)

      // Build a map of user_id -> primary role name
      if (userRoles) {
        for (const ur of userRoles) {
          if (!userRolesMap[ur.user_id] && (ur.roles as any)?.name) {
            userRolesMap[ur.user_id] = (ur.roles as any).name
          }
        }
      }
    }

    // Get workflow instance for this project to find node assignments
    // Include started_snapshot for node labels (FK to workflow_nodes may not exist)
    const { data: workflowInstance } = await supabase
      .from('workflow_instances')
      .select('id, status, workflow_template_id, started_snapshot')
      .eq('project_id', projectId)
      .in('status', ['active', 'completed'])
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    // If there's a workflow, get node assignments (supporting multiple per user)
    let nodeAssignmentsMap: Record<string, Array<{ stepId: string; stepName: string; isActive?: boolean }>> = {}
    // Track users from active steps who may not be in project_assignments
    let activeStepUsers: Array<{ userId: string; stepId: string; stepName: string }> = []

    if (workflowInstance) {
      // Helper to get node label from snapshot
      const getNodeLabel = (nodeId: string): string => {
        const snapshot = (workflowInstance as any).started_snapshot;
        const node = snapshot?.nodes?.find((n: any) => n.id === nodeId);
        return node?.label || 'Unknown Step';
      };

      // Get all node assignments for this workflow instance
      // NOTE: We don't join workflow_nodes because FK may not exist after template modifications
      const { data: nodeAssignments } = await supabase
        .from('workflow_node_assignments')
        .select('node_id, user_id')
        .eq('workflow_instance_id', workflowInstance.id)

      // Build a map of user_id -> array of { stepId, stepName }
      if (nodeAssignments) {
        for (const na of nodeAssignments) {
          if (!nodeAssignmentsMap[na.user_id]) {
            nodeAssignmentsMap[na.user_id] = []
          }
          nodeAssignmentsMap[na.user_id].push({
            stepId: na.node_id,
            stepName: getNodeLabel(na.node_id)
          })
        }
      }

      // Also get users assigned directly to active workflow steps (via assigned_user_id)
      // These users may not be in workflow_node_assignments but are actively working on steps
      const { data: activeSteps } = await supabase
        .from('workflow_active_steps')
        .select('node_id, assigned_user_id, status')
        .eq('workflow_instance_id', workflowInstance.id)
        .not('assigned_user_id', 'is', null)

      if (activeSteps) {
        for (const step of activeSteps) {
          const userId = step.assigned_user_id
          if (!userId) continue

          const stepInfo = {
            stepId: step.node_id,
            stepName: getNodeLabel(step.node_id),
            isActive: step.status === 'active'
          }

          // Add to node assignments map
          if (!nodeAssignmentsMap[userId]) {
            nodeAssignmentsMap[userId] = []
          }

          // Only add if not already present for this node
          const existingSteps = nodeAssignmentsMap[userId]
          if (!existingSteps.some(s => s.stepId === stepInfo.stepId)) {
            nodeAssignmentsMap[userId].push(stepInfo)
          }

          // Track for adding to team if not already in project_assignments
          activeStepUsers.push({
            userId,
            stepId: stepInfo.stepId,
            stepName: stepInfo.stepName
          })
        }
      }
    }

    // Enrich assignments with workflow node info and primary role
    const enrichedAssignments = (assignments || []).map((assignment: any) => {
      const userId = assignment.user_id
      const nodeAssignments = nodeAssignmentsMap[userId] || []
      const primaryRole = userRolesMap[userId] || null

      return {
        ...assignment,
        // Keep backward compatibility with workflow_step (first assignment)
        workflow_step: nodeAssignments.length > 0 ? nodeAssignments[0] : null,
        // New field: all workflow step assignments
        workflow_steps: nodeAssignments,
        primary_role: primaryRole
      }
    })

    // Find users from active workflow steps who are NOT in project_assignments
    // These users should appear in the Team Members section with their step assignments
    const existingUserIds = new Set((assignments || []).map((a: any) => a.user_id))
    const missingStepUserIds = [...new Set(activeStepUsers.map(u => u.userId))]
      .filter(userId => !existingUserIds.has(userId))

    // Fetch user profiles for missing users
    let virtualTeamMembers: any[] = []
    if (missingStepUserIds.length > 0) {
      const { data: missingUserProfiles } = await supabase
        .from('user_profiles')
        .select('id, name, email, image')
        .in('id', missingStepUserIds)

      // Get roles for these users
      const { data: missingUserRoles } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          roles (name)
        `)
        .in('user_id', missingStepUserIds)

      const missingRolesMap: Record<string, string> = {}
      if (missingUserRoles) {
        for (const ur of missingUserRoles) {
          if (!missingRolesMap[ur.user_id] && (ur.roles as any)?.name) {
            missingRolesMap[ur.user_id] = (ur.roles as any).name
          }
        }
      }

      // Create virtual team members from workflow step assignments
      if (missingUserProfiles) {
        for (const profile of missingUserProfiles) {
          const nodeAssignments = nodeAssignmentsMap[profile.id] || []
          virtualTeamMembers.push({
            id: `virtual-${profile.id}`, // Virtual ID to distinguish from real assignments
            user_id: profile.id,
            role_in_project: 'workflow_step', // Special role indicating they're here via workflow
            assigned_at: null,
            assigned_by: null,
            user_profiles: profile,
            workflow_step: nodeAssignments.length > 0 ? nodeAssignments[0] : null,
            workflow_steps: nodeAssignments,
            primary_role: missingRolesMap[profile.id] || null,
            is_virtual: true // Flag to indicate this is a workflow-only assignment
          })
        }
      }
    }

    // Combine regular assignments with virtual team members from workflow steps
    const allAssignments = [...enrichedAssignments, ...virtualTeamMembers]

    return NextResponse.json({
      assignments: allAssignments,
      has_active_workflow: workflowInstance?.status === 'active'
    })

  } catch (error) {
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
      .eq('id', user.id)
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
    const hasEditAllProjects = await hasPermission(userProfile, Permission.EDIT_ALL_PROJECTS, undefined, supabase)
    const isProjectCreator = project.created_by === user.id

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
          assigned_by: user.id
        })

      if (insertError) {
        console.error('Error creating assignment:', insertError)
        return NextResponse.json({ error: 'Failed to add team member' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, message: 'Team member added successfully' })

  } catch (error) {
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
      .eq('id', user.id)
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
    const hasEditAllProjects = await hasPermission(userProfile, Permission.EDIT_ALL_PROJECTS, undefined, supabase)
    const isProjectCreator = project.created_by === user.id

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
      const instanceIds = workflowInstances.map(wi => wi.id)
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

  } catch (error) {
    console.error('Error in DELETE /api/projects/[projectId]/assignments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

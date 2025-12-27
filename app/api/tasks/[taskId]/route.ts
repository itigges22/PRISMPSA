import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabaseClient } from '@/lib/supabase-server'
import { hasPermission, isSuperadmin } from '@/lib/rbac'
import { Permission } from '@/lib/permissions'
import { taskServiceDB, UpdateTaskData } from '@/lib/task-service-db'
import type { UserWithRoles } from '@/lib/rbac-types'
import { checkDemoModeForDestructiveAction } from '@/lib/api-demo-guard'

// Helper function to check if user has access to a project
async function userHasProjectAccess(supabase: any, userId: string, projectId: string, userProfile: UserWithRoles): Promise<boolean> {
  // Superadmins have access to all projects
  if (isSuperadmin(userProfile)) {
    return true
  }

  // Check if user has VIEW_ALL_PROJECTS permission
  const hasViewAll = await hasPermission(userProfile, Permission.VIEW_ALL_PROJECTS, undefined, supabase)
  if (hasViewAll) {
    return true
  }

  // Check if user is assigned to the project
  const { data: assignment } = await supabase
    .from('project_assignments')
    .select('id')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .is('removed_at', null)
    .single()

  if (assignment) {
    return true
  }

  // Check if user created the project or is assigned as the main user
  const { data: project } = await supabase
    .from('projects')
    .select('created_by, assigned_user_id')
    .eq('id', projectId)
    .single()

  if (project && (project.created_by === userId || project.assigned_user_id === userId)) {
    return true
  }

  return false
}

// Helper function to get task's project info
async function getTaskProject(supabase: any, taskId: string): Promise<{ project_id: string; status: string } | null> {
  const { data: task } = await supabase
    .from('tasks')
    .select('project_id, projects!inner(status)')
    .eq('id', taskId)
    .single()

  if (!task?.project_id) return null
  const projects = task.projects as Record<string, unknown> | Record<string, unknown>[];
  const projectData = Array.isArray(projects) ? projects[0] : projects;
  return {
    project_id: task.project_id as string,
    status: (projectData?.status as string) || 'unknown'
  }
}

// PUT /api/tasks/[taskId] - Update a task
// NOTE: Task permissions are now inherited from project access
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  try {
    const supabase = createApiSupabaseClient(request)
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile
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

    // Get the task's project to check access
    const taskProject = await getTaskProject(supabase, taskId)
    if (taskProject) {
      const hasAccess = await userHasProjectAccess(supabase, (user as any).id, taskProject.project_id, userProfile)
      if (!hasAccess) {
        return NextResponse.json({ error: 'You do not have access to this project' }, { status: 403 })
      }

      // Check if project is completed (read-only mode)
      if (taskProject.status === 'complete') {
        return NextResponse.json({
          error: 'Cannot modify tasks in a completed project. The project is in read-only mode.'
        }, { status: 400 })
      }
    }

    const body = await request.json()

    const updateData: UpdateTaskData = {
      id: taskId,
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.priority !== undefined && { priority: body.priority }),
      ...(body.start_date !== undefined && { start_date: body.start_date }),
      ...(body.due_date !== undefined && { due_date: body.due_date }),
      ...(body.estimated_hours !== undefined && { estimated_hours: body.estimated_hours }),
      ...(body.actual_hours !== undefined && { actual_hours: body.actual_hours }),
      ...(body.assigned_to !== undefined && { assigned_to: body.assigned_to })
    }

    const task = await taskServiceDB.updateTask(updateData)

    if (!task) {
      return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
    }

    return NextResponse.json({ success: true, task })
  } catch (error: unknown) {
    console.error('Error in PUT /api/tasks/[taskId]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/tasks/[taskId] - Partially update a task (e.g., status change from Kanban)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  try {
    const supabase = createApiSupabaseClient(request)
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile
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

    // Get the task's project to check access
    const taskProject = await getTaskProject(supabase, taskId)
    if (taskProject) {
      const hasAccess = await userHasProjectAccess(supabase, (user as any).id, taskProject.project_id, userProfile)
      if (!hasAccess) {
        return NextResponse.json({ error: 'You do not have access to this project' }, { status: 403 })
      }

      // Check if project is completed (read-only mode)
      if (taskProject.status === 'complete') {
        return NextResponse.json({
          error: 'Cannot modify tasks in a completed project. The project is in read-only mode.'
        }, { status: 400 })
      }
    }

    const body = await request.json()

    // Build update object with only provided fields
    const updateFields: Record<string, unknown> = {}
    if (body.status !== undefined) updateFields.status = body.status
    if (body.name !== undefined) updateFields.name = body.name
    if (body.description !== undefined) updateFields.description = body.description
    if (body.priority !== undefined) updateFields.priority = body.priority
    if (body.start_date !== undefined) updateFields.start_date = body.start_date
    if (body.due_date !== undefined) updateFields.due_date = body.due_date
    if (body.estimated_hours !== undefined) updateFields.estimated_hours = body.estimated_hours
    if (body.actual_hours !== undefined) updateFields.actual_hours = body.actual_hours
    if (body.assigned_to !== undefined) updateFields.assigned_to = body.assigned_to

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    // Update the task directly with Supabase
    const { data: task, error: updateError } = await supabase
      .from('tasks')
      .update(updateFields)
      .eq('id', taskId)
      .select(`
        *,
        created_by_user:user_profiles!created_by(id, name, email),
        assigned_to_user:user_profiles!assigned_to(id, name, email),
        project:projects(id, name)
      `)
      .single()

    if (updateError) {
      console.error('Error updating task:', updateError)
      return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
    }

    return NextResponse.json({ success: true, task })
  } catch (error: unknown) {
    console.error('Error in PATCH /api/tasks/[taskId]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/tasks/[taskId] - Delete a task
// NOTE: Task permissions are now inherited from project access
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  try {
    // Block in demo mode
    const blocked = checkDemoModeForDestructiveAction('delete_task');
    if (blocked) return blocked;

    const supabase = createApiSupabaseClient(request)
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile
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

    // Get the task's project to check access
    const taskProject = await getTaskProject(supabase, taskId)
    if (taskProject) {
      const hasAccess = await userHasProjectAccess(supabase, (user as any).id, taskProject.project_id, userProfile)
      if (!hasAccess) {
        return NextResponse.json({ error: 'You do not have access to this project' }, { status: 403 })
      }

      // Check if project is completed (read-only mode)
      if (taskProject.status === 'complete') {
        return NextResponse.json({
          error: 'Cannot delete tasks in a completed project. The project is in read-only mode.'
        }, { status: 400 })
      }
    }

    const success = await taskServiceDB.deleteTask(taskId)

    if (!success) {
      return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Error in DELETE /api/tasks/[taskId]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

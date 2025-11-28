import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { hasPermission } from '@/lib/rbac'
import { Permission } from '@/lib/permissions'
import { taskServiceDB, UpdateTaskData } from '@/lib/task-service-db'

// PUT /api/tasks/[taskId] - Update a task
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params
    const supabase = await createServerSupabase()
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
      .eq('id', user.id)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Check EDIT_TASK permission
    const canEditTask = await hasPermission(userProfile, Permission.EDIT_TASK)
    if (!canEditTask) {
      return NextResponse.json({ error: 'Insufficient permissions to edit tasks' }, { status: 403 })
    }

    const body = await request.json()

    // If reassigning task, check ASSIGN_TASK permission
    if (body.assigned_to !== undefined) {
      const canAssign = await hasPermission(userProfile, Permission.ASSIGN_TASK)
      if (!canAssign) {
        return NextResponse.json({ error: 'Insufficient permissions to assign tasks' }, { status: 403 })
      }
    }

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
  } catch (error) {
    console.error('Error in PUT /api/tasks/[taskId]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/tasks/[taskId] - Delete a task
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params
    const supabase = await createServerSupabase()
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
      .eq('id', user.id)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Check DELETE_TASK permission
    const canDeleteTask = await hasPermission(userProfile, Permission.DELETE_TASK)
    if (!canDeleteTask) {
      return NextResponse.json({ error: 'Insufficient permissions to delete tasks' }, { status: 403 })
    }

    const success = await taskServiceDB.deleteTask(taskId)

    if (!success) {
      return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/tasks/[taskId]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

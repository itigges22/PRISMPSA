import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { hasPermission } from '@/lib/rbac'
import { Permission } from '@/lib/permissions'
import { taskServiceDB, CreateTaskData } from '@/lib/task-service-db'

// POST /api/tasks - Create a new task
export async function POST(request: NextRequest) {
  try {
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

    // Check CREATE_TASK permission
    const canCreateTask = await hasPermission(userProfile, Permission.CREATE_TASK)
    if (!canCreateTask) {
      return NextResponse.json({ error: 'Insufficient permissions to create tasks' }, { status: 403 })
    }

    const body = await request.json()
    const taskData: CreateTaskData = {
      name: body.name,
      description: body.description,
      project_id: body.project_id,
      status: body.status || 'backlog',
      priority: body.priority || 'medium',
      start_date: body.start_date,
      due_date: body.due_date,
      estimated_hours: body.estimated_hours,
      created_by: user.id,
      assigned_to: body.assigned_to
    }

    // If assigning to someone, check ASSIGN_TASK permission
    if (taskData.assigned_to && taskData.assigned_to !== user.id) {
      const canAssign = await hasPermission(userProfile, Permission.ASSIGN_TASK)
      if (!canAssign) {
        return NextResponse.json({ error: 'Insufficient permissions to assign tasks' }, { status: 403 })
      }
    }

    const task = await taskServiceDB.createTask(taskData)

    if (!task) {
      return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
    }

    return NextResponse.json({ success: true, task }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/tasks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

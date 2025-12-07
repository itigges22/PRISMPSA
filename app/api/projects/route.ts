import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabaseClient } from '@/lib/supabase-server'
import { hasPermission, isSuperadmin } from '@/lib/rbac'
import { Permission } from '@/lib/permissions'
import { createProjectSchema, validateRequestBody } from '@/lib/validation-schemas'
import { logger } from '@/lib/debug-logger'
import { config } from '@/lib/config'

/**
 * POST /api/projects - Create a new project
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient(request)
    if (!supabase) {
      logger.error('Failed to create Supabase client', { action: 'create_project' })
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      logger.warn('Unauthorized project creation attempt', { action: 'create_project' })
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
      logger.error('User profile not found', { action: 'create_project', userId: user.id })
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Validate request body with Zod
    const body = await request.json()
    const validation = validateRequestBody(createProjectSchema, body)

    if (!validation.success) {
      logger.warn('Invalid project creation data', {
        action: 'create_project',
        userId: user.id,
        error: validation.error
      })
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const { accountId } = validation.data

    // Check CREATE_PROJECT permission with account context
    // CRITICAL: Pass authenticated supabase client for proper RLS context in permission checks
    const canCreateProject = await hasPermission(userProfile, Permission.CREATE_PROJECT, { accountId }, supabase)
    if (!canCreateProject) {
      logger.warn('Insufficient permissions to create project', {
        action: 'create_project',
        userId: user.id,
        accountId
      })
      return NextResponse.json({ error: 'Insufficient permissions to create projects' }, { status: 403 })
    }

    // Create the project
    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        name: validation.data.name,
        description: validation.data.description,
        account_id: accountId,
        status: validation.data.status || 'planning',
        start_date: validation.data.start_date,
        end_date: validation.data.end_date,
        budget: validation.data.budget,
        assigned_user_id: validation.data.assigned_user_id || user.id,
        created_by: user.id,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      logger.error('Failed to create project in database', {
        action: 'create_project',
        userId: user.id,
        accountId
      }, error as Error)

      return NextResponse.json({
        error: 'Failed to create project',
        ...(config.errors.exposeDetails && { details: error.message })
      }, { status: 500 })
    }

    // Add the creator as a team member in project_assignments
    const { error: assignmentError } = await supabase
      .from('project_assignments')
      .insert({
        project_id: project.id,
        user_id: user.id,
        role_in_project: 'Project Creator',
        assigned_at: new Date().toISOString(),
        assigned_by: user.id
      })

    if (assignmentError) {
      logger.error('Failed to add creator to project assignments', {
        action: 'create_project',
        userId: user.id,
        projectId: project.id
      }, assignmentError as Error)
      // Don't fail the request, the project was created successfully
    }

    logger.info('Project created successfully', {
      action: 'create_project',
      userId: user.id,
      projectId: project.id,
      accountId
    })

    return NextResponse.json({ success: true, project }, { status: 201 })
  } catch (error) {
    logger.error('Error in POST /api/projects', { action: 'create_project' }, error as Error)
    return NextResponse.json({
      error: 'Internal server error',
      ...(config.errors.exposeDetails && { details: (error as Error).message })
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient(request)
    if (!supabase) {
      logger.error('Failed to create Supabase client', { action: 'get_projects' })
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get URL parameters
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam) : 10

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // Get user profile with roles to check permissions
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
      .eq('id', userId)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Check if user is superadmin (bypasses all permission checks)
    const userIsSuperadmin = isSuperadmin(userProfile)

    // Check VIEW_PROJECTS permission (superadmins bypass this)
    // CRITICAL: Pass authenticated supabase client for proper RLS context
    if (!userIsSuperadmin) {
      const canViewProjects = await hasPermission(userProfile, Permission.VIEW_PROJECTS, undefined, supabase)
      if (!canViewProjects) {
        return NextResponse.json({ error: 'Insufficient permissions to view projects' }, { status: 403 })
      }
    }

    // Check if user has VIEW_ALL_PROJECTS permission (superadmins get this by default)
    const hasViewAllProjects = userIsSuperadmin || await hasPermission(userProfile, Permission.VIEW_ALL_PROJECTS, undefined, supabase)

    // Build projects query
    let query = supabase
      .from('projects')
      .select(`
        *,
        account:accounts(*)
      `)
      .order('created_at', { ascending: false })

    if (!hasViewAllProjects) {
      // For users without VIEW_ALL_PROJECTS, get projects they have access to
      // 1. Projects they created
      // 2. Projects they're assigned to
      // 3. Projects via project_assignments
      // 4. Projects where they have tasks assigned

      // Get project IDs from project_assignments
      const { data: assignedProjects } = await supabase
        .from('project_assignments')
        .select('project_id')
        .eq('user_id', userId)
        .is('removed_at', null)

      // Get project IDs from tasks
      const { data: taskProjects } = await supabase
        .from('tasks')
        .select('project_id')
        .eq('assigned_to', userId)

      // Combine all project IDs
      const assignedProjectIds = assignedProjects?.map((p: any) => p.project_id) || []
      const taskProjectIds = taskProjects?.map((t: any) => t.project_id) || []
      const allProjectIds = [...new Set([...assignedProjectIds, ...taskProjectIds])]

      // Filter projects by: created by user, assigned to user, or in the combined list
      if (allProjectIds.length > 0) {
        query = query.or(`created_by.eq.${userId},assigned_user_id.eq.${userId},id.in.(${allProjectIds.join(',')})`)
      } else {
        query = query.or(`created_by.eq.${userId},assigned_user_id.eq.${userId}`)
      }
      query = query.limit(limit)
    }

    // Exclude completed projects - they go to "Finished Projects" on account page
    query = query.neq('status', 'complete')

    const { data: projects, error: queryError } = await query

    if (queryError) {
      logger.error('Failed to load projects', { action: 'get_projects', userId }, queryError as Error)
      return NextResponse.json({
        error: 'Failed to load projects',
        ...(config.errors.exposeDetails && { details: queryError.message })
      }, { status: 500 })
    }

    // Get departments for each project via project_assignments
    const projectIds = (projects || []).map((p: any) => p.id)
    const departmentsByProject: { [key: string]: any[] } = {}

    if (projectIds.length > 0) {
      // Fetch assignments and user roles in parallel
      const [assignmentsResult, tasksResult] = await Promise.all([
        supabase
          .from('project_assignments')
          .select('project_id, user_id')
          .in('project_id', projectIds)
          .is('removed_at', null),
        supabase
          .from('tasks')
          .select('project_id, remaining_hours, estimated_hours')
          .in('project_id', projectIds)
      ])

      const { data: assignments } = assignmentsResult
      const { data: tasksData } = tasksResult

      if (assignments && assignments.length > 0) {
        const userIds = Array.from(new Set(assignments.map((a: any) => a.user_id)))

        // Fetch user roles
        const { data: userRoles } = await supabase
          .from('user_roles')
          .select(`
            user_id,
            roles!user_roles_role_id_fkey (
              department_id,
              departments!roles_department_id_fkey (
                id,
                name
              )
            )
          `)
          .in('user_id', userIds)

        // Build a map of user_id to departments
        const userDepartments: { [key: string]: any[] } = {}
        if (userRoles) {
          userRoles.forEach((ur: any) => {
            if (!userDepartments[ur.user_id]) {
              userDepartments[ur.user_id] = []
            }
            const role = ur.roles
            if (role?.departments) {
              const dept = role.departments
              const exists = userDepartments[ur.user_id].some((d: any) => d.id === dept.id)
              if (!exists) {
                userDepartments[ur.user_id].push(dept)
              }
            }
          })
        }

        // Map departments to projects based on assigned users
        assignments.forEach((assignment: any) => {
          const projectId = assignment.project_id
          const userId = assignment.user_id

          if (!departmentsByProject[projectId]) {
            departmentsByProject[projectId] = []
          }

          const depts = userDepartments[userId] || []
          depts.forEach((dept: any) => {
            const exists = departmentsByProject[projectId].some((d: any) => d.id === dept.id)
            if (!exists) {
              departmentsByProject[projectId].push(dept)
            }
          })
        })
      }

      // Calculate remaining hours and task sum per project
      const projectRemainingHours: Record<string, number> = {}
      const projectTaskSum: Record<string, number> = {}
      if (tasksData) {
        tasksData.forEach((task: any) => {
          if (!projectRemainingHours[task.project_id]) {
            projectRemainingHours[task.project_id] = 0
          }
          if (!projectTaskSum[task.project_id]) {
            projectTaskSum[task.project_id] = 0
          }
          projectRemainingHours[task.project_id] += (task.remaining_hours || task.estimated_hours || 0)
          projectTaskSum[task.project_id] += (task.estimated_hours || 0)
        })
      }

      // Add departments and task data to projects
      const projectsWithDetails = (projects || []).map((project: any) => ({
        ...project,
        account: project.account || null,
        departments: departmentsByProject[project.id] || [],
        remaining_hours: projectRemainingHours[project.id] || null,
        task_hours_sum: projectTaskSum[project.id] || 0
      }))

      return NextResponse.json({
        success: true,
        projects: projectsWithDetails
      })
    }

    return NextResponse.json({
      success: true,
      projects: projects || []
    })
  } catch (error) {
    logger.error('Error in projects API', { action: 'get_projects' }, error as Error)
    return NextResponse.json({
      error: 'Internal server error',
      ...(config.errors.exposeDetails && { details: (error as Error).message })
    }, { status: 500 })
  }
}

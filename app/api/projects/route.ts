import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabaseClient } from '@/lib/supabase-server'
import { hasPermission, isSuperadmin } from '@/lib/rbac'
import { Permission } from '@/lib/permissions'
import { createProjectSchema, validateRequestBody } from '@/lib/validation-schemas'
import { logger } from '@/lib/debug-logger'
import { config } from '@/lib/config'

// Type definitions
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
      .eq('id', (user as any).id)
      .single()

    if (!userProfile) {
      logger.error('User profile not found', { action: 'create_project', userId: (user as any).id })
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Validate request body with Zod
    const body = await request.json()
    const validation = validateRequestBody(createProjectSchema, body)

    if (!validation.success) {
      logger.warn('Invalid project creation data', {
        action: 'create_project',
        userId: (user as any).id,
        error: validation.error
      })
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const { accountId } = validation.data

    // Check MANAGE_PROJECTS permission with account context (consolidated from CREATE_PROJECT)
    // CRITICAL: Pass authenticated supabase client for proper RLS context in permission checks
    const canManageProjects = await hasPermission(userProfile, Permission.MANAGE_PROJECTS, { accountId }, supabase)
    if (!canManageProjects) {
      logger.warn('Insufficient permissions to create project', {
        action: 'create_project',
        userId: (user as any).id,
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
        assigned_user_id: validation.data.assigned_user_id || (user as any).id,
        created_by: (user as any).id,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      logger.error('Failed to create project in database', {
        action: 'create_project',
        userId: (user as any).id,
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
        user_id: (user as any).id,
        role_in_project: 'Project Creator',
        assigned_at: new Date().toISOString(),
        assigned_by: (user as any).id,
        source_type: 'creator'
      })

    if (assignmentError) {
      logger.error('Failed to add creator to project assignments', {
        action: 'create_project',
        userId: (user as any).id,
        projectId: project.id
      }, assignmentError as Error)
      // Don't fail the request, the project was created successfully
    }

    logger.info('Project created successfully', {
      action: 'create_project',
      userId: (user as any).id,
      projectId: project.id,
      accountId
    })

    return NextResponse.json({ success: true, project }, { status: 201 })
  } catch (error: unknown) {
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
      // For users without VIEW_ALL_PROJECTS, ONLY show projects they're explicitly assigned to
      // This is stricter than RLS (which also allows viewing projects user created)
      // Dashboard should only show projects where user is a team member

      // Get project IDs from project_assignments (user is explicitly assigned)
      const { data: assignedProjects } = await supabase
        .from('project_assignments')
        .select('project_id')
        .eq('user_id', userId)
        .is('removed_at', null)

      // Get project IDs from tasks (user has tasks assigned)
      const { data: taskProjects } = await supabase
        .from('tasks')
        .select('project_id')
        .eq('assigned_to', userId)

      // Combine assigned project IDs only (NOT created_by)
      const assignedProjectIds = assignedProjects?.map((p: any) => p.project_id) || []
      const taskProjectIds = taskProjects?.map((t: any) => t.project_id) || []
      const allProjectIds = [...new Set([...assignedProjectIds, ...taskProjectIds])]

      // Only show projects user is explicitly assigned to
      if (allProjectIds.length > 0) {
        query = query.in('id', allProjectIds)
      } else {
        // No assigned projects - return empty
        return NextResponse.json({
          success: true,
          projects: []
        })
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
    const departmentsByProject: { [key: string]: Record<string, unknown>[] } = {}

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
        const userDepartments: { [key: string]: Record<string, unknown>[] } = {}
        if (userRoles) {
          userRoles.forEach((ur: any) => {
            const userId = ur.user_id as string;
            if (!userDepartments[userId]) {
              userDepartments[userId] = []
            }
            const role = ur.roles as Record<string, unknown>;
            const departments = role?.departments as Record<string, unknown>;
            if (departments) {
              const exists = userDepartments[userId].some((d: any) => d.id === departments.id)
              if (!exists) {
                userDepartments[userId].push(departments)
              }
            }
          })
        }

        // Map departments to projects based on assigned users
        assignments.forEach((assignment: any) => {
          const projectId = assignment.project_id as string;
          const userId = assignment.user_id as string;

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
          const projectId = task.project_id as string;
          if (!projectRemainingHours[projectId]) {
            projectRemainingHours[projectId] = 0
          }
          if (!projectTaskSum[projectId]) {
            projectTaskSum[projectId] = 0
          }
          projectRemainingHours[projectId] += ((task.remaining_hours as number) || (task.estimated_hours as number) || 0)
          projectTaskSum[projectId] += ((task.estimated_hours as number) || 0)
        })
      }

      // Add departments and task data to projects
      const projectsWithDetails = (projects || []).map((project: any) => {
        const projectId = project.id as string;
        return {
          ...project,
          account: project.account || null,
          departments: departmentsByProject[projectId] || [],
          remaining_hours: projectRemainingHours[projectId] || null,
          task_hours_sum: projectTaskSum[projectId] || 0
        };
      })

      return NextResponse.json({
        success: true,
        projects: projectsWithDetails
      })
    }

    return NextResponse.json({
      success: true,
      projects: projects || []
    })
  } catch (error: unknown) {
logger.error('Error in projects API', { action: 'get_projects' }, error as Error)
    return NextResponse.json({
      error: 'Internal server error',
      ...(config.errors.exposeDetails && { details: (error as Error).message })
    }, { status: 500 })
  }
}

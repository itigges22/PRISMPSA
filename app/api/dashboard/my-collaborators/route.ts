/**
 * API Route: My Collaborators Dashboard
 * Returns users sharing projects with the current user
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getUserProfileFromRequest } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

interface Collaborator {
  id: string;
  name: string;
  email: string;
  image?: string;
  role?: string;
  department?: string;
  sharedProjects: number;
  projectNames: string[];
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database connection not available' },
        { status: 500 }
      );
    }

    const userProfile = await getUserProfileFromRequest(supabase);
    if (!userProfile) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = userProfile.id;

    // Get projects user is assigned to (active projects only)
    const { data: userAssignments, error: assignmentError } = await supabase
      .from('project_assignments')
      .select(`
        project_id,
        projects(
          id,
          name,
          status
        )
      `)
      .eq('user_id', userId)
      .is('removed_at', null);

    if (assignmentError) {
      console.error('Error fetching user assignments:', assignmentError);
      return NextResponse.json(
        { error: 'Failed to fetch collaborators' },
        { status: 500 }
      );
    }

    // Filter to active projects only
    const activeProjectIds = userAssignments
      ?.filter((a: any) => {
        const project = Array.isArray(a.projects) ? a.projects[0] : a.projects;
        return project && ['planning', 'in_progress', 'review'].includes(project.status);
      })
      .map((a: any) => a.project_id) || [];

    // Create a map of projectId -> projectName
    const projectNameMap = new Map<string, string>();
    userAssignments?.forEach((a: any) => {
      const project = Array.isArray(a.projects) ? a.projects[0] : a.projects;
      if (project) {
        projectNameMap.set(a.project_id, project.name);
      }
    });

    if (activeProjectIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          collaborators: [],
          totalCollaborators: 0,
        },
      });
    }

    // Get all other users assigned to these projects
    // Use explicit FK reference to avoid ambiguity (user_id vs assigned_by)
    const { data: otherAssignments, error: otherError } = await supabase
      .from('project_assignments')
      .select(`
        project_id,
        user_id,
        user_profiles!project_assignments_user_id_fkey(
          id,
          name,
          email,
          image
        )
      `)
      .in('project_id', activeProjectIds)
      .neq('user_id', userId)
      .is('removed_at', null);

    if (otherError) {
      console.error('Error fetching other assignments:', otherError);
      return NextResponse.json(
        { error: 'Failed to fetch collaborators' },
        { status: 500 }
      );
    }

    // Build collaborator map
    const collaboratorMap = new Map<string, Collaborator>();

    for (const assignment of otherAssignments || []) {
      const user = Array.isArray(assignment.user_profiles)
        ? assignment.user_profiles[0]
        : assignment.user_profiles;

      if (!user) continue;

      const existingCollaborator = collaboratorMap.get(user.id);
      const projectName = projectNameMap.get(assignment.project_id) || '';

      if (existingCollaborator) {
        existingCollaborator.sharedProjects++;
        if (projectName && !existingCollaborator.projectNames.includes(projectName)) {
          existingCollaborator.projectNames.push(projectName);
        }
      } else {
        collaboratorMap.set(user.id, {
          id: user.id,
          name: user.name || user.email,
          email: user.email,
          image: user.image,
          sharedProjects: 1,
          projectNames: projectName ? [projectName] : [],
        });
      }
    }

    // Get roles for collaborators
    const collaboratorIds = Array.from(collaboratorMap.keys());

    if (collaboratorIds.length > 0) {
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          roles(
            name,
            departments(name)
          )
        `)
        .in('user_id', collaboratorIds);

      // Add role/department info
      userRoles?.forEach((ur: any) => {
        const collaborator = collaboratorMap.get(ur.user_id);
        if (collaborator) {
          const role = Array.isArray(ur.roles) ? ur.roles[0] : ur.roles;
          if (role) {
            collaborator.role = role.name;
            const dept = Array.isArray(role.departments) ? role.departments[0] : role.departments;
            collaborator.department = dept?.name;
          }
        }
      });
    }

    // Convert to array and sort by shared projects count
    const collaborators = Array.from(collaboratorMap.values())
      .sort((a, b) => b.sharedProjects - a.sharedProjects);

    return NextResponse.json({
      success: true,
      data: {
        collaborators,
        totalCollaborators: collaborators.length,
      },
    });

  } catch (error: unknown) {
    console.error('Error in GET /api/dashboard/my-collaborators:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: (error as Error).message },
      { status: 500 }
    );
  }
}

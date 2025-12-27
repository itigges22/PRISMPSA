/**
 * API Route: Network Analytics
 * Returns nodes and edges for network graph visualization
 * Shows relationships between users, projects, and accounts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getUserProfileFromRequest } from '@/lib/supabase-server';
import { subDays, format } from 'date-fns';

interface ErrorWithMessage extends Error {
  message: string;
  status?: number;
}

interface NetworkNode {
  id: string;
  type: 'user' | 'project' | 'account' | 'department';
  label: string;
  data: {
    hoursLogged?: number;
    utilization?: number;
    status?: string;
    projectCount?: number;
    userCount?: number;
    serviceTier?: string;
    role?: string;
    email?: string;
  };
  size: number;
  position?: { x: number; y: number };
}

interface NetworkEdge {
  id: string;
  source: string;
  target: string;
  type: 'assignment' | 'belongs_to' | 'member_of';
  data: {
    weight: number;
    hoursContributed?: number;
    label?: string;
  };
}

export const dynamic = 'force-dynamic';
export const revalidate = 120;

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

    const { searchParams } = new URL(request.url);
    const departmentFilter = searchParams.get('departmentId');
    const accountFilter = searchParams.get('accountId');
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');

    // Fetch all data in parallel
    const [
      usersData,
      projectsData,
      accountsData,
      departmentsData,
      projectAssignmentsData,
      accountMembersData,
      timeEntriesData,
      rolesData,
      userRolesData,
    ] = await Promise.all([
      supabase.from('user_profiles').select('id, name, email'),
      supabase.from('projects').select('id, name, status, account_id, estimated_hours'),
      supabase.from('accounts').select('id, name, status, service_tier'),
      supabase.from('departments').select('id, name'),
      supabase.from('project_assignments').select('id, project_id, user_id').is('removed_at', null),
      supabase.from('account_members').select('id, account_id, user_id'),
      supabase
        .from('time_entries')
        .select('user_id, project_id, hours_logged')
        .gte('entry_date', thirtyDaysAgo),
      supabase.from('roles').select('id, name, department_id'),
      supabase.from('user_roles').select('user_id, role_id'),
    ]);

    const users = usersData.data || [];
    let projects = projectsData.data || [];
    let accounts = accountsData.data || [];
    const _departments = departmentsData.data || [];
    const projectAssignments = projectAssignmentsData.data || [];
    const _accountMembers = accountMembersData.data || [];
    const timeEntries = timeEntriesData.data || [];
    const roles = rolesData.data || [];
    const userRoles = userRolesData.data || [];

    // Filter by status if needed
    if (!includeInactive) {
      projects = projects.filter((p: any) => p.status !== 'complete');
      accounts = accounts.filter((a: any) => a.status === 'active');
    }

    // Apply filters
    if (accountFilter) {
      const accountProjects = projects.filter((p: any) => p.account_id === accountFilter);
      projects = accountProjects;
      accounts = accounts.filter((a: any) => a.id === accountFilter);
    }

    if (departmentFilter) {
      const deptRoleIds = roles
        .filter((r: any) => r.department_id === departmentFilter)
        .map((r: any) => r.id);
      const deptUserIds = userRoles
        .filter((ur: any) => deptRoleIds.includes(ur.role_id))
        .map((ur: any) => ur.user_id);
      const relevantAssignments = projectAssignments.filter((pa: any) =>
        deptUserIds.includes(pa.user_id)
      );
      const projectIds = [...new Set(relevantAssignments.map((pa: any) => pa.project_id))];
      projects = projects.filter((p: any) => projectIds.includes(p.id));
    }

    // Calculate user hours
    const userHoursMap = new Map<string, number>();
    const userProjectHoursMap = new Map<string, Map<string, number>>();

    timeEntries.forEach((te: any) => {
      // Total hours per user
      const currentTotal = userHoursMap.get(te.user_id) || 0;
      userHoursMap.set(te.user_id, currentTotal + (te.hours_logged || 0));

      // Hours per user per project
      if (!userProjectHoursMap.has(te.user_id)) {
        userProjectHoursMap.set(te.user_id, new Map());
      }
      const userProjects = userProjectHoursMap.get(te.user_id)!;
      const currentProjectHours = userProjects.get(te.project_id) || 0;
      userProjects.set(te.project_id, currentProjectHours + (te.hours_logged || 0));
    });

    // Calculate account project counts
    const accountProjectCounts = new Map<string, number>();
    projects.forEach((p: any) => {
      if (p.account_id) {
        const current = accountProjectCounts.get(p.account_id) || 0;
        accountProjectCounts.set(p.account_id, current + 1);
      }
    });

    // Build nodes
    const nodes: NetworkNode[] = [];
    const edges: NetworkEdge[] = [];
    const addedNodeIds = new Set<string>();

    // Get users who are assigned to the filtered projects
    const relevantProjectIds = new Set(projects.map((p: any) => p.id));
    const relevantUserIds = new Set(
      projectAssignments
        .filter((pa: any) => relevantProjectIds.has(pa.project_id))
        .map((pa: any) => pa.user_id)
    );

    // Add user nodes
    users.forEach((user: any) => {
      if (!relevantUserIds.has(user.id)) return;

      const hoursLogged = userHoursMap.get(user.id) || 0;
      const userRole = userRoles.find((ur: any) => ur.user_id === user.id);
      const role = userRole ? roles.find((r: any) => r.id === userRole.role_id) : null;

      // Size based on hours logged (min 30, max 60)
      const size = Math.min(60, Math.max(30, 30 + hoursLogged / 5));

      nodes.push({
        id: `user-${user.id}`,
        type: 'user',
        label: user.name?.split(' ')[0] || user.email?.split('@')[0] || 'Unknown',
        data: {
          hoursLogged: Math.round(hoursLogged * 10) / 10,
          email: user.email,
          role: role?.name,
        },
        size,
      });
      addedNodeIds.add(`user-${user.id}`);
    });

    // Add project nodes
    projects.forEach((project: any) => {
      // Size based on estimated hours (min 40, max 80)
      const estimatedHours = project.estimated_hours || 0;
      const size = Math.min(80, Math.max(40, 40 + estimatedHours / 10));

      nodes.push({
        id: `project-${project.id}`,
        type: 'project',
        label: project.name?.length > 15 ? project.name.substring(0, 12) + '...' : project.name,
        data: {
          status: project.status,
        },
        size,
      });
      addedNodeIds.add(`project-${project.id}`);
    });

    // Add account nodes
    const relevantAccountIds = new Set(projects.map((p: any) => p.account_id).filter(Boolean));
    accounts.forEach((account: any) => {
      if (!relevantAccountIds.has(account.id)) return;

      const projectCount = accountProjectCounts.get(account.id) || 0;
      // Size based on project count (min 50, max 100)
      const size = Math.min(100, Math.max(50, 50 + projectCount * 10));

      nodes.push({
        id: `account-${account.id}`,
        type: 'account',
        label: account.name?.length > 12 ? account.name.substring(0, 9) + '...' : account.name,
        data: {
          projectCount,
          serviceTier: account.service_tier,
          status: account.status,
        },
        size,
      });
      addedNodeIds.add(`account-${account.id}`);
    });

    // Add edges: User -> Project (assignment)
    projectAssignments.forEach((pa: any) => {
      const userId = `user-${pa.user_id}`;
      const projectId = `project-${pa.project_id}`;

      if (!addedNodeIds.has(userId) || !addedNodeIds.has(projectId)) return;

      const userProjectHours = userProjectHoursMap.get(pa.user_id)?.get(pa.project_id) || 0;

      edges.push({
        id: `edge-${pa.id}`,
        source: userId,
        target: projectId,
        type: 'assignment',
        data: {
          weight: Math.max(1, Math.min(5, userProjectHours / 10)),
          hoursContributed: Math.round(userProjectHours * 10) / 10,
        },
      });
    });

    // Add edges: Project -> Account (belongs_to)
    projects.forEach((project: any) => {
      if (!project.account_id) return;

      const projectId = `project-${project.id}`;
      const accountId = `account-${project.account_id}`;

      if (!addedNodeIds.has(projectId) || !addedNodeIds.has(accountId)) return;

      edges.push({
        id: `edge-project-account-${project.id}`,
        source: projectId,
        target: accountId,
        type: 'belongs_to',
        data: {
          weight: 2,
        },
      });
    });

    // Calculate metadata
    const userNodes = nodes.filter(n => n.type === 'user');
    const projectNodes = nodes.filter(n => n.type === 'project');
    const accountNodes = nodes.filter(n => n.type === 'account');

    return NextResponse.json({
      success: true,
      data: {
        nodes,
        edges,
        metadata: {
          totalUsers: userNodes.length,
          totalProjects: projectNodes.length,
          totalAccounts: accountNodes.length,
          totalEdges: edges.length,
        },
      },
    });

  } catch (error: unknown) {
    const err = error as ErrorWithMessage;
    console.error('Error in GET /api/analytics/network:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: err.message },
      { status: 500 }
    );
  }
}

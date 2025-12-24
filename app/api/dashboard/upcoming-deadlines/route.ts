/**
 * API Route: Upcoming Deadlines
 * Returns tasks with due dates in the next 14 days
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getUserProfileFromRequest } from '@/lib/supabase-server';
import { format, addDays, differenceInDays, isPast, isToday } from 'date-fns';

export const dynamic = 'force-dynamic';

interface DeadlineItem {
  id: string;
  name: string;
  dueDate: string;
  dueDateLabel: string;
  projectName: string;
  projectId: string;
  status: string;
  priority: string;
  isOverdue: boolean;
  isDueToday: boolean;
  daysUntilDue: number;
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
    const now = new Date();
    const twoWeeksFromNow = addDays(now, 14);
    const futureStr = format(twoWeeksFromNow, 'yyyy-MM-dd');

    // Get tasks assigned to user with due dates (including overdue - no max date filter)
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select(`
        id,
        name,
        due_date,
        status,
        priority,
        project_id,
        projects(id, name)
      `)
      .eq('assigned_to', userId)
      .not('status', 'eq', 'done')
      .not('due_date', 'is', null)
      .order('due_date', { ascending: true })
      .limit(20);

    if (tasksError) {
      console.error('Error fetching task deadlines:', tasksError);
    }

    // Also get projects assigned to user with end dates (including overdue)
    const { data: assignments } = await supabase
      .from('project_assignments')
      .select('project_id')
      .eq('user_id', userId)
      .is('removed_at', null);

    const projectIds = assignments?.map((a: any) => a.project_id) || [];

    let projects: any[] = [];
    if (projectIds.length > 0) {
      // Get projects with end dates (including overdue - no max date filter)
      const { data: projectData, error: projectsError } = await supabase
        .from('projects')
        .select('id, name, end_date, status, priority, account_id, accounts(name)')
        .in('id', projectIds)
        .not('status', 'eq', 'complete')
        .not('end_date', 'is', null)
        .order('end_date', { ascending: true })
        .limit(20);

      if (projectsError) {
        console.error('Error fetching project deadlines:', projectsError);
      } else {
        projects = projectData || [];
      }
    }

    const deadlines: DeadlineItem[] = [];

    // Add task deadlines
    (tasks || []).forEach((task: any) => {
      const dueDate = new Date(task.due_date);
      const daysUntil = differenceInDays(dueDate, now);
      const project = Array.isArray(task.projects) ? task.projects[0] : task.projects;

      let dueDateLabel = format(dueDate, 'MMM d');
      if (isToday(dueDate)) {
        dueDateLabel = 'Today';
      } else if (isPast(dueDate)) {
        dueDateLabel = `${Math.abs(daysUntil)} day${Math.abs(daysUntil) !== 1 ? 's' : ''} overdue`;
      } else if (daysUntil === 1) {
        dueDateLabel = 'Tomorrow';
      } else if (daysUntil <= 7) {
        dueDateLabel = `In ${daysUntil} days`;
      }

      deadlines.push({
        id: task.id,
        name: task.name,
        dueDate: task.due_date,
        dueDateLabel,
        projectName: project?.name || 'No Project',
        projectId: task.project_id,
        status: task.status,
        priority: task.priority,
        isOverdue: isPast(dueDate) && !isToday(dueDate),
        isDueToday: isToday(dueDate),
        daysUntilDue: daysUntil,
      });
    });

    // Add project deadlines
    projects.forEach((project: any) => {
      const dueDate = new Date(project.end_date);
      const daysUntil = differenceInDays(dueDate, now);
      const account = Array.isArray(project.accounts) ? project.accounts[0] : project.accounts;

      let dueDateLabel = format(dueDate, 'MMM d');
      if (isToday(dueDate)) {
        dueDateLabel = 'Today';
      } else if (isPast(dueDate)) {
        dueDateLabel = `${Math.abs(daysUntil)} day${Math.abs(daysUntil) !== 1 ? 's' : ''} overdue`;
      } else if (daysUntil === 1) {
        dueDateLabel = 'Tomorrow';
      } else if (daysUntil <= 7) {
        dueDateLabel = `In ${daysUntil} days`;
      }

      deadlines.push({
        id: `project-${project.id}`,
        name: `📁 ${project.name}`,
        dueDate: project.end_date,
        dueDateLabel,
        projectName: account?.name || 'No Account',
        projectId: project.id,
        status: project.status,
        priority: project.priority || 'medium',
        isOverdue: isPast(dueDate) && !isToday(dueDate),
        isDueToday: isToday(dueDate),
        daysUntilDue: daysUntil,
      });
    });

    // Sort by due date (overdue first, then by date)
    deadlines.sort((a, b) => {
      // Overdue items first
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      // Then by due date
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    // Count by urgency
    const overdueCount = deadlines.filter(d => d.isOverdue).length;
    const dueTodayCount = deadlines.filter(d => d.isDueToday).length;
    const thisWeekCount = deadlines.filter(d => !d.isOverdue && !d.isDueToday && d.daysUntilDue <= 7).length;

    return NextResponse.json({
      success: true,
      data: {
        deadlines,
        overdueCount,
        dueTodayCount,
        thisWeekCount,
        totalCount: deadlines.length,
      },
    });

  } catch (error: unknown) {
    console.error('Error in GET /api/dashboard/upcoming-deadlines:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: (error as Error).message },
      { status: 500 }
    );
  }
}

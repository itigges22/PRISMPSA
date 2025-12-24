/**
 * API Route: Recent Activity
 * Returns recent activity items for the user (tasks, time entries, project updates)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getUserProfileFromRequest } from '@/lib/supabase-server';
import { format, formatDistanceToNow } from 'date-fns';

export const dynamic = 'force-dynamic';

interface ActivityItem {
  id: string;
  type: 'task_completed' | 'task_assigned' | 'time_logged' | 'project_update' | 'task_created';
  title: string;
  description: string;
  timestamp: string;
  timeAgo: string;
  projectName?: string;
  projectId?: string;
  metadata?: Record<string, any>;
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
    const activities: ActivityItem[] = [];

    // Get recent completed tasks (last 7 days)
    const { data: completedTasks } = await supabase
      .from('tasks')
      .select(`
        id,
        name,
        updated_at,
        project_id,
        projects(id, name)
      `)
      .eq('assigned_to', userId)
      .eq('status', 'done')
      .order('updated_at', { ascending: false })
      .limit(5);

    completedTasks?.forEach((task: any) => {
      const project = Array.isArray(task.projects) ? task.projects[0] : task.projects;
      activities.push({
        id: `task-completed-${task.id}`,
        type: 'task_completed',
        title: 'Completed task',
        description: task.name,
        timestamp: task.updated_at,
        timeAgo: formatDistanceToNow(new Date(task.updated_at), { addSuffix: true }),
        projectName: project?.name,
        projectId: task.project_id,
      });
    });

    // Get recent time entries (last 7 days)
    const { data: timeEntries } = await supabase
      .from('time_entries')
      .select(`
        id,
        hours_logged,
        entry_date,
        created_at,
        project_id,
        task_id,
        projects(id, name),
        tasks(id, name)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    timeEntries?.forEach((entry: any) => {
      const project = Array.isArray(entry.projects) ? entry.projects[0] : entry.projects;
      const task = Array.isArray(entry.tasks) ? entry.tasks[0] : entry.tasks;
      activities.push({
        id: `time-${entry.id}`,
        type: 'time_logged',
        title: `Logged ${entry.hours_logged}h`,
        description: task?.name || project?.name || 'Time entry',
        timestamp: entry.created_at,
        timeAgo: formatDistanceToNow(new Date(entry.created_at), { addSuffix: true }),
        projectName: project?.name,
        projectId: entry.project_id,
        metadata: {
          hours: entry.hours_logged,
          date: entry.entry_date,
        },
      });
    });

    // Get recent project updates from user's projects
    const { data: projectUpdates } = await supabase
      .from('project_updates')
      .select(`
        id,
        content,
        created_at,
        project_id,
        projects(id, name)
      `)
      .eq('created_by', userId)
      .order('created_at', { ascending: false })
      .limit(3);

    projectUpdates?.forEach((update: any) => {
      const project = Array.isArray(update.projects) ? update.projects[0] : update.projects;
      activities.push({
        id: `update-${update.id}`,
        type: 'project_update',
        title: 'Posted update',
        description: update.content.slice(0, 100) + (update.content.length > 100 ? '...' : ''),
        timestamp: update.created_at,
        timeAgo: formatDistanceToNow(new Date(update.created_at), { addSuffix: true }),
        projectName: project?.name,
        projectId: update.project_id,
      });
    });

    // Get recently created tasks assigned to user
    const { data: newTasks } = await supabase
      .from('tasks')
      .select(`
        id,
        name,
        created_at,
        project_id,
        projects(id, name)
      `)
      .eq('assigned_to', userId)
      .not('status', 'eq', 'done')
      .order('created_at', { ascending: false })
      .limit(3);

    newTasks?.forEach((task: any) => {
      const project = Array.isArray(task.projects) ? task.projects[0] : task.projects;
      activities.push({
        id: `task-created-${task.id}`,
        type: 'task_assigned',
        title: 'New task assigned',
        description: task.name,
        timestamp: task.created_at,
        timeAgo: formatDistanceToNow(new Date(task.created_at), { addSuffix: true }),
        projectName: project?.name,
        projectId: task.project_id,
      });
    });

    // Sort all activities by timestamp
    activities.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Take top 10
    const recentActivities = activities.slice(0, 10);

    return NextResponse.json({
      success: true,
      data: {
        activities: recentActivities,
        totalCount: recentActivities.length,
      },
    });

  } catch (error: unknown) {
    console.error('Error in GET /api/dashboard/recent-activity:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: (error as Error).message },
      { status: 500 }
    );
  }
}

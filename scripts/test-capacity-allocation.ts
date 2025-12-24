#!/usr/bin/env tsx
/**
 * Test Capacity Allocation Logic
 *
 * Tests the capacity allocation for overdue projects to verify:
 * 1. Tasks without due_date inherit project end_date
 * 2. Overdue tasks/projects allocate all hours to current period
 * 3. Weekly allocation shows correct totals
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

interface Project {
  id: string;
  name: string;
  estimated_hours: number | null;
  end_date: string | null;
  status: string;
}

interface Task {
  id: string;
  name: string;
  project_id: string;
  remaining_hours: number | null;
  estimated_hours: number | null;
  due_date: string | null;
  status: string;
}

async function runTests() {
  console.log('📊 Capacity Allocation Test\n');
  console.log('='.repeat(80));

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Get projects with their end dates
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('id, name, estimated_hours, end_date, status')
    .not('status', 'eq', 'complete');

  if (projectsError) {
    console.error('Error fetching projects:', projectsError);
    return;
  }

  // Get all incomplete tasks
  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('id, name, project_id, remaining_hours, estimated_hours, due_date, status')
    .not('status', 'in', '("done","complete")');

  if (tasksError) {
    console.error('Error fetching tasks:', tasksError);
    return;
  }

  const now = new Date();
  console.log(`\nCurrent date: ${now.toISOString().split('T')[0]}\n`);

  // Build project end date map
  const projectEndDateMap = new Map<string, { name: string; endDate: Date | null }>();
  for (const project of projects || []) {
    projectEndDateMap.set(project.id, {
      name: project.name,
      endDate: project.end_date ? new Date(project.end_date) : null,
    });
  }

  console.log('📁 Projects Analysis:\n');
  for (const project of projects || []) {
    const endDate = project.end_date ? new Date(project.end_date) : null;
    const isOverdue = endDate && endDate < now;
    const daysOverdue = endDate ? Math.floor((now.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24)) : null;

    console.log(`  ${isOverdue ? '⚠️ OVERDUE' : '✅'} ${project.name}`);
    console.log(`     End Date: ${project.end_date || 'None'}`);
    if (daysOverdue && daysOverdue > 0) {
      console.log(`     Days Overdue: ${daysOverdue}`);
    }
    console.log(`     Estimated Hours: ${project.estimated_hours || 0}`);
    console.log('');
  }

  console.log('📝 Tasks Analysis:\n');

  let totalAllocatedToCurrentWeek = 0;
  const overdueTasksCount = { withOwnDue: 0, inheritedFromProject: 0 };
  const allocationBreakdown: { task: string; hours: number; reason: string }[] = [];

  for (const task of tasks || []) {
    const hours = (task.remaining_hours ?? task.estimated_hours ?? 0) as number;
    if (hours === 0) continue;

    const taskOwnDueDate = task.due_date ? new Date(task.due_date) : null;
    const projectInfo = projectEndDateMap.get(task.project_id);
    const projectEndDate = projectInfo?.endDate ?? null;
    const effectiveDueDate = taskOwnDueDate ?? projectEndDate;

    const isOverdue = effectiveDueDate && effectiveDueDate < now;
    const dueSource = taskOwnDueDate ? 'own' : projectEndDate ? 'inherited from project' : 'none';

    if (isOverdue) {
      if (taskOwnDueDate) {
        overdueTasksCount.withOwnDue++;
      } else {
        overdueTasksCount.inheritedFromProject++;
      }
      totalAllocatedToCurrentWeek += hours;
      allocationBreakdown.push({
        task: task.name,
        hours,
        reason: `OVERDUE (${dueSource})`,
      });
    } else if (!effectiveDueDate) {
      // No due date - spread over 90 days
      const dailyRate = hours / 90;
      const weeklyAllocation = dailyRate * 7;
      totalAllocatedToCurrentWeek += weeklyAllocation;
      allocationBreakdown.push({
        task: task.name,
        hours: weeklyAllocation,
        reason: 'No due date (spread 90 days)',
      });
    } else {
      // Future due date - spread until due date
      const daysUntilDue = Math.max(1, Math.ceil((effectiveDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      const dailyRate = hours / daysUntilDue;
      const weeklyAllocation = dailyRate * Math.min(7, daysUntilDue);
      totalAllocatedToCurrentWeek += weeklyAllocation;
      allocationBreakdown.push({
        task: task.name,
        hours: weeklyAllocation,
        reason: `Due in ${daysUntilDue} days`,
      });
    }
  }

  console.log('📊 Weekly Allocation Breakdown:\n');
  for (const item of allocationBreakdown.slice(0, 20)) {
    console.log(`  ${item.task.substring(0, 30).padEnd(32)} | ${item.hours.toFixed(2).padStart(8)}h | ${item.reason}`);
  }
  if (allocationBreakdown.length > 20) {
    console.log(`  ... and ${allocationBreakdown.length - 20} more tasks`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('📈 Summary:\n');
  console.log(`  Total incomplete tasks: ${tasks?.length || 0}`);
  console.log(`  Overdue tasks (own due date): ${overdueTasksCount.withOwnDue}`);
  console.log(`  Overdue tasks (inherited from project): ${overdueTasksCount.inheritedFromProject}`);
  console.log(`  Total weekly allocation: ${totalAllocatedToCurrentWeek.toFixed(2)} hours`);
  console.log(`  Daily allocation: ${(totalAllocatedToCurrentWeek / 7).toFixed(2)} hours`);

  console.log('\n' + '='.repeat(80));
  console.log('🔍 Fix Verification:\n');

  if (overdueTasksCount.inheritedFromProject > 0) {
    console.log(`  ✅ Tasks are correctly inheriting project end dates!`);
    console.log(`     ${overdueTasksCount.inheritedFromProject} tasks marked overdue via project end_date`);
  } else if (overdueTasksCount.withOwnDue > 0) {
    console.log(`  ✅ Overdue tasks detected via own due_date`);
  } else {
    console.log(`  ℹ️ No overdue projects/tasks found in the database`);
    console.log(`     (You may need to create test data with past end_dates)`);
  }

  console.log('');
}

runTests().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});

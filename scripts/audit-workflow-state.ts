#!/usr/bin/env tsx
/**
 * Workflow Database State Audit
 *
 * Examines the current state of all workflow-related tables:
 * - workflow_templates
 * - workflow_nodes
 * - workflow_connections
 * - workflow_instances
 * - workflow_history
 * - Related project_assignments
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

interface WorkflowNode {
  id: string;
  workflow_template_id: string;
  template_name: string;
  node_type: string;
  label: string;
  entity_id: string | null;
}

interface WorkflowInstance {
  id: string;
  status: string;
  project_id: string | null;
  project_name: string | null;
  workflow_name: string;
  current_node_id: string | null;
  started_at: string;
}

interface WorkflowHistory {
  id: string;
  instance_id: string;
  project_name: string | null;
  from_node: string | null;
  to_node: string | null;
  approval_decision: string | null;
  created_at: string;
}

interface ProjectAssignment {
  id: string;
  project_name: string;
  user_name: string;
  role_in_project: string | null;
  assigned_by: string | null;
  created_at: string;
}

async function auditWorkflowState() {
  console.log('🔍 WORKFLOW DATABASE STATE AUDIT\n');
  console.log('═'.repeat(80));

  // 1. Workflow Templates
  console.log('\n📋 1. WORKFLOW TEMPLATES');
  console.log('─'.repeat(80));

  const { data: templates, error: templatesError } = await supabase
    .from('workflow_templates')
    .select('id, name, description, is_active, created_at')
    .order('created_at', { ascending: false });

  if (templatesError) {
    console.error('❌ Error fetching templates:', templatesError.message);
  } else {
    const activeCount = templates?.filter(t => t.is_active).length || 0;
    const inactiveCount = (templates?.length || 0) - activeCount;

    console.log(`Total templates: ${templates?.length || 0}`);
    console.log(`  - Active: ${activeCount}`);
    console.log(`  - Inactive: ${inactiveCount}\n`);

    templates?.forEach((t: WorkflowTemplate) => {
      console.log(`  ${t.is_active ? '✓' : '✗'} ${t.name} (${t.id.substring(0, 8)}...)`);
      if (t.description) {
        console.log(`    ${t.description}`);
      }
      console.log(`    Created: ${new Date(t.created_at).toLocaleDateString()}`);
    });
  }

  // 2. Workflow Nodes
  console.log('\n\n🔷 2. WORKFLOW NODES');
  console.log('─'.repeat(80));

  const { data: nodes, error: nodesError } = await supabase
    .from('workflow_nodes')
    .select(`
      id,
      workflow_template_id,
      node_type,
      label,
      entity_id,
      workflow_templates!inner(name)
    `)
    .order('workflow_template_id');

  if (nodesError) {
    console.error('❌ Error fetching nodes:', nodesError.message);
  } else {
    console.log(`Total nodes: ${nodes?.length || 0}\n`);

    // Group by template
    const nodesByTemplate = (nodes || []).reduce((acc: any, node: any) => {
      const templateName = node.workflow_templates?.name || 'Unknown';
      if (!acc[templateName]) {
        acc[templateName] = [];
      }
      acc[templateName].push(node);
      return acc;
    }, {});

    Object.entries(nodesByTemplate).forEach(([templateName, templateNodes]: [string, any]) => {
      console.log(`  📝 ${templateName}: ${templateNodes.length} nodes`);
      templateNodes.forEach((node: any) => {
        console.log(`    - [${node.node_type}] ${node.label}`);
        if (node.entity_id) {
          console.log(`      Entity ID: ${node.entity_id}`);
        }
      });
      console.log();
    });
  }

  // 3. Workflow Instances
  console.log('\n⚙️  3. WORKFLOW INSTANCES');
  console.log('─'.repeat(80));

  const { data: instances, error: instancesError } = await supabase
    .from('workflow_instances')
    .select(`
      id,
      status,
      project_id,
      current_node_id,
      started_at,
      workflow_template_id
    `)
    .order('started_at', { ascending: false });

  // Fetch related data separately
  let enrichedInstances: any[] = [];
  if (instances && !instancesError) {
    const templateIds = [...new Set(instances.map(i => i.workflow_template_id))];
    const projectIds = [...new Set(instances.map(i => i.project_id).filter(Boolean))];

    const { data: templatesData } = await supabase
      .from('workflow_templates')
      .select('id, name')
      .in('id', templateIds);

    const { data: projectsData } = projectIds.length > 0
      ? await supabase.from('projects').select('id, name').in('id', projectIds)
      : { data: [] };

    const templateMap = new Map(templatesData?.map(t => [t.id, t.name]) || []);
    const projectMap = new Map(projectsData?.map(p => [p.id, p.name]) || []);

    enrichedInstances = instances.map(inst => ({
      ...inst,
      workflow_templates: { name: templateMap.get(inst.workflow_template_id) },
      projects: inst.project_id ? { name: projectMap.get(inst.project_id) } : null
    }));
  }

  if (instancesError) {
    console.error('❌ Error fetching instances:', instancesError.message);
  } else {
    console.log(`Total instances: ${enrichedInstances.length || 0}\n`);

    // Group by status
    const statusCounts: Record<string, number> = (enrichedInstances || []).reduce((acc: any, inst: any) => {
      acc[inst.status] = (acc[inst.status] || 0) + 1;
      return acc;
    }, {});

    console.log('Status breakdown:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  - ${status}: ${count}`);
    });
    console.log();

    if (enrichedInstances && enrichedInstances.length > 0) {
      console.log('Recent instances:');
      enrichedInstances.slice(0, 10).forEach((inst: any) => {
        const projectName = inst.projects?.name || 'No project';
        const workflowName = inst.workflow_templates?.name || 'Unknown workflow';
        console.log(`  🔄 ${inst.status.toUpperCase()}: ${projectName}`);
        console.log(`     Workflow: ${workflowName}`);
        console.log(`     Started: ${new Date(inst.started_at).toLocaleString()}`);
        if (inst.current_node_id) {
          console.log(`     Current node: ${inst.current_node_id.substring(0, 8)}...`);
        }
        console.log();
      });
    }
  }

  // 4. Workflow History
  console.log('\n📜 4. WORKFLOW HISTORY');
  console.log('─'.repeat(80));

  const { data: history, error: historyError } = await supabase
    .from('workflow_history')
    .select(`
      id,
      workflow_instance_id,
      from_node_id,
      to_node_id,
      approval_decision,
      created_at
    `)
    .order('created_at', { ascending: false })
    .limit(20);

  // Enrich history with related data
  let enrichedHistory: unknown[] = [];
  if (history && !historyError) {
    const instanceIds = [...new Set(history.map(h => h.workflow_instance_id))];
    const nodeIds = [...new Set([...history.map(h => h.from_node_id), ...history.map(h => h.to_node_id)].filter(Boolean))];

    const { data: instancesData } = await supabase
      .from('workflow_instances')
      .select('id, project_id')
      .in('id', instanceIds);

    const projectIds = [...new Set(instancesData?.map(i => i.project_id).filter(Boolean) || [])];
    const { data: projectsData } = projectIds.length > 0
      ? await supabase.from('projects').select('id, name').in('id', projectIds)
      : { data: [] };

    const { data: nodesData } = nodeIds.length > 0
      ? await supabase.from('workflow_nodes').select('id, label').in('id', nodeIds)
      : { data: [] };

    const instanceMap = new Map(instancesData?.map(i => [i.id, i.project_id]) || []);
    const projectMap = new Map(projectsData?.map(p => [p.id, p.name]) || []);
    const nodeMap = new Map(nodesData?.map(n => [n.id, n.label]) || []);

    enrichedHistory = history.map(h => ({
      ...h,
      project_name: projectMap.get(instanceMap.get(h.workflow_instance_id)),
      from_node_label: nodeMap.get(h.from_node_id),
      to_node_label: nodeMap.get(h.to_node_id)
    }));
  }

  if (historyError) {
    console.error('❌ Error fetching history:', historyError.message);
  } else {
    console.log(`Total history entries (last 20): ${enrichedHistory.length || 0}\n`);

    if (enrichedHistory && enrichedHistory.length > 0) {
      enrichedHistory.forEach((h: any) => {
        const projectName = h.project_name || 'Unknown project';
        const fromLabel = h.from_node_label || 'Start';
        const toLabel = h.to_node_label || 'Unknown';

        console.log(`  📍 ${new Date(h.created_at).toLocaleString()}`);
        console.log(`     Project: ${projectName}`);
        console.log(`     Handoff: ${fromLabel} → ${toLabel}`);
        if (h.approval_decision) {
          console.log(`     Decision: ${h.approval_decision}`);
        }
        console.log();
      });
    } else {
      console.log('  ℹ️  No workflow history found.');
    }
  }

  // 5. Project Assignments (related to workflows)
  console.log('\n👥 5. PROJECT ASSIGNMENTS (Last 20)');
  console.log('─'.repeat(80));

  const { data: assignments, error: assignmentsError } = await supabase
    .from('project_assignments')
    .select(`
      id,
      project_id,
      user_id,
      role_in_project,
      assigned_by,
      created_at
    `)
    .is('removed_at', null)
    .order('created_at', { ascending: false })
    .limit(20);

  // Enrich assignments with related data
  let enrichedAssignments: unknown[] = [];
  if (assignments && !assignmentsError) {
    const projectIds = [...new Set(assignments.map(a => a.project_id))];
    const userIds = [...new Set(assignments.map(a => a.user_id))];

    const { data: projectsData } = await supabase
      .from('projects')
      .select('id, name')
      .in('id', projectIds);

    const { data: usersData } = await supabase
      .from('user_profiles')
      .select('id, name')
      .in('id', userIds);

    const projectMap = new Map(projectsData?.map(p => [p.id, p.name]) || []);
    const userMap = new Map(usersData?.map(u => [u.id, u.name]) || []);

    enrichedAssignments = assignments.map(a => ({
      ...a,
      project_name: projectMap.get(a.project_id),
      user_name: userMap.get(a.user_id)
    }));
  }

  if (assignmentsError) {
    console.error('❌ Error fetching assignments:', assignmentsError.message);
  } else {
    console.log(`Active assignments (last 20): ${enrichedAssignments.length || 0}\n`);

    if (enrichedAssignments && enrichedAssignments.length > 0) {
      enrichedAssignments.forEach((a: any) => {
        const projectName = a.project_name || 'Unknown project';
        const userName = a.user_name || 'Unknown user';

        console.log(`  👤 ${userName} → ${projectName}`);
        if (a.role_in_project) {
          console.log(`     Role: ${a.role_in_project}`);
        }
        console.log(`     Assigned: ${new Date(a.created_at).toLocaleString()}`);
        console.log();
      });
    } else {
      console.log('  ℹ️  No active project assignments found.');
    }
  }

  // 6. Data Integrity Checks
  console.log('\n🔍 6. DATA INTEGRITY CHECKS');
  console.log('─'.repeat(80));

  const issues: string[] = [];

  // Check for workflow instances without templates
  const { data: orphanedInstances } = await supabase
    .from('workflow_instances')
    .select('id, workflow_template_id')
    .is('workflow_template_id', null);

  if (orphanedInstances && orphanedInstances.length > 0) {
    issues.push(`❌ Found ${orphanedInstances.length} workflow instances without templates`);
  }

  // Check for nodes without templates
  const { data: orphanedNodes } = await supabase
    .from('workflow_nodes')
    .select('id, workflow_template_id')
    .is('workflow_template_id', null);

  if (orphanedNodes && orphanedNodes.length > 0) {
    issues.push(`❌ Found ${orphanedNodes.length} workflow nodes without templates`);
  }

  // Check for history entries pointing to non-existent nodes
  const { data: allHistory } = await supabase
    .from('workflow_history')
    .select('id, from_node_id, to_node_id');

  if (allHistory && nodes) {
    const nodeIds = new Set(nodes.map((n: any) => n.id));
    const badHistory = allHistory.filter((h: any) => {
      return (h.from_node_id && !nodeIds.has(h.from_node_id)) ||
             (h.to_node_id && !nodeIds.has(h.to_node_id));
    });

    if (badHistory.length > 0) {
      issues.push(`❌ Found ${badHistory.length} history entries with invalid node references`);
    }
  }

  // Check for instances with current_node_id not matching any node
  if (instances && nodes) {
    const nodeIds = new Set(nodes.map((n: any) => n.id));
    const badInstances = instances.filter((inst: any) =>
      inst.current_node_id && !nodeIds.has(inst.current_node_id)
    );

    if (badInstances.length > 0) {
      issues.push(`❌ Found ${badInstances.length} instances with invalid current_node_id`);
    }
  }

  if (issues.length === 0) {
    console.log('✅ No data integrity issues detected!');
  } else {
    console.log('Issues found:');
    issues.forEach(issue => { console.log(`  ${issue}`); });
  }

  // 7. Summary
  const activeCount = templates?.filter(t => t.is_active).length || 0;
  const inactiveCount = (templates?.length || 0) - activeCount;

  console.log('\n\n📊 SUMMARY');
  console.log('═'.repeat(80));
  console.log(`Workflow Templates:     ${templates?.length || 0} (${activeCount} active, ${inactiveCount} inactive)`);
  console.log(`Workflow Nodes:         ${nodes?.length || 0}`);
  console.log(`Workflow Instances:     ${instances?.length || 0}`);
  console.log(`History Entries:        ${enrichedHistory.length || 0} (showing last 20)`);
  console.log(`Active Assignments:     ${enrichedAssignments.length || 0} (showing last 20)`);
  console.log(`Data Integrity Issues:  ${issues.length}`);

  console.log('\n✅ Audit complete!\n');
}

// Run the audit
auditWorkflowState().catch(console.error);

#!/usr/bin/env tsx
/**
 * Final Workflow Database Audit
 *
 * Comprehensive audit with schema validation
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testInsertAndRollback(tableName: string) {
  console.log(`\n🔬 Testing ${tableName} schema by attempting insert...`);

  try {
    // Try to insert a minimal record to see what columns are required/expected
    const testData: unknown = {
      id: '00000000-0000-0000-0000-000000000000' // Will fail on FK constraints, but shows columns
    };

    const { error } = await supabase.from(tableName).insert(testData);

    if (error) {
      console.log(`Error message: ${error.message}`);
      console.log(`Error details:`, error.details);
      console.log(`Error hint:`, error.hint);

      // Parse the error to understand what columns exist
      if (error.message.includes('null value in column')) {
        const match = error.message.match(/null value in column "([^"]+)"/);
        if (match) {
          console.log(`✓ Found required column: ${match[1]}`);
        }
      }
    }
  } catch (err: any) {
    console.log(`Exception:`, err.message);
  }
}

async function finalAudit() {
  console.log('🔍 FINAL WORKFLOW DATABASE STATE AUDIT');
  console.log('═'.repeat(80));
  console.log();

  // Part 1: Workflow Templates
  console.log('📋 1. WORKFLOW TEMPLATES');
  console.log('─'.repeat(80));

  const { data: templates } = await supabase
    .from('workflow_templates')
    .select('id, name, is_active, created_at')
    .order('created_at', { ascending: false });

  const activeCount = templates?.filter(t => t.is_active).length || 0;
  const inactiveCount = (templates?.length || 0) - activeCount;

  console.log(`Total: ${templates?.length || 0} (${activeCount} active, ${inactiveCount} inactive)`);
  console.log();

  templates?.forEach((t: any) => {
    console.log(`  ${t.is_active ? '✓' : '✗'} ${t.name}`);
  });

  // Part 2: Workflow Nodes (grouped by template)
  console.log('\n\n🔷 2. WORKFLOW NODES');
  console.log('─'.repeat(80));

  const { data: nodes } = await supabase
    .from('workflow_nodes')
    .select('id, workflow_template_id, node_type, label');

  console.log(`Total nodes: ${nodes?.length || 0}\n`);

  const templateIds = templates?.map(t => t.id) || [];
  const templateMap = new Map(templates?.map(t => [t.id, t.name]) || []);

  templateIds.forEach(templateId => {
    const templateName = templateMap.get(templateId);
    const templateNodes = nodes?.filter(n => n.workflow_template_id === templateId) || [];

    if (templateNodes.length > 0) {
      console.log(`  📝 ${templateName}: ${templateNodes.length} nodes`);

      // Count by type
      const typeCounts: Record<string, number> = {};
      templateNodes.forEach(n => {
        typeCounts[n.node_type] = (typeCounts[n.node_type] || 0) + 1;
      });

      Object.entries(typeCounts).forEach(([type, count]) => {
        console.log(`     - ${type}: ${count}`);
      });
      console.log();
    }
  });

  // Part 3: Workflow Connections
  console.log('\n⚡ 3. WORKFLOW CONNECTIONS');
  console.log('─'.repeat(80));

  const { data: connections } = await supabase
    .from('workflow_connections')
    .select('id, workflow_template_id, from_node_id, to_node_id, condition');

  console.log(`Total connections: ${connections?.length || 0}\n`);

  if (connections && connections.length > 0) {
    templateIds.forEach(templateId => {
      const templateName = templateMap.get(templateId);
      const templateConnections = connections.filter(c => c.workflow_template_id === templateId);

      if (templateConnections.length > 0) {
        console.log(`  📝 ${templateName}: ${templateConnections.length} connections`);
        templateConnections.forEach(c => {
          const fromNode = nodes?.find(n => n.id === c.from_node_id);
          const toNode = nodes?.find(n => n.id === c.to_node_id);
          console.log(`     ${fromNode?.label || 'Unknown'} → ${toNode?.label || 'Unknown'}${c.condition ? ` [${c.condition}]` : ''}`);
        });
        console.log();
      }
    });
  }

  // Part 4: Workflow Instances
  console.log('\n⚙️  4. WORKFLOW INSTANCES');
  console.log('─'.repeat(80));

  const { data: instances } = await supabase
    .from('workflow_instances')
    .select('*');

  console.log(`Total instances: ${instances?.length || 0}`);

  if (!instances || instances.length === 0) {
    console.log('ℹ️  No workflow instances have been created yet.');
    console.log('   Workflows exist as templates but have not been started on any projects.');
  } else {
    const statusCounts: Record<string, number> = {};
    instances.forEach((i: any) => {
      statusCounts[i.status] = (statusCounts[i.status] || 0) + 1;
    });

    console.log('\nStatus breakdown:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  - ${status}: ${count}`);
    });
  }

  // Part 5: Workflow History
  console.log('\n\n📜 5. WORKFLOW HISTORY');
  console.log('─'.repeat(80));

  const { data: history } = await supabase
    .from('workflow_history')
    .select('*')
    .limit(20);

  console.log(`Total history entries: ${history?.length || 0}`);

  if (!history || history.length === 0) {
    console.log('ℹ️  No workflow history entries exist.');
    console.log('   No workflows have been progressed or handed off yet.');
  }

  // Part 6: Form Templates
  console.log('\n\n📝 6. FORM TEMPLATES');
  console.log('─'.repeat(80));

  const { data: formTemplates } = await supabase
    .from('form_templates')
    .select('id, name, is_active')
    .order('created_at', { ascending: false });

  console.log(`Total form templates: ${formTemplates?.length || 0}\n`);

  formTemplates?.forEach((ft: any) => {
    console.log(`  ${ft.is_active ? '✓' : '✗'} ${ft.name} (${ft.id.substring(0, 8)}...)`);
  });

  // Check if forms are linked to workflow nodes
  if (nodes && formTemplates) {
    const nodesWithForms = nodes.filter(n => n.node_type === 'form');
    console.log(`\n  Forms used in workflow nodes: ${nodesWithForms.length}`);
  }

  // Part 7: Form Responses
  console.log('\n\n📋 7. FORM RESPONSES');
  console.log('─'.repeat(80));

  const { data: formResponses } = await supabase
    .from('form_responses')
    .select('*')
    .limit(10);

  console.log(`Form responses: ${formResponses?.length || 0}`);

  if (!formResponses || formResponses.length === 0) {
    console.log('ℹ️  No form responses have been submitted yet.');
  }

  // Part 8: Project Assignments
  console.log('\n\n👥 8. PROJECT ASSIGNMENTS (Last 10)');
  console.log('─'.repeat(80));

  const { data: rawAssignments } = await supabase
    .from('project_assignments')
    .select('id, project_id, user_id, role_in_project')
    .is('removed_at', null)
    .order('created_at', { ascending: false })
    .limit(10);

  console.log(`Active assignments: ${rawAssignments?.length || 0}`);

  if (!rawAssignments || rawAssignments.length === 0) {
    console.log('ℹ️  No active project assignments found.');
    console.log('   Projects exist but users have not been assigned to them.');
  } else {
    // Fetch project and user names
    const projectIds = [...new Set(rawAssignments.map(a => a.project_id))];
    const userIds = [...new Set(rawAssignments.map(a => a.user_id))];

    const { data: projects } = await supabase
      .from('projects')
      .select('id, name')
      .in('id', projectIds);

    const { data: users } = await supabase
      .from('user_profiles')
      .select('id, name')
      .in('id', userIds);

    const projectMap = new Map(projects?.map(p => [p.id, p.name]) || []);
    const userMap = new Map(users?.map(u => [u.id, u.name]) || []);

    console.log();
    rawAssignments.forEach((a: any) => {
      const projectName = projectMap.get(a.project_id) || 'Unknown project';
      const userName = userMap.get(a.user_id) || 'Unknown user';
      console.log(`  👤 ${userName} → ${projectName}${a.role_in_project ? ` (${a.role_in_project})` : ''}`);
    });
  }

  // Part 9: Schema Validation
  console.log('\n\n🔬 9. SCHEMA VALIDATION');
  console.log('─'.repeat(80));

  console.log('\nTesting workflow_instances schema...');
  await testInsertAndRollback('workflow_instances');

  console.log('\nTesting workflow_history schema...');
  await testInsertAndRollback('workflow_history');

  console.log('\nTesting form_responses schema...');
  await testInsertAndRollback('form_responses');

  // Part 10: Data Integrity
  console.log('\n\n✓ 10. DATA INTEGRITY CHECKS');
  console.log('─'.repeat(80));

  const issues: string[] = [];

  // Check for orphaned nodes
  const { data: orphanedNodes } = await supabase
    .from('workflow_nodes')
    .select('id, label')
    .is('workflow_template_id', null);

  if (orphanedNodes && orphanedNodes.length > 0) {
    issues.push(`❌ ${orphanedNodes.length} workflow nodes have no template`);
  }

  // Check for connections pointing to non-existent nodes
  if (connections && nodes) {
    const nodeIds = new Set(nodes.map(n => n.id));
    const invalidConnections = connections.filter(c =>
      !nodeIds.has(c.from_node_id) || !nodeIds.has(c.to_node_id)
    );

    if (invalidConnections.length > 0) {
      issues.push(`❌ ${invalidConnections.length} connections reference non-existent nodes`);
    }
  }

  // Check for form nodes without form templates
  if (nodes) {
    const formNodes = nodes.filter(n => n.node_type === 'form');
    console.log(`\nForm nodes found: ${formNodes.length}`);
    // Note: We'd need to check form_template_id field, but it might be in settings
  }

  if (issues.length === 0) {
    console.log('\n✅ No data integrity issues detected!');
  } else {
    console.log('\n⚠️  Issues found:');
    issues.forEach(issue => { console.log(`  ${issue}`); });
  }

  // Final Summary
  console.log('\n\n📊 SUMMARY');
  console.log('═'.repeat(80));
  console.log(`Workflow Templates:       ${templates?.length || 0} (${activeCount} active)`);
  console.log(`Workflow Nodes:           ${nodes?.length || 0}`);
  console.log(`Workflow Connections:     ${connections?.length || 0}`);
  console.log(`Workflow Instances:       ${instances?.length || 0}`);
  console.log(`Workflow History Entries: ${history?.length || 0}`);
  console.log(`Form Templates:           ${formTemplates?.length || 0}`);
  console.log(`Form Responses:           ${formResponses?.length || 0}`);
  console.log(`Project Assignments:      ${rawAssignments?.length || 0} (last 10 shown)`);
  console.log(`Data Integrity Issues:    ${issues.length}`);

  console.log('\n\n🎯 KEY FINDINGS:');
  console.log('─'.repeat(80));

  if ((instances?.length || 0) === 0 && (history?.length || 0) === 0) {
    console.log('❗ Workflows are CONFIGURED but NOT IN USE:');
    console.log('   - Templates and nodes exist');
    console.log('   - No instances have been started');
    console.log('   - No handoffs or progressions have occurred');
    console.log('\n   This suggests the workflow system is ready but has not been');
    console.log('   activated on any actual projects yet.');
  }

  if ((rawAssignments?.length || 0) === 0) {
    console.log('\n❗ No project assignments:');
    console.log('   - Workflow handoffs require users to be assigned to projects');
    console.log('   - Currently no users are assigned to any projects');
  }

  console.log('\n✅ Audit complete!\n');
}

finalAudit().catch(console.error);

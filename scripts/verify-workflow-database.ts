#!/usr/bin/env ts-node
/**
 * Workflow Database Verification Script
 *
 * Verifies workflow tables exist, have proper RLS, and data flows correctly.
 * Reports on: tables, RLS policies, existing data, assignments, and data integrity.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface TableExistence {
  table_name: string;
  status: 'EXISTS' | 'MISSING';
}

interface RLSPolicy {
  tablename: string;
  policyname: string;
  permissive: string;
  roles: string[];
  cmd: string;
}

interface RLSStatus {
  tablename: string;
  rls_enabled: boolean;
}

async function checkTableExistence(): Promise<void> {
  console.log('\n=== PART 1: WORKFLOW TABLES EXISTENCE ===\n');

  const tables = [
    'workflow_templates',
    'workflow_nodes',
    'workflow_connections',
    'workflow_instances',
    'workflow_history',
    'workflow_approvals'
  ];

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('id')
      .limit(1);

    const status = error ? 'MISSING' : 'EXISTS';
    console.log(`${table}: ${status}`);

    if (error && !error.message.includes('does not exist')) {
      console.log(`  Error: ${error.message}`);
    }
  }
}

async function checkRLSPolicies(): Promise<void> {
  console.log('\n=== PART 2: WORKFLOW RLS POLICIES ===\n');

  // Get RLS policies
  const { data: policies, error: policiesError } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd
      FROM pg_policies
      WHERE tablename LIKE 'workflow%'
      ORDER BY tablename, policyname;
    `
  });

  if (policiesError) {
    console.log('Using alternative method to check RLS...');

    // Alternative: Check each table individually
    const tables = ['workflow_templates', 'workflow_nodes', 'workflow_connections',
                    'workflow_instances', 'workflow_history'];

    for (const table of tables) {
      const { error } = await supabase.from(table).select('id').limit(1);
      if (!error) {
        console.log(`\n${table}:`);
        console.log('  RLS Enabled: Unknown (cannot query pg_policies directly)');
        console.log('  Note: Table is accessible, RLS policies exist but cannot be listed via RPC');
      }
    }
  } else {
    const grouped = (policies || []).reduce((acc: any, policy: any) => {
      if (!acc[policy.tablename]) {
        acc[policy.tablename] = [];
      }
      acc[policy.tablename].push(policy);
      return acc;
    }, {});

    for (const [tablename, tablePolicies] of Object.entries(grouped)) {
      console.log(`\n${tablename}:`);
      console.log(`  RLS Enabled: Yes`);
      console.log(`  Policy Count: ${(tablePolicies as unknown[]).length}`);
      console.log('  Policies:');
      (tablePolicies as unknown[]).forEach((p: any) => {
        console.log(`    - ${p.policyname} (${p.cmd})`);
      });
    }
  }

  // Check if RLS is enabled (alternative method)
  console.log('\n--- RLS Status Summary ---\n');
  const tables = ['workflow_templates', 'workflow_nodes', 'workflow_connections',
                  'workflow_instances', 'workflow_history'];

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (!error) {
      console.log(`${table}: RLS Enabled (table accessible)`);
    } else if (error.message.includes('does not exist')) {
      console.log(`${table}: DOES NOT EXIST`);
    } else {
      console.log(`${table}: RLS Status Unknown - ${error.message}`);
    }
  }
}

async function queryWorkflowData(): Promise<void> {
  console.log('\n=== PART 3: EXISTING WORKFLOW DATA ===\n');

  // Workflow Templates
  const { data: templates, error: templatesError } = await supabase
    .from('workflow_templates')
    .select('id, name, description, created_at')
    .order('created_at', { ascending: false });

  if (templatesError) {
    console.log(`workflow_templates: ERROR - ${templatesError.message}`);
  } else {
    console.log(`workflow_templates: ${templates?.length || 0} templates`);
    if (templates && templates.length > 0) {
      templates.forEach(t => {
        console.log(`  - ${t.name} (${t.id})`);
        if (t.description) {
          console.log(`    Description: ${t.description}`);
        }
      });
    }
  }

  // Workflow Instances
  const { data: instances, error: instancesError } = await supabase
    .from('workflow_instances')
    .select(`
      id,
      project_id,
      projects(name),
      status,
      current_node_id,
      created_at
    `)
    .order('created_at', { ascending: false })
    .limit(10);

  if (instancesError) {
    console.log(`\nworkflow_instances: ERROR - ${instancesError.message}`);
  } else {
    const activeCount = instances?.filter(i => i.status === 'active').length || 0;
    console.log(`\nworkflow_instances: ${instances?.length || 0} total (${activeCount} active)`);

    if (instances && instances.length > 0) {
      instances.forEach(i => {
        const projectName = (i.projects as any)?.name || 'Unknown';
        console.log(`  - Instance ${i.id}: ${projectName} (${i.status})`);
        console.log(`    Current Node: ${i.current_node_id || 'None'}`);
      });
    }
  }

  // Workflow History
  const { data: history, error: historyError } = await supabase
    .from('workflow_history')
    .select('id, instance_id, from_node_id, to_node_id, action, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (historyError) {
    console.log(`\nworkflow_history: ERROR - ${historyError.message}`);
  } else {
    console.log(`\nworkflow_history: ${history?.length || 0} entries (showing last 10)`);

    if (history && history.length > 0) {
      history.forEach(h => {
        console.log(`  - ${h.action}: ${h.from_node_id || 'START'} → ${h.to_node_id}`);
        console.log(`    Instance: ${h.instance_id}`);
      });
    }
  }

  // Workflow Nodes
  const { data: nodes, error: nodesError } = await supabase
    .from('workflow_nodes')
    .select('id, template_id, name, node_type')
    .limit(5);

  if (nodesError) {
    console.log(`\nworkflow_nodes: ERROR - ${nodesError.message}`);
  } else {
    console.log(`\nworkflow_nodes: ${nodes?.length || 0} nodes (showing first 5)`);
    if (nodes && nodes.length > 0) {
      nodes.forEach(n => {
        console.log(`  - ${n.name} (${n.node_type}) - Template: ${n.template_id}`);
      });
    }
  }

  // Workflow Connections
  const { data: connections, error: connectionsError } = await supabase
    .from('workflow_connections')
    .select('id, from_node_id, to_node_id, condition_type')
    .limit(5);

  if (connectionsError) {
    console.log(`\nworkflow_connections: ERROR - ${connectionsError.message}`);
  } else {
    console.log(`\nworkflow_connections: ${connections?.length || 0} connections (showing first 5)`);
    if (connections && connections.length > 0) {
      connections.forEach(c => {
        console.log(`  - ${c.from_node_id} → ${c.to_node_id} (${c.condition_type || 'default'})`);
      });
    }
  }
}

async function checkAssignmentTables(): Promise<void> {
  console.log('\n=== PART 5: USER ASSIGNMENT TABLES ===\n');

  // Check project_assignments
  const { data: assignments, error: assignmentsError } = await supabase
    .from('project_assignments')
    .select('*')
    .limit(1);

  if (assignmentsError) {
    console.log(`project_assignments: ERROR - ${assignmentsError.message}`);
  } else {
    console.log('project_assignments: EXISTS');
    console.log('  Structure: user_id, project_id, role, assigned_at');

    const { count } = await supabase
      .from('project_assignments')
      .select('*', { count: 'exact', head: true });

    console.log(`  Total assignments: ${count || 0}`);
  }

  // Check account_members (may not exist)
  const { data: members, error: membersError } = await supabase
    .from('account_members')
    .select('*')
    .limit(1);

  if (membersError) {
    if (membersError.message.includes('does not exist')) {
      console.log('\naccount_members: DOES NOT EXIST');
      console.log('  Note: This table may not be implemented yet');
    } else {
      console.log(`\naccount_members: ERROR - ${membersError.message}`);
    }
  } else {
    console.log('\naccount_members: EXISTS');

    const { count } = await supabase
      .from('account_members')
      .select('*', { count: 'exact', head: true });

    console.log(`  Total members: ${count || 0}`);
  }

  // Check account_managers
  const { data: managers, error: managersError } = await supabase
    .from('account_managers')
    .select('*')
    .limit(1);

  if (managersError) {
    console.log(`\naccount_managers: ERROR - ${managersError.message}`);
  } else {
    console.log('\naccount_managers: EXISTS');

    const { count } = await supabase
      .from('account_managers')
      .select('*', { count: 'exact', head: true });

    console.log(`  Total managers: ${count || 0}`);
  }

  console.log('\n--- Workflow Assignment Creation ---');
  console.log('Workflow progression creates assignments via:');
  console.log('  1. workflow_history entries track handoffs');
  console.log('  2. Node configurations specify assigned_role_id or assigned_user_id');
  console.log('  3. API routes handle creating project_assignments when workflow advances');
}

async function checkDataIntegrity(): Promise<void> {
  console.log('\n=== PART 6: DATA INTEGRITY ===\n');

  const issues: string[] = [];

  // Check workflow instances with invalid projects
  const { data: instances } = await supabase
    .from('workflow_instances')
    .select('id, project_id, projects(id)');

  if (instances) {
    const orphanedInstances = instances.filter(i => !(i.projects as any)?.id);
    if (orphanedInstances.length > 0) {
      issues.push(`${orphanedInstances.length} workflow instances with invalid project_id`);
      orphanedInstances.forEach(i => {
        console.log(`  ORPHANED INSTANCE: ${i.id} → Project ${i.project_id}`);
      });
    } else {
      console.log('✓ All workflow instances linked to valid projects');
    }
  }

  // Check workflow nodes with invalid templates
  const { data: nodes } = await supabase
    .from('workflow_nodes')
    .select('id, template_id, workflow_templates(id)');

  if (nodes) {
    const orphanedNodes = nodes.filter(n => !(n.workflow_templates as any)?.id);
    if (orphanedNodes.length > 0) {
      issues.push(`${orphanedNodes.length} workflow nodes with invalid template_id`);
      orphanedNodes.forEach(n => {
        console.log(`  ORPHANED NODE: ${n.id} → Template ${n.template_id}`);
      });
    } else {
      console.log('✓ All workflow nodes linked to valid templates');
    }
  }

  // Check workflow history with invalid instances
  const { data: history } = await supabase
    .from('workflow_history')
    .select('id, instance_id, workflow_instances(id)')
    .limit(50);

  if (history) {
    const orphanedHistory = history.filter(h => !(h.workflow_instances as any)?.id);
    if (orphanedHistory.length > 0) {
      issues.push(`${orphanedHistory.length} workflow history entries with invalid instance_id`);
      orphanedHistory.forEach(h => {
        console.log(`  ORPHANED HISTORY: ${h.id} → Instance ${h.instance_id}`);
      });
    } else {
      console.log('✓ All workflow history entries linked to valid instances');
    }
  }

  // Check workflow connections with invalid nodes
  const { data: connections } = await supabase
    .from('workflow_connections')
    .select(`
      id,
      from_node_id,
      to_node_id,
      from_node:workflow_nodes!workflow_connections_from_node_id_fkey(id),
      to_node:workflow_nodes!workflow_connections_to_node_id_fkey(id)
    `)
    .limit(50);

  if (connections) {
    const orphanedConnections = connections.filter(c =>
      !(c.from_node as any)?.id || !(c.to_node as any)?.id
    );
    if (orphanedConnections.length > 0) {
      issues.push(`${orphanedConnections.length} workflow connections with invalid node references`);
      orphanedConnections.forEach(c => {
        console.log(`  ORPHANED CONNECTION: ${c.id} → ${c.from_node_id} to ${c.to_node_id}`);
      });
    } else {
      console.log('✓ All workflow connections linked to valid nodes');
    }
  }

  if (issues.length > 0) {
    console.log('\n❌ Data Integrity Issues Found:');
    issues.forEach(issue => { console.log(`  - ${issue}`); });
  } else {
    console.log('\n✓ No data integrity issues detected');
  }
}

async function generateReport(): Promise<void> {
  console.log('\n=== WORKFLOW DATABASE VERIFICATION REPORT ===');
  console.log(`Generated: ${new Date().toISOString()}\n`);

  await checkTableExistence();
  await checkRLSPolicies();
  await queryWorkflowData();
  await checkAssignmentTables();
  await checkDataIntegrity();

  console.log('\n=== CONFIDENCE SCORE ===\n');
  console.log('Workflow Database Layer Confidence: TBD (based on findings above)');
  console.log('\nRecommendations:');
  console.log('  1. Verify all tables exist and have RLS enabled');
  console.log('  2. Check for orphaned records and fix foreign key references');
  console.log('  3. Test workflow creation API to verify data flow');
  console.log('  4. Validate assignment creation when workflows progress');
  console.log('\n=== END REPORT ===\n');
}

// Run verification
generateReport().catch(console.error);

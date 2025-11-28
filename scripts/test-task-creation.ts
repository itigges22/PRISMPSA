/**
 * Test Task Creation Script
 * Diagnose task creation issues
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testTaskCreation() {
  console.log('\n🧪 Testing Task Creation\n');
  console.log('═'.repeat(80));

  // Get a test project
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name')
    .limit(1);

  if (!projects || projects.length === 0) {
    console.log('❌ No projects found. Create a project first.');
    return;
  }

  const testProject = projects[0];
  console.log(`\n📋 Using project: ${testProject.name} (${testProject.id})`);

  // Get a test user
  const { data: users } = await supabase
    .from('user_profiles')
    .select('id, name, email')
    .eq('email', 'jitigges@vt.edu')
    .single();

  if (!users) {
    console.log('❌ Admin user not found');
    return;
  }

  console.log(`\n👤 Test user: ${users.name} (${users.email})`);

  // Test creating multiple tasks
  console.log('\n\n🔨 Creating Test Tasks...\n');
  
  for (let i = 1; i <= 3; i++) {
    console.log(`\nTask ${i}:`);
    console.log('─'.repeat(80));
    
    const taskData = {
      name: `Test Task ${i} - ${Date.now()}`,
      description: `This is test task number ${i}`,
      project_id: testProject.id,
      status: 'backlog' as const,
      priority: 'medium' as const,
      start_date: null,
      due_date: null,
      estimated_hours: null,
      actual_hours: 0,
      created_by: users.id,
      assigned_to: null,
    };

    console.log('Task data:', JSON.stringify(taskData, null, 2));

    try {
      const { data: newTask, error } = await supabase
        .from('tasks')
        .insert(taskData)
        .select(`
          *,
          created_by_user:user_profiles!created_by(id, name, email),
          assigned_to_user:user_profiles!assigned_to(id, name, email),
          project:projects(id, name)
        `)
        .single();

      if (error) {
        console.log('❌ Error creating task:');
        console.log('   Message:', error.message);
        console.log('   Details:', error.details);
        console.log('   Hint:', error.hint);
        console.log('   Code:', error.code);
      } else if (newTask) {
        console.log('✅ Task created successfully!');
        console.log('   ID:', newTask.id);
        console.log('   Name:', newTask.name);
      }
    } catch (error: any) {
      console.log('❌ Exception:', error.message);
    }

    // Wait a bit between tasks
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n\n' + '═'.repeat(80));
  console.log('✅ Test complete\n');
}

testTaskCreation()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });


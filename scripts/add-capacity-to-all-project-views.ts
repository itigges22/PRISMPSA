#!/usr/bin/env tsx

/**
 * Script to systematically add estimated hours and remaining hours to all project displays
 * This script will help ensure consistency across the platform
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Files that need to be updated to show est/remaining hours
const FILES_TO_UPDATE = [
  {
    path: 'components/account-overview.tsx',
    description: 'Account overview - Kanban/Gantt/Table views',
    locations: [
      'Kanban card rendering (around line 1591-1627)',
      'Table view rendering',
      'Gantt view'
    ]
  },
  {
    path: 'app/kanban/page.tsx',
    description: 'Main Kanban board for tasks',
    locations: ['Task cards']
  },
  {
    path: 'components/project-card.tsx',
    description: 'Reusable project card component (if exists)',
    locations: ['Project card display']
  }
]

// Query to check remaining hours implementation in database
async function checkDatabaseSchema() {
  console.log('\n=== CHECKING DATABASE SCHEMA ===\n')
  
  // Check if tasks table has remaining_hours column
  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('id, project_id, estimated_hours, remaining_hours, actual_hours')
    .limit(5)
  
  if (tasksError) {
    console.error('Error querying tasks:', tasksError)
  } else {
    console.log('✅ Tasks table structure:')
    console.log('   - estimated_hours:', tasks?.[0]?.estimated_hours !== undefined ? 'EXISTS' : 'MISSING')
    console.log('   - remaining_hours:', tasks?.[0]?.remaining_hours !== undefined ? 'EXISTS' : 'MISSING')
    console.log('   - actual_hours:', tasks?.[0]?.actual_hours !== undefined ? 'EXISTS' : 'MISSING')
  }
  
  // Check if projects table has estimated_hours
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('id, name, estimated_hours, actual_hours')
    .limit(5)
  
  if (projectsError) {
    console.error('Error querying projects:', projectsError)
  } else {
    console.log('\n✅ Projects table structure:')
    console.log('   - estimated_hours:', projects?.[0]?.estimated_hours !== undefined ? 'EXISTS' : 'MISSING')
    console.log('   - actual_hours:', projects?.[0]?.actual_hours !== undefined ? 'EXISTS' : 'MISSING')
  }
}

// Calculate remaining hours for a project
async function calculateProjectRemainingHours(projectId: string): Promise<number | null> {
  const { data: tasks } = await supabase
    .from('tasks')
    .select('remaining_hours, estimated_hours')
    .eq('project_id', projectId)
  
  if (!tasks || tasks.length === 0) return null
  
  const totalRemaining = tasks.reduce((sum, task) => {
    return sum + (task.remaining_hours ?? task.estimated_hours ?? 0)
  }, 0)
  
  return totalRemaining
}

// Test remaining hours calculation for sample projects
async function testRemainingHoursCalculation() {
  console.log('\n=== TESTING REMAINING HOURS CALCULATION ===\n')
  
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, estimated_hours')
    .limit(5)
  
  if (!projects) {
    console.log('No projects found')
    return
  }
  
  for (const project of projects) {
    const remaining = await calculateProjectRemainingHours(project.id)
    console.log(`\n📊 ${project.name}:`)
    console.log(`   Estimated: ${project.estimated_hours ?? 'N/A'}h`)
    console.log(`   Remaining: ${remaining !== null ? `${remaining.toFixed(1)}h` : 'N/A'}`)
    if (project.estimated_hours && remaining !== null) {
      const progress = ((project.estimated_hours - remaining) / project.estimated_hours) * 100
      console.log(`   Progress: ${Math.max(0, progress).toFixed(1)}%`)
    }
  }
}

// Check which files exist and need updating
function checkFilesToUpdate() {
  console.log('\n=== FILES TO UPDATE ===\n')
  
  for (const file of FILES_TO_UPDATE) {
    const fullPath = path.resolve(process.cwd(), file.path)
    const exists = fs.existsSync(fullPath)
    
    console.log(`\n${exists ? '✅' : '❌'} ${file.path}`)
    console.log(`   Description: ${file.description}`)
    if (file.locations.length > 0) {
      console.log(`   Locations to update:`)
      file.locations.forEach(loc => console.log(`      - ${loc}`))
    }
  }
}

// Recommendations for implementation
function printRecommendations() {
  console.log('\n\n=== IMPLEMENTATION RECOMMENDATIONS ===\n')
  
  console.log('1. ✅ Database Schema - READY')
  console.log('   - tasks.remaining_hours column exists')
  console.log('   - projects.estimated_hours column exists')
  
  console.log('\n2. 📝 Frontend Components - NEEDS UPDATES')
  console.log('   Components to update:')
  console.log('   - components/assigned-projects-section.tsx (✅ DONE)')
  console.log('   - components/account-overview.tsx (🚧 IN PROGRESS)')
  console.log('   - app/kanban/page.tsx (⏳ TODO)')
  
  console.log('\n3. 🎨 UI Pattern - CONSISTENT DISPLAY')
  console.log('   Recommended pattern for all project cards:')
  console.log('   ```tsx')
  console.log('   <div className="flex items-center gap-2">')
  console.log('     <Clock className="w-4 h-4 text-gray-400" />')
  console.log('     <span className="text-sm text-gray-600">')
  console.log('       {project.estimated_hours}h est')
  console.log('     </span>')
  console.log('     <Clock className="w-4 h-4 text-blue-500" />')
  console.log('     <span className="text-sm font-semibold text-blue-600">')
  console.log('       {project.remaining_hours}h left ({progress}%)')
  console.log('     </span>')
  console.log('   </div>')
  console.log('   ```')
  
  console.log('\n4. 🔄 Data Fetching - EFFICIENT PATTERN')
  console.log('   When loading projects, also fetch remaining hours:')
  console.log('   ```typescript')
  console.log('   // After loading projects')
  console.log('   const projectIds = projects.map(p => p.id)')
  console.log('   const { data: tasks } = await supabase')
  console.log('     .from("tasks")')
  console.log('     .select("project_id, remaining_hours, estimated_hours")')
  console.log('     .in("project_id", projectIds)')
  console.log('   ')
  console.log('   // Calculate remaining hours per project')
  console.log('   const remainingByProject = tasks.reduce((acc, task) => {')
  console.log('     if (!acc[task.project_id]) acc[task.project_id] = 0')
  console.log('     acc[task.project_id] += (task.remaining_hours ?? task.estimated_hours ?? 0)')
  console.log('     return acc')
  console.log('   }, {})')
  console.log('   ```')
}

// Main execution
async function main() {
  console.log('🚀 Capacity System - Project View Updates Analysis\n')
  console.log('=' .repeat(60))
  
  await checkDatabaseSchema()
  await testRemainingHoursCalculation()
  checkFilesToUpdate()
  printRecommendations()
  
  console.log('\n' + '='.repeat(60))
  console.log('\n✅ Analysis complete!')
  console.log('💡 Next steps: Update the files listed above to show est/remaining hours')
  console.log('\n')
}

main().catch(console.error)


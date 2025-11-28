import { createClientSupabase } from './supabase'

/**
 * Test database connection and check if superadmin role exists
 */
export async function testDatabaseConnection() {
  try {
    const supabase = createClientSupabase()
    if (!supabase) {
      throw new Error('Supabase not configured')
    }

    console.log('Testing database connection...')

    // Test 1: Check if we can connect to departments table
    const { data: deptData, error: deptError } = await supabase
      .from('departments')
      .select('id, name')
      .limit(5)

    if (deptError) {
      console.error('Department query error:', deptError)
      return { success: false, error: `Department query failed: ${deptError.message}` }
    }

    console.log('Departments found:', deptData)

    // Test 2: Check if Superadmin department exists
    const { data: systemDept, error: systemDeptError } = await supabase
      .from('departments')
      .select('id, name')
      .eq('name', 'Superadmin')
      .maybeSingle() // Use maybeSingle() to allow 0 or 1 results

    if (systemDeptError) {
      console.error('Superadmin department query error:', systemDeptError)
      return { success: false, error: `Superadmin department query failed: ${systemDeptError.message}` }
    }

    console.log('Superadmin department:', systemDept)

    // Test 3: Check if Superadmin role exists
    const { data: superadminRole, error: roleError } = await supabase
      .from('roles')
      .select('id, name, department_id')
      .eq('name', 'Superadmin')
      .maybeSingle() // Use maybeSingle() to allow 0 or 1 results

    if (roleError) {
      console.error('Superadmin role query error:', roleError)
      return { success: false, error: `Superadmin role query failed: ${roleError.message}` }
    }

    console.log('Superadmin role:', superadminRole)

    // Test 4: Check current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) {
      console.error('User query error:', userError)
      return { success: false, error: `User query failed: ${userError.message}` }
    }

    console.log('Current user:', user?.id)

    return { 
      success: true, 
      data: {
        departments: deptData,
        systemDepartment: systemDept,
        superadminRole,
        user: user?.id
      }
    }

  } catch (error) {
    console.error('Database test error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

import { createClientSupabase } from './supabase'

interface SuperadminResult {
  success: boolean
  message: string
}

/**
 * Assign superadmin role to the current user
 * This function should only be used for initial setup
 * @returns Promise that resolves when role is assigned
 */
export async function assignSuperadminRole() {
  try {
    const supabase = createClientSupabase()
    if (!supabase) {
      throw new Error('Supabase not configured')
    }

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      throw new Error('User not authenticated')
    }

    console.log('Assigning superadmin role to user:', user.id)

    // First, ensure the System department exists
    console.log('Step 1: Creating/checking System Administration department...')
    
    // Check if department already exists
    const { data: existingDept, error: checkDeptError } = await supabase
      .from('departments')
      .select('id')
      .eq('name', 'System Administration')
      .single()

    let deptError = null
    if (checkDeptError && checkDeptError.code !== 'PGRST116') {
      // PGRST116 means no rows found, which is fine
      console.error('Error checking for existing department:', checkDeptError)
      throw new Error(`Failed to check for existing department: ${checkDeptError.message}`)
    }

    if (!existingDept) {
      // Department doesn't exist, create it
      console.log('System Administration department does not exist, creating...')
      const { error } = await supabase
        .from('departments')
        .insert({
          name: 'System Administration',
          description: 'System-wide administrative roles and permissions',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      deptError = error
    } else {
      console.log('System Administration department already exists, skipping creation')
    }

    if (deptError) {
      console.error('Error creating system department:', {
        message: deptError.message,
        details: deptError.details,
        hint: deptError.hint,
        code: deptError.code,
        fullError: deptError
      })
      // Don't throw here, just log - department might already exist
    }

    // Get the System department ID
    console.log('Step 2: Getting System Administration department ID...')
    let deptData = existingDept
    
    if (!deptData) {
      // If we didn't find it in the check above, query for it
      const { data: queryDeptData, error: deptQueryError } = await supabase
        .from('departments')
        .select('id')
        .eq('name', 'System Administration')
        .single()

      if (deptQueryError) {
        console.error('Error querying system department:', {
          message: deptQueryError.message,
          details: deptQueryError.details,
          hint: deptQueryError.hint,
          code: deptQueryError.code,
          fullError: deptQueryError
        })
        throw new Error(`Failed to find System Administration department: ${deptQueryError.message}`)
      }
      
      deptData = queryDeptData
    }
    
    if (!deptData) {
      throw new Error('System Administration department not found')
    }

    // Create the Superadmin role if it doesn't exist
    console.log('Step 3: Creating Superadmin role...')
    
    // First check if the role already exists
    const { data: existingRole, error: checkError } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'Superadmin')
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 means no rows found, which is fine
      console.error('Error checking for existing superadmin role:', checkError)
      throw new Error(`Failed to check for existing superadmin role: ${checkError.message}`)
    }

    let roleError = null
    if (!existingRole) {
      // Role doesn't exist, create it
      console.log('Superadmin role does not exist, creating...')
      const { error } = await supabase
        .from('roles')
        .insert({
          name: 'Superadmin',
          department_id: deptData.id,
          permissions: {
            all_access: true,
            can_manage_users: true,
            can_manage_roles: true,
            can_manage_departments: true,
            can_access_all_pages: true,
            can_debug: true,
            can_modify_system: true
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      roleError = error
    } else {
      console.log('Superadmin role already exists, skipping creation')
    }

    if (roleError) {
      console.error('Error creating superadmin role:', {
        message: roleError.message,
        details: roleError.details,
        hint: roleError.hint,
        code: roleError.code,
        fullError: roleError
      })
      throw new Error(`Failed to create superadmin role: ${roleError.message}`)
    }

    // Get the Superadmin role ID
    console.log('Step 4: Getting Superadmin role ID...')
    let roleData = existingRole
    
    if (!roleData) {
      // If we didn't find it in the check above, query for it
      const { data: queryRoleData, error: roleQueryError } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'Superadmin')
        .single()

      if (roleQueryError) {
        console.error('Error querying superadmin role:', {
          message: roleQueryError.message,
          details: roleQueryError.details,
          hint: roleQueryError.hint,
          code: roleQueryError.code,
          fullError: roleQueryError
        })
        throw new Error(`Failed to find Superadmin role: ${roleQueryError.message}`)
      }
      
      roleData = queryRoleData
    }
    
    if (!roleData) {
      throw new Error('Superadmin role not found')
    }

    // Assign the superadmin role to the current user
    console.log('Step 5: Assigning Superadmin role to user...')
    console.log('User ID:', user.id)
    console.log('Role ID:', roleData.id)
    
    const { error: assignError } = await supabase
      .from('user_roles')
      .insert({
        user_id: user.id,
        role_id: roleData.id,
        assigned_at: new Date().toISOString(),
        assigned_by: user.id // Use the current user's ID as the assigner
      })

    if (assignError) {
      console.error('Error assigning superadmin role:', {
        message: assignError.message,
        details: assignError.details,
        hint: assignError.hint,
        code: assignError.code,
        fullError: assignError
      })
      
      // If role already assigned, that's okay
      if (assignError.code === '23505') { // Unique constraint violation
        console.log('Superadmin role already assigned to user')
        return { success: true, message: 'Superadmin role already assigned' }
      }
      throw new Error(`Failed to assign superadmin role: ${assignError.message}`)
    }

    console.log('Superadmin role assigned successfully')
    return { success: true, message: 'Superadmin role assigned successfully' }

  } catch (error) {
    console.error('Error assigning superadmin role:', error)
    throw error
  }
}

/**
 * Check if current user has superadmin role
 * @returns Promise that resolves to boolean
 */
export async function checkSuperadminRole() {
  try {
    const supabase = createClientSupabase()
    if (!supabase) {
      return false
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return false
    }

    const { data, error } = await supabase
      .from('user_roles')
      .select(`
        id,
        roles (
          id,
          name
        )
      `)
      .eq('user_id', user.id)
      .eq('roles.name', 'Superadmin')

    if (error) {
      console.error('Error checking superadmin role:', error)
      return false
    }

    return data && data.length > 0

  } catch (error) {
    console.error('Error checking superadmin role:', error)
    return false
  }
}

/**
 * Remove superadmin role from current user (for testing purposes)
 * @returns Promise that resolves when role is removed
 */
export async function removeSuperadminRole() {
  try {
    const supabase = createClientSupabase()
    if (!supabase) {
      throw new Error('Supabase not configured')
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      throw new Error('User not authenticated')
    }

    // Get the Superadmin role ID
    const { data: roleData, error: roleQueryError } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'Superadmin')
      .single()

    if (roleQueryError || !roleData) {
      throw new Error('Superadmin role not found')
    }

    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', user.id)
      .eq('role_id', roleData.id)

    if (error) {
      throw error
    }

    console.log('Superadmin role removed successfully')
    return { success: true, message: 'Superadmin role removed successfully' }

  } catch (error) {
    console.error('Error removing superadmin role:', error)
    throw error
  }
}

/**
 * Assign superadmin role to a user by email
 * @param email - Email address of the user to assign superadmin role to
 * @returns Promise that resolves with assignment result
 */
export async function assignSuperadminRoleByEmail(email: string): Promise<SuperadminResult> {
  try {
    const supabase = createClientSupabase()
    if (!supabase) {
      throw new Error('Supabase not configured')
    }

    console.log('Assigning superadmin role to email:', email)

    // First, find the user by email
    const { data: userData, error: userError } = await supabase
      .from('user_profiles')
      .select('id, email')
      .eq('email', email)
      .single()

    if (userError || !userData) {
      return { success: false, message: 'User not found' }
    }

    console.log('Found user:', userData.id)

    // Ensure the System department exists
    const { data: deptData, error: deptError } = await supabase
      .from('departments')
      .select('id')
      .eq('name', 'System Administration')
      .single()

    if (deptError || !deptData) {
      return { success: false, message: 'System Administration department not found' }
    }

    // Ensure the Superadmin role exists
    const { data: roleData, error: roleError } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'Superadmin')
      .single()

    if (roleError || !roleData) {
      return { success: false, message: 'Superadmin role not found' }
    }

    // Check if user already has superadmin role
    const { data: existingRole, error: checkError } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', userData.id)
      .eq('role_id', roleData.id)
      .single()

    if (existingRole) {
      return { success: true, message: 'User already has superadmin role' }
    }

    // Assign the superadmin role
    const { error: assignError } = await supabase
      .from('user_roles')
      .insert({
        user_id: userData.id,
        role_id: roleData.id,
        assigned_at: new Date().toISOString(),
        assigned_by: userData.id // Self-assigned for now
      })

    if (assignError) {
      console.error('Error assigning superadmin role:', assignError)
      return { success: false, message: `Failed to assign superadmin role: ${assignError.message}` }
    }

    console.log('Superadmin role assigned successfully to:', email)
    return { success: true, message: `Superadmin role assigned successfully to ${email}` }

  } catch (error) {
    console.error('Error assigning superadmin role:', error)
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Failed to assign superadmin role' 
    }
  }
}

/**
 * Check if a user has superadmin role by email
 * @param email - Email address of the user to check
 * @returns Promise that resolves with check result
 */
export async function checkSuperadminRoleByEmail(email: string): Promise<SuperadminResult> {
  try {
    const supabase = createClientSupabase()
    if (!supabase) {
      throw new Error('Supabase not configured')
    }

    // Find the user by email
    const { data: userData, error: userError } = await supabase
      .from('user_profiles')
      .select('id, email')
      .eq('email', email)
      .single()

    if (userError || !userData) {
      return { success: false, message: 'User not found' }
    }

    // Check if user has superadmin role
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select(`
        id,
        roles!inner(name)
      `)
      .eq('user_id', userData.id)
      .eq('roles.name', 'Superadmin')
      .single()

    if (roleError || !roleData) {
      return { success: true, message: `${email} does not have superadmin role` }
    }

    return { success: true, message: `${email} has superadmin role` }

  } catch (error) {
    console.error('Error checking superadmin role:', error)
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Failed to check superadmin role' 
    }
  }
}

/**
 * Remove superadmin role from a user by email
 * @param email - Email address of the user to remove superadmin role from
 * @returns Promise that resolves with removal result
 */
export async function removeSuperadminRoleByEmail(email: string): Promise<SuperadminResult> {
  try {
    const supabase = createClientSupabase()
    if (!supabase) {
      throw new Error('Supabase not configured')
    }

    // Find the user by email
    const { data: userData, error: userError } = await supabase
      .from('user_profiles')
      .select('id, email')
      .eq('email', email)
      .single()

    if (userError || !userData) {
      return { success: false, message: 'User not found' }
    }

    // Get the Superadmin role ID
    const { data: roleData, error: roleError } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'Superadmin')
      .single()

    if (roleError || !roleData) {
      return { success: false, message: 'Superadmin role not found' }
    }

    // Remove the superadmin role
    const { error: removeError } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userData.id)
      .eq('role_id', roleData.id)

    if (removeError) {
      console.error('Error removing superadmin role:', removeError)
      return { success: false, message: `Failed to remove superadmin role: ${removeError.message}` }
    }

    console.log('Superadmin role removed successfully from:', email)
    return { success: true, message: `Superadmin role removed successfully from ${email}` }

  } catch (error) {
    console.error('Error removing superadmin role:', error)
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Failed to remove superadmin role' 
    }
  }
}

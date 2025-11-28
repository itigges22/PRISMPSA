import { createClientSupabase } from './supabase';

/**
 * Check if the database schema is properly set up
 * @returns Object with check results
 */
export async function checkDatabaseSchema() {
  const supabase = createClientSupabase();
  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not configured',
      details: []
    };
  }

  const checks = [];
  let allPassed = true;

  try {
    // Check if user_profiles table exists
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id')
      .limit(1);

    if (profilesError) {
      checks.push({
        table: 'user_profiles',
        exists: false,
        error: profilesError.message,
        suggestion: 'Run the database schema SQL script in Supabase Cloud SQL Editor'
      });
      allPassed = false;
    } else {
      checks.push({
        table: 'user_profiles',
        exists: true,
        error: null
      });
    }

    // Check if departments table exists
    const { data: departments, error: departmentsError } = await supabase
      .from('departments')
      .select('id')
      .limit(1);

    if (departmentsError) {
      checks.push({
        table: 'departments',
        exists: false,
        error: departmentsError.message,
        suggestion: 'Run the database schema SQL script in Supabase Cloud SQL Editor'
      });
      allPassed = false;
    } else {
      checks.push({
        table: 'departments',
        exists: true,
        error: null
      });
    }

    // Check if roles table exists
    const { data: roles, error: rolesError } = await supabase
      .from('roles')
      .select('id')
      .limit(1);

    if (rolesError) {
      checks.push({
        table: 'roles',
        exists: false,
        error: rolesError.message,
        suggestion: 'Run the database schema SQL script in Supabase Cloud SQL Editor'
      });
      allPassed = false;
    } else {
      checks.push({
        table: 'roles',
        exists: true,
        error: null
      });
    }

    return {
      success: allPassed,
      error: allPassed ? null : 'Database schema not properly set up',
      details: checks
    };

  } catch (error) {
    return {
      success: false,
      error: `Database check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: checks
    };
  }
}

/**
 * Test user profile creation with detailed error reporting
 * @param userId - Test user ID
 * @param email - Test email
 * @param name - Test name
 * @returns Test result
 */
export async function testUserProfileCreation(userId: string, email: string, name: string) {
  const supabase = createClientSupabase();
  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not configured'
    };
  }

  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .insert({
        id: userId,
        email,
        name,
        image: null,
        bio: null,
        skills: [],
        workload_sentiment: null,
      })
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        suggestion: 'Check RLS policies and table structure'
      };
    }

    return {
      success: true,
      data
    };

  } catch (error) {
    return {
      success: false,
      error: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

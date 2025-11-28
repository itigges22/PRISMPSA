import { createServerSupabase } from './supabase-server';
import { UserProfile, UserRole, Role, Department } from './supabase';

// Server-side authentication helper functions

/**
 * Get the current authenticated user (server-side only)
 * @returns The current user or null if not authenticated
 */
export async function getCurrentUserServer() {
  try {
    const supabase = await createServerSupabase();
    if (!supabase) return null;

    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      console.error('Error getting current user:', error);
      return null;
    }

    return user;
  } catch (error) {
    console.error('Error in getCurrentUserServer:', error);
    return null;
  }
}

/**
 * Get the current user's profile with roles (server-side only)
 * @returns The user profile with roles or null if not found
 */
export async function getCurrentUserProfileServer() {
  try {
    const user = await getCurrentUserServer();
    if (!user) return null;

    const supabase = await createServerSupabase();
    if (!supabase) return null;

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select(`
        *,
        user_roles!user_roles_user_id_fkey (
          id,
          user_id,
          role_id,
          assigned_at,
          assigned_by,
          roles!user_roles_role_id_fkey (
            id,
            name,
            department_id,
            permissions,
            is_system_role,
            departments!roles_department_id_fkey (
              id,
              name,
              description
            )
          )
        )
      `)
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error getting user profile:', error);
      return null;
    }

    return profile as UserProfile & {
      user_roles: (UserRole & {
        roles: Role & {
          departments: Department;
        };
      })[];
    };
  } catch (error) {
    console.error('Error in getCurrentUserProfileServer:', error);
    return null;
  }
}

/**
 * Check if user is authenticated (server-side only)
 * @returns True if user is authenticated, false otherwise
 */
export async function isAuthenticatedServer(): Promise<boolean> {
  try {
    const user = await getCurrentUserServer();
    return !!user;
  } catch (error) {
    console.error('Error in isAuthenticatedServer:', error);
    return false;
  }
}

/**
 * Get the current session (server-side only)
 * @returns Current session or null
 */
export async function getCurrentSessionServer() {
  try {
    const supabase = await createServerSupabase();
    if (!supabase) return null;

    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error getting session:', error);
      return null;
    }

    return session;
  } catch (error) {
    console.error('Error in getCurrentSessionServer:', error);
    return null;
  }
}

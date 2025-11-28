import { createClientSupabase } from './supabase';
import { UserProfile, UserRole, Role, Department } from './supabase';

// Authentication helper functions

/**
 * Get the current authenticated user (client-side only)
 * Automatically refreshes session if expired
 * @returns The current user or null if not authenticated
 */
export async function getCurrentUser() {
  try {
    const supabase = createClientSupabase();
    if (!supabase) return null;

    // Try to get user - this will automatically refresh if needed
    const { data: { user }, error } = await supabase.auth.getUser();
    
    // If error indicates expired session, try to refresh
    if (error && (error.message?.includes('session') || error.message?.includes('token') || error.message?.includes('expired'))) {
      console.log('Session expired, attempting refresh...');
      try {
        const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError && session?.user) {
          // Refresh succeeded, return the user
          return session.user;
        }
      } catch (refreshErr) {
        console.error('Error refreshing session:', refreshErr);
      }
    }
    
    if (error || !user) {
      console.error('Error getting current user:', error);
      return null;
    }

    return user;
  } catch (error) {
    console.error('Error in getCurrentUser:', error);
    return null;
  }
}

/**
 * Get the current user's profile with roles (client-side only)
 * @returns The user profile with roles or null if not found
 */
export async function getCurrentUserProfile() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.log('No user found in getCurrentUserProfile');
      return null;
    }

    const supabase = createClientSupabase();
    if (!supabase) {
      if (process.env.NODE_ENV === 'development') {
        console.log('No Supabase client available');
      }
      return null;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('Fetching user profile for user ID:', user.id);
    }

    // First, try to get just the profile without joins
  // This avoids relationship ambiguity issues
  const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (process.env.NODE_ENV === 'development') {
      console.log('Profile query result:', {
        profile: profile ? {
          id: profile.id,
          name: profile.name,
          email: profile.email
        } : null,
        error
      });
    }

    if (error) {
      console.error('=== ERROR GETTING USER PROFILE ===');
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Error details:', error.details);
      console.error('Error hint:', error.hint);
      console.error('Full error object:', JSON.stringify(error, null, 2));
      console.error('User ID we are querying for:', user.id);
      console.error('===================================');
      
      // If profile doesn't exist, try a simple query without joins
      if (error.code === 'PGRST116') {
        if (process.env.NODE_ENV === 'development') {
          console.log('User profile not found with joins. Trying simple query...');
        }
        
        const { data: simpleProfile, error: simpleError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single();
          
        if (simpleError) {
          console.error('Profile not found even with simple query:', simpleError);
          return null;
        }

        if (process.env.NODE_ENV === 'development') {
          console.log('Found profile with simple query:', simpleProfile);
        }
        return simpleProfile as UserProfile & {
          user_roles: [];
        };
      }
      
      // For PGRST201 errors (relationship ambiguity), try a simpler query
      if (error.code === 'PGRST201') {
        if (process.env.NODE_ENV === 'development') {
          console.log('Relationship ambiguity error, trying simpler query...');
        }
        try {
          const { data: simpleProfile, error: simpleError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)
            .single();
            
          if (simpleError) {
            console.error('Simple profile query failed:', simpleError);
            return null;
          }
          
          // Return profile without roles for now
          return simpleProfile as UserProfile & {
            user_roles: [];
          };
        } catch (simpleQueryError) {
          console.error('Error with simple profile query:', simpleQueryError);
          return null;
        }
      }
      
      // For any other error, try a simpler query as fallback
      if (process.env.NODE_ENV === 'development') {
        console.log('Unknown error, trying simpler query as fallback...');
      }
      try {
        const { data: simpleProfile, error: simpleError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single();
          
        if (simpleError) {
          console.error('Simple profile query failed:', simpleError);
          // Profile should have been created by trigger, so this is a real error
          return null;
        }
        
        // Return profile without roles for now
        return simpleProfile as UserProfile & {
          user_roles: [];
        };
      } catch (simpleQueryError) {
        console.error('Error with simple profile query:', simpleQueryError);
        return null;
      }
    }

    // Fetch user_roles separately to avoid relationship ambiguity
    if (process.env.NODE_ENV === 'development') {
      console.log('Fetching user roles for user:', user.id);
    }
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select(`
        id,
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
      `)
      .eq('user_id', user.id);

    if (rolesError) {
      console.error('Error fetching user roles:', rolesError);
      // Return profile without roles if there's an error
      return {
        ...profile,
        user_roles: []
      } as UserProfile & {
        user_roles: (UserRole & {
          roles: Role & {
            departments: Department;
          };
        })[];
      };
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('User roles fetched:', userRoles);
    }

    // Return profile with user_roles
    return {
      ...profile,
      user_roles: userRoles || []
    } as UserProfile & {
      user_roles: (UserRole & {
        roles: Role & {
          departments: Department;
        };
      })[];
    };
  } catch (error) {
    console.error('Error in getCurrentUserProfile:', error);
    return null;
  }
}

/**
 * Sign in with email and password
 * @param email - User's email
 * @param password - User's password
 * @returns Auth response with user and session
 */
export async function signInWithEmail(email: string, password: string) {
  try {
    const supabase = createClientSupabase();
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Sign in error:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in signInWithEmail:', error);
    throw error;
  }
}

/**
 * Sign up with email and password
 * @param email - User's email
 * @param password - User's password
 * @param name - User's name
 * @returns Auth response with user and session
 */
export async function signUpWithEmail(email: string, password: string, name: string) {
  try {
    const supabase = createClientSupabase();
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
        emailRedirectTo: `${window.location.origin}/welcome`,
      },
    });

    if (error) {
      console.error('Sign up error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        fullError: error
      });
      
      // Handle specific Supabase auth errors
      if (error.message?.includes('User already registered') || error.message?.includes('already been registered')) {
        throw new Error('User already registered');
      } else if (error.message?.includes('Password should be at least')) {
        throw new Error('Password should be at least 6 characters long');
      } else if (error.message?.includes('Invalid email')) {
        throw new Error('Please enter a valid email address');
      }
      
      throw new Error(`Sign up failed: ${error.message || 'Unknown error'}`);
    }

    // Check if user was actually created (Supabase doesn't throw error for existing emails)
    if (!data.user) {
      // This is expected behavior for existing emails, not an error
      throw new Error('User already registered');
    }

    // Check if this is a new user by looking at the session
    // If there's no session, it means the user already exists and email confirmation is required
    if (data.user && !data.session) {
      // This is expected behavior for existing unconfirmed users, not an error
      throw new Error('User already registered');
    }

    // Note: User profile is automatically created by database trigger
    // See scripts/FIX-SIGNUP-RLS.sql for trigger setup
    if (process.env.NODE_ENV === 'development') {
      console.log('User created successfully. Profile will be created by database trigger.');
    }

    return data;
  } catch (error) {
    // Only log actual errors, not expected "User already registered" cases
    if (error instanceof Error && error.message === 'User already registered') {
      // This is expected behavior, not an error - just re-throw without logging
      throw error;
    }
    
    // Log actual unexpected errors
    console.error('Unexpected error in signUpWithEmail:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      fullError: error
    });
    throw error;
  }
}

/**
 * Create user profile in the database
 * @param userId - User's ID from Supabase Auth
 * @param email - User's email
 * @param name - User's name
 * @returns Created user profile
 */
export async function createUserProfile(userId: string, email: string, name: string) {
  try {
    const supabase = createClientSupabase();
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('Creating user profile for:', { userId, email, name });
      console.log('Current auth user:', await supabase.auth.getUser());
    }

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
      console.error('=== DETAILED ERROR CREATING USER PROFILE ===');
      console.error('Error message:', error.message);
      console.error('Error details:', error.details);
      console.error('Error hint:', error.hint);
      console.error('Error code:', error.code);
      console.error('Full error object:', JSON.stringify(error, null, 2));
      console.error('==========================================');
      
      // Check if it's an RLS policy error
      if (error.message?.includes('row-level security policy')) {
        throw new Error(`Failed to create user profile: Row Level Security policy is blocking user creation. Please run the RLS setup script in Supabase SQL Editor.`);
      }
      
      // Check if it's a permission error
      if (error.message?.includes('permission denied')) {
        throw new Error(`Failed to create user profile: Permission denied. Please check RLS policies.`);
      }
      
      // Check if it's a constraint error
      if (error.message?.includes('duplicate key')) {
        throw new Error(`Failed to create user profile: User profile already exists.`);
      }
      
      throw new Error(`Failed to create user profile: ${error.message || 'Unknown error'}`);
    }

    return data;
  } catch (error) {
    console.error('Error in createUserProfile:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      fullError: error
    });
    throw error;
  }
}

/**
 * Sign out the current user
 * @returns Promise that resolves when sign out is complete
 */
export async function signOut() {
  try {
    const supabase = createClientSupabase();
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in signOut:', error);
    throw error;
  }
}

/**
 * Reset password for a user
 * @param email - User's email
 * @returns Promise that resolves when reset email is sent
 */
export async function resetPassword(email: string) {
  try {
    const supabase = createClientSupabase();
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      console.error('Password reset error:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in resetPassword:', error);
    throw error;
  }
}

/**
 * Update user password
 * @param newPassword - New password
 * @returns Promise that resolves when password is updated
 */
export async function updatePassword(newPassword: string) {
  try {
    const supabase = createClientSupabase();
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      console.error('Password update error:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in updatePassword:', error);
    throw error;
  }
}

/**
 * Check if user is authenticated (client-side only)
 * @returns True if user is authenticated, false otherwise
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    return !!user;
  } catch (error) {
    console.error('Error in isAuthenticated:', error);
    return false;
  }
}

/**
 * Update user profile information
 * @param profileData - Profile data to update
 * @returns Promise that resolves when profile is updated
 */
export async function updateUserProfile(profileData: {
  name?: string;
  bio?: string;
  skills?: string[];
}) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('Updating user profile via API:', profileData);
    }

    // Call the API endpoint which enforces permission checks
    const response = await fetch('/api/profile', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(profileData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to update profile' }));
      throw new Error(errorData.error || `Failed to update profile: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (process.env.NODE_ENV === 'development') {
      console.log('User profile updated successfully');
    }
    return data.profile;
  } catch (error) {
    console.error('Error in updateUserProfile:', error);
    throw error;
  }
}

/**
 * Get the current session (client-side only)
 * @returns Current session or null
 */
export async function getCurrentSession() {
  try {
    const supabase = createClientSupabase();
    if (!supabase) return null;

    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error getting session:', error);
      return null;
    }

    return session;
  } catch (error) {
    console.error('Error in getCurrentSession:', error);
    return null;
  }
}

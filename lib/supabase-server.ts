import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

// Configure global fetch timeout to prevent connection timeout errors
const FETCH_TIMEOUT = 30000; // 30 seconds

// Check if Supabase is configured (runtime check)
const isSupabaseConfigured = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return supabaseUrl && supabaseAnonKey && 
    supabaseUrl !== 'your-supabase-url' && 
    supabaseAnonKey !== 'your-anon-key';
};

// Server component Supabase client (for use in server components)
export const createServerSupabase = async () => {
  if (!isSupabaseConfigured()) {
    console.error('Supabase not configured: Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
    return null;
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        try {
          cookieStore.set(name, value, options);
        } catch {
          // Ignore errors in API routes where cookies can't be set
        }
      },
      remove(name: string, options: Record<string, unknown>) {
        try {
          cookieStore.set(name, '', { ...options, maxAge: 0 });
        } catch {
          // Ignore errors in API routes where cookies can't be removed
        }
      },
    },
    global: {
      fetch: (url, options = {}) => {
        // Add timeout to all fetch requests to prevent hanging connections
        return fetch(url, {
          ...options,
          signal: options.signal || AbortSignal.timeout(FETCH_TIMEOUT),
        });
      },
    },
  });
};

// API route Supabase client (for use in API routes with NextRequest)
// Note: cookies() from next/headers CANNOT be used in Route Handlers (API routes)
// We must parse cookies from the request headers instead
export const createApiSupabaseClient = (request: NextRequest) => {
  if (!isSupabaseConfigured()) {
    console.error('Supabase not configured: Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
    return null;
  }
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  // Parse cookies from request header - this is the correct way for Route Handlers
  const cookieHeader = request.headers.get('cookie') || '';
  const parsedCookies: Record<string, string> = {};
  
  // Parse cookie header - simple and reliable parsing
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const trimmed = cookie.trim();
      if (!trimmed) return;
      
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmed.substring(0, equalIndex).trim();
        // Get everything after '=' 
        let value = trimmed.substring(equalIndex + 1);
        // Try URL decoding - cookies in headers are often URL encoded
        try {
          // Only decode if it looks URL encoded (contains %)
          if (value.includes('%')) {
            value = decodeURIComponent(value);
          }
        } catch (e) {
          // If decoding fails, use original value
        }
        parsedCookies[key] = value;
      }
    });
  }
  
  // Also check request.cookies as a fallback
  request.cookies.getAll().forEach(cookie => {
    if (!parsedCookies[cookie.name]) {
      parsedCookies[cookie.name] = cookie.value;
    }
  });
  
  return createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      get(name: string) {
        // Return the exact cookie value as-is
        return parsedCookies[name];
      },
      set(name: string, value: string, options: any) {
        // Cookies can't be set in API routes during the request
        // They need to be set in the response headers
      },
      remove(name: string, options: any) {
        // Cookies can't be removed in API routes during the request
      },
    },
    global: {
      fetch: (url, options = {}) => {
        // Add timeout to all fetch requests to prevent hanging connections
        return fetch(url, {
          ...options,
          signal: options.signal || AbortSignal.timeout(FETCH_TIMEOUT),
        });
      },
    },
  });
};

// Alias for backwards compatibility
export const createServerSupabaseClient = createServerSupabase;

/**
 * Get user profile from API route supabase client
 * Use this in API routes to get the authenticated user's profile
 */
export async function getUserProfileFromRequest(supabase: ReturnType<typeof createApiSupabaseClient>) {
  if (!supabase) return null;

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return null;
  }

  // Get user profile
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return null;
  }

  // Fetch user roles separately
  const { data: userRoles } = await supabase
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

  return {
    ...profile,
    user_roles: userRoles || []
  };
}

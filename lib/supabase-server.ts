import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

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
      set(name: string, value: string, options: any) {
        try {
          cookieStore.set(name, value, options);
        } catch (error) {
          // Ignore errors in API routes where cookies can't be set
        }
      },
      remove(name: string, options: any) {
        try {
          cookieStore.set(name, '', { ...options, maxAge: 0 });
        } catch (error) {
          // Ignore errors in API routes where cookies can't be removed
        }
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
  });
};

// Alias for backwards compatibility
export const createServerSupabaseClient = createServerSupabase;

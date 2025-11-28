import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { applyRateLimit } from './lib/rate-limit';

/**
 * Middleware - Security, Rate Limiting & Basic Route Protection
 *
 * This middleware handles:
 * 1. Rate limiting (to prevent abuse and DoS attacks)
 * 2. Security headers (CSP, HSTS, etc.)
 * 3. Basic authentication check (presence of auth cookies)
 *
 * NOTE: Full authentication and permission checks are done in pages/components
 * to avoid Edge Runtime compatibility issues with Supabase client.
 */

// Public routes that don't require authentication
const publicRoutes = [
  '/',
  '/login',
  '/signup',
  '/pending-approval',
  '/welcome',
];

/**
 * Check if user has Supabase auth cookies
 * We only check for cookie presence, not validity, to avoid Edge Runtime issues
 */
function hasAuthCookies(req: NextRequest): boolean {
  // Supabase stores auth tokens in cookies with these patterns
  const authCookieNames = [
    'sb-access-token',
    'sb-refresh-token',
  ];

  // Check for any Supabase auth cookie
  const cookies = req.cookies;
  for (const cookieName of authCookieNames) {
    if (cookies.get(cookieName)) {
      return true;
    }
  }

  // Also check for cookies with sb- prefix (Supabase cookies)
  const allCookies = cookies.getAll();
  return allCookies.some(cookie => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token'));
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Apply rate limiting to API routes
  if (pathname.startsWith('/api')) {
    const rateLimitResponse = await applyRateLimit(req);
    if (rateLimitResponse) {
      return rateLimitResponse; // Rate limit exceeded
    }
  }

  // Create response with security headers
  const res = NextResponse.next();

  // Add security headers
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-XSS-Protection', '1; mode=block');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Add HSTS in production
  if (process.env.NODE_ENV === 'production') {
    res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // Allow public routes, Next.js internals, and API routes
  if (publicRoutes.includes(pathname) || pathname.startsWith('/_next') || pathname.startsWith('/api')) {
    return res;
  }

  // Simple auth check: If no auth cookies, redirect to login
  // Pages will do full authentication validation
  const hasAuth = hasAuthCookies(req);

  if (!hasAuth) {
    const redirectUrl = new URL('/login', req.url);
    redirectUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Allow the request to proceed
  // Full authentication, role checks, and permission validation
  // happen in the actual page components to avoid Edge Runtime issues
  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

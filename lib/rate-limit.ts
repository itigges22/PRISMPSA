/**
 * Rate Limiting Utility
 * Provides request rate limiting to prevent abuse and DoS attacks
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';
import { config } from './config';
import { logger } from './debug-logger';

// Initialize Redis client (will be undefined if not configured)
let redis: Redis | undefined;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

// Create rate limiters
let generalLimiter: Ratelimit | undefined;
let authLimiter: Ratelimit | undefined;

if (redis) {
  // General API rate limiter
  generalLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.rateLimit.maxRequests, `${config.rateLimit.windowMs}ms`),
    analytics: true,
    prefix: 'ratelimit:general',
  });

  // Stricter rate limiter for authentication endpoints
  authLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.rateLimit.auth.maxRequests, `${config.rateLimit.auth.windowMs}ms`),
    analytics: true,
    prefix: 'ratelimit:auth',
  });
}

/**
 * Get client IP address from request
 */
function getClientIp(request: NextRequest): string {
  // Try to get real IP from headers (for reverse proxies)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to localhost (Next.js 15+ doesn't have request.ip property)
  return '127.0.0.1';
}

/**
 * Check if endpoint is an authentication endpoint
 */
function isAuthEndpoint(pathname: string): boolean {
  const authPaths = [
    '/api/auth',
    '/api/login',
    '/api/register',
    '/api/signup',
    '/api/password',
    '/api/reset',
  ];

  return authPaths.some(path => pathname.startsWith(path));
}

/**
 * Apply rate limiting to a request
 * Returns null if request is allowed, or a NextResponse with 429 status if rate limited
 */
export async function applyRateLimit(request: NextRequest): Promise<NextResponse | null> {
  // Skip rate limiting if disabled
  if (!config.rateLimit.enabled) {
    logger.debug('Rate limiting is disabled', { action: 'rate_limit' });
    return null;
  }

  // Skip if Redis is not configured
  if (!redis || !generalLimiter || !authLimiter) {
    logger.warn('Rate limiting skipped: Redis not configured', { action: 'rate_limit' });
    return null;
  }

  const ip = getClientIp(request);
  const pathname = request.nextUrl.pathname;

  // Determine which limiter to use
  const limiter = isAuthEndpoint(pathname) ? authLimiter : generalLimiter;
  const limiterType = isAuthEndpoint(pathname) ? 'auth' : 'general';

  try {
    const { success, limit, remaining, reset, pending } = await limiter.limit(ip);

    // Log rate limit check
    logger.debug(`Rate limit check: ${success ? 'allowed' : 'blocked'}`, {
      action: 'rate_limit',
      ip,
      pathname,
      limiter: limiterType,
      remaining,
      reset: new Date(reset).toISOString(),
    });

    if (!success) {
      logger.warn(`Rate limit exceeded`, {
        action: 'rate_limit_exceeded',
        ip,
        pathname,
        limiter: limiterType,
      });

      return new NextResponse(
        JSON.stringify({
          error: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil((reset - Date.now()) / 1000),
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString(),
            'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // Add rate limit headers to successful requests
    request.headers.set('X-RateLimit-Limit', limit.toString());
    request.headers.set('X-RateLimit-Remaining', remaining.toString());
    request.headers.set('X-RateLimit-Reset', reset.toString());

    return null; // Request is allowed
  } catch (error) {
    logger.error('Rate limit check failed', { action: 'rate_limit', pathname, ip }, error as Error);
    // Allow request on error (fail open)
    return null;
  }
}

/**
 * Check rate limit for a specific identifier (e.g., user ID)
 * Useful for custom rate limiting logic
 */
export async function checkRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  if (!redis) {
    return { success: true, limit: maxRequests, remaining: maxRequests, reset: Date.now() + windowMs };
  }

  const customLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(maxRequests, `${windowMs}ms`),
    analytics: true,
    prefix: `ratelimit:custom:${identifier}`,
  });

  const result = await customLimiter.limit(identifier);
  return result;
}

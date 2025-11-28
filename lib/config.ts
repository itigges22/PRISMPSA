/**
 * Environment-Aware Security Configuration
 *
 * This file provides a centralized configuration for security features
 * that adapts based on the environment (development vs production).
 */

export const config = {
  // Environment detection
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',

  // Logging configuration
  logging: {
    // Log level: 'debug' | 'info' | 'warn' | 'error'
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'error'),

    // Show verbose logs in development
    verbose: process.env.NODE_ENV === 'development',

    // Include stack traces in development only
    includeStackTrace: process.env.NODE_ENV === 'development',

    // Sanitize sensitive data in production
    sanitizeSensitiveData: process.env.NODE_ENV === 'production',
  },

  // Rate limiting configuration
  rateLimit: {
    // Enable rate limiting (disabled in development by default, can override with env var)
    enabled: process.env.ENABLE_RATE_LIMIT === 'true' || process.env.NODE_ENV === 'production',

    // Time window in milliseconds
    windowMs: 15 * 60 * 1000, // 15 minutes

    // Max requests per window
    maxRequests: process.env.NODE_ENV === 'development' ? 10000 : 100,

    // Stricter limits for authentication endpoints
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: process.env.NODE_ENV === 'development' ? 1000 : 5,
    },
  },

  // Error handling configuration
  errors: {
    // Expose detailed error messages in development only
    exposeDetails: process.env.NODE_ENV === 'development',

    // Include error codes in development
    includeErrorCodes: process.env.NODE_ENV === 'development',

    // Include hints in development
    includeHints: process.env.NODE_ENV === 'development',
  },

  // Security headers configuration
  security: {
    // Content Security Policy
    csp: {
      enabled: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-eval'", "'unsafe-inline'"], // Next.js requires unsafe-eval for dev
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        fontSrc: ["'self'", "data:"],
        connectSrc: ["'self'", process.env.NEXT_PUBLIC_SUPABASE_URL || ''].filter(Boolean),
        frameSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },

    // CORS configuration
    cors: {
      allowedOrigins: process.env.NODE_ENV === 'development'
        ? ['http://localhost:3000', 'http://localhost:3001']
        : [process.env.NEXT_PUBLIC_APP_URL || ''].filter(Boolean),
    },
  },

  // Validation configuration
  validation: {
    // Strict validation in production
    strict: process.env.NODE_ENV === 'production',

    // Coerce types in development for easier testing
    coerce: process.env.NODE_ENV === 'development',
  },
};

export type Config = typeof config;

// Helper function to get config value
export function getConfig<K extends keyof Config>(key: K): Config[K] {
  return config[key];
}

// Export individual sections for convenience
export const { logging, rateLimit, errors, security, validation } = config;

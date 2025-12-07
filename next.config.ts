import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ['@supabase/ssr'],

  // Configure on-demand revalidation for chunk loading
  experimental: {
    // optimizePackageImports disabled - causes vendor-chunks MODULE_NOT_FOUND in Next.js 15 dev mode
    // optimizePackageImports: [
    //   'lucide-react',
    //   '@radix-ui/react-icons',
    //   '@radix-ui/react-dialog',
    //   '@radix-ui/react-select',
    //   '@radix-ui/react-dropdown-menu',
    //   '@radix-ui/react-tooltip',
    //   '@radix-ui/react-popover',
    //   '@radix-ui/react-tabs',
    //   '@radix-ui/react-label',
    //   '@radix-ui/react-slot',
    //   '@xyflow/react',
    //   'recharts',
    //   'date-fns',
    // ],
    // optimizeCss: true, // Disabled - causes CSS MIME type issues in Next.js 15 dev mode
    optimizeServerReact: true,
  },

  // Production optimizations
  reactStrictMode: true,

  // Performance optimizations
  poweredByHeader: false,
  compress: true,

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },

  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  // Reduce compilation overhead
  typescript: {
    // Skip type checking during build for faster dev compilation
    ignoreBuildErrors: false,
  },

  // Security Headers
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          },
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: process.env.NODE_ENV === 'production'
              ? [
                  "default-src 'self'",
                  "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
                  "style-src 'self' 'unsafe-inline'",
                  "img-src 'self' data: https: blob:",
                  "font-src 'self' data:",
                  `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}`,
                  "frame-src 'self'",
                  "object-src 'none'",
                  "base-uri 'self'",
                  "form-action 'self'",
                  "frame-ancestors 'none'",
                  "upgrade-insecure-requests"
                ].join('; ')
              : // More lenient CSP for development
                [
                  "default-src 'self'",
                  "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
                  "style-src 'self' 'unsafe-inline'",
                  "img-src 'self' data: https: blob:",
                  "font-src 'self' data:",
                  "connect-src 'self' ws://localhost:* http://localhost:* https://*.supabase.co",
                  "frame-src 'self'",
                ].join('; ')
          }
        ],
      },
    ];
  },
};

export default nextConfig;

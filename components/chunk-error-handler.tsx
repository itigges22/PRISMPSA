'use client';

import { useEffect, useRef } from 'react';

/**
 * Global error handler for Next.js chunk loading failures
 * This component handles "Loading chunk failed" errors that can occur
 * during development when chunks are updated via HMR (Hot Module Replacement)
 * or in production when new deployments are made while users have the app open.
 *
 * IMPORTANT: Only reloads on genuine chunk loading failures, not during normal HMR updates.
 */
export function ChunkErrorHandler() {
  const reloadAttemptedRef = useRef(false);
  const isDevelopment = process.env.NODE_ENV === 'development';

  useEffect(() => {
    // Track recent errors to prevent reload loops
    let errorCount = 0;
    let lastErrorTime = 0;
    const MAX_ERRORS_BEFORE_GIVING_UP = 3;
    const ERROR_RESET_INTERVAL = 5000; // Reset error count after 5 seconds

    // Handle chunk loading errors globally
    const handleChunkError = (event: ErrorEvent) => {
      const error = event.error || event.message;
      const errorMessage = error?.message || (typeof error === 'string' ? error : '');

      // More specific chunk error detection - avoid false positives
      const isChunkError = (
        errorMessage.includes('Loading chunk') ||
        errorMessage.includes('ChunkLoadError') ||
        (errorMessage.includes('Failed to fetch') && errorMessage.includes('dynamically imported module'))
      );

      if (!isChunkError) {
        return false;
      }

      // In development, log but don't reload immediately
      // HMR will handle module updates without full page reload
      if (isDevelopment) {
        console.warn('Chunk loading error detected in development (HMR will handle):', errorMessage);
        return false; // Let HMR handle it
      }

      // Production: Check error frequency to prevent reload loops
      const now = Date.now();
      if (now - lastErrorTime > ERROR_RESET_INTERVAL) {
        errorCount = 0;
      }
      errorCount++;
      lastErrorTime = now;

      if (errorCount > MAX_ERRORS_BEFORE_GIVING_UP) {
        console.error('Too many chunk errors, giving up on auto-reload');
        return false;
      }

      // Prevent multiple reload attempts
      if (reloadAttemptedRef.current) {
        return false;
      }

      console.warn('Chunk loading error detected in production, reloading page...', errorMessage);
      reloadAttemptedRef.current = true;

      // Wait a bit before reloading to avoid rapid reload loops
      setTimeout(() => {
        window.location.reload();
      }, 500);

      // Prevent default error handling
      event.preventDefault();
      return true;
    };

    // Handle unhandled promise rejections (common with chunk loading failures)
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const errorMessage = reason?.message || reason?.toString() || '';

      // More specific chunk error detection
      const isChunkError = (
        errorMessage.includes('Loading chunk') ||
        errorMessage.includes('ChunkLoadError') ||
        (errorMessage.includes('Failed to fetch') && errorMessage.includes('dynamically imported module'))
      );

      if (!isChunkError) {
        return false;
      }

      // In development, log but don't reload
      if (isDevelopment) {
        console.warn('Chunk loading promise rejection in development (HMR will handle):', errorMessage);
        return false;
      }

      // Prevent multiple reload attempts
      if (reloadAttemptedRef.current) {
        return false;
      }

      console.warn('Chunk loading promise rejection in production, reloading page...', errorMessage);
      reloadAttemptedRef.current = true;

      // Wait a bit before reloading
      setTimeout(() => {
        window.location.reload();
      }, 500);

      // Prevent default error handling
      event.preventDefault();
      return true;
    };

    // Add event listeners
    window.addEventListener('error', handleChunkError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Cleanup
    return () => {
      window.removeEventListener('error', handleChunkError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [isDevelopment]);

  return null;
}


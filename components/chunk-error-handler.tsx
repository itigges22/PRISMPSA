'use client';

import { useEffect } from 'react';

/**
 * Global error handler for Next.js chunk loading failures
 * This component handles "Loading chunk failed" errors that can occur
 * during development when chunks are updated via HMR (Hot Module Replacement)
 */
export function ChunkErrorHandler() {
  useEffect(() => {
    // Handle chunk loading errors globally
    const handleChunkError = (event: ErrorEvent) => {
      const error = event.error || event.message;
      
      // Check if it's a chunk loading error
      if (
        error?.message?.includes('Loading chunk') ||
        error?.message?.includes('Failed to fetch dynamically imported module') ||
        error?.message?.includes('ChunkLoadError') ||
        (typeof error === 'string' && error.includes('chunk'))
      ) {
        console.warn('Chunk loading error detected, reloading page...', error);
        
        // Wait a bit before reloading to avoid rapid reload loops
        setTimeout(() => {
          // Clear the error state and reload
          window.location.reload();
        }, 100);
        
        // Prevent default error handling
        event.preventDefault();
        return true;
      }
      
      return false;
    };

    // Handle unhandled promise rejections (common with chunk loading failures)
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const errorMessage = reason?.message || reason?.toString() || '';
      
      // Check if it's a chunk loading error
      if (
        errorMessage.includes('Loading chunk') ||
        errorMessage.includes('Failed to fetch dynamically imported module') ||
        errorMessage.includes('ChunkLoadError') ||
        errorMessage.includes('chunk')
      ) {
        console.warn('Chunk loading promise rejection detected, reloading page...', reason);
        
        // Wait a bit before reloading
        setTimeout(() => {
          window.location.reload();
        }, 100);
        
        // Prevent default error handling
        event.preventDefault();
        return true;
      }
      
      return false;
    };

    // Add event listeners
    window.addEventListener('error', handleChunkError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Cleanup
    return () => {
      window.removeEventListener('error', handleChunkError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null;
}


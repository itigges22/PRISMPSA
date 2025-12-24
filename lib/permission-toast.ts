/**
 * Permission Toast Utility
 * Shows user-friendly toast notifications for permission errors
 */

import { toast } from 'sonner';

// Track recently shown toasts to prevent spam
const recentToasts = new Map<string, number>();
const TOAST_COOLDOWN = 30000; // 30 seconds between duplicate toasts

/**
 * Show a permission denied toast notification
 * @param message Optional custom message
 * @param resource Optional resource type (e.g., "accounts", "projects")
 */
export function showPermissionDeniedToast(message?: string, resource?: string) {
  const toastKey = message || resource || 'generic';
  const now = Date.now();
  const lastShown = recentToasts.get(toastKey);

  // Prevent spam - don't show same toast within cooldown period
  if (lastShown && now - lastShown < TOAST_COOLDOWN) {
    return;
  }

  recentToasts.set(toastKey, now);

  const displayMessage = message
    || (resource ? `You don't have permission to access ${resource}` : 'You don\'t have permission to perform this action');

  toast.error('Permission Denied', {
    description: displayMessage,
    duration: 4000,
  });
}

/**
 * Handle API response and show toast for permission errors
 * @param response Fetch response object
 * @param resource Optional resource type for context
 * @returns true if permission error occurred
 */
export function handleApiPermissionError(response: Response, resource?: string): boolean {
  if (response.status === 403) {
    showPermissionDeniedToast(undefined, resource);
    return true;
  }
  return false;
}

/**
 * Parse API error response and show appropriate toast
 * @param error Error object or response data
 * @param resource Optional resource type for context
 */
export function handlePermissionErrorFromData(error: unknown, resource?: string): boolean {
  if (!error) return false;

  const errorObj = error as { code?: string; error?: string; message?: string };

  if (
    errorObj.code === 'PERMISSION_DENIED' ||
    errorObj.error?.toLowerCase().includes('permission') ||
    errorObj.error?.toLowerCase().includes('forbidden') ||
    errorObj.message?.toLowerCase().includes('permission') ||
    errorObj.message?.toLowerCase().includes('forbidden')
  ) {
    showPermissionDeniedToast(errorObj.message || errorObj.error, resource);
    return true;
  }

  return false;
}

import { NextResponse } from 'next/server';
import { BlockedAction, isActionBlocked, getBlockedActionMessage } from './demo-mode';

/**
 * API route helper to check and block destructive actions in demo mode.
 * Returns a 403 response if the action is blocked, or null if allowed.
 *
 * Usage in API routes:
 * ```typescript
 * export async function DELETE(request: NextRequest) {
 *   const blocked = checkDemoModeForDestructiveAction('delete_project');
 *   if (blocked) return blocked;
 *
 *   // Continue with delete logic...
 * }
 * ```
 */
export function checkDemoModeForDestructiveAction(action: BlockedAction): NextResponse | null {
  if (isActionBlocked(action)) {
    return NextResponse.json(
      {
        error: getBlockedActionMessage(action),
        code: 'DEMO_MODE_BLOCKED',
        action,
      },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Helper to determine if demo mode is active on the server side.
 */
export function isDemoModeServer(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || process.env.DEMO_MODE === 'true';
}

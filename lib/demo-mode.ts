/**
 * Demo Mode Configuration
 *
 * Provides centralized control for demo mode features including:
 * - Quick-login user definitions
 * - Destructive action blocking
 * - Environment detection
 */

export interface DemoUser {
  id: string;
  email: string;
  name: string;
  role: string;
  description: string;
  password: string;
  color: string;
}

/**
 * Demo users - excludes superadmin for security
 * These match the seed users created by scripts/create-seed-users.ts
 */
export const DEMO_USERS: DemoUser[] = [
  {
    id: '11111111-1111-1111-1111-000000000002',
    email: 'exec@test.local',
    name: 'Alex Executive',
    role: 'Executive Director',
    description: 'Full visibility across all accounts and projects',
    password: 'Test1234!',
    color: 'bg-purple-500',
  },
  {
    id: '11111111-1111-1111-1111-000000000003',
    email: 'manager@test.local',
    name: 'Morgan Manager',
    role: 'Account Manager',
    description: 'Manages client accounts and team assignments',
    password: 'Test1234!',
    color: 'bg-blue-500',
  },
  {
    id: '11111111-1111-1111-1111-000000000004',
    email: 'pm@test.local',
    name: 'Pat ProjectManager',
    role: 'Project Manager',
    description: 'Coordinates projects and tasks across teams',
    password: 'Test1234!',
    color: 'bg-green-500',
  },
  {
    id: '11111111-1111-1111-1111-000000000009',
    email: 'admin@test.local',
    name: 'Andy Admin',
    role: 'Admin',
    description: 'Manages workflows, roles, and views all analytics',
    password: 'Test1234!',
    color: 'bg-red-500',
  },
  {
    id: '11111111-1111-1111-1111-000000000005',
    email: 'designer@test.local',
    name: 'Dana Designer',
    role: 'Senior Designer',
    description: 'Creates designs and manages creative work',
    password: 'Test1234!',
    color: 'bg-pink-500',
  },
  {
    id: '11111111-1111-1111-1111-000000000006',
    email: 'dev@test.local',
    name: 'Dev Developer',
    role: 'Senior Developer',
    description: 'Builds features and manages technical tasks',
    password: 'Test1234!',
    color: 'bg-orange-500',
  },
  {
    id: '11111111-1111-1111-1111-000000000008',
    email: 'client@test.local',
    name: 'Chris Client',
    role: 'Client',
    description: 'External client with portal access only',
    password: 'Test1234!',
    color: 'bg-gray-500',
  },
];

/**
 * Check if demo mode is enabled via environment variable
 * Works on both client and server side
 */
export function isDemoMode(): boolean {
  // Client-side check (NEXT_PUBLIC_ prefix required for browser access)
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  }
  // Server-side check
  return (
    process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ||
    process.env.DEMO_MODE === 'true'
  );
}

/**
 * Get demo user by email
 */
export function getDemoUser(email: string): DemoUser | undefined {
  return DEMO_USERS.find((u) => u.email === email);
}

/**
 * Actions that can be blocked in demo mode
 */
export type BlockedAction =
  | 'delete_account'
  | 'remove_user'
  | 'delete_department'
  | 'delete_role'
  | 'delete_newsletter'
  | 'delete_project'
  | 'delete_task'
  | 'delete_time_entry'
  | 'delete_workflow'
  | 'superadmin_setup'
  | 'remove_account_member';

/**
 * Check if an action is blocked in demo mode
 */
export function isActionBlocked(action: BlockedAction): boolean {
  if (!isDemoMode()) return false;

  // All these destructive actions are blocked in demo mode
  const blockedActions: BlockedAction[] = [
    'delete_account',
    'remove_user',
    'delete_department',
    'delete_role',
    'delete_newsletter',
    'delete_project',
    'delete_task',
    'delete_time_entry',
    'delete_workflow',
    'superadmin_setup',
    'remove_account_member',
  ];

  return blockedActions.includes(action);
}

/**
 * Get user-friendly message when action is blocked
 */
export function getBlockedActionMessage(action: BlockedAction): string {
  const messages: Record<BlockedAction, string> = {
    delete_account: 'Deleting accounts is disabled in demo mode',
    remove_user: 'Removing users is disabled in demo mode',
    delete_department: 'Deleting departments is disabled in demo mode',
    delete_role: 'Deleting roles is disabled in demo mode',
    delete_newsletter: 'Deleting newsletters is disabled in demo mode',
    delete_project: 'Deleting projects is disabled in demo mode',
    delete_task: 'Deleting tasks is disabled in demo mode',
    delete_time_entry: 'Deleting time entries is disabled in demo mode',
    delete_workflow: 'Deleting workflows is disabled in demo mode',
    superadmin_setup: 'Superadmin setup is disabled in demo mode',
    remove_account_member: 'Removing account members is disabled in demo mode',
  };

  return messages[action];
}

/**
 * Comprehensive Unit Tests for Permission Checker
 * Tests the hybrid RBAC system with base, context-aware, and override permissions
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { checkPermissionHybrid, hasBasePermission } from '@/lib/permission-checker';
import { Permission } from '@/lib/permissions';
import { UserWithRoles } from '@/lib/rbac';

// Mock Supabase client
jest.mock('@/lib/supabase-server', () => ({
  createServerSupabase: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
        in: jest.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
  })),
}));

describe('Permission Checker - Base Permissions', () => {
  let mockUser: UserWithRoles;

  beforeEach(() => {
    // Reset cache before each test
    jest.clearAllMocks();
  });

  it('should return false for null user', async () => {
    const result = await checkPermissionHybrid(null, Permission.VIEW_PROJECTS);
    expect(result).toBe(false);
  });

  it('should return true for superadmin regardless of permission', async () => {
    mockUser = {
      id: 'user-1',
      email: 'superadmin@test.com',
      name: 'Super Admin',
      roles: [{
        id: 'role-1',
        name: 'Superadmin',
        is_superadmin: true,
        permissions: [],
      }],
    } as UserWithRoles;

    const result = await checkPermissionHybrid(mockUser, Permission.VIEW_PROJECTS);
    expect(result).toBe(true);
  });

  it('should return true when user has base permission', async () => {
    mockUser = {
      id: 'user-2',
      email: 'user@test.com',
      name: 'Test User',
      roles: [{
        id: 'role-2',
        name: 'Test Role',
        is_superadmin: false,
        permissions: [
          { permission: Permission.VIEW_PROJECTS, granted: true },
        ],
      }],
    } as UserWithRoles;

    const result = await checkPermissionHybrid(mockUser, Permission.VIEW_PROJECTS);
    expect(result).toBe(true);
  });

  it('should return false when user lacks base permission', async () => {
    mockUser = {
      id: 'user-3',
      email: 'user@test.com',
      name: 'Test User',
      roles: [{
        id: 'role-3',
        name: 'Test Role',
        is_superadmin: false,
        permissions: [],
      }],
    } as UserWithRoles;

    const result = await checkPermissionHybrid(mockUser, Permission.VIEW_PROJECTS);
    expect(result).toBe(false);
  });

  it('should respect granted=false even if permission exists', async () => {
    mockUser = {
      id: 'user-4',
      email: 'user@test.com',
      name: 'Test User',
      roles: [{
        id: 'role-4',
        name: 'Test Role',
        is_superadmin: false,
        permissions: [
          { permission: Permission.VIEW_PROJECTS, granted: false },
        ],
      }],
    } as UserWithRoles;

    const result = await checkPermissionHybrid(mockUser, Permission.VIEW_PROJECTS);
    expect(result).toBe(false);
  });
});

describe('Permission Checker - Override Permissions', () => {
  let mockUser: UserWithRoles;

  it('should grant VIEW_PROJECTS when user has VIEW_ALL_PROJECTS', async () => {
    mockUser = {
      id: 'user-5',
      email: 'user@test.com',
      name: 'Test User',
      roles: [{
        id: 'role-5',
        name: 'Test Role',
        is_superadmin: false,
        permissions: [
          { permission: Permission.VIEW_ALL_PROJECTS, granted: true },
        ],
      }],
    } as UserWithRoles;

    const result = await checkPermissionHybrid(mockUser, Permission.VIEW_PROJECTS);
    expect(result).toBe(true);
  });

  it('should grant EDIT_PROJECT when user has EDIT_ALL_PROJECTS', async () => {
    mockUser = {
      id: 'user-6',
      email: 'user@test.com',
      name: 'Test User',
      roles: [{
        id: 'role-6',
        name: 'Test Role',
        is_superadmin: false,
        permissions: [
          { permission: Permission.EDIT_ALL_PROJECTS, granted: true },
        ],
      }],
    } as UserWithRoles;

    const result = await checkPermissionHybrid(mockUser, Permission.EDIT_PROJECT);
    expect(result).toBe(true);
  });

  it('should grant EDIT_ACCOUNT when user has VIEW_ALL_ACCOUNTS', async () => {
    mockUser = {
      id: 'user-7',
      email: 'user@test.com',
      name: 'Test User',
      roles: [{
        id: 'role-7',
        name: 'Test Role',
        is_superadmin: false,
        permissions: [
          { permission: Permission.VIEW_ALL_ACCOUNTS, granted: true },
        ],
      }],
    } as UserWithRoles;

    const result = await checkPermissionHybrid(mockUser, Permission.EDIT_ACCOUNT);
    expect(result).toBe(true);
  });

  it('should grant EDIT_DEPARTMENT when user has VIEW_ALL_DEPARTMENTS', async () => {
    mockUser = {
      id: 'user-8',
      email: 'user@test.com',
      name: 'Test User',
      roles: [{
        id: 'role-8',
        name: 'Test Role',
        is_superadmin: false,
        permissions: [
          { permission: Permission.VIEW_ALL_DEPARTMENTS, granted: true },
        ],
      }],
    } as UserWithRoles;

    const result = await checkPermissionHybrid(mockUser, Permission.EDIT_DEPARTMENT);
    expect(result).toBe(true);
  });
});

describe('Permission Checker - Context-Aware Permissions', () => {
  let mockUser: UserWithRoles;

  it('should allow EDIT_ACCOUNT with base permission and accountId context', async () => {
    mockUser = {
      id: 'user-9',
      email: 'user@test.com',
      name: 'Test User',
      roles: [{
        id: 'role-9',
        name: 'Test Role',
        is_superadmin: false,
        permissions: [
          { permission: Permission.EDIT_ACCOUNT, granted: true },
        ],
      }],
    } as UserWithRoles;

    const result = await checkPermissionHybrid(
      mockUser,
      Permission.EDIT_ACCOUNT,
      { accountId: 'account-1' }
    );
    expect(result).toBe(true);
  });

  it('should allow EDIT_DEPARTMENT with base permission and departmentId context', async () => {
    mockUser = {
      id: 'user-10',
      email: 'user@test.com',
      name: 'Test User',
      roles: [{
        id: 'role-10',
        name: 'Test Role',
        is_superadmin: false,
        permissions: [
          { permission: Permission.EDIT_DEPARTMENT, granted: true },
        ],
      }],
    } as UserWithRoles;

    const result = await checkPermissionHybrid(
      mockUser,
      Permission.EDIT_DEPARTMENT,
      { departmentId: 'dept-1' }
    );
    expect(result).toBe(true);
  });
});

describe('Permission Checker - Multiple Roles', () => {
  it('should grant permission if ANY role has it', async () => {
    const mockUser: UserWithRoles = {
      id: 'user-11',
      email: 'user@test.com',
      name: 'Test User',
      roles: [
        {
          id: 'role-11a',
          name: 'Role Without Permission',
          is_superadmin: false,
          permissions: [],
        },
        {
          id: 'role-11b',
          name: 'Role With Permission',
          is_superadmin: false,
          permissions: [
            { permission: Permission.VIEW_PROJECTS, granted: true },
          ],
        },
      ],
    } as UserWithRoles;

    const result = await checkPermissionHybrid(mockUser, Permission.VIEW_PROJECTS);
    expect(result).toBe(true);
  });

  it('should deny permission if ALL roles lack it', async () => {
    const mockUser: UserWithRoles = {
      id: 'user-12',
      email: 'user@test.com',
      name: 'Test User',
      roles: [
        {
          id: 'role-12a',
          name: 'Role 1',
          is_superadmin: false,
          permissions: [
            { permission: Permission.VIEW_ACCOUNTS, granted: true },
          ],
        },
        {
          id: 'role-12b',
          name: 'Role 2',
          is_superadmin: false,
          permissions: [
            { permission: Permission.VIEW_DEPARTMENTS, granted: true },
          ],
        },
      ],
    } as UserWithRoles;

    const result = await checkPermissionHybrid(mockUser, Permission.VIEW_PROJECTS);
    expect(result).toBe(false);
  });
});

describe('Permission Checker - Edge Cases', () => {
  it('should handle user with empty roles array', async () => {
    const mockUser: UserWithRoles = {
      id: 'user-13',
      email: 'user@test.com',
      name: 'Test User',
      roles: [],
    } as UserWithRoles;

    const result = await checkPermissionHybrid(mockUser, Permission.VIEW_PROJECTS);
    expect(result).toBe(false);
  });

  it('should handle role with empty permissions array', async () => {
    const mockUser: UserWithRoles = {
      id: 'user-14',
      email: 'user@test.com',
      name: 'Test User',
      roles: [{
        id: 'role-14',
        name: 'Empty Role',
        is_superadmin: false,
        permissions: [],
      }],
    } as UserWithRoles;

    const result = await checkPermissionHybrid(mockUser, Permission.VIEW_PROJECTS);
    expect(result).toBe(false);
  });

  it('should handle undefined context gracefully', async () => {
    const mockUser: UserWithRoles = {
      id: 'user-15',
      email: 'user@test.com',
      name: 'Test User',
      roles: [{
        id: 'role-15',
        name: 'Test Role',
        is_superadmin: false,
        permissions: [
          { permission: Permission.VIEW_PROJECTS, granted: true },
        ],
      }],
    } as UserWithRoles;

    const result = await checkPermissionHybrid(mockUser, Permission.VIEW_PROJECTS, undefined);
    expect(result).toBe(true);
  });
});


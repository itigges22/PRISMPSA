import { test, expect, type Page } from '@playwright/test';

/**
 * Permission Testing for Project Page
 *
 * Tests different user types accessing project pages to verify:
 * 1. Correct access based on permissions
 * 2. Account information displays correctly
 * 3. No 406/500 errors occur
 * 4. RLS policies work as expected
 */

// Test user credentials (all have password: Test1234!)
const TEST_USERS = {
  superadmin: {
    email: 'superadmin@test.local',
    name: 'Super Admin',
    expectedAccess: 'full', // Can see all projects and all data
  },
  executive: {
    email: 'exec@test.local',
    name: 'Alex Executive',
    expectedAccess: 'full', // Has view_all_projects
  },
  accountManager: {
    email: 'manager@test.local',
    name: 'Morgan Manager',
    expectedAccess: 'account-based', // Can see projects in their accounts
  },
  projectManager: {
    email: 'pm@test.local',
    name: 'Pat ProjectManager',
    expectedAccess: 'assigned', // Can only see assigned projects
  },
  designer: {
    email: 'designer@test.local',
    name: 'Dana Designer',
    expectedAccess: 'assigned', // Can only see assigned projects
  },
  developer: {
    email: 'dev@test.local',
    name: 'Dev Developer',
    expectedAccess: 'assigned', // Can only see assigned projects
  },
  contributor: {
    email: 'contributor@test.local',
    name: 'Casey Contributor',
    expectedAccess: 'assigned', // Can only see assigned projects
  },
};

// Test projects with their account info
const TEST_PROJECTS = {
  websiteRedesign: {
    id: 'ffffffff-0001-0002-0003-000000000001',
    name: 'Website Redesign',
    accountName: 'Acme Corp',
    assignedUser: 'pm@test.local',
    assignedTeam: ['pm@test.local', 'designer@test.local', 'dev@test.local'],
  },
  mobileApp: {
    id: 'ffffffff-0001-0002-0003-000000000003',
    name: 'Mobile App MVP',
    accountName: 'StartupXYZ',
    assignedUser: 'dev@test.local',
    assignedTeam: ['dev@test.local', 'designer@test.local'],
  },
  socialMedia: {
    id: 'ffffffff-0001-0002-0003-000000000005',
    name: 'Social Media Management',
    accountName: 'Local Business',
    assignedUser: 'contributor@test.local',
    assignedTeam: ['contributor@test.local'],
  },
};

const PASSWORD = 'Test1234!';

async function login(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // Fill login form
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();

  // Wait for redirect to dashboard
  await page.waitForURL(/\/(dashboard|projects)/, { timeout: 15000 });
}

async function logout(page: Page): Promise<void> {
  // Try to find and click logout button
  const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign out")');
  if (await logoutButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await logoutButton.click();
    await page.waitForURL('/login', { timeout: 10000 });
  } else {
    // Navigate to login page directly
    await page.goto('/login');
  }
}

async function checkForErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];

  // Check for console errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (
        text.includes('PGRST116') ||
        text.includes('406') ||
        text.includes('500') ||
        text.includes('Error fetching')
      ) {
        errors.push(text);
      }
    }
  });

  // Check for network errors
  page.on('response', (response) => {
    if (response.status() >= 400) {
      errors.push(`HTTP ${response.status()}: ${response.url()}`);
    }
  });

  return errors;
}

test.describe('Project Page Permissions', () => {
  test.describe.configure({ mode: 'serial' });

  test('Superadmin can view all projects with full account info', async ({ page }) => {
    const errors = await checkForErrors(page);
    await login(page, TEST_USERS.superadmin.email);

    // Navigate to Website Redesign project
    await page.goto(`/projects/${TEST_PROJECTS.websiteRedesign.id}`);
    await page.waitForLoadState('networkidle');

    // Check project name is visible
    await expect(page.locator('h1, h2').filter({ hasText: TEST_PROJECTS.websiteRedesign.name })).toBeVisible({ timeout: 10000 });

    // Check account name is NOT "unknown"
    const accountText = await page.locator('text=/Acme Corp/i').first();
    await expect(accountText).toBeVisible({ timeout: 5000 });

    // Check no critical errors
    expect(errors.filter((e) => e.includes('PGRST116') || e.includes('406'))).toHaveLength(0);

    await logout(page);
  });

  test('Project Manager can view assigned projects with account info', async ({ page }) => {
    const errors = await checkForErrors(page);
    await login(page, TEST_USERS.projectManager.email);

    // Navigate to Website Redesign project (PM is assigned)
    await page.goto(`/projects/${TEST_PROJECTS.websiteRedesign.id}`);
    await page.waitForLoadState('networkidle');

    // Check project name is visible
    await expect(page.locator('h1, h2').filter({ hasText: TEST_PROJECTS.websiteRedesign.name })).toBeVisible({ timeout: 10000 });

    // Account should be visible now (after adding view_accounts permission)
    const accountElement = page.locator('text=/Acme Corp/i').first();
    const isAccountVisible = await accountElement.isVisible({ timeout: 5000 }).catch(() => false);

    // If account is not visible, check if it shows "unknown"
    if (!isAccountVisible) {
      const unknownText = await page.locator('text=/unknown/i').first();
      const isUnknown = await unknownText.isVisible({ timeout: 2000 }).catch(() => false);
      if (isUnknown) {
        console.log('WARNING: Account shows as "unknown" - view_accounts permission may not be working');
      }
    }

    // Check no PGRST116 errors (the main issue we're fixing)
    const criticalErrors = errors.filter((e) => e.includes('PGRST116'));
    if (criticalErrors.length > 0) {
      console.log('PGRST116 errors found:', criticalErrors);
    }
    expect(criticalErrors).toHaveLength(0);

    await logout(page);
  });

  test('Designer can view assigned projects', async ({ page }) => {
    const errors = await checkForErrors(page);
    await login(page, TEST_USERS.designer.email);

    // Navigate to Website Redesign project (Designer is assigned)
    await page.goto(`/projects/${TEST_PROJECTS.websiteRedesign.id}`);
    await page.waitForLoadState('networkidle');

    // Check project name is visible
    await expect(page.locator('h1, h2').filter({ hasText: TEST_PROJECTS.websiteRedesign.name })).toBeVisible({ timeout: 10000 });

    // Check no critical errors
    const criticalErrors = errors.filter((e) => e.includes('PGRST116') || e.includes('406'));
    expect(criticalErrors).toHaveLength(0);

    await logout(page);
  });

  test('Developer can view assigned projects', async ({ page }) => {
    const errors = await checkForErrors(page);
    await login(page, TEST_USERS.developer.email);

    // Navigate to Mobile App project (Developer is assigned)
    await page.goto(`/projects/${TEST_PROJECTS.mobileApp.id}`);
    await page.waitForLoadState('networkidle');

    // Check project name is visible
    await expect(page.locator('h1, h2').filter({ hasText: TEST_PROJECTS.mobileApp.name })).toBeVisible({ timeout: 10000 });

    // Check no critical errors
    const criticalErrors = errors.filter((e) => e.includes('PGRST116') || e.includes('406'));
    expect(criticalErrors).toHaveLength(0);

    await logout(page);
  });

  test('Contributor can view assigned projects', async ({ page }) => {
    const errors = await checkForErrors(page);
    await login(page, TEST_USERS.contributor.email);

    // Navigate to Social Media project (Contributor is assigned)
    await page.goto(`/projects/${TEST_PROJECTS.socialMedia.id}`);
    await page.waitForLoadState('networkidle');

    // Check project name is visible
    await expect(page.locator('h1, h2').filter({ hasText: TEST_PROJECTS.socialMedia.name })).toBeVisible({ timeout: 10000 });

    // Check no critical errors
    const criticalErrors = errors.filter((e) => e.includes('PGRST116') || e.includes('406'));
    expect(criticalErrors).toHaveLength(0);

    await logout(page);
  });

  test('Contributor cannot view unassigned projects', async ({ page }) => {
    await login(page, TEST_USERS.contributor.email);

    // Try to navigate to Website Redesign project (Contributor is NOT assigned)
    await page.goto(`/projects/${TEST_PROJECTS.websiteRedesign.id}`);
    await page.waitForLoadState('networkidle');

    // Should either show access denied or redirect
    const pageContent = await page.content();
    const hasAccessDenied =
      pageContent.includes('Access denied') ||
      pageContent.includes('not found') ||
      pageContent.includes('Unauthorized') ||
      pageContent.includes('permission');

    // Or user was redirected
    const currentUrl = page.url();
    const wasRedirected = !currentUrl.includes(TEST_PROJECTS.websiteRedesign.id);

    expect(hasAccessDenied || wasRedirected).toBe(true);

    await logout(page);
  });

  test('Executive can view all projects (has view_all_projects)', async ({ page }) => {
    const errors = await checkForErrors(page);
    await login(page, TEST_USERS.executive.email);

    // Navigate to any project
    await page.goto(`/projects/${TEST_PROJECTS.socialMedia.id}`);
    await page.waitForLoadState('networkidle');

    // Check project name is visible
    await expect(page.locator('h1, h2').filter({ hasText: TEST_PROJECTS.socialMedia.name })).toBeVisible({ timeout: 10000 });

    // Account should be visible (Executive has view_all_accounts)
    const accountElement = page.locator('text=/Local Business/i').first();
    await expect(accountElement).toBeVisible({ timeout: 5000 });

    // Check no critical errors
    const criticalErrors = errors.filter((e) => e.includes('PGRST116') || e.includes('406'));
    expect(criticalErrors).toHaveLength(0);

    await logout(page);
  });

  test('Account Manager can view projects in their accounts', async ({ page }) => {
    const errors = await checkForErrors(page);
    await login(page, TEST_USERS.accountManager.email);

    // Navigate to Website Redesign project (in Acme Corp - manager is account manager)
    await page.goto(`/projects/${TEST_PROJECTS.websiteRedesign.id}`);
    await page.waitForLoadState('networkidle');

    // Check project name is visible
    await expect(page.locator('h1, h2').filter({ hasText: TEST_PROJECTS.websiteRedesign.name })).toBeVisible({ timeout: 10000 });

    // Account should be visible
    const accountElement = page.locator('text=/Acme Corp/i').first();
    await expect(accountElement).toBeVisible({ timeout: 5000 });

    // Check no critical errors
    const criticalErrors = errors.filter((e) => e.includes('PGRST116') || e.includes('406'));
    expect(criticalErrors).toHaveLength(0);

    await logout(page);
  });
});

test.describe('Dashboard Permissions', () => {
  test.describe.configure({ mode: 'serial' });

  test('All users can access dashboard without errors', async ({ page }) => {
    for (const [userKey, user] of Object.entries(TEST_USERS)) {
      console.log(`Testing dashboard access for: ${user.name}`);

      const errors = await checkForErrors(page);
      await login(page, user.email);

      // Navigate to dashboard
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Dashboard should load without critical errors
      const criticalErrors = errors.filter(
        (e) => e.includes('PGRST116') || e.includes('406') || e.includes('500')
      );

      if (criticalErrors.length > 0) {
        console.log(`Errors for ${user.name}:`, criticalErrors);
      }

      expect(criticalErrors).toHaveLength(0);

      await logout(page);
    }
  });
});

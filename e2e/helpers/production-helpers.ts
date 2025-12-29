import { Page } from '@playwright/test';

// =============================================================================
// PRODUCTION TEST HELPERS
// Utilities for testing demo.movalab.dev
// =============================================================================

export const DEMO_URL = 'https://demo.movalab.dev';

// Demo user definitions
export const DEMO_USERS = {
  alex: {
    name: 'Alex Executive',
    role: 'Executive Director',
    email: 'exec@test.local',
    permissions: ['view_all_projects', 'view_all_accounts', 'manage_time', 'view_newsletters'],
  },
  morgan: {
    name: 'Morgan Manager',
    role: 'Account Manager',
    email: 'manager@test.local',
    permissions: ['manage_accounts', 'view_accounts', 'manage_time'],
  },
  pat: {
    name: 'Pat ProjectManager',
    role: 'Project Manager',
    email: 'pm@test.local',
    permissions: ['manage_projects', 'view_projects', 'manage_time'],
  },
  andy: {
    name: 'Andy Admin',
    role: 'Admin',
    email: 'admin@test.local',
    permissions: ['manage_departments', 'manage_user_roles', 'manage_workflows', 'manage_accounts'],
  },
  dana: {
    name: 'Dana Designer',
    role: 'Senior Designer',
    email: 'designer@test.local',
    permissions: ['view_projects', 'manage_time'],
  },
  dev: {
    name: 'Dev Developer',
    role: 'Senior Developer',
    email: 'dev@test.local',
    permissions: ['view_projects', 'manage_time'],
  },
  chris: {
    name: 'Chris Client',
    role: 'Client',
    email: 'client@test.local',
    permissions: [],
  },
};

// Expected seed data values
export const EXPECTED_DATA = {
  projects: {
    count: 8,
    names: [
      'Enterprise Dashboard Redesign',
      'Mobile App Development',
      'MVP Launch Website',
      'User Onboarding Flow',
      'Brand Identity Package',
      'E-commerce Platform',
      'Spring Collection Lookbook',
      'Website Redesign',
    ],
  },
  accounts: {
    count: 5,
    names: ['Acme Corporation', 'TechStart Inc', 'Green Energy Co', 'Fashion Forward', 'Urban Bistro'],
  },
  departments: {
    count: 5,
    names: ['Leadership', 'Marketing', 'Design', 'Development', 'Operations'],
  },
  newsletters: {
    count: 2,
    titles: ['Q4 Company Update', 'January Team Spotlight'],
  },
  workflows: {
    templates: ['Standard Project Delivery', 'Quick Turnaround'],
  },
  projectUpdates: {
    samples: ['Frontend development', 'Wireframes approved', 'Responsive implementation'],
  },
  projectIssues: {
    count: 5,
    samples: ['API rate limiting', 'Need access to production', 'Waiting for final copy'],
  },
};

// =============================================================================
// LOGIN / LOGOUT HELPERS
// =============================================================================

/**
 * Login using demo mode button-based authentication
 */
export async function login(page: Page, userName: string): Promise<void> {
  await page.goto(`${DEMO_URL}/login`);
  await page.waitForLoadState('networkidle');

  // Wait for demo buttons to appear
  const demoButton = page.locator(`button:has-text("${userName}")`);
  await demoButton.waitFor({ state: 'visible', timeout: 15000 });
  await demoButton.click();

  // Wait for redirect to dashboard/welcome/projects
  await page.waitForURL(/\/(welcome|dashboard|projects)/, { timeout: 20000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000); // Allow JS to settle
}

/**
 * Logout and return to login page
 */
export async function logout(page: Page): Promise<void> {
  try {
    // Try to find user menu or sign out button
    const userMenu = page.locator('[data-testid="user-menu"], button:has([class*="avatar"])').first();
    if (await userMenu.isVisible({ timeout: 2000 })) {
      await userMenu.click();
      await page.waitForTimeout(300);
    }

    const signOut = page.locator('button:has-text("Sign out"), button:has-text("Logout")').first();
    if (await signOut.isVisible({ timeout: 2000 })) {
      await signOut.click();
      await page.waitForURL('**/login', { timeout: 10000 });
      return;
    }
  } catch {
    // Fallback: navigate directly to login
  }
  await page.goto(`${DEMO_URL}/login`);
  await page.waitForLoadState('networkidle');
}

// =============================================================================
// NAVIGATION HELPERS
// =============================================================================

/**
 * Safely navigate to a page with retry logic for flaky connections
 */
export async function safeNavigate(page: Page, path: string, maxRetries = 3): Promise<void> {
  const url = path.startsWith('http') ? path : `${DEMO_URL}${path}`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForLoadState('networkidle', { timeout: 15000 });
      return;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('ERR_ABORTED') && attempt < maxRetries) {
        await page.waitForTimeout(1000);
        continue;
      }
      if (attempt === maxRetries) throw error;
    }
  }
}

/**
 * Navigate to a specific page and wait for content to load
 */
export async function navigateAndWait(page: Page, path: string, contentSelector?: string): Promise<void> {
  await safeNavigate(page, path);
  if (contentSelector) {
    await page.locator(contentSelector).first().waitFor({ state: 'visible', timeout: 10000 });
  }
}

// =============================================================================
// DATA VERIFICATION HELPERS
// =============================================================================

/**
 * Check if an element has visible, non-empty data
 */
export async function hasVisibleData(page: Page, selector: string): Promise<boolean> {
  const element = page.locator(selector).first();
  if (!(await element.isVisible({ timeout: 5000 }).catch(() => false))) {
    return false;
  }

  const text = (await element.textContent()) || '';
  const noDataPatterns = /^(0|0%|0\.0|N\/A|--|—|-|no data|none|empty|loading|\s*)$/i;
  return !noDataPatterns.test(text.trim());
}

/**
 * Check if a metric element shows a non-zero value
 */
export async function hasNonZeroMetric(page: Page, selector: string): Promise<boolean> {
  try {
    const element = page.locator(selector).first();
    const text = (await element.textContent()) || '0';
    const numValue = parseFloat(text.replace(/[^0-9.]/g, '') || '0');
    return numValue > 0;
  } catch {
    return false;
  }
}

/**
 * Verify that a chart (Recharts) has rendered data
 */
export async function verifyChartHasData(page: Page, chartContainer?: string): Promise<boolean> {
  const container = chartContainer ? page.locator(chartContainer) : page;
  const chartElements = container.locator(
    '.recharts-line, .recharts-bar, .recharts-area, path[class*="recharts"], rect[class*="recharts"]'
  );
  const count = await chartElements.count().catch(() => 0);
  return count > 0;
}

/**
 * Verify that a Recharts SVG surface is rendered
 */
export async function verifyChartRendered(page: Page, chartContainer?: string): Promise<boolean> {
  const container = chartContainer ? page.locator(chartContainer) : page;
  const surface = container.locator('.recharts-surface, .recharts-wrapper svg');
  return (await surface.count().catch(() => 0)) > 0;
}

// =============================================================================
// ERROR DETECTION HELPERS
// =============================================================================

/**
 * Check for visible error messages on the page
 */
export async function checkForErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  const errorSelectors = [
    '[class*="error"]:not([class*="no-error"])',
    '[role="alert"]',
    '.toast-error',
    '[class*="Error"]',
  ];

  for (const selector of errorSelectors) {
    try {
      const elements = page.locator(selector);
      const count = await elements.count().catch(() => 0);

      for (let i = 0; i < Math.min(count, 5); i++) {
        const text = (await elements.nth(i).textContent().catch(() => '')) || '';
        // Filter out false positives
        if (
          text &&
          text.length < 300 &&
          (text.toLowerCase().includes('fail') ||
            text.toLowerCase().includes('error') ||
            text.toLowerCase().includes('denied') ||
            text.toLowerCase().includes('unauthorized'))
        ) {
          errors.push(text.trim());
        }
      }
    } catch {
      // Ignore selector errors
    }
  }

  return [...new Set(errors)]; // Remove duplicates
}

/**
 * Check for "Access Denied" or permission errors
 */
export async function hasAccessDenied(page: Page): Promise<boolean> {
  const accessDeniedIndicators = [
    'text=/access denied/i',
    'text=/not authorized/i',
    'text=/permission denied/i',
    'text=/insufficient permission/i',
    'text=/superadmin only/i',
  ];

  for (const indicator of accessDeniedIndicators) {
    if (await page.locator(indicator).first().isVisible({ timeout: 2000 }).catch(() => false)) {
      return true;
    }
  }
  return false;
}

/**
 * Check for specific error text
 */
export async function hasErrorText(page: Page, errorText: string): Promise<boolean> {
  const errorLocator = page.locator(`text=/${errorText}/i`);
  return await errorLocator.first().isVisible({ timeout: 3000 }).catch(() => false);
}

// =============================================================================
// COUNT VERIFICATION HELPERS
// =============================================================================

/**
 * Count items matching a selector
 */
export async function countItems(page: Page, selector: string): Promise<number> {
  return await page.locator(selector).count().catch(() => 0);
}

/**
 * Verify project count
 */
export async function verifyProjectCount(page: Page, expectedMin: number): Promise<{ pass: boolean; actual: number }> {
  const projectCards = page.locator('a[href^="/projects/"]');
  const actual = await projectCards.count();
  return { pass: actual >= expectedMin, actual };
}

/**
 * Verify account count
 */
export async function verifyAccountCount(page: Page, expectedMin: number): Promise<{ pass: boolean; actual: number }> {
  const accountCards = page.locator('a[href^="/accounts/"]');
  const actual = await accountCards.count();
  return { pass: actual >= expectedMin, actual };
}

/**
 * Verify department count
 */
export async function verifyDepartmentCount(
  page: Page,
  expected: number
): Promise<{ pass: boolean; actual: number }> {
  const deptCards = page.locator('a[href^="/departments/"]');
  const actual = await deptCards.count();
  return { pass: actual >= expected, actual };
}

// =============================================================================
// DROPDOWN / FORM HELPERS
// =============================================================================

/**
 * Check if a dropdown has options populated
 */
export async function dropdownHasOptions(
  page: Page,
  triggerSelector: string,
  optionSelector = '[role="option"], option, [data-value]'
): Promise<{ hasOptions: boolean; count: number }> {
  try {
    // Click to open dropdown
    await page.locator(triggerSelector).first().click();
    await page.waitForTimeout(500);

    // Count options
    const options = page.locator(optionSelector);
    const count = await options.count();

    // Close dropdown by clicking elsewhere
    await page.keyboard.press('Escape');

    return { hasOptions: count > 0, count };
  } catch {
    return { hasOptions: false, count: 0 };
  }
}

/**
 * Check if a button is clickable (visible and enabled)
 */
export async function isButtonClickable(page: Page, buttonSelector: string): Promise<boolean> {
  const button = page.locator(buttonSelector).first();
  if (!(await button.isVisible({ timeout: 5000 }).catch(() => false))) {
    return false;
  }
  return await button.isEnabled().catch(() => false);
}

// =============================================================================
// SECTION VISIBILITY HELPERS
// =============================================================================

/**
 * Check if a section/widget is visible and has content
 */
export async function sectionHasContent(page: Page, sectionHeading: string): Promise<boolean> {
  // Find section by heading
  const section = page.locator(`text=/${sectionHeading}/i`).first();
  if (!(await section.isVisible({ timeout: 5000 }).catch(() => false))) {
    return false;
  }

  // Check if parent container has more than just the heading
  const parent = section.locator('..');
  const textContent = (await parent.textContent()) || '';
  return textContent.length > sectionHeading.length + 20;
}

/**
 * Check if specific text is visible on page
 */
export async function textIsVisible(page: Page, text: string): Promise<boolean> {
  return await page.locator(`text=/${text}/i`).first().isVisible({ timeout: 5000 }).catch(() => false);
}

/**
 * Check for any of the specified texts being visible
 */
export async function anyTextVisible(page: Page, texts: string[]): Promise<boolean> {
  for (const text of texts) {
    if (await textIsVisible(page, text)) {
      return true;
    }
  }
  return false;
}

// =============================================================================
// LOGGING HELPERS
// =============================================================================

/**
 * Log test info with timestamp
 */
export function logInfo(message: string, data?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] INFO: ${message}`, data ? JSON.stringify(data, null, 2) : '');
}

/**
 * Log test warning
 */
export function logWarning(message: string, data?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  console.warn(`[${timestamp}] WARNING: ${message}`, data ? JSON.stringify(data, null, 2) : '');
}

/**
 * Log test error
 */
export function logError(message: string, data?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ERROR: ${message}`, data ? JSON.stringify(data, null, 2) : '');
}

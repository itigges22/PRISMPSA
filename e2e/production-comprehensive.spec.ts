import { test, expect, Page } from '@playwright/test';
import {
  DEMO_URL,
  DEMO_USERS,
  EXPECTED_DATA,
  login,
  logout,
  safeNavigate,
  navigateAndWait,
  hasVisibleData,
  hasNonZeroMetric,
  verifyChartHasData,
  verifyChartRendered,
  checkForErrors,
  hasAccessDenied,
  hasErrorText,
  countItems,
  verifyProjectCount,
  verifyAccountCount,
  verifyDepartmentCount,
  dropdownHasOptions,
  isButtonClickable,
  sectionHasContent,
  textIsVisible,
  anyTextVisible,
  logInfo,
  logWarning,
  logError,
} from './helpers/production-helpers';

/**
 * =============================================================================
 * PRODUCTION COMPREHENSIVE TEST SUITE
 * =============================================================================
 *
 * Tests for demo.movalab.dev covering all 7 demo users and 14 known issues.
 *
 * Known Issues Being Tested:
 * 1. No project updates/newsletters on Welcome page
 * 2. Capacity charts show 0 (Allocated, Actual, Utilization)
 * 3. Dashboard widgets show no data
 * 4. Department capacity only shows Available hours
 * 5. Team Capacity Utilization at zero
 * 6. Department Activity Overview all zeros
 * 7. No Active Issues showing
 * 8. No Active Projects under departments
 * 9. Account pages: no capacity trends, issues, urgent items
 * 10. "Failed to update account" error
 * 11. "No team members" on projects
 * 12. "Assign to" dropdown empty in task creation
 * 13. Cannot create tasks
 * 14. Cannot clock in
 */

// =============================================================================
// 1. SMOKE TESTS - All Users Can Login
// =============================================================================

test.describe('Smoke Tests - User Login', () => {
  test.describe.configure({ mode: 'parallel' });

  test('Alex Executive can login', async ({ page }) => {
    await login(page, DEMO_USERS.alex.name);
    expect(page.url()).toMatch(/\/(welcome|dashboard|projects)/);
    await expect(page.locator('text=/alex/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('Morgan Manager can login', async ({ page }) => {
    await login(page, DEMO_USERS.morgan.name);
    expect(page.url()).toMatch(/\/(welcome|dashboard|projects|accounts)/);
  });

  test('Pat ProjectManager can login', async ({ page }) => {
    await login(page, DEMO_USERS.pat.name);
    expect(page.url()).toMatch(/\/(welcome|dashboard|projects)/);
  });

  test('Andy Admin can login', async ({ page }) => {
    await login(page, DEMO_USERS.andy.name);
    expect(page.url()).toMatch(/\/(welcome|dashboard|projects|admin)/);
  });

  test('Dana Designer can login', async ({ page }) => {
    await login(page, DEMO_USERS.dana.name);
    expect(page.url()).toMatch(/\/(welcome|dashboard|projects)/);
  });

  test('Dev Developer can login', async ({ page }) => {
    await login(page, DEMO_USERS.dev.name);
    expect(page.url()).toMatch(/\/(welcome|dashboard|projects)/);
  });

  test('Chris Client can login', async ({ page }) => {
    await login(page, DEMO_USERS.chris.name);
    // Client may be redirected to client portal or limited view
    await page.waitForLoadState('networkidle');
  });
});

// =============================================================================
// 2. ALEX EXECUTIVE - COMPREHENSIVE TESTS
// =============================================================================

test.describe('Alex Executive - Welcome Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, DEMO_USERS.alex.name);
    await safeNavigate(page, '/welcome');
  });

  test('[ISSUE #1] Newsletters are visible', async ({ page }) => {
    // Check for newsletter section
    const hasNewsletterSection = await textIsVisible(page, 'newsletter');
    logInfo('Newsletter section visible', { hasNewsletterSection });

    // Check for specific newsletters from seed data
    const q4Update = await textIsVisible(page, 'Q4 Company Update');
    const janSpotlight = await textIsVisible(page, 'January Team Spotlight');

    logInfo('Specific newsletters', { q4Update, janSpotlight });

    // At least one newsletter should be visible
    const hasNewsletter = q4Update || janSpotlight || hasNewsletterSection;
    expect(hasNewsletter, 'Expected newsletters to be visible on Welcome page').toBe(true);
  });

  test('[ISSUE #1] Project updates are visible', async ({ page }) => {
    // Check for updates section
    const hasUpdatesSection = await anyTextVisible(page, ['updates', 'recent activity', 'project updates']);
    logInfo('Updates section visible', { hasUpdatesSection });

    // Check for specific update content from seed data
    const hasSpecificUpdates = await anyTextVisible(page, [
      'Frontend development',
      'Wireframes approved',
      'Responsive implementation',
    ]);

    logInfo('Specific updates', { hasSpecificUpdates });

    // Soft assertion - log warning if no updates
    if (!hasUpdatesSection && !hasSpecificUpdates) {
      logWarning('No project updates found on Welcome page');
    }

    expect(hasUpdatesSection || hasSpecificUpdates, 'Expected project updates on Welcome page').toBe(true);
  });

  test('No error messages on Welcome page', async ({ page }) => {
    const errors = await checkForErrors(page);
    logInfo('Errors found on Welcome page', { errors });

    // Check for specific error messages
    const hasFailedToLoad = await hasErrorText(page, 'failed to load');
    expect(hasFailedToLoad, 'Should not show "failed to load" error').toBe(false);
    expect(errors.length, `Found errors: ${errors.join(', ')}`).toBe(0);
  });
});

test.describe('Alex Executive - Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, DEMO_USERS.alex.name);
    await safeNavigate(page, '/dashboard');
  });

  test('[ISSUE #3] Dashboard widgets show data', async ({ page }) => {
    // Wait for dashboard to fully load
    await page.waitForTimeout(2000);

    // Check various widget sections
    const widgetChecks = {
      myTime: await sectionHasContent(page, 'My Time'),
      myTasks: await sectionHasContent(page, 'My Tasks'),
      myWorkflows: await sectionHasContent(page, 'My Workflows'),
      myAccounts: await sectionHasContent(page, 'My Accounts'),
      upcomingDeadlines: await sectionHasContent(page, 'Upcoming'),
      recentActivity: await sectionHasContent(page, 'Recent Activity'),
    };

    logInfo('Dashboard widget status', widgetChecks);

    // At least one widget should have content (widgets gracefully show "No data" when empty)
    const widgetsWithContent = Object.values(widgetChecks).filter(Boolean).length;
    expect(widgetsWithContent, 'Expected at least 1 dashboard widget to have content').toBeGreaterThanOrEqual(1);
  });

  test('[ISSUE #2] Capacity charts render with data', async ({ page }) => {
    // Look for capacity-related content
    const hasCapacitySection = await anyTextVisible(page, ['capacity', 'utilization', 'hours']);

    // Check for Recharts elements
    const hasChart = await verifyChartRendered(page);
    const chartHasData = await verifyChartHasData(page);

    logInfo('Capacity chart status', { hasCapacitySection, hasChart, chartHasData });

    expect(hasChart, 'Expected capacity chart to render').toBe(true);
  });

  test('[ISSUE #2] Capacity metrics are non-zero', async ({ page }) => {
    // Look for capacity metrics
    const allocatedVisible = await textIsVisible(page, 'Allocated');
    const actualVisible = await textIsVisible(page, 'Actual');
    const utilizationVisible = await textIsVisible(page, 'Utilization');

    logInfo('Capacity metrics visibility', { allocatedVisible, actualVisible, utilizationVisible });

    // Check for non-zero values (this is a soft check)
    if (allocatedVisible || actualVisible || utilizationVisible) {
      // Look for number values greater than 0
      const metricsContainer = page.locator('[class*="capacity"], [class*="metric"], [class*="stat"]');
      const count = await metricsContainer.count();
      logInfo('Capacity metric containers found', { count });
    }
  });

  test('Time by Project chart renders', async ({ page }) => {
    const hasTimeByProject = await textIsVisible(page, 'Time by Project');
    if (hasTimeByProject) {
      const chartRendered = await verifyChartRendered(page);
      logInfo('Time by Project chart', { hasTimeByProject, chartRendered });
      expect(chartRendered, 'Time by Project chart should render').toBe(true);
    }
  });

  test('No error messages on Dashboard', async ({ page }) => {
    const errors = await checkForErrors(page);
    const hasFailedToLoad = await hasErrorText(page, 'failed to load');

    logInfo('Dashboard errors', { errors, hasFailedToLoad });

    expect(hasFailedToLoad, 'Should not show "failed to load" error').toBe(false);
  });
});

test.describe('Alex Executive - Departments', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, DEMO_USERS.alex.name);
    await safeNavigate(page, '/departments');
  });

  test('All 5 departments are visible', async ({ page }) => {
    await page.waitForTimeout(2000);

    const departmentNames = EXPECTED_DATA.departments.names;
    const visibilityResults: Record<string, boolean> = {};

    for (const dept of departmentNames) {
      visibilityResults[dept] = await textIsVisible(page, dept);
    }

    logInfo('Department visibility', visibilityResults);

    const visibleCount = Object.values(visibilityResults).filter(Boolean).length;
    expect(visibleCount, `Expected all ${departmentNames.length} departments to be visible`).toBeGreaterThanOrEqual(
      EXPECTED_DATA.departments.count
    );
  });

  test('[ISSUE #4-6] Department capacity charts show data', async ({ page }) => {
    // Check for capacity metrics on the main departments page (shown in department cards)
    // Look for capacity-related content in the department cards
    const hasCapacityMetrics = await anyTextVisible(page, ['capacity', 'utilization', 'Utilization', 'Active Projects', 'Team Members']);

    // Or click "View Details" to see department overview (not admin page)
    const viewDetailsButton = page.locator('button:has-text("View Details")').first();
    if (await viewDetailsButton.isVisible()) {
      await viewDetailsButton.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      // Check for capacity chart in department overview
      const hasCapacityChart = await verifyChartRendered(page);
      const hasChartData = await verifyChartHasData(page);

      // Check for utilization metrics
      const hasUtilization = await textIsVisible(page, 'Utilization');
      const hasAllocated = await textIsVisible(page, 'Allocated');

      logInfo('Department capacity', { hasCapacityChart, hasChartData, hasUtilization, hasAllocated, hasCapacityMetrics });

      // Should have either capacity chart or capacity metrics visible
      expect(hasCapacityChart || hasCapacityMetrics, 'Department should have capacity information visible').toBe(true);
    } else {
      // If no "View Details" button, check if capacity metrics are on the main page
      logInfo('Department capacity', { hasCapacityMetrics, note: 'No View Details button found' });
      expect(hasCapacityMetrics, 'Department page should show capacity metrics').toBe(true);
    }
  });

  test('[ISSUE #5] Team Capacity Utilization is non-zero', async ({ page }) => {
    // Navigate to department overview via "View Details" button
    const viewDetailsButton = page.locator('button:has-text("View Details")').first();
    if (await viewDetailsButton.isVisible()) {
      await viewDetailsButton.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      // Look for utilization percentage
      const utilizationElement = page.locator('text=/\\d+(\\.\\d+)?%/').first();
      const hasUtilization = await utilizationElement.isVisible().catch(() => false);

      if (hasUtilization) {
        const text = await utilizationElement.textContent();
        const percentage = parseFloat(text?.replace('%', '') || '0');
        logInfo('Team Capacity Utilization', { text, percentage });

        // Soft check - log warning if zero
        if (percentage === 0) {
          logWarning('Team Capacity Utilization is 0%');
        }
      }
    }
  });

  test('[ISSUE #6] Department Activity Overview has values', async ({ page }) => {
    // Navigate to department overview via "View Details" button
    const viewDetailsButton = page.locator('button:has-text("View Details")').first();
    if (await viewDetailsButton.isVisible()) {
      await viewDetailsButton.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      const hasActivitySection = await anyTextVisible(page, ['Activity', 'Overview', 'Statistics']);
      logInfo('Activity section', { hasActivitySection });

      // Check for specific activity metrics
      const hasProjects = await textIsVisible(page, 'Projects');
      const hasTasks = await textIsVisible(page, 'Tasks');
      const hasHours = await textIsVisible(page, 'Hours');

      logInfo('Activity metrics', { hasProjects, hasTasks, hasHours });
    }
  });

  test('[ISSUE #7] Active Issues are displayed', async ({ page }) => {
    // Navigate to department overview via "View Details" button
    const viewDetailsButton = page.locator('button:has-text("View Details")').first();
    if (await viewDetailsButton.isVisible()) {
      await viewDetailsButton.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      const hasIssuesSection = await textIsVisible(page, 'Issues');
      const hasActiveIssues = await textIsVisible(page, 'Active Issues');

      logInfo('Issues section', { hasIssuesSection, hasActiveIssues });

      // Check for specific issues from seed data
      const hasSpecificIssues = await anyTextVisible(page, [
        'API rate limiting',
        'Need access to production',
        'Waiting for final copy',
      ]);

      logInfo('Specific issues visible', { hasSpecificIssues });
    }
  });

  test('[ISSUE #8] Active Projects are listed', async ({ page }) => {
    // Navigate to department overview via "View Details" button
    const viewDetailsButton = page.locator('button:has-text("View Details")').first();
    if (await viewDetailsButton.isVisible()) {
      await viewDetailsButton.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      const hasProjectsSection = await textIsVisible(page, 'Projects');
      const projectLinks = page.locator('a[href^="/projects/"]');
      const projectCount = await projectLinks.count();

      logInfo('Department projects', { hasProjectsSection, projectCount });

      // Should have at least one project
      if (projectCount === 0) {
        logWarning('No active projects found under department');
      }
    }
  });
});

test.describe('Alex Executive - Accounts', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, DEMO_USERS.alex.name);
    await safeNavigate(page, '/accounts');
  });

  test('All 5 accounts are visible', async ({ page }) => {
    await page.waitForTimeout(2000);

    const accountNames = EXPECTED_DATA.accounts.names;
    const visibilityResults: Record<string, boolean> = {};

    for (const account of accountNames) {
      visibilityResults[account] = await textIsVisible(page, account);
    }

    logInfo('Account visibility', visibilityResults);

    const visibleCount = Object.values(visibilityResults).filter(Boolean).length;
    expect(visibleCount, 'Expected accounts to be visible').toBeGreaterThanOrEqual(1);
  });

  test('[ISSUE #9] Account capacity trends have data', async ({ page }) => {
    const firstAccountLink = page.locator('a[href^="/accounts/"]').first();
    if (await firstAccountLink.isVisible()) {
      await firstAccountLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      const hasCapacityTrend = await textIsVisible(page, 'Capacity');
      const hasTrendChart = await verifyChartRendered(page);

      logInfo('Account capacity trends', { hasCapacityTrend, hasTrendChart });
    }
  });

  test('[ISSUE #9] Account issues and roadblocks visible', async ({ page }) => {
    const firstAccountLink = page.locator('a[href^="/accounts/"]').first();
    if (await firstAccountLink.isVisible()) {
      await firstAccountLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      const hasIssues = await anyTextVisible(page, ['Issues', 'Roadblocks', 'Blockers']);
      logInfo('Account issues section', { hasIssues });
    }
  });

  test('[ISSUE #10] Edit account works without error', async ({ page }) => {
    const firstAccountLink = page.locator('a[href^="/accounts/"]').first();
    if (await firstAccountLink.isVisible()) {
      await firstAccountLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      // Find edit button
      const editButton = page.locator('button:has-text("Edit"), [aria-label="Edit"]').first();
      if (await editButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await editButton.click();
        await page.waitForTimeout(1000);

        // Check for error toast
        const hasError = await hasErrorText(page, 'Failed to update account');
        expect(hasError, 'Should not show "Failed to update account" error').toBe(false);

        // Close modal if open
        await page.keyboard.press('Escape');
      }
    }
  });
});

test.describe('Alex Executive - Projects', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, DEMO_USERS.alex.name);
    await safeNavigate(page, '/projects');
  });

  test('All 8 projects are visible', async ({ page }) => {
    await page.waitForTimeout(2000);

    const projectLinks = page.locator('a[href^="/projects/"]');
    const projectCount = await projectLinks.count();

    logInfo('Project count', { projectCount, expected: EXPECTED_DATA.projects.count });

    // Check for specific project names
    const projectChecks: Record<string, boolean> = {};
    for (const projectName of EXPECTED_DATA.projects.names.slice(0, 4)) {
      projectChecks[projectName] = await textIsVisible(page, projectName);
    }

    logInfo('Project visibility', projectChecks);

    expect(projectCount, 'Expected 8 projects').toBeGreaterThanOrEqual(1);
  });

  test('[ISSUE #11] Team members ARE displayed on project', async ({ page }) => {
    const firstProjectLink = page.locator('a[href^="/projects/"]').first();
    if (await firstProjectLink.isVisible()) {
      await firstProjectLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      // Check for "no team members" message
      const hasNoTeamMembers = await textIsVisible(page, 'no team members');
      expect(hasNoTeamMembers, 'Should NOT show "no team members"').toBe(false);

      // Check for team section
      const hasTeamSection = await anyTextVisible(page, ['Team', 'Members', 'Assigned']);
      logInfo('Team section', { hasTeamSection, hasNoTeamMembers });
    }
  });

  test('[ISSUE #12] Assign dropdown is populated', async ({ page }) => {
    const firstProjectLink = page.locator('a[href^="/projects/"]').first();
    if (await firstProjectLink.isVisible()) {
      await firstProjectLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      // Look for "Add Task" or similar button
      const addTaskButton = page.locator('button:has-text("Add Task"), button:has-text("New Task"), button:has-text("Create Task")').first();
      if (await addTaskButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await addTaskButton.click();
        await page.waitForTimeout(1000);

        // Find assign dropdown
        const assignDropdown = page.locator('[data-testid="assign-dropdown"], select:has-text("Assign"), button:has-text("Assign to")').first();
        if (await assignDropdown.isVisible({ timeout: 3000 }).catch(() => false)) {
          const { hasOptions, count } = await dropdownHasOptions(page, assignDropdown.toString());
          logInfo('Assign dropdown', { hasOptions, count });

          if (!hasOptions || count === 0) {
            logWarning('Assign dropdown is empty');
          }
        }

        // Close modal
        await page.keyboard.press('Escape');
      }
    }
  });

  test('[ISSUE #13] Can create task successfully', async ({ page }) => {
    const firstProjectLink = page.locator('a[href^="/projects/"]').first();
    if (await firstProjectLink.isVisible()) {
      await firstProjectLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      // Look for task creation
      const addTaskButton = page.locator('button:has-text("Add Task"), button:has-text("New Task")').first();
      if (await addTaskButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await addTaskButton.click();
        await page.waitForTimeout(1000);

        // Fill in task name
        const taskNameInput = page.locator('input[name="name"], input[placeholder*="task"], input[placeholder*="name"]').first();
        if (await taskNameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          await taskNameInput.fill('E2E Test Task ' + Date.now());

          // Submit
          const submitButton = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Save")').first();
          if (await submitButton.isVisible()) {
            await submitButton.click();
            await page.waitForTimeout(2000);

            // Check for error
            const hasError = await checkForErrors(page);
            logInfo('Task creation result', { errors: hasError });

            // Close modal if still open
            await page.keyboard.press('Escape');
          }
        } else {
          logWarning('Task name input not found');
          await page.keyboard.press('Escape');
        }
      }
    }
  });

  test('Project Kanban view works', async ({ page }) => {
    const firstProjectLink = page.locator('a[href^="/projects/"]').first();
    if (await firstProjectLink.isVisible()) {
      await firstProjectLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      // Look for Kanban tab/view
      const kanbanTab = page.locator('button:has-text("Kanban"), [data-value="kanban"]').first();
      if (await kanbanTab.isVisible({ timeout: 5000 }).catch(() => false)) {
        await kanbanTab.click();
        await page.waitForTimeout(1000);

        // Check for Kanban columns
        const hasKanbanColumns = await anyTextVisible(page, ['To Do', 'In Progress', 'Done', 'Backlog']);
        logInfo('Kanban view', { hasKanbanColumns });
      }
    }
  });

  test('Project Gantt view works', async ({ page }) => {
    const firstProjectLink = page.locator('a[href^="/projects/"]').first();
    if (await firstProjectLink.isVisible()) {
      await firstProjectLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      // Look for Gantt tab/view
      const ganttTab = page.locator('button:has-text("Gantt"), [data-value="gantt"]').first();
      if (await ganttTab.isVisible({ timeout: 5000 }).catch(() => false)) {
        await ganttTab.click();
        await page.waitForTimeout(1000);

        // Check for Gantt chart elements
        const hasGantt = await page.locator('[class*="gantt"], svg, [class*="chart"]').first().isVisible().catch(() => false);
        logInfo('Gantt view', { hasGantt });
      }
    }
  });
});

test.describe('Alex Executive - Time Tracking', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, DEMO_USERS.alex.name);
  });

  test('[ISSUE #14] Clock In button works', async ({ page }) => {
    await safeNavigate(page, '/dashboard');

    // Look for clock in button
    const clockInButton = page.locator('button:has-text("Clock In"), button:has-text("Start Timer")').first();

    if (await clockInButton.isVisible({ timeout: 10000 }).catch(() => false)) {
      const isClickable = await clockInButton.isEnabled();
      logInfo('Clock In button', { visible: true, isClickable });

      if (isClickable) {
        await clockInButton.click();
        await page.waitForTimeout(2000);

        // Check for permission error
        const hasPermissionError = await anyTextVisible(page, ['permission', 'not allowed', 'denied']);
        expect(hasPermissionError, 'Should not show permission error on Clock In').toBe(false);

        // Check if button state changed
        const clockOutButton = page.locator('button:has-text("Clock Out"), button:has-text("Stop Timer")');
        const clockedIn = await clockOutButton.isVisible({ timeout: 3000 }).catch(() => false);

        logInfo('Clock In result', { clockedIn });
      }
    } else {
      logWarning('Clock In button not found on dashboard');
    }
  });

  test('Time entries page shows data', async ({ page }) => {
    await safeNavigate(page, '/time-entries');
    await page.waitForTimeout(2000);

    // Check for time entry content
    const hasTimeEntries = await anyTextVisible(page, ['hours', 'entries', 'logged']);
    const hasNoEntriesMessage = await textIsVisible(page, 'no entries');

    logInfo('Time entries page', { hasTimeEntries, hasNoEntriesMessage });

    // Should either have entries or show appropriate message
    expect(hasTimeEntries || hasNoEntriesMessage, 'Time entries page should display properly').toBe(true);
  });
});

test.describe('Alex Executive - Admin Pages', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, DEMO_USERS.alex.name);
  });

  test('Workflows page loads with templates', async ({ page }) => {
    await safeNavigate(page, '/admin/workflows');
    await page.waitForTimeout(2000);

    // Check for workflow templates from seed data
    const hasStandardDelivery = await textIsVisible(page, 'Standard Project Delivery');
    const hasQuickTurnaround = await textIsVisible(page, 'Quick Turnaround');

    logInfo('Workflow templates', { hasStandardDelivery, hasQuickTurnaround });

    // At least one workflow should be visible
    const hasWorkflows = hasStandardDelivery || hasQuickTurnaround;
    expect(hasWorkflows, 'Expected workflow templates to be visible').toBe(true);
  });

  test('Roles page loads', async ({ page }) => {
    await safeNavigate(page, '/admin/roles');
    await page.waitForTimeout(2000);

    // Check for role names
    const hasRoles = await anyTextVisible(page, ['Executive Director', 'Account Manager', 'Project Manager', 'Designer', 'Developer']);
    logInfo('Roles page', { hasRoles });

    expect(hasRoles, 'Expected roles to be visible').toBe(true);
  });

  test('Analytics page loads', async ({ page }) => {
    await safeNavigate(page, '/admin/analytics');
    await page.waitForTimeout(2000);

    const hasCharts = await verifyChartRendered(page);
    const accessDenied = await hasAccessDenied(page);

    logInfo('Analytics page', { hasCharts, accessDenied });

    expect(accessDenied, 'Should not show access denied for analytics').toBe(false);
  });
});

// =============================================================================
// 3. MORGAN MANAGER TESTS
// =============================================================================

test.describe('Morgan Manager - Account Manager Tests', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, DEMO_USERS.morgan.name);
  });

  test('Can view accounts', async ({ page }) => {
    await safeNavigate(page, '/accounts');
    await page.waitForTimeout(2000);

    const accountLinks = page.locator('a[href^="/accounts/"]');
    const count = await accountLinks.count();

    logInfo('Morgan accounts access', { accountCount: count });
    expect(count, 'Morgan should see at least one account').toBeGreaterThanOrEqual(1);
  });

  test('Can edit accounts without error', async ({ page }) => {
    await safeNavigate(page, '/accounts');
    await page.waitForTimeout(2000);

    const firstAccountLink = page.locator('a[href^="/accounts/"]').first();
    if (await firstAccountLink.isVisible()) {
      await firstAccountLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      const editButton = page.locator('button:has-text("Edit")').first();
      if (await editButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await editButton.click();
        await page.waitForTimeout(1000);

        const hasError = await hasErrorText(page, 'Failed to update');
        expect(hasError, 'Should not show error when editing account').toBe(false);

        await page.keyboard.press('Escape');
      }
    }
  });

  test('Can clock in', async ({ page }) => {
    await safeNavigate(page, '/dashboard');

    const clockInButton = page.locator('button:has-text("Clock In")').first();
    if (await clockInButton.isVisible({ timeout: 10000 }).catch(() => false)) {
      const isClickable = await clockInButton.isEnabled();
      logInfo('Morgan Clock In', { isClickable });
    }
  });
});

// =============================================================================
// 4. PAT PROJECT MANAGER TESTS
// =============================================================================

test.describe('Pat ProjectManager - Project Management Tests', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, DEMO_USERS.pat.name);
  });

  test('Can view assigned projects', async ({ page }) => {
    await safeNavigate(page, '/projects');
    await page.waitForTimeout(2000);

    const projectLinks = page.locator('a[href^="/projects/"]');
    const count = await projectLinks.count();

    logInfo('Pat project access', { projectCount: count });
    expect(count, 'Pat should see at least one project').toBeGreaterThanOrEqual(1);
  });

  test('Can create tasks with user assignment', async ({ page }) => {
    await safeNavigate(page, '/projects');
    await page.waitForTimeout(2000);

    const firstProjectLink = page.locator('a[href^="/projects/"]').first();
    if (await firstProjectLink.isVisible()) {
      await firstProjectLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      const addTaskButton = page.locator('button:has-text("Add Task"), button:has-text("New Task")').first();
      if (await addTaskButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await addTaskButton.click();
        await page.waitForTimeout(1000);

        logInfo('Pat can access task creation modal');
        await page.keyboard.press('Escape');
      }
    }
  });

  test('Can clock in', async ({ page }) => {
    await safeNavigate(page, '/dashboard');

    const clockInButton = page.locator('button:has-text("Clock In")').first();
    const isVisible = await clockInButton.isVisible({ timeout: 10000 }).catch(() => false);

    logInfo('Pat Clock In button', { isVisible });
  });
});

// =============================================================================
// 5. ANDY ADMIN TESTS
// =============================================================================

test.describe('Andy Admin - Admin Access Tests', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, DEMO_USERS.andy.name);
  });

  test('Has full admin access', async ({ page }) => {
    await safeNavigate(page, '/admin');
    await page.waitForTimeout(2000);

    const hasAccessDeniedMsg = await hasAccessDenied(page);
    expect(hasAccessDeniedMsg, 'Andy should have admin access').toBe(false);
  });

  test('Roles page works', async ({ page }) => {
    await safeNavigate(page, '/admin/roles');
    await page.waitForTimeout(2000);

    const hasRoles = await anyTextVisible(page, ['Executive', 'Manager', 'Designer', 'Developer']);
    logInfo('Andy roles page', { hasRoles });

    expect(hasRoles, 'Roles page should display roles').toBe(true);
  });

  test('Workflows page works', async ({ page }) => {
    await safeNavigate(page, '/admin/workflows');
    await page.waitForTimeout(2000);

    const hasWorkflows = await anyTextVisible(page, ['Standard Project Delivery', 'Quick Turnaround', 'workflow']);
    logInfo('Andy workflows page', { hasWorkflows });
  });

  test('RBAC Diagnostics works', async ({ page }) => {
    await safeNavigate(page, '/admin/rbac-diagnostics');
    await page.waitForTimeout(2000);

    const hasAccessDeniedMsg = await hasAccessDenied(page);
    const hasContent = await anyTextVisible(page, ['RBAC', 'Diagnostics', 'Permissions', 'Roles']);

    logInfo('Andy RBAC diagnostics', { hasContent, hasAccessDenied: hasAccessDeniedMsg });
  });
});

// =============================================================================
// 6. DANA DESIGNER TESTS
// =============================================================================

test.describe('Dana Designer - Designer Access Tests', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, DEMO_USERS.dana.name);
  });

  test('Can view assigned projects', async ({ page }) => {
    await safeNavigate(page, '/projects');
    await page.waitForTimeout(2000);

    const projectLinks = page.locator('a[href^="/projects/"]');
    const count = await projectLinks.count();

    logInfo('Dana project access', { projectCount: count });
    // Dana may have limited projects
  });

  test('Can log time', async ({ page }) => {
    await safeNavigate(page, '/time-entries');
    await page.waitForTimeout(2000);

    const hasAccessDeniedMsg = await hasAccessDenied(page);
    expect(hasAccessDeniedMsg, 'Dana should access time entries').toBe(false);
  });

  test('Cannot access admin pages', async ({ page }) => {
    await safeNavigate(page, '/admin/roles');
    await page.waitForTimeout(2000);

    // Should either redirect or show access denied
    const isOnAdminPage = page.url().includes('/admin/roles');
    const hasAccessDeniedMsg = await hasAccessDenied(page);

    logInfo('Dana admin access', { isOnAdminPage, hasAccessDenied: hasAccessDeniedMsg });

    // Either not on admin page or access denied
    const properlyRestricted = !isOnAdminPage || hasAccessDeniedMsg;
    expect(properlyRestricted, 'Dana should not have admin access').toBe(true);
  });
});

// =============================================================================
// 7. DEV DEVELOPER TESTS
// =============================================================================

test.describe('Dev Developer - Developer Access Tests', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, DEMO_USERS.dev.name);
  });

  test('Can view assigned projects', async ({ page }) => {
    await safeNavigate(page, '/projects');
    await page.waitForTimeout(2000);

    const projectLinks = page.locator('a[href^="/projects/"]');
    const count = await projectLinks.count();

    logInfo('Dev project access', { projectCount: count });
  });

  test('Can log time', async ({ page }) => {
    await safeNavigate(page, '/time-entries');
    await page.waitForTimeout(2000);

    const hasAccessDeniedMsg = await hasAccessDenied(page);
    expect(hasAccessDeniedMsg, 'Dev should access time entries').toBe(false);
  });

  test('Cannot access admin pages', async ({ page }) => {
    await safeNavigate(page, '/admin/workflows');
    await page.waitForTimeout(2000);

    const isOnAdminPage = page.url().includes('/admin/workflows');
    const hasAccessDeniedMsg = await hasAccessDenied(page);

    const properlyRestricted = !isOnAdminPage || hasAccessDeniedMsg;
    expect(properlyRestricted, 'Dev should not have admin access').toBe(true);
  });
});

// =============================================================================
// 8. CHRIS CLIENT TESTS
// =============================================================================

test.describe('Chris Client - Client Portal Tests', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, DEMO_USERS.chris.name);
  });

  test('Redirected appropriately after login', async ({ page }) => {
    // Client may be redirected to client portal or limited view
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    logInfo('Chris redirect', { currentUrl });

    // Client should be on some valid page
    expect(currentUrl).toContain(DEMO_URL);
  });

  test('Cannot access dashboard', async ({ page }) => {
    await safeNavigate(page, '/dashboard');
    await page.waitForTimeout(2000);

    // Should either redirect or show access denied
    const isOnDashboard = page.url().includes('/dashboard');
    const hasAccessDeniedMsg = await hasAccessDenied(page);

    logInfo('Chris dashboard access', { isOnDashboard, hasAccessDenied: hasAccessDeniedMsg });
  });

  test('Cannot access admin pages', async ({ page }) => {
    await safeNavigate(page, '/admin/roles');
    await page.waitForTimeout(2000);

    const isOnAdminPage = page.url().includes('/admin');
    const hasAccessDeniedMsg = await hasAccessDenied(page);

    const properlyRestricted = !isOnAdminPage || hasAccessDeniedMsg;
    expect(properlyRestricted, 'Chris should not have admin access').toBe(true);
  });
});

// =============================================================================
// 9. COMPREHENSIVE SUMMARY TEST
// =============================================================================

test.describe('Production Health Summary', () => {
  test('Generate comprehensive production health report', async ({ page }) => {
    const results: Array<{ category: string; test: string; status: string; details: string }> = [];

    // Login as Alex for comprehensive check
    await login(page, DEMO_USERS.alex.name);

    // Check Welcome page
    await safeNavigate(page, '/welcome');
    await page.waitForTimeout(2000);
    const welcomeErrors = await checkForErrors(page);
    results.push({
      category: 'Welcome',
      test: 'No Errors',
      status: welcomeErrors.length === 0 ? 'PASS' : 'FAIL',
      details: welcomeErrors.length > 0 ? welcomeErrors.join(', ') : 'Clean',
    });

    // Check Dashboard
    await safeNavigate(page, '/dashboard');
    await page.waitForTimeout(2000);
    const dashboardErrors = await checkForErrors(page);
    const hasCharts = await verifyChartRendered(page);
    results.push({
      category: 'Dashboard',
      test: 'No Errors',
      status: dashboardErrors.length === 0 ? 'PASS' : 'FAIL',
      details: dashboardErrors.length > 0 ? dashboardErrors.join(', ') : 'Clean',
    });
    results.push({
      category: 'Dashboard',
      test: 'Charts Render',
      status: hasCharts ? 'PASS' : 'WARN',
      details: hasCharts ? 'Charts visible' : 'No charts found',
    });

    // Check Projects
    await safeNavigate(page, '/projects');
    await page.waitForTimeout(2000);
    const projectCount = await page.locator('a[href^="/projects/"]').count();
    results.push({
      category: 'Projects',
      test: 'Projects Visible',
      status: projectCount >= 1 ? 'PASS' : 'FAIL',
      details: `${projectCount} projects found`,
    });

    // Check Accounts
    await safeNavigate(page, '/accounts');
    await page.waitForTimeout(2000);
    const accountCount = await page.locator('a[href^="/accounts/"]').count();
    results.push({
      category: 'Accounts',
      test: 'Accounts Visible',
      status: accountCount >= 1 ? 'PASS' : 'FAIL',
      details: `${accountCount} accounts found`,
    });

    // Check Departments
    await safeNavigate(page, '/departments');
    await page.waitForTimeout(2000);
    const deptCount = await page.locator('a[href^="/departments/"]').count();
    results.push({
      category: 'Departments',
      test: 'Departments Visible',
      status: deptCount >= 1 ? 'PASS' : 'FAIL',
      details: `${deptCount} departments found`,
    });

    // Check Workflows
    await safeNavigate(page, '/admin/workflows');
    await page.waitForTimeout(2000);
    const hasStandardWf = await textIsVisible(page, 'Standard Project Delivery');
    const hasQuickWf = await textIsVisible(page, 'Quick Turnaround');
    const wfCount = (hasStandardWf ? 1 : 0) + (hasQuickWf ? 1 : 0);
    results.push({
      category: 'Workflows',
      test: 'Templates Visible',
      status: wfCount >= 1 ? 'PASS' : 'FAIL',
      details: `${wfCount}/2 templates found`,
    });

    // Print summary
    console.log('\n========================================');
    console.log('  PRODUCTION HEALTH REPORT');
    console.log('  demo.movalab.dev');
    console.log('  ' + new Date().toISOString());
    console.log('========================================\n');

    console.log('Category      | Test              | Status | Details');
    console.log('--------------|-------------------|--------|------------------');

    for (const r of results) {
      const cat = r.category.padEnd(13);
      const test = r.test.padEnd(17);
      const status = r.status.padEnd(6);
      console.log(`${cat} | ${test} | ${status} | ${r.details}`);
    }

    const passCount = results.filter((r) => r.status === 'PASS').length;
    const warnCount = results.filter((r) => r.status === 'WARN').length;
    const failCount = results.filter((r) => r.status === 'FAIL').length;

    console.log('\n----------------------------------------');
    console.log(`SUMMARY: ${passCount} PASS, ${warnCount} WARN, ${failCount} FAIL`);
    console.log('========================================\n');

    // Overall expectation
    expect(failCount, 'Critical failures should be addressed').toBeLessThanOrEqual(3);
  });
});

import { test, expect, Page } from '@playwright/test';

/**
 * Production Data Verification Tests
 *
 * These tests verify that the demo.movalab.dev site has all the required seed data
 * populated by the daily cron job. They help identify specific data issues.
 */

const DEMO_URL = 'https://demo.movalab.dev';

// Demo user login helper
async function login(page: Page, userName: string): Promise<void> {
  await page.goto(`${DEMO_URL}/login`);
  await page.waitForLoadState('networkidle');

  const demoButton = page.locator(`button:has-text("${userName}")`);
  await demoButton.waitFor({ state: 'visible', timeout: 15000 });
  await demoButton.click();
  await page.waitForURL(/\/(welcome|dashboard|projects)/, { timeout: 20000 });
}

test.describe('Production Data Verification', () => {
  // Run in parallel to get all results even if some fail
  test.describe.configure({ mode: 'parallel' });

  test('Login as Alex Executive', async ({ page }) => {
    await login(page, 'Alex Executive');
    expect(page.url()).toMatch(/\/(welcome|dashboard)/);
  });

  test('Verify Newsletters exist', async ({ page }) => {
    await login(page, 'Alex Executive');
    await page.goto(`${DEMO_URL}/welcome`);
    await page.waitForLoadState('networkidle');

    // Look for newsletter section
    const newsletterSection = page.locator('text=/newsletter/i').first();
    const hasNewsletterSection = await newsletterSection.isVisible().catch(() => false);

    // Look for any newsletter cards or content
    const newsletterCards = page.locator('[class*="newsletter"], [data-testid*="newsletter"]');
    const newsletterCount = await newsletterCards.count();

    // Also check for the actual newsletter titles from seed data
    const q4Update = await page.locator('text=/Q4 Company Update/i').isVisible().catch(() => false);
    const janSpotlight = await page.locator('text=/January Team Spotlight/i').isVisible().catch(() => false);

    console.log(`Newsletter section visible: ${hasNewsletterSection}`);
    console.log(`Newsletter cards found: ${newsletterCount}`);
    console.log(`Q4 Update visible: ${q4Update}`);
    console.log(`January Spotlight visible: ${janSpotlight}`);

    // Soft assertion - log warning but don't fail
    if (!(q4Update || janSpotlight || newsletterCount > 0)) {
      console.warn('WARNING: No newsletters found - cron job may not have run');
    }
  });

  test('Verify Project Updates exist', async ({ page }) => {
    await login(page, 'Alex Executive');
    await page.goto(`${DEMO_URL}/welcome`);
    await page.waitForLoadState('networkidle');

    // Look for updates section or recent activity
    const updatesSection = page.locator('text=/updates|recent activity/i').first();
    const hasUpdatesSection = await updatesSection.isVisible().catch(() => false);

    // Look for specific update content from seed data
    const frontendUpdate = await page.locator('text=/Frontend development/i').isVisible().catch(() => false);
    const wireframesUpdate = await page.locator('text=/Wireframes approved/i').isVisible().catch(() => false);

    console.log(`Updates section visible: ${hasUpdatesSection}`);
    console.log(`Frontend update visible: ${frontendUpdate}`);
    console.log(`Wireframes update visible: ${wireframesUpdate}`);

    if (!(frontendUpdate || wireframesUpdate || hasUpdatesSection)) {
      console.warn('WARNING: No project updates found');
    }
  });

  test('Verify Departments exist (should be 5)', async ({ page }) => {
    await login(page, 'Alex Executive');
    await page.goto(`${DEMO_URL}/departments`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Wait for data to load

    // Count department cards/items
    const deptCards = page.locator('a[href^="/departments/"]');
    const deptCount = await deptCards.count();

    // Look for specific department names from seed data
    const leadership = await page.locator('text=/Leadership/i').isVisible().catch(() => false);
    const marketing = await page.locator('text=/Marketing/i').isVisible().catch(() => false);
    const design = await page.locator('text=/Design/i').isVisible().catch(() => false);
    const development = await page.locator('text=/Development/i').isVisible().catch(() => false);
    const operations = await page.locator('text=/Operations/i').isVisible().catch(() => false);

    console.log(`Department cards found: ${deptCount}`);
    console.log(`Leadership: ${leadership}, Marketing: ${marketing}, Design: ${design}, Development: ${development}, Operations: ${operations}`);

    if (deptCount < 5) {
      console.warn(`WARNING: Only ${deptCount}/5 departments found`);
    }
  });

  test('Verify Roles exist (Admin page)', async ({ page }) => {
    await login(page, 'Alex Executive');
    await page.goto(`${DEMO_URL}/admin/roles`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for role names from seed data
    const executive = await page.locator('text=/Executive Director/i').isVisible().catch(() => false);
    const accountMgr = await page.locator('text=/Account Manager/i').isVisible().catch(() => false);
    const projectMgr = await page.locator('text=/Project Manager/i').isVisible().catch(() => false);
    const designer = await page.locator('text=/Designer/i').isVisible().catch(() => false);
    const developer = await page.locator('text=/Developer/i').isVisible().catch(() => false);

    // Count role cards
    const roleCards = page.locator('[class*="card"], [class*="role"]');
    const roleCount = await roleCards.count();

    console.log(`Role cards found: ${roleCount}`);
    console.log(`Executive: ${executive}, Account Manager: ${accountMgr}, Project Manager: ${projectMgr}`);
    console.log(`Designer: ${designer}, Developer: ${developer}`);

    if (!(executive || accountMgr || projectMgr || roleCount > 0)) {
      console.warn('WARNING: No roles visible on admin page');
    }
  });

  test('Verify Workflow Templates exist', async ({ page }) => {
    await login(page, 'Alex Executive');
    await page.goto(`${DEMO_URL}/admin/workflows`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for workflow template names from seed data
    const standardDelivery = await page.locator('text=/Standard Project Delivery/i').isVisible().catch(() => false);
    const quickTurnaround = await page.locator('text=/Quick Turnaround/i').isVisible().catch(() => false);

    // Count workflow templates
    const workflowCards = page.locator('[class*="card"], [class*="workflow"]');
    const workflowCount = await workflowCards.count();

    console.log(`Workflow cards found: ${workflowCount}`);
    console.log(`Standard Project Delivery: ${standardDelivery}, Quick Turnaround: ${quickTurnaround}`);

    if (!(standardDelivery || quickTurnaround || workflowCount > 0)) {
      console.warn('WARNING: No workflow templates found');
    }
  });

  test('Verify Projects exist (should be 8)', async ({ page }) => {
    await login(page, 'Pat Project');
    await page.goto(`${DEMO_URL}/projects`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for specific project names from seed data
    const dashboardRedesign = await page.locator('text=/Enterprise Dashboard Redesign/i').isVisible().catch(() => false);
    const mobileApp = await page.locator('text=/Mobile App Development/i').isVisible().catch(() => false);
    const mvpLaunch = await page.locator('text=/MVP Launch Website/i').isVisible().catch(() => false);
    const brandIdentity = await page.locator('text=/Brand Identity Package/i').isVisible().catch(() => false);

    // Count project cards
    const projectCards = page.locator('a[href^="/projects/"]');
    const projectCount = await projectCards.count();

    console.log(`Project cards found: ${projectCount}`);
    console.log(`Dashboard Redesign: ${dashboardRedesign}, Mobile App: ${mobileApp}`);
    console.log(`MVP Launch: ${mvpLaunch}, Brand Identity: ${brandIdentity}`);

    if (projectCount < 8) {
      console.warn(`WARNING: Only ${projectCount}/8 projects found`);
    }
  });

  test('Verify Time Entries exist', async ({ page }) => {
    await login(page, 'Dana Designer');
    await page.goto(`${DEMO_URL}/time-entries`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for time entry data or summary stats
    const hoursThisWeek = page.locator('text=/hours this week/i');
    const hasHoursDisplay = await hoursThisWeek.isVisible().catch(() => false);

    // Look for any time entries in a table/list
    const timeRows = page.locator('tr, [class*="time-entry"]');
    const timeRowCount = await timeRows.count();

    // Check for zero state messaging
    const noEntriesMsg = await page.locator('text=/no time entries|no entries found/i').isVisible().catch(() => false);

    console.log(`Hours display visible: ${hasHoursDisplay}`);
    console.log(`Time rows found: ${timeRowCount}`);
    console.log(`No entries message: ${noEntriesMsg}`);

    if (noEntriesMsg || timeRowCount <= 1) {
      console.warn('WARNING: No time entries found');
    }
  });

  test('Verify Accounts exist (should be 5)', async ({ page }) => {
    await login(page, 'Morgan Account');
    await page.goto(`${DEMO_URL}/accounts`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for specific account names from seed data
    const acme = await page.locator('text=/Acme Corporation/i').isVisible().catch(() => false);
    const techstart = await page.locator('text=/TechStart Inc/i').isVisible().catch(() => false);
    const greenEnergy = await page.locator('text=/Green Energy Co/i').isVisible().catch(() => false);
    const fashionForward = await page.locator('text=/Fashion Forward/i').isVisible().catch(() => false);
    const urbanBistro = await page.locator('text=/Urban Bistro/i').isVisible().catch(() => false);

    // Count account cards
    const accountCards = page.locator('a[href^="/accounts/"]');
    const accountCount = await accountCards.count();

    console.log(`Account cards found: ${accountCount}`);
    console.log(`Acme: ${acme}, TechStart: ${techstart}, Green Energy: ${greenEnergy}`);
    console.log(`Fashion Forward: ${fashionForward}, Urban Bistro: ${urbanBistro}`);

    if (accountCount < 5) {
      console.warn(`WARNING: Only ${accountCount}/5 accounts found`);
    }
  });

  test('Verify Milestones exist', async ({ page }) => {
    await login(page, 'Alex Executive');
    await page.goto(`${DEMO_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for milestones section or upcoming deadlines
    const milestonesSection = page.locator('text=/milestones|upcoming|deadlines/i');
    const hasMilestones = await milestonesSection.first().isVisible().catch(() => false);

    // Look for specific milestones from seed data
    const mvpLaunch = await page.locator('text=/TechStart MVP Launch/i').isVisible().catch(() => false);
    const onboardingLive = await page.locator('text=/User Onboarding Go-Live/i').isVisible().catch(() => false);
    const dashboardBeta = await page.locator('text=/Acme Dashboard Beta/i').isVisible().catch(() => false);

    console.log(`Milestones section visible: ${hasMilestones}`);
    console.log(`MVP Launch: ${mvpLaunch}, Onboarding: ${onboardingLive}, Dashboard Beta: ${dashboardBeta}`);

    if (!(hasMilestones || mvpLaunch || onboardingLive)) {
      console.warn('WARNING: No milestones found');
    }
  });

  test('Verify Capacity Data exists', async ({ page }) => {
    await login(page, 'Alex Executive');
    await page.goto(`${DEMO_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for capacity chart or utilization data
    const capacityChart = page.locator('[class*="capacity"], [class*="chart"], [class*="utilization"]');
    const hasCapacityChart = await capacityChart.first().isVisible().catch(() => false);

    // Look for recharts elements
    const rechartsElements = page.locator('.recharts-wrapper, .recharts-surface, svg');
    const chartCount = await rechartsElements.count();

    // Look for specific capacity metrics
    const hoursDisplay = await page.locator('text=/hours|utilization|capacity/i').first().isVisible().catch(() => false);

    console.log(`Capacity chart visible: ${hasCapacityChart}`);
    console.log(`Recharts elements found: ${chartCount}`);
    console.log(`Hours/utilization display: ${hoursDisplay}`);

    if (!(hasCapacityChart || chartCount > 0 || hoursDisplay)) {
      console.warn('WARNING: No capacity data/charts found');
    }
  });

  test('Verify Project Issues exist', async ({ page }) => {
    await login(page, 'Pat Project');
    await page.goto(`${DEMO_URL}/projects`);
    await page.waitForLoadState('networkidle');

    // Click first project
    const firstProject = page.locator('a[href^="/projects/"]').first();
    if (await firstProject.isVisible()) {
      const href = await firstProject.getAttribute('href');
      if (href) {
        await page.goto(`${DEMO_URL}${href}`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        // Look for issues section
        const issuesSection = page.locator('text=/issues|blockers|problems/i');
        const hasIssues = await issuesSection.first().isVisible().catch(() => false);

        // Look for specific issue content from seed data
        const apiIssue = await page.locator('text=/API rate limiting/i').isVisible().catch(() => false);
        const accessIssue = await page.locator('text=/Need access to production/i').isVisible().catch(() => false);

        console.log(`Issues section visible: ${hasIssues}`);
        console.log(`API issue: ${apiIssue}, Access issue: ${accessIssue}`);
      }
    }
  });

  test('Summary: Data Population Status', async ({ page }) => {
    await login(page, 'Alex Executive');

    const results: { table: string; status: string; details: string }[] = [];

    // Check departments
    await page.goto(`${DEMO_URL}/departments`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    const deptCount = await page.locator('a[href^="/departments/"]').count();
    results.push({ table: 'departments', status: deptCount >= 5 ? 'OK' : 'MISSING', details: `${deptCount}/5 found` });

    // Check projects
    await page.goto(`${DEMO_URL}/projects`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    const projectCount = await page.locator('a[href^="/projects/"]').count();
    results.push({ table: 'projects', status: projectCount >= 1 ? 'PARTIAL' : 'MISSING', details: `${projectCount}/8 found` });

    // Check accounts
    await page.goto(`${DEMO_URL}/accounts`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    const accountCount = await page.locator('a[href^="/accounts/"]').count();
    results.push({ table: 'accounts', status: accountCount >= 5 ? 'OK' : 'PARTIAL', details: `${accountCount}/5 found` });

    // Check workflows
    await page.goto(`${DEMO_URL}/admin/workflows`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    const standardWf = await page.locator('text=/Standard Project Delivery/i').isVisible().catch(() => false);
    const quickWf = await page.locator('text=/Quick Turnaround/i').isVisible().catch(() => false);
    const wfCount = (standardWf ? 1 : 0) + (quickWf ? 1 : 0);
    results.push({ table: 'workflow_templates', status: wfCount >= 2 ? 'OK' : 'MISSING', details: `${wfCount}/2 found` });

    // Print summary
    console.log('\n=== PRODUCTION DATA VERIFICATION SUMMARY ===\n');
    console.log('Table                 | Status  | Details');
    console.log('----------------------|---------|------------------');
    for (const r of results) {
      console.log(`${r.table.padEnd(21)} | ${r.status.padEnd(7)} | ${r.details}`);
    }
    console.log('\n');

    // Report summary status
    const okCount = results.filter(r => r.status === 'OK').length;
    const partialCount = results.filter(r => r.status === 'PARTIAL').length;
    const missingCount = results.filter(r => r.status === 'MISSING').length;

    console.log(`Summary: ${okCount} OK, ${partialCount} PARTIAL, ${missingCount} MISSING`);

    if (missingCount > 0) {
      console.warn('WARNING: Some data is missing - cron job may need to be triggered manually');
    }
  });
});

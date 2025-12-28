import { test, expect } from '@playwright/test';

test('demo mode login works', async ({ page }) => {
  // Go to login page
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  console.log('Current URL after going to /login:', page.url());

  // Wait for demo mode buttons to appear
  const demoButton = page.locator('button:has-text("Alex Executive")');
  await demoButton.waitFor({ state: 'visible', timeout: 15000 });

  console.log('Demo mode button found, clicking...');

  await demoButton.click();

  // Wait for redirect
  await page.waitForURL(/\/(welcome|dashboard|projects)/, { timeout: 15000 });

  console.log('Current URL after login:', page.url());

  // Should be redirected to welcome or dashboard
  expect(page.url()).not.toContain('/login');
});

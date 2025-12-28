import { test, expect } from '@playwright/test';

test('simple page loads', async ({ page }) => {
  await page.goto('/login');
  await expect(page).toHaveTitle(/MovaLab|Login/i);
});

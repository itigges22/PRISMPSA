/**
 * Login Test Script
 * Tests superadmin login and captures all errors
 */

import { chromium, Browser, Page, ConsoleMessage } from 'playwright';

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const TEST_EMAIL = 'superadmin@test.local';
const TEST_PASSWORD = 'Test1234!';

async function testLogin() {
  console.log('🧪 Starting Login Tests...\n');
  console.log(`Testing against: ${BASE_URL}`);
  console.log(`Email: ${TEST_EMAIL}\n`);

  let browser: Browser | null = null;
  const allErrors: string[] = [];
  const networkErrors: string[] = [];

  try {
    browser = await chromium.launch({
      headless: true,
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    // Collect ALL console messages
    page.on('console', (msg: ConsoleMessage) => {
      const text = msg.text();
      const type = msg.type();

      if (type === 'error') {
        allErrors.push(`[Console ${type}] ${text}`);
        console.log(`  ❌ Console Error: ${text.substring(0, 200)}`);
      }

      // Log fetch errors specifically
      if (text.includes('fetch') || text.includes('Failed') || text.includes('network')) {
        console.log(`  🔴 Network Issue: ${text.substring(0, 200)}`);
      }
    });

    // Collect page errors
    page.on('pageerror', (error) => {
      allErrors.push(`[Page Error] ${error.message}`);
      console.log(`  ❌ Page Error: ${error.message.substring(0, 200)}`);
    });

    // Monitor network requests
    page.on('requestfailed', (request) => {
      const failure = request.failure();
      const url = request.url();
      const errorText = `${request.method()} ${url} - ${failure?.errorText || 'Unknown error'}`;
      networkErrors.push(errorText);
      console.log(`  🔴 Request Failed: ${errorText}`);
    });

    page.on('response', (response) => {
      const status = response.status();
      const url = response.url();

      // Log non-2xx responses (except redirects)
      if (status >= 400) {
        console.log(`  ⚠️ HTTP ${status}: ${url}`);
      }
    });

    // Step 1: Navigate to login page
    console.log('\n📄 Step 1: Loading login page...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    console.log('  ✅ Login page loaded\n');

    // Step 2: Fill in credentials
    console.log('📄 Step 2: Filling in credentials...');

    // Wait for form elements
    const emailInput = await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
    const passwordInput = await page.waitForSelector('input[type="password"], input[name="password"]', { timeout: 10000 });

    if (!emailInput || !passwordInput) {
      console.log('  ❌ Could not find login form inputs');
      return;
    }

    await emailInput.fill(TEST_EMAIL);
    await passwordInput.fill(TEST_PASSWORD);
    console.log('  ✅ Credentials filled\n');

    // Step 3: Click login button
    console.log('📄 Step 3: Clicking login button...');

    const loginButton = await page.$('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Login")');

    if (!loginButton) {
      console.log('  ❌ Could not find login button');
      // Try to find any button
      const buttons = await page.$$('button');
      console.log(`  Found ${buttons.length} buttons on page`);
      return;
    }

    // Click and wait for navigation or response
    await Promise.all([
      page.waitForResponse(response => response.url().includes('auth') || response.url().includes('api'), { timeout: 15000 }).catch(() => null),
      loginButton.click()
    ]);

    console.log('  ✅ Login button clicked\n');

    // Step 4: Wait for result
    console.log('📄 Step 4: Waiting for login result...');
    await page.waitForTimeout(5000);

    // Check current URL
    const currentUrl = page.url();
    console.log(`  Current URL: ${currentUrl}`);

    // Check for error messages on page
    const errorMessage = await page.$('.error, [role="alert"], .text-red-500, .text-destructive');
    if (errorMessage) {
      const errorText = await errorMessage.textContent();
      console.log(`  ❌ Error on page: ${errorText}`);
      allErrors.push(`[UI Error] ${errorText}`);
    }

    // Check if we're on dashboard (successful login)
    if (currentUrl.includes('/dashboard')) {
      console.log('  ✅ Successfully logged in - redirected to dashboard\n');
    } else if (currentUrl.includes('/login')) {
      console.log('  ❌ Still on login page - login may have failed\n');
    } else {
      console.log(`  ⚠️ Redirected to: ${currentUrl}\n`);
    }

    // Take screenshot for debugging
    await page.screenshot({ path: 'login-test-result.png', fullPage: true });
    console.log('  📸 Screenshot saved to login-test-result.png\n');

    // Summary
    console.log('═══════════════════════════════════════');
    console.log('📊 TEST SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`Console Errors: ${allErrors.length}`);
    console.log(`Network Failures: ${networkErrors.length}`);

    if (allErrors.length > 0) {
      console.log('\n🔴 CONSOLE ERRORS:');
      allErrors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
    }

    if (networkErrors.length > 0) {
      console.log('\n🔴 NETWORK FAILURES:');
      networkErrors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
    }

    if (allErrors.length === 0 && networkErrors.length === 0) {
      console.log('\n✅ NO ERRORS DETECTED!');
    }

    await context.close();

  } catch (error: any) {
    console.error('\n❌ Test runner error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testLogin();

/**
 * Interactive test script - Tests with actual user interactions
 * Specifically looks for "invariant expected layout router" errors
 */

import { chromium, Browser, Page, ConsoleMessage } from 'playwright';

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

async function runInteractiveTest() {
  console.log('🧪 Starting Interactive Tests...\n');
  console.log(`Testing against: ${BASE_URL}\n`);

  let browser: Browser | null = null;
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-web-security'] // Allow cross-origin for testing
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    // Collect ALL console messages
    page.on('console', (msg: ConsoleMessage) => {
      const text = msg.text();
      if (msg.type() === 'error') {
        allErrors.push(`[Console Error] ${text}`);
        console.log(`  ❌ Console Error: ${text.substring(0, 150)}`);
      }
      if (text.includes('invariant') || text.includes('layout router')) {
        console.log(`  🔴 CRITICAL: ${text.substring(0, 150)}`);
      }
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', (error) => {
      allErrors.push(`[Page Error] ${error.message}`);
      console.log(`  ❌ Page Error: ${error.message.substring(0, 150)}`);
    });

    // Test 1: Load homepage
    console.log('📄 Test 1: Loading homepage...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000); // Wait for hydration
    console.log('  ✅ Homepage loaded\n');

    // Test 2: Check for visible error message on page
    console.log('📄 Test 2: Checking for visible errors...');
    const errorElement = await page.$('text=/Application error|invariant|Something went wrong/i');
    if (errorElement) {
      const errorText = await errorElement.textContent();
      console.log(`  ❌ Visible error found: ${errorText}\n`);
      allErrors.push(`[Visible Error] ${errorText}`);
    } else {
      console.log('  ✅ No visible errors\n');
    }

    // Test 3: Navigate using links (tests client-side routing)
    console.log('📄 Test 3: Testing client-side navigation...');

    // Wait for login form and try to navigate
    const loginButton = await page.$('button:has-text("Sign in"), button:has-text("Login"), a:has-text("Welcome")');
    if (loginButton) {
      console.log('  Found login/welcome button, testing navigation...');
    }

    // Direct navigation test
    await page.goto(`${BASE_URL}/welcome`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    console.log('  ✅ /welcome loaded\n');

    // Test 4: Test link clicks (actual client-side navigation)
    console.log('📄 Test 4: Testing link click navigation...');
    const dashboardLink = await page.$('a[href="/dashboard"]');
    if (dashboardLink) {
      await dashboardLink.click();
      await page.waitForTimeout(3000);
      console.log('  ✅ Clicked dashboard link\n');
    } else {
      console.log('  ⚠️ No dashboard link found (may need login)\n');
    }

    // Test 5: Full page refresh after navigation
    console.log('📄 Test 5: Testing full page refresh...');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    console.log('  ✅ Page refreshed\n');

    // Test 6: Navigate to multiple pages rapidly (stress test)
    console.log('📄 Test 6: Rapid navigation stress test...');
    const pages = ['/welcome', '/', '/welcome'];
    for (const pageUrl of pages) {
      await page.goto(`${BASE_URL}${pageUrl}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(2000);
    console.log('  ✅ Rapid navigation complete\n');

    // Summary
    console.log('═══════════════════════════════════════');
    console.log('📊 TEST SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`Total Errors: ${allErrors.length}`);
    console.log(`Total Warnings: ${allWarnings.length}`);

    if (allErrors.length > 0) {
      console.log('\n🔴 ERRORS FOUND:');
      allErrors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
    } else {
      console.log('\n✅ NO ERRORS DETECTED!');
    }

    // Check for the specific invariant error
    const hasInvariantError = allErrors.some(e =>
      e.includes('invariant') && e.includes('layout router')
    );

    if (hasInvariantError) {
      console.log('\n🚨 CRITICAL: "invariant expected layout router" ERROR DETECTED!');
      console.log('This error occurs when:');
      console.log('  1. Webpack loads duplicate React/Next.js modules');
      console.log('  2. Usually caused by path casing mismatches on Windows');
      console.log('\nTo fix:');
      console.log('  1. Close all terminals');
      console.log('  2. Delete .next folder: rm -rf .next');
      console.log('  3. Open a NEW terminal with correct path casing');
      console.log('  4. Run: npm run dev');
    }

    await context.close();

  } catch (error: any) {
    console.error('\n❌ Test runner error:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

runInteractiveTest();

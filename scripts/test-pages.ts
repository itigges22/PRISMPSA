/**
 * Comprehensive page test script using Playwright
 * Tests all major pages for errors
 */

import { chromium, Browser, Page } from 'playwright';

const BASE_URL = process.env.TEST_URL || 'http://localhost:3001';

interface TestResult {
  page: string;
  status: 'pass' | 'fail' | 'error';
  httpStatus?: number;
  errors: string[];
  warnings: string[];
}

const PAGES_TO_TEST = [
  '/',
  '/welcome',
  '/dashboard',
  '/accounts',
  '/departments',
  '/profile',
  '/admin',
  '/admin/roles',
  '/admin/workflows',
];

async function testPage(page: Page, url: string): Promise<TestResult> {
  const result: TestResult = {
    page: url,
    status: 'pass',
    errors: [],
    warnings: [],
  };

  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];

  // Collect console messages
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleMessages.push(`[ERROR] ${msg.text()}`);
    } else if (msg.type() === 'warning') {
      result.warnings.push(`[WARN] ${msg.text()}`);
    }
  });

  // Collect page errors
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  try {
    const response = await page.goto(`${BASE_URL}${url}`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    result.httpStatus = response?.status();

    // Wait a bit for any client-side errors
    await page.waitForTimeout(2000);

    // Check for error messages in console
    result.errors = [...consoleMessages, ...pageErrors];

    // Check for visible error messages on page
    const errorHeading = await page.$('text=/Application error|Error|Something went wrong/i');
    if (errorHeading) {
      const errorText = await errorHeading.textContent();
      result.errors.push(`Visible error on page: ${errorText}`);
    }

    // Check for the specific invariant error
    const hasInvariantError = result.errors.some(e =>
      e.includes('invariant expected layout router') ||
      e.includes('layout router to be mounted')
    );

    if (hasInvariantError || result.errors.length > 0) {
      result.status = 'fail';
    }

  } catch (error: any) {
    result.status = 'error';
    result.errors.push(`Navigation error: ${error.message}`);
  }

  return result;
}

async function runTests() {
  console.log('🧪 Starting comprehensive page tests...\n');

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const results: TestResult[] = [];

    for (const pageUrl of PAGES_TO_TEST) {
      console.log(`Testing: ${pageUrl}`);
      const result = await testPage(page, pageUrl);
      results.push(result);

      const statusEmoji = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
      console.log(`  ${statusEmoji} HTTP ${result.httpStatus || 'N/A'} - ${result.errors.length} errors`);

      if (result.errors.length > 0) {
        result.errors.forEach(e => console.log(`     └─ ${e.substring(0, 100)}...`));
      }
    }

    // Summary
    console.log('\n📊 Test Summary:');
    console.log('================');
    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const errored = results.filter(r => r.status === 'error').length;

    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️ Errors: ${errored}`);

    // Detailed error report
    const failedTests = results.filter(r => r.status !== 'pass');
    if (failedTests.length > 0) {
      console.log('\n🔍 Detailed Error Report:');
      console.log('=========================');
      failedTests.forEach(test => {
        console.log(`\n📄 ${test.page}:`);
        test.errors.forEach(e => console.log(`   - ${e}`));
      });
    }

    await context.close();
  } catch (error: any) {
    console.error('Test runner error:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

runTests();

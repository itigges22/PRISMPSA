/**
 * API Authentication Test Script
 * Tests API endpoints after login to find 500 errors
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const TEST_EMAIL = 'superadmin@test.local';
const TEST_PASSWORD = 'Test1234!';

interface APITestResult {
  endpoint: string;
  status: number;
  success: boolean;
  error?: string;
  responsePreview?: string;
}

async function testAPIs() {
  console.log('🧪 Starting API Authentication Tests...\n');
  console.log(`Testing against: ${BASE_URL}`);
  console.log(`Email: ${TEST_EMAIL}\n`);

  let browser: Browser | null = null;
  const results: APITestResult[] = [];

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Capture console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log(`  ❌ Console: ${msg.text().substring(0, 150)}`);
      }
    });

    // Step 1: Login
    console.log('📄 Step 1: Logging in...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const emailInput = await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
    const passwordInput = await page.waitForSelector('input[type="password"], input[name="password"]', { timeout: 10000 });

    await emailInput?.fill(TEST_EMAIL);
    await passwordInput?.fill(TEST_PASSWORD);

    const loginButton = await page.$('button[type="submit"]');
    await loginButton?.click();
    await page.waitForTimeout(5000);

    const currentUrl = page.url();
    if (!currentUrl.includes('/dashboard')) {
      console.log(`  ❌ Login failed - still on: ${currentUrl}`);
      return;
    }
    console.log('  ✅ Login successful\n');

    // Step 2: Get user ID from page context
    console.log('📄 Step 2: Getting user context...');

    // Wait for dashboard to load
    await page.waitForTimeout(3000);

    // Get the user ID from the network requests or page context
    const cookies = await context.cookies();
    console.log(`  Found ${cookies.length} cookies\n`);

    // Step 3: Test API endpoints
    console.log('📄 Step 3: Testing API endpoints...\n');

    const userId = '11111111-1111-1111-1111-000000000001'; // Superadmin user ID

    const projectId = 'ffffffff-0001-0002-0003-000000000001'; // Website Redesign project

    const endpoints = [
      `/api/projects?userId=${userId}&limit=100`,
      `/api/projects/${projectId}/updates`,
      `/api/projects/${projectId}/issues`,
      `/api/project-updates`,
      `/api/capacity?type=user`,
      `/api/workflows/my-pipeline`,
      `/api/workflows/my-projects`,
      `/api/accounts`,
      `/api/departments`,
      `/api/roles`,
      `/api/profile`,
    ];

    for (const endpoint of endpoints) {
      console.log(`  Testing: ${endpoint}`);

      try {
        // Make request using page context (includes auth cookies)
        const response = await page.evaluate(async (url) => {
          try {
            const res = await fetch(url, {
              credentials: 'include',
              headers: {
                'Accept': 'application/json',
              }
            });
            const text = await res.text();
            let json = null;
            try {
              json = JSON.parse(text);
            } catch {
              // Not JSON
            }
            return {
              status: res.status,
              statusText: res.statusText,
              text: text.substring(0, 500),
              json
            };
          } catch (e: any) {
            return {
              status: 0,
              statusText: 'Fetch Error',
              text: e.message,
              json: null
            };
          }
        }, `${BASE_URL}${endpoint}`);

        const result: APITestResult = {
          endpoint,
          status: response.status,
          success: response.status >= 200 && response.status < 300,
          responsePreview: response.text.substring(0, 200)
        };

        if (!result.success) {
          result.error = response.json?.error || response.statusText;
          console.log(`    ❌ ${response.status} - ${result.error}`);
          if (response.json?.details) {
            console.log(`    Details: ${response.json.details}`);
          }
        } else {
          console.log(`    ✅ ${response.status}`);
        }

        results.push(result);
      } catch (error: any) {
        console.log(`    ❌ Error: ${error.message}`);
        results.push({
          endpoint,
          status: 0,
          success: false,
          error: error.message
        });
      }
    }

    // Summary
    console.log('\n═══════════════════════════════════════');
    console.log('📊 TEST SUMMARY');
    console.log('═══════════════════════════════════════');

    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);

    if (failed > 0) {
      console.log('\n🔴 FAILED ENDPOINTS:');
      results.filter(r => !r.success).forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.endpoint}`);
        console.log(`     Status: ${r.status}`);
        console.log(`     Error: ${r.error}`);
        if (r.responsePreview) {
          console.log(`     Response: ${r.responsePreview.substring(0, 100)}...`);
        }
      });
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

testAPIs();

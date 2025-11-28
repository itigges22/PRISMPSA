/**
 * E2E Permission Testing Script
 * 
 * This script tests permission checks across the platform with two scenarios:
 * 1. User with NO permissions (all disabled)
 * 2. User with ALL permissions (all enabled)
 * 
 * Usage:
 * 1. Open Chrome DevTools Console
 * 2. Copy and paste this script
 * 3. Run: await testAllPermissions()
 * 
 * The script will test all major pages and features to ensure permissions work correctly.
 */

async function testAllPermissions() {
  const baseUrl = window.location.origin;
  const results = {
    noPermissions: {},
    allPermissions: {},
    errors: []
  };

  // Test pages and their expected behaviors
  const testPages = [
    { path: '/dashboard', name: 'Dashboard', requiresAuth: true },
    { path: '/accounts', name: 'Accounts List', requiresAuth: true },
    { path: '/departments', name: 'Departments List', requiresAuth: true },
    { path: '/projects', name: 'Projects List', requiresAuth: true },
    { path: '/admin', name: 'Admin Page', requiresAuth: true },
    { path: '/admin/database', name: 'Database Status', requiresAuth: true },
    { path: '/admin/roles', name: 'Role Management', requiresAuth: true },
    { path: '/analytics', name: 'Analytics', requiresAuth: true },
    { path: '/kanban', name: 'Kanban Board', requiresAuth: true },
    { path: '/gantt', name: 'Gantt Chart', requiresAuth: true },
    { path: '/profile', name: 'User Profile', requiresAuth: true },
    { path: '/welcome', name: 'Welcome Page', requiresAuth: true },
  ];

  console.log('🧪 Starting Permission E2E Tests...\n');

  // Helper function to test a page
  async function testPage(path, name, userType) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'GET',
        credentials: 'include',
        redirect: 'manual'
      });

      const status = response.status;
      const redirected = status >= 300 && status < 400;
      const accessDenied = status === 403 || (status === 200 && await response.text().then(t => t.includes('Access Denied')));
      const notFound = status === 404;
      const success = status === 200 && !accessDenied;

      return {
        path,
        name,
        status,
        redirected,
        accessDenied,
        notFound,
        success,
        userType
      };
    } catch (error) {
      return {
        path,
        name,
        error: error.message,
        userType
      };
    }
  }

  // Test with current user (assumes you're logged in)
  console.log('📋 Testing pages with current user permissions...\n');
  
  for (const page of testPages) {
    const result = await testPage(page.path, page.name, 'current');
    console.log(`${result.success ? '✅' : result.accessDenied ? '❌' : result.redirected ? '↪️' : '⚠️'} ${page.name}: ${result.status} ${result.accessDenied ? '(Access Denied)' : result.redirected ? '(Redirected)' : result.success ? '(Success)' : ''}`);
    
    if (result.error) {
      results.errors.push(result);
    }
  }

  console.log('\n📊 Test Summary:');
  console.log('Note: To fully test both scenarios, you need to:');
  console.log('1. Create a test user with NO permissions');
  console.log('2. Create a test user with ALL permissions');
  console.log('3. Log in as each user and run this script');
  console.log('\n💡 To check specific permission checks, use browser DevTools Network tab');
  console.log('   and look for API calls to /api/auth/permissions or permission checks in console logs.');

  return results;
}

// Export for use in console
window.testAllPermissions = testAllPermissions;

// Also provide a simpler function to check current page access
async function checkCurrentPageAccess() {
  const currentPath = window.location.pathname;
  const response = await fetch(window.location.href, {
    method: 'GET',
    credentials: 'include'
  });
  
  const html = await response.text();
  const accessDenied = html.includes('Access Denied') || html.includes('access denied');
  const notFound = html.includes('404') || html.includes('Not Found');
  
  console.log(`Current Page: ${currentPath}`);
  console.log(`Status: ${response.status}`);
  console.log(`Access Denied: ${accessDenied}`);
  console.log(`Not Found: ${notFound}`);
  
  return {
    path: currentPath,
    status: response.status,
    accessDenied,
    notFound
  };
}

window.checkCurrentPageAccess = checkCurrentPageAccess;

console.log('✅ Permission testing functions loaded!');
console.log('Run: await testAllPermissions() to test all pages');
console.log('Run: await checkCurrentPageAccess() to check current page');


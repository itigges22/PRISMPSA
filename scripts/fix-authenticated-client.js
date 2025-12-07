#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Bulk fix: Add authenticated supabase client to all hasPermission calls in API routes
 *
 * Pattern to fix:
 * hasPermission(userProfile, Permission.XXX)
 * hasPermission(userProfile, Permission.XXX, { context })
 *
 * Should become:
 * hasPermission(userProfile, Permission.XXX, undefined, supabase)
 * hasPermission(userProfile, Permission.XXX, { context }, supabase)
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all TypeScript files in app/api
const apiFiles = glob.sync('app/api/**/*.ts', { cwd: process.cwd() });

console.log(`Found ${apiFiles.length} API route files to check\n`);

let totalFixed = 0;
let filesModified = 0;

apiFiles.forEach(filePath => {
  const fullPath = path.join(process.cwd(), filePath);
  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;
  let fixCount = 0;

  // Pattern 1: hasPermission(userProfile, Permission.XXX) - no context, no supabase
  // Replace with: hasPermission(userProfile, Permission.XXX, undefined, supabase)
  const pattern1 = /hasPermission\(\s*([^,]+),\s*(Permission\.[A-Z_]+)\s*\)/g;
  const matches1 = content.match(pattern1);
  if (matches1) {
    content = content.replace(
      pattern1,
      'hasPermission($1, $2, undefined, supabase)'
    );
    fixCount += matches1.length;
    modified = true;
  }

  // Pattern 2: hasPermission(userProfile, Permission.XXX, { context }) - has context, no supabase
  // Replace with: hasPermission(userProfile, Permission.XXX, { context }, supabase)
  const pattern2 = /hasPermission\(\s*([^,]+),\s*(Permission\.[A-Z_]+),\s*(\{[^}]+\})\s*\)/g;
  const matches2 = content.match(pattern2);
  if (matches2) {
    content = content.replace(
      pattern2,
      'hasPermission($1, $2, $3, supabase)'
    );
    fixCount += matches2.length;
    modified = true;
  }

  // Pattern 3: hasPermission(userProfile, Permission.XXX, undefined) - has undefined, no supabase
  // Replace with: hasPermission(userProfile, Permission.XXX, undefined, supabase)
  const pattern3 = /hasPermission\(\s*([^,]+),\s*(Permission\.[A-Z_]+),\s*undefined\s*\)/g;
  const matches3 = content.match(pattern3);
  if (matches3) {
    content = content.replace(
      pattern3,
      'hasPermission($1, $2, undefined, supabase)'
    );
    fixCount += matches3.length;
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✓ ${filePath} - Fixed ${fixCount} calls`);
    filesModified++;
    totalFixed += fixCount;
  }
});

console.log(`\n${'='.repeat(60)}`);
console.log(`SUMMARY:`);
console.log(`Files modified: ${filesModified}`);
console.log(`Total hasPermission calls fixed: ${totalFixed}`);
console.log(`${'='.repeat(60)}\n`);

if (totalFixed > 0) {
  console.log('✓ All hasPermission calls now include authenticated supabase client');
  console.log('\nNext steps:');
  console.log('1. Review changes: git diff');
  console.log('2. Test API routes');
  console.log('3. Commit if satisfied');
} else {
  console.log('No fixes needed - all calls already correct');
}

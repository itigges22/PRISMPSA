/**
 * Permission Validation Script
 * Validates that all permission checks are correctly implemented across the codebase
 * 
 * Usage: npx tsx scripts/validate-permissions.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { Permission } from '../lib/permissions';

interface ValidationIssue {
  file: string;
  line: number;
  issue: string;
  severity: 'error' | 'warning' | 'info';
  code?: string;
}

const issues: ValidationIssue[] = [];

// Files and directories to scan
const SCAN_PATHS = [
  'app',
  'components',
  'lib',
];

// Patterns to look for
const PERMISSION_CHECK_PATTERNS = [
  /hasPermission\(/g,
  /checkPermission/g,
  /canView/g,
  /canEdit/g,
  /canDelete/g,
  /canManage/g,
  /isSuperadmin/g,
];

// Known permission constants
const ALL_PERMISSIONS = Object.values(Permission);

function scanFile(filePath: string): void {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    // Check 1: Hardcoded permission strings instead of using Permission enum
    const hardcodedPermMatch = line.match(/['"]([A-Z_]+)['"].*permission/i);
    if (hardcodedPermMatch) {
      const permString = hardcodedPermMatch[1];
      if (ALL_PERMISSIONS.includes(permString as Permission)) {
        issues.push({
          file: filePath,
          line: lineNumber,
          issue: `Hardcoded permission string "${permString}" - use Permission.${permString} instead`,
          severity: 'warning',
          code: line.trim(),
        });
      }
    }

    // Check 2: Missing permission checks before UI elements
    if (line.includes('<Button') || line.includes('button') && line.includes('onClick')) {
      const hasPermissionCheck = lines.slice(Math.max(0, index - 5), index).some(l => 
        PERMISSION_CHECK_PATTERNS.some(p => p.test(l))
      );
      
      if (line.includes('Create') || line.includes('Edit') || line.includes('Delete')) {
        if (!hasPermissionCheck && !line.includes('disabled')) {
          issues.push({
            file: filePath,
            line: lineNumber,
            issue: 'Button with Create/Edit/Delete action may be missing permission check',
            severity: 'info',
            code: line.trim(),
          });
        }
      }
    }

    // Check 3: isSuperadmin checks without proper fallback
    if (line.includes('isSuperadmin') && !line.includes('hasPermission')) {
      const nextFewLines = lines.slice(index, index + 10).join('\n');
      if (!nextFewLines.includes('hasPermission') && !nextFewLines.includes('Permission.')) {
        issues.push({
          file: filePath,
          line: lineNumber,
          issue: 'Superadmin check without proper permission fallback - non-superadmins may be blocked',
          severity: 'warning',
          code: line.trim(),
        });
      }
    }

    // Check 4: Direct database access without permission check
    if (line.includes('.from(') && (line.includes('update') || line.includes('delete') || line.includes('insert'))) {
      const hasPermissionCheck = lines.slice(Math.max(0, index - 10), index).some(l => 
        PERMISSION_CHECK_PATTERNS.some(p => p.test(l))
      );
      
      if (!hasPermissionCheck) {
        issues.push({
          file: filePath,
          line: lineNumber,
          issue: 'Database mutation without visible permission check',
          severity: 'error',
          code: line.trim(),
        });
      }
    }

    // Check 5: Context-aware permission checks missing context
    if (line.includes('hasPermission') && (
      line.includes('EDIT_ACCOUNT') || 
      line.includes('EDIT_DEPARTMENT') ||
      line.includes('EDIT_PROJECT')
    )) {
      if (!line.includes('{') || !line.includes('Id')) {
        issues.push({
          file: filePath,
          line: lineNumber,
          issue: 'Context-aware permission check may be missing context parameter',
          severity: 'warning',
          code: line.trim(),
        });
      }
    }

    // Check 6: Missing awaits on async permission checks
    if (line.includes('hasPermission') && !line.includes('await') && !line.includes('.then')) {
      const prevLine = lines[index - 1] || '';
      if (!prevLine.includes('await')) {
        issues.push({
          file: filePath,
          line: lineNumber,
          issue: 'hasPermission is async but not awaited',
          severity: 'error',
          code: line.trim(),
        });
      }
    }

    // Check 7: Access Denied pages without proper permission check
    if (line.includes('Access Denied') || line.includes('access denied')) {
      const hasPermissionCheck = lines.slice(Math.max(0, index - 20), index).some(l => 
        PERMISSION_CHECK_PATTERNS.some(p => p.test(l))
      );
      
      if (!hasPermissionCheck) {
        issues.push({
          file: filePath,
          line: lineNumber,
          issue: 'Access Denied message shown but no permission check found nearby',
          severity: 'info',
          code: line.trim(),
        });
      }
    }
  });
}

function scanDirectory(dir: string): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
        scanDirectory(fullPath);
      }
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        scanFile(fullPath);
      }
    }
  }
}

function printReport(): void {
  console.log('\n🔍 PRISM PSA - Permission Validation Report\n');
  console.log('═'.repeat(80));

  if (issues.length === 0) {
    console.log('\n✅ No issues found! All permission checks appear correct.\n');
    return;
  }

  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');
  const infos = issues.filter(i => i.severity === 'info');

  console.log(`\nFound ${issues.length} potential issues:`);
  console.log(`  ❌ Errors: ${errors.length}`);
  console.log(`  ⚠️  Warnings: ${warnings.length}`);
  console.log(`  ℹ️  Info: ${infos.length}\n`);

  // Print errors
  if (errors.length > 0) {
    console.log('\n❌ ERRORS (Must Fix):\n');
    console.log('─'.repeat(80));
    errors.forEach(issue => {
      console.log(`\n📁 ${issue.file}:${issue.line}`);
      console.log(`   ${issue.issue}`);
      if (issue.code) {
        console.log(`   Code: ${issue.code.substring(0, 100)}${issue.code.length > 100 ? '...' : ''}`);
      }
    });
  }

  // Print warnings
  if (warnings.length > 0) {
    console.log('\n\n⚠️  WARNINGS (Should Review):\n');
    console.log('─'.repeat(80));
    warnings.forEach(issue => {
      console.log(`\n📁 ${issue.file}:${issue.line}`);
      console.log(`   ${issue.issue}`);
      if (issue.code) {
        console.log(`   Code: ${issue.code.substring(0, 100)}${issue.code.length > 100 ? '...' : ''}`);
      }
    });
  }

  // Print info (only first 10 to avoid spam)
  if (infos.length > 0) {
    console.log('\n\nℹ️  INFO (May Need Review):\n');
    console.log('─'.repeat(80));
    infos.slice(0, 10).forEach(issue => {
      console.log(`\n📁 ${issue.file}:${issue.line}`);
      console.log(`   ${issue.issue}`);
      if (issue.code) {
        console.log(`   Code: ${issue.code.substring(0, 100)}${issue.code.length > 100 ? '...' : ''}`);
      }
    });
    
    if (infos.length > 10) {
      console.log(`\n   ... and ${infos.length - 10} more info items`);
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log('\n💡 Tip: Use the debug-permissions.ts script to test actual user permissions.\n');

  // Exit with error code if there are errors
  if (errors.length > 0) {
    process.exit(1);
  }
}

// Main execution
console.log('🚀 Starting permission validation scan...\n');
console.log(`Scanning paths: ${SCAN_PATHS.join(', ')}\n`);

for (const scanPath of SCAN_PATHS) {
  if (fs.existsSync(scanPath)) {
    scanDirectory(scanPath);
  } else {
    console.warn(`⚠️  Warning: Path not found: ${scanPath}`);
  }
}

printReport();


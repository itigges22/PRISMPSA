#!/usr/bin/env node
/**
 * Check Path Casing Script
 *
 * On Windows, path casing mismatches can cause webpack to load duplicate modules.
 * This script checks if the current working directory matches the actual path casing
 * on disk and AUTOMATICALLY FIXES IT by changing to the correct directory.
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

// Only relevant on Windows
if (process.platform !== 'win32') {
  process.exit(0);
}

/**
 * Get the actual case-sensitive path on Windows
 * @param {string} inputPath
 * @returns {string}
 */
function getRealPath(inputPath) {
  try {
    // fs.realpathSync.native returns the actual casing on Windows
    return fs.realpathSync.native(inputPath);
  } catch {
    return inputPath;
  }
}

const cwd = process.cwd();
const realCwd = getRealPath(cwd);

// Check if the paths have different casing (case-sensitive comparison)
const cwdNormalized = cwd.replace(/\\/g, '/');
const realCwdNormalized = realCwd.replace(/\\/g, '/');

// Check if paths differ in casing
if (cwdNormalized !== realCwdNormalized) {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║ 🔧 PATH CASING MISMATCH DETECTED - AUTO-FIXING                               ║');
  console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
  console.log('║                                                                              ║');
  console.log('║ Your terminal is using a path with different casing than the actual folder. ║');
  console.log('║                                                                              ║');
  console.log(`║ Current:  ${cwd.substring(0, 60).padEnd(66)}║`);
  console.log(`║ Actual:   ${realCwd.substring(0, 60).padEnd(66)}║`);
  console.log('║                                                                              ║');
  console.log('║ Automatically changing to correct directory...                              ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  // Change to the correct directory
  try {
    process.chdir(realCwd);
    console.log(`✅ Changed directory to: ${realCwd}\n`);
  } catch (err) {
    console.error(`❌ Failed to change directory: ${err.message}`);
    console.error('Please manually run from the correct path:');
    console.error(`  cd "${realCwd}"`);
    console.error('  npm run dev');
    process.exit(1);
  }
}

// Also check if the path contains case-sensitive differences in segments
const cwdParts = cwd.replace(/\\/g, '/').split('/');
const realCwdParts = realCwd.replace(/\\/g, '/').split('/');

let hasCasingDiff = false;
for (let i = 0; i < cwdParts.length && i < realCwdParts.length; i++) {
  if (cwdParts[i] !== realCwdParts[i] && cwdParts[i].toLowerCase() === realCwdParts[i].toLowerCase()) {
    hasCasingDiff = true;
    break;
  }
}

if (hasCasingDiff) {
  // Set environment variable that webpack config can use
  process.env.MOVALAB_PATH_CASING_MISMATCH = 'true';
  process.env.MOVALAB_REAL_PATH = realCwd;
}

process.exit(0);

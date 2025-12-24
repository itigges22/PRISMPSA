#!/usr/bin/env node
/**
 * Next.js Wrapper Script
 *
 * This script ensures Next.js always runs from the correct-cased directory path on Windows.
 * Windows is case-insensitive but webpack treats different-cased paths as different modules,
 * causing the "invariant expected layout router" error due to duplicate React instances.
 *
 * Usage: node scripts/dev-wrapper.js [next-args...]
 * Examples:
 *   node scripts/dev-wrapper.js dev      # Development server
 *   node scripts/dev-wrapper.js build    # Production build
 *   node scripts/dev-wrapper.js start    # Production server
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Only relevant on Windows
if (process.platform !== 'win32') {
  // On non-Windows, just run Next.js directly
  const nextBin = path.join(__dirname, '..', 'node_modules', '.bin', 'next');
  const args = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['dev'];

  const child = spawn(nextBin, args, { stdio: 'inherit', shell: true });
  child.on('exit', (code) => process.exit(code || 0));
  // Note: Don't call process.exit() here - wait for child to complete
  // The script will exit when child.on('exit') fires
  return;
}

/**
 * Get the actual case-sensitive path on Windows
 */
function getRealPath(inputPath) {
  try {
    return fs.realpathSync.native(inputPath);
  } catch {
    return inputPath;
  }
}

const cwd = process.cwd();
const realCwd = getRealPath(cwd);

// Check if paths differ
if (cwd !== realCwd) {
  console.log('');
  console.log('\x1b[33m' + '=' .repeat(78) + '\x1b[0m');
  console.log('\x1b[33m  PATH CASING MISMATCH DETECTED\x1b[0m');
  console.log('\x1b[33m' + '=' .repeat(78) + '\x1b[0m');
  console.log('');
  console.log('  Your terminal is using:   \x1b[31m' + cwd + '\x1b[0m');
  console.log('  Actual folder path:       \x1b[32m' + realCwd + '\x1b[0m');
  console.log('');
  console.log('  \x1b[36mThis script will run Next.js from the correct path to prevent errors.\x1b[0m');
  console.log('');
  console.log('\x1b[33m' + '=' .repeat(78) + '\x1b[0m');
  console.log('');
}

// Build the command to run
const nextBin = path.join(realCwd, 'node_modules', '.bin', 'next.cmd');
const args = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['dev'];

// Spawn Next.js from the correct directory
const child = spawn(nextBin, args, {
  cwd: realCwd,  // This is the key - run from correct-cased path
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    // Pass the real path to Next.js config
    MOVALAB_REAL_CWD: realCwd
  }
});

// Handle process exit
child.on('exit', (code) => {
  process.exit(code || 0);
});

// Forward signals
process.on('SIGINT', () => {
  child.kill('SIGINT');
});

process.on('SIGTERM', () => {
  child.kill('SIGTERM');
});

#!/usr/bin/env node
/**
 * MovaLab Demo Mode Startup Script
 *
 * This script safely starts the demo environment:
 * 1. Verifies Docker is available and running
 * 2. Starts Supabase containers (if not already running)
 * 3. Waits for services to be ready
 * 4. Starts Next.js with demo mode enabled
 *
 * Usage: node scripts/start-demo.js
 * Or via npm: npm run dev:demo
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// ANSI colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[OK]${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}[WARN]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  header: (msg) => {
    console.log('');
    console.log(`${colors.cyan}${'='.repeat(50)}${colors.reset}`);
    console.log(`${colors.cyan}${msg}${colors.reset}`);
    console.log(`${colors.cyan}${'='.repeat(50)}${colors.reset}`);
    console.log('');
  },
};

// Check if a command exists
function commandExists(cmd) {
  try {
    if (process.platform === 'win32') {
      execSync(`where ${cmd}`, { stdio: 'ignore' });
    } else {
      execSync(`which ${cmd}`, { stdio: 'ignore' });
    }
    return true;
  } catch {
    return false;
  }
}

// Execute a command and return the output
function exec(cmd, options = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: options.silent ? 'pipe' : 'inherit', ...options });
  } catch (error) {
    if (options.ignoreError) return null;
    throw error;
  }
}

// Check if Docker is running
function isDockerRunning() {
  try {
    execSync('docker info', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Check if Supabase is running
function isSupabaseRunning() {
  try {
    const result = execSync('npx supabase status', { encoding: 'utf8', stdio: 'pipe' });
    return result.includes('API URL') && !result.includes('not running');
  } catch {
    return false;
  }
}

// Wait for Supabase API to be ready
async function waitForSupabaseAPI(maxAttempts = 15) {
  const http = require('http');

  for (let i = 0; i < maxAttempts; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get('http://127.0.0.1:54321/rest/v1/', (res) => {
          if (res.statusCode === 200 || res.statusCode === 401) {
            resolve(true);
          } else {
            reject(new Error(`Status: ${res.statusCode}`));
          }
        });
        req.on('error', reject);
        req.setTimeout(2000, () => {
          req.destroy();
          reject(new Error('Timeout'));
        });
      });
      return true;
    } catch {
      if (i < maxAttempts - 1) {
        log.info(`Waiting for Supabase API... (${i + 1}/${maxAttempts})`);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }
  return false;
}

// Check .env.local for cloud credentials (safety check)
function checkEnvForCloudCredentials() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    return { isCloud: false, hasEnv: false };
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);

  if (supabaseUrl && supabaseUrl[1]) {
    const url = supabaseUrl[1].trim();
    // Check if it's a cloud URL (not localhost)
    if (url.includes('supabase.co') || url.includes('supabase.in')) {
      return { isCloud: true, hasEnv: true, url };
    }
  }

  return { isCloud: false, hasEnv: true };
}

// Main function
async function main() {
  log.header('MovaLab Demo Mode Startup');

  // Step 1: Check for cloud credentials (safety)
  log.info('Checking environment configuration...');
  const envCheck = checkEnvForCloudCredentials();

  if (envCheck.isCloud) {
    log.warn('Your .env.local points to a CLOUD Supabase instance!');
    log.warn(`URL: ${envCheck.url}`);
    console.log('');
    log.error('Demo mode should use LOCAL Docker Supabase, not cloud.');
    log.info('To fix this, update .env.local:');
    console.log('');
    console.log('  NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321');
    console.log('  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0');
    console.log('');
    log.info('Or run: npm run dev:cloud (for cloud development)');
    process.exit(1);
  }

  if (!envCheck.hasEnv) {
    log.warn('.env.local not found, creating from template...');
    const templatePath = path.join(process.cwd(), '.env.local.template');
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(templatePath)) {
      fs.copyFileSync(templatePath, envPath);
      log.success('.env.local created from template');
    } else {
      log.error('.env.local.template not found');
      process.exit(1);
    }
  }

  log.success('Environment configured for local Docker');

  // Step 2: Check Docker
  log.info('Checking Docker...');
  if (!commandExists('docker')) {
    log.error('Docker is not installed!');
    log.info('Please install Docker Desktop: https://www.docker.com/products/docker-desktop');
    process.exit(1);
  }

  if (!isDockerRunning()) {
    log.error('Docker is not running!');
    log.info('Please start Docker Desktop and try again.');
    process.exit(1);
  }
  log.success('Docker is running');

  // Step 3: Start Supabase if needed
  log.info('Checking Supabase status...');

  if (isSupabaseRunning()) {
    log.success('Supabase is already running');
  } else {
    log.info('Starting Supabase containers...');
    log.info('(This may take 1-2 minutes on first run)');
    console.log('');

    try {
      exec('npx supabase start', { stdio: 'inherit' });
      log.success('Supabase started');
    } catch (error) {
      log.error('Failed to start Supabase');
      log.info('Try running: npx supabase start');
      process.exit(1);
    }
  }

  // Step 4: Wait for API to be ready
  log.info('Verifying Supabase API is ready...');
  const apiReady = await waitForSupabaseAPI();

  if (!apiReady) {
    log.error('Supabase API did not become ready in time');
    log.info('Try: npx supabase stop && npx supabase start');
    process.exit(1);
  }
  log.success('Supabase API is ready');

  // Step 5: Start Next.js with demo mode
  log.header('Starting Next.js in Demo Mode');

  console.log('');
  log.info('Demo mode features:');
  console.log('  - Quick-login buttons for demo users');
  console.log('  - Destructive actions disabled');
  console.log('  - Superadmin setup hidden');
  console.log('');
  log.info('Demo users (password: Test1234!):');
  console.log('  - exec@test.local (Executive Director)');
  console.log('  - manager@test.local (Account Manager)');
  console.log('  - pm@test.local (Project Manager)');
  console.log('  - designer@test.local (Senior Designer)');
  console.log('  - dev@test.local (Developer)');
  console.log('  - client@test.local (Client)');
  console.log('');
  log.info('Opening http://localhost:3000 ...');
  console.log('');

  // Determine the correct next binary
  const isWindows = process.platform === 'win32';
  const nextBin = path.join(process.cwd(), 'node_modules', '.bin', isWindows ? 'next.cmd' : 'next');

  // Start Next.js with demo mode environment variable
  const child = spawn(nextBin, ['dev'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      NEXT_PUBLIC_DEMO_MODE: 'true',
    },
  });

  child.on('exit', (code) => {
    process.exit(code || 0);
  });

  // Forward signals
  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
}

// Run
main().catch((error) => {
  log.error(`Unexpected error: ${error.message}`);
  process.exit(1);
});

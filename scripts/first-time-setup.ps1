# MovaLab First-Time Setup Script (PowerShell)
# This script sets up everything needed to run MovaLab locally with Docker
# Works on: PowerShell 5.1+, PowerShell Core 7+

param(
    [switch]$SkipPrompts,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

# Colors
function Write-Header { param($msg) Write-Host "`n========================================" -ForegroundColor Blue; Write-Host $msg -ForegroundColor Blue; Write-Host "========================================`n" -ForegroundColor Blue }
function Write-Success { param($msg) Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Error2 { param($msg) Write-Host "[ERROR] $msg" -ForegroundColor Red }
function Write-Warning2 { param($msg) Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Info { param($msg) Write-Host "[INFO] $msg" -ForegroundColor Cyan }

Write-Header "MovaLab First-Time Setup"
Write-Host "This script will set up your local development environment.`n"

# ============================================================================
# STEP 1: Check Prerequisites
# ============================================================================
Write-Header "Step 1: Checking Prerequisites"

# Check Node.js
try {
    $nodeVersion = node --version 2>$null
    if ($nodeVersion) {
        Write-Success "Node.js is installed: $nodeVersion"
        $nodeMajor = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
        if ($nodeMajor -lt 18) {
            Write-Error2 "Node.js 18 or higher is required (you have v$nodeMajor)"
            Write-Host "   Please install Node.js 18+ from: https://nodejs.org/"
            exit 1
        }
    } else {
        throw "not found"
    }
} catch {
    Write-Error2 "Node.js is not installed"
    Write-Host "   Please install Node.js 18+ from: https://nodejs.org/"
    exit 1
}

# Check npm
try {
    $npmVersion = npm --version 2>$null
    if ($npmVersion) {
        Write-Success "npm is installed: $npmVersion"
    } else {
        throw "not found"
    }
} catch {
    Write-Error2 "npm is not installed (should come with Node.js)"
    exit 1
}

# Check Docker
try {
    $dockerVersion = docker --version 2>$null
    if ($dockerVersion) {
        Write-Success "Docker is installed: $dockerVersion"

        # Check if Docker is running
        $dockerInfo = docker info 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Docker daemon is running"
        } else {
            Write-Error2 "Docker is installed but not running"
            Write-Host "   Please start Docker Desktop and try again"
            exit 1
        }
    } else {
        throw "not found"
    }
} catch {
    Write-Error2 "Docker is not installed"
    Write-Host "   Please install Docker Desktop from: https://www.docker.com/products/docker-desktop"
    exit 1
}

# ============================================================================
# STEP 2: Check for Base Schema Migration
# ============================================================================
Write-Header "Step 2: Checking Database Schema"

if (Test-Path "supabase/migrations/20250123000000_schema_base.sql") {
    Write-Success "Base schema migration found"
} else {
    Write-Error2 "Base schema migration is missing"
    Write-Host "`n   The file supabase/migrations/20250123000000_schema_base.sql does not exist."
    Write-Host "   Please ensure you have the complete repository."
    exit 1
}

# ============================================================================
# STEP 3: Install Dependencies
# ============================================================================
Write-Header "Step 3: Installing Dependencies"

if (Test-Path "package.json") {
    Write-Info "Running npm install..."
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error2 "npm install failed"
        Write-Host "`n   Try: npm cache clean --force"
        Write-Host "   Then: Remove-Item -Recurse -Force node_modules, package-lock.json"
        Write-Host "   Then: npm install"
        exit 1
    }
    Write-Success "Dependencies installed"

    # Verify Supabase CLI
    $supabaseVersion = npx supabase --version 2>$null
    if ($supabaseVersion) {
        Write-Success "Supabase CLI is available: $supabaseVersion"
    } else {
        Write-Error2 "Supabase CLI not found after npm install"
        exit 1
    }

    # Verify tsx
    $tsxVersion = npx tsx --version 2>$null
    if ($tsxVersion) {
        Write-Success "tsx is available: $tsxVersion"
    } else {
        Write-Error2 "tsx not found after npm install"
        exit 1
    }
} else {
    Write-Error2 "package.json not found. Are you in the MovaLab root directory?"
    exit 1
}

# ============================================================================
# STEP 4: Initialize Supabase
# ============================================================================
Write-Header "Step 4: Initializing Supabase"

if (Test-Path "supabase") {
    Write-Success "Supabase directory already exists"
} else {
    Write-Error2 "Supabase directory not found"
    exit 1
}

# ============================================================================
# STEP 5: Configure Environment Variables
# ============================================================================
Write-Header "Step 5: Configuring Environment Variables"

if (Test-Path ".env.local") {
    Write-Warning2 ".env.local already exists"
    if (-not $SkipPrompts -and -not $Force) {
        $response = Read-Host "   Do you want to overwrite it? (y/N)"
        if ($response -eq 'y' -or $response -eq 'Y') {
            Copy-Item ".env.local.template" ".env.local" -Force
            Write-Success "Environment file created from template"
        } else {
            Write-Info "Keeping existing .env.local file"
        }
    } else {
        Write-Info "Keeping existing .env.local file"
    }
} else {
    if (Test-Path ".env.local.template") {
        Copy-Item ".env.local.template" ".env.local"
        Write-Success "Environment file created from template"
    } else {
        Write-Error2 ".env.local.template not found"
        exit 1
    }
}

# ============================================================================
# STEP 6: Start Supabase Docker Containers
# ============================================================================
Write-Header "Step 6: Starting Supabase Docker Containers"

Write-Info "This will start PostgreSQL, API, Auth, Storage, and Studio..."
Write-Info "(This may take 1-2 minutes on first run)"

# Check if already running and API is accessible
$apiAccessible = $false
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:54321/rest/v1/" -TimeoutSec 3 -UseBasicParsing -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 401) {
        $apiAccessible = $true
        Write-Success "Supabase is already running and accessible"
    }
} catch {
    # API not accessible
}

if (-not $apiAccessible) {
    Write-Info "Starting Supabase..."

    # Stop any partial runs first
    npx supabase stop 2>$null
    Start-Sleep -Seconds 2

    # Start Supabase
    npx supabase start
    if ($LASTEXITCODE -ne 0) {
        Write-Error2 "Failed to start Supabase"
        Write-Host "`n   Common causes:"
        Write-Host "   - Docker Desktop not running"
        Write-Host "   - Port conflicts (stop other services using ports 54321-54326)"
        Write-Host "`n   Manual recovery:"
        Write-Host "   1. npx supabase stop"
        Write-Host "   2. npx supabase start"
        exit 1
    }
    Write-Success "Supabase started"
}

# ============================================================================
# STEP 6.5: Verify Services are Ready
# ============================================================================
Write-Header "Step 6.5: Verifying Services are Ready"

Write-Info "Waiting for API to be ready..."

$maxAttempts = 15
$attempt = 0
$ready = $false

while ($attempt -lt $maxAttempts -and -not $ready) {
    $attempt++
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:54321/rest/v1/" -TimeoutSec 3 -UseBasicParsing -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 401) {
            $ready = $true
        }
    } catch {
        # Not ready yet
    }

    if (-not $ready) {
        Write-Info "Waiting for API... (attempt $attempt/$maxAttempts)"
        Start-Sleep -Seconds 2
    }
}

if ($ready) {
    Write-Success "Supabase API is accessible at http://127.0.0.1:54321"
} else {
    Write-Error2 "Cannot connect to Supabase API"
    Write-Host "`n   Troubleshooting:"
    Write-Host "   1. Check Docker Desktop is running"
    Write-Host "   2. Run: docker ps (should show supabase containers)"
    Write-Host "   3. Run: npx supabase stop; npx supabase start"
    exit 1
}

# ============================================================================
# STEP 7: Reset Database and Apply Migrations
# ============================================================================
Write-Header "Step 7: Resetting Database"

Write-Info "Applying migrations and base seed data..."
npx supabase db reset --debug 2>&1 | Out-Null
# Note: db reset may show warnings about non-existent policies, this is normal

Write-Success "Database reset complete"

# ============================================================================
# STEP 8: Create Seed Users and Load Data
# ============================================================================
Write-Header "Step 8: Creating Seed Users and Loading Data"

Write-Info "Creating test users and loading seed data..."
npx tsx scripts/create-seed-users.ts

if ($LASTEXITCODE -ne 0) {
    Write-Error2 "Failed to create seed users"
    Write-Host "   You can manually run: npx tsx scripts/create-seed-users.ts"
    exit 1
}

Write-Success "Seed users and data created"

# ============================================================================
# STEP 9: Run Health Check
# ============================================================================
Write-Header "Step 9: Running Health Check"

if (Test-Path "scripts/docker-health-check.ts") {
    npx tsx scripts/docker-health-check.ts
} else {
    Write-Warning2 "Health check script not found (this is optional)"
}

# ============================================================================
# STEP 10: Display Next Steps
# ============================================================================
Write-Header "Setup Complete!"

Write-Host @"

Your MovaLab development environment is ready!

What's Next:

1. Start the development server:
   npm run dev

2. Open your browser:
   http://localhost:3000

3. Login with a test user:
   Email: superadmin@test.local
   Password: Test1234!

4. Access Supabase Studio (database UI):
   http://127.0.0.1:54323

Useful Commands:
   npm run docker:start   - Start Supabase services
   npm run docker:stop    - Stop Supabase services
   npm run docker:reset   - Reset database (re-run migrations)
   npm run docker:seed    - Reset database + create seed users
   npm run docker:health  - Check system health

Test User Accounts (all passwords: Test1234!):
   - superadmin@test.local    - Full system access
   - exec@test.local          - Executive Director
   - manager@test.local       - Account Manager
   - pm@test.local            - Project Manager
   - designer@test.local      - Senior Designer
   - dev@test.local           - Senior Developer
   - contributor@test.local   - Part-time Contributor
   - client@test.local        - Client Portal Access

"@ -ForegroundColor White

Write-Success "Happy coding!"
Write-Host ""

if (-not $SkipPrompts) {
    Read-Host "Press Enter to close"
}

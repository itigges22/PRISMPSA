#!/bin/bash
# MovaLab First-Time Setup Script
# This script sets up everything needed to run MovaLab locally with Docker

# Detect Windows/Git Bash
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
  IS_WINDOWS=true
else
  IS_WINDOWS=false
fi

# Error handler for Windows - prevent immediate window close
error_exit() {
  echo ""
  echo "========================================="
  echo "Setup failed! See error above."
  echo "========================================="
  echo ""
  if [ "$IS_WINDOWS" = true ]; then
    read -p "Press Enter to close..."
  fi
  exit 1
}

# Set error trap
trap error_exit ERR

set -e  # Exit on error

# Colors for output (disable if not a TTY to avoid PowerShell issues)
# Use ANSI-C quoting $'...' for proper escape sequence interpretation
if [ -t 1 ]; then
  # Running in a TTY
  RED=$'\033[0;31m'
  GREEN=$'\033[0;32m'
  YELLOW=$'\033[1;33m'
  BLUE=$'\033[0;34m'
  NC=$'\033[0m' # No Color
else
  # Not a TTY (e.g., PowerShell) - disable colors
  RED=''
  GREEN=''
  YELLOW=''
  BLUE=''
  NC=''
fi

# Helper functions - use printf for better cross-platform compatibility
print_header() {
  echo ""
  printf "${BLUE}========================================${NC}\n"
  printf "${BLUE}%s${NC}\n" "$1"
  printf "${BLUE}========================================${NC}\n"
  echo ""
}

print_success() {
  printf "${GREEN}[OK] %s${NC}\n" "$1"
}

print_error() {
  printf "${RED}[ERROR] %s${NC}\n" "$1"
}

print_warning() {
  printf "${YELLOW}[WARN] %s${NC}\n" "$1"
}

print_info() {
  printf "${BLUE}[INFO] %s${NC}\n" "$1"
}

# Check if command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

print_header "🚀 MovaLab First-Time Setup"
echo "This script will set up your local development environment."
echo ""

# ============================================================================
# STEP 1: Check Prerequisites
# ============================================================================
print_header "📋 Step 1: Checking Prerequisites"

# Check Node.js
if command_exists node; then
  NODE_VERSION=$(node --version)
  print_success "Node.js is installed: $NODE_VERSION"

  # Check if Node version is 18 or higher
  NODE_MAJOR_VERSION=$(node --version | cut -d'.' -f1 | sed 's/v//')
  if [ "$NODE_MAJOR_VERSION" -lt 18 ]; then
    print_error "Node.js 18 or higher is required (you have v$NODE_MAJOR_VERSION)"
    echo "   Please install Node.js 18+ from: https://nodejs.org/"
    exit 1
  fi
else
  print_error "Node.js is not installed"
  echo "   Please install Node.js 18+ from: https://nodejs.org/"
  exit 1
fi

# Check npm
if command_exists npm; then
  NPM_VERSION=$(npm --version)
  print_success "npm is installed: $NPM_VERSION"
else
  print_error "npm is not installed (should come with Node.js)"
  exit 1
fi

# Check Docker
if command_exists docker; then
  DOCKER_VERSION=$(docker --version)
  print_success "Docker is installed: $DOCKER_VERSION"

  # Check if Docker is running
  if docker info >/dev/null 2>&1; then
    print_success "Docker daemon is running"

    # Check Docker Hub authentication (to avoid rate limits)
    if docker info 2>/dev/null | grep -q "Username:"; then
      DOCKER_USER=$(docker info 2>/dev/null | grep "Username:" | awk '{print $2}')
      DOCKER_AUTHENTICATED=true
      print_success "Docker Hub authenticated as: $DOCKER_USER"
    else
      DOCKER_AUTHENTICATED=false
      print_warning "Docker Hub not authenticated (may hit rate limits)"
      printf "   ${BLUE}Tip: Authenticate to increase rate limits:${NC}\n"
      printf "   ${GREEN}docker login${NC}\n"
      printf "   ${YELLOW}(Press Enter to continue anyway or Ctrl+C to cancel)${NC}\n"

      # Only prompt if running in a TTY
      if [ -t 0 ]; then
        read -p "   "
      else
        echo "   (Non-interactive mode - continuing without authentication)"
      fi
    fi
  else
    print_error "Docker is installed but not running"
    echo "   Please start Docker Desktop and try again"
    exit 1
  fi
else
  print_error "Docker is not installed"
  echo "   Please install Docker Desktop from: https://www.docker.com/products/docker-desktop"
  exit 1
fi

# Note: Supabase CLI is installed as a dev dependency via npm install
# We don't check for it here because it will be installed in Step 3

# ============================================================================
# STEP 2: Check for Base Schema Migration
# ============================================================================
print_header "🗄️  Step 2: Checking Database Schema"

if [ -f "supabase/migrations/20250123000000_schema_base.sql" ]; then
  print_success "Base schema migration found"
else
  print_error "Base schema migration is missing"
  echo ""
  printf "   The file ${YELLOW}supabase/migrations/20250123000000_schema_base.sql${NC} does not exist.\n"
  echo "   This file contains your database table schemas and must be generated"
  echo "   from your cloud Supabase instance."
  echo ""
  printf "   ${BLUE}To generate it, run these commands:${NC}\n"
  echo ""
  printf "   ${GREEN}supabase link --project-ref oomnezdhkmsfjlihkmui${NC}\n"
  printf "   ${GREEN}supabase db pull${NC}\n"
  echo ""
  printf "   This will create a file like: ${YELLOW}20250123XXXXXX_remote_schema.sql${NC}\n"
  echo ""
  echo "   Then rename it:"
  printf "   ${GREEN}mv supabase/migrations/*_remote_schema.sql supabase/migrations/20250123000000_schema_base.sql${NC}\n"
  echo ""
  echo "   Finally, run this setup script again:"
  printf "   ${GREEN}./scripts/first-time-setup.sh${NC}\n"
  echo ""
  exit 1
fi

# ============================================================================
# STEP 3: Install Dependencies
# ============================================================================
print_header "📦 Step 3: Installing Dependencies"

if [ -f "package.json" ]; then
  print_info "Running npm install..."

  if npm install; then
    print_success "Dependencies installed"
  else
    print_error "npm install failed"
    echo ""
    printf "   ${YELLOW}Common causes:${NC}\n"
    echo "   - Network connectivity issues"
    echo "   - npm cache corruption"
    echo "   - Node.js version mismatch"
    echo ""
    printf "   ${YELLOW}Try these fixes:${NC}\n"
    printf "   1. Clear npm cache: ${GREEN}npm cache clean --force${NC}\n"
    printf "   2. Delete node_modules: ${GREEN}rm -rf node_modules package-lock.json${NC}\n"
    printf "   3. Try again: ${GREEN}npm install${NC}\n"
    echo ""
    exit 1
  fi

  # Verify Supabase CLI is now available (installed as dev dependency)
  if npx supabase --version >/dev/null 2>&1; then
    SUPABASE_VERSION=$(npx supabase --version)
    print_success "Supabase CLI is available: $SUPABASE_VERSION"
  else
    print_error "Supabase CLI not found after npm install"
    echo "   This is unexpected. Please check package.json includes supabase in devDependencies"
    exit 1
  fi

  # Verify tsx is available (needed for seed scripts)
  if npx tsx --version >/dev/null 2>&1; then
    TSX_VERSION=$(npx tsx --version)
    print_success "tsx is available: $TSX_VERSION"
  else
    print_error "tsx not found after npm install"
    echo "   This is needed to run TypeScript seed scripts"
    echo "   Please check package.json includes tsx in devDependencies"
    exit 1
  fi
else
  print_error "package.json not found. Are you in the MovaLab root directory?"
  exit 1
fi

# ============================================================================
# STEP 4: Initialize Supabase (if needed)
# ============================================================================
print_header "🔧 Step 4: Initializing Supabase"

if [ -d "supabase" ]; then
  print_success "Supabase directory already exists"
else
  print_warning "Supabase directory not found. This is unexpected."
  echo "   The repository should already include supabase/ directory"
  exit 1
fi

# ============================================================================
# STEP 5: Configure Environment Variables
# ============================================================================
print_header "🔐 Step 5: Configuring Environment Variables"

if [ -f ".env.local" ]; then
  print_warning ".env.local already exists"

  # Only prompt if running in a TTY (skip for PowerShell)
  if [ -t 0 ]; then
    read -p "   Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      cp .env.local.template .env.local
      print_success "Environment file created from template"
    else
      print_info "Keeping existing .env.local file"
    fi
  else
    # Not a TTY - keep existing file
    print_info "Keeping existing .env.local file (non-interactive mode)"
  fi
else
  if [ -f ".env.local.template" ]; then
    cp .env.local.template .env.local
    print_success "Environment file created from template"
  else
    print_error ".env.local.template not found"
    exit 1
  fi
fi

# ============================================================================
# STEP 6: Start Supabase Docker Containers
# ============================================================================
print_header "🐳 Step 6: Starting Supabase Docker Containers"

print_info "This will start PostgreSQL, API, Auth, Storage, and Studio..."
print_info "(This may take 1-2 minutes on first run)"
echo ""

# Check if already running AND API is actually responding
JUST_STARTED=false
SUPABASE_RUNNING=false

# First check status
if npx supabase status >/dev/null 2>&1; then
  # Status says running, but verify API is actually accessible
  # Use 127.0.0.1 for Windows compatibility
  if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:54321/rest/v1/ 2>/dev/null | grep -q "200\|401"; then
    print_success "Supabase is already running and accessible"
    SUPABASE_RUNNING=true
    JUST_STARTED=false
  else
    print_warning "Supabase status reports running but API is not responding"
    print_info "Restarting Supabase services..."
    npx supabase stop >/dev/null 2>&1
    sleep 2
  fi
fi

if [ "$SUPABASE_RUNNING" = false ]; then
  print_info "Starting Supabase for the first time (pulling Docker images)..."
  echo ""

  # Only show rate limit warning if not authenticated
  if [ "$DOCKER_AUTHENTICATED" = false ]; then
    print_warning "Note: If you get 'Rate exceeded' errors from Docker registry:"
    echo "   1. Wait 6 hours for rate limit to reset, OR"
    printf "   2. Authenticate with Docker Hub: ${GREEN}docker login${NC}\n"
    printf "   3. Then retry: ${GREEN}npx supabase start${NC}\n"
    echo ""
  fi

  # Try to start Supabase with retry logic
  MAX_RETRIES=3
  RETRY_COUNT=0
  SUCCESS=false

  while [ $RETRY_COUNT -lt $MAX_RETRIES ] && [ "$SUCCESS" = false ]; do
    if [ $RETRY_COUNT -gt 0 ]; then
      WAIT_TIME=$((RETRY_COUNT * 10))
      print_warning "Retry attempt $((RETRY_COUNT + 1))/$MAX_RETRIES (waiting ${WAIT_TIME}s)..."
      sleep $WAIT_TIME
    fi

    # Start Supabase using npx
    if npx supabase start; then
      SUCCESS=true
      JUST_STARTED=true
      print_success "Supabase started successfully"
    else
      RETRY_COUNT=$((RETRY_COUNT + 1))

      if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
        print_warning "Start failed, will retry..."
      fi
    fi
  done

  if [ "$SUCCESS" = false ]; then
    print_error "Failed to start Supabase after $MAX_RETRIES attempts"
    echo ""
    printf "   ${YELLOW}Common causes:${NC}\n"
    printf "   - Docker Hub rate limit exceeded (wait 6 hours or run: ${GREEN}docker login${NC})\n"
    echo "   - Docker Desktop not running"
    echo "   - Port conflicts (stop other services using ports 54321-54326)"
    echo ""
    printf "   ${YELLOW}Manual recovery:${NC}\n"
    printf "   1. Authenticate with Docker: ${GREEN}docker login${NC}\n"
    printf "   2. Stop Supabase: ${GREEN}npx supabase stop${NC}\n"
    printf "   3. Start again: ${GREEN}npx supabase start${NC}\n"
    echo ""
    exit 1
  fi
fi

# ============================================================================
# STEP 6.5: Verify Services are Ready
# ============================================================================
print_header "⏳ Step 6.5: Verifying Services are Ready"

# Only wait if we just started Supabase
if [ "$JUST_STARTED" = true ]; then
  print_info "Waiting for services to initialize (just started)..."
  print_info "(First-time startup may take 15-30 seconds)"
  sleep 10
else
  print_info "Supabase was already running, skipping wait"
fi

# Verify services are accessible using direct API check
print_info "Verifying service connectivity..."

# Wait for API to be ready with retries (important for Windows)
API_READY=false
MAX_API_CHECKS=10
for i in $(seq 1 $MAX_API_CHECKS); do
  if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:54321/rest/v1/ 2>/dev/null | grep -q "200\|401"; then
    API_READY=true
    break
  fi
  if [ $i -lt $MAX_API_CHECKS ]; then
    print_info "Waiting for API to be ready... (attempt $i/$MAX_API_CHECKS)"
    sleep 2
  fi
done

if [ "$API_READY" = true ]; then
  print_success "Supabase API is accessible at http://127.0.0.1:54321"
else
  print_error "Cannot connect to Supabase API"
  echo ""
  printf "   ${YELLOW}Troubleshooting:${NC}\n"
  echo "   1. Check Docker Desktop is running"
  printf "   2. Manually verify: ${GREEN}docker ps${NC} (should show supabase containers)\n"
  printf "   3. Check ports: ${GREEN}curl http://127.0.0.1:54321/rest/v1/${NC}\n"
  printf "   4. Restart services: ${GREEN}npx supabase stop && npx supabase start${NC}\n"
  echo ""
  exit 1
fi

# ============================================================================
# STEP 7: Reset Database and Apply Migrations
# ============================================================================
print_header "🗄️ Step 7: Resetting Database"

print_info "Applying migrations and base seed data..."
print_info "(This resets the database and loads departments/roles)"
echo ""

# Reset database - this applies migrations and seed.sql
if npx supabase db reset 2>&1 | grep -v "^NOTICE"; then
  print_success "Database reset complete"
else
  print_warning "Database reset completed with notices (this is normal)"
fi

# ============================================================================
# STEP 8: Create Seed Users and Load Data
# ============================================================================
print_header "👥 Step 8: Creating Seed Users and Loading Data"

print_info "Creating test users and loading user-dependent seed data..."
npx tsx scripts/create-seed-users.ts

if [ $? -eq 0 ]; then
  print_success "Seed users and data created successfully"
else
  print_error "Failed to create seed users"
  echo "   You can manually run: npx tsx scripts/create-seed-users.ts"
fi

# ============================================================================
# STEP 9: Run Health Check
# ============================================================================
print_header "🏥 Step 9: Running Health Check"

if [ -f "scripts/docker-health-check.ts" ]; then
  npx tsx scripts/docker-health-check.ts
else
  print_warning "Health check script not found (this is optional)"
fi

# ============================================================================
# STEP 10: Display Next Steps
# ============================================================================
print_header "🎉 Setup Complete!"

echo ""
echo "Your MovaLab development environment is ready!"
echo ""
echo "What's Next:"
echo ""
echo "1. Start the development server:"
printf "   ${GREEN}npm run dev${NC}\n"
echo ""
echo "2. Open your browser:"
printf "   ${BLUE}http://localhost:3000${NC}\n"
echo ""
echo "3. Login with a test user:"
printf "   Email: ${YELLOW}superadmin@test.local${NC}\n"
printf "   Password: ${YELLOW}Test1234!${NC}\n"
echo ""
echo "4. Access Supabase Studio (database UI):"
printf "   ${GREEN}npm run docker:studio${NC}\n"
printf "   or open: ${BLUE}http://localhost:54323${NC}\n"
echo ""
echo "Documentation:"
echo "   - README.md - Project overview"
echo "   - CONTRIBUTING.md - Contribution guidelines"
echo "   - supabase/migrations/README.md - Database migrations guide"
echo ""
echo "Useful Commands:"
printf "   ${GREEN}npm run docker:start${NC}   - Start Supabase services\n"
printf "   ${GREEN}npm run docker:stop${NC}    - Stop Supabase services\n"
printf "   ${GREEN}npm run docker:reset${NC}   - Reset database (re-run migrations)\n"
printf "   ${GREEN}npm run docker:seed${NC}    - Reset database + create seed users\n"
printf "   ${GREEN}npm run docker:health${NC}  - Check system health\n"
echo ""
echo "Test User Accounts:"
printf "   - ${YELLOW}superadmin@test.local${NC}    - Full system access\n"
printf "   - ${YELLOW}exec@test.local${NC}          - Executive Director\n"
printf "   - ${YELLOW}manager@test.local${NC}       - Account Manager\n"
printf "   - ${YELLOW}pm@test.local${NC}            - Project Manager\n"
printf "   - ${YELLOW}designer@test.local${NC}      - Senior Designer\n"
printf "   - ${YELLOW}dev@test.local${NC}           - Senior Developer\n"
printf "   - ${YELLOW}contributor@test.local${NC}   - Part-time Contributor\n"
printf "   - ${YELLOW}client@test.local${NC}        - Client Portal Access\n"
echo ""
printf "   All passwords: ${YELLOW}Test1234!${NC}\n"
echo ""
print_success "Happy coding!"
echo ""

# Keep window open on Windows
if [ "$IS_WINDOWS" = true ]; then
  echo "Press Enter to close this window..."
  read
fi

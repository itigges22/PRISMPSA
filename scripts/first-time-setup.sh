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
if [ -t 1 ]; then
  # Running in a TTY
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  BLUE='\033[0;34m'
  NC='\033[0m' # No Color
else
  # Not a TTY (e.g., PowerShell) - disable colors
  RED=''
  GREEN=''
  YELLOW=''
  BLUE=''
  NC=''
fi

# Helper functions
print_header() {
  echo ""
  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}========================================${NC}"
  echo ""
}

print_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
  echo -e "${RED}❌ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
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
      print_success "Docker Hub authenticated as: $DOCKER_USER"
    else
      print_warning "Docker Hub not authenticated (may hit rate limits)"
      echo "   ${BLUE}Tip: Authenticate to increase rate limits:${NC}"
      echo "   ${GREEN}docker login${NC}"
      echo "   ${YELLOW}(Press Enter to continue anyway or Ctrl+C to cancel)${NC}"

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
  echo "   The file ${YELLOW}supabase/migrations/20250123000000_schema_base.sql${NC} does not exist."
  echo "   This file contains your database table schemas and must be generated"
  echo "   from your cloud Supabase instance."
  echo ""
  echo "   ${BLUE}To generate it, run these commands:${NC}"
  echo ""
  echo "   ${GREEN}supabase link --project-ref oomnezdhkmsfjlihkmui${NC}"
  echo "   ${GREEN}supabase db pull${NC}"
  echo ""
  echo "   This will create a file like: ${YELLOW}20250123XXXXXX_remote_schema.sql${NC}"
  echo ""
  echo "   Then rename it:"
  echo "   ${GREEN}mv supabase/migrations/*_remote_schema.sql supabase/migrations/20250123000000_schema_base.sql${NC}"
  echo ""
  echo "   Finally, run this setup script again:"
  echo "   ${GREEN}./scripts/first-time-setup.sh${NC}"
  echo ""
  exit 1
fi

# ============================================================================
# STEP 3: Install Dependencies
# ============================================================================
print_header "📦 Step 3: Installing Dependencies"

if [ -f "package.json" ]; then
  print_info "Running npm install..."
  npm install
  print_success "Dependencies installed"

  # Verify Supabase CLI is now available (installed as dev dependency)
  if npx supabase --version >/dev/null 2>&1; then
    SUPABASE_VERSION=$(npx supabase --version)
    print_success "Supabase CLI is available: $SUPABASE_VERSION"
  else
    print_error "Supabase CLI not found after npm install"
    echo "   This is unexpected. Please check package.json includes supabase in devDependencies"
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

# Check if already running to use cached images
if npx supabase status >/dev/null 2>&1; then
  print_success "Supabase is already running (using cached images)"
else
  print_info "Starting Supabase for the first time (pulling Docker images)..."
  echo ""
  print_warning "Note: If you get 'Rate exceeded' errors from Docker registry:"
  echo "   1. Wait 6 hours for rate limit to reset, OR"
  echo "   2. Authenticate with Docker Hub: ${GREEN}docker login${NC}"
  echo "   3. Then retry: ${GREEN}npx supabase start${NC}"
  echo ""

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
    echo "   ${YELLOW}Common causes:${NC}"
    echo "   - Docker Hub rate limit exceeded (wait 6 hours or run: ${GREEN}docker login${NC})"
    echo "   - Docker Desktop not running"
    echo "   - Port conflicts (stop other services using ports 54321-54326)"
    echo ""
    echo "   ${YELLOW}Manual recovery:${NC}"
    echo "   1. Authenticate with Docker: ${GREEN}docker login${NC}"
    echo "   2. Stop Supabase: ${GREEN}npx supabase stop${NC}"
    echo "   3. Start again: ${GREEN}npx supabase start${NC}"
    echo ""
    exit 1
  fi
fi

# ============================================================================
# STEP 7: Create Seed Users
# ============================================================================
print_header "👥 Step 7: Creating Seed Users"

print_info "Creating 8 test users in Supabase Auth..."
npx tsx scripts/create-seed-users.ts

if [ $? -eq 0 ]; then
  print_success "Seed users created successfully"
else
  print_error "Failed to create seed users"
  echo "   You can manually create them later with: npx tsx scripts/create-seed-users.ts"
fi

# ============================================================================
# STEP 8: Run Health Check
# ============================================================================
print_header "🏥 Step 8: Running Health Check"

if [ -f "scripts/docker-health-check.ts" ]; then
  npx tsx scripts/docker-health-check.ts
else
  print_warning "Health check script not found (this is optional)"
fi

# ============================================================================
# STEP 9: Display Next Steps
# ============================================================================
print_header "🎉 Setup Complete!"

echo ""
echo "Your MovaLab development environment is ready!"
echo ""
echo "📋 What's Next:"
echo ""
echo "1. Start the development server:"
echo "   ${GREEN}npm run dev${NC}"
echo ""
echo "2. Open your browser:"
echo "   ${BLUE}http://localhost:3000${NC}"
echo ""
echo "3. Login with a test user:"
echo "   Email: ${YELLOW}superadmin@test.local${NC}"
echo "   Password: ${YELLOW}Test1234!${NC}"
echo ""
echo "4. Access Supabase Studio (database UI):"
echo "   ${GREEN}npm run docker:studio${NC}"
echo "   or open: ${BLUE}http://localhost:54323${NC}"
echo ""
echo "📚 Documentation:"
echo "   - README.md - Project overview"
echo "   - CONTRIBUTING.md - Contribution guidelines"
echo "   - supabase/migrations/README.md - Database migrations guide"
echo ""
echo "🔧 Useful Commands:"
echo "   ${GREEN}npm run docker:start${NC}   - Start Supabase services"
echo "   ${GREEN}npm run docker:stop${NC}    - Stop Supabase services"
echo "   ${GREEN}npm run docker:reset${NC}   - Reset database (re-run migrations)"
echo "   ${GREEN}npm run docker:seed${NC}    - Reset database + create seed users"
echo "   ${GREEN}npm run docker:health${NC}  - Check system health"
echo ""
echo "🎯 Test User Accounts:"
echo "   - ${YELLOW}superadmin@test.local${NC}    - Full system access"
echo "   - ${YELLOW}exec@test.local${NC}          - Executive Director"
echo "   - ${YELLOW}manager@test.local${NC}       - Account Manager"
echo "   - ${YELLOW}pm@test.local${NC}            - Project Manager"
echo "   - ${YELLOW}designer@test.local${NC}      - Senior Designer"
echo "   - ${YELLOW}dev@test.local${NC}           - Senior Developer"
echo "   - ${YELLOW}contributor@test.local${NC}   - Part-time Contributor"
echo "   - ${YELLOW}client@test.local${NC}        - Client Portal Access"
echo ""
echo "   All passwords: ${YELLOW}Test1234!${NC}"
echo ""
print_success "Happy coding! 🚀"
echo ""

# Keep window open on Windows
if [ "$IS_WINDOWS" = true ]; then
  echo "Press Enter to close this window..."
  read
fi

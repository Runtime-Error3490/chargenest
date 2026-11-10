#!/bin/bash

# ============================================================================
# ChargeNest - Complete Setup Script
# ============================================================================
# This script will set up and run the entire project from scratch.
# 
# Usage: ./setup.sh [options]
#   --no-docker    Skip Docker database setup (use existing PostgreSQL)
#   --skip-seed    Skip database seeding
#   --build-only   Only build, don't start servers
#   --help         Show help message
#
# Prerequisites:
#   - Node.js 18+ (required)
#   - Docker & Docker Compose (recommended for database)
#   - OR PostgreSQL 14+ running locally
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Configuration
PROJECT_NAME="ChargeNest"
BACKEND_PORT=4000
FRONTEND_PORT=5173
DB_PORT=5432
DB_NAME="evcharge"
DB_USER="postgres"
DB_PASSWORD="postgres"

# Flags
USE_DOCKER=true
RUN_SEED=true
BUILD_ONLY=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --no-docker)
            USE_DOCKER=false
            shift
            ;;
        --skip-seed)
            RUN_SEED=false
            shift
            ;;
        --build-only)
            BUILD_ONLY=true
            shift
            ;;
        --help|-h)
            echo "Usage: ./setup.sh [options]"
            echo ""
            echo "Options:"
            echo "  --no-docker    Skip Docker database setup"
            echo "  --skip-seed    Skip database seeding"
            echo "  --build-only   Only build, don't start servers"
            echo "  --help         Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

# Logging functions
log_header() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC} ${BOLD}$1${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

log_step() {
    echo -e "${BLUE}→${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if port is in use
port_in_use() {
    lsof -i :"$1" >/dev/null 2>&1
}

# Kill process on port
kill_port() {
    local port=$1
    if port_in_use "$port"; then
        log_warning "Killing existing process on port $port..."
        lsof -ti :"$port" | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
}

# ============================================================================
# STEP 1: Check Prerequisites
# ============================================================================
check_prerequisites() {
    log_header "Step 1: Checking Prerequisites"
    
    local has_error=false
    
    # Check Node.js
    if command_exists node; then
        local node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$node_version" -ge 18 ]; then
            log_success "Node.js $(node -v)"
        else
            log_error "Node.js 18+ required, found $(node -v)"
            has_error=true
        fi
    else
        log_error "Node.js not found"
        has_error=true
    fi
    
    # Check npm
    if command_exists npm; then
        log_success "npm $(npm -v)"
    else
        log_error "npm not found"
        has_error=true
    fi
    
    # Check Docker (optional)
    if $USE_DOCKER; then
        if command_exists docker; then
            log_success "Docker $(docker -v | cut -d' ' -f3 | tr -d ',')"
        else
            log_warning "Docker not found - will try to use existing PostgreSQL"
            USE_DOCKER=false
        fi
    fi
    
    # Check PostgreSQL (if not using Docker)
    if ! $USE_DOCKER; then
        if command_exists psql; then
            log_success "PostgreSQL client found"
        else
            log_warning "PostgreSQL client not found (may still work if server is running)"
        fi
    fi
    
    if $has_error; then
        log_error "Please install missing dependencies and try again"
        exit 1
    fi
    
    log_success "All prerequisites satisfied!"
}

# ============================================================================
# STEP 2: Setup Database
# ============================================================================
setup_database() {
    log_header "Step 2: Setting Up Database"
    
    if $USE_DOCKER; then
        log_step "Starting PostgreSQL with Docker..."
        
        cd "$SCRIPT_DIR"
        
        # Create docker-compose if it doesn't exist
        if [ ! -f docker-compose.yml ]; then
            cat > docker-compose.yml << 'DOCKER_EOF'
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: ev-marketplace-db
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: evcharge
    ports:
      - "5432:5432"
    volumes:
      - ev_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  ev_postgres_data:
DOCKER_EOF
            log_success "Created docker-compose.yml"
        fi
        
        # Start database
        docker compose up -d postgres 2>/dev/null || docker-compose up -d postgres
        
        # Wait for database to be ready
        log_step "Waiting for database to be ready..."
        local retries=30
        while [ $retries -gt 0 ]; do
            if docker exec ev-marketplace-db pg_isready -U postgres >/dev/null 2>&1; then
                log_success "Database is ready!"
                break
            fi
            retries=$((retries - 1))
            sleep 1
        done
        
        if [ $retries -eq 0 ]; then
            log_error "Database failed to start"
            exit 1
        fi
    else
        log_step "Using existing PostgreSQL installation..."
        log_warning "Make sure PostgreSQL is running on localhost:5432"
    fi
}

# ============================================================================
# STEP 3: Configure Environment
# ============================================================================
configure_environment() {
    log_header "Step 3: Configuring Environment"
    
    # Backend .env
    log_step "Setting up backend environment..."
    cd "$BACKEND_DIR"
    
    if [ ! -f .env ]; then
        cat > .env << ENV_EOF
# Database
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${DB_PORT}/${DB_NAME}?schema=public"

# JWT Authentication
JWT_SECRET="ev-charging-marketplace-jwt-secret-key-change-in-production-$(date +%s)"
JWT_REFRESH_SECRET="ev-charging-marketplace-refresh-secret-key-change-in-production-$(date +%s)"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# TOTP Encryption (for MFA)
TOTP_ENCRYPTION_KEY="$(openssl rand -hex 16 2>/dev/null || echo 'totp-encryption-key-32-characters!')"

# PayPal Sandbox (replace with your credentials)
PAYPAL_CLIENT_ID="your-paypal-sandbox-client-id"
PAYPAL_CLIENT_SECRET="your-paypal-sandbox-client-secret"
PAYPAL_MODE="sandbox"
PAYPAL_API_URL="https://api-m.sandbox.paypal.com"
PAYPAL_WEBHOOK_ID="your-webhook-id"

# AI provider: openrouter | openai | ollama | mock (mock needs no key)
AI_PROVIDER=mock

# Wallet deposit and Know Your Agent key secret
WALLET_MIN_BALANCE=500
WALLET_DEPOSIT=250
KYA_KEY_SECRET="$(openssl rand -hex 32 2>/dev/null || echo 'kya-key-secret-change-me-32-characters-long')"

# OpenRouter AI (replace with your API key)
OPENROUTER_API_KEY="your-openrouter-api-key"
OPENROUTER_MODEL="meta-llama/llama-3.1-8b-instruct:free"

# Server
PORT=${BACKEND_PORT}
NODE_ENV="development"
FRONTEND_URL="http://localhost:${FRONTEND_PORT}"

# Platform
PLATFORM_FEE_PERCENT=7
ENV_EOF
        log_success "Created backend/.env"
    else
        log_warning "backend/.env already exists, skipping..."
    fi
    
    # Frontend .env
    log_step "Setting up frontend environment..."
    cd "$FRONTEND_DIR"
    
    if [ ! -f .env ]; then
        cat > .env << ENV_EOF
VITE_API_URL=http://localhost:${BACKEND_PORT}/api
VITE_PAYPAL_CLIENT_ID=your-paypal-sandbox-client-id
ENV_EOF
        log_success "Created frontend/.env"
    else
        log_warning "frontend/.env already exists, skipping..."
    fi
}

# ============================================================================
# STEP 4: Install Dependencies
# ============================================================================
install_dependencies() {
    log_header "Step 4: Installing Dependencies"
    
    log_step "Installing backend dependencies..."
    cd "$BACKEND_DIR"
    npm install --silent
    log_success "Backend dependencies installed"
    
    log_step "Installing frontend dependencies..."
    cd "$FRONTEND_DIR"
    npm install --silent
    log_success "Frontend dependencies installed"
}

# ============================================================================
# STEP 5: Setup Database Schema
# ============================================================================
setup_schema() {
    log_header "Step 5: Setting Up Database Schema"
    
    cd "$BACKEND_DIR"
    
    log_step "Generating Prisma client..."
    npx prisma generate
    log_success "Prisma client generated"
    
    log_step "Applying database migrations..."
    npx prisma db push --accept-data-loss 2>/dev/null || npx prisma migrate deploy 2>/dev/null || true
    log_success "Database schema applied"
}

# ============================================================================
# STEP 6: Seed Database
# ============================================================================
seed_database() {
    if ! $RUN_SEED; then
        log_warning "Skipping database seed (--skip-seed flag)"
        return
    fi
    
    log_header "Step 6: Seeding Database"
    
    cd "$BACKEND_DIR"
    
    log_step "Seeding demo data..."
    node prisma/seed.js
    
    log_success "Database seeded successfully!"
}

# ============================================================================
# STEP 7: Build Frontend (for production)
# ============================================================================
build_frontend() {
    log_header "Step 7: Building Frontend"
    
    cd "$FRONTEND_DIR"
    
    log_step "Building production bundle..."
    npm run build
    
    log_success "Frontend built successfully!"
    log_step "Output: $FRONTEND_DIR/dist"
}

# ============================================================================
# STEP 8: Start Development Servers
# ============================================================================
start_servers() {
    if $BUILD_ONLY; then
        log_warning "Skipping server start (--build-only flag)"
        return
    fi
    
    log_header "Step 8: Starting Development Servers"
    
    # Kill any existing processes on our ports
    kill_port $BACKEND_PORT
    kill_port $FRONTEND_PORT
    
    # Start backend
    log_step "Starting backend server..."
    cd "$BACKEND_DIR"
    npm run dev > /tmp/ev-backend.log 2>&1 &
    BACKEND_PID=$!
    
    # Wait for backend to start
    sleep 3
    
    if ! port_in_use $BACKEND_PORT; then
        log_error "Backend failed to start. Check /tmp/ev-backend.log for details"
        exit 1
    fi
    log_success "Backend running on http://localhost:$BACKEND_PORT"
    
    # Start frontend
    log_step "Starting frontend server..."
    cd "$FRONTEND_DIR"
    npm run dev > /tmp/ev-frontend.log 2>&1 &
    FRONTEND_PID=$!
    
    # Wait for frontend to start
    sleep 3
    
    if ! port_in_use $FRONTEND_PORT; then
        log_error "Frontend failed to start. Check /tmp/ev-frontend.log for details"
        exit 1
    fi
    log_success "Frontend running on http://localhost:$FRONTEND_PORT"
    
    # Print success message
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}║   🚗⚡ EV Charging Marketplace is Running!                 ║${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BOLD}URLs:${NC}"
    echo -e "  Frontend:  ${CYAN}http://localhost:$FRONTEND_PORT${NC}"
    echo -e "  Backend:   ${CYAN}http://localhost:$BACKEND_PORT${NC}"
    echo -e "  API:       ${CYAN}http://localhost:$BACKEND_PORT/api${NC}"
    echo ""
    echo -e "${BOLD}Demo Accounts (Password: Demo123!):${NC}"
    echo -e "  Client:       ${YELLOW}client@demo.com${NC}"
    echo -e "  Host:         ${YELLOW}host@demo.com${NC}"
    echo -e "  Client+Host:  ${YELLOW}clienthost@demo.com${NC}"
    echo -e "  Admin:        ${YELLOW}admin@evcharge.com${NC}"
    echo ""
    echo -e "${BOLD}Logs:${NC}"
    echo -e "  Backend:  /tmp/ev-backend.log"
    echo -e "  Frontend: /tmp/ev-frontend.log"
    echo ""
    echo -e "Press ${BOLD}Ctrl+C${NC} to stop all servers"
    echo ""
    
    # Setup trap to cleanup on exit
    trap cleanup INT TERM
    
    # Wait for processes
    wait $BACKEND_PID $FRONTEND_PID 2>/dev/null
}

# Cleanup function
cleanup() {
    echo ""
    log_step "Shutting down servers..."
    
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    
    log_success "Servers stopped. Goodbye!"
    exit 0
}

# ============================================================================
# Main Execution
# ============================================================================
main() {
    echo ""
    echo -e "${BOLD}${CYAN}"
    echo "  ███████╗██╗   ██╗     ██████╗██╗  ██╗ █████╗ ██████╗  ██████╗ ███████╗"
    echo "  ██╔════╝██║   ██║    ██╔════╝██║  ██║██╔══██╗██╔══██╗██╔════╝ ██╔════╝"
    echo "  █████╗  ██║   ██║    ██║     ███████║███████║██████╔╝██║  ███╗█████╗  "
    echo "  ██╔══╝  ╚██╗ ██╔╝    ██║     ██╔══██║██╔══██║██╔══██╗██║   ██║██╔══╝  "
    echo "  ███████╗ ╚████╔╝     ╚██████╗██║  ██║██║  ██║██║  ██║╚██████╔╝███████╗"
    echo "  ╚══════╝  ╚═══╝       ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝"
    echo -e "${NC}"
    echo -e "  ${BOLD}Peer-to-Peer EV Home-Charging Marketplace${NC}"
    echo -e "  PayPal AI Hackathon 2026"
    echo ""
    
    check_prerequisites
    setup_database
    configure_environment
    install_dependencies
    setup_schema
    seed_database
    
    if $BUILD_ONLY; then
        build_frontend
    else
        start_servers
    fi
}

# Run main function
main

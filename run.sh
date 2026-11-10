#!/bin/bash

# ChargeNest - Project Runner
# =========================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

# Print colored message
print_msg() {
    echo -e "${2}${1}${NC}"
}

print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    local missing=0
    
    if command_exists node; then
        print_msg "✓ Node.js $(node -v)" "$GREEN"
    else
        print_msg "✗ Node.js not found" "$RED"
        missing=1
    fi
    
    if command_exists npm; then
        print_msg "✓ npm $(npm -v)" "$GREEN"
    else
        print_msg "✗ npm not found" "$RED"
        missing=1
    fi
    
    if command_exists psql; then
        print_msg "✓ PostgreSQL client installed" "$GREEN"
    else
        print_msg "! PostgreSQL client not found (optional)" "$YELLOW"
    fi
    
    if [ $missing -eq 1 ]; then
        print_msg "\nPlease install missing dependencies and try again." "$RED"
        exit 1
    fi
}

# Install dependencies
install_deps() {
    print_header "Installing Dependencies"
    
    print_msg "Installing backend dependencies..." "$YELLOW"
    cd "$BACKEND_DIR"
    npm install
    
    print_msg "\nInstalling frontend dependencies..." "$YELLOW"
    cd "$FRONTEND_DIR"
    npm install
    
    print_msg "\n✓ All dependencies installed" "$GREEN"
}

# Setup database
setup_database() {
    print_header "Setting Up Database"
    
    cd "$BACKEND_DIR"
    
    # Check if .env exists
    if [ ! -f .env ]; then
        print_msg "Creating .env file from template..." "$YELLOW"
        if [ -f .env.example ]; then
            cp .env.example .env
        else
            cat > .env << 'EOF'
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ev_charging_marketplace?schema=public"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-change-in-production"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# PayPal Sandbox
PAYPAL_CLIENT_ID="your-paypal-sandbox-client-id"
PAYPAL_CLIENT_SECRET="your-paypal-sandbox-client-secret"
PAYPAL_MODE="sandbox"

# OpenRouter AI
OPENROUTER_API_KEY="your-openrouter-api-key"
OPENROUTER_MODEL="meta-llama/llama-3.1-8b-instruct:free"

# Server
PORT=3001
NODE_ENV="development"

# Frontend URL (for CORS)
FRONTEND_URL="http://localhost:5173"
EOF
        fi
        print_msg "✓ .env file created. Please update with your credentials." "$GREEN"
    fi
    
    # Generate Prisma client
    print_msg "\nGenerating Prisma client..." "$YELLOW"
    npx prisma generate
    
    print_msg "\n✓ Prisma client generated" "$GREEN"
}

# Run database migrations
run_migrations() {
    print_header "Running Database Migrations"
    
    cd "$BACKEND_DIR"
    
    print_msg "Running Prisma migrations..." "$YELLOW"
    npx prisma migrate dev --name init 2>/dev/null || npx prisma db push
    
    print_msg "\n✓ Database schema applied" "$GREEN"
}

# Seed the database
seed_database() {
    print_header "Seeding Database"
    
    cd "$BACKEND_DIR"
    
    print_msg "Seeding demo data..." "$YELLOW"
    npm run db:seed
    
    print_msg "\n✓ Database seeded with demo data" "$GREEN"
}

# Start development servers
start_dev() {
    print_header "Starting Development Servers"
    
    # Check if ports are available
    if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_msg "! Port 3001 is already in use" "$YELLOW"
    fi
    
    if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_msg "! Port 5173 is already in use" "$YELLOW"
    fi
    
    print_msg "Starting backend server on http://localhost:3001..." "$YELLOW"
    cd "$BACKEND_DIR"
    npm run dev &
    BACKEND_PID=$!
    
    sleep 2
    
    print_msg "Starting frontend server on http://localhost:5173..." "$YELLOW"
    cd "$FRONTEND_DIR"
    npm run dev &
    FRONTEND_PID=$!
    
    print_msg "\n${GREEN}========================================${NC}"
    print_msg "${GREEN}  ⚡ ChargeNest Running!${NC}"
    print_msg "${GREEN}  Power up at home, anywhere.${NC}"
    print_msg "${GREEN}========================================${NC}"
    echo ""
    print_msg "Frontend: ${BLUE}http://localhost:5173${NC}"
    print_msg "Backend:  ${BLUE}http://localhost:3001${NC}"
    print_msg "API Docs: ${BLUE}http://localhost:3001/api${NC}"
    echo ""
    print_msg "Demo Accounts (Password: REDACTED_PASSWORD):" "$YELLOW"
    print_msg "  Client:      demo_driver@example.com"
    print_msg "  Host:        demo_host@example.com"
    print_msg "  Client+Host: clientdemo_host@example.com"
    print_msg "  Admin:       demo_admin@example.com"
    echo ""
    print_msg "Press Ctrl+C to stop all servers" "$YELLOW"
    
    # Wait for interrupt
    trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
    wait
}

# Build for production
build_prod() {
    print_header "Building for Production"
    
    print_msg "Building frontend..." "$YELLOW"
    cd "$FRONTEND_DIR"
    npm run build
    
    print_msg "\n✓ Production build complete" "$GREEN"
    print_msg "Frontend build output: $FRONTEND_DIR/dist" "$BLUE"
}

# Show help
show_help() {
    echo "ChargeNest - Project Runner"
    echo ""
    echo "Usage: ./run.sh [command]"
    echo ""
    echo "Commands:"
    echo "  install     Install all dependencies"
    echo "  setup       Setup database and generate Prisma client"
    echo "  migrate     Run database migrations"
    echo "  seed        Seed database with demo data"
    echo "  dev         Start development servers (default)"
    echo "  build       Build for production"
    echo "  all         Run full setup: install, setup, migrate, seed, dev"
    echo "  help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./run.sh              # Start dev servers"
    echo "  ./run.sh all          # Full setup and start"
    echo "  ./run.sh install      # Only install dependencies"
    echo ""
}

# Main
main() {
    cd "$PROJECT_DIR"
    
    case "${1:-dev}" in
        install)
            check_prerequisites
            install_deps
            ;;
        setup)
            setup_database
            ;;
        migrate)
            run_migrations
            ;;
        seed)
            seed_database
            ;;
        dev)
            start_dev
            ;;
        build)
            build_prod
            ;;
        all)
            check_prerequisites
            install_deps
            setup_database
            run_migrations
            seed_database
            start_dev
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_msg "Unknown command: $1" "$RED"
            show_help
            exit 1
            ;;
    esac
}

main "$@"

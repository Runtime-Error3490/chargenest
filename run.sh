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
        cp .env.example .env
        # Run out of the box: scripted AI replies need no key. PayPal still needs sandbox credentials.
        sed 's/^AI_PROVIDER=.*/AI_PROVIDER=mock/' .env > .env.tmp && mv .env.tmp .env
        print_msg "✓ .env file created (AI_PROVIDER=mock)." "$GREEN"
        print_msg "  PayPal runs in mock mode until you add sandbox PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET to backend/.env." "$YELLOW"
    fi
    
    # Frontend env: API URL must match the backend PORT
    if [ ! -f "$FRONTEND_DIR/.env" ]; then
        backend_port=$(grep -E '^PORT=' .env | head -1 | cut -d= -f2 | tr -d '"')
        printf 'VITE_API_URL=http://localhost:%s/api\n' "${backend_port:-4000}" > "$FRONTEND_DIR/.env"
        print_msg "✓ frontend/.env created" "$GREEN"
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
    npx prisma migrate deploy 2>/dev/null || npx prisma db push
    
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

# Kill a process and everything it started (npm -> nodemon/vite -> node)
kill_tree() {
    local pid=$1 sig=${2:-TERM} child
    for child in $(pgrep -P "$pid" 2>/dev/null); do
        kill_tree "$child" "$sig"
    done
    kill "-$sig" "$pid" 2>/dev/null || true
}

CLEANING_UP=0
SERVER_PIDS=()

# Stop both dev servers. Runs on Ctrl+C, kill, or when a server exits on its own.
cleanup() {
    local exit_code=${1:-0}
    [ "$CLEANING_UP" -eq 1 ] && return
    CLEANING_UP=1
    trap '' INT TERM

    if [ "${#SERVER_PIDS[@]}" -gt 0 ]; then
        echo ""
        print_msg "Shutting down servers..." "$YELLOW"
        local pid
        for pid in "${SERVER_PIDS[@]}"; do kill_tree "$pid" TERM; done

        # Give them up to 5 seconds, then force-stop whatever is left
        local waited=0 alive
        while [ "$waited" -lt 5 ]; do
            alive=0
            for pid in "${SERVER_PIDS[@]}"; do
                kill -0 "$pid" 2>/dev/null && alive=1
            done
            [ "$alive" -eq 0 ] && break
            sleep 1
            waited=$((waited + 1))
        done
        for pid in "${SERVER_PIDS[@]}"; do
            kill -0 "$pid" 2>/dev/null && kill_tree "$pid" KILL
            wait "$pid" 2>/dev/null || true
        done
        print_msg "✓ Servers stopped" "$GREEN"
    fi
    exit "$exit_code"
}

# Make sure everything the latest code needs is in place before starting
ensure_ready() {
    print_header "Preparing"

    if [ ! -d "$BACKEND_DIR/node_modules" ] || [ ! -d "$FRONTEND_DIR/node_modules" ]; then
        install_deps
    fi

    # Creates backend/.env and frontend/.env if missing, and regenerates the Prisma client
    setup_database

    # Applies any new migrations (wallet, KYA, invoices...) so the database matches the code
    run_migrations
}

# Read PORT from backend/.env (default 4000)
backend_port() {
    local port
    port=$(grep -E '^PORT=' "$BACKEND_DIR/.env" 2>/dev/null | head -1 | cut -d= -f2 | tr -d '"' | tr -d "'")
    echo "${port:-4000}"
}

# Start development servers
start_dev() {
    # `all` has already prepared everything
    [ "${SKIP_PREPARE:-0}" = "1" ] || ensure_ready

    print_header "Starting Development Servers"

    local port
    port=$(backend_port)

    port_busy() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t >/dev/null 2>&1; }

    # The backend port is fixed (the frontend API URL points at it)
    if port_busy "$port"; then
        print_msg "✗ Port $port is already in use. Stop that process or change PORT in backend/.env." "$RED"
        exit 1
    fi

    # The frontend takes the first free port from 5173 up, so another Vite app can keep 5173
    local fport=5173
    while port_busy "$fport"; do fport=$((fport + 1)); done
    if [ "$fport" -ne 5173 ]; then
        print_msg "! Port 5173 is busy, using $fport for the frontend" "$YELLOW"
    fi
    local frontend_url="http://localhost:$fport"

    trap 'cleanup 130' INT
    trap 'cleanup 143' TERM
    trap 'cleanup $?' EXIT

    print_msg "Starting backend server on http://localhost:$port..." "$YELLOW"
    # FRONTEND_URL drives CORS and the PayPal return links, so it must match the frontend port
    (cd "$BACKEND_DIR" && FRONTEND_URL="$frontend_url" exec npm run dev) &
    SERVER_PIDS+=($!)

    sleep 2

    print_msg "Starting frontend server on $frontend_url..." "$YELLOW"
    (cd "$FRONTEND_DIR" && exec npm run dev -- --port "$fport" --strictPort) &
    SERVER_PIDS+=($!)

    print_msg "\n${GREEN}========================================${NC}"
    print_msg "${GREEN}  ⚡ ChargeNest Running!${NC}"
    print_msg "${GREEN}  Power up at home, anywhere.${NC}"
    print_msg "${GREEN}========================================${NC}"
    echo ""
    print_msg "Frontend: ${BLUE}$frontend_url${NC}"
    print_msg "Backend:  ${BLUE}http://localhost:$port${NC}"
    print_msg "API Docs: ${BLUE}http://localhost:$port/api${NC}"
    echo ""
    print_msg "Wallet: run './run.sh seed' once to fund the demo wallets above the minimum balance." "$YELLOW"
    print_msg "Without PayPal keys in backend/.env, PayPal runs in mock mode (payments simulated). AI runs on the provider set by AI_PROVIDER." "$YELLOW"
    echo ""
    print_msg "Demo Accounts (Password: Demo123!):" "$YELLOW"
    print_msg "  Client:      client@demo.com"
    print_msg "  Host:        host@demo.com"
    print_msg "  Client+Host: clienthost@demo.com"
    print_msg "  Admin:       admin@evcharge.com"
    echo ""
    print_msg "Press Ctrl+C to stop all servers" "$YELLOW"

    # Stay here until Ctrl+C, or until either server exits on its own
    while kill -0 "${SERVER_PIDS[0]}" 2>/dev/null && kill -0 "${SERVER_PIDS[1]}" 2>/dev/null; do
        sleep 1
    done
    print_msg "✗ A server stopped unexpectedly" "$RED"
    cleanup 1
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
    echo "  test        Run backend tests"
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
        test)
            (cd "$BACKEND_DIR" && npm test)
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
            SKIP_PREPARE=1
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

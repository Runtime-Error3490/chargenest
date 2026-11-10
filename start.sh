#!/bin/bash

# Quick Start Script for EV Charging Marketplace
# ==============================================
# This script handles everything needed to run the project

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚗⚡ EV Charging Marketplace - Quick Start"
echo "==========================================="
echo ""

# Check if Docker is available for database
if command -v docker &> /dev/null; then
    echo "📦 Starting PostgreSQL database with Docker..."
    cd "$PROJECT_DIR"
    docker-compose up -d postgres 2>/dev/null || docker compose up -d postgres
    
    # Wait for database to be ready
    echo "⏳ Waiting for database to be ready..."
    sleep 3
    
    # Check if database is ready
    for i in {1..10}; do
        if docker exec ev-marketplace-db pg_isready -U postgres &>/dev/null; then
            echo "✅ Database is ready!"
            break
        fi
        sleep 1
    done
else
    echo "⚠️  Docker not found. Make sure PostgreSQL is running manually."
    echo "   Update DATABASE_URL in backend/.env if needed."
fi

echo ""
echo "🔧 Running full setup..."
exec "$PROJECT_DIR/run.sh" all

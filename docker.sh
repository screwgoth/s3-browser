#!/bin/bash

# S3 Navigator Docker Management Script
# Usage: ./docker.sh [command]

set -e

PROJECT_NAME="s3-navigator"
COMPOSE_FILE="docker-compose.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
}

# Start the application
start() {
    log_info "Starting S3 Navigator..."
    docker-compose up -d
    log_info "Application started at http://localhost:3000"
}

# Stop the application
stop() {
    log_info "Stopping S3 Navigator..."
    docker-compose down
    log_info "Application stopped"
}

# Restart the application
restart() {
    log_info "Restarting S3 Navigator..."
    docker-compose restart
    log_info "Application restarted"
}

# View logs
logs() {
    log_info "Showing logs (Ctrl+C to exit)..."
    docker-compose logs -f
}

# Build the image
build() {
    log_info "Building Docker image..."
    docker-compose build --no-cache
    log_info "Build complete"
}

# Rebuild and restart
rebuild() {
    log_info "Rebuilding and restarting S3 Navigator..."
    docker-compose down
    docker-compose build --no-cache
    docker-compose up -d
    log_info "Application rebuilt and started at http://localhost:3000"
}

# Show status
status() {
    log_info "Container status:"
    docker-compose ps
}

# Clean up
clean() {
    log_warn "This will remove all containers, images, and volumes for S3 Navigator"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Cleaning up..."
        docker-compose down -v --rmi all
        log_info "Cleanup complete"
    else
        log_info "Cleanup cancelled"
    fi
}

# Shell into container
shell() {
    log_info "Opening shell in container..."
    docker-compose exec s3-browser sh
}

# Show help
help() {
    cat << EOF
S3 Navigator Docker Management Script

Usage: ./docker.sh [command]

Commands:
  start       Start the application
  stop        Stop the application
  restart     Restart the application
  logs        View application logs
  build       Build Docker image
  rebuild     Rebuild and restart application
  status      Show container status
  shell       Open shell in container
  clean       Remove all containers and images
  help        Show this help message

Examples:
  ./docker.sh start       # Start the application
  ./docker.sh logs        # View logs
  ./docker.sh rebuild     # Rebuild after code changes

EOF
}

# Main script
check_docker

case "${1:-help}" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    logs)
        logs
        ;;
    build)
        build
        ;;
    rebuild)
        rebuild
        ;;
    status)
        status
        ;;
    shell)
        shell
        ;;
    clean)
        clean
        ;;
    help|*)
        help
        ;;
esac

#!/bin/bash

# Application management script for S3 Browser
#
# Manages the Next.js app under PM2 plus its PostgreSQL database (delegated
# to ./db.sh, which owns all Docker Compose handling).
#
# Modes:
#   prod (default) - `next start` on port 3000, PM2 process "s3-browser"
#   dev            - `next dev`   on port 5000, PM2 process "s3-browser-dev"

set -e

cd "$(dirname "$0")"

DB_SCRIPT="./db.sh"

if [ ! -x "$DB_SCRIPT" ]; then
  echo "❌ $DB_SCRIPT not found or not executable (expected alongside app.sh)."
  exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "❌ PM2 not found. Install it with: npm install -g pm2"
  exit 1
fi

COMMAND="$1"
MODE="${2:-${MODE:-prod}}"

case "$MODE" in
  prod)
    APP_NAME="s3-browser"
    APP_PORT="${PORT:-3000}"
    # next start reads PORT from the environment.
    PM2_START=(pm2 start npm --name "$APP_NAME" -- run start)
    ;;
  dev)
    APP_NAME="s3-browser-dev"
    APP_PORT="${PORT:-5000}"
    # npm run dev pins -p 5000, so invoke next directly to honour PORT.
    PM2_START=(pm2 start npx --name "$APP_NAME" -- next dev -p "$APP_PORT" --hostname 0.0.0.0)
    ;;
  *)
    echo "❌ Unknown mode: $MODE (expected 'prod' or 'dev')"
    exit 1
    ;;
esac

app_is_running() {
  pm2 describe "$APP_NAME" >/dev/null 2>&1
}

require_env_file() {
  if [ ! -f .env ]; then
    echo "❌ No .env file found. Copy .env.example to .env and fill it in"
    echo "   (run 'npm run generate-keys' for ENCRYPTION_KEY / NEXTAUTH_SECRET)."
    exit 1
  fi
}

build_app() {
  echo "🏗️  Building the application..."
  npm run build
}

start_app() {
  require_env_file

  if [ "$MODE" = "prod" ] && [ ! -d .next ]; then
    echo "ℹ️  No build found."
    build_app
    echo ""
  fi

  if app_is_running; then
    echo "🔄 Restarting PM2 process '$APP_NAME'..."
    PORT="$APP_PORT" pm2 restart "$APP_NAME" --update-env
  else
    echo "🚀 Starting PM2 process '$APP_NAME' ($MODE mode, port $APP_PORT)..."
    PORT="$APP_PORT" "${PM2_START[@]}"
  fi

  echo "✅ Application running: http://localhost:$APP_PORT"
}

stop_app() {
  if app_is_running; then
    echo "🛑 Stopping PM2 process '$APP_NAME'..."
    pm2 stop "$APP_NAME"
    echo "✅ Application stopped"
  else
    echo "ℹ️  PM2 process '$APP_NAME' is not registered — nothing to stop"
  fi
}

delete_app() {
  if app_is_running; then
    echo "🗑️  Removing PM2 process '$APP_NAME'..."
    pm2 delete "$APP_NAME"
  fi
}

case "$COMMAND" in
  setup)
    require_env_file
    echo "🏗️  Setting up S3 Browser ($MODE mode)..."
    echo ""
    echo "1️⃣  Installing dependencies..."
    npm install
    echo ""
    echo "2️⃣  Setting up the database..."
    "$DB_SCRIPT" setup
    echo ""
    if [ "$MODE" = "prod" ]; then
      echo "3️⃣  Building the application..."
      build_app
      echo ""
    fi
    echo "4️⃣  Starting the application..."
    start_app
    echo ""
    echo "✅ Setup completed!"
    ;;

  start)
    echo "1️⃣  Starting the database..."
    "$DB_SCRIPT" start
    echo ""
    echo "2️⃣  Starting the application..."
    start_app
    ;;

  stop)
    stop_app
    echo ""
    "$DB_SCRIPT" stop
    ;;

  restart)
    echo "🔄 Restarting S3 Browser ($MODE mode)..."
    "$DB_SCRIPT" start
    start_app
    ;;

  build)
    build_app
    echo "✅ Build completed"
    ;;

  status)
    echo "📦 Application (PM2):"
    pm2 list
    echo ""
    echo "🗄️  Database:"
    "$DB_SCRIPT" status
    ;;

  logs)
    pm2 logs "$APP_NAME"
    ;;

  migrate)
    "$DB_SCRIPT" migrate
    ;;

  seed)
    "$DB_SCRIPT" seed
    ;;

  reset)
    stop_app
    echo ""
    "$DB_SCRIPT" reset
    echo ""
    echo "ℹ️  Run './app.sh start $MODE' to bring the application back up."
    ;;

  purge)
    echo "⚠️  WARNING: This will permanently remove:"
    echo "     - the PM2 process '$APP_NAME'"
    echo "     - the database containers AND all data volumes"
    echo "     - the .next build directory"
    echo "     - node_modules"
    echo ""
    read -p "Type 'purge' to confirm: " confirm
    if [ "$confirm" != "purge" ]; then
      echo "❌ Cancelled"
      exit 0
    fi

    delete_app
    echo ""
    echo "🗄️  Destroying the database..."
    printf 'yes\n' | "$DB_SCRIPT" destroy
    echo ""
    echo "🧹 Removing build artifacts and dependencies..."
    rm -rf .next node_modules
    echo ""
    echo "✅ Purge completed. Run './app.sh setup' to rebuild from scratch."
    ;;

  *)
    echo "S3 Browser - Application Management"
    echo ""
    echo "Usage: ./app.sh <command> [mode]"
    echo ""
    echo "Modes:"
    echo "  prod        - next start on port 3000 (default)"
    echo "  dev         - next dev on port 5000"
    echo ""
    echo "Commands:"
    echo "  setup       - First-time setup (install + database + build + start)"
    echo "  start       - Start the database and the application"
    echo "  stop        - Stop the application and the database"
    echo "  restart     - Restart the application (ensures the database is up)"
    echo "  build       - Build the application only"
    echo "  status      - Show PM2 and database status"
    echo "  logs        - Tail application logs"
    echo "  migrate     - Run database migrations"
    echo "  seed        - Seed initial data"
    echo "  reset       - Stop the app and reset the database"
    echo "  purge       - Remove PM2 process, database data, .next and node_modules"
    echo ""
    echo "Examples:"
    echo "  ./app.sh setup             # First-time production setup"
    echo "  ./app.sh start dev         # Start in development mode on port 5000"
    echo "  ./app.sh logs              # Tail production logs"
    echo "  PORT=8080 ./app.sh start   # Override the port"
    echo ""
    echo "Database-only operations live in ./db.sh"
    ;;
esac

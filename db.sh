#!/bin/bash

# Database management script for S3 Browser

set -e

COMPOSE_FILE="docker-compose.db.yml"

case "$1" in
  start)
    echo "🚀 Starting PostgreSQL + pgAdmin..."
    docker-compose -f $COMPOSE_FILE up -d
    echo "✅ Database services started"
    echo ""
    echo "📊 PostgreSQL: localhost:5432"
    echo "🔧 pgAdmin: http://localhost:5050"
    echo ""
    echo "Default credentials:"
    echo "  PostgreSQL: s3admin / s3secure_password_change_me"
    echo "  pgAdmin: admin@s3browser.local / admin_change_me"
    ;;
  
  stop)
    echo "🛑 Stopping database services..."
    docker-compose -f $COMPOSE_FILE stop
    echo "✅ Database services stopped"
    ;;
  
  restart)
    echo "🔄 Restarting database services..."
    docker-compose -f $COMPOSE_FILE restart
    echo "✅ Database services restarted"
    ;;
  
  down)
    echo "⚠️  Stopping and removing containers (data preserved)..."
    docker-compose -f $COMPOSE_FILE down
    echo "✅ Containers removed"
    ;;
  
  destroy)
    echo "⚠️  WARNING: This will delete all database data!"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" == "yes" ]; then
      docker-compose -f $COMPOSE_FILE down -v
      echo "✅ Database destroyed (volumes deleted)"
    else
      echo "❌ Cancelled"
    fi
    ;;
  
  logs)
    docker-compose -f $COMPOSE_FILE logs -f
    ;;
  
  status)
    docker-compose -f $COMPOSE_FILE ps
    ;;
  
  psql)
    echo "🔌 Connecting to PostgreSQL..."
    docker exec -it s3-browser-postgres psql -U s3admin -d s3browser
    ;;
  
  backup)
    BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
    echo "💾 Creating backup: $BACKUP_FILE"
    docker exec s3-browser-postgres pg_dump -U s3admin s3browser > $BACKUP_FILE
    echo "✅ Backup created: $BACKUP_FILE"
    ;;
  
  restore)
    if [ -z "$2" ]; then
      echo "❌ Usage: ./db.sh restore <backup-file.sql>"
      exit 1
    fi
    echo "📥 Restoring from: $2"
    docker exec -i s3-browser-postgres psql -U s3admin s3browser < "$2"
    echo "✅ Restore completed"
    ;;
  
  migrate)
    echo "🔧 Running database migrations..."
    npm run db:migrate
    ;;
  
  seed)
    echo "🌱 Seeding database..."
    npm run db:seed
    ;;
  
  reset)
    echo "⚠️  WARNING: This will reset the database (delete all data)!"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" == "yes" ]; then
      npm run db:reset
    else
      echo "❌ Cancelled"
    fi
    ;;
  
  setup)
    echo "🏗️  Setting up database for the first time..."
    echo ""
    echo "1️⃣  Starting database services..."
    docker-compose -f $COMPOSE_FILE up -d
    echo ""
    echo "2️⃣  Waiting for PostgreSQL to be ready..."
    sleep 5
    echo ""
    echo "3️⃣  Running migrations..."
    npm run db:migrate
    echo ""
    echo "4️⃣  Seeding initial data..."
    npm run db:seed
    echo ""
    echo "✅ Database setup completed!"
    echo ""
    echo "📊 PostgreSQL: localhost:5432"
    echo "🔧 pgAdmin: http://localhost:5050"
    ;;
  
  *)
    echo "S3 Browser - Database Management"
    echo ""
    echo "Usage: ./db.sh <command>"
    echo ""
    echo "Commands:"
    echo "  setup       - First-time setup (start + migrate + seed)"
    echo "  start       - Start database services"
    echo "  stop        - Stop database services"
    echo "  restart     - Restart database services"
    echo "  down        - Stop and remove containers (data preserved)"
    echo "  destroy     - Stop, remove containers and DELETE all data"
    echo "  status      - Show container status"
    echo "  logs        - Show container logs"
    echo "  psql        - Connect to PostgreSQL CLI"
    echo "  migrate     - Run database migrations"
    echo "  seed        - Seed initial data"
    echo "  reset       - Reset database (drop all tables and recreate)"
    echo "  backup      - Create database backup"
    echo "  restore     - Restore from backup file"
    echo ""
    echo "Examples:"
    echo "  ./db.sh setup              # First time setup"
    echo "  ./db.sh start              # Start services"
    echo "  ./db.sh backup             # Create backup"
    echo "  ./db.sh restore backup.sql # Restore from file"
    ;;
esac

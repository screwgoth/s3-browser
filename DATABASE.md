# Database Setup

This document explains how to set up and use PostgreSQL for the S3 Browser application.

## Quick Start

### 1. Start PostgreSQL + pgAdmin

```bash
docker-compose -f docker-compose.db.yml up -d
```

This starts:
- **PostgreSQL 16** on port `5432`
- **pgAdmin 4** on port `5050` (http://localhost:5050)

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and update the `DATABASE_URL` if you changed the default credentials.

### 3. Run Database Migrations

```bash
npm run db:migrate
```

This will create all necessary tables and indexes.

### 4. Seed Initial Data (Optional)

```bash
npm run db:seed
```

Creates the default admin user.

## Database Schema

### Users Table

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Roles:** `viewer`, `uploader`, `bucket-creator`, `admin`

### Buckets Table

```sql
CREATE TABLE buckets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  alias VARCHAR(100) NOT NULL,
  bucket_name VARCHAR(255) NOT NULL,
  region VARCHAR(50) NOT NULL,
  root_folder VARCHAR(500),
  access_key_id TEXT,
  secret_access_key TEXT,
  session_token TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Bucket Assignments Table

```sql
CREATE TABLE bucket_assignments (
  id SERIAL PRIMARY KEY,
  bucket_id INTEGER REFERENCES buckets(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  permission VARCHAR(20) NOT NULL DEFAULT 'read',
  assigned_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(bucket_id, user_id)
);
```

**Permissions:** `read`, `write`, `admin`

### Audit Logs Table

```sql
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username VARCHAR(50),
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(255),
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Application Settings Table

```sql
CREATE TABLE app_settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value JSONB,
  updated_by INTEGER REFERENCES users(id),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Stores application-wide settings like logo, branding, etc.

## Access pgAdmin

1. Open http://localhost:5050
2. Login with:
   - **Email:** `admin@s3browser.local`
   - **Password:** `admin_change_me`
3. Add server connection:
   - **Host:** `postgres` (Docker network name)
   - **Port:** `5432`
   - **Database:** `s3browser`
   - **Username:** `s3admin`
   - **Password:** `s3secure_password_change_me`

## NPM Scripts

Add these to `package.json`:

```json
{
  "scripts": {
    "db:migrate": "node scripts/migrate.js",
    "db:seed": "node scripts/seed.js",
    "db:reset": "node scripts/reset.js"
  }
}
```

## Security Notes

1. **Change default passwords** in `docker-compose.db.yml` before production
2. **Never commit** `.env` file (it's gitignored)
3. **Use environment variables** for all sensitive data
4. **Encrypt credentials** in the database (AWS keys should be encrypted at rest)
5. **Enable SSL** for PostgreSQL in production

## Migration from localStorage

A migration script will be provided to help users move their existing localStorage data to PostgreSQL.

See `scripts/migrate-from-localstorage.js` for details.

## Backup & Restore

### Backup

```bash
docker exec s3-browser-postgres pg_dump -U s3admin s3browser > backup.sql
```

### Restore

```bash
docker exec -i s3-browser-postgres psql -U s3admin s3browser < backup.sql
```

## Troubleshooting

### Connection Issues

Check if PostgreSQL is running:
```bash
docker-compose -f docker-compose.db.yml ps
```

View logs:
```bash
docker-compose -f docker-compose.db.yml logs postgres
```

### Reset Database

⚠️ **Warning:** This deletes all data!

```bash
npm run db:reset
```

Or manually:
```bash
docker-compose -f docker-compose.db.yml down -v
docker-compose -f docker-compose.db.yml up -d
npm run db:migrate
npm run db:seed
```

# S3 Browser - First-Time Setup Guide

Complete guide to set up S3 Browser from scratch with PostgreSQL database backend.

## Prerequisites

Before you begin, ensure you have:

- ✅ **Node.js 18+** - `node --version`
- ✅ **npm** - `npm --version`
- ✅ **Docker & Docker Compose** - `docker --version` and `docker-compose --version`
- ✅ **Git** - `git --version`

## Step-by-Step Setup

### 1. Clone the Repository

```bash
git clone https://github.com/screwgoth/s3-browser.git
cd s3-browser
```

### 2. Checkout Database Branch

```bash
git checkout database-implementation
```

### 3. Install Dependencies

```bash
npm install
```

This will install all required packages including:
- Next.js 15
- PostgreSQL client (pg)
- bcrypt for password hashing
- AWS SDK for S3
- UI components (shadcn/ui)

### 4. Generate Encryption Keys

```bash
npm run generate-keys
```

**Output:**
```
🔑 Generating secure keys for S3 Browser

NEXTAUTH_SECRET (for session management):
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4==

ENCRYPTION_KEY (for AWS credentials):
x9y8z7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0f9e8d7c6==

📝 Add these to your .env file:

NEXTAUTH_SECRET="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4=="
ENCRYPTION_KEY="x9y8z7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0f9e8d7c6=="
```

⚠️ **IMPORTANT:** Save these keys! You'll need them in the next step.

### 5. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` file and add the generated keys:

```env
# Database Configuration
DATABASE_URL="postgresql://s3admin:s3secure_password_change_me@localhost:5432/s3browser"

# Session Secret (from generate-keys)
NEXTAUTH_SECRET="<paste-your-generated-secret>"
NEXTAUTH_URL="http://localhost:5000"

# Encryption Key (from generate-keys)
ENCRYPTION_KEY="<paste-your-generated-key>"
```

**Security Notes:**
- 🔒 Never commit `.env` to git (it's already in `.gitignore`)
- 🔒 Store keys in a password manager
- 🔒 If you lose `ENCRYPTION_KEY`, you cannot recover encrypted AWS credentials

### 6. Start Database

```bash
# Complete setup (start + migrate + seed)
./db.sh setup
```

This will:
1. ✅ Start PostgreSQL 16 and pgAdmin 4 in Docker
2. ✅ Create all database tables
3. ✅ Create default admin user

**Output:**
```
🚀 Starting PostgreSQL + pgAdmin...
✅ Database services started

📊 PostgreSQL: localhost:5432
🔧 pgAdmin: http://localhost:5050

2️⃣  Waiting for PostgreSQL to be ready...

3️⃣  Running migrations...
✅ Schema created successfully

4️⃣  Seeding initial data...
✅ Admin user created:
   ID: 1
   Username: admin
   Role: admin
   Must Change Password: true

🎉 Database setup completed!
```

**Default Credentials:**
- PostgreSQL: `s3admin` / `s3secure_password_change_me`
- pgAdmin: `admin@s3browser.local` / `admin_change_me`
- **App Admin: `admin` / `admin`** ← You'll change this on first login

### 7. Verify Database

```bash
# Check if database is running
./db.sh status

# Connect to database (optional)
./db.sh psql
```

In psql:
```sql
-- List tables
\dt

-- View admin user
SELECT id, username, role, must_change_password FROM users;

-- Expected output:
-- id | username | role  | must_change_password
-- ----+----------+-------+---------------------
-- 1  | admin    | admin | t

-- Exit
\q
```

### 8. Start the Application

```bash
npm run dev
```

**Output:**
```
▲ Next.js 15.3.3
- Local:        http://localhost:5000
- Network:      http://192.168.1.100:5000

✓ Ready in 2.3s
```

### 9. First Login

Open your browser: **http://localhost:5000**

**Login with default credentials:**
- Username: `admin`
- Password: `admin`

**You will be FORCED to change your password!**

### 10. Change Password (Required)

On first login, you'll be redirected to the password change page.

**New password requirements:**
- ✅ At least 8 characters
- ✅ One uppercase letter (A-Z)
- ✅ One lowercase letter (a-z)
- ✅ One number (0-9)

**Example strong password:** `MySecure123`

After changing your password:
- ✅ You'll be redirected to the dashboard
- ✅ Old password (`admin`) will no longer work
- ✅ Your new password is hashed with bcrypt
- ✅ All old sessions are invalidated

### 11. Verify Setup

**Check the dashboard:**
- ✅ You should see the S3 Browser interface
- ✅ No buckets yet (we'll add them next)
- ✅ Users menu available (you're admin)

**Test creating a bucket:**

1. Click "Add S3 Bucket" (or navigate to buckets page)
2. Fill in:
   - Alias: `My First Bucket`
   - Bucket Name: `my-s3-bucket-name`
   - Region: `us-east-1`
   - Access Key ID: (your AWS key)
   - Secret Access Key: (your AWS secret)
3. Click "Add Bucket"

**Verify encryption:**

```bash
./db.sh psql

SELECT 
  alias,
  bucket_name,
  LEFT(access_key_id, 40) as encrypted_preview
FROM buckets;

-- You should see encrypted gibberish, not plaintext
\q
```

## Quick Command Reference

```bash
# Database Management
./db.sh start          # Start database
./db.sh stop           # Stop database
./db.sh status         # Check status
./db.sh psql           # Connect to PostgreSQL
./db.sh logs           # View logs
./db.sh backup         # Create backup
./db.sh reset          # Reset database (⚠️ deletes data!)

# Application
npm run dev            # Start dev server
npm run build          # Build for production
npm run start          # Start production server

# Database Scripts
npm run db:migrate     # Run migrations
npm run db:seed        # Seed data
npm run db:reset       # Reset database
npm run generate-keys  # Generate encryption keys

# Utilities
./db.sh setup          # Complete first-time setup
```

## Access Points

After setup, you can access:

| Service | URL | Credentials |
|---------|-----|-------------|
| **S3 Browser** | http://localhost:5000 | admin / (your new password) |
| **pgAdmin** | http://localhost:5050 | admin@s3browser.local / admin_change_me |
| **PostgreSQL** | localhost:5432 | s3admin / s3secure_password_change_me |

## Troubleshooting

### Port Already in Use

**Problem:** Port 5432 or 5000 already in use

**Solution:**
```bash
# Check what's using port 5432
sudo lsof -i :5432

# Stop other PostgreSQL
sudo systemctl stop postgresql

# Or change port in docker-compose.db.yml
```

### Database Connection Failed

**Problem:** Cannot connect to database

**Solution:**
```bash
# Check if database is running
./db.sh status

# Check logs
./db.sh logs

# Restart database
./db.sh restart
```

### Encryption Key Error

**Problem:** "ENCRYPTION_KEY environment variable is not set"

**Solution:**
```bash
# Generate new keys
npm run generate-keys

# Add to .env file
echo 'ENCRYPTION_KEY="<your-key>"' >> .env

# Restart app
npm run dev
```

### Cannot Login

**Problem:** Invalid username or password

**Solution:**
```bash
# Reset admin password
./db.sh psql

UPDATE users 
SET password_hash = '$2b$10$...' -- Run seed script again
WHERE username = 'admin';

\q

# Or reset entire database
./db.sh reset
```

### Migration Fails

**Problem:** Migration script errors

**Solution:**
```bash
# Drop and recreate
./db.sh destroy  # ⚠️ Deletes all data
./db.sh setup    # Fresh setup
```

## Next Steps

After successful setup:

1. **Create Users** (Admin → Users)
   - Add team members
   - Assign roles (viewer/uploader/bucket-creator/admin)
   - Each user must change password on first login

2. **Add S3 Buckets**
   - Click "Add S3 Bucket"
   - Enter AWS credentials (they'll be encrypted)
   - Test connection before saving

3. **Share Buckets** (optional)
   - Go to Bucket Assignments
   - Assign buckets to users
   - Set permissions (read/write/admin)

4. **View Audit Logs** (Admin → Audit Trail)
   - All actions are logged
   - Filter by user, action, date
   - Export logs for compliance

## Production Deployment

For production:

1. **Change default passwords** in `docker-compose.db.yml`
2. **Use environment variables** (not .env file)
3. **Enable SSL** for PostgreSQL
4. **Set up backups** (automated daily)
5. **Use secrets manager** (AWS Secrets Manager, HashiCorp Vault)
6. **Enable firewall** (only app can access database)
7. **Set up monitoring** (logs, metrics, alerts)

See `MIGRATION_GUIDE.md` for production deployment details.

## Architecture Overview

```
┌─────────────────────┐
│   Next.js App       │
│   (Port 5000)       │
│                     │
│ - Authentication    │
│ - Bucket Management │
│ - S3 Operations     │
└──────────┬──────────┘
           │
           │ Database Connection
           │ (Encrypted Credentials)
           ▼
┌─────────────────────┐
│   PostgreSQL 16     │
│   (Port 5432)       │
│                     │
│ - Users             │
│ - Buckets (encrypted)│
│ - Audit Logs        │
└─────────────────────┘

┌─────────────────────┐
│   pgAdmin 4         │
│   (Port 5050)       │
│                     │
│ Web-based DB admin  │
└─────────────────────┘
```

## Security Checklist

Before going live:

- [ ] Changed all default passwords
- [ ] Generated strong ENCRYPTION_KEY
- [ ] Generated strong NEXTAUTH_SECRET
- [ ] .env file NOT committed to git
- [ ] Database not publicly accessible
- [ ] SSL/TLS enabled for PostgreSQL
- [ ] Regular backups configured
- [ ] Audit logs monitored
- [ ] Session timeout configured
- [ ] Rate limiting enabled
- [ ] Firewall rules in place

## Support & Documentation

- **Setup Issues:** See troubleshooting section above
- **Phase 1 (Auth):** See `PHASE1_TESTING.md`
- **Phase 2 (Buckets):** See `PHASE2_TESTING.md`
- **Phase 3 (UI):** See `PHASE3_STATUS.md`
- **Database Details:** See `DATABASE.md`
- **Migration Guide:** See `MIGRATION_GUIDE.md`

## Success!

If you've completed all steps:
- ✅ Database running
- ✅ Application running on http://localhost:5000
- ✅ Logged in with new password
- ✅ Can see the dashboard

**You're ready to use S3 Browser!** 🎉

---

**Need help?** Check the troubleshooting section or review the testing guides.
